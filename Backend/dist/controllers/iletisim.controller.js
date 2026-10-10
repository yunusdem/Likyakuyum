import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { istemciIp } from "../utils/istemci.utils.js";
import { IletisimService } from "../services/iletisim.service.js";
// Tanıtım sitesi iletişim formu (docs/ILETISIM_FORMU_YOL_HARITASI.md). Giriş gerektirmez (İ9).
export class IletisimController {
    static formGonder = asyncHandler(async (req, res) => {
        await IletisimService.formGonder(req.body, istemciIp(req));
        return ApiResponse.ok(res, "Talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.", { alindi: true });
    });
}
