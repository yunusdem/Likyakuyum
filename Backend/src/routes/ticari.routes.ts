import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { TicariController as C, ticariSistemYoneticisi, ticariYonetim } from "../controllers/ticari.controller.js";

/** Ticari İşlemler (docs/TICARI_ISLEMLER_YOL_HARITASI.md): stok kartı, giriş, satış fişi, raporlar */
const router = Router();
router.use(authenticate);

router.get("/yetki", C.yetki);

// Stok Ayarları: eksi stok davranışı ve yetkili kullanıcılar (sistem yöneticisi)
router.get("/ayarlar", ticariSistemYoneticisi, C.ayarlar);
router.put("/ayarlar", ticariSistemYoneticisi, C.ayarKaydet);

// Ürün grupları (okuma herkese; satış ekranı ve raporlar süzgeçte kullanır)
router.get("/gruplar", C.gruplar);
router.post("/gruplar", ticariYonetim, C.grupKaydet);
router.put("/gruplar/:id", ticariYonetim, C.grupKaydet);
router.delete("/gruplar/:id", ticariYonetim, C.grupSil);

// Stok kartları
router.get("/kartlar", C.kartlar);
router.get("/kartlar/:id", C.kart);
router.get("/kart-bul/:deger", C.kartBul);
router.post("/kartlar", ticariYonetim, C.kartKaydet);
router.put("/kartlar/:id", ticariYonetim, C.kartKaydet);
router.delete("/kartlar/:id", ticariYonetim, C.kartSil);

// Excel'den yükleme
router.get("/excel/ornek", ticariYonetim, C.excelOrnek);
router.post("/excel/onizle", ticariYonetim, C.excelOnizle);
router.post("/excel/yukle", ticariYonetim, C.excelYukle);

// Stok giriş fişi
router.get("/giris/sira-no", ticariYonetim, C.girisSiraNo);
router.get("/giris", ticariYonetim, C.girisListe);
router.get("/giris/:id", ticariYonetim, C.girisGetir);
router.post("/giris", ticariYonetim, C.girisKaydet);
router.put("/giris/:id", ticariYonetim, C.girisKaydet);
router.delete("/giris/:id", ticariYonetim, C.girisSil);

// Satış fişi
router.get("/satis/sira-no", C.satisSiraNo);
router.get("/satis/kimlikler", C.satisKimlikler);
router.get("/satis", C.satisListe);
router.get("/satis/:id", C.satisGetir);
router.post("/satis", C.satisKaydet);
router.put("/satis/:id", C.satisKaydet);
router.delete("/satis/:id", C.satisSil);

// Raporlar
router.get("/rapor/stok-durum", C.stokDurum);
router.get("/rapor/hareketler", C.hareketler);

export default router;
