import { KurService } from "../services/kur.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class KurController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body.dbName,
        };
    }
    /**
     * GET /api/v1/kur/tablo
     * Query params: tur (0,1,2,3), tarih (YYYY-MM-DD), id
     */
    static getTablo = asyncHandler(async (req, res) => {
        const dbContext = KurController.getDbContext(req);
        const tur = req.query.tur !== undefined ? Number(req.query.tur) : 0;
        const tarih = req.query.tarih;
        const id = req.query.id ? Number(req.query.id) : undefined;
        const tablo = await KurService.getTablo({ tur, tarih, id }, dbContext);
        return ApiResponse.ok(res, "Kur tablosu başarıyla getirildi.", tablo);
    });
    /**
     * POST /api/v1/kur/kaydet
     * Body: { id?: number, tur: number, zaman?: string, kaynakKurTablosuId?: number, satirlar: [...] }
     */
    static saveTablo = asyncHandler(async (req, res) => {
        const dbContext = KurController.getDbContext(req);
        const saved = await KurService.saveTablo(req.body, dbContext);
        return ApiResponse.ok(res, "Kur tablosu başarıyla kaydedildi.", saved);
    });
    /**
     * POST /api/v1/kur/sakla
     * Body: { kaynakKurTablosuId: number, targetTur?: number, zaman?: string }
     */
    static sakla = asyncHandler(async (req, res) => {
        const dbContext = KurController.getDbContext(req);
        const result = await KurService.sakla(req.body, dbContext);
        return ApiResponse.ok(res, "Kur tablosu saklanan listeye başarıyla aktarıldı.", result);
    });
    /**
     * GET /api/v1/kur/tarihler
     * Query params: tur (default 2)
     */
    static getStoredDates = asyncHandler(async (req, res) => {
        const dbContext = KurController.getDbContext(req);
        const tur = req.query.tur !== undefined ? Number(req.query.tur) : 2;
        const dates = await KurService.getStoredDates(tur, dbContext);
        return ApiResponse.ok(res, "Saklanan kur tarihleri listelendi.", dates);
    });
    /**
     * DELETE /api/v1/kur/tablo/:id
     */
    static deleteTablo = asyncHandler(async (req, res) => {
        const dbContext = KurController.getDbContext(req);
        const id = Number(req.params.id);
        await KurService.deleteTablo(id, dbContext);
        return ApiResponse.ok(res, "Kur tablosu silindi.", { id });
    });
    /**
     * GET /api/v1/kur/tcmb
     */
    static fetchTcmb = asyncHandler(async (_req, res) => {
        const rates = await KurService.fetchTcmbRates();
        return ApiResponse.ok(res, "TCMB kurları başarıyla alındı.", rates);
    });
}
