import { Router } from "express";
import { BankaController } from "../controllers/banka.controller.js";
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
export default router;
