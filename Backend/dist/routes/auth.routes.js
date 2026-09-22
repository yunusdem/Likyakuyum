import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { loginSchema, refreshTokenSchema, changePasswordSchema } from "../schemas/auth.schema.js";
const router = Router();
// Public Auth Endpoints
router.post("/login", authRateLimiter, validate(loginSchema), AuthController.login);
// /register kapatıldı: kimlik doğrulaması olmadan kullanıcı açıyordu. Kullanıcılar Kullanıcı Tanımları ekranından
// (firma yöneticisi) veya yönetim panelinden açılır (docs/ADMIN_PANEL_YOL_HARITASI.md 7.2).
router.post("/refresh-token", validate(refreshTokenSchema), AuthController.refreshToken);
// Protected Auth Endpoints
router.post("/logout", authenticate, AuthController.logout);
router.get("/me", authenticate, AuthController.getMe);
router.post("/change-password", authenticate, validate(changePasswordSchema), AuthController.changePassword);
export default router;
