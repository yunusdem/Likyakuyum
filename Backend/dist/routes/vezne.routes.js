import { Router } from "express";
import { VezneController } from "../controllers/vezne.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
const router = Router();
// All routes are protected by authenticated user's JWT
router.use(authenticate);
router.get("/printers", VezneController.getPrinters);
router.get("/currencies", VezneController.getCurrencies);
router.get("/", VezneController.listVezneler);
router.post("/", VezneController.createVezne);
router.get("/:id", VezneController.getVezneById);
router.put("/:id", VezneController.updateVezne);
router.delete("/:id", VezneController.deleteVezne);
export default router;
