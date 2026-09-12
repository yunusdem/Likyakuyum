import { VezneIzlemeService } from "../services/vezneIzleme.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
export class VezneIzlemeController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer ||
                req.headers["x-db-server"] ||
                req.query.dbServer ||
                req.body?.dbServer,
            dbName: req.user?.dbName ||
                req.headers["x-db-name"] ||
                req.query.dbName ||
                req.body?.dbName,
        };
    }
    /**
     * GET /api/v1/vezne/izleme
     * Retrieves data matrix and settings
     */
    static getIzlemeData = asyncHandler(async (req, res) => {
        const dbContext = VezneIzlemeController.getDbContext(req);
        const data = await VezneIzlemeService.getIzlemeData(dbContext);
        return ApiResponse.ok(res, "Vezne izleme verileri getirildi.", data);
    });
    /**
     * POST /api/v1/vezne/izleme/tanim
     * Calls SODVZ_VEZNE_IZLEME_TANIMI_KAYDET
     */
    static saveSettings = asyncHandler(async (req, res) => {
        const dbContext = VezneIzlemeController.getDbContext(req);
        const { tazelemeSuresi, ekrandakiVezneSayisi, toplamdaParaKodu, firmaDurumuRaporu } = req.body;
        const payload = {
            tazelemeSuresi: tazelemeSuresi !== undefined ? Number(tazelemeSuresi) : 5,
            ekrandakiVezneSayisi: ekrandakiVezneSayisi !== undefined ? Number(ekrandakiVezneSayisi) : 8,
            toplamdaParaKodu: toplamdaParaKodu === true || toplamdaParaKodu === "true" || toplamdaParaKodu === 1,
            firmaDurumuRaporu: firmaDurumuRaporu === true || firmaDurumuRaporu === "true" || firmaDurumuRaporu === 1,
        };
        const saved = await VezneIzlemeService.saveSettings(payload, dbContext);
        return ApiResponse.ok(res, "Vezne izleme tanımı başarıyla güncellendi.", saved);
    });
    /**
     * POST /api/v1/vezne/izleme/bakiye
     * Updates balance for a specific cash desk and currency
     */
    static updateBakiye = asyncHandler(async (req, res) => {
        const dbContext = VezneIzlemeController.getDbContext(req);
        const { vezneId, paraId, miktar } = req.body;
        if (!vezneId || !paraId) {
            throw ApiError.badRequest("Vezne ID ve Para ID zorunludur.");
        }
        await VezneIzlemeService.updateBakiye(Number(vezneId), Number(paraId), Number(miktar) || 0, dbContext);
        return ApiResponse.ok(res, "Vezne bakiyesi başarıyla güncellendi.");
    });
    /**
     * POST /api/v1/vezne/izleme/toplu-bakiye
     * Batch updates balances for table
     */
    static saveAllBakiyeler = asyncHandler(async (req, res) => {
        const dbContext = VezneIzlemeController.getDbContext(req);
        const { items } = req.body;
        if (!Array.isArray(items)) {
            throw ApiError.badRequest("Geçerli bir bakiye listesi (items) gönderilmelidir.");
        }
        const cleanItems = items.map((it) => ({
            vezneId: Number(it.vezneId),
            paraId: Number(it.paraId),
            miktar: Number(it.miktar) || 0,
        }));
        await VezneIzlemeService.updateAllBakiyeler(cleanItems, dbContext);
        return ApiResponse.ok(res, "Tablo bakiyeleri başarıyla kaydedildi.");
    });
}
