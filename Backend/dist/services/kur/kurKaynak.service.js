import { KurKaynakRepository } from "../../models/kurKaynakSql.repository.js";
import { CompanySqlRepository } from "../../models/companySql.repository.js";
import { KAYNAKLAR } from "../../piyasa/kaynaklar/index.js";
import { PiyasaService } from "../piyasa.service.js";
import { KurService } from "../kur.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { komisyonUygula } from "./kurKomisyon.js";
/**
 * Anlık Fiyat Listesi kur kaynağı (docs/KUR_KAYNAGI_YOL_HARITASI.md).
 * Kaynak: Merkez Bankası (tcmb) ya da Piyasa panosundaki siteler. Komisyon sunucuda uygulanır.
 */
export const TCMB = "tcmb";
/** Verisi bundan eski kaynak uygulanmaz (K9) */
const ESKI_VERI_MS = 90_000;
/** TCMB XML'i firmalar arasında ortak, kısa süre önbellekte (otomatik çekme sık çalışır) */
const TCMB_ONBELLEK_MS = 60_000;
/**
 * Listedeki birim, TCMB'nin birimiyle aynıdır (JPY 100 adet). Siteler 1 adet fiyatı verir → çarpılır.
 */
const SITE_BIRIM_CARPANI = { JPY: 100 };
const HAS = "HAS";
/** Altın ürün tipleri F12 ile HAS'tan hesaplanır, "kaynakta yok" sayılmaz */
const ALTIN_TIPLERI = new Set([1, 3]);
let tcmbOnbellek = null;
let tcmbSonHata = false;
const tcmbKurlari = async () => {
    if (tcmbOnbellek && Date.now() - tcmbOnbellek.zaman < TCMB_ONBELLEK_MS)
        return tcmbOnbellek.veri;
    const veri = await KurService.fetchTcmbRates();
    tcmbSonHata = Object.keys(veri).length === 0;
    if (!tcmbSonHata)
        tcmbOnbellek = { zaman: Date.now(), veri };
    return tcmbOnbellek?.veri ?? veri;
};
export const siteDurumu = (a) => {
    if (a.durum !== "canli")
        return a.durum;
    if (!a.sonGuncelleme || Date.now() - new Date(a.sonGuncelleme).getTime() > ESKI_VERI_MS)
        return "kopuk";
    return "canli";
};
/** Sitenin döviz + HAS satırları → birim kodu başına ham fiyat (ortakKod: USDTRY → USD) */
export const siteHamKurlari = (a) => {
    const harita = new Map();
    for (const g of a.gruplar) {
        for (const s of g.satirlar) {
            const ok = s.ortakKod ?? "";
            const m = /^([A-Z]{3})TRY$/.exec(ok);
            const kod = m ? m[1] : ok === HAS ? HAS : null;
            if (!kod || harita.has(kod))
                continue;
            const c = SITE_BIRIM_CARPANI[kod] ?? 1;
            const alis = s.alis !== null ? s.alis * c : null;
            const satis = s.satis !== null ? s.satis * c : null;
            harita.set(kod, { dovizAlis: alis, dovizSatis: satis, bazAlis: alis, bazSatis: satis });
        }
    }
    return harita;
};
export const tcmbHamKurlari = (veri) => {
    const harita = new Map();
    for (const [kod, r] of Object.entries(veri)) {
        const dovizAlis = r.forexBuying ?? null;
        const dovizSatis = r.forexSelling ?? null;
        // K7: komisyon TCMB efektifinin üstüne, efektif yoksa dövizin üstüne
        harita.set(kod.toUpperCase(), {
            dovizAlis,
            dovizSatis,
            bazAlis: r.banknoteBuying ?? dovizAlis,
            bazSatis: r.banknoteSelling ?? dovizSatis,
        });
    }
    return harita;
};
export const KurKaynakService = {
    /** Soldaki panelin listesi + seçili kaynak */
    async kaynaklar(ctx) {
        const [secili, siteler] = await Promise.all([KurKaynakRepository.seciliKaynak(ctx), PiyasaService.hamAnlik()]);
        const tcmb = {
            kod: TCMB,
            ad: "Merkez Bankası",
            durum: tcmbSonHata ? "kopuk" : "canli",
            sonGuncelleme: tcmbOnbellek ? new Date(tcmbOnbellek.zaman).toISOString() : null,
        };
        return {
            secili,
            kaynaklar: [tcmb, ...siteler.map((a) => ({ kod: a.kod, ad: a.ad, durum: siteDurumu(a), sonGuncelleme: a.sonGuncelleme }))],
        };
    },
    async seciliKaydet(kaynak, degistiren, ctx) {
        if (kaynak !== TCMB && !KAYNAKLAR.some((k) => k.kod === kaynak))
            throw ApiError.badRequest("Geçersiz kur kaynağı.");
        await KurKaynakRepository.kaynakKaydet(kaynak, degistiren, ctx);
    },
    komisyonlar: (ctx) => KurKaynakRepository.komisyonlar(ctx),
    async komisyonKaydet(satirlar, ctx) {
        if (!Array.isArray(satirlar))
            throw ApiError.badRequest("Komisyon listesi gönderilmedi.");
        const temiz = satirlar.map((s) => {
            const deger = (v, ad) => {
                const n = Math.abs(Number(v) || 0);
                if (!Number.isFinite(n) || n > 1_000_000)
                    throw ApiError.badRequest(`${s?.kod ?? ""} ${ad} komisyonu geçersiz.`);
                return n;
            };
            return {
                paraId: Number(s?.paraId),
                alisTur: s?.alisTur === "Y" ? "Y" : "T",
                alisDeger: deger(s?.alisDeger, "alış"),
                satisTur: s?.satisTur === "Y" ? "Y" : "T",
                satisDeger: deger(s?.satisDeger, "satış"),
            };
        });
        for (const s of temiz) {
            if (!Number.isInteger(s.paraId) || s.paraId <= 0)
                throw ApiError.badRequest("Komisyon satırında para birimi eksik.");
            if ((s.alisTur === "Y" && s.alisDeger >= 100) || (s.satisTur === "Y" && s.satisDeger >= 100)) {
                throw ApiError.badRequest("Yüzde komisyon çok büyük.");
            }
        }
        await KurKaynakRepository.komisyonKaydet(temiz, ctx);
    },
    /** Kaynaktan çek, komisyonu uygula, listedeki birimlerle eşle */
    async cek(kaynak, ctx) {
        let ham;
        let kaynakAd;
        let sonGuncelleme;
        if (kaynak === TCMB) {
            const veri = await tcmbKurlari();
            if (Object.keys(veri).length === 0)
                throw ApiError.badRequest("Merkez Bankası kurları alınamadı.");
            ham = tcmbHamKurlari(veri);
            kaynakAd = "Merkez Bankası";
            sonGuncelleme = tcmbOnbellek ? new Date(tcmbOnbellek.zaman).toISOString() : null;
        }
        else {
            if (!KAYNAKLAR.some((k) => k.kod === kaynak))
                throw ApiError.badRequest("Geçersiz kur kaynağı.");
            const a = (await PiyasaService.hamAnlik(kaynak)).find((x) => x.kod === kaynak);
            if (siteDurumu(a) !== "canli") {
                throw ApiError.badRequest(`${a.ad} kaynağına şu an bağlanılamıyor; fiyatlar uygulanmadı.`);
            }
            ham = siteHamKurlari(a);
            kaynakAd = a.ad;
            sonGuncelleme = a.sonGuncelleme;
        }
        const [komisyonlar, tanim] = await Promise.all([
            KurKaynakRepository.komisyonlar(ctx),
            CompanySqlRepository.getDefinitions(ctx),
        ]);
        const ondalik = tanim?.KUR_KURUS_SAYISI ?? 6;
        return KurKaynakService.eslestir(kaynak, kaynakAd, sonGuncelleme, ham, komisyonlar, Number(ondalik));
    },
    /** Saf eşleme (testte doğrudan çağrılır) */
    eslestir(kaynak, kaynakAd, sonGuncelleme, ham, birimler, ondalik) {
        const satirlar = [];
        const eksikBirimler = [];
        let hasGeldi = false;
        for (const b of birimler) {
            const kod = b.kod.trim().replace(/İ/g, "I").toUpperCase();
            const altin = b.urunTipi !== null && ALTIN_TIPLERI.has(b.urunTipi);
            const kur = ham.get(kod);
            const sonuc = kur ? komisyonUygula(kur, b, ondalik) : null;
            if (sonuc) {
                satirlar.push({ paraId: b.paraId, kod: b.kod, ...sonuc });
                if (kod === HAS)
                    hasGeldi = true;
                continue;
            }
            // Altınlar F12 ile hesaplanır; HAS yalnız sitelerde beklenir (TCMB'de yok)
            if (kod === HAS ? kaynak !== TCMB : !altin)
                eksikBirimler.push(b.kod);
        }
        return { kaynak, kaynakAd, sonGuncelleme, satirlar, eksikBirimler, hasGeldi };
    },
};
