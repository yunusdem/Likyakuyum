import { CariService } from "../services/cari.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class CariController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body.dbName,
        };
    }
    /**
     * GET /api/v1/cari/lookups
     */
    static getLookups = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const lookups = await CariService.getLookups(dbContext);
        return ApiResponse.ok(res, "Cari lookup listeleri getirildi.", lookups);
    });
    /**
     * GET /api/v1/cari
     */
    static listCariKartlar = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const list = await CariService.listCariKartlar(dbContext);
        return ApiResponse.ok(res, "Cari kartlar başarıyla listelendi.", list);
    });
    /**
     * GET /api/v1/cari/:id
     */
    static getCariKartById = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const item = await CariService.getCariKartById(req.params.id, dbContext);
        return ApiResponse.ok(res, "Cari kart detayı getirildi.", item);
    });
    /**
     * POST /api/v1/cari
     */
    static createCariKart = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const created = await CariService.createCariKart(req.body, dbContext);
        return ApiResponse.created(res, "Cari kart başarıyla oluşturuldu.", created);
    });
    /**
     * PUT /api/v1/cari/:id
     */
    static updateCariKart = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const updated = await CariService.updateCariKart(req.params.id, req.body, dbContext);
        return ApiResponse.ok(res, "Cari kart başarıyla güncellendi.", updated);
    });
    /**
     * DELETE /api/v1/cari/:id
     */
    static deleteCariKart = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        await CariService.deleteCariKart(req.params.id, dbContext);
        return ApiResponse.ok(res, "Cari kart başarıyla silindi.", { id: req.params.id });
    });
}
