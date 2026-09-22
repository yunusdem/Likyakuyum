import { AdminAuthService } from "../../services/admin/adminAuth.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { istemciIp, istemciTarayici } from "../../utils/istemci.utils.js";
export class AdminAuthController {
    static giris = asyncHandler(async (req, res) => {
        const sonuc = await AdminAuthService.giris(req.body, { ip: istemciIp(req), tarayici: istemciTarayici(req) });
        return ApiResponse.ok(res, "Giriş başarılı.", sonuc);
    });
    static cikis = asyncHandler(async (req, res) => {
        await AdminAuthService.cikis(req.admin.sid);
        return ApiResponse.ok(res, "Çıkış yapıldı.");
    });
    static ben = asyncHandler(async (req, res) => {
        const admin = await AdminAuthService.profil(req.admin.adminId);
        return ApiResponse.ok(res, "Admin bilgisi getirildi.", admin);
    });
    static sifreDegistir = asyncHandler(async (req, res) => {
        await AdminAuthService.sifreDegistir(req.admin, req.body);
        return ApiResponse.ok(res, "Şifreniz değiştirildi.");
    });
}
