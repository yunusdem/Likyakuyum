import { Router } from "express";
import { VezneController } from "../controllers/vezne.controller.js";
import { VezneParaSayimController } from "../controllers/vezneParaSayim.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes are protected by authenticated user's JWT
router.use(authenticate);

// Para Sayım Endpoints
router.post("/para-sayim", VezneParaSayimController.saveSayim);
router.get("/para-sayim/son/:vezneId", VezneParaSayimController.getSonSayim);
router.get("/para-sayim/gecmis/:vezneId", VezneParaSayimController.getGecmisSayimlar);
router.get("/para-sayim/gecmis", VezneParaSayimController.getGecmisSayimlar);
router.get("/para-sayim/:id", VezneParaSayimController.getSayimById);
router.delete("/para-sayim/:id", VezneParaSayimController.deleteSayim);

router.get("/printers", VezneController.getPrinters);
router.get("/currencies", VezneController.getCurrencies);

router.get("/", VezneController.listVezneler);
router.post("/", VezneController.createVezne);
router.get("/:id", VezneController.getVezneById);
router.put("/:id", VezneController.updateVezne);
router.delete("/:id", VezneController.deleteVezne);

export default router;

