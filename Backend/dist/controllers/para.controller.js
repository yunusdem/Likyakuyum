import { ParaService } from "../services/para.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class ParaController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body.dbName,
        };
    }
    /**
     * GET /api/v1/para
     */
    static listParalar = asyncHandler(async (req, res) => {
        const dbContext = ParaController.getDbContext(req);
        const paralar = await ParaService.listParalar(dbContext);
        return ApiResponse.ok(res, "Ürünler / Para birimleri başarıyla listelendi.", paralar);
    });
    /**
     * GET /api/v1/para/:id
     */
    static getParaById = asyncHandler(async (req, res) => {
        const dbContext = ParaController.getDbContext(req);
        const para = await ParaService.getParaById(req.params.id, dbContext);
        return ApiResponse.ok(res, "Ürün detayları getirildi.", para);
    });
    /**
     * POST /api/v1/para
     */
    static createPara = asyncHandler(async (req, res) => {
        const dbContext = ParaController.getDbContext(req);
        const created = await ParaService.createPara(req.body, dbContext);
        return ApiResponse.created(res, "Ürün / Para birimi başarıyla oluşturuldu.", created);
    });
    /**
     * PUT /api/v1/para/:id
     */
    static updatePara = asyncHandler(async (req, res) => {
        const dbContext = ParaController.getDbContext(req);
        const updated = await ParaService.updatePara(req.params.id, req.body, dbContext);
        return ApiResponse.ok(res, "Ürün bilgileri başarıyla güncellendi.", updated);
    });
    /**
     * DELETE /api/v1/para/:id
     */
    static deletePara = asyncHandler(async (req, res) => {
        const dbContext = ParaController.getDbContext(req);
        await ParaService.deletePara(req.params.id, dbContext);
        return ApiResponse.ok(res, "Ürün / Para birimi başarıyla silindi.", { id: req.params.id });
    });
}
