import { Request, Response } from "express";
import { MobilAdminService } from "../../services/mobil/mobilAdmin.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Yönetim paneli › Firma › Mobil sekmesi (docs/MOBIL_CARI_YOL_HARITASI.md). */
export class MobilAdminController {
  /** GET /admin/firmalar/:id/mobil */
  public static ozet = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Mobil ayarı.", await MobilAdminService.ozet(Number(req.params.id)))
  );

  /** GET /admin/firmalar/:id/mobil/kullanim — kullanıcılar + giriş geçmişi */
  public static kullanim = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Mobil kullanım.", await MobilAdminService.kullanim(Number(req.params.id), req.query.adet ? Number(req.query.adet) : undefined))
  );

  /** PUT /admin/firmalar/:id/mobil { kullaniciLimiti, kisaAd } */
  public static yaz = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Mobil ayarı kaydedildi.", await MobilAdminService.yaz(req.admin!, Number(req.params.id), req.body))
  );
}
