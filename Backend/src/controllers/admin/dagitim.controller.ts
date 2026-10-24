import { Request, Response } from "express";
import { DagitimService } from "../../services/admin/dagitim.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Panel > Dağıtım: test / canlı durumu, "Test'i Güncelle", "Canlıya Geçir", log (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md) */
export class DagitimController {
  public static durum = asyncHandler(async (req: Request, res: Response) => {
    const yenile = req.query.yenile !== "0";
    return ApiResponse.ok(res, "Dağıtım durumu.", await DagitimService.durum(yenile));
  });

  public static baslat = asyncHandler(async (req: Request, res: Response) => {
    const hedef = req.body.hedef as "canli" | "test";
    return ApiResponse.created(res, hedef === "canli" ? "Canlıya geçiş başlatıldı." : "Test güncellemesi başlatıldı.", await DagitimService.baslat(req.admin!, hedef));
  });

  public static log = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Dağıtım logu.", await DagitimService.log(Number(req.params.id)));
  });

  public static ozet = asyncHandler(async (_req: Request, res: Response) => {
    return ApiResponse.ok(res, "Dağıtım özeti.", await DagitimService.ozet());
  });

  public static goruldu = asyncHandler(async (_req: Request, res: Response) => {
    await DagitimService.goruldu();
    return ApiResponse.ok(res, "İşaretlendi.", null);
  });
}
