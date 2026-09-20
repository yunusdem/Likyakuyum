import { Request, Response } from "express";
import { AdminAuthService } from "../../services/admin/adminAuth.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { istemciIp, istemciTarayici } from "../../utils/istemci.utils.js";

export class AdminAuthController {
  public static giris = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await AdminAuthService.giris(req.body, { ip: istemciIp(req), tarayici: istemciTarayici(req) });
    return ApiResponse.ok(res, "Giriş başarılı.", sonuc);
  });

  public static cikis = asyncHandler(async (req: Request, res: Response) => {
    await AdminAuthService.cikis(req.admin!.sid);
    return ApiResponse.ok(res, "Çıkış yapıldı.");
  });

  public static ben = asyncHandler(async (req: Request, res: Response) => {
    const admin = await AdminAuthService.profil(req.admin!.adminId);
    return ApiResponse.ok(res, "Admin bilgisi getirildi.", admin);
  });

  public static sifreDegistir = asyncHandler(async (req: Request, res: Response) => {
    await AdminAuthService.sifreDegistir(req.admin!, req.body);
    return ApiResponse.ok(res, "Şifreniz değiştirildi.");
  });
}
