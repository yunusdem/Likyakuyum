import { asyncHandler } from "../utils/asyncHandler.js";
import { PosCihaziService } from "../services/posCihazi.service.js";
import { ApiError } from "../utils/ApiError.js";
export class PosCihaziController {
    static getDbContext(req) {
        const dbServer = req.headers["x-db-server"];
        const dbName = req.headers["x-db-name"];
        return { dbServer, dbName };
    }
    static getPosCihazlari = asyncHandler(async (req, res) => {
        const dbContext = PosCihaziController.getDbContext(req);
        const list = await PosCihaziService.getPosCihazlari(dbContext);
        res.json({
            success: true,
            data: list,
            count: list.length,
        });
    });
    static getPosCihaziById = asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (isNaN(id) || id <= 0)
            throw ApiError.badRequest("Geçersiz POS Cihazı ID");
        const dbContext = PosCihaziController.getDbContext(req);
        const item = await PosCihaziService.getPosCihaziById(id, dbContext);
        if (!item)
            throw ApiError.notFound("POS Cihazı bulunamadı");
        res.json({
            success: true,
            data: item,
        });
    });
    static getPosCihaziBakiye = asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (isNaN(id) || id <= 0)
            throw ApiError.badRequest("Geçersiz POS Cihazı ID");
        const dbContext = PosCihaziController.getDbContext(req);
        const bakiye = await PosCihaziService.getPosCihaziBakiye(id, dbContext);
        res.json({
            success: true,
            data: { posCihaziId: id, bakiye },
        });
    });
    static getNextPosKod = asyncHandler(async (req, res) => {
        const dbContext = PosCihaziController.getDbContext(req);
        const kod = await PosCihaziService.getNextPosKod(dbContext);
        res.json({
            success: true,
            data: { kod },
        });
    });
    static savePosCihazi = asyncHandler(async (req, res) => {
        const { ad } = req.body;
        if (!ad || !String(ad).trim())
            throw ApiError.badRequest("POS Cihaz Adı zorunludur.");
        const dbContext = PosCihaziController.getDbContext(req);
        const saved = await PosCihaziService.savePosCihazi(req.body, dbContext);
        res.status(200).json({
            success: true,
            message: "POS Cihazı başarıyla kaydedildi.",
            data: saved,
        });
    });
    static deletePosCihazi = asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (isNaN(id) || id <= 0)
            throw ApiError.badRequest("Geçersiz POS Cihazı ID");
        const dbContext = PosCihaziController.getDbContext(req);
        const ok = await PosCihaziService.deletePosCihazi(id, dbContext);
        if (!ok)
            throw ApiError.notFound("POS Cihazı silinemedi veya kayıt bulunamadı.");
        res.json({
            success: true,
            message: "POS Cihazı başarıyla silindi.",
        });
    });
}
