import { Request, Response } from "express";
import { CariDekontService } from "../services/cariDekont.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class CariDekontController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.headers["x-db-server"] as string) || (req.query.dbServer as string) || (req.body?.dbServer as string),
      dbName: req.user?.dbName || (req.headers["x-db-name"] as string) || (req.query.dbName as string) || (req.body?.dbName as string),
    };
  }

  /**
   * GET /api/v1/cari-dekont
   * List dekonts with optional search, tip, vezneId filter
   */
  public static getDekontList = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariDekontController.getDbContext(req);
    const filter = {
      search: req.query.search as string,
      tip: req.query.tip !== undefined ? Number(req.query.tip) : undefined,
      vezneId: req.query.vezneId ? Number(req.query.vezneId) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    };
    const list = await CariDekontService.getDekontList(filter, dbContext);
    return ApiResponse.ok(res, "Cari dekontlar listelendi.", list);
  });

  /**
   * GET /api/v1/cari-dekont/:id
   * Fetch single dekont with items
   */
  public static getDekontById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariDekontController.getDbContext(req);
    const id = Number(req.params.id);
    const dekont = await CariDekontService.getDekontById(id, dbContext);
    return ApiResponse.ok(res, "Cari dekont detayları getirildi.", dekont);
  });

  /**
   * POST /api/v1/cari-dekont/kaydet
   * Calls Stored Procedure SODVZ_CARI_DEKONT_KAYDET
   */
  public static saveDekont = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariDekontController.getDbContext(req);
    const u = req.user as any;
    const kullaniciId = u?.userId || u?.id || req.body.kullaniciId || 1;
    const payload = {
      ...req.body,
      kullaniciId,
    };
    const saved = await CariDekontService.saveDekont(payload, dbContext);
    return ApiResponse.ok(res, "Cari dekont başarıyla kaydedildi.", saved);
  });

  /**
   * DELETE /api/v1/cari-dekont/:id
   * Calls Stored Procedure SODVZ_CARI_DEKONT_SIL
   */
  public static deleteDekont = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariDekontController.getDbContext(req);
    const id = Number(req.params.id);
    const u = req.user as any;
    const kullaniciId = u?.userId || u?.id || req.body?.kullaniciId || 1;
    const degisiklikTakipVar = req.body?.degisiklikTakipVar !== false;
    await CariDekontService.deleteDekont(id, kullaniciId, degisiklikTakipVar, dbContext);
    return ApiResponse.ok(res, "Cari dekont başarıyla silindi.", { cariDekontId: id });
  });
}
