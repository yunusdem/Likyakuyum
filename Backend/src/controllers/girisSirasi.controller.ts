import { Request, Response } from "express";
import { z } from "zod";
import { GirisSirasiRepository } from "../models/girisSirasi.repository.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Kullanıcıya özel giriş sırası (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K3–K5).
 * Herkes yalnızca kendi sırasını okur ve yazar; kullanıcı kimliği oturumdan alınır.
 */

const ad = z.string().trim().regex(/^[A-Za-z0-9_.-]{1,80}$/, "Ekran / alan adı geçersiz.");
const kayitSema = z.object({
  alanlar: z
    .array(z.object({ alan: ad, atla: z.boolean().optional().default(false) }))
    .max(300)
    .refine((l) => new Set(l.map((x) => x.alan)).size === l.length, "Aynı alan iki kez verilmiş."),
});

export class GirisSirasiController {
  private static baglam(req: Request) {
    const kullaniciId = Number(req.user?.userId);
    if (!Number.isInteger(kullaniciId) || kullaniciId <= 0) throw ApiError.unauthorized("Kullanıcı bilgisi bulunamadı.");
    return { kullaniciId, ctx: { dbServer: req.user?.dbServer, dbName: req.user?.dbName } };
  }

  private static ekran(req: Request): string {
    const e = ad.safeParse(req.params.ekran);
    if (!e.success) throw ApiError.badRequest("Ekran adı geçersiz.");
    return e.data;
  }

  /** GET /api/v1/giris-sirasi — kullanıcının bütün ekranlardaki sıraları { ekran: [{alan, atla}] } */
  public static hepsi = asyncHandler(async (req: Request, res: Response) => {
    const { kullaniciId, ctx } = GirisSirasiController.baglam(req);
    return ApiResponse.ok(res, "Giriş sıraları.", await GirisSirasiRepository.hepsi(kullaniciId, ctx));
  });

  /** PUT /api/v1/giris-sirasi/:ekran { alanlar: [{alan, atla}] } — liste sırası = giriş sırası */
  public static kaydet = asyncHandler(async (req: Request, res: Response) => {
    const { kullaniciId, ctx } = GirisSirasiController.baglam(req);
    const ekran = GirisSirasiController.ekran(req);
    const p = kayitSema.safeParse(req.body || {});
    if (!p.success) throw ApiError.badRequest(p.error.issues[0]?.message || "Giriş sırası geçersiz.");
    await GirisSirasiRepository.kaydet(kullaniciId, ekran, p.data.alanlar, ctx);
    return ApiResponse.ok(res, "Giriş sırası kaydedildi.", { ekran, alanlar: p.data.alanlar });
  });

  /** DELETE /api/v1/giris-sirasi/:ekran — varsayılana dön */
  public static sifirla = asyncHandler(async (req: Request, res: Response) => {
    const { kullaniciId, ctx } = GirisSirasiController.baglam(req);
    const ekran = GirisSirasiController.ekran(req);
    await GirisSirasiRepository.kaydet(kullaniciId, ekran, [], ctx);
    return ApiResponse.ok(res, "Giriş sırası varsayılana döndü.", { ekran, alanlar: [] });
  });
}
