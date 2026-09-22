import rateLimit from "express-rate-limit";
import { env } from "../config/env.config.js";
import { adminYapilandirildiMi, adminYapilandirmaHatasi } from "../config/adminDb.config.js";
import { AdminOturumSqlRepository } from "../models/admin/adminOturumSql.repository.js";
import { adminTokenDogrula } from "../services/admin/adminAuth.service.js";
import { ApiError } from "../utils/ApiError.js";
import { istemciIp } from "../utils/istemci.utils.js";
import { logger } from "../utils/logger.js";
/**
 * Admin API'sinin ön kapısı: yapılandırma yoksa kapalı; tarayıcıdan gelen istek yalnızca
 * admin panelinin adresinden (ADMIN_ORIGIN) kabul edilir. Origin göndermeyen istekler
 * (aynı adresten GET, sunucu içi araçlar) token kontrolüne bırakılır.
 */
export const adminKapisi = (req, res, next) => {
    if (!adminYapilandirildiMi())
        return next(adminYapilandirmaHatasi());
    const origin = String(req.headers.origin || "").toLowerCase();
    if (origin && !env.ADMIN_ORIGIN.includes(origin)) {
        return next(ApiError.forbidden("Admin paneline bu adresten erişilemez."));
    }
    // Yanıtlar (geçici şifreler dahil) hiçbir ara katmanda saklanmasın
    res.setHeader("Cache-Control", "no-store");
    next();
};
/**
 * Admin kimlik doğrulaması. Yalnızca Authorization: Bearer kabul edilir (çerez yok → CSRF yok),
 * kullanıcı tarafındaki authenticate'in geliştirme kolaylığı (token'sız varsayılan admin) burada YOKTUR.
 * Token geçerli olsa bile oturum (sid) kapatılmış/iptal edilmişse veya admin pasifse reddedilir.
 */
export const adminAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw ApiError.unauthorized("Admin oturumu bulunamadı. Lütfen giriş yapınız.");
        }
        const payload = adminTokenDogrula(authHeader.substring(7));
        const oturum = await AdminOturumSqlRepository.gecerliOturum(payload.sid, payload.adminId);
        if (!oturum)
            throw ApiError.unauthorized("Oturumunuz sonlandırılmış. Lütfen tekrar giriş yapınız.");
        req.admin = oturum;
        next();
    }
    catch (error) {
        if (error instanceof ApiError)
            return next(error);
        if (error?.name === "TokenExpiredError") {
            return next(ApiError.unauthorized("Oturum süreniz doldu, lütfen tekrar giriş yapınız."));
        }
        next(ApiError.unauthorized("Geçersiz admin oturumu."));
    }
};
/** Geçici şifreyle giren admin, şifresini belirleyene kadar başka hiçbir işlem yapamaz. */
export const sifreBelirlenmisOlmali = (req, res, next) => {
    if (req.admin?.sifreDegismeli) {
        return next(ApiError.forbidden("Devam etmeden önce şifrenizi belirlemelisiniz."));
    }
    next();
};
/**
 * Admin router'ının kendi hata işleyicisi. Genel işleyici geliştirme modunda stack döndürür ve
 * beklenmeyen hataların (ör. ham SQL) metnini istemciye geçirir; admin uçlarında ikisi de yapılmaz.
 */
export const adminHataIsleyici = (err, req, res, _next) => {
    if (err instanceof ApiError && err.isOperational) {
        if (err.statusCode >= 500)
            logger.error(`[ADMIN ${err.statusCode}] ${req.method} ${req.originalUrl} - ${err.message}`);
        else
            logger.warn(`[ADMIN ${err.statusCode}] ${req.method} ${req.originalUrl} - ${err.message}`);
        res.status(err.statusCode).json({ success: false, message: err.message, ...(err.errors && { errors: err.errors }) });
        return;
    }
    logger.error(`[ADMIN 500] ${req.method} ${req.originalUrl}`, err);
    res.status(500).json({ success: false, message: "Sunucu tarafında bir hata oluştu." });
};
/** Maildeki doğrulama bağlantısının herkese açık ucu: IP başına 15 dakikada 30 istek (anahtar deneme-yanılmasına karşı). */
export const epostaOnaySiniri = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => istemciIp(req),
    handler: (req, res, next) => {
        next(new ApiError(429, "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyiniz."));
    },
});
/** Admin girişine deneme sınırı: IP başına 15 dakikada 10 başarısız deneme. */
export const adminGirisSiniri = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => istemciIp(req),
    handler: (req, res, next) => {
        next(new ApiError(429, "Çok fazla hatalı giriş denemesi. Lütfen 15 dakika sonra tekrar deneyiniz."));
    },
});
