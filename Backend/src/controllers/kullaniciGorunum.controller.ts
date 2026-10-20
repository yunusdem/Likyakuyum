import { Request, Response } from "express";
import { KullaniciGorunumRepository } from "../models/kullaniciGorunum.repository.js";
import { UserSqlRepository } from "../models/userSql.repository.js";
import { gecerliKodMu, gorunumYoneticisiMi } from "../services/gorunum/kullaniciGorunum.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Kullanıcı görünümü uçları (docs/KULLANICI_GORUNUM_YOL_HARITASI.md, Faz 1). Yalnız yönetici okur ve yazar (G5);
 * kapalı kodlar katalog + kontrol kodu biçiminde olmalı. En çok 2000 kod (katalog birkaç yüz).
 */

const YONETICI_GEREKLI = "Görünüm ayarlarını yalnız yönetici değiştirebilir.";
const KOD_SINIRI = 2000;

export class KullaniciGorunumController {
  private static async hazirla(req: Request) {
    if (!(await gorunumYoneticisiMi(req))) throw ApiError.forbidden(YONETICI_GEREKLI);
    const kullaniciId = Number(req.params.kullaniciId);
    if (!Number.isInteger(kullaniciId) || kullaniciId <= 0) throw ApiError.badRequest("Kullanıcı kimliği geçersiz.");
    const ctx = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    if (!(await UserSqlRepository.findById(String(kullaniciId), ctx))) throw ApiError.notFound("Kullanıcı bulunamadı.");
    return { kullaniciId, ctx };
  }

  /** GET /api/v1/kullanici-gorunum/:kullaniciId → { kapali: string[] } */
  public static oku = asyncHandler(async (req: Request, res: Response) => {
    const { kullaniciId, ctx } = await KullaniciGorunumController.hazirla(req);
    return ApiResponse.ok(res, "Görünüm ayarı.", { kullaniciId, kapali: await KullaniciGorunumRepository.kapalilar(kullaniciId, ctx) });
  });

  /** PUT /api/v1/kullanici-gorunum/:kullaniciId { kapali: string[] } — boş liste = her şey açık */
  public static kaydet = asyncHandler(async (req: Request, res: Response) => {
    const { kullaniciId, ctx } = await KullaniciGorunumController.hazirla(req);
    const kapali = (req.body || {}).kapali;
    if (!Array.isArray(kapali)) throw ApiError.badRequest("kapali listesi gerekli.");
    if (kapali.length > KOD_SINIRI) throw ApiError.badRequest("Kapalı kod listesi çok uzun.");
    const bozuk = kapali.find((k: unknown) => !gecerliKodMu(k));
    if (bozuk !== undefined) throw ApiError.badRequest(`Modül kodu geçersiz: ${String(bozuk).slice(0, 60)}`);
    const temiz = [...new Set(kapali as string[])];
    await KullaniciGorunumRepository.kaydet(kullaniciId, temiz, ctx);
    return ApiResponse.ok(res, "Görünüm ayarı kaydedildi.", { kullaniciId, kapali: temiz });
  });
}
