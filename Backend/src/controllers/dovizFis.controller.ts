import { Request, Response } from "express";
import { DovizFisService } from "../services/dovizFis.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class DovizFisController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.headers["x-db-server"] as string) || (req.query.dbServer as string) || (req.body?.dbServer as string),
      dbName: req.user?.dbName || (req.headers["x-db-name"] as string) || (req.query.dbName as string) || (req.body?.dbName as string),
    };
  }

  /**
   * GET /api/v1/doviz-fis
   */
  public static getFisList = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = DovizFisController.getDbContext(req);
    const filter = {
      search: req.query.search as string,
      tip: req.query.tip !== undefined ? Number(req.query.tip) : undefined,
      vezneId: req.query.vezneId ? Number(req.query.vezneId) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    };
    const list = await DovizFisService.getFisList(filter, dbContext);
    return ApiResponse.ok(res, "Döviz fişleri listelendi.", list);
  });

  /**
   * GET /api/v1/doviz-fis/:id
   */
  public static getFisById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = DovizFisController.getDbContext(req);
    const id = Number(req.params.id);
    const fis = await DovizFisService.getFisById(id, dbContext);
    return ApiResponse.ok(res, "Döviz fişi detayları getirildi.", fis);
  });

  /**
   * POST /api/v1/doviz-fis/kaydet
   * Calls Stored Procedure SODVZ_FIS_KAYDET
   */
  public static saveFis = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = DovizFisController.getDbContext(req);
    const u = req.user as any;
    const kullaniciId = u?.userId || u?.id || req.body.kullaniciId || 1;
    const vezneId = (req.body.vezneId && Number(req.body.vezneId) > 0)
      ? Number(req.body.vezneId)
      : (u?.vezneId && Number(u.vezneId) > 0 ? Number(u.vezneId) : kullaniciId);

    const payload = {
      ...req.body,
      kullaniciId,
      vezneId,
      cariKartId: (req.body.cariKartId && Number(req.body.cariKartId) > 0) ? Number(req.body.cariKartId) : null,
    };
    const saved = await DovizFisService.saveFis(payload, dbContext);
    return ApiResponse.ok(res, "Döviz fişi başarıyla kaydedildi.", saved);
  });

  /**
   * DELETE /api/v1/doviz-fis/:id
   */
  public static deleteFis = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = DovizFisController.getDbContext(req);
    const id = Number(req.params.id);
    const u = req.user as any;
    const kullaniciId = u?.userId || u?.id || 1;
    await DovizFisService.deleteFis(id, dbContext, kullaniciId);
    return ApiResponse.ok(res, "Döviz fişi başarıyla silindi.", { fisId: id });
  });

  /**
   * GET /api/v1/doviz-fis/vezne-bakiye/:vezneId
   */
  public static getVezneBakiye = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = DovizFisController.getDbContext(req);
    const vezneId = Number(req.params.vezneId) || 1;
    const bakiye = await DovizFisService.getVezneBakiye(vezneId, dbContext);
    return ApiResponse.ok(res, "Vezne bakiyesi getirildi.", bakiye);
  });

  /**
   * GET /api/v1/doviz-fis/debug-info
   */
  public static getDebugInfo = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = DovizFisController.getDbContext(req);
    const { getDbPool, getActivePool } = await import("../config/mssql.config.js");
    let pool = await getActivePool();
    if (!pool) {
      pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    }

    // 1. Foreign keys on TODVZ_FIS, TODVZ_FIS_SATIRI, TODVZ_VEZNE_BAKIYE
    let foreignKeys: any[] = [];
    try {
      const fkRes = await pool.request().query(`
        SELECT 
          f.name AS ForeignKeyName,
          OBJECT_NAME(f.parent_object_id) AS TableName,
          COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
          OBJECT_NAME (f.referenced_object_id) AS ReferenceTableName,
          COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferenceColumnName
        FROM sys.foreign_keys AS f
        INNER JOIN sys.foreign_key_columns AS fc 
          ON f.OBJECT_ID = fc.constraint_object_id
        WHERE OBJECT_NAME(f.parent_object_id) IN ('TODVZ_FIS', 'TODVZ_FIS_SATIRI', 'TODVZ_VEZNE_BAKIYE', 'TODVZ_KAYITSIZ_MUSTERI')
        ORDER BY TableName, ColumnName
      `);
      foreignKeys = fkRes.recordset || [];
    } catch (e: any) {
      foreignKeys = [{ error: e.message }];
    }

    // 2. Sample records
    let vezneler: any[] = [];
    let istatistikler: any[] = [];
    let kullanicilar: any[] = [];
    let tanim: any[] = [];
    let fisRecords: any[] = [];

    try {
      const vRes = await pool.request().query("SELECT TOP 5 VEZNE_ID, KOD, AD FROM TODVZ_VEZNE ORDER BY VEZNE_ID ASC");
      vezneler = vRes.recordset || [];
    } catch (e: any) { vezneler = [{ error: e.message }]; }

    try {
      const iRes = await pool.request().query("SELECT TOP 10 ISTATISTIK_ID, KOD, AD, FIS_DIZAYN_TIPI FROM TODVZ_ISTATISTIK ORDER BY ISTATISTIK_ID ASC");
      istatistikler = iRes.recordset || [];
    } catch (e: any) { istatistikler = [{ error: e.message }]; }

    try {
      const kRes = await pool.request().query("SELECT TOP 5 KULLANICI_ID, KOD, AD FROM TODVZ_KULLANICI ORDER BY KULLANICI_ID ASC");
      kullanicilar = kRes.recordset || [];
    } catch (e: any) { kullanicilar = [{ error: e.message }]; }

    try {
      const tRes = await pool.request().query("SELECT TOP 1 * FROM TODVZ_TANIM");
      tanim = tRes.recordset || [];
    } catch (e: any) { tanim = [{ error: e.message }]; }

    try {
      const fisRes = await pool.request().query("SELECT TOP 3 * FROM [dbo].[TODVZ_FIS] ORDER BY FIS_ID DESC");
      fisRecords = fisRes.recordset || [];
    } catch (e: any) { fisRecords = [{ error: e.message }]; }

    // 3. Dry-run test of SODVZ_FIS_KAYDET inside a rollback transaction to get the exact error!
    let dryRunResult: any = null;
    try {
      const dryRunReq = pool.request();
      const dryRunQuery = `
        BEGIN TRANSACTION;
        BEGIN TRY
          IF OBJECT_ID('tempdb..#TODVZ_ISKELE_FIS_SATIRI') IS NOT NULL
            DROP TABLE #TODVZ_ISKELE_FIS_SATIRI;

          CREATE TABLE #TODVZ_ISKELE_FIS_SATIRI (
            [GUID] VARCHAR(50) COLLATE database_default NOT NULL,
            [SATIR_NO] INT NOT NULL,
            [MIKTAR] DECIMAL(18,4) NOT NULL,
            [PARA_ID] INT NOT NULL,
            [KUR] DECIMAL(18,6) NOT NULL,
            [ISCILIK] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [GISE_KURU] DECIMAL(18,6) NOT NULL DEFAULT(1),
            [TUTAR] DECIMAL(18,4) NOT NULL,
            [KOMISYON_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KOMISYON] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [BMV_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [BMV] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KMV_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KMV] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KDV_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KDV] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [BANKA_HESABI_ID] INT NULL,
            [SERI_NO] VARCHAR(20) COLLATE database_default NULL,
            [BELGE_NO] VARCHAR(50) COLLATE database_default NULL,
            [ETTN] UNIQUEIDENTIFIER NULL,
            [E_BELGE_DURUMU] TINYINT NULL DEFAULT(0),
            [E_BELGE_HATA_ACIKLAMASI] VARCHAR(250) COLLATE database_default NULL
          );

          DECLARE @DEFAULT_PARA_ID INT;
          SELECT TOP 1 @DEFAULT_PARA_ID = PARA_ID FROM TODVZ_PARA ORDER BY PARA_ID ASC;
          IF @DEFAULT_PARA_ID IS NULL SET @DEFAULT_PARA_ID = 1;

          DECLARE @DEF_VEZNE_ID INT;
          SELECT TOP 1 @DEF_VEZNE_ID = VEZNE_ID FROM TODVZ_VEZNE ORDER BY VEZNE_ID ASC;
          IF @DEF_VEZNE_ID IS NULL SET @DEF_VEZNE_ID = 1;

          DECLARE @DEF_ISTATISTIK_ID INT;
          SELECT TOP 1 @DEF_ISTATISTIK_ID = ISTATISTIK_ID FROM TODVZ_ISTATISTIK ORDER BY ISTATISTIK_ID ASC;

          DECLARE @DEF_KULLANICI_ID INT;
          SELECT TOP 1 @DEF_KULLANICI_ID = KULLANICI_ID FROM TODVZ_KULLANICI ORDER BY KULLANICI_ID ASC;
          IF @DEF_KULLANICI_ID IS NULL SET @DEF_KULLANICI_ID = 1;

          INSERT INTO #TODVZ_ISKELE_FIS_SATIRI (
            [GUID], [SATIR_NO], [MIKTAR], [PARA_ID], [KUR], [ISCILIK], [GISE_KURU], [TUTAR],
            [KOMISYON_ORANI], [KOMISYON], [BMV_ORANI], [BMV], [KMV_ORANI], [KMV], [KDV_ORANI], [KDV],
            [BANKA_HESABI_ID], [SERI_NO], [BELGE_NO]
          ) VALUES (
            NEWID(), 0, 100, @DEFAULT_PARA_ID, 35.5, 0, 35.5, 3550,
            0, 0, 0, 0, 0, 0, 0, 0,
            NULL, NULL, NULL
          );

          DECLARE @OUT_FIS_ID INT = NULL;
          DECLARE @OUT_SERI VARCHAR(50) = NULL;
          DECLARE @OUT_BELGE VARCHAR(50) = NULL;
          DECLARE @OUT_YENI BIT = 0;

          EXEC [dbo].[SODVZ_FIS_KAYDET]
            @FIS_ID = @OUT_FIS_ID OUTPUT,
            @VEZNE_ID = @DEF_VEZNE_ID,
            @TIP = 0,
            @TARIH = '2026-09-11',
            @ZAMAN = '2026-09-11 11:00:00',
            @SERI_NO = @OUT_SERI OUTPUT,
            @BELGE_NO = @OUT_BELGE OUTPUT,
            @GELIS_NEDENI = 'TEST',
            @KUR_TURU = 0,
            @ISTATISTIK_ID = @DEF_ISTATISTIK_ID,
            @CARI_KART_ID = NULL,
            @UNVAN = 'TEST MUSTERI',
            @KISILIK_TIPI = 0,
            @UYRUK_ID = NULL,
            @ULKE_ID = NULL,
            @PASAPORT_NO = NULL,
            @HUKUKI_YAPI_ID = NULL,
            @VERGI_DAIRESI_ID = NULL,
            @VERGI_KIMLIK_NO = NULL,
            @BABA_ADI = NULL,
            @ADRES = NULL,
            @ILCE_ID = NULL,
            @POSTA_KODU_ID = NULL,
            @IL_ID = NULL,
            @VEKIL_TURU = 0,
            @VEKIL_KISILIK_TIPI = 0,
            @VEKIL_ADI = NULL,
            @VEKIL_KIMLIK_NO = NULL,
            @TOPLAM_TUTAR = 3550,
            @YUVARLAMA = 0,
            @ODEME_TUTARI = 3550,
            @BANKA_HESABI_ID = NULL,
            @KMV_UYGULAMA_SEKLI = 0,
            @EPOSTA = NULL,
            @MERKEZ_USD_KURU = 1,
            @GISE_USD_KURU = 1,
            @GM_BEYANNAME_TARIH = NULL,
            @GM_BEYANNAME_NO = NULL,
            @GM_DOVIZ_TARIH = NULL,
            @GM_DOVIZ_SAYI = NULL,
            @GM_TEYIT_TARIH = NULL,
            @GM_TEYIT_SAYI = NULL,
            @GM_FATURA_NO = NULL,
            @ARBITRAJ_ID = NULL,
            @TELEFON_NO = NULL,
            @MESLEK_ID = NULL,
            @DOGUM_TARIHI = NULL,
            @DOGUM_YERI = NULL,
            @KIMLIK_SERI_NO = NULL,
            @ANNE_ADI = NULL,
            @IPTAL = 0,
            @IPTAL_TARIHI = NULL,
            @MASAK_LISTESINDE_VAR = 0,
            @SUPHELI_ISLEMLER_YETKILI_ID = NULL,
            @YUVARLAMA_ARALIGI = 0,
            @YUVARLAMA_ESIGI = 0,
            @E_FATURA_POSTA_KUTUSU = NULL,
            @BELGE_TURU = 0,
            @KIMLIK_GECERLILIK_TARIHI = NULL,
            @KIMLIK_BELGE_TURU = 0,
            @KULLANICI_ID = @DEF_KULLANICI_ID,
            @YAZICI_ID = NULL,
            @GUID = NULL,
            @DEGISIKLIK_TAKIP_VAR = 0,
            @YENI_KAYIT = @OUT_YENI OUTPUT;

          SELECT @OUT_FIS_ID AS OUT_FIS_ID, @OUT_SERI AS OUT_SERI, @OUT_BELGE AS OUT_BELGE, 'SUCCESS' AS STATUS;
          ROLLBACK TRANSACTION;
        END TRY
        BEGIN CATCH
          DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
          DECLARE @ErrSeverity INT = ERROR_SEVERITY();
          DECLARE @ErrState INT = ERROR_STATE();
          DECLARE @ErrLine INT = ERROR_LINE();
          DECLARE @ErrProc NVARCHAR(200) = ERROR_PROCEDURE();
          ROLLBACK TRANSACTION;
          SELECT 
            @ErrMsg AS ErrorMessage, 
            @ErrSeverity AS ErrorSeverity, 
            @ErrState AS ErrorState, 
            @ErrLine AS ErrorLine, 
            @ErrProc AS ErrorProcedure,
            'CAUGHT_ERROR' AS STATUS;
        END CATCH
      `;
      const dryRes = await dryRunReq.query(dryRunQuery);
      dryRunResult = dryRes.recordset?.[0] || dryRes.recordsets;
    } catch (err: any) {
      dryRunResult = { error: err.message, precedingErrors: err.precedingErrors };
    }

    return ApiResponse.ok(res, "Debug bilgileri", {
      foreignKeys,
      vezneler,
      istatistikler,
      kullanicilar,
      tanim,
      fisRecords,
      dryRunResult,
    });
  });
}
