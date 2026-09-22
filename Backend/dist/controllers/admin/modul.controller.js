import { ModulService } from "../../services/admin/modul.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export class ModulController {
    static katalog = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Modül kataloğu getirildi.", await ModulService.katalog());
    });
    static katalogEsitle = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Modül kataloğu eşitlendi.", await ModulService.katalogEsitle(req.admin, req.body.moduller));
    });
    static firmaAyari = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Modül ayarı getirildi.", await ModulService.firmaAyari(Number(req.params.id)));
    });
    static firmaAyariniYaz = asyncHandler(async (req, res) => {
        const sonuc = await ModulService.firmaAyariniYaz(req.admin, Number(req.params.id), req.body);
        return ApiResponse.ok(res, "Modül ayarı kaydedildi.", sonuc);
    });
}
