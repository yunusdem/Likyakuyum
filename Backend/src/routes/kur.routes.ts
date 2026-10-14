import { Router } from "express";
import { KurController } from "../controllers/kur.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/tablo", KurController.getTablo);
router.post("/kaydet", KurController.saveTablo);
router.post("/sakla", KurController.sakla);
router.get("/tarihler", KurController.getStoredDates);
router.delete("/tablo/:id", KurController.deleteTablo);
router.get("/tcmb", KurController.fetchTcmb);
router.get("/kaynaklar", KurController.kaynaklar);
router.put("/kaynak-secili", KurController.seciliKaydet);
router.get("/kaynak", KurController.kaynaktanCek);
router.get("/kaynak/:kaynak", KurController.kaynaktanCek);
router.get("/komisyon", KurController.komisyonlar);
router.put("/komisyon", KurController.komisyonKaydet);

export default router;
