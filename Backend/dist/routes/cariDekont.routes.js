import { Router } from "express";
import { CariDekontController } from "../controllers/cariDekont.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
const router = Router();
// Apply auth middleware if present
router.use(authenticate);
router.get("/", CariDekontController.getDekontList);
router.get("/:id", CariDekontController.getDekontById);
router.post("/kaydet", CariDekontController.saveDekont);
router.delete("/:id", CariDekontController.deleteDekont);
export default router;
