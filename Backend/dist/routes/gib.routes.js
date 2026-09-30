import { Router } from "express";
import { GibController } from "../controllers/gib.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
// Bütün firmalar kullanır; modül kısıtı yoktur (docs/GIB_VKN_SORGU_YOL_HARITASI.md)
const router = Router();
router.use(authenticate);
router.get("/vkn-sorgu", GibController.vknSorgu);
export default router;
