import { PanoService } from "../services/pano.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class PanoController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body.dbName,
        };
    }
    /**
     * GET /api/v1/pano
     */
    static getAllPanos = asyncHandler(async (req, res) => {
        const dbContext = PanoController.getDbContext(req);
        const panos = await PanoService.getAllPanos(dbContext);
        return ApiResponse.ok(res, "Pano tanımları listelendi.", panos);
    });
    /**
     * GET /api/v1/pano/:id
     */
    static getPanoById = asyncHandler(async (req, res) => {
        const dbContext = PanoController.getDbContext(req);
        const id = Number(req.params.id);
        const pano = await PanoService.getPanoById(id, dbContext);
        return ApiResponse.ok(res, "Pano tanımı detayları getirildi.", pano);
    });
    /**
     * POST /api/v1/pano/kaydet
     * Calls procedure SODVZ_PANO_TANIMI_KAYDET
     */
    static savePano = asyncHandler(async (req, res) => {
        const dbContext = PanoController.getDbContext(req);
        const saved = await PanoService.savePano(req.body, dbContext);
        return ApiResponse.ok(res, "Pano tanımı başarıyla kaydedildi.", saved);
    });
    /**
     * DELETE /api/v1/pano/:id
     * Calls procedure SODVZ_PANO_TANIMI_SIL
     */
    static deletePano = asyncHandler(async (req, res) => {
        const dbContext = PanoController.getDbContext(req);
        const id = Number(req.params.id);
        await PanoService.deletePano(id, dbContext);
        return ApiResponse.ok(res, "Pano tanımı başarıyla silindi.", { panoId: id });
    });
    /**
     * GET /api/v1/pano/live/:id?
     */
    static getLiveBoardData = asyncHandler(async (req, res) => {
        const dbContext = PanoController.getDbContext(req);
        const id = req.params.id ? Number(req.params.id) : 0;
        const data = await PanoService.getLiveBoardData(id, dbContext);
        return ApiResponse.ok(res, "Canlı pano verisi getirildi.", data);
    });
}
