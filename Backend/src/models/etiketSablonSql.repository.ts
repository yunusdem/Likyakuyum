import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

// ETIKET_TIPI: 0 = Altın/Sarrafiye, 1 = Özel/Pırlanta, 2 = Yüzük-Bilezik, 3 = Fiyat-Ayar
export interface EtiketSablonAlan {
  key: string;
  ad: string;
  aktif: boolean;
  sira: number;
}

export interface EtiketSablonModel {
  etiketSablonId: number;
  ad: string;
  etiketTipi: number;
  genislikMm: number;
  yukseklikMm: number;
  kuyrukPayiMm: number;
  logoKonumu: string; // sol-ust | sag-ust | orta-ust | yok
  barkodTipi: string; // CODE128 | QR
  alanlar: EtiketSablonAlan[];
  varsayilan: boolean;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveEtiketSablonDto {
  etiketSablonId?: number | null;
  ad: string;
  etiketTipi: number;
  genislikMm?: number;
  yukseklikMm?: number;
  kuyrukPayiMm?: number;
  logoKonumu?: string;
  barkodTipi?: string;
  alanlar?: EtiketSablonAlan[];
  varsayilan?: boolean;
}

export class EtiketSablonSqlRepository {
  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_ETIKET_SABLON', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_ETIKET_SABLON] (
            [ETIKET_SABLON_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [AD] VARCHAR(100) NOT NULL,
            [ETIKET_TIPI] TINYINT NOT NULL DEFAULT 0,
            [GENISLIK_MM] FLOAT NOT NULL DEFAULT 40,
            [YUKSEKLIK_MM] FLOAT NOT NULL DEFAULT 25,
            [KUYRUK_PAYI_MM] FLOAT NOT NULL DEFAULT 0,
            [LOGO_KONUMU] VARCHAR(20) NOT NULL DEFAULT 'sol-ust',
            [BARKOD_TIPI] VARCHAR(10) NOT NULL DEFAULT 'CODE128',
            [ALANLAR_JSON] VARCHAR(MAX) NULL,
            [VARSAYILAN] BIT NOT NULL DEFAULT 0,
            [EKLEYEN_ID] INT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;
      `);
    } catch (err: any) {
      logger.warn(`[EtiketSablonSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  private static async ensureProcedures(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_ETIKET_SABLON_KAYDET]
          @ETIKET_SABLON_ID INT OUTPUT,
          @AD VARCHAR(100),
          @ETIKET_TIPI TINYINT,
          @GENISLIK_MM FLOAT,
          @YUKSEKLIK_MM FLOAT,
          @KUYRUK_PAYI_MM FLOAT,
          @LOGO_KONUMU VARCHAR(20),
          @BARKOD_TIPI VARCHAR(10),
          @ALANLAR_JSON VARCHAR(MAX),
          @VARSAYILAN BIT,
          @KULLANICI_ID INT = NULL
        AS
        BEGIN
          SET NOCOUNT ON;
          DECLARE @HATA_MESAJI VARCHAR(500);
          DECLARE @SIMDIKI_ZAMAN DATETIME = GETDATE();

          -- Eğer ID verilmemişse fakat aynı isimde şablon zaten varsa, mevcut kaydı güncellemek üzere ID'sini al
          IF @ETIKET_SABLON_ID IS NULL OR @ETIKET_SABLON_ID = 0
          BEGIN
            SELECT TOP 1 @ETIKET_SABLON_ID = ETIKET_SABLON_ID 
            FROM TODVZ_ETIKET_SABLON 
            WHERE AD = @AD;
          END

          BEGIN TRAN;

          IF @VARSAYILAN = 1
            UPDATE TODVZ_ETIKET_SABLON SET VARSAYILAN = 0 WHERE ETIKET_TIPI = @ETIKET_TIPI;

          IF @ETIKET_SABLON_ID IS NULL OR @ETIKET_SABLON_ID = 0
          BEGIN
            INSERT INTO TODVZ_ETIKET_SABLON (
              AD, ETIKET_TIPI, GENISLIK_MM, YUKSEKLIK_MM, KUYRUK_PAYI_MM, LOGO_KONUMU, BARKOD_TIPI,
              ALANLAR_JSON, VARSAYILAN, EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
            )
            VALUES (
              @AD, @ETIKET_TIPI, @GENISLIK_MM, @YUKSEKLIK_MM, @KUYRUK_PAYI_MM, @LOGO_KONUMU, @BARKOD_TIPI,
              @ALANLAR_JSON, @VARSAYILAN, @KULLANICI_ID, @SIMDIKI_ZAMAN, @KULLANICI_ID, @SIMDIKI_ZAMAN
            );
            IF @@ERROR<>0 GOTO UNDO
            SET @ETIKET_SABLON_ID = SCOPE_IDENTITY();
          END
          ELSE
          BEGIN
            UPDATE TODVZ_ETIKET_SABLON
              SET AD = @AD, ETIKET_TIPI = @ETIKET_TIPI, GENISLIK_MM = @GENISLIK_MM, YUKSEKLIK_MM = @YUKSEKLIK_MM,
                  KUYRUK_PAYI_MM = @KUYRUK_PAYI_MM, LOGO_KONUMU = @LOGO_KONUMU, BARKOD_TIPI = @BARKOD_TIPI,
                  ALANLAR_JSON = @ALANLAR_JSON, VARSAYILAN = @VARSAYILAN,
                  GUNCELLEYEN_ID = @KULLANICI_ID, GUNCELLEME_ZAMANI = @SIMDIKI_ZAMAN
              WHERE ETIKET_SABLON_ID = @ETIKET_SABLON_ID;
            IF @@ERROR<>0 GOTO UNDO
          END

          COMMIT TRAN;
          RETURN 0;
        UNDO:
          ROLLBACK TRAN;
          IF @HATA_MESAJI IS NULL SET @HATA_MESAJI = 'Etiket şablonu kaydedilemedi';
          RAISERROR (@HATA_MESAJI, 16, 1);
          RETURN 1;
        END
      `);

      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_ETIKET_SABLON_SIL]
          @ETIKET_SABLON_ID INT
        AS
        BEGIN
          SET NOCOUNT ON;
          DELETE FROM TODVZ_ETIKET_SABLON WHERE ETIKET_SABLON_ID = @ETIKET_SABLON_ID;
          IF @@ERROR<>0
          BEGIN
            RAISERROR ('Etiket şablonu silinemedi.', 16, 1);
            RETURN 1;
          END
          RETURN 0;
        END
      `);
    } catch (e: any) {
      logger.warn("[EtiketSablonSqlRepository.ensureProcedures] Warning:", e.message || e);
    }
  }

  private static mapRow(r: any): EtiketSablonModel {
    let alanlar: EtiketSablonAlan[] = [];
    try {
      alanlar = r.ALANLAR_JSON ? JSON.parse(r.ALANLAR_JSON) : [];
    } catch {
      alanlar = [];
    }
    return {
      etiketSablonId: r.ETIKET_SABLON_ID,
      ad: (r.AD || "").trim(),
      etiketTipi: Number(r.ETIKET_TIPI),
      genislikMm: Number(r.GENISLIK_MM) || 0,
      yukseklikMm: Number(r.YUKSEKLIK_MM) || 0,
      kuyrukPayiMm: Number(r.KUYRUK_PAYI_MM) || 0,
      logoKonumu: (r.LOGO_KONUMU || "sol-ust").trim(),
      barkodTipi: (r.BARKOD_TIPI || "CODE128").trim(),
      alanlar,
      varsayilan: Boolean(r.VARSAYILAN),
      ekleyenId: r.EKLEYEN_ID,
      eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : null,
      guncelleyenId: r.GUNCELLEYEN_ID,
      guncellemeZamani: r.GUNCELLEME_ZAMANI ? new Date(r.GUNCELLEME_ZAMANI).toISOString() : null,
    };
  }

  public static async list(
    filter?: { etiketTipi?: number },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<EtiketSablonModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    let query = `SELECT * FROM TODVZ_ETIKET_SABLON WHERE 1=1`;
    const req = pool.request();
    if (filter?.etiketTipi !== undefined) {
      query += ` AND ETIKET_TIPI = @ETIKET_TIPI`;
      req.input("ETIKET_TIPI", sql.TinyInt, filter.etiketTipi);
    }
    query += ` ORDER BY VARSAYILAN DESC, AD ASC`;
    const res = await req.query(query);
    return (res.recordset || []).map((r: any) => this.mapRow(r));
  }

  public static async getById(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<EtiketSablonModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    const res = await pool.request().input("ID", sql.Int, id).query(`SELECT * FROM TODVZ_ETIKET_SABLON WHERE ETIKET_SABLON_ID = @ID`);
    if (!res.recordset?.length) return null;
    return this.mapRow(res.recordset[0]);
  }

  public static async save(
    dto: SaveEtiketSablonDto,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<EtiketSablonModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    let targetId = dto.etiketSablonId && Number(dto.etiketSablonId) > 0 ? Number(dto.etiketSablonId) : null;
    if (!targetId && (dto.ad || "").trim()) {
      try {
        const existRes = await pool
          .request()
          .input("AD", sql.VarChar(100), (dto.ad || "").trim())
          .query("SELECT TOP 1 ETIKET_SABLON_ID FROM dbo.TODVZ_ETIKET_SABLON WHERE AD = @AD");
        if (existRes.recordset && existRes.recordset.length > 0) {
          targetId = Number(existRes.recordset[0].ETIKET_SABLON_ID);
        }
      } catch {}
    }
    const req = pool.request();
    req.output("ETIKET_SABLON_ID", sql.Int, targetId);
    req.input("AD", sql.VarChar(100), (dto.ad || "").trim());
    req.input("ETIKET_TIPI", sql.TinyInt, Number(dto.etiketTipi) || 0);
    req.input("GENISLIK_MM", sql.Float, Number(dto.genislikMm) || 40);
    req.input("YUKSEKLIK_MM", sql.Float, Number(dto.yukseklikMm) || 25);
    req.input("KUYRUK_PAYI_MM", sql.Float, Number(dto.kuyrukPayiMm) || 0);
    req.input("LOGO_KONUMU", sql.VarChar(20), dto.logoKonumu || "sol-ust");
    req.input("BARKOD_TIPI", sql.VarChar(10), dto.barkodTipi || "CODE128");
    req.input("ALANLAR_JSON", sql.VarChar(sql.MAX), JSON.stringify(dto.alanlar || []));
    req.input("VARSAYILAN", sql.Bit, dto.varsayilan ? 1 : 0);
    req.input("KULLANICI_ID", sql.Int, kullaniciId || null);

    let result: any = null;
    try {
      result = await req.execute("SODVZ_ETIKET_SABLON_KAYDET");
    } catch (err: any) {
      logger.error("[EtiketSablonSqlRepository.save] Error:", err);
      throw ApiError.badRequest(err.message || "Etiket şablonu kaydedilemedi.");
    }

    let savedId =
      Number(result?.output?.ETIKET_SABLON_ID) ||
      Number(req.parameters.ETIKET_SABLON_ID?.value) ||
      targetId;

    if (!savedId) {
      const lookup = await pool
        .request()
        .input("AD", sql.VarChar(100), (dto.ad || "").trim())
        .query(
          "SELECT TOP 1 ETIKET_SABLON_ID FROM dbo.TODVZ_ETIKET_SABLON WHERE AD = @AD ORDER BY ETIKET_SABLON_ID DESC"
        );
      if (lookup.recordset && lookup.recordset.length > 0) {
        savedId = Number(lookup.recordset[0].ETIKET_SABLON_ID);
      }
    }

    if (!savedId) throw ApiError.internal("Etiket şablonu kaydedildi ancak kimlik bilgisi alınamadı.");

    const saved = await this.getById(savedId, dbContext);
    if (!saved) throw ApiError.internal("Etiket şablonu kaydedildi ancak okunamadı.");
    return saved;
  }

  public static async remove(id: number, dbContext?: { dbServer?: string; dbName?: string }): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);
    try {
      await pool.request().input("ETIKET_SABLON_ID", sql.Int, id).execute("SODVZ_ETIKET_SABLON_SIL");
      return true;
    } catch (err: any) {
      logger.error(`[EtiketSablonSqlRepository.remove(${id})] Error:`, err);
      throw ApiError.badRequest(err.message || "Etiket şablonu silinemedi.");
    }
  }
}
