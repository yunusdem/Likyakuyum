import { MobilFirmaSqlRepository } from "../../models/mobilFirmaSql.repository.js";
import { MobilHesapSqlRepository } from "../../models/mobilHesapSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { BelgeGorselService } from "../belge/belgeGorsel.service.js";
import { belgeCiz, belgeKlasoruGorseli } from "../belge/belgeMotor.js";
import { BelgeService } from "../belge/belge.service.js";
import { FisCiktiService } from "../belge/fisCikti.service.js";
import { ekstreKur } from "../rapor/veri/cariTemel.js";
import { bugunTr } from "../../utils/zaman.utils.js";
import { TicariSatisSqlRepository } from "../../models/ticariSatisSql.repository.js";
/**
 * Mobil hesap (docs/MOBIL_CARI_YOL_HARITASI.md K15, K16, V4): bakiye + limit + emanet, hesap dökümü (cari ekstre ile aynı
 * kaynak ve yürüyen bakiye), cariye kesilen fişler ve fişin çıktısı (PDF). Her şey yalnız token'daki cari içindir.
 */
const GUN_MS = 86_400_000;
const EN_UZUN_GUN = 366;
/** "YYYY-AA-GG" denetimi; verilmezse son 30 gün */
export const donemOku = (bas, bit, bugun = new Date()) => {
    const gun = (d) => d.toISOString().slice(0, 10);
    const gecerli = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
    // Varsayılan bitiş: Türkiye takvimine göre bugün (sunucunun saat dilimi farklı olabilir)
    const b = gecerli(bit) ? String(bit) : bugunTr(bugun);
    const a = gecerli(bas) ? String(bas) : gun(new Date(Date.parse(`${b}T00:00:00Z`) - 30 * GUN_MS));
    if (a > b)
        throw ApiError.badRequest("Başlangıç tarihi bitişten sonra olamaz.");
    if ((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / GUN_MS > EN_UZUN_GUN)
        throw ApiError.badRequest("En çok bir yıllık döküm alınabilir.");
    return { bas: a, bit: b };
};
/** Firma gözünden B (cari borçlu) / A (cari alacaklı) → carinin gözünden */
const yonAdi = (yon) => (yon === "B" ? "Borç" : yon === "A" ? "Alacak" : "");
/** Veritabanı DATETIME'ı sürücüde UTC sayılır (duvar saati): gün ve saat UTC alanlarından okunur */
const duvarGun = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const duvarSaat = (d) => (d ? new Date(d).toISOString().slice(11, 16) : "");
export class MobilHesapService {
    /**
     * Bakiye (para başına, sıfırlar hariç) + kartın bakiye sınırı + emanet. Cari Ekstre ile aynı kaynaktan: dökümdeki son
     * bakiyeyle aynıdır (personel ekranındaki bakiye yordamı veritabanına göre farklı kurallarla sayabildiği için kullanılmaz).
     */
    static async bakiye(ctx, cariKartId) {
        const [satirlar, cari, emanet] = await Promise.all([
            MobilHesapSqlRepository.bakiye(ctx, cariKartId),
            MobilFirmaSqlRepository.cari(ctx, cariKartId),
            MobilHesapSqlRepository.emanetBakiyesi(ctx, cariKartId),
        ]);
        return {
            satirlar: satirlar.map((s) => {
                const yon = s.net > 0 ? "A" : "B";
                return { paraKod: s.paraKod, paraAd: s.paraAd, bakiye: Math.abs(s.net), yon, yonAdi: yonAdi(yon) };
            }),
            bakiyeSiniri: cari?.bakiyeSiniri ?? null,
            emanetler: emanet,
        };
    }
    /** Hesap dökümü: para başına devir + hareketler + yürüyen bakiye; emanet bilgi satırları ayrı işaretli */
    static async dokum(ctx, cariKartId, basG, bitG) {
        const { bas, bit } = donemOku(basG, bitG);
        const k = await MobilHesapSqlRepository.dokumKaynaklari(ctx, cariKartId, bas, bit);
        // Belge bağlantısı için hareket satırının kaynağı (evrak tipi 3 = sarraf fişi, 2 = döviz fişi)
        const kaynak = new Map();
        for (const h of k.hareketler)
            kaynak.set(`${h.paraKod}|${h.fisNo}|${duvarGun(h.tarih)}`, { evrakTipi: Number(h.evrakTipi), hareketId: Number(h.hareketId) });
        const e = ekstreKur(k.devirler, k.hareketler, k.bilgiler, { baslangic: bas, bitis: bit, devirSatiri: true });
        // Sıfır devir satırı (dönem öncesi hareketi olmayan para, yalnız emanet bilgisi olan para) gösterilmez
        const satirlar = e.satirlar.filter((s) => !(s.hareketTipi === "Devir" && !s.bakiye)).map((s) => {
            const kay = s.hareketTipi !== "Devir" && !s.bilgiSatiri ? kaynak.get(`${s.paraKod}|${s.fisNo}|${duvarGun(s.tarih)}`) : undefined;
            const belge = kay?.evrakTipi === 3 ? { tur: "SARRAF", id: kay.hareketId } : kay?.evrakTipi === 2 ? { tur: "DOVIZ", id: kay.hareketId } : null;
            return {
                para: s.paraKod,
                tarih: s.hareketTipi === "Devir" ? bas : duvarGun(s.tarih),
                saat: s.saat || "",
                tur: s.bilgiSatiri ? s.hareketTipi : s.hareketTipi === "Devir" ? "Devir" : s.hareketTipi,
                belgeNo: s.fisNo || "",
                aciklama: s.aciklama || "",
                borc: s.borc ?? null,
                alacak: s.alacak ?? null,
                emanet: s.bilgiSatiri ? s.emanet : null,
                bakiye: s.bakiye,
                yon: s.yon,
                yonAdi: yonAdi(s.yon),
                belge,
            };
        });
        return {
            bas,
            bit,
            satirlar,
            toplamlar: e.paraToplamlari.filter((t) => t.cari !== "GENEL TOPLAM").map((t) => ({ para: t.paraKod, borc: t.borc, alacak: t.alacak, bakiye: t.bakiye, yon: t.yon, yonAdi: yonAdi(t.yon) })),
        };
    }
    static async belgeler(ctx, cariKartId, basG, bitG) {
        const { bas, bit } = donemOku(basG, bitG);
        const l = await MobilHesapSqlRepository.belgeler(ctx, cariKartId, bas, bit);
        return {
            bas,
            bit,
            belgeler: l.map((b) => ({
                tur: b.tur,
                id: b.id,
                satir: b.satir,
                belgeNo: b.belgeNo,
                tarih: duvarGun(b.tarih),
                saat: duvarSaat(b.zaman),
                ad: b.tur === "TICARI" ? "Satış fişi" : `${b.tur === "SARRAF" ? "Sarraf" : b.paraKod ? `Döviz (${b.paraKod})` : "Döviz"} ${b.tip === 1 ? "satış" : "alış"} fişi`,
                tip: b.tip,
                toplamTl: b.toplamTl,
            })),
        };
    }
    /** Fişin çıktısı (PDF, A4). Fiş başka cariye aitse "bulunamadı". */
    static async belgePdf(ctx, cariKartId, tur, id, satir) {
        const t = tur === "SARRAF" ? "SARRAF" : tur === "DOVIZ" ? "DOVIZ" : tur === "TICARI" ? "TICARI" : null;
        if (!t || !Number.isInteger(id) || id <= 0 || !(await MobilHesapSqlRepository.belgeSahibiMi(ctx, cariKartId, t, id)))
            throw ApiError.notFound("Belge bulunamadı.");
        if (t === "DOVIZ") {
            // Her satır ayrı e-Döviz belgesidir; satır verilmezse ilk satır
            const no = satir !== undefined && Number.isInteger(satir) && satir >= 0 ? satir : 0;
            const ettn = await MobilHesapSqlRepository.dovizSatirEttn(ctx, id, no);
            const s = await BelgeService.pdf({ fisId: id, ettn: ettn || undefined, bicim: "a4" }, "mobil", ctx);
            return { pdf: s.pdf, ad: s.belgeNo || `fis-${id}` };
        }
        if (t === "TICARI") {
            // Ticari satış fişi: Perakende fiş çıktısı (firmanın fiş tasarımı), kayıtlı fişten
            const f = await TicariSatisSqlRepository.getir(id, ctx);
            if (!f)
                throw ApiError.notFound("Belge bulunamadı.");
            const c = await FisCiktiService.perakende(f, "A4", ctx);
            const gorsel = await BelgeGorselService.cozucu(c.sablon, belgeKlasoruGorseli, ctx);
            const pdf = await belgeCiz(c.sablon, c.veri, `Satış Fişi - ${f.faturaNo}`, gorsel);
            return { pdf, ad: f.faturaNo || `satis-${id}` };
        }
        const f = await MobilHesapSqlRepository.sarrafFisi(ctx, id);
        if (!f.baslik)
            throw ApiError.notFound("Belge bulunamadı.");
        const girdi = sarrafGirdisi(f);
        const c = await FisCiktiService.sarraf(girdi, "A4", ctx);
        const gorsel = await BelgeGorselService.cozucu(c.sablon, belgeKlasoruGorseli, ctx);
        const pdf = await belgeCiz(c.sablon, c.veri, `${c.veri?.baslik || "Sarraf Fişi"} - ${girdi.belgeNo}`, gorsel);
        return { pdf, ad: girdi.belgeNo || `sarraf-${id}` };
    }
}
/** Kayıtlı sarraf fişi → çıktı girdisi (Sarraf Fişi ekranının yazdırırken gönderdiği alanlar) */
export const sarrafGirdisi = (f) => {
    const b = f.baslik;
    const sayi = (v) => Number(v) || 0;
    const satirlar = f.satirlar.map((s) => ({
        urunKodu: s.URUN_KOD,
        urunAdi: s.URUN_AD,
        aciklama: s.ACIKLAMA || "",
        adet: sayi(s.ADET),
        miktar: sayi(s.MIKTAR),
        milyem: sayi(s.MILYEM),
        hasGram: sayi(s.HAS_GRAM),
        kur: sayi(s.KUR),
        tutar: sayi(s.TUTAR),
        urunTipi: s.URUN_TIPI,
    }));
    // Cari ödemesi (İşleme yeri 1) çıktıda "Nakit" değil "Cari hesap" yazsın: müşteri kendi fişinde ödemenin hesabına yazıldığını görür
    const tlMi = (k) => ["TL", "TRY", "TRL"].includes(String(k || "").toLocaleUpperCase("tr-TR"));
    const odemeSatirlari = f.odemeler.map((o) => {
        const cari = Number(o.ISLEME_YERI) === 1;
        const kod = cari ? `Cari hesap${tlMi(o.PARA_KOD) ? "" : ` ${o.PARA_KOD}`}` : o.PARA_KOD;
        return { odemeAraciTuru: o.ODEME_ARACI_TURU, paraKodu: kod, paraAdi: cari ? kod : o.PARA_AD, miktar: sayi(o.MIKTAR), tutar: sayi(o.TUTAR) };
    });
    const toplamTutar = satirlar.reduce((t, s) => t + s.tutar, 0);
    const odenenTutar = odemeSatirlari.reduce((t, o) => t + o.tutar, 0);
    return {
        fisId: b.SARRAF_FISI_ID,
        tip: Number(b.TIP) === 1 ? 1 : 0,
        tarih: duvarGun(b.TARIH),
        // Çıktı saati "SS:DD" bekler (duvar saati)
        saat: duvarSaat(b.SAAT || b.TARIH),
        seriNo: "",
        belgeNo: String(b.FIS_NO || "").trim(),
        unvan: String(b.UNVAN || "").trim(),
        vergiKimlikNo: String(b.VERGI_KIMLIK_NO || "").trim(),
        detayIl: b.IL_AD || "",
        detayIlce: b.ILCE_AD || "",
        detayPasaportNo: String(b.PASAPORT_NO || "").trim(),
        detayAdres: String(b.ADRES || "").trim(),
        detayTelefonNo: String(b.TELEFON_NO || "").trim(),
        vezneKod: b.VEZNE_KOD || "",
        kullaniciAdi: b.KULLANICI_AD || "",
        kdvOrani: b.KDV_ORANI,
        satirlar,
        odemeSatirlari,
        toplamTutar,
        toplamHas: satirlar.reduce((t, s) => t + s.hasGram, 0),
        odenenTutar,
        kalanTutar: Math.round((toplamTutar - odenenTutar) * 100) / 100,
    };
};
