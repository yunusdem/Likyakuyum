import { Router } from "express";
import { AcikPanoController } from "../controllers/acikPano.controller.js";
// Pano Entegrasyonu açık veri uçları (docs/PANO_API_YOL_HARITASI.md). Oturum ve modül kapısı yok: anahtar adreste,
// firma/modül denetimi serviste (403). HTML sayfası app.ts'te API öneki dışında bağlanır.
const router = Router();
router.get("/pano/:anahtar.:bicim", AcikPanoController.veri);
export default router;
