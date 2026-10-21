import { Router } from "express";
import { PanoEntegrasyonController } from "../controllers/panoEntegrasyon.controller.js";
// Kur › Pano Entegrasyonu (docs/PANO_API_YOL_HARITASI.md). Modül kapısı routes/index.ts'te (kur:kur/pano-entegrasyonu),
// yönetici şartı denetleyicide.
const router = Router();
router.get("/", PanoEntegrasyonController.liste);
router.post("/:panoId/anahtar", PanoEntegrasyonController.uret);
router.delete("/:panoId/anahtar", PanoEntegrasyonController.iptal);
router.put("/:panoId/onbellek", PanoEntegrasyonController.onbellek);
export default router;
