import { IzlemeService } from "../../services/admin/izleme.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export class IzlemeController {
    static cevrimici = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Çevrimiçi oturumlar getirildi.", await IzlemeService.cevrimici());
    });
    static girisLoglari = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Giriş geçmişi getirildi.", await IzlemeService.girisLoglari(req.query));
    });
    static islemLoglari = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "İşlem kaydı getirildi.", await IzlemeService.islemLoglari(req.query));
    });
    static oturumuKapat = asyncHandler(async (req, res) => {
        await IzlemeService.oturumuKapat(req.admin, req.params.sid);
        return ApiResponse.ok(res, "Oturum kapatıldı.");
    });
    static firmaOturumlariniKapat = asyncHandler(async (req, res) => {
        const sonuc = await IzlemeService.firmaOturumlariniKapat(req.admin, Number(req.params.id));
        return ApiResponse.ok(res, `${sonuc.kapanan} oturum kapatıldı.`, sonuc);
    });
}
