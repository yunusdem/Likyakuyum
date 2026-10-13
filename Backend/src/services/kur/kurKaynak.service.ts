import { KurKaynakRepository, type DbContext, type KurKomisyonSatiri } from "../../models/kurKaynakSql.repository.js";
import { CompanySqlRepository } from "../../models/companySql.repository.js";
import { KAYNAKLAR } from "../../piyasa/kaynaklar/index.js";
import type { KaynakAnlik } from "../../piyasa/tipler.js";
import { PiyasaService } from "../piyasa.service.js";
import { KurService } from "../kur.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { komisyonUygula, type HamKur, type KomisyonluKur } from "./kurKomisyon.js";

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
const SITE_BIRIM_CARPANI: Record<string, number> = { JPY: 100 };

const HAS = "HAS";
/** Altın ürün tipleri F12 ile HAS'tan hesaplanır, "kaynakta yok" sayılmaz */
const ALTIN_TIPLERI = new Set([1, 3]);

export type KaynakDurum = "canli" | "bekliyor" | "kopuk";

export interface KaynakBilgi {
  kod: string;
  ad: string;
  durum: KaynakDurum;
  sonGuncelleme: string | null;
}

export interface KaynakSatiri extends KomisyonluKur {
  paraId: number;
  kod: string;
}

export interface KaynakSonucu {
  kaynak: string;
  kaynakAd: string;
  sonGuncelleme: string | null;
  satirlar: KaynakSatiri[];
  /** Listede olup kaynakta bulunmayan döviz birimleri (K8) */
  eksikBirimler: string[];
  hasGeldi: boolean;
}

let tcmbOnbellek: { zaman: number; veri: Awaited<ReturnType<typeof KurService.fetchTcmbRates>> } | null = null;
let tcmbSonHata = false;

const tcmbKurlari = async () => {
  if (tcmbOnbellek && Date.now() - tcmbOnbellek.zaman < TCMB_ONBELLEK_MS) return tcmbOnbellek.veri;
  const veri = await KurService.fetchTcmbRates();
  tcmbSonHata = Object.keys(veri).length === 0;
  if (!tcmbSonHata) tcmbOnbellek = { zaman: Date.now(), veri };
  return tcmbOnbellek?.veri ?? veri;
};

export const siteDurumu = (a: KaynakAnlik): KaynakDurum => {
  if (a.durum !== "canli") return a.durum;
  if (!a.sonGuncelleme || Date.now() - new Date(a.sonGuncelleme).getTime() > ESKI_VERI_MS) return "kopuk";
  return "canli";
};

/** Sitenin döviz + HAS satırları → birim kodu başına ham fiyat (ortakKod: USDTRY → USD) */
export const siteHamKurlari = (a: KaynakAnlik): Map<string, HamKur> => {
  const harita = new Map<string, HamKur>();
  for (const g of a.gruplar) {
    for (const s of g.satirlar) {
      const ok = s.ortakKod ?? "";
      const m = /^([A-Z]{3})TRY$/.exec(ok);
      const kod = m ? m[1] : ok === HAS ? HAS : null;
      if (!kod || harita.has(kod)) continue;
      const c = SITE_BIRIM_CARPANI[kod] ?? 1;
      const alis = s.alis !== null ? s.alis * c : null;
      const satis = s.satis !== null ? s.satis * c : null;
      harita.set(kod, { dovizAlis: alis, dovizSatis: satis, bazAlis: alis, bazSatis: satis });
    }
  }
  return harita;
};

export const tcmbHamKurlari = (veri: Awaited<ReturnType<typeof KurService.fetchTcmbRates>>): Map<string, HamKur> => {
  const harita = new Map<string, HamKur>();
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
  async kaynaklar(ctx: DbContext): Promise<{ secili: string; kaynaklar: KaynakBilgi[] }> {
    const [secili, siteler] = await Promise.all([KurKaynakRepository.seciliKaynak(ctx), PiyasaService.hamAnlik()]);
    const tcmb: KaynakBilgi = {
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

  async seciliKaydet(kaynak: string, degistiren: string | null, ctx: DbContext): Promise<void> {
    if (kaynak !== TCMB && !KAYNAKLAR.some((k) => k.kod === kaynak)) throw ApiError.badRequest("Geçersiz kur kaynağı.");
    await KurKaynakRepository.kaynakKaydet(kaynak, degistiren, ctx);
  },

  komisyonlar: (ctx: DbContext) => KurKaynakRepository.komisyonlar(ctx),

  async komisyonKaydet(satirlar: unknown, ctx: DbContext): Promise<void> {
    if (!Array.isArray(satirlar)) throw ApiError.badRequest("Komisyon listesi gönderilmedi.");
    const temiz = satirlar.map((s: any) => {
      const deger = (v: unknown, ad: string) => {
        const n = Math.abs(Number(v) || 0);
        if (!Number.isFinite(n) || n > 1_000_000) throw ApiError.badRequest(`${s?.kod ?? ""} ${ad} komisyonu geçersiz.`);
        return n;
      };
      return {
        paraId: Number(s?.paraId),
        alisTur: s?.alisTur === "Y" ? ("Y" as const) : ("T" as const),
        alisDeger: deger(s?.alisDeger, "alış"),
        satisTur: s?.satisTur === "Y" ? ("Y" as const) : ("T" as const),
        satisDeger: deger(s?.satisDeger, "satış"),
      };
    });
    for (const s of temiz) {
      if (!Number.isInteger(s.paraId) || s.paraId <= 0) throw ApiError.badRequest("Komisyon satırında para birimi eksik.");
      if ((s.alisTur === "Y" && s.alisDeger >= 100) || (s.satisTur === "Y" && s.satisDeger >= 100)) {
        throw ApiError.badRequest("Yüzde komisyon çok büyük.");
      }
    }
    await KurKaynakRepository.komisyonKaydet(temiz, ctx);
  },

  /** Kaynaktan çek, komisyonu uygula, listedeki birimlerle eşle */
  async cek(kaynak: string, ctx: DbContext): Promise<KaynakSonucu> {
    let ham: Map<string, HamKur>;
    let kaynakAd: string;
    let sonGuncelleme: string | null;

    if (kaynak === TCMB) {
      const veri = await tcmbKurlari();
      if (Object.keys(veri).length === 0) throw ApiError.badRequest("Merkez Bankası kurları alınamadı.");
      ham = tcmbHamKurlari(veri);
      kaynakAd = "Merkez Bankası";
      sonGuncelleme = tcmbOnbellek ? new Date(tcmbOnbellek.zaman).toISOString() : null;
    } else {
      if (!KAYNAKLAR.some((k) => k.kod === kaynak)) throw ApiError.badRequest("Geçersiz kur kaynağı.");
      const a = (await PiyasaService.hamAnlik(kaynak)).find((x) => x.kod === kaynak)!;
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
  eslestir(
    kaynak: string,
    kaynakAd: string,
    sonGuncelleme: string | null,
    ham: Map<string, HamKur>,
    birimler: KurKomisyonSatiri[],
    ondalik: number
  ): KaynakSonucu {
    const satirlar: KaynakSatiri[] = [];
    const eksikBirimler: string[] = [];
    let hasGeldi = false;
    for (const b of birimler) {
      const kod = b.kod.trim().replace(/İ/g, "I").toUpperCase();
      const altin = b.urunTipi !== null && ALTIN_TIPLERI.has(b.urunTipi);
      const kur = ham.get(kod);
      const sonuc = kur ? komisyonUygula(kur, b, ondalik) : null;
      if (sonuc) {
        satirlar.push({ paraId: b.paraId, kod: b.kod, ...sonuc });
        if (kod === HAS) hasGeldi = true;
        continue;
      }
      // Altınlar F12 ile hesaplanır; HAS yalnız sitelerde beklenir (TCMB'de yok)
      if (kod === HAS ? kaynak !== TCMB : !altin) eksikBirimler.push(b.kod);
    }
    return { kaynak, kaynakAd, sonGuncelleme, satirlar, eksikBirimler, hasGeldi };
  },
};
