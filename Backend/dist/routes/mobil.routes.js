import { Router } from "express";
import { MobilController as C } from "../controllers/mobil.controller.js";
import { mobilAuthenticate, mobilGirisSiniri, mobilKapisi, mobilSifreBelirlenmis, mobilVeritabaniSecili, mobilYetki } from "../middlewares/mobilAuth.middleware.js";
// Mobil cari uçları (mobil.likyaerp.com, docs/MOBIL_CARI_YOL_HARITASI.md). Personel token'ı burada geçmez; mobil token'ı
// personel uçlarında geçmez (ayrı giz).
const router = Router();
router.use(mobilKapisi);
router.get("/giris-bilgisi", C.girisBilgisi);
router.post("/giris", mobilGirisSiniri, C.giris);
router.use(mobilAuthenticate);
router.get("/ben", C.ben);
router.post("/sifre", C.sifreDegistir);
router.post("/cikis", C.cikis);
router.post("/veritabani", C.veritabaniSec);
// Veri uçları: şifre belirlenmiş + veritabanı seçili + ilgili yetki (K10)
router.use(mobilSifreBelirlenmis, mobilVeritabaniSecili);
router.get("/fiyatlar", mobilYetki("fiyat", "Fiyat görme yetkiniz yok."), C.fiyatlar);
router.get("/bakiye", mobilYetki("bakiye", "Bakiye görme yetkiniz yok."), C.bakiye);
router.get("/dokum", mobilYetki("dokum", "Hesap dökümü yetkiniz yok."), C.dokum);
router.get("/belgeler", mobilYetki("dokum", "Hesap dökümü yetkiniz yok."), C.belgeler);
router.get("/belge/:tur/:id.pdf", mobilYetki("dokum", "Hesap dökümü yetkiniz yok."), C.belgePdf);
// Emir (K17): yön yetkisi (alış / satış) serviste denetlenir; ekran bilgisi ikisinden biri açıksa
const emirYetkisi = (req, _res, next) => req.mobil?.erisim?.yetkiler.alis || req.mobil?.erisim?.yetkiler.satis ? next() : mobilYetki("alis", "Alış / satış emri yetkiniz yok.")(req, _res, next);
router.get("/islem", emirYetkisi, C.islemBilgisi);
router.post("/emir", emirYetkisi, C.emirVer);
router.get("/emirler", emirYetkisi, C.emirlerim);
router.post("/emir/:id/iptal", emirYetkisi, C.emirIptal);
// Ticari katalog + sipariş (Faz 8): katalog fiyat yetkisiyle görülür; sipariş alış yetkisi ister (serviste)
router.get("/katalog", mobilYetki("fiyat", "Fiyat görme yetkiniz yok."), C.katalog);
router.post("/siparis", emirYetkisi, C.siparisVer);
export default router;
