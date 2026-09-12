import { Router } from "express";
import { RaporController } from "../controllers/rapor.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
/**
 * Rapor uçları — bkz. docs/raporlar.md. Yetki: giriş yapmış her kullanıcı (yönetici kararı 11).
 * Yalnızca okuma; hiçbir uç veri değiştirmez.
 */
const router = Router();
router.use(authenticate);
router.get("/sablonlar", RaporController.sablonlar);
router.get("/:kod/tanim", RaporController.tanim);
router.get("/:kod/veri", RaporController.veri);
router.get("/:kod/pdf", RaporController.pdf);
router.get("/:kod/excel", RaporController.excel);
export default router;
