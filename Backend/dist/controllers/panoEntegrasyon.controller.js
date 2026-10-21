import { FirmaSqlRepository } from "../models/admin/firmaSql.repository.js";
import { firmaDbAnahtari } from "../services/admin/firmaBaglanti.service.js";
import { gorunumYoneticisiMi } from "../services/gorunum/kullaniciGorunum.service.js";
import { PanoEntegrasyonService } from "../services/panoApi/panoEntegrasyon.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { adresKoku } from "./acikPano.controller.js";
/**
 * Kur › Pano Entegrasyonu (docs/PANO_API_YOL_HARITASI.md, P2/P11). Yalnız yönetici (Görünüm Ayarları ile aynı kural).
 * Firma, oturumun sunucu+veritabanından merkez kaydıyla bulunur; merkeze kayıtlı olmayan (exe) firmada çalışmaz (P13).
 */
const YONETICI_GEREKLI = "Pano Entegrasyonu sayfasına yalnız yönetici girebilir.";
export class PanoEntegrasyonController {
    static async hazirla(req) {
        if (!(await gorunumYoneticisiMi(req)))
            throw ApiError.forbidden(YONETICI_GEREKLI);
        const ctx = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        if (!ctx.dbServer || !ctx.dbName)
            throw ApiError.unauthorized("Oturum bilgisi eksik.");
        const firma = await FirmaSqlRepository.anahtarIleBul(firmaDbAnahtari(ctx.dbServer, ctx.dbName).anahtar);
        if (!firma)
            throw new ApiError(503, "Pano Entegrasyonu yalnız merkeze kayıtlı (bulut) firmalarda çalışır.");
        const kim = `firma:${req.user?.username || ""}`.slice(0, 100);
        return { firmaId: firma.firmaId, ctx, kim, kok: adresKoku(req), panoId: Number(req.params.panoId) };
    }
    /** GET /api/v1/pano-entegrasyonu */
    static liste = asyncHandler(async (req, res) => {
        const { firmaId, ctx, kok } = await PanoEntegrasyonController.hazirla(req);
        return ApiResponse.ok(res, "Pano entegrasyonu.", await PanoEntegrasyonService.liste(firmaId, ctx, kok));
    });
    /** POST /api/v1/pano-entegrasyonu/:panoId/anahtar — üret / yenile */
    static uret = asyncHandler(async (req, res) => {
        const { firmaId, ctx, kim, kok, panoId } = await PanoEntegrasyonController.hazirla(req);
        return ApiResponse.ok(res, "Anahtar üretildi.", await PanoEntegrasyonService.uret(firmaId, panoId, ctx, kim, kok));
    });
    /** DELETE /api/v1/pano-entegrasyonu/:panoId/anahtar */
    static iptal = asyncHandler(async (req, res) => {
        const { firmaId, ctx, kim, kok, panoId } = await PanoEntegrasyonController.hazirla(req);
        return ApiResponse.ok(res, "Anahtar iptal edildi.", await PanoEntegrasyonService.iptal(firmaId, panoId, ctx, kim, kok));
    });
    /** PUT /api/v1/pano-entegrasyonu/:panoId/onbellek { sn } */
    static onbellek = asyncHandler(async (req, res) => {
        const { firmaId, ctx, kok, panoId } = await PanoEntegrasyonController.hazirla(req);
        return ApiResponse.ok(res, "Önbellek süresi kaydedildi.", await PanoEntegrasyonService.onbellekYaz(firmaId, panoId, ctx, req.body?.sn, kok));
    });
}
