import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface TodvzKurTablosuEntity {
  KUR_TABLOSU_ID: number;
  TARIH: Date;
  TUR: number;
  ZAMAN: Date;
}

export interface TodvzKurEntity {
  KUR_TABLOSU_ID: number;
  PARA_ID: number;
  DOVIZ_ALIS: number | null;
  DOVIZ_SATIS: number | null;
  EFEKTIF_ALIS: number | null;
  EFEKTIF_SATIS: number | null;
  PARITE: number | null;
  PARA_KOD?: string;
  PARA_AD?: string;
  SIRA_NO?: number;
}

export interface KurRowModel {
  paraId: number;
  kod: string;
  ad: string;
  siraNo: number;
  dovizAlis: number | null;
  dovizSatis: number | null;
  efektifAlis: number | null;
  efektifSatis: number | null;
  parite: number | null;
}

export interface KurTablosuModel {
  id: number;
  tur: number;
  tarih: string; // YYYY-MM-DD
  zaman: string; // ISO datetime
  kapanisKurTablosuId?: number | null;
  satirlar: KurRowModel[];
}

export interface SaveKurTablosuDto {
  id?: number | null;
  tur: number;
  zaman?: string | null;
  kaynakKurTablosuId?: number | null;
  satirlar?: {
    paraId: number;
    dovizAlis?: number | null;
    dovizSatis?: number | null;
    efektifAlis?: number | null;
    efektifSatis?: number | null;
    parite?: number | null;
  }[];
}

export class KurSqlRepository {
  /**
   * Automatically ensure tables TODVZ_KUR_TABLOSU, TODVZ_KUR and procedure SODVZ_KUR_TABLOSU_KAYDET exist
   */
  public static async ensureTablesAndProceduresExist(pool: sql.ConnectionPool): Promise<void> {
    const checkQuery = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_KUR_TABLOSU')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_KUR_TABLOSU] (
          [KUR_TABLOSU_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
          [TUR] TINYINT NOT NULL DEFAULT 0,
          [ZAMAN] DATETIME NOT NULL DEFAULT GETDATE()
        );
      END

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_KUR')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_KUR] (
          [KUR_TABLOSU_ID] INT NOT NULL,
          [PARA_ID] INT NOT NULL,
          [DOVIZ_ALIS] FLOAT NULL,
          [DOVIZ_SATIS] FLOAT NULL,
          [EFEKTIF_ALIS] FLOAT NULL,
          [EFEKTIF_SATIS] FLOAT NULL,
          [PARITE] FLOAT NULL,
          CONSTRAINT [PK_TODVZ_KUR] PRIMARY KEY CLUSTERED ([KUR_TABLOSU_ID] ASC, [PARA_ID] ASC)
        );
      END

      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SODVZ_KUR_TABLOSU_KAYDET]') AND type in (N'P', N'PC'))
      BEGIN
        EXEC('
          CREATE PROCEDURE [dbo].[SODVZ_KUR_TABLOSU_KAYDET]
            @KUR_TABLOSU_ID INT OUTPUT,
            @TUR TINYINT,
            @ZAMAN DATETIME = NULL,
            @KAYNAK_KUR_TABLOSU_ID INT = NULL,
            @KAPANIS_KUR_TABLOSU_ID INT OUTPUT
          AS
          BEGIN
            SET @KAPANIS_KUR_TABLOSU_ID = NULL
            DECLARE @HATA_MESAJI VARCHAR(250)
            SET @ZAMAN = ISNULL(@ZAMAN, GETDATE())
            DECLARE @TARIH DATETIME
            SET @TARIH = CONVERT(DATETIME, CONVERT(CHAR(10), @ZAMAN, 104), 104)
            IF @TUR IN (0,1)
            BEGIN
              IF @KUR_TABLOSU_ID IS NULL AND EXISTS(SELECT * FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE TUR = @TUR)
                SET @HATA_MESAJI = ''Kur tablosu sistemde kayıtlı''
            END
            ELSE IF EXISTS(SELECT * FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE KUR_TABLOSU_ID <> ISNULL(@KUR_TABLOSU_ID, 0) AND TUR = @TUR AND TARIH = @TARIH)
              SET @HATA_MESAJI = ''Kur tablosu sistemde kayıtlı''
            IF @HATA_MESAJI IS NOT NULL GOTO SON
            IF @KUR_TABLOSU_ID IS NULL
            BEGIN
              INSERT INTO [dbo].[TODVZ_KUR_TABLOSU] (TARIH, TUR, ZAMAN) VALUES(@TARIH, @TUR, @ZAMAN)
              SET @KUR_TABLOSU_ID = SCOPE_IDENTITY()
              IF @@ERROR<>0 SET @HATA_MESAJI = ''Kur tablosu güncellenemedi''
            END
            ELSE BEGIN
              UPDATE [dbo].[TODVZ_KUR_TABLOSU]
                SET TARIH = @TARIH, ZAMAN = @ZAMAN WHERE KUR_TABLOSU_ID = @KUR_TABLOSU_ID
              IF @@ERROR<>0 SET @HATA_MESAJI = ''Kur tablosu güncellenemedi''
            END
            IF @HATA_MESAJI IS NOT NULL GOTO SON
            IF @KAYNAK_KUR_TABLOSU_ID IS NOT NULL
            BEGIN
              DELETE FROM [dbo].[TODVZ_KUR] WHERE KUR_TABLOSU_ID = @KUR_TABLOSU_ID
              IF @@ERROR<>0 SET @HATA_MESAJI = ''Kapanış kur tablosu silinemedi''
              ELSE BEGIN
                INSERT INTO [dbo].[TODVZ_KUR] (KUR_TABLOSU_ID, PARA_ID, DOVIZ_ALIS, DOVIZ_SATIS, EFEKTIF_ALIS, EFEKTIF_SATIS, PARITE)
                  SELECT @KUR_TABLOSU_ID, PARA_ID, DOVIZ_ALIS, DOVIZ_SATIS, EFEKTIF_ALIS, EFEKTIF_SATIS, PARITE
                    FROM [dbo].[TODVZ_KUR]
                    WHERE KUR_TABLOSU_ID = @KAYNAK_KUR_TABLOSU_ID
                IF @@ERROR<>0 SET @HATA_MESAJI = ''Kapanış kur tablosu güncellenemedi''
              END
            END
            IF @HATA_MESAJI IS NOT NULL GOTO SON
            DECLARE @T TINYINT
            IF @TUR = 0 SET @T = 2
            ELSE IF @TUR = 1 SET @T = 3
            ELSE SET @T = NULL
            IF @T IS NOT NULL
              SELECT @KAPANIS_KUR_TABLOSU_ID = KUR_TABLOSU_ID FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE TUR = @T AND TARIH = @TARIH
          SON:
            IF @HATA_MESAJI IS NULL RETURN 0
            RAISERROR (@HATA_MESAJI,16,1)
            RETURN 1
          END
        ');
      END
    `;
    try {
      await pool.request().query(checkQuery);
    } catch (err) {
      logger.warn("KurSqlRepository.ensureTablesAndProceduresExist warning:", err);
    }
  }

  private static formatIso(d?: Date | null): string {
    if (!d) return new Date().toISOString();
    try {
      return new Date(d).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private static formatDateOnly(d?: Date | null): string {
    if (!d) return new Date().toISOString().split("T")[0];
    try {
      const dt = new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }

  /**
   * Find kur tablosu and joined rates
   */
  public static async findTablo(
    params: {
      tur: number;
      tarih?: string;
      id?: number;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<KurTablosuModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await KurSqlRepository.ensureTablesAndProceduresExist(pool);

    const { tur, tarih, id } = params;

    let header: TodvzKurTablosuEntity | null = null;

    if (id) {
      const res = await pool
        .request()
        .input("id", sql.Int, id)
        .query<TodvzKurTablosuEntity>("SELECT TOP 1 * FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [KUR_TABLOSU_ID] = @id");
      if (res.recordset.length > 0) header = res.recordset[0];
    } else if (tur === 0 || tur === 1) {
      // TUR 0 and TUR 1 have only one active record
      const res = await pool
        .request()
        .input("tur", sql.TinyInt, tur)
        .query<TodvzKurTablosuEntity>(
          "SELECT TOP 1 * FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [TUR] = @tur ORDER BY [KUR_TABLOSU_ID] DESC"
        );
      if (res.recordset.length > 0) {
        header = res.recordset[0];
      } else {
        // Automatically initialize the first record using procedure
        const initReq = pool.request();
        initReq.output("KUR_TABLOSU_ID", sql.Int, null);
        initReq.input("TUR", sql.TinyInt, tur);
        initReq.input("ZAMAN", sql.DateTime, new Date());
        initReq.input("KAYNAK_KUR_TABLOSU_ID", sql.Int, null);
        initReq.output("KAPANIS_KUR_TABLOSU_ID", sql.Int);

        await initReq.execute("SODVZ_KUR_TABLOSU_KAYDET");
        const newId = initReq.parameters.KUR_TABLOSU_ID.value;

        const createdRes = await pool
          .request()
          .input("id", sql.Int, newId)
          .query<TodvzKurTablosuEntity>("SELECT TOP 1 * FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [KUR_TABLOSU_ID] = @id");
        if (createdRes.recordset.length > 0) header = createdRes.recordset[0];
      }
    } else {
      // TUR 2 or 3 (Saklanan): query by tarih or latest
      const req = pool.request();
      req.input("tur", sql.TinyInt, tur);

      let q = "SELECT TOP 1 * FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [TUR] = @tur";
      if (tarih) {
        req.input("tarih", sql.Date, new Date(tarih));
        q += " AND CAST([TARIH] AS DATE) = CAST(@tarih AS DATE)";
      }
      q += " ORDER BY [ZAMAN] DESC, [KUR_TABLOSU_ID] DESC";

      const res = await req.query<TodvzKurTablosuEntity>(q);
      if (res.recordset.length > 0) {
        header = res.recordset[0];
      }
    }

    // Now fetch rates joined with TODVZ_PARA
    // All currencies from TODVZ_PARA are fetched so any active currency is represented
    const kurTablosuId = header ? header.KUR_TABLOSU_ID : 0;

    const ratesQuery = `
      SELECT 
        P.[PARA_ID],
        LTRIM(RTRIM(ISNULL(P.[KOD], ''))) AS [PARA_KOD],
        LTRIM(RTRIM(ISNULL(P.[AD], ''))) AS [PARA_AD],
        ISNULL(P.[SIRA_NO], 999) AS [SIRA_NO],
        K.[DOVIZ_ALIS],
        K.[DOVIZ_SATIS],
        K.[EFEKTIF_ALIS],
        K.[EFEKTIF_SATIS],
        K.[PARITE]
      FROM [dbo].[TODVZ_PARA] P
      LEFT JOIN [dbo].[TODVZ_KUR] K 
        ON P.[PARA_ID] = K.[PARA_ID] AND K.[KUR_TABLOSU_ID] = @kurTablosuId
      WHERE UPPER(LTRIM(RTRIM(ISNULL(P.[KOD], '')))) NOT IN ('TL', 'TRY', 'TL.', 'YTL', 'TRL')
        AND UPPER(LTRIM(RTRIM(ISNULL(P.[KOD], '')))) NOT LIKE 'TL%'
        AND UPPER(LTRIM(RTRIM(ISNULL(P.[AD], '')))) NOT LIKE '%TÜRK LİRASI%'
        AND UPPER(LTRIM(RTRIM(ISNULL(P.[AD], '')))) NOT LIKE '%TURK LIRASI%'
        AND UPPER(LTRIM(RTRIM(ISNULL(P.[AD], '')))) NOT LIKE '%TÜRK LIRA%'
        AND UPPER(LTRIM(RTRIM(ISNULL(P.[AD], '')))) NOT LIKE '%TURK LIRA%'
        AND UPPER(LTRIM(RTRIM(ISNULL(P.[AD], '')))) NOT LIKE '%YEREL%'
      ORDER BY P.[SIRA_NO] ASC, P.[PARA_ID] ASC;
    `;

    const ratesRes = await pool
      .request()
      .input("kurTablosuId", sql.Int, kurTablosuId)
      .query<TodvzKurEntity>(ratesQuery);

    const satirlar: KurRowModel[] = ratesRes.recordset.map((r) => ({
      paraId: r.PARA_ID,
      kod: r.PARA_KOD || "",
      ad: r.PARA_AD || "",
      siraNo: r.SIRA_NO ?? 999,
      dovizAlis: r.DOVIZ_ALIS !== null && r.DOVIZ_ALIS !== undefined && Number(r.DOVIZ_ALIS) !== 0 ? Number(r.DOVIZ_ALIS) : null,
      dovizSatis: r.DOVIZ_SATIS !== null && r.DOVIZ_SATIS !== undefined && Number(r.DOVIZ_SATIS) !== 0 ? Number(r.DOVIZ_SATIS) : null,
      efektifAlis: r.EFEKTIF_ALIS !== null && r.EFEKTIF_ALIS !== undefined && Number(r.EFEKTIF_ALIS) !== 0 ? Number(r.EFEKTIF_ALIS) : null,
      efektifSatis: r.EFEKTIF_SATIS !== null && r.EFEKTIF_SATIS !== undefined && Number(r.EFEKTIF_SATIS) !== 0 ? Number(r.EFEKTIF_SATIS) : null,
      parite: r.PARITE !== null && r.PARITE !== undefined && Number(r.PARITE) !== 0 ? Number(r.PARITE) : null,
    }));

    let kapanisId: number | null = null;
    if (tur === 0) {
      const kapRes = await pool.request().query<{ KUR_TABLOSU_ID: number }>(`
        SELECT TOP 1 [KUR_TABLOSU_ID]
        FROM [dbo].[TODVZ_KUR_TABLOSU]
        WHERE [TUR] = 2 AND CAST([TARIH] AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY [KUR_TABLOSU_ID] DESC
      `);
      if (kapRes.recordset.length > 0) {
        kapanisId = kapRes.recordset[0].KUR_TABLOSU_ID;
      }
    }

    if (!header) {
      return {
        id: 0,
        tur,
        tarih: tarih || new Date().toISOString().split("T")[0],
        zaman: new Date().toISOString(),
        kapanisKurTablosuId: kapanisId,
        satirlar,
      };
    }

    return {
      id: header.KUR_TABLOSU_ID,
      tur: header.TUR,
      tarih: KurSqlRepository.formatDateOnly(header.TARIH),
      zaman: KurSqlRepository.formatIso(header.ZAMAN),
      kapanisKurTablosuId: kapanisId,
      satirlar,
    };
  }

  /**
   * Save or update kur tablosu using SODVZ_KUR_TABLOSU_KAYDET stored procedure and save rates
   */
  public static async saveViaProcedure(
    dto: SaveKurTablosuDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<KurTablosuModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await KurSqlRepository.ensureTablesAndProceduresExist(pool);

    const { tur, kaynakKurTablosuId, satirlar } = dto;
    let targetId = dto.id && dto.id > 0 ? dto.id : null;

    // For TUR 0 or 1: if no id was provided, check if one already exists
    if (!targetId && (tur === 0 || tur === 1)) {
      const checkRes = await pool
        .request()
        .input("tur", sql.TinyInt, tur)
        .query<{ KUR_TABLOSU_ID: number }>(
          "SELECT TOP 1 [KUR_TABLOSU_ID] FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [TUR] = @tur"
        );
      if (checkRes.recordset.length > 0) {
        targetId = checkRes.recordset[0].KUR_TABLOSU_ID;
      }
    }

    // Date/Time handling
    const zaman = dto.zaman ? new Date(dto.zaman) : new Date();

    // Execute stored procedure SODVZ_KUR_TABLOSU_KAYDET
    const procReq = pool.request();
    procReq.output("KUR_TABLOSU_ID", sql.Int, targetId ?? null);
    procReq.input("TUR", sql.TinyInt, tur);
    procReq.input("ZAMAN", sql.DateTime, zaman);
    procReq.input("KAYNAK_KUR_TABLOSU_ID", sql.Int, kaynakKurTablosuId ?? null);
    procReq.output("KAPANIS_KUR_TABLOSU_ID", sql.Int);

    try {
      await procReq.execute("SODVZ_KUR_TABLOSU_KAYDET");
    } catch (procErr: any) {
      // If error is 'Kur tablosu sistemde kayıtlı', handle gracefully by finding existing record
      if (procErr?.message && procErr.message.includes("Kur tablosu sistemde kayıtlı")) {
        const existing = await pool
          .request()
          .input("tur", sql.TinyInt, tur)
          .input("tarih", sql.Date, zaman)
          .query<{ KUR_TABLOSU_ID: number }>(
            "SELECT TOP 1 [KUR_TABLOSU_ID] FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [TUR] = @tur AND CAST([TARIH] AS DATE) = CAST(@tarih AS DATE)"
          );
        if (existing.recordset.length > 0) {
          targetId = existing.recordset[0].KUR_TABLOSU_ID;
        } else {
          throw ApiError.badRequest(procErr.message);
        }
      } else {
        throw ApiError.badRequest(procErr?.message || "Kur tablosu kaydedilemedi.");
      }
    }

    let finalKurTablosuId: number = procReq.parameters.KUR_TABLOSU_ID?.value || targetId;
    const kapanisId: number | null = procReq.parameters.KAPANIS_KUR_TABLOSU_ID?.value || null;

    if (!finalKurTablosuId) {
      const fallback = await pool
        .request()
        .input("tur", sql.TinyInt, tur)
        .query<{ KUR_TABLOSU_ID: number }>(
          "SELECT TOP 1 [KUR_TABLOSU_ID] FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [TUR] = @tur ORDER BY [KUR_TABLOSU_ID] DESC"
        );
      if (fallback.recordset.length > 0) {
        finalKurTablosuId = fallback.recordset[0].KUR_TABLOSU_ID;
      }
    }

    if (!finalKurTablosuId) {
      throw ApiError.internal("Kur tablosu kimliği belirlenemedi.");
    }

    // If satirlar provided, save or update them in TODVZ_KUR
    if (satirlar && satirlar.length > 0) {
      const transaction = new sql.Transaction(pool);
      try {
        await transaction.begin();

        for (const s of satirlar) {
          if (!s.paraId) continue;

          const rReq = new sql.Request(transaction);
          rReq.input("KUR_TABLOSU_ID", sql.Int, finalKurTablosuId);
          rReq.input("PARA_ID", sql.Int, s.paraId);

          const dovizAlis = s.dovizAlis !== null && s.dovizAlis !== undefined && !isNaN(Number(s.dovizAlis)) ? Number(s.dovizAlis) : 0;
          const dovizSatis = s.dovizSatis !== null && s.dovizSatis !== undefined && !isNaN(Number(s.dovizSatis)) ? Number(s.dovizSatis) : 0;
          const efektifAlis = s.efektifAlis !== null && s.efektifAlis !== undefined && !isNaN(Number(s.efektifAlis)) ? Number(s.efektifAlis) : 0;
          const efektifSatis = s.efektifSatis !== null && s.efektifSatis !== undefined && !isNaN(Number(s.efektifSatis)) ? Number(s.efektifSatis) : 0;
          const parite = s.parite !== null && s.parite !== undefined && !isNaN(Number(s.parite)) ? Number(s.parite) : 0;

          rReq.input("DOVIZ_ALIS", sql.Float, dovizAlis);
          rReq.input("DOVIZ_SATIS", sql.Float, dovizSatis);
          rReq.input("EFEKTIF_ALIS", sql.Float, efektifAlis);
          rReq.input("EFEKTIF_SATIS", sql.Float, efektifSatis);
          rReq.input("PARITE", sql.Float, parite);

          const upsertQuery = `
            MERGE [dbo].[TODVZ_KUR] AS target
            USING (SELECT @KUR_TABLOSU_ID AS [KUR_TABLOSU_ID], @PARA_ID AS [PARA_ID]) AS source
            ON (target.[KUR_TABLOSU_ID] = source.[KUR_TABLOSU_ID] AND target.[PARA_ID] = source.[PARA_ID])
            WHEN MATCHED THEN
              UPDATE SET
                [DOVIZ_ALIS] = @DOVIZ_ALIS,
                [DOVIZ_SATIS] = @DOVIZ_SATIS,
                [EFEKTIF_ALIS] = @EFEKTIF_ALIS,
                [EFEKTIF_SATIS] = @EFEKTIF_SATIS,
                [PARITE] = @PARITE
            WHEN NOT MATCHED THEN
              INSERT ([KUR_TABLOSU_ID], [PARA_ID], [DOVIZ_ALIS], [DOVIZ_SATIS], [EFEKTIF_ALIS], [EFEKTIF_SATIS], [PARITE])
              VALUES (@KUR_TABLOSU_ID, @PARA_ID, @DOVIZ_ALIS, @DOVIZ_SATIS, @EFEKTIF_ALIS, @EFEKTIF_SATIS, @PARITE);
          `;
          await rReq.query(upsertQuery);
        }

        await transaction.commit();
      } catch (lineErr: any) {
        await transaction.rollback();
        logger.error("KurSqlRepository.saveViaProcedure line error:", lineErr);
        if (lineErr?.message && lineErr.message.includes("Cannot insert the value NULL")) {
          throw ApiError.badRequest("Kur satırlarında zorunlu alanlar boş geçilemez. Lütfen girilen kur fiyatlarını kontrol ediniz.");
        }
        throw ApiError.badRequest(lineErr?.message || "Kur satırları kaydedilemedi.");
      }
    }

    const saved = await KurSqlRepository.findTablo({ tur, id: finalKurTablosuId }, dbContext);
    if (!saved) {
      throw ApiError.internal("Kur tablosu kaydedildi fakat veri okunamadı.");
    }

    saved.kapanisKurTablosuId = kapanisId;
    return saved;
  }

  /**
   * "Sakla" / Kopyala operation: Copies source rates into target list using SODVZ_KUR_TABLOSU_KAYDET
   * - targetTur = 0: Kopya kurları aktif canlı Anlık Listeye kopyalar / geri yükler
   * - targetTur = 2: Anlık kurlardan günün kapanışını açar veya arşivden başka güne kapanış kopyalar
   */
  public static async sakla(
    kaynakKurTablosuId: number,
    targetTur: number = 2,
    zaman?: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<KurTablosuModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await KurSqlRepository.ensureTablesAndProceduresExist(pool);

    const z = zaman ? new Date(zaman) : new Date();

    let existingId: number | null = null;
    if (targetTur === 0 || targetTur === 1) {
      const checkRes = await pool
        .request()
        .input("tur", sql.TinyInt, targetTur)
        .query<{ KUR_TABLOSU_ID: number }>(
          "SELECT TOP 1 [KUR_TABLOSU_ID] FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [TUR] = @tur ORDER BY [KUR_TABLOSU_ID] DESC"
        );
      if (checkRes.recordset.length > 0) {
        existingId = checkRes.recordset[0].KUR_TABLOSU_ID;
      }
    } else {
      const checkRes = await pool
        .request()
        .input("tur", sql.TinyInt, targetTur)
        .input("tarih", sql.Date, z)
        .query<{ KUR_TABLOSU_ID: number }>(
          "SELECT TOP 1 [KUR_TABLOSU_ID] FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [TUR] = @tur AND CAST([TARIH] AS DATE) = CAST(@tarih AS DATE)"
        );
      if (checkRes.recordset.length > 0) {
        existingId = checkRes.recordset[0].KUR_TABLOSU_ID;
      }
    }

    const procReq = pool.request();
    procReq.output("KUR_TABLOSU_ID", sql.Int, existingId ?? null);
    procReq.input("TUR", sql.TinyInt, targetTur);
    procReq.input("ZAMAN", sql.DateTime, z);
    procReq.input("KAYNAK_KUR_TABLOSU_ID", sql.Int, kaynakKurTablosuId);
    procReq.output("KAPANIS_KUR_TABLOSU_ID", sql.Int);

    await procReq.execute("SODVZ_KUR_TABLOSU_KAYDET");
    const newId: number = procReq.parameters.KUR_TABLOSU_ID.value || existingId;

    const result = await KurSqlRepository.findTablo({ tur: targetTur, id: newId }, dbContext);
    if (!result) {
      throw ApiError.internal("Kopyalama işlemi yapıldı ancak kur tablosu okunamadı.");
    }
    return result;
  }

  /**
   * Get list of dates and IDs for stored tables (TUR=2, 3) for navigation |<, <, >, >|
   */
  public static async getStoredDates(
    tur: number = 2,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ id: number; tarih: string; zaman: string }[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await KurSqlRepository.ensureTablesAndProceduresExist(pool);

    const res = await pool
      .request()
      .input("tur", sql.TinyInt, tur)
      .query<TodvzKurTablosuEntity>(`
        SELECT [KUR_TABLOSU_ID], [TARIH], [ZAMAN]
        FROM [dbo].[TODVZ_KUR_TABLOSU]
        WHERE [TUR] = @tur
        ORDER BY [ZAMAN] ASC, [KUR_TABLOSU_ID] ASC
      `);

    return res.recordset.map((r) => ({
      id: r.KUR_TABLOSU_ID,
      tarih: KurSqlRepository.formatDateOnly(r.TARIH),
      zaman: KurSqlRepository.formatIso(r.ZAMAN),
    }));
  }

  /**
   * Delete a stored kur tablosu
   */
  public static async deleteKurTablosu(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await KurSqlRepository.ensureTablesAndProceduresExist(pool);

    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      const r1 = new sql.Request(transaction);
      r1.input("id", sql.Int, id);
      await r1.query("DELETE FROM [dbo].[TODVZ_KUR] WHERE [KUR_TABLOSU_ID] = @id");

      const r2 = new sql.Request(transaction);
      r2.input("id", sql.Int, id);
      await r2.query("DELETE FROM [dbo].[TODVZ_KUR_TABLOSU] WHERE [KUR_TABLOSU_ID] = @id");

      await transaction.commit();
      return true;
    } catch (err) {
      await transaction.rollback();
      logger.error(`KurSqlRepository.deleteKurTablosu(${id}) error:`, err);
      throw err;
    }
  }
}
