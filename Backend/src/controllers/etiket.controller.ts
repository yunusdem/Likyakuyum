import { Request, Response } from "express";
import { EtiketService } from "../services/etiket.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export class EtiketController {
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

  private static getKullaniciId(req: Request) {
    const userObj = req.user as any;
    return Number(userObj?.userId || userObj?.id) || 1;
  }

  // ─── Altın Ürün ────────────────────────────────────────────────────────────
  public static listAltinUrun = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { search, grupKodu, ureticiFirma, baslangicTarihi, bitisTarihi, yazdirildi, satildi, limit } = req.query;
    const filter = {
      search: search ? String(search) : undefined,
      grupKodu: grupKodu ? String(grupKodu) : undefined,
      ureticiFirma: ureticiFirma ? String(ureticiFirma) : undefined,
      baslangicTarihi: baslangicTarihi ? String(baslangicTarihi) : undefined,
      bitisTarihi: bitisTarihi ? String(bitisTarihi) : undefined,
      yazdirildi: yazdirildi !== undefined ? yazdirildi === "true" || yazdirildi === "1" : undefined,
      satildi: satildi !== undefined ? satildi === "true" || satildi === "1" : undefined,
      limit: limit ? Number(limit) : 500,
    };
    const data = await EtiketService.listAltinUrun(filter, dbContext);
    return ApiResponse.ok(res, "Altın ürünler listelendi.", data);
  });

  public static getAltinUrunById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.getAltinUrunById(Number(req.params.id), dbContext);
    return ApiResponse.ok(res, "Altın ürün getirildi.", data);
  });

  public static getAltinUrunByBarkod = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.getAltinUrunByBarkod(String(req.params.barkod), dbContext);
    return ApiResponse.ok(res, "Altın ürün getirildi.", data);
  });

  public static saveAltinUrun = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.saveAltinUrun(req.body, EtiketController.getKullaniciId(req), dbContext);
    return ApiResponse.ok(res, "Altın ürün başarıyla kaydedildi.", data);
  });

  public static deleteAltinUrun = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    await EtiketService.removeAltinUrun(Number(req.params.id), dbContext);
    return ApiResponse.ok(res, "Altın ürün silindi.");
  });

  public static markAltinUrunYazdirildi = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { ids, yazdirildi } = req.body;
    const idList = Array.isArray(ids) ? ids.map((x) => Number(x)) : [];
    await EtiketService.markAltinUrunYazdirildi(idList, Boolean(yazdirildi), EtiketController.getKullaniciId(req), dbContext);
    return ApiResponse.ok(res, "Yazdırıldı durumu güncellendi.");
  });

  public static getNextAltinUrunNo = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { grupKodu, uzunluk } = req.query;
    const data = await EtiketService.getNextAltinUrunNo(String(grupKodu || ""), uzunluk ? Number(uzunluk) : 5, dbContext);
    return ApiResponse.ok(res, "Sıradaki ürün numarası üretildi.", data);
  });

  // ─── Özel Ürün ─────────────────────────────────────────────────────────────
  public static listOzelUrun = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { search, grupKodu, ureticiFirma, baslangicTarihi, bitisTarihi, yazdirildi, satildi, limit } = req.query;
    const filter = {
      search: search ? String(search) : undefined,
      grupKodu: grupKodu ? String(grupKodu) : undefined,
      ureticiFirma: ureticiFirma ? String(ureticiFirma) : undefined,
      baslangicTarihi: baslangicTarihi ? String(baslangicTarihi) : undefined,
      bitisTarihi: bitisTarihi ? String(bitisTarihi) : undefined,
      yazdirildi: yazdirildi !== undefined ? yazdirildi === "true" || yazdirildi === "1" : undefined,
      satildi: satildi !== undefined ? satildi === "true" || satildi === "1" : undefined,
      limit: limit ? Number(limit) : 500,
    };
    const data = await EtiketService.listOzelUrun(filter, dbContext);
    return ApiResponse.ok(res, "Özel ürünler listelendi.", data);
  });

  public static getOzelUrunById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.getOzelUrunById(Number(req.params.id), dbContext);
    return ApiResponse.ok(res, "Özel ürün getirildi.", data);
  });

  public static getOzelUrunByBarkod = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.getOzelUrunByBarkod(String(req.params.barkod), dbContext);
    return ApiResponse.ok(res, "Özel ürün getirildi.", data);
  });

  public static saveOzelUrun = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.saveOzelUrun(req.body, EtiketController.getKullaniciId(req), dbContext);
    return ApiResponse.ok(res, "Özel ürün başarıyla kaydedildi.", data);
  });

  public static deleteOzelUrun = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    await EtiketService.removeOzelUrun(Number(req.params.id), dbContext);
    return ApiResponse.ok(res, "Özel ürün silindi.");
  });

  public static markOzelUrunYazdirildi = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { ids, yazdirildi } = req.body;
    const idList = Array.isArray(ids) ? ids.map((x) => Number(x)) : [];
    await EtiketService.markOzelUrunYazdirildi(idList, Boolean(yazdirildi), EtiketController.getKullaniciId(req), dbContext);
    return ApiResponse.ok(res, "Yazdırıldı durumu güncellendi.");
  });

  public static getNextOzelUrunNo = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { grupKodu, uzunluk } = req.query;
    const data = await EtiketService.getNextOzelUrunNo(String(grupKodu || ""), uzunluk ? Number(uzunluk) : 5, dbContext);
    return ApiResponse.ok(res, "Sıradaki özel ürün numarası üretildi.", data);
  });

  // ─── Ortak Lookup'lar & Grup Yönetimi ──────────────────────────────────────
  public static getGrupKodlari = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.getGrupKodlari(dbContext);
    return ApiResponse.ok(res, "Grup kodları listelendi.", data);
  });

  public static listGruplar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { tip } = req.query;
    const data = await EtiketService.listGruplar(tip !== undefined && tip !== "" ? Number(tip) : undefined, dbContext);
    return ApiResponse.ok(res, "Gruplar listelendi.", data);
  });

  public static saveGrup = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { tip, grupKodu, aciklama, baslangicNo } = req.body;
    const data = await EtiketService.saveGrup(Number(tip) || 0, String(grupKodu || ""), aciklama, baslangicNo ? Number(baslangicNo) : undefined, dbContext);
    return ApiResponse.ok(res, "Grup başarıyla kaydedildi.", data);
  });

  public static deleteGrup = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { tip, grupKodu } = req.body || req.query;
    await EtiketService.deleteGrup(Number(tip) || 0, String(grupKodu || ""), dbContext);
    return ApiResponse.ok(res, "Grup silindi.");
  });

  public static getUreticiFirmalar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.getUreticiFirmalar(dbContext);
    return ApiResponse.ok(res, "Üretici firmalar listelendi.", data);
  });

  public static uploadFoto = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.uploadFoto(req.body, dbContext);
    return ApiResponse.ok(res, "Fotoğraf başarıyla yüklendi.", data);
  });

  // ─── Etiket Şablonları ─────────────────────────────────────────────────────
  public static listSablon = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { etiketTipi } = req.query;
    const data = await EtiketService.listSablon(
      { etiketTipi: etiketTipi !== undefined && etiketTipi !== "" ? Number(etiketTipi) : undefined },
      dbContext
    );
    return ApiResponse.ok(res, "Etiket şablonları listelendi.", data);
  });

  public static getSablonById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.getSablonById(Number(req.params.id), dbContext);
    return ApiResponse.ok(res, "Etiket şablonu getirildi.", data);
  });

  public static saveSablon = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.saveSablon(req.body, EtiketController.getKullaniciId(req), dbContext);
    return ApiResponse.ok(res, "Etiket şablonu başarıyla kaydedildi.", data);
  });

  public static deleteSablon = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    await EtiketService.removeSablon(Number(req.params.id), dbContext);
    return ApiResponse.ok(res, "Etiket şablonu silindi.");
  });

  // ─── Banko Yönetimi (TODVZ_BANKO) ──────────────────────────────────────────
  public static listBankolar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const { search, aktif } = req.query;
    const filter = {
      search: search ? String(search) : undefined,
      aktif: aktif !== undefined ? aktif === "true" || aktif === "1" : undefined,
    };
    const data = await EtiketService.listBankolar(filter, dbContext);
    return ApiResponse.ok(res, "Bankolar listelendi.", data);
  });

  public static getBankoById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.getBankoById(Number(req.params.id), dbContext);
    return ApiResponse.ok(res, "Banko getirildi.", data);
  });

  public static saveBanko = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    const data = await EtiketService.saveBanko(req.body, EtiketController.getKullaniciId(req), dbContext);
    return ApiResponse.ok(res, "Banko başarıyla kaydedildi.", data);
  });

  public static deleteBanko = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = EtiketController.getDbContext(req);
    await EtiketService.deleteBanko(Number(req.params.id), dbContext);
    return ApiResponse.ok(res, "Banko silindi.");
  });
}
