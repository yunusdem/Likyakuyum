import { PosAdminService } from "../../services/admin/posAdmin.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const id = (req) => Number(req.params.id);
export class PosAdminController {
    static ayarGetir = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "POS ayarları getirildi.", await PosAdminService.ayarGetir());
    });
    static ayarKaydet = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "POS ayarları kaydedildi.", await PosAdminService.ayarKaydet(req.admin, req.body || {}));
    });
    static firmaModu = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "POS modu getirildi.", await PosAdminService.firmaModu(id(req)));
    });
    static firmaModuYaz = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "POS modu kaydedildi.", await PosAdminService.firmaModuYaz(req.admin, id(req), req.body?.mod));
    });
    static dogrulama = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Doğrulama durumu getirildi.", await PosAdminService.dogrulama());
    });
    static dogrulamaYaz = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Doğrulama işareti kaydedildi.", await PosAdminService.dogrulamaYaz(req.admin, req.body || {}));
    });
    static konsolFirmalar = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Firmalar getirildi.", await PosAdminService.konsolFirmalar());
    });
    static konsolTerminaller = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Cihazlar getirildi.", await PosAdminService.konsolTerminaller(id(req)));
    });
    static kimlikTesti = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Kimlik denendi.", await PosAdminService.kimlikTesti(req.body?.saglayici));
    });
    static konsolBaglantiTesti = asyncHandler(async (req, res) => {
        const data = await PosAdminService.konsolBaglantiTesti(id(req), Number(req.body?.posTerminalId), req.body?.gercek === true);
        return ApiResponse.ok(res, "Bağlantı denendi.", data);
    });
    static konsolDeneme = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Deneme tahsilatı gönderildi.", await PosAdminService.konsolDeneme(req.admin, id(req), req.body || {}));
    });
    static konsolIslem = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Deneme işlemi getirildi.", await PosAdminService.konsolIslem(id(req), Number(req.params.islemId)));
    });
    static konsolIptal = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Deneme işlemi iptal edildi.", await PosAdminService.konsolIptal(id(req), Number(req.params.islemId)));
    });
    static konsolElle = asyncHandler(async (req, res) => {
        const data = await PosAdminService.konsolElle(id(req), Number(req.params.islemId), req.body?.alindi === true);
        return ApiResponse.ok(res, "İşaret kaydedildi.", data);
    });
    static log = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "POS günlüğü getirildi.", await PosAdminService.log(Number(req.query.limit) || 50));
    });
}
