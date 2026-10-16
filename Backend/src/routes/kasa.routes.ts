import { Router } from "express";
import { KasaController } from "../controllers/kasa.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { kayitYetkisi, kimlikVar } from "../services/yetki/menuYetkiKatalogu.js";

const router = Router();

router.use(authenticate);

// Lookups
router.get("/lookups", KasaController.getLookups);
router.get("/user-vezne", KasaController.getUserVezne);

// Hesap Kartları
router.get("/hesaplar", KasaController.listHesaplar);
router.get("/hesaplar/:id", KasaController.getHesapById);
router.post("/hesaplar", kayitYetkisi("kasaHesap", kimlikVar("hesapId")), KasaController.saveHesap);
router.delete("/hesaplar/:id", kayitYetkisi("kasaHesap", kimlikVar()), KasaController.deleteHesap);

// Hesap Hareketleri
router.get("/hareketler", KasaController.listHareketler);
router.get("/hareketler/:id", KasaController.getHareketById);
router.post("/hareketler", kayitYetkisi("kasaHareket", kimlikVar("hesapHareketiId")), KasaController.saveHareket);
router.delete("/hareketler/:id", kayitYetkisi("kasaHareket", kimlikVar()), KasaController.deleteHareket);

export default router;
