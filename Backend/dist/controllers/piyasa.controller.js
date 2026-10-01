import { PiyasaService } from "../services/piyasa.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class PiyasaController {
    /**
     * GET /api/v1/piyasa
     * Tüm kaynakların anlık fiyatları. Yalnızca izleme; hiçbir kayda dokunmaz.
     */
    static anlik = asyncHandler(async (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        return ApiResponse.ok(res, "Piyasa fiyatları", await PiyasaService.anlik());
    });
}
