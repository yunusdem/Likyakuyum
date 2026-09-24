import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PosCihaziService } from "../services/posCihazi.service.js";
import { ApiError } from "../utils/ApiError.js";

export class PosCihaziController {
  private static getDbContext(req: Request) {
    const dbServer = req.headers["x-db-server"] as string | undefined;
    const dbName = req.headers["x-db-name"] as string | undefined;
    return { dbServer, dbName };
  }

  public static getPosCihazlari = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = PosCihaziController.getDbContext(req);
    const list = await PosCihaziService.getPosCihazlari(dbContext);
    res.json({
      success: true,
      data: list,
      count: list.length,
    });
  });

  public static getPosCihaziById = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) throw ApiError.badRequest("Geçersiz POS Cihazı ID");
    const dbContext = PosCihaziController.getDbContext(req);
    const item = await PosCihaziService.getPosCihaziById(id, dbContext);
    if (!item) throw ApiError.notFound("POS Cihazı bulunamadı");
    res.json({
      success: true,
      data: item,
    });
  });

  public static getPosCihaziBakiye = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) throw ApiError.badRequest("Geçersiz POS Cihazı ID");
    const dbContext = PosCihaziController.getDbContext(req);
    const bakiye = await PosCihaziService.getPosCihaziBakiye(id, dbContext);
    res.json({
      success: true,
      data: { posCihaziId: id, bakiye },
    });
  });

  public static getNextPosKod = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = PosCihaziController.getDbContext(req);
    const kod = await PosCihaziService.getNextPosKod(dbContext);
    res.json({
      success: true,
      data: { kod },
    });
  });

  public static savePosCihazi = asyncHandler(async (req: Request, res: Response) => {
    const { ad } = req.body;
    if (!ad || !String(ad).trim()) throw ApiError.badRequest("POS Cihaz Adı zorunludur.");

    const dbContext = PosCihaziController.getDbContext(req);
    const saved = await PosCihaziService.savePosCihazi(req.body, dbContext);
    res.status(200).json({
      success: true,
      message: "POS Cihazı başarıyla kaydedildi.",
      data: saved,
    });
  });

  public static deletePosCihazi = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) throw ApiError.badRequest("Geçersiz POS Cihazı ID");
    const dbContext = PosCihaziController.getDbContext(req);
    const ok = await PosCihaziService.deletePosCihazi(id, dbContext);
    if (!ok) throw ApiError.notFound("POS Cihazı silinemedi veya kayıt bulunamadı.");
    res.json({
      success: true,
      message: "POS Cihazı başarıyla silindi.",
    });
  });
}
