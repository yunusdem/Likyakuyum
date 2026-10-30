import { Router } from "express";
import { DestekPanelController as C } from "../controllers/destekPanel/destekPanel.controller.js";
import { destekAuthenticate, destekGirisSiniri, destekKapisi, destekSifreBelirlenmis } from "../middlewares/destekPanelAuth.middleware.js";
import { adminHataIsleyici } from "../middlewares/adminAuth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { bildirimGuncelleSchema, bildirimOlusturSchema } from "../schemas/destek.schema.js";
import { hizliCevapListeSchema, hizliCevapYazSchema, musteriListeSchema, panelAktarSchema, panelDurumSchema, panelGirisSchema, panelIdSchema, panelKonuListeSchema, panelMesajSchema, panelSifreSchema, personelEkleSchema, personelGuncelleSchema, raporSchema, telefonTalebiSchema, } from "../schemas/destekPanel.schema.js";
import { ApiError } from "../utils/ApiError.js";
// Destek ekibi paneli API'si (docs/DESTEK_PANELI_YOL_HARITASI.md). Ana sitenin web.config'i bu yolu dışarıya kapatır.
const router = Router();
router.use(destekKapisi);
router.post("/auth/login", destekGirisSiniri, validate(panelGirisSchema), C.giris);
router.use(destekAuthenticate);
router.get("/auth/ben", C.ben);
router.post("/auth/cikis", C.cikis);
router.post("/auth/sifre", validate(panelSifreSchema), C.sifreDegistir);
router.use(destekSifreBelirlenmis);
// Talepler
router.get("/ozet", C.ozet);
router.get("/konular", validate(panelKonuListeSchema), C.konular);
router.get("/konular/:id", validate(panelIdSchema), C.konu);
router.post("/konular/:id/mesajlar", validate(panelMesajSchema), C.mesaj);
router.post("/konular/:id/ustlen", validate(panelIdSchema), C.ustlen);
router.post("/konular/:id/aktar", validate(panelAktarSchema), C.aktar);
router.post("/konular/:id/durum", validate(panelDurumSchema), C.durum);
router.post("/talepler", validate(telefonTalebiSchema), C.telefonTalebi);
router.get("/ek/:id", validate(panelIdSchema), C.ek);
// Bildirimler (D11: her personel)
router.get("/bildirimler", C.bildirimler);
router.get("/hedefler", C.hedefSecenekleri);
router.post("/bildirimler", validate(bildirimOlusturSchema), C.bildirimOlustur);
router.put("/bildirimler/:id", validate(bildirimGuncelleSchema), C.bildirimGuncelle);
router.post("/bildirimler/:id/geri-cek", validate(panelIdSchema), C.bildirimGeriCek);
// Müşteriler (salt okunur)
router.get("/musteriler", validate(musteriListeSchema), C.musteriler);
router.get("/musteriler/:id", validate(panelIdSchema), C.musteri);
// Hızlı cevaplar (tanımlama yalnız destek admini)
router.get("/hizli-cevaplar", validate(hizliCevapListeSchema), C.hizliCevaplar);
router.post("/hizli-cevaplar", validate(hizliCevapYazSchema), C.hizliCevapYaz);
// Ekip (aktarma listesi) ve personel yönetimi (yalnız destek admini — serviste denetlenir)
router.get("/ekip", C.ekip);
router.get("/personel", C.personelListe);
router.post("/personel", validate(personelEkleSchema), C.personelEkle);
router.put("/personel/:id", validate(personelGuncelleSchema), C.personelGuncelle);
router.post("/personel/:id/sifre-sifirla", validate(panelIdSchema), C.personelSifre);
router.post("/personel/:id/kilit-ac", validate(panelIdSchema), C.personelKilitAc);
router.get("/rapor", validate(raporSchema), C.rapor);
router.use((req, res, next) => next(ApiError.notFound("Endpoint bulunamadı.")));
router.use(adminHataIsleyici);
export default router;
