import { Request, Response } from "express";
import { VknSorguService } from "../services/gib/vknSorgu.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/** GİB VKN/TCKN sorgusu ve firmanın kendi GİB hesabı (docs/GIB_VKN_SORGU_YOL_HARITASI.md) */
export class GibController {
  private static ctx(req: Request) {
    return { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
  }

  private static kullanici(req: Request): string {
    return req.user?.username || req.user?.userId || "bilinmiyor";
  }

  /** GET /api/v1/gib/vkn-sorgu?no= */
  public static vknSorgu = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await VknSorguService.sorgula(String(req.query.no ?? ""), GibController.ctx(req), GibController.kullanici(req));
    return ApiResponse.ok(res, sonuc.sonuc === "BULUNDU" ? "GİB kaydı bulundu." : "Bu numara GİB'de kayıtlı değil.", sonuc);
  });

  /** GET /api/v1/gib/hesap — şifre dönmez */
  public static hesap = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "GİB hesabı getirildi.", await VknSorguService.hesapDurumu(GibController.ctx(req)));
  });

  /** PUT /api/v1/gib/hesap { kullaniciKodu, sifre } */
  public static hesapKaydet = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await VknSorguService.hesapKaydet(
      GibController.ctx(req),
      String(req.body?.kullaniciKodu ?? ""),
      String(req.body?.sifre ?? ""),
      GibController.kullanici(req)
    );
    return ApiResponse.ok(res, "GİB hesabı kaydedildi.", sonuc);
  });

  /** DELETE /api/v1/gib/hesap */
  public static hesapSil = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "GİB hesabı silindi.", await VknSorguService.hesapSil(GibController.ctx(req)));
  });

  /** POST /api/v1/gib/hesap/dene */
  public static hesapDene = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "GİB portalına giriş başarılı.", await VknSorguService.hesapDene(GibController.ctx(req)));
  });
}
