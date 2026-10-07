import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { loginSchema, refreshTokenSchema, changePasswordSchema, musteriVeritabanlariSchema, lisansYukleSchema, ilkYoneticiSchema, } from "../schemas/auth.schema.js";
import { KurulumController } from "../controllers/kurulum.controller.js";
const router = Router();
// Public Auth Endpoints
router.post("/login", authRateLimiter, validate(loginSchema), AuthController.login);
// Giriş ekranı: müşteri no yazılınca o müşterinin veritabanları (firma ünvanı + DB adı; bağlantı bilgisi dönmez)
router.get("/musteri-veritabanlari", authRateLimiter, validate(musteriVeritabanlariSchema), AuthController.musteriVeritabanlari);
// /register kapatıldı: kimlik doğrulaması olmadan kullanıcı açıyordu. Kullanıcılar Kullanıcı Tanımları ekranından
// (firma yöneticisi) veya yönetim panelinden açılır (docs/ADMIN_PANEL_YOL_HARITASI.md 7.2).
router.post("/refresh-token", validate(refreshTokenSchema), AuthController.refreshToken);
// Kurulum (exe) sürümü: çevrimdışı lisans ve ilk yönetici (bulut sürümünde 404)
router.get("/lisans-durum", KurulumController.lisansDurumu);
router.post("/lisans-yukle", authRateLimiter, validate(lisansYukleSchema), KurulumController.lisansYukle);
router.post("/ilk-yonetici", authRateLimiter, validate(ilkYoneticiSchema), KurulumController.ilkYonetici);
// Protected Auth Endpoints
router.post("/logout", authenticate, AuthController.logout);
router.get("/me", authenticate, AuthController.getMe);
router.post("/change-password", authenticate, validate(changePasswordSchema), AuthController.changePassword);
export default router;
