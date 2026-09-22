import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface IskontoModel {
  iskontoId: number;
  tanim: string;
  kod?: string | null;
  iskontoTipi?: number | null; // 1: Yüzde (%), 2: Sabit Tutar (TL), 3: Altın/Has Gram, NULL: Serbest
  oran?: number | null;
  tutar?: number | null;
  hasTutar?: number | null;
  minTutar?: number | null;
  maxIskontoTutari?: number | null;
  aktif: boolean;
  aciklama?: string | null;
  eklemeZamani?: string | null;
  guncellemeZamani?: string | null;
}

export interface SaveIskontoDto {
  iskontoId?: number | null;
  tanim: string;
  kod?: string | null;
  iskontoTipi?: number | null;
  oran?: number | null;
  tutar?: number | null;
  hasTutar?: number | null;
  minTutar?: number | null;
  maxIskontoTutari?: number | null;
  aktif?: boolean;
  aciklama?: string | null;
}

export class IskontoSqlRepository {
  /**
   * TODVZ_ISKONTO tablosunun ve SODVZ_ISKONTO_KAYDET, SODVZ_ISKONTO_SIL
   * stored procedure'larının var olduğunu denetler ve gerekirse oluşturur.
   */
  public static async ensureSchema(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('dbo.TODVZ_ISKONTO', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TODVZ_ISKONTO (
            ISKONTO_ID          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TODVZ_ISKONTO PRIMARY KEY,
            TANIM               VARCHAR(100) NOT NULL,
            KOD                 VARCHAR(50) NULL,
            ISKONTO_TIPI        TINYINT NULL,
            ORAN                FLOAT NULL,
            TUTAR               FLOAT NULL,
            HAS_TUTAR           FLOAT NULL,
            MIN_TUTAR           FLOAT NULL,
            MAX_ISKONTO_TUTARI  FLOAT NULL,
            AKTIF               BIT NOT NULL DEFAULT 1,
            ACIKLAMA            VARCHAR(250) NULL,
            EKLEME_ZAMANI       DATETIME NOT NULL DEFAULT GETDATE(),
            GUNCELLEME_ZAMANI   DATETIME NULL
          );
        END;
      `);

      await pool.request().batch(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_ISKONTO_KAYDET
          @ISKONTO_ID         INT = NULL OUTPUT,
          @TANIM              VARCHAR(100),
          @KOD                VARCHAR(50) = NULL,
          @ISKONTO_TIPI       TINYINT = NULL,
          @ORAN               FLOAT = NULL,
          @TUTAR              FLOAT = NULL,
          @HAS_TUTAR          FLOAT = NULL,
          @MIN_TUTAR          FLOAT = NULL,
          @MAX_ISKONTO_TUTARI FLOAT = NULL,
          @AKTIF              BIT = 1,
          @ACIKLAMA           VARCHAR(250) = NULL
        AS
        BEGIN
          SET NOCOUNT ON;

          IF (@ISKONTO_ID IS NULL OR @ISKONTO_ID = 0)
          BEGIN
            INSERT INTO dbo.TODVZ_ISKONTO (
              TANIM, KOD, ISKONTO_TIPI, ORAN, TUTAR, HAS_TUTAR,
              MIN_TUTAR, MAX_ISKONTO_TUTARI, AKTIF, ACIKLAMA,
              EKLEME_ZAMANI
            )
            VALUES (
              @TANIM, @KOD, @ISKONTO_TIPI, @ORAN, @TUTAR, @HAS_TUTAR,
              @MIN_TUTAR, @MAX_ISKONTO_TUTARI, @AKTIF, @ACIKLAMA,
              GETDATE()
            );

            SET @ISKONTO_ID = SCOPE_IDENTITY();
          END
          ELSE
          BEGIN
            UPDATE dbo.TODVZ_ISKONTO
            SET TANIM               = @TANIM,
                KOD                 = @KOD,
                ISKONTO_TIPI        = @ISKONTO_TIPI,
                ORAN                = @ORAN,
                TUTAR               = @TUTAR,
                HAS_TUTAR           = @HAS_TUTAR,
                MIN_TUTAR           = @MIN_TUTAR,
                MAX_ISKONTO_TUTARI  = @MAX_ISKONTO_TUTARI,
                AKTIF               = @AKTIF,
                ACIKLAMA            = @ACIKLAMA,
                GUNCELLEME_ZAMANI   = GETDATE()
            WHERE ISKONTO_ID = @ISKONTO_ID;
          END

          RETURN 0;
        END;
      `);

      await pool.request().batch(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_ISKONTO_SIL
          @ISKONTO_ID INT,
          @KALICI_SIL BIT = 1
        AS
        BEGIN
          SET NOCOUNT ON;

          IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_ISKONTO WHERE ISKONTO_ID = @ISKONTO_ID)
          BEGIN
            RAISERROR ('İskonto tanımı bulunamadı.', 16, 1);
            RETURN 1;
          END

          DELETE FROM dbo.TODVZ_ISKONTO WHERE ISKONTO_ID = @ISKONTO_ID;

          RETURN 0;
        END;
      `);
    } catch (err: any) {
      logger.error(`IskontoSqlRepository.ensureSchema hatası: ${err?.message || err}`);
    }
  }

  public static async listIskontolar(
    filter?: { search?: string; aktif?: boolean },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IskontoModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureSchema(pool);

    let query = `
      SELECT
        ISKONTO_ID, TANIM, KOD, ISKONTO_TIPI, ORAN, TUTAR, HAS_TUTAR,
        MIN_TUTAR, MAX_ISKONTO_TUTARI, AKTIF, ACIKLAMA,
        EKLEME_ZAMANI, GUNCELLEME_ZAMANI
      FROM dbo.TODVZ_ISKONTO
      WHERE 1=1
    `;
    const request = pool.request();

    if (filter?.aktif !== undefined) {
      query += ` AND AKTIF = @AKTIF`;
      request.input("AKTIF", sql.Bit, filter.aktif ? 1 : 0);
    }
    if (filter?.search && filter.search.trim()) {
      query += ` AND (TANIM LIKE @SEARCH OR KOD LIKE @SEARCH OR ACIKLAMA LIKE @SEARCH)`;
      request.input("SEARCH", sql.VarChar(100), `%${filter.search.trim()}%`);
    }
    query += ` ORDER BY ISKONTO_ID ASC, EKLEME_ZAMANI ASC`;

    const res = await request.query(query);
    return (res.recordset || []).map((r: any) => ({
      iskontoId: r.ISKONTO_ID,
      tanim: (r.TANIM || "").trim(),
      kod: r.KOD ? (r.KOD || "").trim() : null,
      iskontoTipi: r.ISKONTO_TIPI !== null && r.ISKONTO_TIPI !== undefined ? Number(r.ISKONTO_TIPI) : null,
      oran: r.ORAN !== null && r.ORAN !== undefined ? Number(r.ORAN) : null,
      tutar: r.TUTAR !== null && r.TUTAR !== undefined ? Number(r.TUTAR) : null,
      hasTutar: r.HAS_TUTAR !== null && r.HAS_TUTAR !== undefined ? Number(r.HAS_TUTAR) : null,
      minTutar: r.MIN_TUTAR !== null && r.MIN_TUTAR !== undefined ? Number(r.MIN_TUTAR) : null,
      maxIskontoTutari: r.MAX_ISKONTO_TUTARI !== null && r.MAX_ISKONTO_TUTARI !== undefined ? Number(r.MAX_ISKONTO_TUTARI) : null,
      aktif: Boolean(r.AKTIF),
      aciklama: r.ACIKLAMA ? (r.ACIKLAMA || "").trim() : null,
      eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : null,
      guncellemeZamani: r.GUNCELLEME_ZAMANI ? new Date(r.GUNCELLEME_ZAMANI).toISOString() : null,
    }));
  }

  public static async getIskontoById(
    iskontoId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IskontoModel | null> {
    const list = await this.listIskontolar(undefined, dbContext);
    return list.find((i) => i.iskontoId === iskontoId) || null;
  }

  public static async saveIskonto(
    dto: SaveIskontoDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IskontoModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureSchema(pool);

    const targetId = dto.iskontoId && Number(dto.iskontoId) > 0 ? Number(dto.iskontoId) : null;
    const tanim = (dto.tanim || "").trim();
    if (!tanim) {
      throw ApiError.badRequest("İskonto tanımı zorunludur.");
    }

    let kod = dto.kod ? (dto.kod || "").trim() : null;
    if (!kod) {
      try {
        const rows = await pool.request().query(`
          SELECT KOD FROM dbo.TODVZ_ISKONTO WHERE KOD IS NOT NULL
        `);
        const existingCodes = new Set<string>();
        let maxNum = 0;
        (rows.recordset || []).forEach((r: any) => {
          const k = String(r.KOD || "").trim().toUpperCase();
          existingCodes.add(k);
          const match = k.match(/^ISK(\d+)$/);
          if (match) {
            const n = parseInt(match[1], 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          }
        });
        let candidateNum = Math.max(maxNum + 1, (rows.recordset?.length || 0) + 1);
        let candidateCode = `ISK${String(candidateNum).padStart(3, "0")}`;
        while (existingCodes.has(candidateCode)) {
          candidateNum++;
          candidateCode = `ISK${String(candidateNum).padStart(3, "0")}`;
        }
        kod = candidateCode;
      } catch {
        kod = "ISK001";
      }
    }

    const request = pool.request();
    request.input("TARGET_ID", sql.Int, targetId);
    request.input("TANIM", sql.VarChar(100), tanim);
    request.input("KOD", sql.VarChar(50), kod);
    request.input("ISKONTO_TIPI", sql.TinyInt, dto.iskontoTipi !== undefined && dto.iskontoTipi !== null ? Number(dto.iskontoTipi) : null);
    request.input("ORAN", sql.Float, dto.oran !== undefined && dto.oran !== null && dto.oran !== ("" as any) ? Number(dto.oran) : null);
    request.input("TUTAR", sql.Float, dto.tutar !== undefined && dto.tutar !== null && dto.tutar !== ("" as any) ? Number(dto.tutar) : null);
    request.input("HAS_TUTAR", sql.Float, dto.hasTutar !== undefined && dto.hasTutar !== null && dto.hasTutar !== ("" as any) ? Number(dto.hasTutar) : null);
    request.input("MIN_TUTAR", sql.Float, dto.minTutar !== undefined && dto.minTutar !== null && dto.minTutar !== ("" as any) ? Number(dto.minTutar) : null);
    request.input("MAX_ISKONTO_TUTARI", sql.Float, dto.maxIskontoTutari !== undefined && dto.maxIskontoTutari !== null && dto.maxIskontoTutari !== ("" as any) ? Number(dto.maxIskontoTutari) : null);
    request.input("AKTIF", sql.Bit, dto.aktif !== undefined ? (dto.aktif ? 1 : 0) : 1);
    request.input("ACIKLAMA", sql.VarChar(250), dto.aciklama ? dto.aciklama.trim() : null);

    const batchQuery = `
      SET NOCOUNT ON;
      DECLARE @OUT_ID INT = @TARGET_ID;

      EXEC dbo.SODVZ_ISKONTO_KAYDET
        @ISKONTO_ID         = @OUT_ID OUTPUT,
        @TANIM              = @TANIM,
        @KOD                = @KOD,
        @ISKONTO_TIPI       = @ISKONTO_TIPI,
        @ORAN               = @ORAN,
        @TUTAR              = @TUTAR,
        @HAS_TUTAR          = @HAS_TUTAR,
        @MIN_TUTAR          = @MIN_TUTAR,
        @MAX_ISKONTO_TUTARI = @MAX_ISKONTO_TUTARI,
        @AKTIF              = @AKTIF,
        @ACIKLAMA           = @ACIKLAMA;

      SELECT
        ISKONTO_ID, TANIM, KOD, ISKONTO_TIPI, ORAN, TUTAR, HAS_TUTAR,
        MIN_TUTAR, MAX_ISKONTO_TUTARI, AKTIF, ACIKLAMA,
        EKLEME_ZAMANI, GUNCELLEME_ZAMANI
      FROM dbo.TODVZ_ISKONTO
      WHERE ISKONTO_ID = @OUT_ID;
    `;

    const res = await request.query(batchQuery);
    const row = res.recordset?.[0];
    if (!row) {
      throw ApiError.internal("İskonto kartı kaydedildikten sonra getirilemedi.");
    }

    return {
      iskontoId: row.ISKONTO_ID,
      tanim: (row.TANIM || "").trim(),
      kod: row.KOD ? (row.KOD || "").trim() : null,
      iskontoTipi: row.ISKONTO_TIPI !== null && row.ISKONTO_TIPI !== undefined ? Number(row.ISKONTO_TIPI) : null,
      oran: row.ORAN !== null && row.ORAN !== undefined ? Number(row.ORAN) : null,
      tutar: row.TUTAR !== null && row.TUTAR !== undefined ? Number(row.TUTAR) : null,
      hasTutar: row.HAS_TUTAR !== null && row.HAS_TUTAR !== undefined ? Number(row.HAS_TUTAR) : null,
      minTutar: row.MIN_TUTAR !== null && row.MIN_TUTAR !== undefined ? Number(row.MIN_TUTAR) : null,
      maxIskontoTutari: row.MAX_ISKONTO_TUTARI !== null && row.MAX_ISKONTO_TUTARI !== undefined ? Number(row.MAX_ISKONTO_TUTARI) : null,
      aktif: Boolean(row.AKTIF),
      aciklama: row.ACIKLAMA ? (row.ACIKLAMA || "").trim() : null,
      eklemeZamani: row.EKLEME_ZAMANI ? new Date(row.EKLEME_ZAMANI).toISOString() : null,
      guncellemeZamani: row.GUNCELLEME_ZAMANI ? new Date(row.GUNCELLEME_ZAMANI).toISOString() : null,
    };
  }

  public static async deleteIskonto(
    iskontoId: number,
    kaliciSil: boolean = true,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureSchema(pool);

    const request = pool.request();
    request.input("ISKONTO_ID", sql.Int, iskontoId);
    request.input("KALICI_SIL", sql.Bit, kaliciSil ? 1 : 0);

    await request.execute("dbo.SODVZ_ISKONTO_SIL");
    return true;
  }
}
