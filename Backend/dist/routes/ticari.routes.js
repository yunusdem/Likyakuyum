import { Router } from "express";
import { modulAcikMi, modulKapaliHatasi } from "../middlewares/modul.middleware.js";
import { kayitYetkisi, kimlikVar } from "../services/yetki/menuYetkiKatalogu.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { TicariController as C, ticariSistemYoneticisi, ticariYonetim } from "../controllers/ticari.controller.js";
/** Ticari İşlemler (docs/TICARI_ISLEMLER_YOL_HARITASI.md): stok kartı, giriş, satış fişi, raporlar */
const router = Router();
router.use(authenticate);
/**
 * Y12 (26.11.2026 denetimi, karar): /ticari öneki Adisyon lisansına da açıktır (Adisyon stok kartı / menü, adisyon fişi, iade, vardiya
 * kullanır). Ticari'ye özel işlemler — e-Faturadan stok girişi, parçalama, tedarikçiye iade, toplu Excel — Ticari lisansı ister.
 */
export const ticariLisansi = (req, _res, next) => {
    modulAcikMi(req, ["ticari", "ust:ticari"]).then((acik) => next(acik ? undefined : modulKapaliHatasi("Bu işlem Ticari lisansı ister (Adisyon lisansında yok)."))).catch(next);
};
router.use(["/excel", "/parcalama", "/tedarikci-iade", "/efatura-giris"], ticariLisansi);
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
// Parçalama fişi + şablon (TA17); sabit yollar :id'den önce
router.get("/parcalama/girdi-maliyeti", ticariYonetim, C.parcalamaGirdiMaliyeti);
router.get("/parcalama/sablon", ticariYonetim, C.parcalamaSablonlar);
router.post("/parcalama/sablon", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.parcalamaSablonKaydet);
router.put("/parcalama/sablon/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.parcalamaSablonKaydet);
router.delete("/parcalama/sablon/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.parcalamaSablonSil);
router.get("/parcalama", ticariYonetim, C.parcalamaListe);
router.get("/parcalama/:id", ticariYonetim, C.parcalamaGetir);
router.post("/parcalama", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.parcalamaKaydet);
router.put("/parcalama/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.parcalamaKaydet);
router.delete("/parcalama/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.parcalamaSil);
// Sayım fişi (TA11) ve fire / zayi fişi (TA12)
router.get("/sayim/kartlar", ticariYonetim, C.sayimKartlari);
router.get("/sayim", ticariYonetim, C.sayimListe);
router.get("/sayim/:id", ticariYonetim, C.sayimGetir);
router.post("/sayim", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.sayimKaydet);
router.put("/sayim/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.sayimKaydet);
router.post("/sayim/:id/onay", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.sayimOnayla);
router.post("/sayim/:id/geri-al", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.sayimGeriAl);
router.delete("/sayim/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.sayimSil);
router.get("/fire/nedenler", ticariYonetim, C.fireNedenleri);
router.get("/fire", ticariYonetim, C.fireListe);
router.get("/fire/:id", ticariYonetim, C.fireGetir);
router.post("/fire", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.fireKaydet);
router.put("/fire/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.fireKaydet);
router.delete("/fire/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.fireSil);
// Tedarikçiye iade (TA13)
router.get("/tedarikci-iade/kaynak/:id", ticariYonetim, C.tedIadeKaynak);
router.get("/tedarikci-iade", ticariYonetim, C.tedIadeListe);
router.get("/tedarikci-iade/:id/ebelge-taslagi", ticariYonetim, C.tedIadeTaslak);
router.post("/tedarikci-iade/:id/ebelge-taslagi", ticariYonetim, kayitYetkisi("ticari", () => true), C.tedIadeTaslakBagla);
router.get("/tedarikci-iade/:id", ticariYonetim, C.tedIadeGetir);
router.post("/tedarikci-iade", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.tedIadeKaydet);
router.delete("/tedarikci-iade/:id", ticariYonetim, kayitYetkisi("ticari", kimlikVar()), C.tedIadeSil);
// Gelen e-Faturadan stok girişi (TA14)
router.get("/efatura-giris/gelen", ticariYonetim, C.efGelenListe);
router.get("/efatura-giris/gelen/:uuid/onizle", ticariYonetim, C.efGelenOnizle);
router.post("/efatura-giris/gelen/:uuid", ticariYonetim, kayitYetkisi("ticari", () => false), C.efGelenAl);
router.post("/efatura-giris/xml/onizle", ticariYonetim, C.efXmlOnizle);
router.post("/efatura-giris/xml", ticariYonetim, kayitYetkisi("ticari", () => false), C.efXmlAl);
// Satış fişi
router.get("/satis/sira-no", C.satisSiraNo);
router.get("/satis/kimlikler", C.satisKimlikler);
router.get("/satis", C.satisListe);
router.get("/satis/:id", C.satisGetir);
router.post("/satis", kayitYetkisi("ticari", kimlikVar()), C.satisKaydet);
router.put("/satis/:id", kayitYetkisi("ticari", kimlikVar()), C.satisKaydet);
router.delete("/satis/:id", kayitYetkisi("ticari", kimlikVar()), C.satisSil);
// Satış iadesi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA6)
router.get("/iade/kaynak/:id", C.iadeKaynak);
router.post("/iade", kayitYetkisi("ticari", kimlikVar()), C.iadeKaydet);
router.get("/iade/:id/gider-taslagi", C.iadeGiderTaslagi);
router.get("/iade/:id", C.iadeGetir);
router.delete("/iade/:id", kayitYetkisi("ticari", kimlikVar()), C.iadeSil);
// Kasiyer vardiyası (docs/TICARI_ADISYON_YOL_HARITASI.md, TA8)
router.get("/vardiya/durum", C.vardiyaDurum);
router.post("/vardiya/ac", kayitYetkisi("ticari", () => false), C.vardiyaAc);
router.post("/vardiya/kapat", kayitYetkisi("ticari", () => false), C.vardiyaKapat);
router.get("/vardiya", C.vardiyaListe);
router.get("/vardiya/:id", C.vardiyaRapor);
// Gün sonu satış raporu (TA7)
router.get("/gun-sonu", C.gunSonu);
// Ortalama maliyet + kâr raporu (TA15)
router.get("/kar-raporu", ticariYonetim, C.karRaporu);
// SKT yaklaşanlar (TA16)
router.get("/skt-yaklasan", C.sktYaklasan);
// Raporlar
router.get("/rapor/stok-durum", C.stokDurum);
router.get("/rapor/hareketler", C.hareketler);
export default router;
