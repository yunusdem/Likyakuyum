import { AktarimService } from "../../services/aktarim/aktarim.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
/** Eski programdan veri aktarımı — admin uçları (docs/VERITABANI_TASIMA_YOL_HARITASI.md). */
const firmaId = (req) => Number(req.params.id);
const yuklemeId = (req) => String(req.params.yuklemeId || "");
export class AktarimController {
    static yuklemeler = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Yüklemeler getirildi.", await AktarimService.yuklemeler(firmaId(req)));
    });
    static yuklemeBaslat = asyncHandler(async (req, res) => {
        return ApiResponse.created(res, "Yükleme başlatıldı.", await AktarimService.yuklemeBaslat(firmaId(req), req.body));
    });
    static parca = asyncHandler(async (req, res) => {
        if (!Buffer.isBuffer(req.body))
            throw ApiError.badRequest("Parça ikili veri (application/octet-stream) olarak gönderilmeli.");
        const sha = req.get("X-Parca-Sha256") || null;
        return ApiResponse.ok(res, "Parça alındı.", await AktarimService.parca(firmaId(req), yuklemeId(req), Number(req.params.sira), req.body, sha));
    });
    static yuklemeBitir = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Yükleme tamamlandı.", await AktarimService.yuklemeBitir(req.admin, firmaId(req), yuklemeId(req)));
    });
    static yuklemeSil = asyncHandler(async (req, res) => {
        await AktarimService.yuklemeSil(firmaId(req), yuklemeId(req));
        return ApiResponse.ok(res, "Yükleme silindi.", null);
    });
    static incele = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "İnceleme başlatıldı.", await AktarimService.inceleBaslat(firmaId(req), yuklemeId(req)));
    });
    static aktar = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Aktarım başlatıldı.", await AktarimService.aktarBaslat(req.admin, firmaId(req), yuklemeId(req), req.body));
    });
    static dogrula = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Doğrulama başlatıldı.", await AktarimService.dogrulaBaslat(req.admin, firmaId(req), yuklemeId(req)));
    });
    static isDurumu = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "İş durumu.", AktarimService.isDurumu(firmaId(req), String(req.params.isId || "")));
    });
    static rapor = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Rapor getirildi.", await AktarimService.raporlar(firmaId(req), yuklemeId(req)));
    });
}
