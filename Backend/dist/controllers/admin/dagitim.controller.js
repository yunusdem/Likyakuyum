import { DagitimService } from "../../services/admin/dagitim.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
/** Panel > Dağıtım: test / canlı durumu, "Test'i Güncelle", "Canlıya Geçir", log (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md) */
export class DagitimController {
    static durum = asyncHandler(async (req, res) => {
        const yenile = req.query.yenile !== "0";
        return ApiResponse.ok(res, "Dağıtım durumu.", await DagitimService.durum(yenile));
    });
    static baslat = asyncHandler(async (req, res) => {
        const hedef = req.body.hedef;
        return ApiResponse.created(res, hedef === "canli" ? "Canlıya geçiş başlatıldı." : "Test güncellemesi başlatıldı.", await DagitimService.baslat(req.admin, hedef));
    });
    static log = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Dağıtım logu.", await DagitimService.log(Number(req.params.id)));
    });
    static ozet = asyncHandler(async (_req, res) => {
        return ApiResponse.ok(res, "Dağıtım özeti.", await DagitimService.ozet());
    });
    static goruldu = asyncHandler(async (_req, res) => {
        await DagitimService.goruldu();
        return ApiResponse.ok(res, "İşaretlendi.", null);
    });
}
