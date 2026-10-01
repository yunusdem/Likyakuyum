import { Router } from "express";
import { PiyasaController } from "../controllers/piyasa.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
// Herkes görür: modül kapısı yok, yalnız oturum gerekir.
const router = Router();
router.use(authenticate);
router.get("/", PiyasaController.anlik);
export default router;
