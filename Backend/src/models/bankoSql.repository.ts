import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface BankoModel {
  bankoId: number;
  bankoKodu: string;
  bankoAdi: string;
  vezneId?: number | null;
  aciklama?: string | null;
  aktif: boolean;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveBankoDto {
  bankoId?: number | null;
  bankoKodu?: string | null;
  bankoAdi: string;
  vezneId?: number | null;
  aciklama?: string | null;
  aktif?: boolean;
}

export class BankoSqlRepository {
  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('dbo.TODVZ_BANKO', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.TODVZ_BANKO (
                BANKO_ID          INT IDENTITY(1,1) NOT NULL,
                BANKO_KODU        VARCHAR(20)       NOT NULL, -- Orn: BNK-01, VTR-01
                BANKO_ADI         VARCHAR(100)      NOT NULL, -- Orn: Banko 1, Vitrin Ön, Özel Kasa Bankosu
                VEZNE_ID          INT               NULL,     -- Bagli oldugu vezne/kasa
                ACIKLAMA          VARCHAR(250)      NULL,
                AKTIF             BIT               NOT NULL DEFAULT (1),
                EKLEYEN_ID        INT               NULL,
                EKLEME_ZAMANI     DATETIME          NOT NULL DEFAULT (GETDATE()),
                GUNCELLEYEN_ID    INT               NULL,
                GUNCELLEME_ZAMANI DATETIME          NULL,

                CONSTRAINT PK_TODVZ_BANKO PRIMARY KEY CLUSTERED (BANKO_ID),
                CONSTRAINT UK_TODVZ_BANKO_KOD UNIQUE NONCLUSTERED (BANKO_KODU)
            );
        END;

        -- Varsayilan Banko Verileri
        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_BANKO WHERE BANKO_KODU = 'BNK-01')
            INSERT INTO dbo.TODVZ_BANKO (BANKO_KODU, BANKO_ADI, ACIKLAMA) VALUES ('BNK-01', 'Banko 1', 'Ana Vitrin Ön Bankosu');

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_BANKO WHERE BANKO_KODU = 'BNK-02')
            INSERT INTO dbo.TODVZ_BANKO (BANKO_KODU, BANKO_ADI, ACIKLAMA) VALUES ('BNK-02', 'Banko 2', 'Pırlanta / Özel Ürün Bankosu');
      `);
    } catch (err: any) {
      logger.warn(`[BankoSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  public static async ensureProcedures(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().query(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_BANKO_KAYDET
            @BANKO_ID         INT OUTPUT,
            @BANKO_KODU       VARCHAR(20) = NULL,
            @BANKO_ADI        VARCHAR(100),
            @VEZNE_ID         INT = NULL,
            @ACIKLAMA         VARCHAR(250) = NULL,
            @AKTIF            BIT = 1,
            @KULLANICI_ID     INT = NULL,
            @YENI_KAYIT       BIT = 0 OUTPUT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @HATA_MESAJI VARCHAR(500);
            DECLARE @SIMDIKI_ZAMAN DATETIME = GETDATE();

            SET @BANKO_KODU = UPPER(LTRIM(RTRIM(ISNULL(@BANKO_KODU, ''))));

            IF (@BANKO_ID IS NULL OR @BANKO_ID = 0)
                SET @YENI_KAYIT = 1;
            ELSE
                SET @YENI_KAYIT = 0;

            -- Kod bos gelirse otomatik uret (BNK-01, BNK-02 ...)
            IF @YENI_KAYIT = 1 AND (@BANKO_KODU IS NULL OR @BANKO_KODU = '')
            BEGIN
                DECLARE @SON_NO INT;
                SELECT @SON_NO = ISNULL(MAX(TRY_CAST(SUBSTRING(BANKO_KODU, 5, 20) AS INT)), 0) + 1
                FROM dbo.TODVZ_BANKO
                WHERE BANKO_KODU LIKE 'BNK-%';

                SET @BANKO_KODU = 'BNK-' + RIGHT('00' + CAST(@SON_NO AS VARCHAR(10)), 2);
            END

            -- Mukerrer Kontrolleri
            IF @YENI_KAYIT = 1 AND EXISTS (SELECT 1 FROM dbo.TODVZ_BANKO WHERE BANKO_KODU = @BANKO_KODU)
            BEGIN
                SET @HATA_MESAJI = RTRIM(@BANKO_KODU) + ' banko kodu zaten kayıtlı.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            IF @YENI_KAYIT = 0 AND EXISTS (SELECT 1 FROM dbo.TODVZ_BANKO WHERE BANKO_KODU = @BANKO_KODU AND BANKO_ID <> @BANKO_ID)
            BEGIN
                SET @HATA_MESAJI = RTRIM(@BANKO_KODU) + ' banko kodu başka bir banko tanımında kullanılıyor.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            BEGIN TRAN;

            IF @YENI_KAYIT = 1
            BEGIN
                INSERT INTO dbo.TODVZ_BANKO (
                    BANKO_KODU,
                    BANKO_ADI,
                    VEZNE_ID,
                    ACIKLAMA,
                    AKTIF,
                    EKLEYEN_ID,
                    EKLEME_ZAMANI,
                    GUNCELLEYEN_ID,
                    GUNCELLEME_ZAMANI
                )
                VALUES (
                    @BANKO_KODU,
                    @BANKO_ADI,
                    @VEZNE_ID,
                    @ACIKLAMA,
                    @AKTIF,
                    @KULLANICI_ID,
                    @SIMDIKI_ZAMAN,
                    @KULLANICI_ID,
                    @SIMDIKI_ZAMAN
                );

                IF @@ERROR <> 0
                BEGIN
                    ROLLBACK TRAN;
                    RAISERROR ('Banko kaydı eklenemedi.', 16, 1);
                    RETURN 1;
                END

                SET @BANKO_ID = SCOPE_IDENTITY();
            END
            ELSE
            BEGIN
                UPDATE dbo.TODVZ_BANKO
                SET BANKO_KODU        = @BANKO_KODU,
                    BANKO_ADI         = @BANKO_ADI,
                    VEZNE_ID          = @VEZNE_ID,
                    ACIKLAMA          = @ACIKLAMA,
                    AKTIF             = @AKTIF,
                    GUNCELLEYEN_ID    = @KULLANICI_ID,
                    GUNCELLEME_ZAMANI = @SIMDIKI_ZAMAN
                WHERE BANKO_ID = @BANKO_ID;

                IF @@ERROR <> 0
                BEGIN
                    ROLLBACK TRAN;
                    RAISERROR ('Banko kaydı güncellenemedi.', 16, 1);
                    RETURN 1;
                END
            END

            COMMIT TRAN;
            RETURN 0;
        END;
      `);

      await pool.request().query(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_BANKO_SIL
            @BANKO_ID INT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @BANKO_ADI VARCHAR(100);

            SELECT @BANKO_ADI = BANKO_ADI 
            FROM dbo.TODVZ_BANKO 
            WHERE BANKO_ID = @BANKO_ID;

            IF @BANKO_ADI IS NULL
            BEGIN
                RAISERROR ('Silinmek istenen banko bulunamadı.', 16, 1);
                RETURN 1;
            END

            -- Stok baglanti kontrolu (Stoklarda banko kullaniliyor mu?)
            IF (OBJECT_ID('dbo.TODVZ_ALTIN_URUN', 'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.TODVZ_ALTIN_URUN WHERE BANKO = @BANKO_ADI))
               OR (OBJECT_ID('dbo.TODVZ_OZEL_URUN', 'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.TODVZ_OZEL_URUN WHERE BANKO = @BANKO_ADI))
            BEGIN
                RAISERROR ('Bu bankoya atanmış kayıtlı ürün stokları bulunduğundan silinemez.', 16, 1);
                RETURN 1;
            END

            DELETE FROM dbo.TODVZ_BANKO WHERE BANKO_ID = @BANKO_ID;
            RETURN 0;
        END;
      `);
    } catch (e: any) {
      logger.warn("[BankoSqlRepository.ensureProcedures] Warning:", e.message || e);
    }
  }

  private static mapRow(r: any): BankoModel {
    return {
      bankoId: r.BANKO_ID,
      bankoKodu: (r.BANKO_KODU || "").trim(),
      bankoAdi: (r.BANKO_ADI || "").trim(),
      vezneId: r.VEZNE_ID ?? null,
      aciklama: r.ACIKLAMA ? r.ACIKLAMA.trim() : null,
      aktif: Boolean(r.AKTIF),
      ekleyenId: r.EKLEYEN_ID,
      eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : null,
      guncelleyenId: r.GUNCELLEYEN_ID,
      guncellemeZamani: r.GUNCELLEME_ZAMANI ? new Date(r.GUNCELLEME_ZAMANI).toISOString() : null,
    };
  }

  public static async list(
    filter?: { search?: string; aktif?: boolean },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankoModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const req = pool.request();
    let query = `SELECT * FROM dbo.TODVZ_BANKO WHERE 1=1`;

    if (filter?.aktif !== undefined) {
      query += ` AND AKTIF = @AKTIF`;
      req.input("AKTIF", sql.Bit, filter.aktif ? 1 : 0);
    }
    if (filter?.search && filter.search.trim()) {
      query += ` AND (BANKO_KODU LIKE @SEARCH OR BANKO_ADI LIKE @SEARCH OR ACIKLAMA LIKE @SEARCH)`;
      req.input("SEARCH", sql.VarChar(100), `%${filter.search.trim()}%`);
    }
    query += ` ORDER BY BANKO_KODU ASC`;

    const res = await req.query(query);
    return (res.recordset || []).map((r: any) => this.mapRow(r));
  }

  public static async getById(
    bankoId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankoModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const res = await pool
      .request()
      .input("BANKO_ID", sql.Int, bankoId)
      .query(`SELECT TOP 1 * FROM dbo.TODVZ_BANKO WHERE BANKO_ID = @BANKO_ID`);

    if (!res.recordset || res.recordset.length === 0) return null;
    return this.mapRow(res.recordset[0]);
  }

  public static async save(
    dto: SaveBankoDto,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankoModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    if (!dto.bankoAdi || !dto.bankoAdi.trim()) {
      throw ApiError.badRequest("Banko adı zorunludur.");
    }

    const targetId = dto.bankoId && Number(dto.bankoId) > 0 ? Number(dto.bankoId) : null;
    const req = pool.request();
    req.output("BANKO_ID", sql.Int, targetId);
    req.input("BANKO_KODU", sql.VarChar(20), dto.bankoKodu ? dto.bankoKodu.trim().toUpperCase() : null);
    req.input("BANKO_ADI", sql.VarChar(100), dto.bankoAdi.trim());
    req.input("VEZNE_ID", sql.Int, dto.vezneId || null);
    req.input("ACIKLAMA", sql.VarChar(250), dto.aciklama ? dto.aciklama.trim() : null);
    req.input("AKTIF", sql.Bit, dto.aktif !== undefined ? (dto.aktif ? 1 : 0) : 1);
    req.input("KULLANICI_ID", sql.Int, kullaniciId || null);
    req.output("YENI_KAYIT", sql.Bit);

    let result: any = null;
    try {
      result = await req.execute("dbo.SODVZ_BANKO_KAYDET");
    } catch (err: any) {
      logger.error("[BankoSqlRepository.save] Error:", err);
      throw ApiError.badRequest(err.message || "Banko kaydedilemedi.");
    }

    const savedId = Number(result?.output?.BANKO_ID) || Number(req.parameters.BANKO_ID?.value) || targetId;
    if (!savedId) throw ApiError.internal("Banko kaydedildi ancak ID alınamadı.");

    const saved = await this.getById(savedId, dbContext);
    if (!saved) throw ApiError.internal("Banko kaydedildi ancak okunamadı.");
    return saved;
  }

  public static async remove(
    bankoId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    try {
      const req = pool.request();
      req.input("BANKO_ID", sql.Int, bankoId);
      await req.execute("dbo.SODVZ_BANKO_SIL");
      return true;
    } catch (err: any) {
      logger.error(`[BankoSqlRepository.remove(${bankoId})] Error:`, err);
      throw ApiError.badRequest(err.message || "Banko silinemedi.");
    }
  }
}
