import { Router } from "express";
import { BankaController } from "../controllers/banka.controller.js";
import { PosCihaziController } from "../controllers/posCihazi.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Tüm isteklerde oturum denetimi ve db context
router.use(authenticate);

// Lookups
router.get("/lookups", BankaController.getLookups);

// Banka Hesap Kartları
router.get("/hesaplar", BankaController.listBankalar);
router.get("/hesaplar/next-no", BankaController.getNextHesapNo);
router.get("/hesaplar/:id", BankaController.getBankaById);
router.post("/hesaplar", BankaController.saveBanka);
router.delete("/hesaplar/:id", BankaController.deleteBanka);

// Banka Hesap Hareketleri
router.get("/hareketler", BankaController.listHareketler);
router.get("/hareketler/:id", BankaController.getHareketById);
router.post("/hareketler", BankaController.saveHareket);
router.delete("/hareketler/:id", BankaController.deleteHareket);
router.post("/hareketler/:id/iptal", BankaController.toggleIptalHareket);

// POS Cihazı Tanımları
router.get("/pos-cihazlari", PosCihaziController.getPosCihazlari);
router.get("/pos-cihazlari/next-kod", PosCihaziController.getNextPosKod);
router.get("/pos-cihazlari/next-no", PosCihaziController.getNextPosKod);
router.get("/pos-cihazlari/:id", PosCihaziController.getPosCihaziById);
router.get("/pos-cihazlari/:id/bakiye", PosCihaziController.getPosCihaziBakiye);
router.post("/pos-cihazlari", PosCihaziController.savePosCihazi);
router.delete("/pos-cihazlari/:id", PosCihaziController.deletePosCihazi);

export default router;

