import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { HizliSatisController as C, hizliSatisYonetici } from "../controllers/hizliSatis.controller.js";

/** Hızlı Satış (docs/HIZLI_SATIS_YOL_HARITASI.md): buton düzeni, ayarlar, fiş işareti. Satış her modülün kendi API'siyle. */
const router = Router();
router.use(authenticate);

router.get("/yetki", C.yetki);

router.get("/duzen/:modul", C.duzen);
router.put("/duzen/:modul", hizliSatisYonetici, C.duzenKaydet);

router.get("/ayarlar", hizliSatisYonetici, C.ayarlar);
router.put("/ayarlar", hizliSatisYonetici, C.ayarKaydet);

router.get("/alici/:no", C.alici);

router.post("/isaretle", C.isaretle);
router.post("/isaretliler", C.isaretliler);
router.get("/fisler/:modul", C.fisler);

// Bekleyen sepetler (beklemeye al / geri çağır)
router.get("/bekleyen/liste/:modul", C.bekleyenler);
router.get("/bekleyen/:id", C.bekleyenGetir);
router.post("/bekleyen", C.bekleyenKaydet);
router.delete("/bekleyen/:id", C.bekleyenSil);

export default router;
