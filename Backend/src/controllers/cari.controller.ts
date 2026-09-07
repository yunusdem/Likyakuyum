import { Request, Response } from "express";
import { CariService } from "../services/cari.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class CariController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body.dbName as string),
    };
  }

  /**
   * GET /api/v1/cari/lookups
   */
  public static getLookups = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const lookups = await CariService.getLookups(dbContext);
    return ApiResponse.ok(res, "Cari lookup listeleri getirildi.", lookups);
  });

  /**
   * GET /api/v1/cari
   */
  public static listCariKartlar = asyncHandler(async (req: Request, res: Response) => {

    const dbContext = CariController.getDbContext(req);
    const list = await CariService.listCariKartlar(dbContext);
    return ApiResponse.ok(res, "Cari kartlar başarıyla listelendi.", list);
  });

  /**
   * GET /api/v1/cari/:id
   */
  public static getCariKartById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const item = await CariService.getCariKartById(req.params.id, dbContext);
    return ApiResponse.ok(res, "Cari kart detayı getirildi.", item);
  });

  /**
   * POST /api/v1/cari
   */
  public static createCariKart = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const created = await CariService.createCariKart(req.body, dbContext);
    return ApiResponse.created(res, "Cari kart başarıyla oluşturuldu.", created);
  });

  /**
   * PUT /api/v1/cari/:id
   */
  public static updateCariKart = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const updated = await CariService.updateCariKart(req.params.id, req.body, dbContext);
    return ApiResponse.ok(res, "Cari kart başarıyla güncellendi.", updated);
  });

  /**
   * DELETE /api/v1/cari/:id
   */
  public static deleteCariKart = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    await CariService.deleteCariKart(req.params.id, dbContext);
    return ApiResponse.ok(res, "Cari kart başarıyla silindi.", { id: req.params.id });
  });
}
