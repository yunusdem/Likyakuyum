import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

// TIP: 0 = Altın Ürün grubu numaratörü, 1 = Özel Ürün grubu numaratörü
export interface EtiketGrupNoResult {
  grupKodu: string;
  sonNo: number;
  barkod: string;
  yeniGrup: boolean;
}

export class EtiketNumeratorSqlRepository {
  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_ETIKET_GRUP_NO', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_ETIKET_GRUP_NO] (
            [TIP] TINYINT NOT NULL,
            [GRUP_KODU] VARCHAR(50) NOT NULL,
            [SON_NO] INT NOT NULL DEFAULT 0,
            [ACIKLAMA] VARCHAR(100) NULL,
            [GUNCELLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            CONSTRAINT [PK_TODVZ_ETIKET_GRUP_NO] PRIMARY KEY CLUSTERED ([TIP] ASC, [GRUP_KODU] ASC)
          );
        END;
        ELSE
        BEGIN
          IF EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'TODVZ_ETIKET_GRUP_NO' 
              AND COLUMN_NAME = 'GRUP_KODU' 
              AND (CHARACTER_MAXIMUM_LENGTH < 50 OR CHARACTER_MAXIMUM_LENGTH IS NULL)
          )
          BEGIN
            DECLARE @pkName NVARCHAR(256);
            SELECT @pkName = name FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('TODVZ_ETIKET_GRUP_NO') AND type = 'PK';
            IF @pkName IS NOT NULL
              EXEC('ALTER TABLE TODVZ_ETIKET_GRUP_NO DROP CONSTRAINT ' + @pkName);
            
            ALTER TABLE TODVZ_ETIKET_GRUP_NO ALTER COLUMN GRUP_KODU VARCHAR(50) NOT NULL;
            ALTER TABLE TODVZ_ETIKET_GRUP_NO ADD CONSTRAINT PK_TODVZ_ETIKET_GRUP_NO PRIMARY KEY CLUSTERED ([TIP] ASC, [GRUP_KODU] ASC);
          END
        END;
      `);
    } catch (err: any) {
      logger.warn(`[EtiketNumeratorSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  private static async ensureProcedures(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_ETIKET_GRUP_NO_URET]
          @TIP TINYINT,
          @GRUP_KODU VARCHAR(50),
          @SIRA_NO INT OUTPUT,
          @YENI_GRUP BIT OUTPUT
        AS
        BEGIN
          SET NOCOUNT ON;
          BEGIN TRAN

          DECLARE @MAX_MEVCUT INT = 0;
          IF @TIP = 0
          BEGIN
            SELECT @MAX_MEVCUT = ISNULL(MAX(URUN_NO), 0) FROM TODVZ_ALTIN_URUN WHERE UPPER(LTRIM(RTRIM(GRUP_KODU))) = UPPER(LTRIM(RTRIM(@GRUP_KODU)));
          END
          ELSE
          BEGIN
            SELECT @MAX_MEVCUT = ISNULL(MAX(URUN_NO), 0) FROM TODVZ_OZEL_URUN WHERE UPPER(LTRIM(RTRIM(GRUP_KODU))) = UPPER(LTRIM(RTRIM(@GRUP_KODU)));
          END

          IF NOT EXISTS (
            SELECT 1 FROM TODVZ_ETIKET_GRUP_NO WITH (UPDLOCK, HOLDLOCK)
            WHERE TIP = @TIP AND UPPER(LTRIM(RTRIM(GRUP_KODU))) = UPPER(LTRIM(RTRIM(@GRUP_KODU)))
          )
          BEGIN
            SET @SIRA_NO = @MAX_MEVCUT + 1;
            INSERT INTO TODVZ_ETIKET_GRUP_NO (TIP, GRUP_KODU, SON_NO, GUNCELLEME_ZAMANI)
              VALUES (@TIP, UPPER(LTRIM(RTRIM(@GRUP_KODU))), @SIRA_NO, GETDATE());
            SET @YENI_GRUP = 1;
          END
          ELSE
          BEGIN
            DECLARE @SON_NO INT;
            SELECT @SON_NO = SON_NO FROM TODVZ_ETIKET_GRUP_NO WITH (UPDLOCK, HOLDLOCK)
            WHERE TIP = @TIP AND UPPER(LTRIM(RTRIM(GRUP_KODU))) = UPPER(LTRIM(RTRIM(@GRUP_KODU)));

            IF @MAX_MEVCUT >= @SON_NO
              SET @SIRA_NO = @MAX_MEVCUT + 1;
            ELSE
              SET @SIRA_NO = @SON_NO + 1;

            UPDATE TODVZ_ETIKET_GRUP_NO
              SET SON_NO = @SIRA_NO, GUNCELLEME_ZAMANI = GETDATE()
              WHERE TIP = @TIP AND UPPER(LTRIM(RTRIM(GRUP_KODU))) = UPPER(LTRIM(RTRIM(@GRUP_KODU)));
            SET @YENI_GRUP = 0;
          END

          IF @@ERROR<>0 GOTO UNDO
          COMMIT TRAN
          RETURN 0
        UNDO:
          ROLLBACK TRAN
          RAISERROR ('Grup numaratörü üretilemedi', 16, 1)
          RETURN 1
        END
      `);
    } catch (e: any) {
      logger.warn("[EtiketNumeratorSqlRepository.ensureProcedures] Warning:", e.message || e);
    }
  }

  /**
   * Verilen grup kodu için sıradaki benzersiz ürün numarasını üretir ve buna göre
   * bir barkod string'i döner.
   */
  public static async getNextNo(
    tip: 0 | 1,
    grupKodu: string,
    uzunluk: number = 5,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<EtiketGrupNoResult> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const kod = (grupKodu || "").trim().toUpperCase();
    if (!kod) throw ApiError.badRequest("Grup kodu zorunludur.");

    const req = pool.request();
    req.input("TIP", sql.TinyInt, tip);
    req.input("GRUP_KODU", sql.VarChar(50), kod);
    req.output("SIRA_NO", sql.Int);
    req.output("YENI_GRUP", sql.Bit);

    try {
      await req.execute("SODVZ_ETIKET_GRUP_NO_URET");
    } catch (err: any) {
      logger.error("[EtiketNumeratorSqlRepository.getNextNo] Error:", err);
      throw ApiError.badRequest(err.message || "Grup numaratörü üretilemedi.");
    }

    let sonNo = Number(req.parameters.SIRA_NO?.value) || 1;
    const yeniGrup = Boolean(req.parameters.YENI_GRUP?.value);

    // Ek güvenlik: Eğer veritabanında bu numara zaten kayıtlıysa üstüne çık
    try {
      const checkTable = tip === 0 ? "TODVZ_ALTIN_URUN" : "TODVZ_OZEL_URUN";
      const maxRes = await pool.request()
        .input("GRUP_KODU", sql.VarChar(50), kod)
        .query(`SELECT ISNULL(MAX(URUN_NO), 0) AS MAX_NO FROM ${checkTable} WHERE UPPER(LTRIM(RTRIM(GRUP_KODU))) = @GRUP_KODU`);
      const maxDbNo = Number(maxRes.recordset?.[0]?.MAX_NO) || 0;
      if (maxDbNo >= sonNo) {
        sonNo = maxDbNo + 1;
      }
    } catch (maxErr) {
      logger.warn("[EtiketNumeratorSqlRepository.getNextNo] Fallback max check error:", maxErr);
    }

    const barkod = `${kod}${String(sonNo).padStart(Math.max(uzunluk, String(sonNo).length), "0")}`;

    return { grupKodu: kod, sonNo, barkod, yeniGrup };
  }

  public static async listGruplar(
    tip?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<Array<{ tip: number; grupKodu: string; sonNo: number; aciklama?: string | null; guncellemeZamani: string }>> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    const req = pool.request();
    let query = `
      SELECT [TIP], [GRUP_KODU], [SON_NO], [ACIKLAMA], [GUNCELLEME_ZAMANI]
      FROM [dbo].[TODVZ_ETIKET_GRUP_NO]
    `;
    if (tip !== undefined && tip !== null) {
      req.input("TIP", sql.TinyInt, tip);
      query += ` WHERE [TIP] = @TIP`;
    }
    query += ` ORDER BY [GRUP_KODU] ASC;`;

    const res = await req.query(query);
    return (res.recordset || []).map((r) => ({
      tip: r.TIP,
      grupKodu: (r.GRUP_KODU || "").trim(),
      sonNo: r.SON_NO ?? 0,
      aciklama: r.ACIKLAMA ? (r.ACIKLAMA as string).trim() : null,
      guncellemeZamani: r.GUNCELLEME_ZAMANI,
    }));
  }

  public static async saveGrup(
    tip: number,
    grupKodu: string,
    aciklama?: string | null,
    baslangicNo?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ tip: number; grupKodu: string; sonNo: number; aciklama?: string | null }> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    const kod = (grupKodu || "").trim().toUpperCase();
    if (!kod) throw ApiError.badRequest("Grup kodu zorunludur.");

    const sonNo = baslangicNo !== undefined && baslangicNo !== null && !isNaN(Number(baslangicNo)) ? Number(baslangicNo) : 0;

    const req = pool.request();
    req.input("TIP", sql.TinyInt, tip);
    req.input("GRUP_KODU", sql.VarChar(50), kod);
    req.input("ACIKLAMA", sql.VarChar(100), aciklama ? aciklama.trim().slice(0, 100) : null);
    req.input("SON_NO", sql.Int, sonNo);

    await req.query(`
      IF EXISTS (SELECT 1 FROM [dbo].[TODVZ_ETIKET_GRUP_NO] WHERE [TIP] = @TIP AND [GRUP_KODU] = @GRUP_KODU)
      BEGIN
        UPDATE [dbo].[TODVZ_ETIKET_GRUP_NO]
        SET [ACIKLAMA] = @ACIKLAMA,
            [GUNCELLEME_ZAMANI] = GETDATE()
        WHERE [TIP] = @TIP AND [GRUP_KODU] = @GRUP_KODU;
      END
      ELSE
      BEGIN
        INSERT INTO [dbo].[TODVZ_ETIKET_GRUP_NO] ([TIP], [GRUP_KODU], [SON_NO], [ACIKLAMA], [GUNCELLEME_ZAMANI])
        VALUES (@TIP, @GRUP_KODU, @SON_NO, @ACIKLAMA, GETDATE());
      END;
    `);

    return { tip, grupKodu: kod, sonNo, aciklama: aciklama || null };
  }

  public static async deleteGrup(
    tip: number,
    grupKodu: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    const kod = (grupKodu || "").trim().toUpperCase();
    const req = pool.request();
    req.input("TIP", sql.TinyInt, tip);
    req.input("GRUP_KODU", sql.VarChar(50), kod);

    await req.query(`
      DELETE FROM [dbo].[TODVZ_ETIKET_GRUP_NO]
      WHERE [TIP] = @TIP AND [GRUP_KODU] = @GRUP_KODU;
    `);
    return true;
  }
}
