import { Router } from "express";
import { CariHareketController } from "../controllers/cariHareket.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

// Specific routes first to prevent conflicts with :id
router.get("/navigation/:id?", CariHareketController.getNavigation);
router.get("/bakiye/:cariKartId", CariHareketController.getCariBakiye);

router.get("/", CariHareketController.list);
router.post("/", CariHareketController.create);
router.get("/:id", CariHareketController.getById);
router.put("/:id", CariHareketController.update);
router.delete("/:id", CariHareketController.delete);

export default router;
