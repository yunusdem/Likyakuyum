import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

// ─── Interfaces: TODVZ_HESAP ─────────────────────────────────────────────────
export interface HesapModel {
  hesapId: number;
  kod: string;
  ad: string;
  kdvOrani: number;
  aktif: boolean;
  toplamGiris?: number;
  toplamCikis?: number;
  bakiye?: number;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveHesapDto {
  hesapId?: number | null;
  kod: string;
  ad: string;
  kdvOrani?: number;
}

// ─── Interfaces: TODVZ_HESAP_HAREKETI ────────────────────────────────────────
export interface HesapHareketiModel {
  hesapHareketiId: number;
  hesapId: number;
  hesapKod?: string;
  hesapAd?: string;
  tarih: string;
  aciklama?: string | null;
  paraId: number;
  paraKodu?: string;
  paraAdi?: string;
  meblag: number;
  kdvOrani: number;
  kdv: number;
  tip: number; // 0: Giriş, 1: Çıkış
  vezneId: number;
  vezneKod?: string;
  vezneAd?: string;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveHesapHareketiDto {
  hesapHareketiId?: number | null;
  hesapId: number;
  tarih: string;
  aciklama?: string | null;
  paraId: number;
  meblag: number;
  kdvOrani?: number;
  kdv?: number;
  tip?: number;
  vezneId: number;
  degisiklikTakipVar?: boolean;
}

export class KasaHesapSqlRepository {
  /**
   * TODVZ_HESAP, TODVZ_HESAP_HAREKETI ve TODVZ_LOG_HESAP_HAREKETI tablolarının
   * var olduğunu denetler ve gerekirse oluşturur.
   */
  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_HESAP', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_HESAP] (
            [HESAP_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [KOD] VARCHAR(30) NOT NULL,
            [AD] VARCHAR(150) NOT NULL,
            [KDV_ORANI] FLOAT NOT NULL DEFAULT 0,
            [AKTIF] BIT NOT NULL DEFAULT 1,
            [EKLEYEN_ID] INT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;

        IF OBJECT_ID('TODVZ_HESAP_HAREKETI', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_HESAP_HAREKETI] (
            [HESAP_HAREKETI_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [HESAP_ID] INT NOT NULL,
            [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
            [ACIKLAMA] VARCHAR(250) NULL,
            [PARA_ID] INT NOT NULL,
            [MEBLAG] FLOAT NOT NULL DEFAULT 0,
            [KDV_ORANI] FLOAT NOT NULL DEFAULT 0,
            [KDV] FLOAT NOT NULL DEFAULT 0,
            [TIP] TINYINT NOT NULL DEFAULT 1,
            [VEZNE_ID] INT NOT NULL,
            [EKLEYEN_ID] INT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;

        IF OBJECT_ID('TODVZ_LOG_HESAP_HAREKETI', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_LOG_HESAP_HAREKETI] (
            [LOG_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [ZAMAN] DATETIME NOT NULL DEFAULT GETDATE(),
            [KULLANICI_ID] INT NULL,
            [ISLEM] TINYINT NOT NULL,
            [HESAP_HAREKETI_ID] INT NOT NULL,
            [VEZNE_ID] INT NULL,
            [O_HESAP_ID] INT NULL,
            [S_HESAP_ID] INT NULL,
            [O_TARIH] DATETIME NULL,
            [S_TARIH] DATETIME NULL,
            [O_ACIKLAMA] VARCHAR(250) NULL,
            [S_ACIKLAMA] VARCHAR(250) NULL,
            [O_PARA_ID] INT NULL,
            [S_PARA_ID] INT NULL,
            [O_MEBLAG] FLOAT NULL,
            [S_MEBLAG] FLOAT NULL,
            [O_KDV] FLOAT NULL,
            [S_KDV] FLOAT NULL,
            [O_TIP] TINYINT NULL,
            [S_TIP] TINYINT NULL
          );
        END;

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_HESAP')
        BEGIN
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_HESAP' AND COLUMN_NAME = 'AKTIF')
            ALTER TABLE [dbo].[TODVZ_HESAP] ADD [AKTIF] BIT NOT NULL DEFAULT 1;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_HESAP' AND COLUMN_NAME = 'EKLEYEN_ID')
            ALTER TABLE [dbo].[TODVZ_HESAP] ADD [EKLEYEN_ID] INT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_HESAP' AND COLUMN_NAME = 'EKLEME_ZAMANI')
            ALTER TABLE [dbo].[TODVZ_HESAP] ADD [EKLEME_ZAMANI] DATETIME NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_HESAP' AND COLUMN_NAME = 'GUNCELLEYEN_ID')
            ALTER TABLE [dbo].[TODVZ_HESAP] ADD [GUNCELLEYEN_ID] INT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_HESAP' AND COLUMN_NAME = 'GUNCELLEME_ZAMANI')
            ALTER TABLE [dbo].[TODVZ_HESAP] ADD [GUNCELLEME_ZAMANI] DATETIME NULL;
        END;

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_HESAP_HAREKETI')
        BEGIN
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_HESAP_HAREKETI' AND COLUMN_NAME = 'EKLEYEN_ID')
            ALTER TABLE [dbo].[TODVZ_HESAP_HAREKETI] ADD [EKLEYEN_ID] INT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_HESAP_HAREKETI' AND COLUMN_NAME = 'EKLEME_ZAMANI')
            ALTER TABLE [dbo].[TODVZ_HESAP_HAREKETI] ADD [EKLEME_ZAMANI] DATETIME NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_HESAP_HAREKETI' AND COLUMN_NAME = 'GUNCELLEYEN_ID')
            ALTER TABLE [dbo].[TODVZ_HESAP_HAREKETI] ADD [GUNCELLEYEN_ID] INT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_HESAP_HAREKETI' AND COLUMN_NAME = 'GUNCELLEME_ZAMANI')
            ALTER TABLE [dbo].[TODVZ_HESAP_HAREKETI] ADD [GUNCELLEME_ZAMANI] DATETIME NULL;
        END;
      `);
    } catch (err: any) {
      logger.warn(`[KasaHesapSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  /**
   * SODVZ_HESAP_KAYDET, SODVZ_HESAP_SIL, SODVZ_HESAP_HAREKETI_KAYDET ve
   * SODVZ_HESAP_HAREKETI_SIL saklı yordamlarının var olduğunu denetler ve
   * gerekirse oluşturur. Uygulama kodu bu yordamlar dışında TODVZ_HESAP /
   * TODVZ_HESAP_HAREKETI tabloları üzerinde asla doğrudan INSERT/UPDATE/DELETE
   * çalıştırmaz.
   */
  private static async ensureProcedures(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_HESAP_KAYDET]
          @HESAP_ID INT OUTPUT,
          @KOD VARCHAR(30),
          @AD VARCHAR(150),
          @KDV_ORANI FLOAT
        AS
        BEGIN
          SET NOCOUNT ON;
          DECLARE @HATA_MESAJI VARCHAR(250)
          IF @HESAP_ID IS NULL OR @HESAP_ID = 0  /* INSERT */
          BEGIN
            IF EXISTS(SELECT * FROM TODVZ_HESAP H WHERE H.AD = @AD)
            BEGIN
              SET @HATA_MESAJI = RTRIM(ISNULL(@AD,'')) + ' adındaki hesap daha önce açılmış'
              GOTO UNDO
            END
            IF EXISTS(SELECT * FROM TODVZ_HESAP H WHERE H.KOD = @KOD)
            BEGIN
              SET @HATA_MESAJI = RTRIM(ISNULL(@KOD,'')) + ' kodundaki hesap daha önce açılmış'
              GOTO UNDO
            END
            INSERT INTO TODVZ_HESAP (KOD, AD, KDV_ORANI, EKLEME_ZAMANI)
              VALUES(@KOD, @AD, @KDV_ORANI, GETDATE())
            IF @@ERROR<>0  GOTO UNDO
            SET @HESAP_ID = SCOPE_IDENTITY()
            IF @HESAP_ID IS NULL OR @HESAP_ID = 0
              SET @HESAP_ID = IDENT_CURRENT('TODVZ_HESAP')
          END
          ELSE BEGIN  /* UPDATE */
            IF EXISTS(SELECT * FROM TODVZ_HESAP H WHERE H.AD = @AD AND H.HESAP_ID <> @HESAP_ID)
            BEGIN
              SET @HATA_MESAJI = RTRIM(ISNULL(@AD,'')) + ' adındaki hesap daha önce açılmış'
              GOTO UNDO
            END
            IF EXISTS(SELECT * FROM TODVZ_HESAP H WHERE H.KOD = @KOD AND H.HESAP_ID <> @HESAP_ID)
            BEGIN
              SET @HATA_MESAJI = RTRIM(ISNULL(@KOD,'')) + ' kodundaki hesap daha önce açılmış'
              GOTO UNDO
            END
            UPDATE TODVZ_HESAP
              SET KOD = @KOD, AD = @AD, KDV_ORANI = @KDV_ORANI, GUNCELLEME_ZAMANI = GETDATE()
              WHERE HESAP_ID = @HESAP_ID
            IF @@ERROR<>0  GOTO UNDO
          END
          RETURN 0
        UNDO:
          RAISERROR (@HATA_MESAJI,16,1)
          RETURN 1
        END
      `);

      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_HESAP_SIL]
          @HESAP_ID INT
        AS
        BEGIN
          SET NOCOUNT ON;
          IF EXISTS(SELECT 1 FROM TODVZ_HESAP_HAREKETI WHERE HESAP_ID = @HESAP_ID)
          BEGIN
            RAISERROR ('Bu hesaba ait hareket kayıtları bulunmaktadır, doğrudan silinemez.',16,1)
            RETURN 1
          END
          DELETE FROM TODVZ_HESAP WHERE HESAP_ID = @HESAP_ID
          IF @@ERROR<>0  RETURN 1
          RETURN 0
        END
      `);

      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_HESAP_HAREKETI_KAYDET]
          @HESAP_HAREKETI_ID INT OUT,
          @HESAP_ID INT,
          @TARIH DATETIME,
          @ACIKLAMA VARCHAR(250),
          @PARA_ID INT,
          @MEBLAG FLOAT,
          @KDV_ORANI FLOAT,
          @KDV FLOAT,
          @TIP TINYINT,
          @VEZNE_ID INT,
          @KULLANICI_ID INT,
          @DEGISIKLIK_TAKIP_VAR BIT
        AS
        BEGIN
          SET NOCOUNT ON;
          DECLARE @HATA_MESAJI VARCHAR(250)
          DECLARE @ZAMAN DATETIME
          DECLARE @DONEM_ONAY_TARIHI DATETIME
          DECLARE @KONTROL_EDILECEK_TARIH DATETIME
          SET @ZAMAN = GETDATE()
          IF OBJECT_ID('TODVZ_TANIM') IS NOT NULL
            SELECT @DONEM_ONAY_TARIHI = DONEM_ONAY_TARIHI FROM TODVZ_TANIM
          SET @KONTROL_EDILECEK_TARIH = @TARIH
          IF @HESAP_HAREKETI_ID IS NOT NULL
            SELECT @KONTROL_EDILECEK_TARIH = TARIH FROM TODVZ_HESAP_HAREKETI WHERE HESAP_HAREKETI_ID = @HESAP_HAREKETI_ID

          BEGIN TRAN
          IF @DONEM_ONAY_TARIHI IS NOT NULL AND @KONTROL_EDILECEK_TARIH <= @DONEM_ONAY_TARIHI
          BEGIN
            SET @HATA_MESAJI = 'Onaylanmış hesap dönemine ait işlem yapılamaz'
            GOTO UNDO
          END

          IF @HESAP_HAREKETI_ID IS NULL OR @HESAP_HAREKETI_ID = 0
          BEGIN
            INSERT INTO TODVZ_HESAP_HAREKETI(
                HESAP_ID, TARIH, ACIKLAMA, PARA_ID, MEBLAG, KDV_ORANI, KDV, TIP, VEZNE_ID,
                EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI)
              VALUES(
                @HESAP_ID, @TARIH, @ACIKLAMA, @PARA_ID, @MEBLAG, @KDV_ORANI, @KDV, @TIP, @VEZNE_ID,
                @KULLANICI_ID, @ZAMAN, @KULLANICI_ID, @ZAMAN)
            IF @@ERROR<>0  GOTO UNDO
            SELECT @HESAP_HAREKETI_ID = SCOPE_IDENTITY()
            IF @HESAP_HAREKETI_ID IS NULL OR @HESAP_HAREKETI_ID = 0
              SELECT @HESAP_HAREKETI_ID = IDENT_CURRENT('TODVZ_HESAP_HAREKETI')
          END
          ELSE BEGIN
            UPDATE B SET MIKTAR = MIKTAR - CASE WHEN H.TIP = 0 THEN H.MEBLAG ELSE -H.MEBLAG END
              FROM TODVZ_HESAP_HAREKETI H
                INNER JOIN TODVZ_VEZNE_BAKIYE B ON B.VEZNE_ID = H.VEZNE_ID AND B.PARA_ID = H.PARA_ID
              WHERE H.HESAP_HAREKETI_ID = @HESAP_HAREKETI_ID
            UPDATE B SET MIKTAR = MIKTAR - CASE WHEN H.TIP = 0 THEN H.KDV ELSE -H.KDV END
              FROM TODVZ_HESAP_HAREKETI H
                INNER JOIN TODVZ_VEZNE_BAKIYE B ON B.VEZNE_ID = H.VEZNE_ID AND B.PARA_ID = 1
              WHERE H.HESAP_HAREKETI_ID = @HESAP_HAREKETI_ID AND H.KDV > 0.0

            IF @DEGISIKLIK_TAKIP_VAR = 1 AND OBJECT_ID('TODVZ_LOG_HESAP_HAREKETI') IS NOT NULL
              INSERT INTO TODVZ_LOG_HESAP_HAREKETI(
                ZAMAN, KULLANICI_ID, ISLEM, HESAP_HAREKETI_ID, VEZNE_ID,
                O_HESAP_ID, S_HESAP_ID, O_TARIH, S_TARIH, O_ACIKLAMA, S_ACIKLAMA,
                O_PARA_ID, S_PARA_ID, O_MEBLAG, S_MEBLAG, O_KDV, S_KDV, O_TIP, S_TIP)
              SELECT  @ZAMAN, @KULLANICI_ID, 1, @HESAP_HAREKETI_ID, @VEZNE_ID,
                V.HESAP_ID, @HESAP_ID, V.TARIH, @TARIH, V.ACIKLAMA, @ACIKLAMA,
                V.PARA_ID, @PARA_ID, V.MEBLAG, @MEBLAG, V.KDV, @KDV, V.TIP, @TIP
              FROM TODVZ_HESAP_HAREKETI V
              WHERE V.HESAP_HAREKETI_ID = @HESAP_HAREKETI_ID AND
                (V.HESAP_ID <> @HESAP_ID OR
                V.TARIH <> @TARIH OR
                ISNULL(V.ACIKLAMA,'') <> ISNULL(@ACIKLAMA,'') OR
                V.PARA_ID <> @PARA_ID OR
                V.MEBLAG <> @MEBLAG OR
                V.KDV <> @KDV OR
                V.TIP <> @TIP)

            UPDATE TODVZ_HESAP_HAREKETI
              SET
                HESAP_ID = @HESAP_ID,
                TARIH = @TARIH,
                ACIKLAMA = @ACIKLAMA,
                PARA_ID = @PARA_ID,
                MEBLAG = @MEBLAG,
                KDV_ORANI = @KDV_ORANI,
                KDV = @KDV,
                TIP = @TIP,
                VEZNE_ID = @VEZNE_ID,
                GUNCELLEYEN_ID = @KULLANICI_ID,
                GUNCELLEME_ZAMANI = @ZAMAN
              WHERE HESAP_HAREKETI_ID = @HESAP_HAREKETI_ID
            IF @@ERROR<>0  GOTO UNDO
          END

          UPDATE TODVZ_VEZNE_BAKIYE
            SET MIKTAR = MIKTAR + CASE WHEN @TIP = 0 THEN @MEBLAG ELSE -@MEBLAG END
            WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID
          IF @@ROWCOUNT = 0
            INSERT INTO TODVZ_VEZNE_BAKIYE(VEZNE_ID, PARA_ID, MIKTAR)
              VALUES(@VEZNE_ID, @PARA_ID, CASE WHEN @TIP = 0 THEN @MEBLAG ELSE -@MEBLAG END)

          IF @KDV > 0.0
          BEGIN
            UPDATE TODVZ_VEZNE_BAKIYE
              SET MIKTAR = MIKTAR + CASE WHEN @TIP = 0 THEN @KDV ELSE -@KDV END
              WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = 1
            IF @@ROWCOUNT = 0
              INSERT INTO TODVZ_VEZNE_BAKIYE(VEZNE_ID, PARA_ID, MIKTAR)
                VALUES(@VEZNE_ID, 1, CASE WHEN @TIP = 0 THEN @KDV ELSE -@KDV END)
          END

          COMMIT TRAN
          RETURN 0
        UNDO:
          ROLLBACK TRAN
          IF @HATA_MESAJI IS NULL SET @HATA_MESAJI = 'Hesap hareketi kaydedilemedi'
          RAISERROR (@HATA_MESAJI,16,1)
          RETURN 1
        END
      `);

      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_HESAP_HAREKETI_SIL]
          @HESAP_HAREKETI_ID INT,
          @KULLANICI_ID INT,
          @DEGISIKLIK_TAKIP_VAR BIT
        AS
        BEGIN
          SET NOCOUNT ON;
          DECLARE @HATA_MESAJI VARCHAR(250)
          DECLARE @VEZNE_ID INT, @PARA_ID INT, @MEBLAG FLOAT, @KDV FLOAT, @TIP TINYINT

          BEGIN TRAN
          SELECT @VEZNE_ID = VEZNE_ID, @PARA_ID = PARA_ID, @MEBLAG = MEBLAG, @KDV = KDV, @TIP = TIP
            FROM TODVZ_HESAP_HAREKETI WHERE HESAP_HAREKETI_ID = @HESAP_HAREKETI_ID

          IF @VEZNE_ID IS NULL
          BEGIN
            SET @HATA_MESAJI = 'Silinecek hesap hareketi bulunamadı'
            GOTO UNDO
          END

          UPDATE TODVZ_VEZNE_BAKIYE
            SET MIKTAR = MIKTAR - CASE WHEN @TIP = 0 THEN @MEBLAG ELSE -@MEBLAG END
            WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID

          IF @KDV > 0.0
            UPDATE TODVZ_VEZNE_BAKIYE
              SET MIKTAR = MIKTAR - CASE WHEN @TIP = 0 THEN @KDV ELSE -@KDV END
              WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = 1

          IF @DEGISIKLIK_TAKIP_VAR = 1 AND OBJECT_ID('TODVZ_LOG_HESAP_HAREKETI') IS NOT NULL
            INSERT INTO TODVZ_LOG_HESAP_HAREKETI(
              ZAMAN, KULLANICI_ID, ISLEM, HESAP_HAREKETI_ID, VEZNE_ID,
              O_HESAP_ID, O_TARIH, O_ACIKLAMA, O_PARA_ID, O_MEBLAG, O_KDV, O_TIP)
            SELECT GETDATE(), @KULLANICI_ID, 2, HESAP_HAREKETI_ID, VEZNE_ID,
              HESAP_ID, TARIH, ACIKLAMA, PARA_ID, MEBLAG, KDV, TIP
            FROM TODVZ_HESAP_HAREKETI WHERE HESAP_HAREKETI_ID = @HESAP_HAREKETI_ID

          DELETE FROM TODVZ_HESAP_HAREKETI WHERE HESAP_HAREKETI_ID = @HESAP_HAREKETI_ID
          IF @@ERROR<>0  GOTO UNDO

          COMMIT TRAN
          RETURN 0
        UNDO:
          ROLLBACK TRAN
          IF @HATA_MESAJI IS NULL SET @HATA_MESAJI = 'Hesap hareketi silinemedi'
          RAISERROR (@HATA_MESAJI,16,1)
          RETURN 1
        END
      `);
    } catch (e: any) {
      logger.warn("[KasaHesapSqlRepository.ensureProcedures] Warning:", e.message || e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A - HESAP KARTLARI (TODVZ_HESAP)
  // ═══════════════════════════════════════════════════════════════════════════

  public static async listHesaplar(
    filter?: { search?: string; aktif?: boolean },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    let query = `
      SELECT
        H.HESAP_ID, H.KOD, H.AD, H.KDV_ORANI, H.AKTIF,
        H.EKLEYEN_ID, H.EKLEME_ZAMANI, H.GUNCELLEYEN_ID, H.GUNCELLEME_ZAMANI,
        ISNULL((SELECT SUM(MEBLAG) FROM TODVZ_HESAP_HAREKETI WHERE HESAP_ID = H.HESAP_ID AND TIP = 0), 0) AS TOPLAM_GIRIS,
        ISNULL((SELECT SUM(MEBLAG) FROM TODVZ_HESAP_HAREKETI WHERE HESAP_ID = H.HESAP_ID AND TIP = 1), 0) AS TOPLAM_CIKIS
      FROM TODVZ_HESAP H
      WHERE 1=1
    `;
    const request = pool.request();

    if (filter?.aktif !== undefined) {
      query += ` AND H.AKTIF = @AKTIF`;
      request.input("AKTIF", sql.Bit, filter.aktif ? 1 : 0);
    }
    if (filter?.search && filter.search.trim()) {
      query += ` AND (H.KOD LIKE @SEARCH OR H.AD LIKE @SEARCH)`;
      request.input("SEARCH", sql.VarChar(100), `%${filter.search.trim()}%`);
    }
    query += ` ORDER BY H.KOD ASC, H.AD ASC`;

    const res = await request.query(query);
    return (res.recordset || []).map((r: any) => {
      const toplamGiris = Number(r.TOPLAM_GIRIS) || 0;
      const toplamCikis = Number(r.TOPLAM_CIKIS) || 0;
      return {
        hesapId: r.HESAP_ID,
        kod: (r.KOD || "").trim(),
        ad: (r.AD || "").trim(),
        kdvOrani: Number(r.KDV_ORANI) || 0,
        aktif: Boolean(r.AKTIF),
        toplamGiris,
        toplamCikis,
        bakiye: toplamGiris - toplamCikis,
        ekleyenId: r.EKLEYEN_ID,
        eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : null,
        guncelleyenId: r.GUNCELLEYEN_ID,
        guncellemeZamani: r.GUNCELLEME_ZAMANI ? new Date(r.GUNCELLEME_ZAMANI).toISOString() : null,
      };
    });
  }

  public static async getHesapById(
    hesapId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapModel | null> {
    const list = await this.listHesaplar(undefined, dbContext);
    return list.find((h) => h.hesapId === hesapId) || null;
  }

  public static async saveHesap(
    dto: SaveHesapDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    let kod = (dto.kod || "").trim();
    if (!kod) {
      try {
        const maxRes = await pool.request().query(`
          SELECT 
            ISNULL(MAX(CASE WHEN ISNUMERIC(KOD) = 1 THEN CAST(KOD AS BIGINT) ELSE 0 END), 0) AS MAX_NUM,
            COUNT(*) AS TOTAL_COUNT
          FROM TODVZ_HESAP
        `);
        const maxNum = Number(maxRes.recordset?.[0]?.MAX_NUM) || 0;
        const totalCount = Number(maxRes.recordset?.[0]?.TOTAL_COUNT) || 0;
        const nextNum = Math.max(maxNum + 1, totalCount + 1);
        kod = String(nextNum).padStart(3, "0");
      } catch {
        kod = "001";
      }
    }

    const targetHesapId = dto.hesapId && Number(dto.hesapId) > 0 ? Number(dto.hesapId) : null;
    const req = pool.request();
    req.input("TARGET_ID", sql.Int, targetHesapId);
    req.input("KOD", sql.VarChar(30), kod);
    req.input("AD", sql.VarChar(150), (dto.ad || "").trim());
    req.input("KDV_ORANI", sql.Float, Number(dto.kdvOrani) || 0);

    const batchQuery = `
      SET NOCOUNT ON;
      DECLARE @OUT_ID INT = @TARGET_ID;

      EXEC [dbo].[SODVZ_HESAP_KAYDET]
        @HESAP_ID = @OUT_ID OUTPUT,
        @KOD = @KOD,
        @AD = @AD,
        @KDV_ORANI = @KDV_ORANI;

      SELECT @OUT_ID AS RESULT_ID;
    `;

    let savedId: number | null = null;
    try {
      const result = await req.query(batchQuery);
      savedId = Number(result.recordset?.[0]?.RESULT_ID) || targetHesapId;
    } catch (err: any) {
      logger.error("[KasaHesapSqlRepository.saveHesap] Error:", err);
      throw ApiError.badRequest(err.message || "Hesap kartı kaydedilemedi.");
    }

    if (!savedId) throw ApiError.internal("Hesap kartı kaydedildi ancak kimlik bilgisi alınamadı.");

    const saved = await this.getHesapById(savedId, dbContext);
    if (!saved) throw ApiError.internal("Hesap kartı kaydedildi ancak okunamadı.");
    return saved;
  }

  public static async deleteHesap(
    hesapId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    try {
      const req = pool.request();
      req.input("HESAP_ID", sql.Int, hesapId);
      await req.execute("SODVZ_HESAP_SIL");
      return true;
    } catch (err: any) {
      logger.error(`[KasaHesapSqlRepository.deleteHesap(${hesapId})] Error:`, err);
      throw ApiError.badRequest(err.message || "Hesap kartı silinemedi.");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // B - HESAP HAREKETLERİ (TODVZ_HESAP_HAREKETI)
  // ═══════════════════════════════════════════════════════════════════════════

  public static async listHareketler(
    filter?: { hesapId?: number; vezneId?: number; search?: string; limit?: number },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapHareketiModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const topLimit = filter?.limit && filter.limit > 0 ? filter.limit : 200;
    let query = `
      SELECT TOP (${topLimit})
        HH.HESAP_HAREKETI_ID, HH.HESAP_ID, H.KOD AS HESAP_KOD, H.AD AS HESAP_AD,
        HH.TARIH, HH.ACIKLAMA, HH.PARA_ID, P.KOD AS PARA_KODU, P.AD AS PARA_ADI,
        HH.MEBLAG, HH.KDV_ORANI, HH.KDV, HH.TIP, HH.VEZNE_ID, V.KOD AS VEZNE_KOD, V.AD AS VEZNE_AD,
        HH.EKLEYEN_ID, HH.EKLEME_ZAMANI, HH.GUNCELLEYEN_ID, HH.GUNCELLEME_ZAMANI
      FROM TODVZ_HESAP_HAREKETI HH
      LEFT JOIN TODVZ_HESAP H ON H.HESAP_ID = HH.HESAP_ID
      LEFT JOIN TODVZ_PARA P ON P.PARA_ID = HH.PARA_ID
      LEFT JOIN TODVZ_VEZNE V ON V.VEZNE_ID = HH.VEZNE_ID
      WHERE 1=1
    `;
    const req = pool.request();

    if (filter?.hesapId) {
      query += ` AND HH.HESAP_ID = @HESAP_ID`;
      req.input("HESAP_ID", sql.Int, filter.hesapId);
    }
    if (filter?.vezneId) {
      query += ` AND HH.VEZNE_ID = @VEZNE_ID`;
      req.input("VEZNE_ID", sql.Int, filter.vezneId);
    }
    if (filter?.search && filter.search.trim()) {
      query += ` AND (HH.ACIKLAMA LIKE @SEARCH OR H.AD LIKE @SEARCH OR H.KOD LIKE @SEARCH OR V.AD LIKE @SEARCH)`;
      req.input("SEARCH", sql.VarChar(100), `%${filter.search.trim()}%`);
    }
    query += ` ORDER BY HH.TARIH DESC, HH.HESAP_HAREKETI_ID DESC`;

    const res = await req.query(query);
    return (res.recordset || []).map((r: any) => ({
      hesapHareketiId: r.HESAP_HAREKETI_ID,
      hesapId: r.HESAP_ID,
      hesapKod: r.HESAP_KOD ? r.HESAP_KOD.trim() : "",
      hesapAd: r.HESAP_AD ? r.HESAP_AD.trim() : "",
      tarih: r.TARIH ? new Date(r.TARIH).toISOString() : new Date().toISOString(),
      aciklama: r.ACIKLAMA || null,
      paraId: r.PARA_ID,
      paraKodu: (r.PARA_KODU || "").trim(),
      paraAdi: (r.PARA_ADI || "").trim(),
      meblag: Number(r.MEBLAG) || 0,
      kdvOrani: Number(r.KDV_ORANI) || 0,
      kdv: Number(r.KDV) || 0,
      tip: Number(r.TIP),
      vezneId: r.VEZNE_ID,
      vezneKod: (r.VEZNE_KOD || "").trim(),
      vezneAd: (r.VEZNE_AD || "").trim(),
      ekleyenId: r.EKLEYEN_ID,
      eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : null,
      guncelleyenId: r.GUNCELLEYEN_ID,
      guncellemeZamani: r.GUNCELLEME_ZAMANI ? new Date(r.GUNCELLEME_ZAMANI).toISOString() : null,
    }));
  }

  public static async getHareketById(
    hesapHareketiId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapHareketiModel | null> {
    const list = await this.listHareketler({ limit: 5000 }, dbContext);
    return list.find((h) => h.hesapHareketiId === hesapHareketiId) || null;
  }

  public static async saveHareket(
    dto: SaveHesapHareketiDto,
    kullaniciId: number = 1,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapHareketiModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const targetId = dto.hesapHareketiId && Number(dto.hesapHareketiId) > 0 ? Number(dto.hesapHareketiId) : null;
    const meblag = Number(dto.meblag) || 0;
    const kdvOrani = Number(dto.kdvOrani) || 0;
    const kdv = dto.kdv !== undefined && dto.kdv !== null ? Number(dto.kdv) : parseFloat(((meblag * kdvOrani) / 100).toFixed(4));
    const tip = dto.tip === 0 ? 0 : 1;

    // NOT: SODVZ_HESAP_HAREKETI_KAYDET içinde BEGIN TRAN...COMMIT TRAN kullanıyor.
    // Böyle yordamlarda basit request.output()+execute() ile OUTPUT parametresi
    // güvenilir okunamayabiliyor (bkz. VezneTransferiSqlRepository.saveViaProcedure);
    // bu yüzden burada da OUTPUT parametresini içeren tek bir batch + final SELECT
    // ile çağırıyoruz.
    const req = pool.request();
    req.input("TARGET_ID", sql.Int, targetId);
    req.input("HESAP_ID", sql.Int, Number(dto.hesapId));
    req.input("TARIH", sql.DateTime, dto.tarih ? new Date(dto.tarih) : new Date());
    req.input("ACIKLAMA", sql.VarChar(250), dto.aciklama ? dto.aciklama.trim() : null);
    req.input("PARA_ID", sql.Int, Number(dto.paraId));
    req.input("MEBLAG", sql.Float, meblag);
    req.input("KDV_ORANI", sql.Float, kdvOrani);
    req.input("KDV", sql.Float, kdv);
    req.input("TIP", sql.TinyInt, tip);
    req.input("VEZNE_ID", sql.Int, Number(dto.vezneId));
    req.input("KULLANICI_ID", sql.Int, kullaniciId);
    req.input("DEGISIKLIK_TAKIP_VAR", sql.Bit, dto.degisiklikTakipVar ? 1 : 0);

    const batchQuery = `
      SET NOCOUNT ON;
      DECLARE @OUT_ID INT = @TARGET_ID;

      EXEC [dbo].[SODVZ_HESAP_HAREKETI_KAYDET]
        @HESAP_HAREKETI_ID = @OUT_ID OUTPUT,
        @HESAP_ID = @HESAP_ID,
        @TARIH = @TARIH,
        @ACIKLAMA = @ACIKLAMA,
        @PARA_ID = @PARA_ID,
        @MEBLAG = @MEBLAG,
        @KDV_ORANI = @KDV_ORANI,
        @KDV = @KDV,
        @TIP = @TIP,
        @VEZNE_ID = @VEZNE_ID,
        @KULLANICI_ID = @KULLANICI_ID,
        @DEGISIKLIK_TAKIP_VAR = @DEGISIKLIK_TAKIP_VAR;

      SELECT @OUT_ID AS RESULT_ID;
    `;

    let savedId: number | null = null;
    try {
      const result = await req.query(batchQuery);
      savedId = Number(result.recordset?.[0]?.RESULT_ID) || targetId;
    } catch (err: any) {
      logger.error("[KasaHesapSqlRepository.saveHareket] Error:", err);
      throw ApiError.badRequest(err.message || "Hesap hareketi kaydedilemedi.");
    }

    if (!savedId) throw ApiError.internal("Hesap hareketi kaydedildi ancak kimlik bilgisi alınamadı.");

    const saved = await this.getHareketById(savedId, dbContext);
    if (!saved) throw ApiError.internal("Hesap hareketi kaydedildi ancak okunamadı.");
    return saved;
  }

  public static async deleteHareket(
    hesapHareketiId: number,
    kullaniciId: number = 1,
    degisiklikTakipVar: boolean = false,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    try {
      const req = pool.request();
      req.input("HESAP_HAREKETI_ID", sql.Int, hesapHareketiId);
      req.input("KULLANICI_ID", sql.Int, kullaniciId);
      req.input("DEGISIKLIK_TAKIP_VAR", sql.Bit, degisiklikTakipVar ? 1 : 0);
      await req.execute("SODVZ_HESAP_HAREKETI_SIL");
      return true;
    } catch (err: any) {
      logger.error(`[KasaHesapSqlRepository.deleteHareket(${hesapHareketiId})] Error:`, err);
      throw ApiError.badRequest(err.message || "Hesap hareketi silinemedi.");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOOKUPS (Vezneler, Paralar)
  // ═══════════════════════════════════════════════════════════════════════════

  public static async getLookups(dbContext?: { dbServer?: string; dbName?: string }) {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    let vezneler: any[] = [];
    try {
      const vRes = await pool.request().query(`SELECT VEZNE_ID as id, KOD as kod, AD as ad FROM TODVZ_VEZNE ORDER BY KOD ASC`);
      vezneler = vRes.recordset || [];
    } catch {
      vezneler = [];
    }

    let paralar: any[] = [];
    try {
      const pRes = await pool.request().query(`
        SELECT PARA_ID as id, KOD as kod, AD as ad
        FROM TODVZ_PARA
        ORDER BY SIRA_NO ASC, KOD ASC
      `);
      paralar = pRes.recordset || [];
    } catch {
      paralar = [
        { id: 1, kod: "TL", ad: "Türk Lirası" },
        { id: 4, kod: "HAS", ad: "Has Altın" },
      ];
    }

    return { vezneler, paralar };
  }
}
