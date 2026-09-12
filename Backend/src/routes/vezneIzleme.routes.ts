import { Router } from "express";
import { VezneIzlemeController } from "../controllers/vezneIzleme.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", VezneIzlemeController.getIzlemeData);
router.get("/data", VezneIzlemeController.getIzlemeData);
router.post("/tanim", VezneIzlemeController.saveSettings);
router.post("/bakiye", VezneIzlemeController.updateBakiye);
router.post("/toplu-bakiye", VezneIzlemeController.saveAllBakiyeler);

export default router;

