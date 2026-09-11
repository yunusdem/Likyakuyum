import { VezneService } from "../services/vezne.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class VezneController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body.dbName,
        };
    }
    /**
     * GET /api/v1/vezne
     */
    static listVezneler = asyncHandler(async (req, res) => {
        const dbContext = VezneController.getDbContext(req);
        const vezneler = await VezneService.listVezneler(dbContext);
        return ApiResponse.ok(res, "Vezneler başarıyla listelendi.", vezneler);
    });
    /**
     * GET /api/v1/vezne/printers
     */
    static getPrinters = asyncHandler(async (req, res) => {
        const dbContext = VezneController.getDbContext(req);
        const printers = await VezneService.getPrinters(dbContext);
        return ApiResponse.ok(res, "Yazıcı listesi başarıyla getirildi.", printers);
    });
    /**
     * GET /api/v1/vezne/currencies
     */
    static getCurrencies = asyncHandler(async (req, res) => {
        const dbContext = VezneController.getDbContext(req);
        const currencies = await VezneService.getCurrencies(dbContext);
        return ApiResponse.ok(res, "Para birimi listesi başarıyla getirildi.", currencies);
    });
    /**
     * GET /api/v1/vezne/:id
     */
    static getVezneById = asyncHandler(async (req, res) => {
        const dbContext = VezneController.getDbContext(req);
        const vezne = await VezneService.getVezneById(req.params.id, dbContext);
        return ApiResponse.ok(res, "Vezne detayları getirildi.", vezne);
    });
    /**
     * POST /api/v1/vezne
     */
    static createVezne = asyncHandler(async (req, res) => {
        const dbContext = VezneController.getDbContext(req);
        const created = await VezneService.createVezne(req.body, dbContext);
        return ApiResponse.created(res, "Vezne başarıyla tanımlandı.", created);
    });
    /**
     * PUT /api/v1/vezne/:id
     */
    static updateVezne = asyncHandler(async (req, res) => {
        const dbContext = VezneController.getDbContext(req);
        const updated = await VezneService.updateVezne(req.params.id, req.body, dbContext);
        return ApiResponse.ok(res, "Vezne bilgileri başarıyla güncellendi.", updated);
    });
    /**
     * DELETE /api/v1/vezne/:id
     */
    static deleteVezne = asyncHandler(async (req, res) => {
        const dbContext = VezneController.getDbContext(req);
        await VezneService.deleteVezne(req.params.id, dbContext);
        return ApiResponse.ok(res, "Vezne başarıyla silindi.", { id: req.params.id });
    });
}
