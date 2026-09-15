import { Router } from "express";
import { EtiketController } from "../controllers/etiket.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
const router = Router();
router.use(authenticate);
// Ortak Lookup'lar
router.get("/grup-kodlari", EtiketController.getGrupKodlari);
router.get("/uretici-firmalar", EtiketController.getUreticiFirmalar);
// Altın Ürün (TODVZ_ALTIN_URUN)
router.get("/altin-urun", EtiketController.listAltinUrun);
router.get("/altin-urun/next-no", EtiketController.getNextAltinUrunNo);
router.get("/altin-urun/barkod/:barkod", EtiketController.getAltinUrunByBarkod);
router.get("/altin-urun/:id", EtiketController.getAltinUrunById);
router.post("/altin-urun", EtiketController.saveAltinUrun);
router.delete("/altin-urun/:id", EtiketController.deleteAltinUrun);
router.post("/altin-urun/yazdirildi-isaretle", EtiketController.markAltinUrunYazdirildi);
// Özel Ürün (TODVZ_OZEL_URUN)
router.get("/ozel-urun", EtiketController.listOzelUrun);
router.get("/ozel-urun/next-no", EtiketController.getNextOzelUrunNo);
router.get("/ozel-urun/barkod/:barkod", EtiketController.getOzelUrunByBarkod);
router.get("/ozel-urun/:id", EtiketController.getOzelUrunById);
router.post("/ozel-urun", EtiketController.saveOzelUrun);
router.delete("/ozel-urun/:id", EtiketController.deleteOzelUrun);
router.post("/ozel-urun/yazdirildi-isaretle", EtiketController.markOzelUrunYazdirildi);
// Etiket Şablonları (TODVZ_ETIKET_SABLON)
router.get("/sablon", EtiketController.listSablon);
router.get("/sablon/:id", EtiketController.getSablonById);
router.post("/sablon", EtiketController.saveSablon);
router.delete("/sablon/:id", EtiketController.deleteSablon);
export default router;
