import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { adminYapilandirildiMi, adminYapilandirmaHatasi } from "../config/adminDb.config.js";
import { validate } from "../middlewares/validate.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { istemciIp } from "../utils/istemci.utils.js";
import { MerkezKurulumService } from "../services/admin/merkezKurulum.service.js";
/**
 * Merkez sunucunun kurulum (exe) programlarına açık uçları (oturumsuz; kimlik: firma kodu + kurulum anahtarı).
 * docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, K10, K12.
 */
const router = Router();
const merkezSiniri = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => istemciIp(req),
    handler: (req, res, next) => next(new ApiError(429, "Çok fazla istek. Lütfen daha sonra tekrar deneyiniz.")),
});
router.use((req, res, next) => (adminYapilandirildiMi() ? next() : next(adminYapilandirmaHatasi())));
router.use(merkezSiniri);
const heartbeatSchema = z.object({
    body: z.object({
        firmaKodu: z.string().trim().min(1).max(20),
        kurulumAnahtari: z.string().min(10).max(200),
        makineKimligi: z.string().max(19).nullish(),
        surum: z.string().max(30).nullish(),
        lisans: z
            .object({ durum: z.string().max(20).nullish(), neden: z.string().max(30).nullish(), seri: z.number().int().nullish() })
            .nullish(),
        kullaniciSayisi: z.number().int().nullish(),
        semaSurumu: z.number().int().nullish(),
    }),
});
router.post("/heartbeat", validate(heartbeatSchema), asyncHandler(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return ApiResponse.ok(res, "Bildirim alındı.", await MerkezKurulumService.heartbeat(req.body, istemciIp(req)));
}));
router.get("/kurulum/:token", asyncHandler(async (req, res) => {
    await MerkezKurulumService.kurulumIndir(String(req.params.token), res);
}));
router.get("/surum/:surum", asyncHandler(async (req, res) => {
    await MerkezKurulumService.surumIndir(String(req.params.surum), String(req.headers["x-likya-firma"] || ""), String(req.headers["x-likya-anahtar"] || ""), res);
}));
export default router;
