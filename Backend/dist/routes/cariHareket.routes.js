import { Router } from "express";
import { CariHareketController } from "../controllers/cariHareket.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { kayitYetkisi, kimlikVar } from "../services/yetki/menuYetkiKatalogu.js";
const router = Router();
router.use(authenticate);
// Specific routes first to prevent conflicts with :id
router.get("/navigation/:id?", CariHareketController.getNavigation);
router.get("/bakiye/:cariKartId", CariHareketController.getCariBakiye);
router.get("/", CariHareketController.list);
router.post("/", kayitYetkisi("cariHareket", () => false), CariHareketController.create);
router.get("/:id", CariHareketController.getById);
router.put("/:id", kayitYetkisi("cariHareket", kimlikVar()), CariHareketController.update);
router.delete("/:id", kayitYetkisi("cariHareket", kimlikVar()), CariHareketController.delete);
export default router;
