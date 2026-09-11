import { IstatistikService } from "../services/istatistik.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class IstatistikController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body.dbName,
        };
    }
    /**
     * GET /api/v1/istatistik
     */
    static listIstatistikler = asyncHandler(async (req, res) => {
        const dbContext = IstatistikController.getDbContext(req);
        const list = await IstatistikService.listIstatistikler(dbContext);
        return ApiResponse.ok(res, "İstatistik tanımları başarıyla listelendi.", list);
    });
    /**
     * GET /api/v1/istatistik/:id
     */
    static getIstatistikById = asyncHandler(async (req, res) => {
        const dbContext = IstatistikController.getDbContext(req);
        const item = await IstatistikService.getIstatistikById(req.params.id, dbContext);
        return ApiResponse.ok(res, "İstatistik detayı getirildi.", item);
    });
    /**
     * POST /api/v1/istatistik
     */
    static createIstatistik = asyncHandler(async (req, res) => {
        const dbContext = IstatistikController.getDbContext(req);
        const created = await IstatistikService.createIstatistik(req.body, dbContext);
        return ApiResponse.created(res, "İstatistik tanımı başarıyla oluşturuldu.", created);
    });
    /**
     * PUT /api/v1/istatistik/:id
     */
    static updateIstatistik = asyncHandler(async (req, res) => {
        const dbContext = IstatistikController.getDbContext(req);
        const updated = await IstatistikService.updateIstatistik(req.params.id, req.body, dbContext);
        return ApiResponse.ok(res, "İstatistik tanımı başarıyla güncellendi.", updated);
    });
    /**
     * DELETE /api/v1/istatistik/:id
     */
    static deleteIstatistik = asyncHandler(async (req, res) => {
        const dbContext = IstatistikController.getDbContext(req);
        await IstatistikService.deleteIstatistik(req.params.id, dbContext);
        return ApiResponse.ok(res, "İstatistik tanımı başarıyla silindi.", { id: req.params.id });
    });
}
