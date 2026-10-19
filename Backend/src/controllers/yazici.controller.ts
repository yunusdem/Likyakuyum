import { Request, Response } from "express";
import { YaziciService } from "../services/yazici.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class YaziciController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body.dbName as string),
    };
  }

  /**
   * GET /api/v1/yazici/system-printers
   * Bilgisayarda kurulu aktif yazıcıları listeler (Denetim Masası / Aygıtlar ve Yazıcılar)
   */
  public static getSystemPrinters = asyncHandler(async (_req: Request, res: Response) => {
    const list = await YaziciService.getSystemPrinters();
    return ApiResponse.ok(res, "Sistem yazıcıları başarıyla listelendi.", list);
  });

  /**
   * GET /api/v1/yazici
   */
  public static listYazicilar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const yazicilar = await YaziciService.listYazicilar(dbContext);
    return ApiResponse.ok(res, "Yazıcılar başarıyla listelendi.", yazicilar);
  });

  /**
   * GET /api/v1/yazici/:id
   */
  public static getYaziciById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const yazici = await YaziciService.getYaziciById(req.params.id, dbContext);
    return ApiResponse.ok(res, "Yazıcı detayları getirildi.", yazici);
  });

  /**
   * POST /api/v1/yazici
   */
  public static createYazici = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const created = await YaziciService.createYazici(req.body, dbContext);
    return ApiResponse.created(res, "Yazıcı tanımı başarıyla oluşturuldu.", created);
  });

  /**
   * PUT /api/v1/yazici/:id
   */
  public static updateYazici = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const updated = await YaziciService.updateYazici(req.params.id, req.body, dbContext);
    return ApiResponse.ok(res, "Yazıcı bilgileri başarıyla güncellendi.", updated);
  });

  /**
   * GET /api/v1/yazici/usage/:id
   */
  public static getYaziciUsage = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const usage = await YaziciService.getYaziciUsage(req.params.id, dbContext);
    return ApiResponse.ok(res, "Yazıcı kullanım durumu getirildi.", usage);
  });

  /**
   * DELETE /api/v1/yazici/:id
   */
  public static deleteYazici = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const isForce = req.query.force === "true";
    await YaziciService.deleteYazici(req.params.id, { force: isForce }, dbContext);
    return ApiResponse.ok(res, "Yazıcı tanımı başarıyla silindi.", { id: req.params.id });
  });

  /**
   * POST /api/v1/yazici/direct-print
   */
  public static directPrint = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const result = await YaziciService.directPrint(req.body, dbContext);
    return ApiResponse.ok(res, result.message, result);
  });
}
