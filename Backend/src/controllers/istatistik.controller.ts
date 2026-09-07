import { Request, Response } from "express";
import { IstatistikService } from "../services/istatistik.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class IstatistikController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body.dbName as string),
    };
  }

  /**
   * GET /api/v1/istatistik
   */
  public static listIstatistikler = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = IstatistikController.getDbContext(req);
    const list = await IstatistikService.listIstatistikler(dbContext);
    return ApiResponse.ok(res, "İstatistik tanımları başarıyla listelendi.", list);
  });

  /**
   * GET /api/v1/istatistik/:id
   */
  public static getIstatistikById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = IstatistikController.getDbContext(req);
    const item = await IstatistikService.getIstatistikById(req.params.id, dbContext);
    return ApiResponse.ok(res, "İstatistik detayı getirildi.", item);
  });

  /**
   * POST /api/v1/istatistik
   */
  public static createIstatistik = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = IstatistikController.getDbContext(req);
    const created = await IstatistikService.createIstatistik(req.body, dbContext);
    return ApiResponse.created(res, "İstatistik tanımı başarıyla oluşturuldu.", created);
  });

  /**
   * PUT /api/v1/istatistik/:id
   */
  public static updateIstatistik = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = IstatistikController.getDbContext(req);
    const updated = await IstatistikService.updateIstatistik(req.params.id, req.body, dbContext);
    return ApiResponse.ok(res, "İstatistik tanımı başarıyla güncellendi.", updated);
  });

  /**
   * DELETE /api/v1/istatistik/:id
   */
  public static deleteIstatistik = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = IstatistikController.getDbContext(req);
    await IstatistikService.deleteIstatistik(req.params.id, dbContext);
    return ApiResponse.ok(res, "İstatistik tanımı başarıyla silindi.", { id: req.params.id });
  });
}
