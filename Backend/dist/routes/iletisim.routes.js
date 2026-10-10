import { Router } from "express";
import { IletisimController } from "../controllers/iletisim.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { iletisimFormSchema } from "../schemas/iletisim.schema.js";
// Tanıtım sitesi iletişim / ön bilgi formu (docs/ILETISIM_FORMU_YOL_HARITASI.md). Herkese açık; hız sınırı serviste (İ8).
const router = Router();
router.post("/form", validate(iletisimFormSchema), IletisimController.formGonder);
export default router;
