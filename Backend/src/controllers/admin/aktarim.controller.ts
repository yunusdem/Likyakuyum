import { Request, Response } from "express";
import { AktarimService } from "../../services/aktarim/aktarim.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Eski programdan veri aktarımı — admin uçları (docs/VERITABANI_TASIMA_YOL_HARITASI.md). */
const firmaId = (req: Request): number => Number(req.params.id);
const yuklemeId = (req: Request): string => String(req.params.yuklemeId || "");

export class AktarimController {
  public static yuklemeler = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Yüklemeler getirildi.", await AktarimService.yuklemeler(firmaId(req)));
  });

  public static yuklemeBaslat = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.created(res, "Yükleme başlatıldı.", await AktarimService.yuklemeBaslat(firmaId(req), req.body));
  });

  public static parca = asyncHandler(async (req: Request, res: Response) => {
    if (!Buffer.isBuffer(req.body)) throw ApiError.badRequest("Parça ikili veri (application/octet-stream) olarak gönderilmeli.");
    const sha = req.get("X-Parca-Sha256") || null;
    return ApiResponse.ok(res, "Parça alındı.", await AktarimService.parca(firmaId(req), yuklemeId(req), Number(req.params.sira), req.body, sha));
  });

  public static yuklemeBitir = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Yükleme tamamlandı.", await AktarimService.yuklemeBitir(req.admin!, firmaId(req), yuklemeId(req)));
  });

  public static yuklemeSil = asyncHandler(async (req: Request, res: Response) => {
    await AktarimService.yuklemeSil(firmaId(req), yuklemeId(req));
    return ApiResponse.ok(res, "Yükleme silindi.", null);
  });

  public static incele = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "İnceleme başlatıldı.", await AktarimService.inceleBaslat(firmaId(req), yuklemeId(req)));
  });

  public static aktar = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Aktarım başlatıldı.", await AktarimService.aktarBaslat(req.admin!, firmaId(req), yuklemeId(req), req.body));
  });

  public static dogrula = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Doğrulama başlatıldı.", await AktarimService.dogrulaBaslat(req.admin!, firmaId(req), yuklemeId(req)));
  });

  public static isDurumu = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "İş durumu.", AktarimService.isDurumu(firmaId(req), String(req.params.isId || "")));
  });

  public static rapor = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Rapor getirildi.", await AktarimService.raporlar(firmaId(req), yuklemeId(req)));
  });
}
