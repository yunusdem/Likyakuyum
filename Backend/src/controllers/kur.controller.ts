import { Request, Response } from "express";
import { KurService } from "../services/kur.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class KurController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body.dbName as string),
    };
  }

  /**
   * GET /api/v1/kur/tablo
   * Query params: tur (0,1,2,3), tarih (YYYY-MM-DD), id
   */
  public static getTablo = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KurController.getDbContext(req);
    const tur = req.query.tur !== undefined ? Number(req.query.tur) : 0;
    const tarih = req.query.tarih as string | undefined;
    const id = req.query.id ? Number(req.query.id) : undefined;

    const tablo = await KurService.getTablo({ tur, tarih, id }, dbContext);
    return ApiResponse.ok(res, "Kur tablosu başarıyla getirildi.", tablo);
  });

  /**
   * POST /api/v1/kur/kaydet
   * Body: { id?: number, tur: number, zaman?: string, kaynakKurTablosuId?: number, satirlar: [...] }
   */
  public static saveTablo = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KurController.getDbContext(req);
    const saved = await KurService.saveTablo(req.body, dbContext);
    return ApiResponse.ok(res, "Kur tablosu başarıyla kaydedildi.", saved);
  });

  /**
   * POST /api/v1/kur/sakla
   * Body: { kaynakKurTablosuId: number, targetTur?: number, zaman?: string }
   */
  public static sakla = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KurController.getDbContext(req);
    const result = await KurService.sakla(req.body, dbContext);
    return ApiResponse.ok(res, "Kur tablosu saklanan listeye başarıyla aktarıldı.", result);
  });

  /**
   * GET /api/v1/kur/tarihler
   * Query params: tur (default 2)
   */
  public static getStoredDates = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KurController.getDbContext(req);
    const tur = req.query.tur !== undefined ? Number(req.query.tur) : 2;
    const dates = await KurService.getStoredDates(tur, dbContext);
    return ApiResponse.ok(res, "Saklanan kur tarihleri listelendi.", dates);
  });

  /**
   * DELETE /api/v1/kur/tablo/:id
   */
  public static deleteTablo = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KurController.getDbContext(req);
    const id = Number(req.params.id);
    await KurService.deleteTablo(id, dbContext);
    return ApiResponse.ok(res, "Kur tablosu silindi.", { id });
  });

  /**
   * GET /api/v1/kur/tcmb
   */
  public static fetchTcmb = asyncHandler(async (_req: Request, res: Response) => {
    const rates = await KurService.fetchTcmbRates();
    return ApiResponse.ok(res, "TCMB kurları başarıyla alındı.", rates);
  });
}
