import { Request, Response } from "express";
import { DestekService } from "../../services/destek/destek.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Yönetim paneli: Destek (talepler + sistem kayıtları) ve Bildirimler (/api/v1/admin/destek). */
export class DestekAdminController {
  public static ozet = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Destek özeti.", await DestekService.adminOzet(req.admin!));
  });

  public static konular = asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, any>;
    return ApiResponse.ok(
      res,
      "Konular.",
      await DestekService.adminKonular(req.admin!, {
        tur: q.tur,
        durum: q.durum,
        firmaId: q.firmaId ? Number(q.firmaId) : undefined,
        atananAdminId: q.atananAdminId ? Number(q.atananAdminId) : undefined,
        kaynakKonuId: q.kaynakKonuId ? Number(q.kaynakKonuId) : undefined,
        arama: q.arama,
        sayfa: q.sayfa ? Number(q.sayfa) : undefined,
        sayfaBoyu: q.sayfaBoyu ? Number(q.sayfaBoyu) : undefined,
      })
    );
  });

  public static konu = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Konu.", await DestekService.adminKonu(req.admin!, Number(req.params.id)));
  });

  public static mesajYaz = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Mesaj gönderildi.", await DestekService.adminMesaj(req.admin!, Number(req.params.id), req.body));
  });

  public static konuGuncelle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Kayıt güncellendi.", await DestekService.adminKonuGuncelle(req.admin!, Number(req.params.id), req.body));
  });

  public static bildirimler = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Bildirimler.", await DestekService.bildirimler(req.admin!));
  });

  public static hedefSecenekleri = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Hedef seçenekleri.", await DestekService.hedefSecenekleri());
  });

  public static bildirimOlustur = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.created(res, req.body.gonder ? "Bildirim gönderildi." : "Taslak kaydedildi.", await DestekService.bildirimOlustur(req.admin!, req.body));
  });

  public static bildirimGuncelle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, req.body.gonder ? "Bildirim gönderildi." : "Taslak kaydedildi.", await DestekService.bildirimGuncelle(req.admin!, Number(req.params.id), req.body));
  });

  public static bildirimGeriCek = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Bildirim geri çekildi.", await DestekService.bildirimGeriCek(req.admin!, Number(req.params.id)));
  });

  public static ek = asyncHandler(async (req: Request, res: Response) => {
    const d = await DestekService.adminEk(Number(req.params.id));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.type(d.mime);
    res.sendFile(d.yol);
  });
}
