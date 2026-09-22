import { FirmaService } from "../../services/admin/firma.service.js";
import { FirmaBaglantiService } from "../../services/admin/firmaBaglanti.service.js";
import { EpostaDogrulamaService } from "../../services/admin/epostaDogrulama.service.js";
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
