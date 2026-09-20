import { Request, Response } from "express";
import { AdminYonetimService } from "../../services/admin/adminYonetim.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export class AdminYonetimController {
  public static listele = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Adminler getirildi.", await AdminYonetimService.listele());
  });

  public static ekle = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await AdminYonetimService.ekle(req.admin!, req.body);
    return ApiResponse.created(res, "Admin oluşturuldu.", sonuc);
  });

  public static guncelle = asyncHandler(async (req: Request, res: Response) => {
    const admin = await AdminYonetimService.guncelle(req.admin!, Number(req.params.id), req.body);
    return ApiResponse.ok(res, "Admin güncellendi.", admin);
  });

  public static sifreSifirla = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await AdminYonetimService.sifreSifirla(req.admin!, Number(req.params.id));
    return ApiResponse.ok(res, "Şifre sıfırlandı.", sonuc);
  });
}
