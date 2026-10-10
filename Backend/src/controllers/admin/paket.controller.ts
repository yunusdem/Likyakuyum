import { Request, Response } from "express";
import { PaketService } from "../../services/admin/paket.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Lisans ürün paketleri (docs/LISANS_URUN_PAKETLERI.md) */
export class PaketController {
  public static liste = asyncHandler(async (_req: Request, res: Response) => {
    return ApiResponse.ok(res, "Paketler getirildi.", await PaketService.liste());
  });

  public static ilkIcerik = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Paket ilk içeriği hazırlandı.", await PaketService.ilkIcerik(req.admin!, req.body.icerik));
  });

  public static yaz = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Paket kaydedildi.", await PaketService.paketYaz(req.admin!, String(req.params.kod), req.body));
  });

  public static firmaUrunleri = asyncHandler(async (_req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firma ürünleri getirildi.", await PaketService.firmaUrunHaritasi());
  });

  public static onizleme = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Önizleme hazır.", await PaketService.onizleme(Number(req.params.id), req.body.urunler));
  });
}
