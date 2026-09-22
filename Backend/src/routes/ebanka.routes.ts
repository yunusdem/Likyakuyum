import { Router } from "express";
import { EBankaController } from "../controllers/ebanka.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

// F- e-Banka (Vomsis) — docs/EBANKA_VOMSIS_YOL_HARITASI.md
const router = Router();

router.use(authenticate);

// Ayarlar
router.get("/ayar", EBankaController.ayarGetir);
router.put("/ayar", EBankaController.ayarKaydet);
router.post("/baglanti-testi", EBankaController.baglantiTesti);
router.get("/log", EBankaController.logListele);

// Sistem denetimi: Vomsis hesabı olmadan sunucunun hazır olduğunu doğrular (denetim salt okunur; deneme fişi kesip hemen siler)
router.get("/denetim", EBankaController.denetim);
router.post("/denetim/deneme-fisi", EBankaController.denemeFisi);

// Eşitleme (yalnızca elle)
router.post("/esitle", EBankaController.esitle);

// Özet / Hesaplar / Hareketler
router.get("/ozet", EBankaController.ozet);
router.get("/hesaplar", EBankaController.hesaplariListele);
router.put("/hesaplar/:id/esle", EBankaController.hesapEsle);
router.get("/hareket-tipleri", EBankaController.hareketTipleri);
router.get("/hareketler", EBankaController.hareketleriListele);
router.get("/hareketler/:id", EBankaController.hareketGetir);

// Banka fişine aktarım / Bekleyenler
router.get("/bekleyenler", EBankaController.bekleyenler);
router.post("/aktarim/calistir", EBankaController.aktarimCalistir);
router.post("/aktarim/durum", EBankaController.aktarimDurumu);
router.post("/hareketler/:id/aktar", EBankaController.elleAktar);
router.get("/tip-kurallari", EBankaController.tipKurallari);
router.put("/tip-kurallari/:tipKodu", EBankaController.tipKuraliKaydet);
router.get("/cari-ara", EBankaController.cariAra);

// Fiziksel POS (yalnızca izleme + Excel dökümü + elle banka fişi)
router.get("/pos", EBankaController.posOzet);
router.post("/pos/esitle", EBankaController.posEsitle);
router.get("/pos/hareketler", EBankaController.posHareketleri);
router.get("/pos/excel", EBankaController.posExcel);
router.post("/pos/fis", EBankaController.posFisKes);

// Sanal POS: ödeme linkleri, işlemler, iptal/iade, Vomsis müşterileri (salt okunur)
router.get("/vpos/linkler", EBankaController.vposLinkler);
router.post("/vpos/linkler", EBankaController.vposLinkOlustur);
router.post("/vpos/linkler/guncelle", EBankaController.vposLinkleriGuncelle);
router.delete("/vpos/linkler/:uid", EBankaController.vposLinkSil);
router.get("/vpos/cari/:id", EBankaController.vposCariIletisim);
router.get("/vpos/islemler", EBankaController.vposIslemler);
router.post("/vpos/islemler/guncelle", EBankaController.vposIslemleriGuncelle);
router.get("/vpos/islemler/:ref", EBankaController.vposIslemDetayi);
router.post("/vpos/islemler/:ref/iptal-iade", EBankaController.vposIptalIade);
router.get("/vpos/musteriler", EBankaController.vposMusteriler);

// Sanal POS: kartla ödeme (3D Secure). Kart verisi saklanmaz; bkz. services/ebankaVposOdeme.service.ts
router.post("/vpos/taksitler", EBankaController.vposTaksitler);
router.post("/vpos/bin", EBankaController.vposBin);
router.post("/vpos/odeme", EBankaController.vposOdemeBaslat);
router.post("/vpos/odeme/:ref/sonuc", EBankaController.vposOdemeSonucu);

export default router;
