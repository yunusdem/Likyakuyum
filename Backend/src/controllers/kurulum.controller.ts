import { Request, Response } from "express";
import { env } from "../config/env.config.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { calisanSurum } from "../utils/surum.js";
import { AuthService } from "../services/auth.service.js";
import { KurulumLisansService } from "../services/kurulum/kurulumLisans.service.js";
import { kurulumFirmasi } from "../services/kurulum/firmaDosyasi.js";
import { KurulumBildirim } from "../services/kurulum/kurulumBildirim.js";
import { Guncelleyici, bekleyenGuncelleme, sonGuncellemeSonucu } from "../services/kurulum/guncelleyici.js";
import { UserSqlRepository } from "../models/userSql.repository.js";
import { kurulumDbContext } from "../services/kurulum/kurulumDb.js";

const kurulumOlmali = () => {
  if (!env.KURULUM_MODU) throw ApiError.notFound("Bu işlem yalnız kurulum sürümünde vardır.");
};

export class KurulumController {
  /** Açık uç: giriş ekranı kurulum mu bulut mu olduğunu, sürümü ve (kurulumda) firmayı buradan öğrenir. */
  public static bilgi = asyncHandler(async (req: Request, res: Response) => {
    if (!env.KURULUM_MODU) return ApiResponse.ok(res, "Sistem bilgisi.", { kurulum: false, surum: calisanSurum() });
    const f = kurulumFirmasi();
    let kullaniciVar: boolean | null = null;
    try {
      kullaniciVar = await AuthService.kurulumKullaniciVarMi();
    } catch {
      kullaniciVar = null; // veritabanına ulaşılamıyor
    }
    return ApiResponse.ok(res, "Sistem bilgisi.", {
      kurulum: true,
      surum: calisanSurum(),
      firma: f ? { firmaKodu: f.firmaKodu, unvan: f.unvan, musteriNo: f.musteriNo } : null,
      kullaniciVar,
    });
  });

  public static lisansDurumu = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    return ApiResponse.ok(res, "Lisans durumu.", await KurulumLisansService.durum(true));
  });

  public static lisansYukle = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    return ApiResponse.ok(res, "Lisans yüklendi.", await KurulumLisansService.yukle(String(req.body?.kod || "")));
  });

  /** Lisans ve Sürüm ekranı: çalışan sürüm, bekleyen güncelleme, son güncelleme sonucu, son bildirim. */
  public static guncellemeDurumu = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    return ApiResponse.ok(res, "Güncelleme durumu.", {
      surum: calisanSurum(),
      bekleyen: bekleyenGuncelleme(),
      sonSonuc: sonGuncellemeSonucu(),
      bildirim: KurulumBildirim.durum(),
      lisans: await KurulumLisansService.durum(),
    });
  });

  /** Merkeze şimdi bildirim gönderir (yeni lisans / sürüm varsa iner). */
  public static guncellemeKontrol = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    const sonuc = await KurulumBildirim.gonder();
    if (!sonuc.basarili) throw ApiError.badRequest(`Merkeze ulaşılamadı: ${sonuc.hata}`);
    return ApiResponse.ok(res, "Merkezle eşitlendi.", { ...sonuc, bekleyen: bekleyenGuncelleme() });
  });

  /** Bekleyen güncellemeyi hemen uygular (yalnız sistem yöneticisi; program birkaç saniye kapanır). */
  public static guncellemeSimdi = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    const user = await UserSqlRepository.findById(String(req.user?.userId), kurulumDbContext());
    if (!user?.isSysAdmin) throw ApiError.forbidden("Güncellemeyi yalnız sistem yöneticisi başlatabilir.");
    try {
      return ApiResponse.ok(res, "Güncelleme başlatıldı; program kısa süre içinde yeniden açılacak.", await Guncelleyici.simdiUygula());
    } catch (err: any) {
      throw ApiError.badRequest(err?.message || "Güncelleme başlatılamadı.");
    }
  });

  public static ilkYonetici = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    return ApiResponse.ok(res, "İlk yönetici oluşturuldu.", await AuthService.kurulumIlkYonetici(req.body));
  });
}
