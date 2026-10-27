import { z } from "zod";
import { BelgeService } from "../services/belge/belge.service.js";
import { FisCiktiService } from "../services/belge/fisCikti.service.js";
import { belgeCiz, belgeKlasoruGorseli } from "../services/belge/belgeMotor.js";
import { BelgeGorselService } from "../services/belge/belgeGorsel.service.js";
import { BELGE_DURUMLARI } from "../models/belgeSql.repository.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
const belgeNoSema = z.string().trim().toUpperCase().regex(/^[A-Z]{3}\d{13}$/, "Belge numarası 3 harf + 13 rakam olmalıdır (örn. DIA2026000000004).");
const istekSema = z.object({
    fisId: z.coerce.number().int().positive().optional(),
    belgeNo: belgeNoSema.optional(),
    kod: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{1,20}$/).optional(),
    bicim: z.enum(["a4", "80"]).optional(),
}).refine(v => v.fisId || v.belgeNo, { message: "fisId veya belgeNo verilmelidir." });
const listeSema = z.object({
    kaynak: z.enum(["DOVIZ", "FATURA", "IRSALIYE", "GIDER"]).optional(),
    tip: z.preprocess(v => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(0).max(1).optional()),
    durum: z.enum(BELGE_DURUMLARI).optional(),
    baslangic: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    bitis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    arama: z.string().trim().max(100).optional(),
    sayfa: z.coerce.number().int().min(1).optional(),
    boyut: z.coerce.number().int().min(1).max(200).optional(),
});
const sayiAlani = z.union([z.number(), z.string().max(40)]).optional().nullable();
const metinAlani = (n = 200) => z.string().max(n).optional().nullable().transform(v => v ?? undefined);
/** Döviz fişi ekranının yazdırma anındaki görüntüsü (DovizFisiPrintModal). */
const dovizCiktiSema = z.object({
    fisId: z.coerce.number().int().nonnegative().optional().nullable(),
    tip: z.coerce.number().int().min(0).max(1),
    tarih: metinAlani(30), saat: metinAlani(20), seriNo: metinAlani(40), belgeNo: metinAlani(40),
    unvan: metinAlani(300), vergiKimlikNo: metinAlani(20), detayIl: metinAlani(100), detayIlce: metinAlani(100),
    detayUyruk: metinAlani(100), detayPasaportNo: metinAlani(40), detayMeslek: metinAlani(100), detayCariTipi: metinAlani(40),
    vezneKod: metinAlani(20), istatistikKodu: metinAlani(20), guid: metinAlani(60),
    lines: z.array(z.object({
        paraKodu: metinAlani(10), paraAdi: metinAlani(100), miktar: sayiAlani, kur: sayiAlani, tutar: sayiAlani,
    }).passthrough()).max(200),
    toplamTutar: sayiAlani, odemeTutari: sayiAlani, bsmvTutari: sayiAlani, komisyonTutari: sayiAlani, giseUsdKuru: sayiAlani,
    dovizKurusSayisi: sayiAlani, kurKurusSayisi: sayiAlani, tlKurusSayisi: sayiAlani,
}).passthrough();
const bicimAlani = z.enum(["80", "A4"]).optional().default("80");
/** Sarraf fişi ekranının yazdırma anındaki görüntüsü (SarrafFisiPrintModal). */
const sarrafCiktiSema = z.object({
    bicim: bicimAlani,
    fisId: z.coerce.number().int().nonnegative().optional().nullable(),
    tip: z.coerce.number().int().min(0).max(1),
    tarih: metinAlani(30), saat: metinAlani(20), seriNo: metinAlani(40), belgeNo: metinAlani(40),
    unvan: metinAlani(300), vergiKimlikNo: metinAlani(20), detayIl: metinAlani(100), detayIlce: metinAlani(100),
    detayPasaportNo: metinAlani(40), detayAdres: metinAlani(500), detayTelefonNo: metinAlani(40), vezneKod: metinAlani(20), kullaniciAdi: metinAlani(100),
    satirlar: z.array(z.object({
        urunKodu: metinAlani(60), urunAdi: metinAlani(300), aciklama: metinAlani(500),
        adet: sayiAlani, miktar: sayiAlani, milyem: sayiAlani, hasGram: sayiAlani, kur: sayiAlani, tutar: sayiAlani,
    }).passthrough()).max(300),
    odemeSatirlari: z.array(z.object({ paraKodu: metinAlani(20), paraAdi: metinAlani(100), adet: sayiAlani, miktar: sayiAlani, tutar: sayiAlani }).passthrough()).max(100).optional(),
    toplamTutar: sayiAlani, toplamHas: sayiAlani, odenenTutar: sayiAlani, kalanTutar: sayiAlani,
}).passthrough();
/** Ticari satış fişi: kayıtlı fiş (TicariSatisFisi) ya da ekrandaki fiş */
const ticariCiktiSema = z.object({
    bicim: bicimAlani,
    fatura: z.object({
        faturaId: z.coerce.number().int().nonnegative().optional().nullable(),
        faturaNo: metinAlani(40), ettn: metinAlani(60), tarih: metinAlani(40), senaryo: metinAlani(40), vezneKod: metinAlani(20),
        aliciVknTckn: metinAlani(20), aliciUnvan: metinAlani(300), adres: metinAlani(500), ilce: metinAlani(100), il: metinAlani(100),
        vergiDairesi: metinAlani(100), eposta: metinAlani(200), telefon: metinAlani(40),
        iskontoTuru: sayiAlani, iskontoDegeri: sayiAlani,
        satirlar: z.array(z.object({
            kod: metinAlani(60), barkod: metinAlani(60), urunAdi: metinAlani(300), birim: metinAlani(20),
            satirNo: sayiAlani, miktar: sayiAlani, kdvDahilFiyat: sayiAlani, kdvOrani: sayiAlani, iskontoTuru: sayiAlani, iskontoDegeri: sayiAlani,
        }).passthrough()).max(300).optional().nullable(),
        odemeler: z.array(z.object({ odemeAraciTuru: sayiAlani, paraKodu: metinAlani(20), paraAdi: metinAlani(100), cariUnvan: metinAlani(300), miktar: sayiAlani, tutar: sayiAlani }).passthrough()).max(100).optional().nullable(),
    }).passthrough(),
});
/** Perakende fişi: kayıtlı fatura (PerakendeFaturaModel) ya da kayıt yükü. */
const perakendeCiktiSema = z.object({
    bicim: bicimAlani,
    fatura: z.object({
        faturaId: z.coerce.number().int().nonnegative().optional().nullable(),
        faturaNo: metinAlani(40), ettn: metinAlani(60), tarih: metinAlani(40), faturaTipi: z.coerce.number().int().optional().nullable(), senaryo: metinAlani(40),
        aliciVknTckn: metinAlani(20), aliciUnvan: metinAlani(300), adres: metinAlani(500), ilce: metinAlani(100), il: metinAlani(100),
        vergiDairesi: metinAlani(100), eposta: metinAlani(200), telefon: metinAlani(40), paraKodu: metinAlani(10),
        araToplam: sayiAlani, toplamKdv: sayiAlani, iskontoOrani: sayiAlani, iskontoTutari: sayiAlani, genelToplam: sayiAlani,
        satirlar: z.array(z.object({
            barkod: metinAlani(60), urunAdi: metinAlani(300), ayar: metinAlani(40), birim: metinAlani(20),
            satirNo: sayiAlani, miktar: sayiAlani, gram: sayiAlani, hasGram: sayiAlani, birimFiyat: sayiAlani, kdvOrani: sayiAlani, kdvTutari: sayiAlani, toplamTutar: sayiAlani,
        }).passthrough()).max(300).optional().nullable(),
    }).passthrough(),
});
export class BelgeController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body?.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body?.dbName,
        };
    }
    static kullanici(req) { return req.user?.username || "belge"; }
    /** GET /api/v1/belge/sablonlar?tur=BELGE|RAPOR */
    static sablonlar = asyncHandler(async (req, res) => {
        const tur = req.query.tur === "RAPOR" ? "RAPOR" : req.query.tur === "BELGE" ? "BELGE" : undefined;
        return ApiResponse.ok(res, "Şablonlar listelendi.", await BelgeService.sablonlar(tur, BelgeController.getDbContext(req)));
    });
    /** GET /api/v1/belge/fisler?kaynak=DOVIZ|FATURA|IRSALIYE|GIDER&tip=0|1&durum&baslangic&bitis&arama&sayfa&boyut — kaynak boşsa hepsi */
    static fisler = asyncHandler(async (req, res) => {
        const p = listeSema.safeParse(req.query);
        if (!p.success)
            throw ApiError.badRequest("Fiş listesi filtresi geçersiz.", p.error.format());
        if (p.data.baslangic && p.data.bitis && p.data.baslangic > p.data.bitis)
            throw ApiError.badRequest("Başlangıç tarihi bitişten sonra olamaz.");
        return ApiResponse.ok(res, "Fişler listelendi.", await BelgeService.fisler(p.data, BelgeController.getDbContext(req)));
    });
    /** GET /api/v1/belge/pdf?fisId=123 | ?belgeNo=DIA2026000000004 [&kod=ALFIS1] [&bicim=a4|80] [&indir=1] — indir=1 varsayılan bicim=80 */
    static pdf = asyncHandler(async (req, res) => {
        const p = istekSema.safeParse(req.query);
        if (!p.success)
            throw ApiError.badRequest(p.error.issues[0]?.message || "Belge isteği geçersiz.");
        const indir = ["1", "true", "evet"].includes(String(req.query.indir || "").toLowerCase());
        const istek = { ...p.data, bicim: p.data.bicim || (indir ? "80" : "a4") };
        const s = await BelgeService.pdf(istek, BelgeController.kullanici(req), BelgeController.getDbContext(req));
        // İndirilen fiş, arşivdeki yerine yazılır (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K8); önizleme ve taslak yazılmaz
        if (indir && !s.onizleme)
            void BelgeService.kopyala(s, BelgeController.getDbContext(req));
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `${indir ? "attachment" : "inline"}; filename="${s.belgeNo || "belge"}.pdf"`);
        res.setHeader("Content-Length", String(s.pdf.length));
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Belge-Kaynak", s.kaynak);
        res.setHeader("X-Belge-Onizleme", s.onizleme ? "1" : "0");
        res.setHeader("X-Belge-Bicim", istek.bicim);
        return res.status(200).end(s.pdf);
    });
    /**
     * POST /api/v1/belge/pdf/onizleme
     * Ekrandaki fiş verisinden (kaydedilmemiş taslak / teklif dahi olsa) doğrudan PDF çıktısı döner.
     */
    static pdfOnizleme = asyncHandler(async (req, res) => {
        const { tur, bicim = "80", ...girdi } = req.body || {};
        let c;
        if (tur === "doviz") {
            c = await FisCiktiService.doviz(girdi, BelgeController.getDbContext(req));
        }
        else if (tur === "sarraf") {
            c = await FisCiktiService.sarraf(girdi, bicim, BelgeController.getDbContext(req));
        }
        else if (tur === "perakende") {
            c = await FisCiktiService.perakende((girdi.fatura || girdi), bicim, BelgeController.getDbContext(req));
        }
        else if (tur === "ticari") {
            c = await FisCiktiService.ticari(girdi, bicim, BelgeController.getDbContext(req));
        }
        else {
            throw ApiError.badRequest("Geçersiz fiş türü.");
        }
        const gorsel = await BelgeGorselService.cozucu(c.sablon, belgeKlasoruGorseli, BelgeController.getDbContext(req));
        const baslik = c.veri?.belgeNo ? `${c.veri.belgeNo} - ${c.sablon.ad}` : (c.sablon.ad || "Fiş");
        const pdf = await belgeCiz(c.sablon, c.veri, baslik, gorsel);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${c.veri?.belgeNo || "fis"}.pdf"`);
        res.setHeader("Content-Length", String(pdf.length));
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).end(pdf);
    });
    /**
     * POST /api/v1/belge/cikti/doviz  { ...döviz fişi ekran görüntüsü }
     * Yazıcı / önizleme için şablon + veri + görseller döner; fiş verisini değiştirmez.
     */
    static dovizCiktisi = asyncHandler(async (req, res) => {
        const p = dovizCiktiSema.safeParse(req.body || {});
        if (!p.success)
            throw ApiError.badRequest(p.error.issues[0]?.message || "Fiş çıktısı isteği geçersiz.");
        const sonuc = await FisCiktiService.doviz(p.data, BelgeController.getDbContext(req));
        return ApiResponse.ok(res, "Fiş çıktısı hazırlandı.", sonuc);
    });
    /** POST /api/v1/belge/cikti/sarraf  { bicim: "80" | "A4", ...sarraf fişi ekran görüntüsü } */
    static sarrafCiktisi = asyncHandler(async (req, res) => {
        const p = sarrafCiktiSema.safeParse(req.body || {});
        if (!p.success)
            throw ApiError.badRequest(p.error.issues[0]?.message || "Fiş çıktısı isteği geçersiz.");
        const { bicim, ...girdi } = p.data;
        const sonuc = await FisCiktiService.sarraf(girdi, bicim, BelgeController.getDbContext(req));
        return ApiResponse.ok(res, "Fiş çıktısı hazırlandı.", sonuc);
    });
    /** POST /api/v1/belge/cikti/perakende  { bicim: "80" | "A4", fatura } */
    static perakendeCiktisi = asyncHandler(async (req, res) => {
        const p = perakendeCiktiSema.safeParse(req.body || {});
        if (!p.success)
            throw ApiError.badRequest(p.error.issues[0]?.message || "Fiş çıktısı isteği geçersiz.");
        const sonuc = await FisCiktiService.perakende(p.data.fatura, p.data.bicim, BelgeController.getDbContext(req));
        return ApiResponse.ok(res, "Fiş çıktısı hazırlandı.", sonuc);
    });
    /** POST /api/v1/belge/cikti/ticari  { bicim: "80" | "A4", fatura } — Ticari satış fişi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T17) */
    static ticariCiktisi = asyncHandler(async (req, res) => {
        const p = ticariCiktiSema.safeParse(req.body || {});
        if (!p.success)
            throw ApiError.badRequest(p.error.issues[0]?.message || "Fiş çıktısı isteği geçersiz.");
        let sonuc;
        try {
            sonuc = await FisCiktiService.ticari(p.data.fatura, p.data.bicim, BelgeController.getDbContext(req));
        }
        catch (e) {
            if (e instanceof ApiError)
                throw e;
            throw ApiError.badRequest(e?.message || "Fiş hesaplanamadı.");
        }
        return ApiResponse.ok(res, "Fiş çıktısı hazırlandı.", sonuc);
    });
    /** POST /api/v1/belge/arsivle  { fisId | belgeNo, kod? } */
    static arsivle = asyncHandler(async (req, res) => {
        const p = istekSema.safeParse(req.body || {});
        if (!p.success)
            throw ApiError.badRequest(p.error.issues[0]?.message || "Arşiv isteği geçersiz.");
        const sonuc = await BelgeService.arsivle(p.data, BelgeController.kullanici(req), BelgeController.getDbContext(req));
        return ApiResponse.ok(res, `${sonuc.belgeNo} arşive yazıldı.`, sonuc);
    });
}
