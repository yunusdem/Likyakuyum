import { Request, Response } from "express";
import { FirmaService } from "../../services/admin/firma.service.js";
import { FirmaBaglantiService } from "../../services/admin/firmaBaglanti.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const id = (req: Request): number => Number(req.params.id);

export class FirmaController {
  public static ozet = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Özet getirildi.", await FirmaService.ozet());
  });

  public static listele = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firmalar getirildi.", await FirmaService.listele());
  });

  public static getir = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firma getirildi.", await FirmaService.getir(id(req)));
  });

  public static ekle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.created(res, "Firma oluşturuldu.", await FirmaService.ekle(req.admin!, req.body));
  });

  public static guncelle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firma güncellendi.", await FirmaService.guncelle(req.admin!, id(req), req.body));
  });

  public static durum = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firma durumu değiştirildi.", await FirmaService.durumDegistir(req.admin!, id(req), req.body));
  });

  public static dogrulama = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Doğrulama kaydedildi.", await FirmaService.dogrulama(req.admin!, id(req), req.body));
  });

  public static dbTest = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await FirmaBaglantiService.dbTest(id(req));
    return ApiResponse.ok(res, sonuc.sonuc, { ...sonuc, firma: await FirmaService.getir(id(req)) });
  });

  public static masakKontrol = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await FirmaBaglantiService.masakKontrol(id(req));
    return ApiResponse.ok(res, sonuc.sonuc, { ...sonuc, firma: await FirmaService.getir(id(req)) });
  });

  public static lisanslar = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Lisanslar getirildi.", await FirmaService.lisanslar(id(req)));
  });

  public static lisansEkle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.created(res, "Lisans eklendi.", await FirmaService.lisansEkle(req.admin!, id(req), req.body));
  });
}
