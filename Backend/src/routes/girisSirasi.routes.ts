import { Router } from "express";
import { GirisSirasiController } from "../controllers/girisSirasi.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", GirisSirasiController.hepsi);
router.put("/:ekran", GirisSirasiController.kaydet);
router.delete("/:ekran", GirisSirasiController.sifirla);

export default router;
