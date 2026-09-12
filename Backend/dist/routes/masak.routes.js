import { Router } from "express";
import { MasakController } from "../controllers/masak.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
const router = Router();
// Rol kısıtı yok (karar #4): giriş yapmış her kullanıcı güncelleyebilir,
// kimin güncellediği TODVZ_MASAK_GUNCELLEME tablosuna yazılır.
router.use(authenticate);
router.get("/durum", MasakController.getDurum);
router.get("/liste", MasakController.getListe);
router.get("/sorgu", MasakController.sorgula);
router.get("/gecmis", MasakController.getGecmis);
router.get("/kayit/:id", MasakController.getKayit);
router.post("/guncelle", MasakController.guncelle);
// Yalnızca kullanıcı tanımlı listeler silinebilir; standart A/B/C/3AB servis tarafından reddedilir.
router.delete("/liste/:listeKod", MasakController.sil);
export default router;
