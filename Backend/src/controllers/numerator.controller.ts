import { Request, Response } from "express";
import { NumeratorService } from "../services/numerator.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class NumeratorController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body.dbName as string),
    };
  }

  /**
   * GET /api/v1/numerator
   */
  public static listNumerators = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = NumeratorController.getDbContext(req);
    const list = await NumeratorService.listNumerators(dbContext);
    return ApiResponse.ok(res, "Numaratör tanımları başarıyla listelendi.", list);
  });

  /**
   * GET /api/v1/numerator/:id
   */
  public static getNumeratorById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = NumeratorController.getDbContext(req);
    const item = await NumeratorService.getNumeratorById(req.params.id, dbContext);
    return ApiResponse.ok(res, "Numaratör detayı getirildi.", item);
  });

  /**
   * POST /api/v1/numerator
   */
  public static createNumerator = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = NumeratorController.getDbContext(req);
    const created = await NumeratorService.createNumerator(req.body, dbContext);
    return ApiResponse.created(res, "Numaratör tanımı başarıyla oluşturuldu.", created);
  });

  /**
   * POST /api/v1/numerator/save (or /api/v1/numerators/save)
   * Direct upsert using SODVZ_NUMERATOR_KAYDET stored procedure
   */
  public static saveNumerator = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = NumeratorController.getDbContext(req);
    const saved = await NumeratorService.saveNumerator(req.body, dbContext);
    return ApiResponse.ok(res, "Numaratör başarıyla kaydedildi.", saved);
  });

  /**
   * PUT /api/v1/numerator/:id
   */
  public static updateNumerator = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = NumeratorController.getDbContext(req);
    const updated = await NumeratorService.updateNumerator(req.params.id, req.body, dbContext);
    return ApiResponse.ok(res, "Numaratör tanımı başarıyla güncellendi.", updated);
  });

  /**
   * DELETE /api/v1/numerator/:id
   */
  public static deleteNumerator = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = NumeratorController.getDbContext(req);
    await NumeratorService.deleteNumerator(req.params.id, dbContext);
    return ApiResponse.ok(res, "Numaratör tanımı başarıyla silindi.", { id: req.params.id });
  });
}
