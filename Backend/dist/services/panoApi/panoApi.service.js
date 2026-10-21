import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { PanoAnahtarSqlRepository } from "../../models/admin/panoAnahtarSql.repository.js";
import { PanoSqlRepository } from "../../models/panoSql.repository.js";
import { logger } from "../../utils/logger.js";
import { firmaDbContextHazirla } from "../admin/firmaBaglanti.service.js";
import { firmaEngeli } from "../merkezGiris.service.js";
import { guncellemeZamani, satirKur } from "./panoBicim.js";
/**
 * Pano Entegrasyonu açık uçlarının çekirdeği (docs/PANO_API_YOL_HARITASI.md). Anahtar → firma → firma DB'sindeki pano
 * tanımı + komisyonlu Kur Tablosu (PanoSqlRepository.getLiveBoardData ile aynı kaynak, P1). Pano başına önbellek (P6),
 * sayaçlar bellekte toplanıp 60 sn'de bir yazılır (P10). Firma/modül durumu 403 (P7).
 */
export const PANO_API_MODULU = "kur:kur/pano-entegrasyonu";
export const ANAHTAR_DESENI = /^[a-z0-9]{32}$/;
/** Açık uçların hata kodları: 404 ANAHTAR_YOK / PANO_YOK, 403 KAPALI, 503 BAGLANTI */
export class PanoApiHatasi extends Error {
    durum;
    kod;
    constructor(durum, kod, mesaj) {
        super(mesaj);
        this.durum = durum;
        this.kod = kod;
    }
}
const ANAHTAR_ONBELLEK_MS = 30_000;
const SAYAC_YAZMA_MS = 60_000;
const anahtarOnbellegi = new Map();
/**
 * Doğrulanmış firma bağlantısı (firmaDbContextHazirla: bağlantı sınanır, havuzun gerçekten o veritabanına bağlandığı
 * denetlenir). MerkezGirisService.firmaBaglantisi KULLANILMAZ: bağlantı kurulamayınca .env'deki veritabanına düşer,
 * başka firmanın panosu yayınlanırdı. 5 dk tutulur; hata olunca düşer.
 */
const BAGLANTI_ONBELLEK_MS = 5 * 60_000;
const baglantiOnbellegi = new Map();
const veriOnbellegi = new Map();
const sayaclar = new Map();
let sayacZamanlayici = null;
const simdi = () => Date.now();
const panoAdi = (p, unvan) => (p.firmaAdi || "").trim() || unvan;
const gorunumu = (p) => ({
    paraBasligi: p.paraBasligi || "",
    alisKuruBasligi: p.alisKuruBasligi || "",
    satisKuruBasligi: p.satisKuruBasligi || "",
    firmaAdiOzellikleri: p.firmaAdiOzellikleri || "",
    tarihSaatOzellikleri: p.tarihSaatOzellikleri || "",
    baslikOzellikleri: p.baslikOzellikleri || "",
    satirOzellikleri: p.satirOzellikleri || "",
    zeminRengi: p.zeminRengi || "",
    kodAlaniGenisligi: Number(p.kodAlaniGenisligi) || 0,
    kurAlaniGenisligi: Number(p.kurAlaniGenisligi) || 0,
});
export class PanoApiService {
    /** Anahtar üretildi / iptal edildi / süre değişti: o adresin bütün önbelleği düşer (eski adres anında kapanır) */
    static onbellegiDusur(anahtar) {
        if (!anahtar)
            return;
        anahtarOnbellegi.delete(anahtar);
        veriOnbellegi.delete(anahtar);
    }
    static tumOnbellegiTemizle() {
        anahtarOnbellegi.clear();
        veriOnbellegi.clear();
    }
    /** Pano verisini pano başına önbellek süresiyle döndürür; her çağrı sayaca yazılır (önbellekten dönse de) */
    static async getir(anahtar) {
        const { kayit, engel } = await PanoApiService.anahtarBilgisi(anahtar);
        if (!kayit)
            throw new PanoApiHatasi(404, "ANAHTAR_YOK", "Anahtar tanımlı değil.");
        if (kayit.durum !== "AKTIF")
            throw new PanoApiHatasi(403, "KAPALI", "Anahtar iptal edilmiş.");
        if (engel)
            throw new PanoApiHatasi(403, "KAPALI", engel);
        PanoApiService.say(kayit.anahtarId);
        const onbellek = veriOnbellegi.get(anahtar);
        if (onbellek && simdi() - onbellek.zaman < kayit.onbellekSn * 1000)
            return onbellek.sonuc;
        const sonuc = await PanoApiService.veriyiOku(kayit);
        veriOnbellegi.set(anahtar, { zaman: simdi(), sonuc });
        return sonuc;
    }
    /** Anahtar kaydı + firma/modül engeli, 30 sn önbellekli (her saniye admin DB'ye gidilmesin) */
    static async anahtarBilgisi(anahtar) {
        const o = anahtarOnbellegi.get(anahtar);
        if (o && simdi() - o.zaman < ANAHTAR_ONBELLEK_MS)
            return o;
        let kayit = null;
        let engel = null;
        try {
            kayit = ANAHTAR_DESENI.test(anahtar) ? await PanoAnahtarSqlRepository.anahtarlaBul(anahtar) : null;
            if (kayit && kayit.durum === "AKTIF")
                engel = await PanoApiService.firmaEngeli(kayit.firmaId);
        }
        catch (err) {
            logger.error(`[PANO-API] Anahtar okunamadı: ${err?.message}`);
            throw new PanoApiHatasi(503, "BAGLANTI", "Sunucu şu an yanıt veremiyor.");
        }
        const yeni = { zaman: simdi(), kayit, engel };
        anahtarOnbellegi.set(anahtar, yeni);
        return yeni;
    }
    /** Firma AKTIF ve lisansı sürüyor mu, modül firmaya açık mı. null = engel yok */
    static async firmaEngeli(firmaId) {
        const firma = await FirmaSqlRepository.idIleBul(firmaId);
        if (!firma)
            return "Firma bulunamadı.";
        const kod = firmaEngeli(firma);
        if (kod)
            return kod === "LISANS_BITTI" ? "Firmanın lisans süresi dolmuş." : "Firma hesabı kullanımda değil.";
        const moduller = await ModulSqlRepository.firmaAcikModulleri(firmaId);
        if (moduller !== null && !moduller.includes(PANO_API_MODULU))
            return "Pano Entegrasyonu modülü bu firmaya açık değil.";
        return null;
    }
    static async veriyiOku(kayit) {
        let pano;
        let unvan = "";
        try {
            const ctx = await PanoApiService.firmaBaglantisi(kayit.firmaId);
            unvan = (await FirmaSqlRepository.idIleBul(kayit.firmaId))?.unvan || "";
            pano = await PanoSqlRepository.getLiveBoardData(kayit.panoId, ctx);
        }
        catch (err) {
            baglantiOnbellegi.delete(kayit.firmaId);
            logger.error(`[PANO-API] Firma ${kayit.firmaId} pano ${kayit.panoId} okunamadı: ${err?.message}`);
            throw new PanoApiHatasi(503, "BAGLANTI", "Firma verisine şu an ulaşılamıyor.");
        }
        if (!pano)
            throw new PanoApiHatasi(404, "PANO_YOK", "Pano tanımı silinmiş.");
        const satirlar = pano.satirlar
            .filter((s) => s.gorunur !== false)
            .map((s) => satirKur(s.kod, s.gorunecekAd || s.ad, s.dovizAlis, s.dovizSatis));
        return {
            veri: { firma: panoAdi(pano, unvan), pano: (pano.panoNo || "").trim() || String(pano.panoId), guncelleme: guncellemeZamani(), satirlar },
            gorunum: gorunumu(pano),
            kayit,
        };
    }
    static async firmaBaglantisi(firmaId) {
        const o = baglantiOnbellegi.get(firmaId);
        if (o && simdi() - o.zaman < BAGLANTI_ONBELLEK_MS)
            return o.ctx;
        const ctx = await firmaDbContextHazirla(firmaId);
        baglantiOnbellegi.set(firmaId, { zaman: simdi(), ctx });
        return ctx;
    }
    // ------------------------------------------------------------------------------------------- sayaçlar ---
    static say(anahtarId) {
        const s = sayaclar.get(anahtarId);
        if (s) {
            s.adet += 1;
            s.son = new Date();
        }
        else
            sayaclar.set(anahtarId, { adet: 1, son: new Date() });
        if (!sayacZamanlayici) {
            sayacZamanlayici = setInterval(() => void PanoApiService.sayaclariYaz(), SAYAC_YAZMA_MS);
            sayacZamanlayici.unref();
        }
    }
    /** Bellekteki sayaçları veritabanına yazar (zamanlayıcı, iptal/yenileme ve kapanışta) */
    static async sayaclariYaz() {
        if (!sayaclar.size)
            return;
        const liste = [...sayaclar.entries()].map(([anahtarId, s]) => ({ anahtarId, adet: s.adet, son: s.son }));
        sayaclar.clear();
        try {
            await PanoAnahtarSqlRepository.sayacYaz(liste);
        }
        catch (err) {
            logger.warn(`[PANO-API] Sayaç yazılamadı: ${err?.message}`);
            for (const s of liste) {
                const v = sayaclar.get(s.anahtarId);
                if (v) {
                    v.adet += s.adet;
                    if (s.son > v.son)
                        v.son = s.son;
                }
                else
                    sayaclar.set(s.anahtarId, { adet: s.adet, son: s.son });
            }
        }
    }
    /** Bellekte bekleyen (henüz yazılmamış) sayaç; ekranlarda kayıtlıya eklenir */
    static bekleyenSayac(anahtarId) {
        const s = sayaclar.get(anahtarId);
        return s ? { adet: s.adet, son: s.son } : null;
    }
}
process.once("beforeExit", () => void PanoApiService.sayaclariYaz());
