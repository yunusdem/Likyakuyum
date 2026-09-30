import { Router } from "express";
import { GibController } from "../controllers/gib.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
// Bütün firmalar kullanır; her firma kendi GİB hesabıyla (docs/GIB_VKN_SORGU_YOL_HARITASI.md)
const router = Router();
router.use(authenticate);
router.get("/vkn-sorgu", GibController.vknSorgu);
router.get("/hesap", GibController.hesap);
router.put("/hesap", GibController.hesapKaydet);
router.delete("/hesap", GibController.hesapSil);
router.post("/hesap/dene", GibController.hesapDene);
export default router;
