import { DestekPanelAuthService } from "../../services/destekPanel/destekPanelAuth.service.js";
import { DestekPanelService } from "../../services/destekPanel/destekPanel.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { istemciIp, istemciTarayici } from "../../utils/istemci.utils.js";
/** Destek paneli (destek.likyakuyum.com) — /api/v1/destek-panel */
export class DestekPanelController {
    // ---- Giriş
    static giris = asyncHandler(async (req, res) => ApiResponse.ok(res, "Giriş başarılı.", await DestekPanelAuthService.giris(req.body, { ip: istemciIp(req), tarayici: istemciTarayici(req) })));
    static cikis = asyncHandler(async (req, res) => {
        await DestekPanelAuthService.cikis(req.personel.sid);
        return ApiResponse.ok(res, "Çıkış yapıldı.");
    });
    static ben = asyncHandler(async (req, res) => ApiResponse.ok(res, "Hesap.", await DestekPanelAuthService.profil(req.personel)));
    static sifreDegistir = asyncHandler(async (req, res) => {
        await DestekPanelAuthService.sifreDegistir(req.personel, req.body);
        return ApiResponse.ok(res, "Şifreniz değiştirildi.");
    });
    // ---- Talepler
    static ozet = asyncHandler(async (req, res) => ApiResponse.ok(res, "Özet.", await DestekPanelService.ozet(req.personel)));
    static konular = asyncHandler(async (req, res) => {
        const q = req.query;
        return ApiResponse.ok(res, "Kayıtlar.", await DestekPanelService.konular(req.personel, {
            sekme: q.sekme ?? "havuz",
            durum: q.durum,
            firmaId: q.firmaId ? Number(q.firmaId) : undefined,
            personelId: q.personelId ? Number(q.personelId) : undefined,
            kaynakKonuId: q.kaynakKonuId ? Number(q.kaynakKonuId) : undefined,
            arama: q.arama,
            sayfa: q.sayfa ? Number(q.sayfa) : undefined,
            sayfaBoyu: q.sayfaBoyu ? Number(q.sayfaBoyu) : undefined,
        }));
    });
    static konu = asyncHandler(async (req, res) => ApiResponse.ok(res, "Kayıt.", await DestekPanelService.konu(req.personel, Number(req.params.id))));
    static mesaj = asyncHandler(async (req, res) => ApiResponse.ok(res, req.body.icNot ? "İç not eklendi." : "Cevap gönderildi.", await DestekPanelService.mesaj(req.personel, Number(req.params.id), req.body)));
    static ustlen = asyncHandler(async (req, res) => ApiResponse.ok(res, "Kayıt üstlenildi.", await DestekPanelService.ustlen(req.personel, Number(req.params.id))));
    static aktar = asyncHandler(async (req, res) => ApiResponse.ok(res, req.body.personelId ? "Kayıt aktarıldı." : "Kayıt havuza bırakıldı.", await DestekPanelService.aktar(req.personel, Number(req.params.id), req.body.personelId)));
    static durum = asyncHandler(async (req, res) => ApiResponse.ok(res, req.body.durum === "KAPALI" ? "Kayıt kapatıldı." : "Kayıt yeniden açıldı.", await DestekPanelService.durum(req.personel, Number(req.params.id), req.body.durum)));
    static telefonTalebi = asyncHandler(async (req, res) => ApiResponse.created(res, "Talep açıldı.", await DestekPanelService.telefonTalebi(req.personel, req.body)));
    static ek = asyncHandler(async (req, res) => {
        const d = await DestekPanelService.ek(req.personel, Number(req.params.id));
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.type(d.mime);
        res.sendFile(d.yol);
    });
    // ---- Bildirimler
    static bildirimler = asyncHandler(async (req, res) => ApiResponse.ok(res, "Bildirimler.", await DestekPanelService.bildirimler(req.personel)));
    static hedefSecenekleri = asyncHandler(async (req, res) => ApiResponse.ok(res, "Hedef seçenekleri.", await DestekPanelService.hedefSecenekleri()));
    static bildirimOlustur = asyncHandler(async (req, res) => ApiResponse.created(res, req.body.gonder ? "Bildirim gönderildi." : "Taslak kaydedildi.", await DestekPanelService.bildirimOlustur(req.personel, req.body)));
    static bildirimGuncelle = asyncHandler(async (req, res) => ApiResponse.ok(res, req.body.gonder ? "Bildirim gönderildi." : "Taslak kaydedildi.", await DestekPanelService.bildirimGuncelle(req.personel, Number(req.params.id), req.body)));
    static bildirimGeriCek = asyncHandler(async (req, res) => ApiResponse.ok(res, "Bildirim geri çekildi.", await DestekPanelService.bildirimGeriCek(req.personel, Number(req.params.id))));
    // ---- Müşteriler
    static musteriler = asyncHandler(async (req, res) => ApiResponse.ok(res, "Müşteriler.", await DestekPanelService.musteriler(req.query.arama)));
    static musteri = asyncHandler(async (req, res) => ApiResponse.ok(res, "Müşteri.", await DestekPanelService.musteri(req.personel, Number(req.params.id))));
    // ---- Hızlı cevap
    static hizliCevaplar = asyncHandler(async (req, res) => ApiResponse.ok(res, "Hızlı cevaplar.", await DestekPanelService.hizliCevaplar(req.personel, req.query.hepsi === "1")));
    static hizliCevapYaz = asyncHandler(async (req, res) => ApiResponse.ok(res, "Kaydedildi.", await DestekPanelService.hizliCevapYaz(req.personel, req.body)));
    // ---- Ekip / personel
    static ekip = asyncHandler(async (req, res) => ApiResponse.ok(res, "Ekip.", await DestekPanelService.ekip()));
    static personelListe = asyncHandler(async (req, res) => ApiResponse.ok(res, "Personel.", await DestekPanelService.personelListe(req.personel)));
    static personelEkle = asyncHandler(async (req, res) => ApiResponse.created(res, "Personel eklendi.", await DestekPanelService.personelEkle(req.personel, req.body)));
    static personelGuncelle = asyncHandler(async (req, res) => ApiResponse.ok(res, "Personel güncellendi.", await DestekPanelService.personelGuncelle(req.personel, Number(req.params.id), req.body)));
    static personelSifre = asyncHandler(async (req, res) => ApiResponse.ok(res, "Geçici şifre oluşturuldu.", await DestekPanelService.personelSifreSifirla(req.personel, Number(req.params.id))));
    static personelKilitAc = asyncHandler(async (req, res) => ApiResponse.ok(res, "Kilit açıldı.", await DestekPanelService.personelKilitAc(req.personel, Number(req.params.id))));
    // ---- Rapor
    static rapor = asyncHandler(async (req, res) => {
        const q = req.query;
        return ApiResponse.ok(res, "Rapor.", await DestekPanelService.rapor(req.personel, q.bas, q.bit));
    });
}
