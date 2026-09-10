import { Router } from "express";
import { EbelgeController } from "../controllers/ebelge.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";
import { UserRole } from "../constants/roles.js";

const router = Router();

router.use(authenticate);
router.get("/kaynak", EbelgeController.kaynakListe);
router.post("/kaynak/hazirla", EbelgeController.kaynakHazirla);
router.post("/kaynak/gonder", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), EbelgeController.kaynakGonder);
router.get("/doviz/:uuid/durum", EbelgeController.dovizDurum);
router.get("/doviz/:uuid/pdf", EbelgeController.dovizPdf);
router.post("/doviz/:uuid/iptal", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), EbelgeController.dovizIptal);

/**
 * YETKİ NOTU (10.09.2026 — kullanıcı kararı)
 *
 * e-Belge uçlarının tamamı `admin`, `manager` ve **`cashier`** rollerine açıktır.
 * Bu, kasiyerin ayarları değiştirebileceği ve **GİB'e belge gönderebileceği** anlamına gelir;
 * gönderim ve kabul/red işlemleri geri alınamaz.
 *
 * Bu bilinçli bir karardır: "kasiyer de görsün, her şey açık olsun" (kullanıcı talebi).
 * Daraltmak gerekirse `authorizeRoles` çağrılarından `UserRole.CASHIER` çıkarılır.
 *
 * `user` rolü hâlâ kısıtlıdır — talep yalnızca kasiyer içindi.
 */

// Bağlantı ayarları — entegratör kimlik bilgileri burada tutulur.
router.get("/ayar", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), EbelgeController.getAyar);
router.put("/ayar", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), EbelgeController.saveAyar);
router.post("/ayar/test", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), EbelgeController.testBaglanti);

router.get("/kontor", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), EbelgeController.getKontor);
router.get("/log", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), EbelgeController.getLogs);

// Gelen kutusu — okuma uçları, giriş yapmış her kullanıcıya açık.
// (Kabul/red gibi mali sonuç doğuran işlemler Faz 4'te ayrı yetkiyle eklenecek.)
router.post("/gelen/senkronize", EbelgeController.senkronizeGelen);
router.get("/gelen", EbelgeController.listGelen);
router.get("/gelen/:uuid/goruntu", EbelgeController.getGelenGoruntu);
router.get("/gelen/:uuid", EbelgeController.getGelenDetay);

// Kabul / red — GERİ ALINAMAZ, mali sonuç doğurur. Ayrı yetki isteniyor.
router.post(
  "/gelen/:uuid/cevap",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.gelenCevapVer
);
// Okundu / işlendi işaretleme — mali sonuç doğurmaz, her kullanıcı yapabilir.
router.post("/gelen/:uuid/statu", EbelgeController.gelenStatuIsle);

// Giden belge doğrulama — belge GÖNDERİLMEZ, yalnızca şema/schematron kontrolü.
router.post("/giden/dogrula", EbelgeController.dogrulaGidenBelge);
router.get("/giden/son-belge-no", EbelgeController.getSonBelgeNo);
router.get("/mukellef", EbelgeController.mukellefSorgula);
router.get("/giden", EbelgeController.listGiden);

// Taslak oluşturma / iptal — ICE'de kayıt oluşturur ama GİB'e GİTMEZ.
// Onay (DraftApproval) ucu Faz 6'da BİLEREK açılmamıştır; belge GİB'e gönderilmez.
router.post(
  "/giden/taslak",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.taslakGonder
);
router.post(
  "/giden/:uuid/iptal",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.taslakIptal
);

// e-Fatura GERÇEK GÖNDERİMİ (Faz 7) — belge GİB'e gider, GERİ ALINAMAZ.
router.post(
  "/giden/gonder",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.faturaGonder
);
router.post(
  "/giden/:uuid/onayla",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.taslakOnayla
);
router.get("/giden/:uuid/statu", EbelgeController.gidenStatuYenile);

// Belgeyi alıcıya e-posta ile gönderir — tekrar çağrılırsa yeniden mail gider.
router.post(
  "/giden/:uuid/mail",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.belgeMailGonder
);

/* ------------------------------------------------------------------ e-İrsaliye (Faz 9) */
// Okuma ve doğrulama uçları — belge göndermez
router.post("/irsaliye/dogrula", EbelgeController.irsaliyeDogrula);
router.get("/irsaliye/mukellef", EbelgeController.irsaliyeMukellef);
router.get("/irsaliye/statu", EbelgeController.irsaliyeStatu);
router.get("/irsaliye", EbelgeController.irsaliyeListe);
router.get("/irsaliye/:ettn/pdf", EbelgeController.irsaliyePdf);

// Gönderim — GİB'e gider, GERİ ALINAMAZ
router.post(
  "/irsaliye/gonder",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.irsaliyeGonder
);

// e-Arşiv — MALİ SONUÇ DOĞURUR. Gönderim ve iptal yalnızca yetkili rollerde.
// Arşiv listeleme/senkronizasyon okuma; işaretleme belge kesmez veya iptal etmez.
router.get("/earsiv/arsiv", EbelgeController.earsivArsivListe);
router.post("/earsiv/arsiv/senkronize", EbelgeController.earsivArsivSenkronize);
router.post("/earsiv/arsiv/:uuid/statu", EbelgeController.earsivArsivStatu);
router.post(
  "/earsiv/gonder",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.earsivGonder
);
router.post(
  "/earsiv/:uuid/iptal",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.earsivIptal
);
router.get("/earsiv/durum", EbelgeController.earsivDurum);
router.get("/earsiv/:uuid/pdf", EbelgeController.earsivPdf);

// e-Gider Pusulası — MALİ SONUÇ DOĞURUR ve ICE'de ön doğrulama ucu YOKTUR.
// Vergi mükellefi olmayan kişiden alımda düzenlenir (kuyumcuda hurda altın alımı).
router.post(
  "/gider-pusulasi/gonder",
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER),
  EbelgeController.giderPusulasiGonder
);
router.get("/gider-pusulasi/:uuid/pdf", EbelgeController.giderPusulasiPdf);
router.post("/gider-pusulasi/onizle", EbelgeController.giderPusulasiOnizle);

// e-Müstahsil: doğrulama mali sonuç doğurmaz; gönderim ve iptal geri alınamaz işlemlerdir.
router.post("/mustahsil/dogrula", EbelgeController.mustahsilDogrula);
router.post("/mustahsil/gonder", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), EbelgeController.mustahsilGonder);
router.post("/mustahsil/:uuid/iptal", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), EbelgeController.mustahsilIptal);
router.get("/mustahsil/gelen", EbelgeController.mustahsilGelen);
router.post("/mustahsil/gelen/:uuid/statu", EbelgeController.mustahsilGelenStatu);

export default router;
