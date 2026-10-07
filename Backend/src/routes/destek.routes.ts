import { Router } from "express";
import { DestekController } from "../controllers/destek.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  bayrakSchema,
  destekIdSchema,
  destekListeSchema,
  mesajYazSchema,
  okunduSchema,
  talepAcSchema,
} from "../schemas/destek.schema.js";

// Kullanıcı uygulaması: Destek (talep) + bildirimler (docs/DESTEK_VE_BILDIRIM_YOL_HARITASI.md, 4). Modül kısıtına bağlı değil (K18).
const router = Router();
router.use(authenticate);

router.get("/ozet", DestekController.ozet);
router.get("/konular", validate(destekListeSchema), DestekController.konular);
router.get("/konular/:id", validate(destekIdSchema), DestekController.konu);
router.post("/talepler", validate(talepAcSchema), DestekController.talepAc);
router.post("/konular/:id/mesajlar", validate(mesajYazSchema), DestekController.mesajYaz);
router.post("/okundu", validate(okunduSchema), DestekController.okundu);
router.post("/konular/:id/arsiv", validate(bayrakSchema), DestekController.arsiv);
router.post("/konular/:id/onemli-okundu", validate(destekIdSchema), DestekController.onemliOkundu);
router.get("/ek/:id", validate(destekIdSchema), DestekController.ek);

export default router;
