import { z } from "zod";
import { RaporService } from "../services/rapor/rapor.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
const tarih = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG olmalı").optional();
const saat = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Saat SS:DD olmalı").transform(s => (s.length === 5 ? s + ":00" : s)).optional();
const idOpt = z.preprocess(v => (v === "" || v === undefined || v === null ? undefined : v), z.coerce.number().int().positive().optional());
const parametreSema = z.object({
    tarih, baslangic: tarih, bitis: tarih, baslangicSaat: saat, bitisSaat: saat,
    vezneId: idOpt, paraId: idOpt, cariKartId: idOpt,
    fisTipi: z.preprocess(v => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(0).max(1).optional()),
    kurTuru: z.preprocess(v => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().optional()),
    kurTarihi: tarih, kurAlani: z.enum(["alis", "satis"]).optional(),
    arama: z.string().trim().max(100).optional(), kmt: z.string().trim().max(10).optional(),
});
const kodSema = z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{1,20}$/);
export class RaporController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body?.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body?.dbName,
        };
    }
    static kullanici(req) { return req.user?.username || "rapor"; }
    static parametreler(req) {
        const p = parametreSema.safeParse(req.query);
        if (!p.success)
            throw ApiError.badRequest(p.error.issues[0]?.message || "Rapor parametreleri geçersiz.", p.error.format());
        if (p.data.baslangic && p.data.bitis && p.data.baslangic > p.data.bitis)
            throw ApiError.badRequest("Başlangıç tarihi bitişten sonra olamaz.");
        return p.data;
    }
    static kod(req) {
        const k = kodSema.safeParse(req.params.kod);
        if (!k.success)
            throw ApiError.badRequest("Rapor kodu geçersiz.");
        return k.data;
    }
    /** GET /api/v1/rapor/sablonlar */
    static sablonlar = asyncHandler(async (req, res) => ApiResponse.ok(res, "Raporlar listelendi.", await RaporService.sablonlar(RaporController.getDbContext(req))));
    /** GET /api/v1/rapor/:kod/tanim — parametre şeması + kolonlar (ekran filtre şeridi ve grid için) */
    static tanim = asyncHandler(async (req, res) => ApiResponse.ok(res, "Rapor tanımı.", RaporService.tanim(RaporController.kod(req))));
    /** GET /api/v1/rapor/:kod/veri?... — ekran grid'i */
    static veri = asyncHandler(async (req, res) => {
        const v = await RaporService.veri(RaporController.kod(req), RaporController.parametreler(req), RaporController.getDbContext(req));
        return ApiResponse.ok(res, v.sinirAsildi ? `Rapor ${v.toplamKayit} satır üretiyor; üst sınır aşıldı. Tarih aralığını daraltın.` : "Rapor verisi.", { satirlar: v.satirlar, filtreOzeti: v.filtreOzeti, ekDipnot: v.ekDipnot, sinirAsildi: !!v.sinirAsildi, toplamKayit: v.toplamKayit, tanim: v.tanim });
    });
    /** GET /api/v1/rapor/:kod/pdf?...[&indir=1] */
    static pdf = asyncHandler(async (req, res) => {
        const { pdf, tanim } = await RaporService.pdf(RaporController.kod(req), RaporController.parametreler(req), RaporController.kullanici(req), RaporController.getDbContext(req));
        const indir = ["1", "true"].includes(String(req.query.indir || ""));
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `${indir ? "attachment" : "inline"}; filename="${tanim.kod}.pdf"`);
        res.setHeader("Content-Length", String(pdf.length));
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).end(pdf);
    });
    /** GET /api/v1/rapor/:kod/excel?... */
    static excel = asyncHandler(async (req, res) => {
        const { xlsx, tanim } = await RaporService.excel(RaporController.kod(req), RaporController.parametreler(req), RaporController.kullanici(req), RaporController.getDbContext(req));
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${tanim.kod}.xlsx"`);
        res.setHeader("Content-Length", String(xlsx.length));
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).end(xlsx);
    });
}
