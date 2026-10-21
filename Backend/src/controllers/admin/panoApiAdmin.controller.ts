import { Request, Response } from "express";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { firmaDbContextHazirla } from "../../services/admin/firmaBaglanti.service.js";
import { PanoEntegrasyonService } from "../../services/panoApi/panoEntegrasyon.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { adresKoku } from "../acikPano.controller.js";

/**
 * Yönetim paneli › Firma › Pano API sekmesi (docs/PANO_API_YOL_HARITASI.md, P2/P10). Firmanın panoları firma DB'sinden
 * okunur (POS sekmesindeki bağlantı deseni); anahtar işlemleri işlem günlüğüne yazılır.
 */

const hazirla = async (req: Request) => {
  const firmaId = Number(req.params.id);
  const ctx = await firmaDbContextHazirla(firmaId);
  const kim = `admin:${req.admin?.kullaniciAdi || ""}`.slice(0, 100);
  return { firmaId, ctx, kim, kok: adresKoku(req), panoId: Number(req.params.panoId) };
};

export class PanoApiAdminController {
  /** GET /admin/firmalar/:id/pano-anahtarlari */
  public static liste = asyncHandler(async (req: Request, res: Response) => {
    const { firmaId, ctx, kok } = await hazirla(req);
    return ApiResponse.ok(res, "Pano anahtarları.", await PanoEntegrasyonService.liste(firmaId, ctx, kok));
  });

  /** POST /admin/firmalar/:id/pano-anahtarlari/:panoId */
  public static uret = asyncHandler(async (req: Request, res: Response) => {
    const { firmaId, ctx, kim, kok, panoId } = await hazirla(req);
    const sonuc = await PanoEntegrasyonService.uret(firmaId, panoId, ctx, kim, kok);
    await AdminLogSqlRepository.islemLogu({ adminId: req.admin!.adminId, islem: "PANO_ANAHTAR_URETILDI", hedefTur: "FIRMA", hedefId: firmaId, yeni: { panoId } });
    return ApiResponse.ok(res, "Anahtar üretildi.", sonuc);
  });

  /** DELETE /admin/firmalar/:id/pano-anahtarlari/:panoId */
  public static iptal = asyncHandler(async (req: Request, res: Response) => {
    const { firmaId, ctx, kim, kok, panoId } = await hazirla(req);
    const sonuc = await PanoEntegrasyonService.iptal(firmaId, panoId, ctx, kim, kok);
    await AdminLogSqlRepository.islemLogu({ adminId: req.admin!.adminId, islem: "PANO_ANAHTAR_IPTAL", hedefTur: "FIRMA", hedefId: firmaId, yeni: { panoId } });
    return ApiResponse.ok(res, "Anahtar iptal edildi.", sonuc);
  });

  /** PUT /admin/firmalar/:id/pano-anahtarlari/:panoId/onbellek { sn } */
  public static onbellek = asyncHandler(async (req: Request, res: Response) => {
    const { firmaId, ctx, kim, kok, panoId } = await hazirla(req);
    const sonuc = await PanoEntegrasyonService.onbellekYaz(firmaId, panoId, ctx, req.body?.sn, kok);
    await AdminLogSqlRepository.islemLogu({ adminId: req.admin!.adminId, islem: "PANO_ONBELLEK_DEGISTI", hedefTur: "FIRMA", hedefId: firmaId, yeni: { panoId, sn: sonuc.onbellekSn, kim } });
    return ApiResponse.ok(res, "Önbellek süresi kaydedildi.", sonuc);
  });
}
