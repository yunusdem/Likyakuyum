import { Request, Response } from "express";
import { CariService } from "../services/cari.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { kullaniciYetkisi } from "../services/yetki/kullaniciYetkisi.js";

export class CariController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body.dbName as string),
    };
  }

  /**
   * GET /api/v1/cari/lookups
   */
  public static getLookups = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const lookups = await CariService.getLookups(dbContext);
    return ApiResponse.ok(res, "Cari lookup listeleri getirildi.", lookups);
  });

  /**
   * GET /api/v1/cari
   */
  public static listCariKartlar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const list = await CariService.listCariKartlar(dbContext);
    // "Cari bakiye görebilir" yetkisi yoksa bakiye alanları gönderilmez (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
    if (!(await kullaniciYetkisi(req)).cariBakiye) {
      const gizli = list.map(({ borcBakiye, alacakBakiye, netBakiye, bakiyeYon, hasBakiye, hasYon, bakiyeOzet, ...k }: any) => k);
      return ApiResponse.ok(res, "Cari kartlar başarıyla listelendi.", gizli);
    }
    return ApiResponse.ok(res, "Cari kartlar başarıyla listelendi.", list);
  });

  /**
   * GET /api/v1/cari/:id
   */
  public static getCariKartById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const item = await CariService.getCariKartById(req.params.id, dbContext);
    return ApiResponse.ok(res, "Cari kart detayı getirildi.", item);
  });

  /**
   * POST /api/v1/cari
   */
  public static createCariKart = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const kullaniciId = (req.user as any)?.userId ? Number((req.user as any).userId) : undefined;
    const created = await CariService.createCariKart(req.body, dbContext, kullaniciId);
    return ApiResponse.created(res, "Cari kart başarıyla oluşturuldu.", created);
  });

  /**
   * PUT /api/v1/cari/:id
   */
  public static updateCariKart = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const kullaniciId = (req.user as any)?.userId ? Number((req.user as any).userId) : undefined;
    const updated = await CariService.updateCariKart(req.params.id, req.body, dbContext, kullaniciId);
    return ApiResponse.ok(res, "Cari kart başarıyla güncellendi.", updated);
  });

  /**
   * DELETE /api/v1/cari/:id
   */
  public static deleteCariKart = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    await CariService.deleteCariKart(req.params.id, dbContext);
    return ApiResponse.ok(res, "Cari kart başarıyla silindi.", { id: req.params.id });
  });

  // ─── Fotoğraf Endpoints ───────────────────────────────────────────────────

  /**
   * GET /api/v1/cari/:id/fotograf
   */
  public static getCariFotograf = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const fotos = await CariService.getAllCariFotograflar(req.params.id, dbContext);
    const primary = fotos.length > 0 ? fotos[0] : null;
    return ApiResponse.ok(res, "Cari fotoğrafları getirildi.", {
      fotograf: primary,
      fotograflar: fotos,
      // Doğrudan primary özelliklerini de döndürerek geriye dönük tam uyumluluk sağla
      ...(primary || {}),
    });
  });

  /**
   * POST /api/v1/cari/:id/fotograf
   */
  public static saveCariFotograf = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const kullaniciId = (req.user as any)?.userId ? Number((req.user as any).userId) : undefined;
    const foto = await CariService.saveCariFotograf(
      req.params.id,
      req.body,
      kullaniciId,
      dbContext
    );
    return ApiResponse.ok(res, "Cari fotoğrafı başarıyla kaydedildi.", foto);
  });

  /**
   * DELETE /api/v1/cari/:id/fotograf
   */
  public static deleteCariFotograf = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariController.getDbContext(req);
    const fotografId = req.query.fotografId ? Number(req.query.fotografId) : undefined;
    await CariService.deleteCariFotograf(req.params.id, fotografId, dbContext);
    return ApiResponse.ok(res, "Cari fotoğrafı başarıyla silindi.");
  });
}
