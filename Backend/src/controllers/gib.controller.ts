import { Request, Response } from "express";
import { VknSorguService } from "../services/gib/vknSorgu.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export class GibController {
  /** GET /api/v1/gib/vkn-sorgu?no= — GİB'den unvan / ad-soyad / vergi dairesi (docs/GIB_VKN_SORGU_YOL_HARITASI.md) */
  public static vknSorgu = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await VknSorguService.sorgula(String(req.query.no ?? ""), {
      firmaId: req.user?.firmaId ?? null,
      dbAdi: req.user?.dbName ?? null,
      kullanici: req.user?.username || req.user?.userId || "bilinmiyor",
      dbContext: { dbServer: req.user?.dbServer, dbName: req.user?.dbName },
    });
    return ApiResponse.ok(res, sonuc.sonuc === "BULUNDU" ? "GİB kaydı bulundu." : "Bu numara GİB'de kayıtlı değil.", sonuc);
  });
}
