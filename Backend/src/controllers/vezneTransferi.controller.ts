import { Request, Response } from "express";
import { VezneTransferiService } from "../services/vezneTransferi.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

export class VezneTransferiController {
  private static getDbContext(req: Request) {
    return {
      dbServer:
        req.user?.dbServer ||
        (req.headers["x-db-server"] as string) ||
        (req.query.dbServer as string) ||
        (req.body?.dbServer as string),
      dbName:
        req.user?.dbName ||
        (req.headers["x-db-name"] as string) ||
        (req.query.dbName as string) ||
        (req.body?.dbName as string),
    };
  }

  /**
   * GET /api/v1/vezne-transferi
   */
  public static getTransfers = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const filters = {
      search: req.query.search as string,
      alanVezneId: req.query.alanVezneId ? Number(req.query.alanVezneId) : undefined,
      verenVezneId: req.query.verenVezneId ? Number(req.query.verenVezneId) : undefined,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      limit: req.query.limit ? Number(req.query.limit) : 200,
    };
    const list = await VezneTransferiService.getTransfers(filters, dbContext);
    return ApiResponse.ok(res, "Vezne transferleri listelendi.", list);
  });

  /**
   * GET /api/v1/vezne-transferi/navigation
   */
  public static getNavigation = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const currentId = req.query.currentId ? Number(req.query.currentId) : null;
    const nav = await VezneTransferiService.getNavigation(currentId, dbContext);
    return ApiResponse.ok(res, "Gezinme bilgisi getirildi.", nav);
  });

  /**
   * GET /api/v1/vezne-transferi/next-ref
   */
  public static getNextRefNo = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const ref = await VezneTransferiService.getNextRefNo(dbContext);
    return ApiResponse.ok(res, "Sonraki referans numarası üretildi.", { refNo: ref });
  });

  /**
   * GET /api/v1/vezne-transferi/bakiye/:vezneId
   */
  public static getVezneBakiyeler = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const vezneId = Number(req.params.vezneId) || 0;
    const bakiyeler = await VezneTransferiService.getVezneBakiyeler(vezneId, dbContext);
    return ApiResponse.ok(res, "Vezne bakiye listesi getirildi.", bakiyeler);
  });

  /**
   * GET /api/v1/vezne-transferi/:id
   */
  public static getTransferById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const id = Number(req.params.id);
    const item = await VezneTransferiService.getTransferById(id, dbContext);
    if (!item) {
      throw ApiError.notFound("Vezne transfer kaydı bulunamadı.");
    }
    return ApiResponse.ok(res, "Vezne transfer detayları getirildi.", item);
  });

  /**
   * POST /api/v1/vezne-transferi
   */
  public static saveTransfer = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const u = req.user as any;
    const kullaniciId = u?.userId || u?.id || req.body.kullaniciId || 1;

    const payload = {
      ...req.body,
      kullaniciId,
    };
    const saved = await VezneTransferiService.saveTransfer(payload, dbContext);
    return ApiResponse.ok(res, "Vezne transferi başarıyla kaydedildi.", saved);
  });

  /**
   * DELETE /api/v1/vezne-transferi/:id
   */
  public static deleteTransfer = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const id = Number(req.params.id);
    const u = req.user as any;
    const kullaniciId = u?.userId || u?.id || 1;
    const degisiklikTakipVar = req.body?.degisiklikTakipVar || false;

    await VezneTransferiService.deleteTransfer(id, kullaniciId, degisiklikTakipVar, dbContext);
    return ApiResponse.ok(res, "Vezne transferi başarıyla silindi.", { id });
  });
}
