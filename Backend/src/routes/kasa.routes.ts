import { Router } from "express";
import { KasaController } from "../controllers/kasa.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

// Lookups
router.get("/lookups", KasaController.getLookups);
router.get("/user-vezne", KasaController.getUserVezne);

// Hesap Kartları
router.get("/hesaplar", KasaController.listHesaplar);
router.get("/hesaplar/:id", KasaController.getHesapById);
router.post("/hesaplar", KasaController.saveHesap);
router.delete("/hesaplar/:id", KasaController.deleteHesap);

// Hesap Hareketleri
router.get("/hareketler", KasaController.listHareketler);
router.get("/hareketler/:id", KasaController.getHareketById);
router.post("/hareketler", KasaController.saveHareket);
router.delete("/hareketler/:id", KasaController.deleteHareket);

export default router;
