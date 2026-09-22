import { KullaniciService } from "../../services/admin/kullanici.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const id = (req) => Number(req.params.id);
export class KullaniciController {
    static tumu = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Kullanıcılar getirildi.", await KullaniciService.tumu());
    });
    static firmaKullanicilari = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Kullanıcılar getirildi.", await KullaniciService.firmaKullanicilari(id(req)));
    });
    static ekle = asyncHandler(async (req, res) => {
        return ApiResponse.created(res, "Kullanıcı oluşturuldu.", await KullaniciService.ekle(req.admin, id(req), req.body));
    });
    static guncelle = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Kullanıcı güncellendi.", await KullaniciService.guncelle(req.admin, id(req), req.body));
    });
    static sifreSifirla = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Şifre sıfırlandı.", await KullaniciService.sifreSifirla(req.admin, id(req)));
    });
    static iceAktar = asyncHandler(async (req, res) => {
        const sonuc = await KullaniciService.iceAktar(req.admin, id(req));
        return ApiResponse.ok(res, `${sonuc.eklenen.length} kullanıcı içe aktarıldı.`, sonuc);
    });
}
