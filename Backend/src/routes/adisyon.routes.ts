import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { AdisyonController as C, adisyonYonetici } from "../controllers/adisyon.controller.js";

/** Adisyon (docs/TICARI_ADISYON_YOL_HARITASI.md): masa / garson / mutfak. Garson adresi (/garson) ayrı kimlikle D4'te. */
const router = Router();
router.use(authenticate);

// Ayarlar (D1): okuma herkese (sipariş ekranları KDV / servis ücretini kullanır), yazma sistem yöneticisi
router.get("/ayarlar", C.ayarlar);
router.put("/ayarlar", adisyonYonetici, C.ayarKaydet);

// Tanımlar (D2): okuma herkese (masa / sipariş ekranları), yazma sistem yöneticisi
router.get("/tanim/bolgeler", C.bolgeler);
router.post("/tanim/bolge", adisyonYonetici, C.bolgeKaydet);
router.put("/tanim/bolge/:id", adisyonYonetici, C.bolgeKaydet);
router.delete("/tanim/bolge/:id", adisyonYonetici, C.bolgeSil);
router.post("/tanim/masa/toplu", adisyonYonetici, C.masaTopluEkle);
router.post("/tanim/masa", adisyonYonetici, C.masaKaydet);
router.put("/tanim/masa/:id", adisyonYonetici, C.masaKaydet);
router.delete("/tanim/masa/:id", adisyonYonetici, C.masaSil);
router.get("/tanim/yerler", C.yerler);
router.post("/tanim/yer", adisyonYonetici, C.yerKaydet);
router.put("/tanim/yer/:id", adisyonYonetici, C.yerKaydet);
router.delete("/tanim/yer/:id", adisyonYonetici, C.yerSil);
router.get("/tanim/grup-yer", C.grupYerleri);
router.put("/tanim/grup-yer", adisyonYonetici, C.grupYerKaydet);
router.get("/tanim/secenekler", C.secenekler);
router.post("/tanim/secenek", adisyonYonetici, C.secenekKaydet);
router.put("/tanim/secenek/:id", adisyonYonetici, C.secenekKaydet);
router.delete("/tanim/secenek/:id", adisyonYonetici, C.secenekSil);
router.get("/tanim/kart/:id", C.kartAyrintisi);
router.put("/tanim/kart/:id", adisyonYonetici, C.kartAyrintisiKaydet);
router.get("/tanim/garsonlar", adisyonYonetici, C.garsonlar);
router.get("/tanim/garson-kullanicilari", adisyonYonetici, C.garsonKullanicilari);
// Masa QR kodları (§11 M4): liste (eksikler üretilir) / bir masanın kodunu yenile
router.get("/tanim/masa-qr", adisyonYonetici, C.masaQr);
router.post("/tanim/masa/:id/qr", adisyonYonetici, C.masaQrYenile);
router.post("/tanim/garson", adisyonYonetici, C.garsonKaydet);
router.put("/tanim/garson/:id", adisyonYonetici, C.garsonKaydet);
router.delete("/tanim/garson/:id", adisyonYonetici, C.garsonSil);

// Masa / sipariş (D3): Adisyon lisansı olan her kullanıcı (kapı /adisyon); ikram / iptal / taşıma yetkileri D6'da
router.get("/olaylar", C.olaylar);
router.get("/masalar", C.masalar);
router.get("/menu", C.menu);
router.get("/kayit/:id", C.getir);
router.post("/siparis", C.siparis);
router.put("/kayit/:id/kisi", C.kisi);
router.post("/kalem/servis", C.kalemServis);

// Masa işlemleri (D6): yetki PC kullanıcısının seviyesine göre (yönetici: hepsi; öbürleri: kasiyer)
router.get("/yetkilerim", C.yetkilerim);
router.post("/kayit/:id/ikram", C.ikram);
router.post("/kayit/:id/iptal", C.iptal);
router.post("/kayit/:id/adisyon-iptal", C.adisyonIptal);
router.post("/kayit/:id/masa-tasi", C.masaTasi);
router.post("/kayit/:id/birlestir", C.birlestir);
router.post("/kayit/:id/urun-tasi", C.urunTasi);

// Raporlar / gün sonu (D10): ciro / ödeme / ürün / garson / ikram-iptal / servis dağıtımı / açık adisyonlar; açık adisyon özeti (gün sonu uyarısı)
router.get("/rapor", adisyonYonetici, C.rapor); // karar K6: rapor yalnız yönetici
router.get("/acik-ozet", C.acikOzet);

// Paket servis / gel-al (D8): açılış POST /siparis gövdesinde "paket" ile; liste, durum (hazırlanıyor → yolda → teslim), müşteri düzeltme / arama
router.get("/paketler", C.paketler);
// M14: telefon adres satırında (sorgu dizesinde) gitmez — sunucu / vekil günlüklerine düşmesin; gövdeyle POST
router.post("/paket-musteri", C.paketMusteri);
router.post("/kayit/:id/paket-durum", C.paketDurum);
router.put("/kayit/:id/paket", C.paketGuncelle);

// Hesap / tahsilat (D7): hesap iste, ara ödeme (eşit / tutar), toplu kapat, ürün seçerek öde → Ticari satış fişi
router.get("/kayit/:id/hesap", C.hesap);
router.post("/kayit/:id/hesap-iste", C.hesapIste);
// Misafir PIN'i (§11 M2–M3): sipariş yetkisi olan kasa kullanıcısı görür / yeniler
router.post("/kayit/:id/misafir-pin", C.misafirPin);
router.post("/kayit/:id/odeme", C.odemeEkle);
router.delete("/odeme/:id", C.odemeSil);
router.post("/kayit/:id/kapat", C.kapat);
router.post("/kayit/:id/urun-ode", C.urunleOde);
router.post("/kayit/:id/secim-tutari", C.secimTutari);
// İndirim / kalem fiyatı / kapanmış adisyonu yeniden açma (K1, TA25)
router.post("/kayit/:id/indirim", C.indirim);
router.post("/kayit/:id/fiyat", C.fiyatDegistir);
router.post("/kayit/:id/yeniden-ac", C.yenidenAc);
router.get("/kapananlar", adisyonYonetici, C.kapananlar);

// Mutfak (D5): yazıcı istasyonu (kasa PC) fiş kuyruğu, mutfak ekranı (PC'den bütün yerler), KDS bağlantı anahtarı (yönetici)
router.post("/mutfak/fisler/al", C.mutfakFisleriAl);
router.post("/mutfak/fis/:id/sonuc", C.mutfakFisSonucu);
router.get("/mutfak/fisler", C.mutfakBekleyen);
router.post("/mutfak/fis/:id/yeniden", C.mutfakFisYeniden);
router.get("/mutfak/siparisler", C.mutfakSiparisler);
router.post("/mutfak/hazir", C.mutfakHazir);
router.post("/tanim/yer/:id/ekran-anahtari", adisyonYonetici, C.ekranAnahtari);
router.delete("/tanim/yer/:id/ekran-anahtari", adisyonYonetici, C.ekranAnahtariSil);

export default router;
