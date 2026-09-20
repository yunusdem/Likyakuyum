import { Router } from "express";
import { AdminAuthController } from "../controllers/admin/adminAuth.controller.js";
import { AdminYonetimController } from "../controllers/admin/adminYonetim.controller.js";
import { FirmaController } from "../controllers/admin/firma.controller.js";
import { KullaniciController } from "../controllers/admin/kullanici.controller.js";
import { ModulController } from "../controllers/admin/modul.controller.js";
import { IzlemeController } from "../controllers/admin/izleme.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  adminKapisi,
  adminAuthenticate,
  adminGirisSiniri,
  sifreBelirlenmisOlmali,
  adminHataIsleyici,
} from "../middlewares/adminAuth.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import {
  adminGirisSchema,
  adminSifreDegistirSchema,
  adminEkleSchema,
  adminGuncelleSchema,
  adminIdSchema,
  firmaEkleSchema,
  firmaGuncelleSchema,
  firmaDurumSchema,
  firmaDogrulamaSchema,
  lisansEkleSchema,
  kullaniciEkleSchema,
  kullaniciGuncelleSchema,
  modulKatalogSchema,
  firmaModulSchema,
  girisLogSchema,
  islemLogSchema,
  oturumKapatSchema,
} from "../schemas/admin.schema.js";

// Ana admin paneli API'si (docs/ADMIN_PANEL_YOL_HARITASI.md). Kullanıcı tarafının authenticate'i burada kullanılmaz.
const router = Router();

router.use(adminKapisi);

// Açık uç
router.post("/auth/login", adminGirisSiniri, validate(adminGirisSchema), AdminAuthController.giris);

// Buradan sonrası admin oturumu ister
router.use(adminAuthenticate);

router.post("/auth/logout", AdminAuthController.cikis);
router.get("/auth/me", AdminAuthController.ben);
router.post("/auth/sifre-degistir", validate(adminSifreDegistirSchema), AdminAuthController.sifreDegistir);

// Buradan sonrası şifresini belirlemiş admin ister
router.use(sifreBelirlenmisOlmali);

router.get("/adminler", AdminYonetimController.listele);
router.post("/adminler", validate(adminEkleSchema), AdminYonetimController.ekle);
router.put("/adminler/:id", validate(adminGuncelleSchema), AdminYonetimController.guncelle);
router.post("/adminler/:id/sifre-sifirla", validate(adminIdSchema), AdminYonetimController.sifreSifirla);

router.get("/ozet", FirmaController.ozet);

router.get("/firmalar", FirmaController.listele);
router.post("/firmalar", validate(firmaEkleSchema), FirmaController.ekle);
router.get("/firmalar/:id", validate(adminIdSchema), FirmaController.getir);
router.put("/firmalar/:id", validate(firmaGuncelleSchema), FirmaController.guncelle);
router.put("/firmalar/:id/durum", validate(firmaDurumSchema), FirmaController.durum);
router.put("/firmalar/:id/dogrulama", validate(firmaDogrulamaSchema), FirmaController.dogrulama);
router.post("/firmalar/:id/db-test", validate(adminIdSchema), FirmaController.dbTest);
router.post("/firmalar/:id/masak-kontrol", validate(adminIdSchema), FirmaController.masakKontrol);
router.get("/firmalar/:id/lisanslar", validate(adminIdSchema), FirmaController.lisanslar);
router.post("/firmalar/:id/lisanslar", validate(lisansEkleSchema), FirmaController.lisansEkle);

router.get("/kullanicilar", KullaniciController.tumu);
router.put("/kullanicilar/:id", validate(kullaniciGuncelleSchema), KullaniciController.guncelle);
router.post("/kullanicilar/:id/sifre-sifirla", validate(adminIdSchema), KullaniciController.sifreSifirla);
router.get("/firmalar/:id/kullanicilar", validate(adminIdSchema), KullaniciController.firmaKullanicilari);
router.post("/firmalar/:id/kullanicilar", validate(kullaniciEkleSchema), KullaniciController.ekle);
router.post("/firmalar/:id/kullanicilar/ice-aktar", validate(adminIdSchema), KullaniciController.iceAktar);

router.get("/moduller", ModulController.katalog);
router.put("/moduller/katalog", validate(modulKatalogSchema), ModulController.katalogEsitle);
router.get("/firmalar/:id/moduller", validate(adminIdSchema), ModulController.firmaAyari);
router.put("/firmalar/:id/moduller", validate(firmaModulSchema), ModulController.firmaAyariniYaz);

router.get("/izleme/cevrimici", IzlemeController.cevrimici);
router.get("/izleme/giris-log", validate(girisLogSchema), IzlemeController.girisLoglari);
router.get("/izleme/islem-log", validate(islemLogSchema), IzlemeController.islemLoglari);
router.post("/izleme/oturumlar/:sid/kapat", validate(oturumKapatSchema), IzlemeController.oturumuKapat);
router.post("/firmalar/:id/oturumlari-kapat", validate(adminIdSchema), IzlemeController.firmaOturumlariniKapat);

// Bilinmeyen admin yolları ve tüm admin hataları burada biter (genel hata işleyicisine düşmez)
router.use((req, res, next) => next(ApiError.notFound("Endpoint bulunamadı.")));
router.use(adminHataIsleyici);

export default router;
