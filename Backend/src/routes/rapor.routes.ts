import { Router } from "express";
import { RaporController } from "../controllers/rapor.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { raporYetkisi } from "../services/yetki/menuYetkiKatalogu.js";
import { raporLisansKapisi } from "../middlewares/modul.middleware.js";

/**
 * Rapor uçları — bkz. docs/raporlar.md. Yetki: kullanıcının menü yetkisinde raporun maddesi ve gerekiyorsa yetki kutusu
 * (cari bakiye, açık vadeli, şüpheli işlem; docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4).
 * Rapor uçları yalnızca okur; yalnızca kayıtlı arama uçları kullanıcının kendi TODVZ_RAPOR_ARAMA kayıtlarını yazar/siler.
 */
const router = Router();
router.use(authenticate);

router.get("/sablonlar", RaporController.sablonlar);
router.get("/secim/:kaynak", RaporController.secim);
router.get("/:kod/tanim", RaporController.tanim);
router.get("/:kod/veri", raporLisansKapisi, raporYetkisi, RaporController.veri);
router.get("/:kod/pdf", raporLisansKapisi, raporYetkisi, RaporController.pdf);
router.get("/:kod/excel", raporLisansKapisi, raporYetkisi, RaporController.excel);
// Kayıtlı aramalar: kullanıcının kendi kayıtları (yalnızca TODVZ_RAPOR_ARAMA'ya yazar/siler; rapor verisine dokunmaz)
router.get("/:kod/aramalar", RaporController.aramalar);
router.post("/:kod/aramalar", RaporController.aramaKaydet);
router.delete("/:kod/aramalar", RaporController.aramaSil);
router.delete("/:kod/aramalar/:id", RaporController.aramaSil);

export default router;
