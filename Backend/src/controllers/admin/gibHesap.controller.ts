import { Request, Response } from "express";
import { GibHesapService } from "../../services/admin/gibHesap.service.js";
import { VknSorguService } from "../../services/gib/vknSorgu.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export class GibHesapController {
  public static durum = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "GİB hesabı getirildi.", await GibHesapService.durum());
  });

  public static kaydet = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "GİB hesabı kaydedildi.", await GibHesapService.kaydet(req.admin!, req.body.kullaniciKodu, req.body.sifre));
  });

  public static sil = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "GİB hesabı silindi.", await GibHesapService.sil(req.admin!));
  });

  public static dene = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "GİB portalına giriş başarılı.", await GibHesapService.dene());
  });

  public static vknSorgu = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await VknSorguService.sorgula(String(req.query.no ?? ""), {
      firmaId: null,
      dbAdi: null,
      kullanici: `admin:${req.admin!.kullaniciAdi}`,
    });
    return ApiResponse.ok(res, sonuc.sonuc === "BULUNDU" ? "GİB kaydı bulundu." : "Bu numara GİB'de kayıtlı değil.", sonuc);
  });
}
