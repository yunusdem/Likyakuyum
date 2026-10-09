import { Request, Response } from "express";
import { PosAdminService } from "../../services/admin/posAdmin.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const id = (req: Request): number => Number(req.params.id);

export class PosAdminController {
  public static ayarGetir = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS ayarları getirildi.", await PosAdminService.ayarGetir());
  });

  public static ayarKaydet = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS ayarları kaydedildi.", await PosAdminService.ayarKaydet(req.admin!, req.body || {}));
  });

  public static firmaModu = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS modu getirildi.", await PosAdminService.firmaModu(id(req)));
  });

  public static firmaModuYaz = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS modu kaydedildi.", await PosAdminService.firmaModuYaz(req.admin!, id(req), req.body?.mod));
  });

  public static dogrulama = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Doğrulama durumu getirildi.", await PosAdminService.dogrulama());
  });

  public static dogrulamaYaz = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Doğrulama işareti kaydedildi.", await PosAdminService.dogrulamaYaz(req.admin!, req.body || {}));
  });

  public static konsolFirmalar = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firmalar getirildi.", await PosAdminService.konsolFirmalar());
  });

  public static konsolTerminaller = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Cihazlar getirildi.", await PosAdminService.konsolTerminaller(id(req)));
  });

  public static kimlikTesti = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Kimlik denendi.", await PosAdminService.kimlikTesti(req.body?.saglayici));
  });

  public static konsolBaglantiTesti = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosAdminService.konsolBaglantiTesti(id(req), Number(req.body?.posTerminalId), req.body?.gercek === true);
    return ApiResponse.ok(res, "Bağlantı denendi.", data);
  });

  public static konsolDeneme = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Deneme tahsilatı gönderildi.", await PosAdminService.konsolDeneme(req.admin!, id(req), req.body || {}));
  });

  public static konsolIslem = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Deneme işlemi getirildi.", await PosAdminService.konsolIslem(id(req), Number(req.params.islemId)));
  });

  public static konsolIptal = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Deneme işlemi iptal edildi.", await PosAdminService.konsolIptal(id(req), Number(req.params.islemId)));
  });

  public static konsolElle = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosAdminService.konsolElle(id(req), Number(req.params.islemId), req.body?.alindi === true);
    return ApiResponse.ok(res, "İşaret kaydedildi.", data);
  });

  public static log = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS günlüğü getirildi.", await PosAdminService.log(Number(req.query.limit) || 50));
  });
}
