import { Request, Response } from "express";
import { fisVeznesi } from "../services/yetki/fisVeznesi.js";
import { cariGunSiniri, fisKayitYetkisi, gunSiniri, kayitErisimi, sonrakiGun } from "../services/yetki/fisYetkileri.js";
import { kullaniciYetkisi, yetkiGerekli } from "../services/yetki/kullaniciYetkisi.js";
import { CariHareketService } from "../services/cariHareket.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class CariHareketController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body.dbName as string),
    };
  }

  private static getUserId(req: Request): number {
    const u = req.user as any;
    return u?.id ? Number(u.id) : (u?.userId ? Number(u.userId) : 1);
  }

  /**
   * GET /api/v1/cari-hareket
   */
  public static list = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariHareketController.getDbContext(req);
    const userId = CariHareketController.getUserId(req);
    const yetkiler = await kullaniciYetkisi(req);
    let onlyOwnRecords = false;
    let userVezneId: number | undefined = undefined;
    if (yetkiler.kendiKayitlari) {
      onlyOwnRecords = true;
      userVezneId = (await fisVeznesi(userId, dbContext)) ?? undefined;
    }

    let effectiveGunSiniri = await gunSiniri(req);
    const cariKartIdNum = req.query.cariKartId ? Number(req.query.cariKartId) : undefined;
    if (cariKartIdNum) {
      const cSinir = await cariGunSiniri(cariKartIdNum, req);
      if (cSinir) {
        effectiveGunSiniri = sonrakiGun(effectiveGunSiniri, cSinir);
      }
    }

    const filters = {
      // Kullanıcının veya cari kartın işlem gösterme sınırı istekteki başlangıçtan sonraysa o geçerli (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
      startDate: (sonrakiGun(req.query.startDate as string, effectiveGunSiniri) ?? undefined) as string,
      endDate: req.query.endDate as string,
      cariKartId: cariKartIdNum,
      vezneId: req.query.vezneId ? Number(req.query.vezneId) : undefined,
      tip: req.query.tip !== undefined ? Number(req.query.tip) : undefined,
      hareketTipi: req.query.hareketTipi !== undefined ? Number(req.query.hareketTipi) : undefined,
      search: req.query.search as string,
      onlyCariHareket: String(req.query.onlyCariHareket) === "true",
      kaynak: req.query.kaynak as string,
      onlyOwnRecords,
      userId,
      userVezneId,
      cariSinirlamaTipi: !yetkiler.yonetici ? yetkiler.cariSinirlamaTipi : 0,
    };

    const list = await CariHareketService.list(filters, dbContext);
    return ApiResponse.ok(res, "Cari hareketler başarıyla listelendi.", list);
  });

  /**
   * GET /api/v1/cari-hareket/:id
   */
  public static getById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariHareketController.getDbContext(req);
    await kayitErisimi(req, "cariHareket", req.params.id);
    const item = await CariHareketService.getById(req.params.id, dbContext);
    return ApiResponse.ok(res, "Cari hareket detayı getirildi.", item);
  });

  /**
   * POST /api/v1/cari-hareket
   */
  public static create = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariHareketController.getDbContext(req);
    const userId = CariHareketController.getUserId(req);
    const { yetki } = await fisKayitYetkisi(req, "cariHareket", null, req.body?.tarih);
    // Sınırsız yetkili yönetici istediği vezneyi seçebilir; değilse kart veznesi kullanılır
    const vezneId = (yetki.yonetici && req.body?.vezneId && Number(req.body.vezneId) > 0)
      ? Number(req.body.vezneId)
      : await fisVeznesi(userId, dbContext);
    const created = await CariHareketService.create({ ...req.body, vezneId }, userId, dbContext);
    return ApiResponse.created(res, "Cari hareket başarıyla kaydedildi.", created);
  });

  /**
   * PUT /api/v1/cari-hareket/:id
   */
  public static update = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariHareketController.getDbContext(req);
    const userId = CariHareketController.getUserId(req);
    const { yetki } = await fisKayitYetkisi(req, "cariHareket", req.params.id, req.body?.tarih);
    // Sınırsız yetkili yönetici istediği vezneyi seçebilir; değilse kaydın veznesi korunur
    const vezneId = (yetki.yonetici && req.body?.vezneId && Number(req.body.vezneId) > 0)
      ? Number(req.body.vezneId)
      : await fisVeznesi(userId, dbContext, { tur: "cariHareket", id: req.params.id });
    const updated = await CariHareketService.update(req.params.id, { ...req.body, vezneId }, userId, dbContext);
    return ApiResponse.ok(res, "Cari hareket başarıyla güncellendi.", updated);
  });

  /**
   * DELETE /api/v1/cari-hareket/:id
   */
  public static delete = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariHareketController.getDbContext(req);
    await kayitErisimi(req, "cariHareket", req.params.id, { isDelete: true });
    await CariHareketService.delete(req.params.id, dbContext);
    return ApiResponse.ok(res, "Cari hareket başarıyla silindi.", { id: req.params.id });
  });

  /**
   * GET /api/v1/cari-hareket/navigation/:id?
   */
  public static getNavigation = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariHareketController.getDbContext(req);
    const userId = CariHareketController.getUserId(req);
    const yetkiler = await kullaniciYetkisi(req);
    let userFilter: { userId: number; userVezneId?: number } | undefined = undefined;
    if (yetkiler.kendiKayitlari) {
      const userVezneId = (await fisVeznesi(userId, dbContext)) ?? undefined;
      userFilter = { userId, userVezneId };
    }
    let effectiveGunSiniri = await gunSiniri(req);
    const cariKartIdNum = req.query.cariKartId ? Number(req.query.cariKartId) : undefined;
    if (cariKartIdNum) {
      const cSinir = await cariGunSiniri(cariKartIdNum, req);
      if (cSinir) {
        effectiveGunSiniri = sonrakiGun(effectiveGunSiniri, cSinir);
      }
    }
    const nav = await CariHareketService.getNavigation(req.params.id, dbContext, effectiveGunSiniri, userFilter);
    return ApiResponse.ok(res, "Navigasyon bilgisi getirildi.", nav);
  });

  /**
   * GET /api/v1/cari-hareket/bakiye/:cariKartId
   */
  public static getCariBakiye = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = CariHareketController.getDbContext(req);
    await yetkiGerekli(req, (y) => y.cariBakiye, 'Cari bakiyeyi görmek için "Cari bakiye görebilir" yetkisi gerekir.');
    const bakiye = await CariHareketService.getCariBakiye(req.params.cariKartId, dbContext);
    return ApiResponse.ok(res, "Cari bakiye bilgisi getirildi.", bakiye);
  });
}
