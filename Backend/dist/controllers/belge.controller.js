import { z } from "zod";
import { BelgeService } from "../services/belge/belge.service.js";
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
    tip: z.coerce.number().int().min(0).max(1).optional(),
    baslangic: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    bitis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    arama: z.string().trim().max(100).optional(),
    sayfa: z.coerce.number().int().min(1).optional(),
    boyut: z.coerce.number().int().min(1).max(200).optional(),
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
    /** GET /api/v1/belge/fisler?tip=0|1&baslangic&bitis&arama&sayfa&boyut */
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
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `${indir ? "attachment" : "inline"}; filename="${s.belgeNo || "belge"}.pdf"`);
        res.setHeader("Content-Length", String(s.pdf.length));
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Belge-Kaynak", s.kaynak);
        res.setHeader("X-Belge-Onizleme", s.onizleme ? "1" : "0");
        res.setHeader("X-Belge-Bicim", istek.bicim);
        return res.status(200).end(s.pdf);
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
