import { Router } from "express";
import { RaporController } from "../controllers/rapor.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

/**
 * Rapor uçları — bkz. docs/raporlar.md. Yetki: giriş yapmış her kullanıcı (yönetici kararı 11).
 * Rapor uçları yalnızca okur; yalnızca kayıtlı arama uçları kullanıcının kendi TODVZ_RAPOR_ARAMA kayıtlarını yazar/siler.
 */
const router = Router();
router.use(authenticate);

router.get("/sablonlar", RaporController.sablonlar);
router.get("/:kod/tanim", RaporController.tanim);
router.get("/:kod/veri", RaporController.veri);
router.get("/:kod/pdf", RaporController.pdf);
router.get("/:kod/excel", RaporController.excel);
// Kayıtlı aramalar: kullanıcının kendi kayıtları (yalnızca TODVZ_RAPOR_ARAMA'ya yazar/siler; rapor verisine dokunmaz)
router.get("/:kod/aramalar", RaporController.aramalar);
router.post("/:kod/aramalar", RaporController.aramaKaydet);
router.delete("/:kod/aramalar", RaporController.aramaSil);
router.delete("/:kod/aramalar/:id", RaporController.aramaSil);

export default router;
