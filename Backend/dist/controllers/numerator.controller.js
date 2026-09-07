import { NumeratorService } from "../services/numerator.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class NumeratorController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body.dbName,
        };
    }
    /**
     * GET /api/v1/numerator
     */
    static listNumerators = asyncHandler(async (req, res) => {
        const dbContext = NumeratorController.getDbContext(req);
        const list = await NumeratorService.listNumerators(dbContext);
        return ApiResponse.ok(res, "Numaratör tanımları başarıyla listelendi.", list);
    });
    /**
     * GET /api/v1/numerator/:id
     */
    static getNumeratorById = asyncHandler(async (req, res) => {
        const dbContext = NumeratorController.getDbContext(req);
        const item = await NumeratorService.getNumeratorById(req.params.id, dbContext);
        return ApiResponse.ok(res, "Numaratör detayı getirildi.", item);
    });
    /**
     * POST /api/v1/numerator
     */
    static createNumerator = asyncHandler(async (req, res) => {
        const dbContext = NumeratorController.getDbContext(req);
        const created = await NumeratorService.createNumerator(req.body, dbContext);
        return ApiResponse.created(res, "Numaratör tanımı başarıyla oluşturuldu.", created);
    });
    /**
     * POST /api/v1/numerator/save (or /api/v1/numerators/save)
     * Direct upsert using SODVZ_NUMERATOR_KAYDET stored procedure
     */
    static saveNumerator = asyncHandler(async (req, res) => {
        const dbContext = NumeratorController.getDbContext(req);
        const saved = await NumeratorService.saveNumerator(req.body, dbContext);
        return ApiResponse.ok(res, "Numaratör başarıyla kaydedildi.", saved);
    });
    /**
     * PUT /api/v1/numerator/:id
     */
    static updateNumerator = asyncHandler(async (req, res) => {
        const dbContext = NumeratorController.getDbContext(req);
        const updated = await NumeratorService.updateNumerator(req.params.id, req.body, dbContext);
        return ApiResponse.ok(res, "Numaratör tanımı başarıyla güncellendi.", updated);
    });
    /**
     * DELETE /api/v1/numerator/:id
     */
    static deleteNumerator = asyncHandler(async (req, res) => {
        const dbContext = NumeratorController.getDbContext(req);
        await NumeratorService.deleteNumerator(req.params.id, dbContext);
        return ApiResponse.ok(res, "Numaratör tanımı başarıyla silindi.", { id: req.params.id });
    });
}
