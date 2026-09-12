import { Router } from "express";
import { SarrafFisController } from "../controllers/sarrafFis.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", SarrafFisController.list);
router.get("/urunler", SarrafFisController.getUrunler);
router.get("/vezne-bakiye", SarrafFisController.getVezneBakiye);
router.get("/user-vezne", SarrafFisController.getUserVezne);
router.get("/:id", SarrafFisController.getById);
router.post("/", SarrafFisController.save);
router.delete("/:id", SarrafFisController.delete);
router.put("/:id/detay", SarrafFisController.saveDetay);

export default router;
