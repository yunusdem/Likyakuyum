import { Request, Response } from "express";
import { IzlemeService } from "../../services/admin/izleme.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export class IzlemeController {
  public static cevrimici = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Çevrimiçi oturumlar getirildi.", await IzlemeService.cevrimici());
  });

  public static girisLoglari = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Giriş geçmişi getirildi.", await IzlemeService.girisLoglari(req.query as any));
  });

  public static islemLoglari = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "İşlem kaydı getirildi.", await IzlemeService.islemLoglari(req.query as any));
  });

  public static oturumuKapat = asyncHandler(async (req: Request, res: Response) => {
    await IzlemeService.oturumuKapat(req.admin!, req.params.sid);
    return ApiResponse.ok(res, "Oturum kapatıldı.");
  });

  public static firmaOturumlariniKapat = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await IzlemeService.firmaOturumlariniKapat(req.admin!, Number(req.params.id));
    return ApiResponse.ok(res, `${sonuc.kapanan} oturum kapatıldı.`, sonuc);
  });
}
