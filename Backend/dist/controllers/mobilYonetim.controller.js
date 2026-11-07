import { MobilYonetimService } from "../services/mobil/mobilYonetim.service.js";
import { MobilFiyatService } from "../services/mobil/mobilFiyat.service.js";
import { MobilOnayService } from "../services/mobil/mobilOnay.service.js";
import { MobilKatalogService } from "../services/mobil/mobilKatalog.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
/**
 * Firma tarafı mobil tanımları — /api/v1/mobil-yonetim (docs/MOBIL_CARI_YOL_HARITASI.md, Faz 2). Modül kapısı
 * routes/index.ts'te (mobilModulKapisi); yönetici şartı serviste (durum ucu hariç).
 */
const id = (req, ad = "id") => Number(req.params[ad]);
export class MobilYonetimController {
    /** GET /mobil-yonetim/durum — her personel (Mobil Emirler ekranı da kullanır) */
    static durum = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req, false);
        return ApiResponse.ok(res, "Mobil durum.", await MobilYonetimService.durum(b));
    });
    /** GET /mobil-yonetim/kullanicilar */
    static kullanicilar = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Mobil kullanıcılar.", await MobilYonetimService.kullanicilar(b));
    });
    /** GET /mobil-yonetim/cari/:id */
    static cari = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Cari mobil erişimi.", await MobilYonetimService.cari(b, id(req)));
    });
    /** PUT /mobil-yonetim/cari/:id/ayar */
    static cariAyarYaz = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Cari mobil ayarı kaydedildi.", await MobilYonetimService.cariAyarYaz(b, id(req), req.body));
    });
    /** POST /mobil-yonetim/kullanicilar */
    static kullaniciEkle = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.created(res, "Mobil kullanıcı eklendi.", await MobilYonetimService.kullaniciEkle(b, req.body));
    });
    /** PUT /mobil-yonetim/kullanicilar/:id */
    static kullaniciGuncelle = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Mobil kullanıcı güncellendi.", await MobilYonetimService.kullaniciGuncelle(b, id(req), req.body));
    });
    /** POST /mobil-yonetim/kullanicilar/:id/sifre-sifirla */
    static sifreSifirla = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Yeni geçici şifre üretildi.", await MobilYonetimService.sifreSifirla(b, id(req)));
    });
    /** POST /mobil-yonetim/kullanicilar/:id/erisim */
    static erisimEkle = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.created(res, "Erişim eklendi.", await MobilYonetimService.erisimEkle(b, id(req), req.body));
    });
    /** PUT /mobil-yonetim/erisim/:id */
    static erisimGuncelle = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Erişim güncellendi.", await MobilYonetimService.erisimGuncelle(b, id(req), req.body));
    });
    /** DELETE /mobil-yonetim/erisim/:id */
    static erisimSil = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        await MobilYonetimService.erisimSil(b, id(req));
        return ApiResponse.ok(res, "Erişim kaldırıldı.", null);
    });
    /** GET /mobil-yonetim/veritabanlari/:id/cariler?q= */
    static veritabaniCariAra = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Cariler.", await MobilYonetimService.veritabaniCariAra(b, id(req), String(req.query.q || "")));
    });
    /** GET /mobil-yonetim/ayarlar */
    static ayar = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Mobil ayarları.", await MobilYonetimService.ayar(b));
    });
    /** GET /mobil-yonetim/urunler — mobilde görünebilecek ürünler ve seçimi (K14) */
    static urunler = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Mobil ürünleri.", await MobilFiyatService.urunler(b.ctx));
    });
    /** PUT /mobil-yonetim/urunler { urunIdleri: [...] } (sırasıyla) */
    /** GET /mobil-yonetim/katalog — mobil Ticari katalogdaki kartlar */
    static katalog = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Mobil katalog.", await MobilKatalogService.secili(b.ctx));
    });
    /** GET /mobil-yonetim/katalog/ara?q= */
    static katalogAra = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Stok kartları.", await MobilKatalogService.ara(b.ctx, String(req.query.q || "")));
    });
    /** PUT /mobil-yonetim/katalog { stokKartIdleri } */
    static katalogYaz = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Mobil katalog kaydedildi.", await MobilKatalogService.secimYaz(b.ctx, req.body));
    });
    static urunSecimiYaz = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Mobil ürünleri kaydedildi.", await MobilFiyatService.urunSecimiYaz(b.ctx, req.body));
    });
    /** GET /mobil-yonetim/cari/:id/makas (K13, K29) */
    static cariMakas = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Cari makası.", await MobilFiyatService.cariMakas(b.ctx, id(req)));
    });
    /** PUT /mobil-yonetim/cari/:id/makas { satirlar: [{ urunId, alisTip, alisDeger, satisTip, satisDeger }] } */
    static cariMakasYaz = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Cari makası kaydedildi.", await MobilFiyatService.cariMakasYaz(b.ctx, id(req), req.body, b.kim));
    });
    // ------------------------------------------------------------------ Mobil Emirler (personel, Faz 7) ---
    static personel(req) {
        return { id: Number(req.user?.userId) || 0, ad: String(req.user?.username || "").slice(0, 100) };
    }
    /** GET /mobil-yonetim/emirler?durum= */
    static emirler = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req, false);
        return ApiResponse.ok(res, "Mobil emirler.", await MobilOnayService.liste(b, req.query.durum ? String(req.query.durum) : null));
    });
    /** GET /mobil-yonetim/emirler/ozet — bekleyen sayısı (bildirim) */
    static emirOzeti = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req, false);
        return ApiResponse.ok(res, "Bekleyen emirler.", await MobilOnayService.ozet(b));
    });
    /** GET /mobil-yonetim/emirler/:id/onizleme */
    static emirOnizleme = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req, false);
        return ApiResponse.ok(res, "Onay önizlemesi.", await MobilOnayService.onizleme(b, id(req)));
    });
    /** POST /mobil-yonetim/emirler/:id/onayla { odemeSekli, bankaId?, posCihaziId? } */
    static emirOnayla = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req, false);
        return ApiResponse.ok(res, "Emir onaylandı; fiş kesildi.", await MobilOnayService.onayla(b, id(req), req.body || {}, MobilYonetimController.personel(req)));
    });
    /** POST /mobil-yonetim/emirler/:id/reddet { neden } */
    static emirReddet = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req, false);
        return ApiResponse.ok(res, "Emir reddedildi.", await MobilOnayService.reddet(b, id(req), req.body || {}, MobilYonetimController.personel(req)));
    });
    /** PUT /mobil-yonetim/ayarlar */
    static ayarYaz = asyncHandler(async (req, res) => {
        const b = await MobilYonetimService.baglam(req);
        return ApiResponse.ok(res, "Mobil ayarları kaydedildi.", await MobilYonetimService.ayarYaz(b, req.body));
    });
}
