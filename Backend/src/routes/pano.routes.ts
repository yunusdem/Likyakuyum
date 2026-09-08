import { Router } from "express";
import { PanoController } from "../controllers/pano.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", PanoController.getAllPanos);
router.get("/live", PanoController.getLiveBoardData);
router.get("/live/:id", PanoController.getLiveBoardData);
router.get("/:id", PanoController.getPanoById);
router.post("/kaydet", PanoController.savePano);
router.delete("/:id", PanoController.deletePano);

export default router;
