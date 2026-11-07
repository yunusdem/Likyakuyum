import { Router } from "express";
import { MobilYonetimController as C } from "../controllers/mobilYonetim.controller.js";
// Firma tarafı mobil tanımları (docs/MOBIL_CARI_YOL_HARITASI.md, Faz 2). Kimlik + modül kapısı routes/index.ts'te
// (authenticate + mobilModulKapisi), yönetici şartı serviste.
const router = Router();
router.get("/durum", C.durum);
// Mobil Emirler (personel): onay / ret
router.get("/emirler", C.emirler);
router.get("/emirler/ozet", C.emirOzeti);
router.get("/emirler/:id/onizleme", C.emirOnizleme);
router.post("/emirler/:id/onayla", C.emirOnayla);
router.post("/emirler/:id/reddet", C.emirReddet);
router.get("/kullanicilar", C.kullanicilar);
router.post("/kullanicilar", C.kullaniciEkle);
router.put("/kullanicilar/:id", C.kullaniciGuncelle);
router.post("/kullanicilar/:id/sifre-sifirla", C.sifreSifirla);
router.post("/kullanicilar/:id/erisim", C.erisimEkle);
router.put("/erisim/:id", C.erisimGuncelle);
router.delete("/erisim/:id", C.erisimSil);
router.get("/cari/:id", C.cari);
router.put("/cari/:id/ayar", C.cariAyarYaz);
router.get("/veritabanlari/:id/cariler", C.veritabaniCariAra);
router.get("/ayarlar", C.ayar);
router.put("/ayarlar", C.ayarYaz);
router.get("/urunler", C.urunler);
router.put("/urunler", C.urunSecimiYaz);
router.get("/katalog", C.katalog);
router.get("/katalog/ara", C.katalogAra);
router.put("/katalog", C.katalogYaz);
router.get("/cari/:id/makas", C.cariMakas);
router.put("/cari/:id/makas", C.cariMakasYaz);
export default router;
