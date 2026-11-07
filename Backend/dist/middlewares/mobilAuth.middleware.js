import rateLimit from "express-rate-limit";
import { env } from "../config/env.config.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { MobilAuthService } from "../services/mobil/mobilAuth.service.js";
import { ApiError } from "../utils/ApiError.js";
import { istemciIp } from "../utils/istemci.utils.js";
/** Mobil cari uçları (docs/MOBIL_CARI_YOL_HARITASI.md, Faz 3). Kurulum (exe) sürümünde bu tur yok (K24). */
export const mobilKapisi = (req, res, next) => {
    if (env.KURULUM_MODU)
        return next(new ApiError(HttpStatus.NOT_FOUND, "Mobil erişim bu sürümde yok."));
    res.setHeader("Cache-Control", "no-store");
    next();
};
/** IP başına 15 dakikada 20 başarısız giriş (hesap kilidinden ayrı: kullanıcı adı tahminine karşı) */
export const mobilGirisSiniri = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => istemciIp(req),
    handler: (_req, _res, next) => next(new ApiError(429, "Çok fazla hatalı giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.")),
});
/** Yalnız Authorization: Bearer (mobil token'ı) */
export const mobilAuthenticate = async (req, _res, next) => {
    try {
        const h = req.headers.authorization;
        if (!h || !h.startsWith("Bearer "))
            throw ApiError.unauthorized("Oturum bulunamadı. Lütfen giriş yapınız.");
        req.mobil = await MobilAuthService.baglam(h.substring(7));
        next();
    }
    catch (error) {
        if (error instanceof ApiError)
            return next(error);
        if (error?.name === "TokenExpiredError")
            return next(ApiError.unauthorized("Oturum süreniz doldu, lütfen tekrar giriş yapınız."));
        if (error?.name === "JsonWebTokenError")
            return next(ApiError.unauthorized("Geçersiz oturum."));
        next(error);
    }
};
/** İlk şifre değiştirilmeden yalnız şifre değiştirme / çıkış / ben */
export const mobilSifreBelirlenmis = (req, _res, next) => {
    if (req.mobil?.kullanici.sifreDegismeli)
        return next(new ApiError(HttpStatus.FORBIDDEN, "Önce şifrenizi değiştirin.", { kod: "SIFRE_DEGISMELI" }));
    next();
};
/** Veri uçları seçili bir veritabanı ister */
export const mobilVeritabaniSecili = (req, _res, next) => {
    if (!req.mobil?.erisim || !req.mobil.ctx)
        return next(new ApiError(HttpStatus.BAD_REQUEST, "Önce veritabanı seçin.", { kod: "VERITABANI_SECILMEDI" }));
    next();
};
/** Erişimdeki yetki (K10): kapalıysa 403 */
export const mobilYetki = (yetki, mesaj) => (req, _res, next) => {
    if (!req.mobil?.erisim?.yetkiler[yetki])
        return next(new ApiError(HttpStatus.FORBIDDEN, mesaj, { kod: "YETKI_YOK" }));
    next();
};
