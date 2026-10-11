import { PaketService } from "../../services/admin/paket.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
/** Lisans ürün paketleri (docs/LISANS_URUN_PAKETLERI.md) */
export class PaketController {
    static liste = asyncHandler(async (_req, res) => {
        return ApiResponse.ok(res, "Paketler getirildi.", await PaketService.liste());
    });
    static ilkIcerik = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Paket ilk içeriği hazırlandı.", await PaketService.ilkIcerik(req.admin, req.body.icerik));
    });
    static yaz = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Paket kaydedildi.", await PaketService.paketYaz(req.admin, String(req.params.kod), req.body));
    });
    static firmaUrunleri = asyncHandler(async (_req, res) => {
        return ApiResponse.ok(res, "Firma ürünleri getirildi.", await PaketService.firmaUrunHaritasi());
    });
    static onizleme = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Önizleme hazır.", await PaketService.onizleme(Number(req.params.id), req.body.urunler));
    });
}
