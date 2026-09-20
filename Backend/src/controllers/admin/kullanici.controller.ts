import { Request, Response } from "express";
import { KullaniciService } from "../../services/admin/kullanici.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const id = (req: Request): number => Number(req.params.id);

export class KullaniciController {
  public static tumu = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Kullanıcılar getirildi.", await KullaniciService.tumu());
  });

  public static firmaKullanicilari = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Kullanıcılar getirildi.", await KullaniciService.firmaKullanicilari(id(req)));
  });

  public static ekle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.created(res, "Kullanıcı oluşturuldu.", await KullaniciService.ekle(req.admin!, id(req), req.body));
  });

  public static guncelle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Kullanıcı güncellendi.", await KullaniciService.guncelle(req.admin!, id(req), req.body));
  });

  public static sifreSifirla = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Şifre sıfırlandı.", await KullaniciService.sifreSifirla(req.admin!, id(req)));
  });

  public static iceAktar = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await KullaniciService.iceAktar(req.admin!, id(req));
    return ApiResponse.ok(res, `${sonuc.eklenen.length} kullanıcı içe aktarıldı.`, sonuc);
  });
}
