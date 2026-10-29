import { Router } from "express";
import { kayitYetkisi, kimlikVar } from "../services/yetki/menuYetkiKatalogu.js";
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
// Ticari etiket düzeni (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 2)
router.get("/etiket-duzeni", C.etiketDuzeni);
router.put("/etiket-duzeni", ticariYonetim, C.etiketDuzeniKaydet);

// Fiyat listeleri + cari ataması (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 11)
router.get("/fiyat-listeleri", C.fiyatListeleri);
router.post("/fiyat-listeleri", ticariYonetim, C.fiyatListesiKaydet);
router.put("/fiyat-listeleri/:id", ticariYonetim, C.fiyatListesiKaydet);
router.delete("/fiyat-listeleri/:id", ticariYonetim, C.fiyatListesiSil);
router.get("/fiyat-listeleri/:id/cariler", C.fiyatListesiCarileri);
router.get("/cari-fiyat-listesi/:id", C.cariFiyatListesi);
router.put("/cari-fiyat-listesi/:id", ticariYonetim, C.cariFiyatListesiKaydet);

// Toplu fiyat işlemleri (İş 11): stok yönetim yetkisi
router.post("/fiyat-islemi/onizle", ticariYonetim, C.fiyatIslemiOnizle);
router.post("/fiyat-islemi/uygula", ticariYonetim, C.fiyatIslemiUygula);
router.post("/fiyat-islemi/geri-al", ticariYonetim, C.fiyatIslemiGeriAl);
router.get("/fiyat-islemi/gecmis", ticariYonetim, C.fiyatIslemiGecmis);

// Kampanyalar (İş 11, G12): okuma herkese (satış ekranları), yazma stok yönetim yetkisine
router.get("/kampanyalar", C.kampanyalar);
router.get("/kampanyalar/aktif", C.aktifKampanyalar);
router.post("/kampanyalar", ticariYonetim, C.kampanyaKaydet);
router.put("/kampanyalar/:id", ticariYonetim, C.kampanyaKaydet);
router.delete("/kampanyalar/:id", ticariYonetim, C.kampanyaSil);

router.get("/gruplar", C.gruplar);
router.post("/gruplar", ticariYonetim, C.grupKaydet);
router.put("/gruplar/:id", ticariYonetim, C.grupKaydet);
router.delete("/gruplar/:id", ticariYonetim, C.grupSil);
router.put("/gruplar/:id/kartlar", ticariYonetim, C.grupKartlari);

// Stok kartları
router.get("/kartlar", C.kartlar);
router.get("/kartlar/sayfali", C.kartlarSayfali);
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
router.post("/giris", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.girisKaydet);
router.put("/giris/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.girisKaydet);
router.delete("/giris/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.girisSil);

// Satış fişi
router.get("/satis/sira-no", C.satisSiraNo);
router.get("/satis/kimlikler", C.satisKimlikler);
router.get("/satis", C.satisListe);
router.get("/satis/:id", C.satisGetir);
router.post("/satis", kayitYetkisi("ticari", kimlikVar()), C.satisKaydet);
router.put("/satis/:id", kayitYetkisi("ticari", kimlikVar()), C.satisKaydet);
router.delete("/satis/:id", kayitYetkisi("ticari", kimlikVar()), C.satisSil);

// Raporlar
router.get("/rapor/stok-durum", C.stokDurum);
router.get("/rapor/hareketler", C.hareketler);

export default router;
