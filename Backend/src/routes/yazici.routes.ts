import { Router } from "express";
import { YaziciController } from "../controllers/yazici.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/direct-print", YaziciController.directPrint);
router.get("/system-printers", YaziciController.getSystemPrinters);
router.get("/", YaziciController.listYazicilar);
router.post("/", YaziciController.createYazici);
router.get("/usage/:id", YaziciController.getYaziciUsage);
router.get("/:id", YaziciController.getYaziciById);
router.put("/:id", YaziciController.updateYazici);
router.delete("/:id", YaziciController.deleteYazici);

export default router;
