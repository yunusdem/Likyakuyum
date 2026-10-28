import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.config.js";
import { adminYapilandirildiMi, adminYapilandirmaHatasi } from "../config/adminDb.config.js";
import { DestekPersonelSqlRepository } from "../models/admin/destekPersonelSql.repository.js";
import { personelTokenDogrula } from "../services/destekPanel/destekPanelAuth.service.js";
import { ApiError } from "../utils/ApiError.js";
import { istemciIp } from "../utils/istemci.utils.js";

/**
 * Destek paneli API'sinin ön kapısı (docs/DESTEK_PANELI_YOL_HARITASI.md): tarayıcıdan gelen istek yalnız
 * destek panelinin adresinden (DESTEK_ORIGIN) kabul edilir; yanıtlar ara katmanda saklanmaz.
 */
export const destekKapisi = (req: Request, res: Response, next: NextFunction) => {
  if (!adminYapilandirildiMi()) return next(adminYapilandirmaHatasi());
  const origin = String(req.headers.origin || "").toLowerCase();
  if (origin && !env.DESTEK_ORIGIN.includes(origin)) return next(ApiError.forbidden("Destek paneline bu adresten erişilemez."));
  res.setHeader("Cache-Control", "no-store");
  next();
};

/** Yalnız Authorization: Bearer. Oturum kapatılmış / kişi pasif / bağlı admin hesabı pasif ise reddedilir. */
export const destekAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const h = req.headers.authorization;
    if (!h || !h.startsWith("Bearer ")) throw ApiError.unauthorized("Oturum bulunamadı. Lütfen giriş yapınız.");
    const payload = personelTokenDogrula(h.substring(7));
    const baglam = await DestekPersonelSqlRepository.gecerliOturum(payload.sid, payload.personelId);
    if (!baglam) throw ApiError.unauthorized("Oturumunuz sonlandırılmış. Lütfen tekrar giriş yapınız.");
    req.personel = baglam;
    next();
  } catch (error: any) {
    if (error instanceof ApiError) return next(error);
    if (error?.name === "TokenExpiredError") return next(ApiError.unauthorized("Oturum süreniz doldu, lütfen tekrar giriş yapınız."));
    next(ApiError.unauthorized("Geçersiz oturum."));
  }
};

/** Geçici şifreyle giren kişi şifresini belirleyene kadar başka işlem yapamaz. */
export const destekSifreBelirlenmis = (req: Request, res: Response, next: NextFunction) => {
  if (req.personel?.sifreDegismeli) return next(ApiError.forbidden("Devam etmeden önce şifrenizi belirlemelisiniz."));
  next();
};

/** Giriş deneme sınırı: IP başına 15 dakikada 10 başarısız deneme (hesap kilidi ayrıca serviste). */
export const destekGirisSiniri = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => istemciIp(req as Request),
  handler: (req, res, next) => next(new ApiError(429, "Çok fazla hatalı giriş denemesi. Lütfen 15 dakika sonra tekrar deneyiniz.")),
});
