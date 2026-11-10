import { Router } from "express";
import { VezneIzlemeController } from "../controllers/vezneIzleme.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { okumaYetkisi } from "../services/yetki/menuYetkiKatalogu.js";

const router = Router();

router.use(authenticate);

// Okuma: Vezne İzleme menü yetkisi (Y8)
router.get("/", okumaYetkisi("vezneIzleme"), VezneIzlemeController.getIzlemeData);
router.get("/data", okumaYetkisi("vezneIzleme"), VezneIzlemeController.getIzlemeData);
router.get("/stream", okumaYetkisi("vezneIzleme"), VezneIzlemeController.stream);
router.post("/tanim", VezneIzlemeController.saveSettings);
router.post("/bakiye", VezneIzlemeController.updateBakiye);
router.post("/toplu-bakiye", VezneIzlemeController.saveAllBakiyeler);

export default router;

