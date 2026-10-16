import { Router } from "express";
import { CariDekontController } from "../controllers/cariDekont.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { kayitYetkisi, kimlikVar } from "../services/yetki/menuYetkiKatalogu.js";
const router = Router();
// Apply auth middleware if present
router.use(authenticate);
router.get("/", CariDekontController.getDekontList);
router.get("/:id", CariDekontController.getDekontById);
router.post("/kaydet", kayitYetkisi("cariDekont", kimlikVar("cariDekontId")), CariDekontController.saveDekont);
router.delete("/:id", kayitYetkisi("cariDekont", kimlikVar()), CariDekontController.deleteDekont);
export default router;
