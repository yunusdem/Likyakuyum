import { CariDekontService } from "../services/cariDekont.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class CariDekontController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.headers["x-db-server"] || req.query.dbServer || req.body?.dbServer,
            dbName: req.user?.dbName || req.headers["x-db-name"] || req.query.dbName || req.body?.dbName,
        };
    }
    /**
     * GET /api/v1/cari-dekont
     * List dekonts with optional search, tip, vezneId filter
     */
    static getDekontList = asyncHandler(async (req, res) => {
        const dbContext = CariDekontController.getDbContext(req);
        const filter = {
            search: req.query.search,
            tip: req.query.tip !== undefined ? Number(req.query.tip) : undefined,
            vezneId: req.query.vezneId ? Number(req.query.vezneId) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : 100,
        };
        const list = await CariDekontService.getDekontList(filter, dbContext);
        return ApiResponse.ok(res, "Cari dekontlar listelendi.", list);
    });
    /**
     * GET /api/v1/cari-dekont/:id
     * Fetch single dekont with items
     */
    static getDekontById = asyncHandler(async (req, res) => {
        const dbContext = CariDekontController.getDbContext(req);
        const id = Number(req.params.id);
        const dekont = await CariDekontService.getDekontById(id, dbContext);
        return ApiResponse.ok(res, "Cari dekont detayları getirildi.", dekont);
    });
    /**
     * POST /api/v1/cari-dekont/kaydet
     * Calls Stored Procedure SODVZ_CARI_DEKONT_KAYDET
     */
    static saveDekont = asyncHandler(async (req, res) => {
        const dbContext = CariDekontController.getDbContext(req);
        const u = req.user;
        const kullaniciId = u?.userId || u?.id || req.body.kullaniciId || 1;
        const payload = {
            ...req.body,
            kullaniciId,
        };
        const saved = await CariDekontService.saveDekont(payload, dbContext);
        return ApiResponse.ok(res, "Cari dekont başarıyla kaydedildi.", saved);
    });
    /**
     * DELETE /api/v1/cari-dekont/:id
     * Calls Stored Procedure SODVZ_CARI_DEKONT_SIL
     */
    static deleteDekont = asyncHandler(async (req, res) => {
        const dbContext = CariDekontController.getDbContext(req);
        const id = Number(req.params.id);
        const u = req.user;
        const kullaniciId = u?.userId || u?.id || req.body?.kullaniciId || 1;
        const degisiklikTakipVar = req.body?.degisiklikTakipVar !== false;
        await CariDekontService.deleteDekont(id, kullaniciId, degisiklikTakipVar, dbContext);
        return ApiResponse.ok(res, "Cari dekont başarıyla silindi.", { cariDekontId: id });
    });
}
