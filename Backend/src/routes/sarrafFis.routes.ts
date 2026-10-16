import { Router } from "express";
import { SarrafFisController } from "../controllers/sarrafFis.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { kayitYetkisi, kimlikVar } from "../services/yetki/menuYetkiKatalogu.js";

const router = Router();

router.use(authenticate);

router.get("/", SarrafFisController.list);
router.get("/urunler", SarrafFisController.getUrunler);
router.get("/vezne-bakiye", SarrafFisController.getVezneBakiye);
router.get("/user-vezne", SarrafFisController.getUserVezne);
router.get("/:id", SarrafFisController.getById);
router.post("/", kayitYetkisi("sarraf", kimlikVar("sarrafFisiId")), SarrafFisController.save);
router.delete("/:id", kayitYetkisi("sarraf", kimlikVar()), SarrafFisController.delete);
router.put("/:id/detay", kayitYetkisi("sarraf", () => true), SarrafFisController.saveDetay);

export default router;
