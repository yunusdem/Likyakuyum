import { Router } from "express";
import { YaziciController } from "../controllers/yazici.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Public / Workstation agent endpoints (no JWT required so local scripts can register & fetch)
router.post("/register-client-printers", YaziciController.registerClientPrinters);
router.get("/client-printers", YaziciController.getClientPrinters);
router.get("/agent-script", YaziciController.getAgentScript);
router.get("/print-jobs", YaziciController.getPendingPrintJobs);
router.post("/print-jobs/:id/complete", YaziciController.completePrintJob);

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
