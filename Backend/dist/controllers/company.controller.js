import { CompanySqlRepository } from "../models/companySql.repository.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class CompanyController {
    /**
     * GET /api/v1/company/definitions
     */
    static getDefinitions = asyncHandler(async (req, res) => {
        const dbContext = {
            dbServer: req.user?.dbServer || req.query.dbServer,
            dbName: req.user?.dbName || req.query.dbName,
        };
        const definitions = await CompanySqlRepository.getDefinitions(dbContext);
        return ApiResponse.ok(res, "Firma tanımları başarıyla getirildi.", definitions);
    });
    /**
     * PUT /api/v1/company/definitions
     */
    static updateDefinitions = asyncHandler(async (req, res) => {
        const dbContext = {
            dbServer: req.user?.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.body.dbName,
        };
        const updated = await CompanySqlRepository.updateDefinitions(req.body, dbContext);
        return ApiResponse.ok(res, "Firma tanımları başarıyla güncellendi.", updated);
    });
}
