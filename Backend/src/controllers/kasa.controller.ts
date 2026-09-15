import { Request, Response } from "express";
import { KasaService } from "../services/kasa.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export class KasaController {
  private static getDbContext(req: Request) {
    return {
      dbServer:
        req.user?.dbServer ||
        (req.headers["x-db-server"] as string) ||
        (req.query.dbServer as string) ||
        (req.body?.dbServer as string),
      dbName:
        req.user?.dbName ||
        (req.headers["x-db-name"] as string) ||
        (req.query.dbName as string) ||
        (req.body?.dbName as string),
    };
  }

  // ─── Hesap Kartları ────────────────────────────────────────────────────────
  public static listHesaplar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const { search, aktif } = req.query;
    const filter = {
      search: search ? String(search) : undefined,
      aktif: aktif !== undefined ? aktif === "true" || aktif === "1" : undefined,
    };
    const data = await KasaService.listHesaplar(filter, dbContext);
    return ApiResponse.ok(res, "Hesap kartları listelendi.", data);
  });

  public static getHesapById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const hesapId = Number(req.params.id);
    const data = await KasaService.getHesapById(hesapId, dbContext);
    return ApiResponse.ok(res, "Hesap kartı getirildi.", data);
  });

  public static saveHesap = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const data = await KasaService.saveHesap(req.body, dbContext);
    return ApiResponse.ok(res, "Hesap kartı başarıyla kaydedildi.", data);
  });

  public static deleteHesap = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const hesapId = Number(req.params.id);
    await KasaService.deleteHesap(hesapId, dbContext);
    return ApiResponse.ok(res, "Hesap kartı silindi.");
  });

  // ─── Hesap Hareketleri ─────────────────────────────────────────────────────
  public static listHareketler = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const { hesapId, vezneId, search, limit } = req.query;
    const filter = {
      hesapId: hesapId ? Number(hesapId) : undefined,
      vezneId: vezneId ? Number(vezneId) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? Number(limit) : 200,
    };
    const data = await KasaService.listHareketler(filter, dbContext);
    return ApiResponse.ok(res, "Hesap hareketleri listelendi.", data);
  });

  public static getHareketById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const id = Number(req.params.id);
    const data = await KasaService.getHareketById(id, dbContext);
    return ApiResponse.ok(res, "Hesap hareketi getirildi.", data);
  });

  public static saveHareket = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const userObj = req.user as any;
    const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
    const data = await KasaService.saveHareket(req.body, kullaniciId, dbContext);
    return ApiResponse.ok(res, "Hesap hareketi başarıyla kaydedildi.", data);
  });

  public static deleteHareket = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const id = Number(req.params.id);
    const userObj = req.user as any;
    const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
    const degisiklikTakipVar = Boolean(req.body?.degisiklikTakipVar);
    await KasaService.deleteHareket(id, kullaniciId, degisiklikTakipVar, dbContext);
    return ApiResponse.ok(res, "Hesap hareketi silindi.");
  });

  // ─── Lookups ───────────────────────────────────────────────────────────────
  public static getLookups = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const data = await KasaService.getLookups(dbContext);
    return ApiResponse.ok(res, "Kasa lookups listelendi.", data);
  });

  public static getUserVezne = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = KasaController.getDbContext(req);
    const userObj = req.user as any;
    const kullaniciId = Number(req.query.kullaniciId) || Number(userObj?.userId || userObj?.id) || 1;
    const vezneId = await KasaService.getUserVezneId(kullaniciId, dbContext);
    return ApiResponse.ok(res, "Kullanıcı veznesi getirildi.", { vezneId });
  });
}
