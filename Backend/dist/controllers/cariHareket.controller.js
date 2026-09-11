import { CariHareketService } from "../services/cariHareket.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class CariHareketController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body.dbName,
        };
    }
    static getUserId(req) {
        const u = req.user;
        return u?.id ? Number(u.id) : (u?.userId ? Number(u.userId) : 1);
    }
    /**
     * GET /api/v1/cari-hareket
     */
    static list = asyncHandler(async (req, res) => {
        const dbContext = CariHareketController.getDbContext(req);
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            cariKartId: req.query.cariKartId ? Number(req.query.cariKartId) : undefined,
            vezneId: req.query.vezneId ? Number(req.query.vezneId) : undefined,
            tip: req.query.tip !== undefined ? Number(req.query.tip) : undefined,
            hareketTipi: req.query.hareketTipi !== undefined ? Number(req.query.hareketTipi) : undefined,
            search: req.query.search,
        };
        const list = await CariHareketService.list(filters, dbContext);
        return ApiResponse.ok(res, "Cari hareketler başarıyla listelendi.", list);
    });
    /**
     * GET /api/v1/cari-hareket/:id
     */
    static getById = asyncHandler(async (req, res) => {
        const dbContext = CariHareketController.getDbContext(req);
        const item = await CariHareketService.getById(req.params.id, dbContext);
        return ApiResponse.ok(res, "Cari hareket detayı getirildi.", item);
    });
    /**
     * POST /api/v1/cari-hareket
     */
    static create = asyncHandler(async (req, res) => {
        const dbContext = CariHareketController.getDbContext(req);
        const userId = CariHareketController.getUserId(req);
        const created = await CariHareketService.create(req.body, userId, dbContext);
        return ApiResponse.created(res, "Cari hareket başarıyla kaydedildi.", created);
    });
    /**
     * PUT /api/v1/cari-hareket/:id
     */
    static update = asyncHandler(async (req, res) => {
        const dbContext = CariHareketController.getDbContext(req);
        const userId = CariHareketController.getUserId(req);
        const updated = await CariHareketService.update(req.params.id, req.body, userId, dbContext);
        return ApiResponse.ok(res, "Cari hareket başarıyla güncellendi.", updated);
    });
    /**
     * DELETE /api/v1/cari-hareket/:id
     */
    static delete = asyncHandler(async (req, res) => {
        const dbContext = CariHareketController.getDbContext(req);
        await CariHareketService.delete(req.params.id, dbContext);
        return ApiResponse.ok(res, "Cari hareket başarıyla silindi.", { id: req.params.id });
    });
    /**
     * GET /api/v1/cari-hareket/navigation/:id?
     */
    static getNavigation = asyncHandler(async (req, res) => {
        const dbContext = CariHareketController.getDbContext(req);
        const nav = await CariHareketService.getNavigation(req.params.id, dbContext);
        return ApiResponse.ok(res, "Navigasyon bilgisi getirildi.", nav);
    });
    /**
     * GET /api/v1/cari-hareket/bakiye/:cariKartId
     */
    static getCariBakiye = asyncHandler(async (req, res) => {
        const dbContext = CariHareketController.getDbContext(req);
        const bakiye = await CariHareketService.getCariBakiye(req.params.cariKartId, dbContext);
        return ApiResponse.ok(res, "Cari bakiye bilgisi getirildi.", bakiye);
    });
}
