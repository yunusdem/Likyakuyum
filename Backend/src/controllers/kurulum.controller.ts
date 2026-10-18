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
import { aktivasyonAnahtariCoz } from "../services/lisans/aktivasyonAnahtari.js";
import { Guncelleyici, bekleyenGuncelleme, sonGuncellemeSonucu } from "../services/kurulum/guncelleyici.js";
import { UserSqlRepository } from "../models/userSql.repository.js";
import { kurulumDbContext } from "../services/kurulum/kurulumDb.js";
import { gocDurumu } from "../services/kurulum/gocDurumu.js";
import {
  KurulumYedek,
  SAKLANAN_GUN,
  VT_SINIR_MB,
  VT_UYARI_MB,
  vtBoyutuMb,
  yedekDosyalari,
  yedekDurumu,
  yedekKlasoru,
} from "../services/kurulum/kurulumYedek.js";

const ELLE_KONTROL_ARALIGI_MS = 30_000;
let sonElleKontrol = 0;

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
    // Aynı alana aktivasyon anahtarı (LKY-XXXXX-XXXXX-XXXXX) ya da uzun lisans kodu yazılır (docs 16, A2)
    const metin = String(req.body?.kod || "");
    const anahtar = aktivasyonAnahtariCoz(metin);
    if (anahtar) return ApiResponse.ok(res, "Lisans etkinleştirildi.", await KurulumBildirim.aktiflestir(anahtar));
    return ApiResponse.ok(res, "Lisans yüklendi.", await KurulumLisansService.yukle(metin));
  });

  /** Lisans ve Sürüm ekranı: çalışan sürüm, bekleyen güncelleme, son güncelleme sonucu, son bildirim. */
  public static guncellemeDurumu = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    return ApiResponse.ok(res, "Güncelleme durumu.", {
      surum: calisanSurum(),
      bekleyen: bekleyenGuncelleme(),
      sonSonuc: sonGuncellemeSonucu(),
      bildirim: KurulumBildirim.durum(),
      goc: gocDurumu(),
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

  /**
   * Kilit ekranından "Merkezden kontrol et" (giriş gerekmez; kilitliyken giriş yapılamıyordu, kod en geç 6 saatte iniyordu).
   * Merkeze en çok 30 sn'de bir gidilir; dönüşte güncel lisans durumu.
   */
  public static lisansKontrol = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    let sonuc: Awaited<ReturnType<typeof KurulumBildirim.gonder>> | null = null;
    if (Date.now() - sonElleKontrol >= ELLE_KONTROL_ARALIGI_MS) {
      sonElleKontrol = Date.now();
      sonuc = await KurulumBildirim.gonder();
    }
    return ApiResponse.ok(res, "Merkez denetlendi.", {
      merkezeUlasildi: sonuc ? sonuc.basarili : null,
      hata: sonuc?.hata ?? null,
      lisansYuklendi: !!sonuc?.lisansYuklendi,
      lisans: await KurulumLisansService.durum(true),
    });
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

  /** Lisans ve Sürüm ekranı "Yedek" kartı: son yedek, dosyalar, ek hedefler, veritabanı boyutu (docs 15.1, Y4). */
  public static yedekDurumu = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    const d = yedekDurumu();
    return ApiResponse.ok(res, "Yedek durumu.", {
      ...d,
      vtBoyutMb: (await vtBoyutuMb()) ?? d.vtBoyutMb,
      suruyor: KurulumYedek.suruyorMu(),
      klasor: yedekKlasoru(),
      dosyalar: yedekDosyalari(),
      sinirMb: VT_SINIR_MB,
      uyariMb: VT_UYARI_MB,
      saklananGun: SAKLANAN_GUN,
    });
  });

  /** "Şimdi Yedekle" (yalnız sistem yöneticisi): yedek arka planda alınır, ekran durumu sorar. */
  public static yedekAl = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    const user = await UserSqlRepository.findById(String(req.user?.userId), kurulumDbContext());
    if (!user?.isSysAdmin) throw ApiError.forbidden("Yedeği yalnız sistem yöneticisi başlatabilir.");
    void KurulumYedek.yedekAl("elle").catch(() => undefined);
    return ApiResponse.ok(res, "Yedek alınıyor.", { suruyor: true });
  });

  public static ilkYonetici = asyncHandler(async (req: Request, res: Response) => {
    kurulumOlmali();
    return ApiResponse.ok(res, "İlk yönetici oluşturuldu.", await AuthService.kurulumIlkYonetici(req.body));
  });
}
