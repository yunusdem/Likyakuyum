import { Router } from "express";
import { BelgeController } from "../controllers/belge.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";
import { BelgeSablonController } from "../controllers/belgeSablon.controller.js";

/**
 * Belge (fiş PDF) uçları — bkz. docs/belgeverapor.md.
 * Yetki: giriş yapmış her kullanıcı (yönetici kararı 9: tüm rollere açık).
 * Hiçbir uç fiş verisini değiştirmez; yalnızca okur, PDF üretir ve isteğe bağlı arşive yazar.
 * `/cikti/*`: yazıcıya giden fişin şablonu + verisi (docs/FIS_TASARIM_YOL_HARITASI.md).
 */
const router = Router();
router.use(authenticate);

router.get("/sablonlar", BelgeController.sablonlar);
router.get("/fisler", BelgeController.fisler);
router.get("/pdf", BelgeController.pdf);
router.post("/pdf/onizleme", BelgeController.pdfOnizleme);
router.post("/arsivle", BelgeController.arsivle);
router.post("/cikti/doviz", BelgeController.dovizCiktisi);
router.post("/cikti/sarraf", BelgeController.sarrafCiktisi);
router.post("/cikti/perakende", BelgeController.perakendeCiktisi);
router.post("/cikti/ticari", BelgeController.ticariCiktisi);

// Fiş şablonu yönetimi: yalnızca firmanın sistem yöneticisi (docs/FIS_TASARIM_YOL_HARITASI.md, 4.7)
const yonetici = authorizeRoles("admin");
router.get("/sablon-turleri", yonetici, BelgeSablonController.turler);
router.get("/sablon/:tur", yonetici, BelgeSablonController.getir);
router.get("/sablon/:tur/indir", yonetici, BelgeSablonController.indir);
router.get("/sablon/:tur/alanlar", yonetici, BelgeSablonController.alanlar);
router.get("/sablon/:tur/surumler", yonetici, BelgeSablonController.surumListesi);
router.get("/sablon/:tur/ornekler", yonetici, BelgeSablonController.ornekListesi);
router.get("/sablon/:tur/ornek/:kod", yonetici, BelgeSablonController.ornekGetir);
router.post("/sablon/:tur/denetle", yonetici, BelgeSablonController.denetle);
router.post("/sablon/:tur/onizle", yonetici, BelgeSablonController.onizle);
router.put("/sablon/:tur", yonetici, BelgeSablonController.kaydet);
router.post("/sablon/:tur/varsayilan", yonetici, BelgeSablonController.varsayilan);
router.post("/sablon/:tur/geri-al", yonetici, BelgeSablonController.geriAl);
router.get("/gorseller", yonetici, BelgeSablonController.gorseller);
router.post("/gorseller", yonetici, BelgeSablonController.gorselEkle);
router.delete("/gorseller/:id", yonetici, BelgeSablonController.gorselSil);

export default router;
