import { Router } from "express";
import { CariController } from "../controllers/cari.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { kayitYetkisi, kimlikVar } from "../services/yetki/menuYetkiKatalogu.js";

const router = Router();

router.use(authenticate);

router.get("/lookups", CariController.getLookups);
router.get("/", CariController.listCariKartlar);
router.post("/", kayitYetkisi("cariKart", () => false), CariController.createCariKart);
router.get("/:id", CariController.getCariKartById);
router.put("/:id", kayitYetkisi("cariKart", kimlikVar()), CariController.updateCariKart);
router.delete("/:id", kayitYetkisi("cariKart", kimlikVar()), CariController.deleteCariKart);


export default router;
