import { Router } from "express";
import { PosController } from "../controllers/pos.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

// POS cihazı entegrasyonu (Inpos + Beko) — docs/POS_ENTEGRASYON_YOL_HARITASI.md
const router = Router();

router.use(authenticate);

// Fiş ekranları: firmanın modu ve veznenin kullanabildiği cihazlar
router.get("/durum", PosController.durum);

// Cihaz tanımları (fiziksel cihaz, vezneleri, banka → muhasebe POS kartı eşlemesi)
router.get("/tanimlar", PosController.tanimlar);
router.post("/terminaller", PosController.terminalKaydet);
router.delete("/terminaller/:id", PosController.terminalSil);
router.post("/terminaller/:id/baglanti-testi", PosController.baglantiTesti);
router.post("/terminaller/:id/gun-sonu", PosController.gunSonu);
router.put("/banka-eslemeleri", PosController.bankaEslemeleriniYaz);

// Tahsilat
router.get("/islemler", PosController.liste);
router.post("/islemler", PosController.baslat);
router.post("/islemler/toplu", PosController.baslatToplu);
router.post("/islemler/elle-alindi", PosController.elleAlindi);
router.post("/islemler/belgeye-bagla", PosController.belgeyeBagla);
router.get("/islemler/belge", PosController.belgeIslemleri);
router.get("/islemler/:id", PosController.getir);
router.post("/islemler/:id/iptal", PosController.iptal);
router.post("/islemler/:id/elle", PosController.elleIsaretle);
router.post("/islemler/:id/iade", PosController.iadeIsaretle);

export default router;
