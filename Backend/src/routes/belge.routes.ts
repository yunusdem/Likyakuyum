import { Router } from "express";
import { BelgeController } from "../controllers/belge.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

/**
 * Belge (fiş PDF) uçları — bkz. docs/belgeverapor.md.
 * Yetki: giriş yapmış her kullanıcı (yönetici kararı 9: tüm rollere açık).
 * Hiçbir uç fiş verisini değiştirmez; yalnızca okur, PDF üretir ve isteğe bağlı arşive yazar.
 */
const router = Router();
router.use(authenticate);

router.get("/sablonlar", BelgeController.sablonlar);
router.get("/fisler", BelgeController.fisler);
router.get("/pdf", BelgeController.pdf);
router.post("/arsivle", BelgeController.arsivle);

export default router;
