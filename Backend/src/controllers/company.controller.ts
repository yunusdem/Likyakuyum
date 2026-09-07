import { Request, Response } from "express";
import { CompanySqlRepository } from "../models/companySql.repository.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class CompanyController {
  /**
   * GET /api/v1/company/definitions
   */
  public static getDefinitions = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = {
      dbServer: req.user?.dbServer || (req.query.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string),
    };

    const definitions = await CompanySqlRepository.getDefinitions(dbContext);

    return ApiResponse.ok(res, "Firma tanımları başarıyla getirildi.", definitions);
  });

  /**
   * PUT /api/v1/company/definitions
   */
  public static updateDefinitions = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = {
      dbServer: req.user?.dbServer || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.body.dbName as string),
    };

    const updated = await CompanySqlRepository.updateDefinitions(req.body, dbContext);

    return ApiResponse.ok(res, "Firma tanımları başarıyla güncellendi.", updated);
  });
}
