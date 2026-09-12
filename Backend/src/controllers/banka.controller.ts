import { Request, Response, NextFunction } from "express";
import { BankaService } from "../services/banka.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export class BankaController {
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

  // ─── Banka Hesap Kartları ──────────────────────────────────────────────────
  public static listBankalar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const { search, aktif } = req.query;
    const filter = {
      search: search ? String(search) : undefined,
      aktif: aktif !== undefined ? aktif === "true" || aktif === "1" : undefined,
    };
    const data = await BankaService.listBankalar(filter, dbContext);
    return ApiResponse.ok(res, "Banka hesapları listelendi.", data);
  });

  public static getBankaById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const bankaId = Number(req.params.id);
    const data = await BankaService.getBankaById(bankaId, dbContext);
    return ApiResponse.ok(res, "Banka hesabı getirildi.", data);
  });

  public static getNextHesapNo = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const nextNo = await BankaService.getNextHesapNo(dbContext);
    return ApiResponse.ok(res, "Sonraki hesap no üretildi.", { nextNo });
  });

  public static saveBanka = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const userObj = req.user as any;
    const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
    const data = await BankaService.saveBanka(req.body, kullaniciId, dbContext);
    return ApiResponse.ok(res, "Banka hesabı başarıyla kaydedildi.", data);
  });

  public static deleteBanka = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const bankaId = Number(req.params.id);
    const userObj = req.user as any;
    const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
    await BankaService.deleteBanka(bankaId, kullaniciId, dbContext);
    return ApiResponse.ok(res, "Banka hesabı silindi.");
  });

  // ─── Banka Hesap Hareketleri ───────────────────────────────────────────────
  public static listHareketler = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const { bankaId, cariKartId, vezneId, islemTipi, baslangicTarihi, bitisTarihi, search, limit } = req.query;
    const filter = {
      bankaId: bankaId ? Number(bankaId) : undefined,
      cariKartId: cariKartId ? Number(cariKartId) : undefined,
      vezneId: vezneId ? Number(vezneId) : undefined,
      islemTipi: islemTipi !== undefined && islemTipi !== "" ? Number(islemTipi) : undefined,
      baslangicTarihi: baslangicTarihi ? String(baslangicTarihi) : undefined,
      bitisTarihi: bitisTarihi ? String(bitisTarihi) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? Number(limit) : 200,
    };
    const data = await BankaService.listHareketler(filter, dbContext);
    return ApiResponse.ok(res, "Banka hareketleri listelendi.", data);
  });

  public static getHareketById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const id = Number(req.params.id);
    const data = await BankaService.getHareketById(id, dbContext);
    return ApiResponse.ok(res, "Banka hareketi getirildi.", data);
  });

  public static saveHareket = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const userObj = req.user as any;
    const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
    const data = await BankaService.saveHareket(req.body, kullaniciId, dbContext);
    return ApiResponse.ok(res, "Banka hareketi başarıyla kaydedildi.", data);
  });

  public static deleteHareket = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const id = Number(req.params.id);
    const userObj = req.user as any;
    const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
    await BankaService.deleteHareket(id, kullaniciId, dbContext);
    return ApiResponse.ok(res, "Banka hareketi silindi.");
  });

  public static toggleIptalHareket = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const id = Number(req.params.id);
    const { iptal } = req.body;
    const userObj = req.user as any;
    const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
    await BankaService.toggleIptalHareket(id, Boolean(iptal), kullaniciId, dbContext);
    return ApiResponse.ok(res, `Banka hareketi ${iptal ? "iptal edildi" : "aktif hale getirildi"}.`);
  });

  // ─── Lookups ───────────────────────────────────────────────────────────────
  public static getLookups = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = BankaController.getDbContext(req);
    const data = await BankaService.getLookups(dbContext);
    return ApiResponse.ok(res, "Banka lookups listelendi.", data);
  });
}
