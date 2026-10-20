import { Router } from "express";
import { KullaniciGorunumController } from "../controllers/kullaniciGorunum.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

/** Kullanıcı görünümü (docs/KULLANICI_GORUNUM_YOL_HARITASI.md): yöneticinin çalışana kapattığı modüller */
const router = Router();

router.use(authenticate);

router.get("/:kullaniciId", KullaniciGorunumController.oku);
router.put("/:kullaniciId", KullaniciGorunumController.kaydet);

export default router;
