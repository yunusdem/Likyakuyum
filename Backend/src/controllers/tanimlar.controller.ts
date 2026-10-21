import { Request, Response } from "express";
import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { CariSqlRepository } from "../models/cariSql.repository.js";
import { CariService } from "../services/cari.service.js";
import { TabloMaddesiSqlRepository } from "../models/tabloMaddesiSql.repository.js";

export class TanimlarController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body?.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body?.dbName as string),
    };
  }

  /**
   * GET /api/v1/tanimlar/tablo-maddesi?tur=11&q=
   */
  public static getTabloMaddeleri = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const tur = Number(req.query.tur);
    const search = req.query.q ? String(req.query.q) : undefined;
    if (isNaN(tur)) {
      throw ApiError.badRequest("Geçerli bir 'tur' parametresi belirtilmelidir.");
    }
    const list = await TabloMaddesiSqlRepository.listByTur(tur, search, dbContext);
    return ApiResponse.ok(res, "Tablo maddeleri listelendi.", list);
  });

  /**
   * POST /api/v1/tanimlar/tablo-maddesi
   */
  public static saveTabloMaddesi = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const { id, tur, ad, kod } = req.body;
    if (tur === undefined || isNaN(Number(tur))) {
      throw ApiError.badRequest("Geçerli bir 'tur' belirtilmelidir.");
    }
    if (!ad || !String(ad).trim()) {
      throw ApiError.badRequest("Tanım adı zorunludur.");
    }
    const result = await TabloMaddesiSqlRepository.save(
      {
        id: id ? Number(id) : null,
        tur: Number(tur),
        ad: String(ad).trim(),
        kod: kod ? String(kod).trim() : null,
      },
      dbContext
    );
    return ApiResponse.ok(res, "Tablo maddesi kaydedildi.", result);
  });

  /**
   * DELETE /api/v1/tanimlar/tablo-maddesi/:id
   */
  public static deleteTabloMaddesi = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      throw ApiError.badRequest("Geçerli bir ID belirtilmelidir.");
    }
    await TabloMaddesiSqlRepository.delete(id, dbContext);
    return ApiResponse.ok(res, "Tablo maddesi silindi.", { id });
  });

  /**
   * GET /api/v1/tanimlar/ulkeler
   */
  public static getUlkeler = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const lookups = await CariSqlRepository.getLookups(dbContext);
    return ApiResponse.ok(res, "Ülkeler listelendi.", lookups.ulkeList || []);
  });

  /**
   * POST /api/v1/tanimlar/ulkeler
   */
  public static saveUlke = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const { ad, kod } = req.body;
    if (!ad || !String(ad).trim()) {
      throw ApiError.badRequest("Ülke adı zorunludur.");
    }
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    const cleanAd = String(ad).trim();
    const cleanKod = kod ? String(kod).trim().toUpperCase() : null;
    const targetId = req.body.id || (req.params?.id ? Number(req.params.id) : null);

    if (targetId && Number(targetId) > 0) {
      await pool.request()
        .input("id", sql.Int, Number(targetId))
        .input("ad", sql.NVarChar(255), cleanAd)
        .input("kod", sql.NVarChar(50), cleanKod)
        .query(`
          UPDATE [dbo].[TODVZ_ULKE]
          SET [AD] = @ad, [KOD] = @kod
          WHERE [ULKE_ID] = @id;
        `);
      return ApiResponse.ok(res, "Ülke başarıyla güncellendi.", { id: Number(targetId), ad: cleanAd, kod: cleanKod });
    }

    let savedItem: { id: number; ad: string; kod: string | null };
    try {
      const insRes = await pool.request()
        .input("ad", sql.NVarChar(255), cleanAd)
        .input("kod", sql.NVarChar(50), cleanKod)
        .query(`
          INSERT INTO [dbo].[TODVZ_ULKE] ([AD], [KOD])
          VALUES (@ad, @kod);
          SELECT SCOPE_IDENTITY() as newId;
        `);
      const newId = insRes.recordset[0]?.newId;
      savedItem = { id: Number(newId), ad: cleanAd, kod: cleanKod };
    } catch (err: any) {
      // If ULKE_ID is not an IDENTITY column, insert with MAX + 1
      const maxRes = await pool.request().query(`SELECT ISNULL(MAX([ULKE_ID]), 0) + 1 as nextId FROM [dbo].[TODVZ_ULKE]`);
      const nextId = Number(maxRes.recordset[0]?.nextId || 1);
      await pool.request()
        .input("id", sql.Int, nextId)
        .input("ad", sql.NVarChar(255), cleanAd)
        .input("kod", sql.NVarChar(50), cleanKod)
        .query(`
          INSERT INTO [dbo].[TODVZ_ULKE] ([ULKE_ID], [AD], [KOD])
          VALUES (@id, @ad, @kod);
        `);
      savedItem = { id: nextId, ad: cleanAd, kod: cleanKod };
    }

    return ApiResponse.created(res, "Ülke başarıyla kaydedildi.", savedItem);
  });

  /**
   * GET /api/v1/tanimlar/uyruklar
   * (TODVZ_TABLO_MADDESI or TODVZ_ULKE)
   */
  public static getUyruklar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const lookups = await CariSqlRepository.getLookups(dbContext);
    return ApiResponse.ok(res, "Uyruklar listelendi.", lookups.ulkeList || []);
  });

  /**
   * GET /api/v1/tanimlar/iller
   * TODVZ_TABLO_MADDESI (TUR = 3)
   */
  public static getIller = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const lookups = await CariSqlRepository.getLookups(dbContext);
    return ApiResponse.ok(res, "İller listelendi.", lookups.ilList || []);
  });

  /**
   * GET /api/v1/tanimlar/ilceler?ilId=
   * TODVZ_TABLO_MADDESI (TUR = 2) — canlı veritabanında doğrulandı (11.09.2026).
   */
  public static getIlceler = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const lookups = await CariSqlRepository.getLookups(dbContext);
    let list = lookups.ilceList || [];
    const ilId = req.query.ilId ? Number(req.query.ilId) : null;
    if (ilId) {
      list = list.filter((x: any) => x.ustId === ilId || !x.ustId || x.ustId === 0);
    }
    return ApiResponse.ok(res, "İlçeler listelendi.", list);
  });

  /**
   * GET /api/v1/tanimlar/posta-kodlari
   * TODVZ_TABLO_MADDESI (TUR = 1; eski program posta kodunu burada tutar, TUR = 4 geçiş satırları) —
   * canlı veritabanında doğrulandı (20.10.2026).
   */
  public static getPostaKodlari = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const lookups = await CariSqlRepository.getLookups(dbContext);
    return ApiResponse.ok(res, "Posta kodları listelendi.", lookups.postaKoduList || []);
  });

  /**
   * GET /api/v1/tanimlar/vergi-daireleri
   * TODVZ_TABLO_MADDESI (TUR = 0)
   */
  public static getVergiDaireleri = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const lookups = await CariSqlRepository.getLookups(dbContext);
    return ApiResponse.ok(res, "Vergi daireleri listelendi.", lookups.vergiDairesiList || []);
  });

  /**
   * GET /api/v1/tanimlar/meslekler
   * TODVZ_TABLO_MADDESI (TUR = 9)
   */
  public static getMeslekler = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const lookups = await CariSqlRepository.getLookups(dbContext);
    return ApiResponse.ok(res, "Meslekler listelendi.", lookups.meslekList || []);
  });

  /**
   * GET /api/v1/tanimlar/banka-hesaplari
   * Cari kartlar (Banka olanlar veya tüm cari kartlar)
   */
  public static getBankaHesaplari = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const cariler = await CariService.listCariKartlar(dbContext);
    return ApiResponse.ok(res, "Banka hesapları listelendi.", cariler || []);
  });

  /**
   * GET /api/v1/tanimlar/hukuki-yapilar
   * TODVZ_TABLO_MADDESI
   */
  public static getHukukiYapilar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = TanimlarController.getDbContext(req);
    const lookups = await CariSqlRepository.getLookups(dbContext);
    return ApiResponse.ok(res, "Hukuki yapılar listelendi.", lookups.hukukiYapiList || []);
  });
}
