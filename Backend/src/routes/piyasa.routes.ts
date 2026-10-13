import { Router } from "express";
import { PiyasaController } from "../controllers/piyasa.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

// Modül kapısı routes/index.ts'te (ust:piyasa); yönetim panelinden firmaya kapatılabilir.
const router = Router();

router.use(authenticate);

router.get("/", PiyasaController.anlik);

export default router;
