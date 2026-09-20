import { Request, Response } from "express";
import { ModulService } from "../../services/admin/modul.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export class ModulController {
  public static katalog = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Modül kataloğu getirildi.", await ModulService.katalog());
  });

  public static katalogEsitle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Modül kataloğu eşitlendi.", await ModulService.katalogEsitle(req.admin!, req.body.moduller));
  });

  public static firmaAyari = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Modül ayarı getirildi.", await ModulService.firmaAyari(Number(req.params.id)));
  });

  public static firmaAyariniYaz = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await ModulService.firmaAyariniYaz(req.admin!, Number(req.params.id), req.body);
    return ApiResponse.ok(res, "Modül ayarı kaydedildi.", sonuc);
  });
}
