import { AdminYonetimService } from "../../services/admin/adminYonetim.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export class AdminYonetimController {
    static listele = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Adminler getirildi.", await AdminYonetimService.listele());
    });
    static ekle = asyncHandler(async (req, res) => {
        const sonuc = await AdminYonetimService.ekle(req.admin, req.body);
        return ApiResponse.created(res, "Admin oluşturuldu.", sonuc);
    });
    static guncelle = asyncHandler(async (req, res) => {
        const admin = await AdminYonetimService.guncelle(req.admin, Number(req.params.id), req.body);
        return ApiResponse.ok(res, "Admin güncellendi.", admin);
    });
    static sifreSifirla = asyncHandler(async (req, res) => {
        const sonuc = await AdminYonetimService.sifreSifirla(req.admin, Number(req.params.id));
        return ApiResponse.ok(res, "Şifre sıfırlandı.", sonuc);
    });
}
