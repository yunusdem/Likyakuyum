import { Router } from "express";
import { TanimlarController } from "../controllers/tanimlar.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/tablo-maddesi", TanimlarController.getTabloMaddeleri);
router.post("/tablo-maddesi", TanimlarController.saveTabloMaddesi);
router.delete("/tablo-maddesi/:id", TanimlarController.deleteTabloMaddesi);

router.get("/ulkeler", TanimlarController.getUlkeler);
router.get("/uyruklar", TanimlarController.getUyruklar);
router.get("/iller", TanimlarController.getIller);
router.get("/ilceler", TanimlarController.getIlceler);
router.get("/posta-kodlari", TanimlarController.getPostaKodlari);
router.get("/vergi-daireleri", TanimlarController.getVergiDaireleri);
router.get("/meslekler", TanimlarController.getMeslekler);
router.get("/banka-hesaplari", TanimlarController.getBankaHesaplari);
router.get("/hukuki-yapilar", TanimlarController.getHukukiYapilar);

export default router;
