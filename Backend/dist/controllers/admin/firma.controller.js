import { FirmaService } from "../../services/admin/firma.service.js";
import { FirmaBaglantiService } from "../../services/admin/firmaBaglanti.service.js";
import { EpostaDogrulamaService } from "../../services/admin/epostaDogrulama.service.js";
import { KlonService } from "../../services/admin/klon.service.js";
import { YedekService } from "../../services/admin/yedek.service.js";
import { SilmeService } from "../../services/admin/silme.service.js";
import { LisansKodService } from "../../services/admin/lisansKod.service.js";
import { AyarService } from "../../services/admin/ayar.service.js";
import { MerkezKurulumService } from "../../services/admin/merkezKurulum.service.js";
import { KurulumSqlRepository } from "../../models/admin/kurulumSql.repository.js";
import { SurumService } from "../../services/admin/surum.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const id = (req) => Number(req.params.id);
export class FirmaController {
    static ozet = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Özet getirildi.", await FirmaService.ozet());
    });
    static listele = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Firmalar getirildi.", await FirmaService.listele());
    });
    static getir = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Firma getirildi.", await FirmaService.getir(id(req)));
    });
    static ekle = asyncHandler(async (req, res) => {
        return ApiResponse.created(res, "Firma oluşturuldu.", await FirmaService.ekle(req.admin, req.body));
    });
    static bulutDurum = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Bulut durumu getirildi.", KlonService.durum());
    });
    static bulutEkle = asyncHandler(async (req, res) => {
        return ApiResponse.created(res, "Firma ve veritabanı oluşturuldu.", await KlonService.olustur(req.admin, req.body));
    });
    static yedekle = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Yedek alındı.", await YedekService.yedekle(req.admin, id(req)));
    });
    static yedekBaglantisi = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "İndirme bağlantısı hazır.", await YedekService.indirmeBaglantisi(req.admin, id(req)));
    });
    /** Açık uç: bağlantıdaki anahtarla yedek dosyası (oturum gerekmez; anahtar 15 dk geçerli). */
    static indir = asyncHandler(async (req, res) => {
        await YedekService.indir(String(req.params.token), res);
    });
    static silmeDurumu = asyncHandler(async (req, res) => {
        const firma = await FirmaService.getir(id(req));
        return ApiResponse.ok(res, "Silme durumu getirildi.", { silinemezNedeni: await SilmeService.silinemezNedeni(firma) });
    });
    static sil = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Firma silinmek üzere işaretlendi.", await SilmeService.silmeIste(req.admin, id(req), req.body.onay));
    });
    static silmeyiGeriAl = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Silme geri alındı.", await SilmeService.geriAl(req.admin, id(req)));
    });
    static lisansKodu = asyncHandler(async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        const sonuc = await LisansKodService.kodUret(req.admin, id(req), Number(req.params.lisansId), req.body.makineKimligi);
        return ApiResponse.ok(res, "Lisans kodu üretildi.", sonuc);
    });
    static lisansIptal = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Lisans iptal edildi.", await LisansKodService.iptal(req.admin, id(req), Number(req.params.lisansId)));
    });
    /** Kurulum (exe) firması: son bildirilen makine ve bildirim geçmişi */
    static kurulumDurumu = asyncHandler(async (req, res) => {
        const firmaId = id(req);
        await FirmaService.getir(firmaId);
        return ApiResponse.ok(res, "Kurulum durumu getirildi.", {
            sonBildirilenMakine: await KurulumSqlRepository.sonBildirilenMakine(firmaId),
            gecmis: await KurulumSqlRepository.heartbeatGecmisi(firmaId, 30),
        });
    });
    static kurulumBaglantisi = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Kurulum bağlantısı hazır.", await MerkezKurulumService.kurulumBaglantisi(req.admin, id(req)));
    });
    /** firma.lky (kurulum paketine konur) */
    static firmaDosyasi = asyncHandler(async (req, res) => {
        const d = await MerkezKurulumService.firmaDosyasi(id(req));
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${d.dosyaAdi}"`);
        res.send(d.icerik);
    });
    static surumler = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Sürümler getirildi.", await SurumService.listele());
    });
    static surumGuncelle = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Sürüm güncellendi.", await SurumService.guncelle(req.admin, String(req.params.surum), req.body));
    });
    static hedefSurum = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Hedef sürüm kaydedildi.", await SurumService.hedefSurumAyarla(req.admin, id(req), req.body.surum || null));
    });
    static ayarlar = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Ayarlar getirildi.", await AyarService.getir());
    });
    static ayarKaydet = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Ayarlar kaydedildi.", await AyarService.kaydet(req.admin, req.body));
    });
    static guncelle = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Firma güncellendi.", await FirmaService.guncelle(req.admin, id(req), req.body));
    });
    static durum = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Firma durumu değiştirildi.", await FirmaService.durumDegistir(req.admin, id(req), req.body));
    });
    static dogrulama = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Doğrulama kaydedildi.", await FirmaService.dogrulama(req.admin, id(req), req.body));
    });
    static dbTest = asyncHandler(async (req, res) => {
        const sonuc = await FirmaBaglantiService.dbTest(id(req));
        return ApiResponse.ok(res, sonuc.sonuc, { ...sonuc, firma: await FirmaService.getir(id(req)) });
    });
    static masakKontrol = asyncHandler(async (req, res) => {
        const sonuc = await FirmaBaglantiService.masakKontrol(id(req));
        return ApiResponse.ok(res, sonuc.sonuc, { ...sonuc, firma: await FirmaService.getir(id(req)) });
    });
    static mailDurumu = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Mail durumu getirildi.", EpostaDogrulamaService.mailDurumu());
    });
    static epostaDogrulamaGonder = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Doğrulama maili gönderildi.", await EpostaDogrulamaService.gonder(req.admin, id(req)));
    });
    static epostaDogrulamaElle = asyncHandler(async (req, res) => {
        const firma = await EpostaDogrulamaService.elleAyarla(req.admin, id(req), req.body.dogrulandi);
        return ApiResponse.ok(res, "E-posta doğrulaması güncellendi.", firma);
    });
    /** Herkese açık: maildeki bağlantıyı açan kişi düğmeye basınca çağrılır (oturum gerekmez). */
    static epostaOnayla = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "E-posta adresiniz doğrulandı.", await EpostaDogrulamaService.onayla(req.body.anahtar));
    });
    static lisanslar = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Lisanslar getirildi.", await FirmaService.lisanslar(id(req)));
    });
    static lisansEkle = asyncHandler(async (req, res) => {
        return ApiResponse.created(res, "Lisans eklendi.", await FirmaService.lisansEkle(req.admin, id(req), req.body));
    });
}
