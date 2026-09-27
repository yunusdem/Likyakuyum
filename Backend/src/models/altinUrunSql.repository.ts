import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { EtiketNumeratorSqlRepository } from "./etiketNumeratorSql.repository.js";
import { UrunResimSqlRepository } from "./urunResimSql.repository.js";

export interface AltinUrunModel {
  altinUrunId: number;
  tarih: string;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  ayar?: string | null;
  ureticiFirma?: string | null;
  orjinalKod?: string | null;
  model?: string | null;
  banko?: string | null;
  miktar: number;
  hasGram: number;
  maliyetIscilik: number;
  maliyetIscilikParaKodu: string;
  maliyetIscilikBirim: string;
  maliyetIscilikTutari: number;
  satisIscilik: number;
  satisIscilikTutari: number;
  iscilikKari: number;
  maliyet: number;
  maliyetParaKodu: string;
  satisFiyati: number;
  satisParaKodu: string;
  satisKariYuzde: number;
  hasKuru1?: number | null;
  hasKuru2?: number | null;
  altinKuru?: number | null;
  usdKuru1?: number | null;
  usdKuru2?: number | null;
  resim?: string | null;
  resimler?: string[];
  satildi: boolean;
  yazdirildi: boolean;
  yazdirildiZamani?: string | null;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveAltinUrunDto {
  altinUrunId?: number | null;
  tarih?: string | null;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  ayar?: string | null;
  ureticiFirma?: string | null;
  orjinalKod?: string | null;
  model?: string | null;
  banko?: string | null;
  miktar?: number;
  hasGram?: number;
  maliyetIscilik?: number;
  maliyetIscilikParaKodu?: string;
  maliyetIscilikBirim?: string;
  maliyetIscilikTutari?: number;
  satisIscilik?: number;
  satisIscilikTutari?: number;
  iscilikKari?: number;
  maliyet?: number;
  maliyetParaKodu?: string;
  satisFiyati?: number;
  satisParaKodu?: string;
  satisKariYuzde?: number;
  hasKuru1?: number | null;
  hasKuru2?: number | null;
  altinKuru?: number | null;
  usdKuru1?: number | null;
  usdKuru2?: number | null;
  resim?: string | null;
  resimler?: string[];
  satildi?: boolean;
}

export class AltinUrunSqlRepository {
  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_ALTIN_URUN', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_ALTIN_URUN] (
            [ALTIN_URUN_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
            [GRUP_KODU] VARCHAR(50) NOT NULL,
            [URUN_NO] INT NOT NULL,
            [BARKOD] VARCHAR(50) NULL,
            [AYAR] VARCHAR(50) NULL,
            [URETICI_FIRMA] VARCHAR(150) NULL,
            [ORJINAL_KOD] VARCHAR(50) NULL,
            [MODEL] VARCHAR(100) NULL,
            [BANKO] VARCHAR(50) NULL,
            [MIKTAR] FLOAT NOT NULL DEFAULT 0,
            [HAS_GRAM] FLOAT NOT NULL DEFAULT 0,
            [MALIYET_ISCILIK] FLOAT NOT NULL DEFAULT 0,
            [MALIYET_ISCILIK_PARA_KODU] VARCHAR(20) NOT NULL DEFAULT 'HAS',
            [MALIYET_ISCILIK_BIRIM] VARCHAR(20) NOT NULL DEFAULT 'Gram',
            [MALIYET_ISCILIK_TUTARI] FLOAT NOT NULL DEFAULT 0,
            [SATIS_ISCILIK] FLOAT NOT NULL DEFAULT 0,
            [SATIS_ISCILIK_TUTARI] FLOAT NOT NULL DEFAULT 0,
            [ISCILIK_KARI] FLOAT NOT NULL DEFAULT 0,
            [MALIYET] FLOAT NOT NULL DEFAULT 0,
            [MALIYET_PARA_KODU] VARCHAR(20) NOT NULL DEFAULT 'HAS',
            [SATIS_FIYATI] FLOAT NOT NULL DEFAULT 0,
            [SATIS_PARA_KODU] VARCHAR(20) NOT NULL DEFAULT 'HAS',
            [SATIS_KARI_YUZDE] FLOAT NOT NULL DEFAULT 0,
            [HAS_KURU_1] FLOAT NULL,
            [HAS_KURU_2] FLOAT NULL,
            [ALTIN_KURU] FLOAT NULL,
            [USD_KURU_1] FLOAT NULL,
            [USD_KURU_2] FLOAT NULL,
            [SATILDI] BIT NOT NULL DEFAULT 0,
            [RESIM] VARBINARY(MAX) NULL,
            [YAZDIRILDI] BIT NOT NULL DEFAULT 0,
            [YAZDIRILDI_ZAMANI] DATETIME NULL,
            [EKLEYEN_ID] INT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL,
            CONSTRAINT [UQ_TODVZ_ALTIN_URUN_GRUP_NO] UNIQUE ([GRUP_KODU], [URUN_NO])
          );
        END;

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN')
        BEGIN
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'YAZDIRILDI')
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [YAZDIRILDI] BIT NOT NULL DEFAULT 0;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'YAZDIRILDI_ZAMANI')
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [YAZDIRILDI_ZAMANI] DATETIME NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'USD_KURU_1')
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [USD_KURU_1] FLOAT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'USD_KURU_2')
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [USD_KURU_2] FLOAT NULL;
        END;
      `);
    } catch (err: any) {
      logger.warn(`[AltinUrunSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  private static async ensureProcedures(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_ALTIN_URUN_KAYDET]
            @ALTIN_URUN_ID              INT OUTPUT,
            @TARIH                      DATETIME,
            @GRUP_KODU                  VARCHAR(50),
            @URUN_NO                    INT,
            @BARKOD                     VARCHAR(50) = NULL,
            @AYAR                       VARCHAR(50),
            @URETICI_FIRMA              VARCHAR(150) = NULL,
            @ORJINAL_KOD                VARCHAR(50) = NULL,
            @MODEL                      VARCHAR(100) = NULL,
            @BANKO                      VARCHAR(50) = NULL,
            @MIKTAR                     FLOAT = 0,
            @HAS_GRAM                   FLOAT = 0,
            @MALIYET_ISCILIK            FLOAT = 0,
            @MALIYET_ISCILIK_PARA_KODU  VARCHAR(20) = 'HAS',
            @MALIYET_ISCILIK_BIRIM      VARCHAR(20) = 'Gram',
            @MALIYET_ISCILIK_TUTARI     FLOAT = 0,
            @SATIS_ISCILIK              FLOAT = 0,
            @SATIS_ISCILIK_TUTARI       FLOAT = 0,
            @ISCILIK_KARI               FLOAT = 0,
            @MALIYET                    FLOAT = 0,
            @MALIYET_PARA_KODU          VARCHAR(20) = 'HAS',
            @SATIS_FIYATI               FLOAT = 0,
            @SATIS_PARA_KODU            VARCHAR(20) = 'HAS',
            @SATIS_KARI_YUZDE           FLOAT = 0,
            @HAS_KURU_1                 FLOAT = NULL,
            @HAS_KURU_2                 FLOAT = NULL,
            @ALTIN_KURU                 FLOAT = NULL,
            @USD_KURU_1                 FLOAT = NULL,
            @USD_KURU_2                 FLOAT = NULL,
            @SATILDI                    BIT = 0,
            @RESIM                      VARBINARY(MAX) = NULL,
            @KULLANICI_ID               INT = NULL,
            @YENI_KAYIT                 BIT OUTPUT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @HATA_MESAJI VARCHAR(500);
            DECLARE @SIMDIKI_ZAMAN DATETIME = GETDATE();

            IF (@ALTIN_URUN_ID IS NULL OR @ALTIN_URUN_ID = 0)
            BEGIN
                SELECT TOP 1 @ALTIN_URUN_ID = ALTIN_URUN_ID
                FROM dbo.TODVZ_ALTIN_URUN
                WHERE GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO;

                IF (@ALTIN_URUN_ID IS NOT NULL AND @ALTIN_URUN_ID > 0)
                    SET @YENI_KAYIT = 0;
                ELSE
                    SET @YENI_KAYIT = 1;
            END
            ELSE
            BEGIN
                SET @YENI_KAYIT = 0;
            END

            BEGIN TRAN;

            IF @YENI_KAYIT = 1
            BEGIN
                INSERT INTO dbo.TODVZ_ALTIN_URUN (
                    TARIH, GRUP_KODU, URUN_NO, BARKOD, AYAR, URETICI_FIRMA, ORJINAL_KOD, MODEL, BANKO,
                    MIKTAR, HAS_GRAM, MALIYET_ISCILIK, MALIYET_ISCILIK_PARA_KODU, MALIYET_ISCILIK_BIRIM,
                    MALIYET_ISCILIK_TUTARI, SATIS_ISCILIK, SATIS_ISCILIK_TUTARI, ISCILIK_KARI, MALIYET,
                    MALIYET_PARA_KODU, SATIS_FIYATI, SATIS_PARA_KODU, SATIS_KARI_YUZDE, HAS_KURU_1, HAS_KURU_2,
                    ALTIN_KURU, USD_KURU_1, USD_KURU_2, SATILDI, RESIM, EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
                )
                VALUES (
                    ISNULL(@TARIH, @SIMDIKI_ZAMAN), @GRUP_KODU, @URUN_NO, @BARKOD, @AYAR, @URETICI_FIRMA, @ORJINAL_KOD, @MODEL, @BANKO,
                    @MIKTAR, @HAS_GRAM, @MALIYET_ISCILIK, @MALIYET_ISCILIK_PARA_KODU, @MALIYET_ISCILIK_BIRIM,
                    @MALIYET_ISCILIK_TUTARI, @SATIS_ISCILIK, @SATIS_ISCILIK_TUTARI, @ISCILIK_KARI, @MALIYET,
                    @MALIYET_PARA_KODU, @SATIS_FIYATI, @SATIS_PARA_KODU, @SATIS_KARI_YUZDE, @HAS_KURU_1, @HAS_KURU_2,
                    @ALTIN_KURU, @USD_KURU_1, @USD_KURU_2, @SATILDI, @RESIM, @KULLANICI_ID, @SIMDIKI_ZAMAN, @KULLANICI_ID, @SIMDIKI_ZAMAN
                );

                IF @@ERROR <> 0
                BEGIN
                    SET @HATA_MESAJI = 'Altın ürün kaydı eklenemedi.';
                    GOTO UNDO;
                END

                SET @ALTIN_URUN_ID = SCOPE_IDENTITY();
            END
            ELSE
            BEGIN
                UPDATE dbo.TODVZ_ALTIN_URUN
                SET TARIH = ISNULL(@TARIH, TARIH), GRUP_KODU = @GRUP_KODU, URUN_NO = @URUN_NO, BARKOD = @BARKOD,
                    AYAR = @AYAR, URETICI_FIRMA = @URETICI_FIRMA, ORJINAL_KOD = @ORJINAL_KOD, MODEL = @MODEL, BANKO = @BANKO,
                    MIKTAR = @MIKTAR, HAS_GRAM = @HAS_GRAM, MALIYET_ISCILIK = @MALIYET_ISCILIK,
                    MALIYET_ISCILIK_PARA_KODU = @MALIYET_ISCILIK_PARA_KODU, MALIYET_ISCILIK_BIRIM = @MALIYET_ISCILIK_BIRIM,
                    MALIYET_ISCILIK_TUTARI = @MALIYET_ISCILIK_TUTARI, SATIS_ISCILIK = @SATIS_ISCILIK,
                    SATIS_ISCILIK_TUTARI = @SATIS_ISCILIK_TUTARI, ISCILIK_KARI = @ISCILIK_KARI, MALIYET = @MALIYET,
                    MALIYET_PARA_KODU = @MALIYET_PARA_KODU, SATIS_FIYATI = @SATIS_FIYATI, SATIS_PARA_KODU = @SATIS_PARA_KODU,
                    SATIS_KARI_YUZDE = @SATIS_KARI_YUZDE, HAS_KURU_1 = @HAS_KURU_1, HAS_KURU_2 = @HAS_KURU_2,
                    ALTIN_KURU = @ALTIN_KURU, USD_KURU_1 = @USD_KURU_1, USD_KURU_2 = @USD_KURU_2, SATILDI = @SATILDI, RESIM = ISNULL(@RESIM, RESIM),
                    GUNCELLEYEN_ID = @KULLANICI_ID, GUNCELLEME_ZAMANI = @SIMDIKI_ZAMAN
                WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

                IF @@ERROR <> 0
                BEGIN
                    SET @HATA_MESAJI = 'Altın ürün kaydı güncellenemedi.';
                    GOTO UNDO;
                END
            END

            COMMIT TRAN;
            RETURN 0;

        UNDO:
            IF @@TRANCOUNT > 0
                ROLLBACK TRAN;
            RAISERROR (@HATA_MESAJI, 16, 1);
            RETURN 1;
        END;
      `);

      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_ALTIN_URUN_SIL]
            @ALTIN_URUN_ID INT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @HATA_MESAJI VARCHAR(500);

            IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_ALTIN_URUN WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID)
            BEGIN
                SET @HATA_MESAJI = 'Silinmek istenen altın ürün kaydı bulunamadı.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            IF EXISTS (SELECT 1 FROM dbo.TODVZ_ALTIN_URUN WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID AND SATILDI = 1)
            BEGIN
                SET @HATA_MESAJI = 'Satışı yapılmış olan ürün silinemez.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            DELETE FROM dbo.TODVZ_ALTIN_URUN WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

            IF @@ERROR <> 0
            BEGIN
                SET @HATA_MESAJI = 'Altın ürün kaydı silinirken hata oluştu.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            RETURN 0;
        END;
      `);

      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_ALTIN_URUN_YAZDIRILDI_ISARETLE]
          @ALTIN_URUN_ID INT,
          @YAZDIRILDI BIT,
          @KULLANICI_ID INT = NULL
        AS
        BEGIN
          SET NOCOUNT ON;
          UPDATE dbo.TODVZ_ALTIN_URUN
            SET YAZDIRILDI = @YAZDIRILDI,
                YAZDIRILDI_ZAMANI = CASE WHEN @YAZDIRILDI = 1 THEN GETDATE() ELSE NULL END,
                GUNCELLEYEN_ID = @KULLANICI_ID,
                GUNCELLEME_ZAMANI = GETDATE()
            WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;
          IF @@ERROR<>0
          BEGIN
            RAISERROR ('Yazdırıldı durumu güncellenemedi.', 16, 1);
            RETURN 1;
          END
          RETURN 0;
        END;
      `);
    } catch (e: any) {
      logger.warn("[AltinUrunSqlRepository.ensureProcedures] Warning:", e.message || e);
    }
  }

  private static mapRow(r: any): AltinUrunModel {
    return {
      altinUrunId: r.ALTIN_URUN_ID,
      tarih: r.TARIH ? new Date(r.TARIH).toISOString() : new Date().toISOString(),
      grupKodu: (r.GRUP_KODU || "").trim(),
      urunNo: r.URUN_NO,
      barkod: r.BARKOD ? r.BARKOD.trim() : null,
      ayar: r.AYAR ? r.AYAR.trim() : null,
      ureticiFirma: r.URETICI_FIRMA ? r.URETICI_FIRMA.trim() : null,
      orjinalKod: r.ORJINAL_KOD ? r.ORJINAL_KOD.trim() : null,
      model: r.MODEL ? r.MODEL.trim() : null,
      banko: r.BANKO ? r.BANKO.trim() : null,
      miktar: Number(r.MIKTAR) || 0,
      hasGram: Number(r.HAS_GRAM) || 0,
      maliyetIscilik: Number(r.MALIYET_ISCILIK) || 0,
      maliyetIscilikParaKodu: (r.MALIYET_ISCILIK_PARA_KODU || "HAS").trim(),
      maliyetIscilikBirim: (r.MALIYET_ISCILIK_BIRIM || "Gram").trim(),
      maliyetIscilikTutari: Number(r.MALIYET_ISCILIK_TUTARI) || 0,
      satisIscilik: Number(r.SATIS_ISCILIK) || 0,
      satisIscilikTutari: Number(r.SATIS_ISCILIK_TUTARI) || 0,
      iscilikKari: Number(r.ISCILIK_KARI) || 0,
      maliyet: Number(r.MALIYET) || 0,
      maliyetParaKodu: (r.MALIYET_PARA_KODU || "HAS").trim(),
      satisFiyati: Number(r.SATIS_FIYATI) || 0,
      satisParaKodu: (r.SATIS_PARA_KODU || "HAS").trim(),
      satisKariYuzde: Number(r.SATIS_KARI_YUZDE) || 0,
      hasKuru1: r.HAS_KURU_1 !== null && r.HAS_KURU_1 !== undefined ? Number(r.HAS_KURU_1) : null,
      hasKuru2: r.HAS_KURU_2 !== null && r.HAS_KURU_2 !== undefined ? Number(r.HAS_KURU_2) : null,
      altinKuru: r.ALTIN_KURU !== null && r.ALTIN_KURU !== undefined ? Number(r.ALTIN_KURU) : null,
      usdKuru1: r.USD_KURU_1 !== null && r.USD_KURU_1 !== undefined ? Number(r.USD_KURU_1) : (r.ALTIN_KURU !== null && r.ALTIN_KURU !== undefined ? Number(r.ALTIN_KURU) : null),
      usdKuru2: r.USD_KURU_2 !== null && r.USD_KURU_2 !== undefined ? Number(r.USD_KURU_2) : (r.ALTIN_KURU !== null && r.ALTIN_KURU !== undefined ? Number(r.ALTIN_KURU) : null),
      resim: r.RESIM ? (Buffer.isBuffer(r.RESIM) ? `data:image/jpeg;base64,${r.RESIM.toString("base64")}` : (typeof r.RESIM === "string" ? r.RESIM : null)) : null,
      satildi: Boolean(r.SATILDI),
      yazdirildi: Boolean(r.YAZDIRILDI),
      yazdirildiZamani: r.YAZDIRILDI_ZAMANI ? new Date(r.YAZDIRILDI_ZAMANI).toISOString() : null,
      ekleyenId: r.EKLEYEN_ID,
      eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : null,
      guncelleyenId: r.GUNCELLEYEN_ID,
      guncellemeZamani: r.GUNCELLEME_ZAMANI ? new Date(r.GUNCELLEME_ZAMANI).toISOString() : null,
    };
  }

  public static async list(
    filter?: {
      search?: string;
      grupKodu?: string;
      ureticiFirma?: string;
      baslangicTarihi?: string;
      bitisTarihi?: string;
      yazdirildi?: boolean;
      satildi?: boolean;
      limit?: number;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<AltinUrunModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const topLimit = filter?.limit && filter.limit > 0 ? filter.limit : 500;
    let query = `SELECT TOP (${topLimit}) * FROM TODVZ_ALTIN_URUN WHERE 1=1`;
    const req = pool.request();

    if (filter?.grupKodu) {
      query += ` AND GRUP_KODU = @GRUP_KODU`;
      req.input("GRUP_KODU", sql.VarChar(50), filter.grupKodu.trim().toUpperCase());
    }
    if (filter?.ureticiFirma) {
      query += ` AND URETICI_FIRMA = @URETICI_FIRMA`;
      req.input("URETICI_FIRMA", sql.VarChar(150), filter.ureticiFirma.trim());
    }
    if (filter?.baslangicTarihi) {
      query += ` AND TARIH >= @BASLANGIC`;
      req.input("BASLANGIC", sql.DateTime, new Date(filter.baslangicTarihi));
    }
    if (filter?.bitisTarihi) {
      query += ` AND TARIH <= @BITIS`;
      req.input("BITIS", sql.DateTime, new Date(filter.bitisTarihi));
    }
    if (filter?.yazdirildi !== undefined) {
      query += ` AND YAZDIRILDI = @YAZDIRILDI`;
      req.input("YAZDIRILDI", sql.Bit, filter.yazdirildi ? 1 : 0);
    }
    if (filter?.satildi !== undefined) {
      query += ` AND SATILDI = @SATILDI`;
      req.input("SATILDI", sql.Bit, filter.satildi ? 1 : 0);
    }
    if (filter?.search) {
      query += ` AND (GRUP_KODU LIKE @SEARCH OR BARKOD LIKE @SEARCH OR MODEL LIKE @SEARCH OR ORJINAL_KOD LIKE @SEARCH OR URETICI_FIRMA LIKE @SEARCH)`;
      req.input("SEARCH", sql.VarChar(100), `%${filter.search.trim()}%`);
    }
    query += ` ORDER BY ALTIN_URUN_ID ASC`;

    const res = await req.query(query);
    const items = (res.recordset || []).map((r) => this.mapRow(r));
    if (items.length > 0) {
      try {
        const ids = items.map((x) => x.altinUrunId).filter(Boolean);
        if (ids.length > 0) {
          const resimRes = await pool.request().query(
            `SELECT ISLEM_ID, DOSYA_YOLU, RESIM_DATA FROM TODVZ_URUN_RESIM WHERE TIP = 0 AND ISLEM_ID IN (${ids.join(",")}) ORDER BY RESIM_ID ASC`
          );
          const resimMap = new Map<number, string[]>();
          for (const row of resimRes.recordset || []) {
            const list = resimMap.get(row.ISLEM_ID) || [];
            let imgStr: string | null = null;
            if (row.RESIM_DATA && Buffer.isBuffer(row.RESIM_DATA)) {
              imgStr = `data:image/jpeg;base64,${row.RESIM_DATA.toString("base64")}`;
            } else if (row.DOSYA_YOLU) {
              imgStr = row.DOSYA_YOLU;
            }
            if (imgStr) {
              list.push(imgStr);
              resimMap.set(row.ISLEM_ID, list);
            }
          }
          for (const item of items) {
            const imgs = resimMap.get(item.altinUrunId);
            if (imgs && imgs.length > 0) {
              item.resimler = imgs;
            } else if (item.resim) {
              item.resimler = [item.resim];
            } else {
              item.resimler = [];
            }
          }
        }
      } catch (err) {
        // fallback
      }
    }
    return items;
  }

  public static async getById(
    altinUrunId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<AltinUrunModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const res = await pool
      .request()
      .input("ALTIN_URUN_ID", sql.Int, altinUrunId)
      .query(`SELECT TOP 1 * FROM TODVZ_ALTIN_URUN WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID`);

    if (!res.recordset || res.recordset.length === 0) return null;
    const model = this.mapRow(res.recordset[0]);
    model.resimler = await UrunResimSqlRepository.getResimlerByIslemId(0, altinUrunId, dbContext);
    if ((!model.resimler || model.resimler.length === 0) && model.resim) {
      model.resimler = [model.resim];
    }
    return model;
  }

  public static async getByBarkod(
    barkod: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<AltinUrunModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const res = await pool
      .request()
      .input("BARKOD", sql.VarChar(50), barkod.trim())
      .query(`SELECT TOP 1 * FROM TODVZ_ALTIN_URUN WHERE BARKOD = @BARKOD`);

    if (!res.recordset || res.recordset.length === 0) return null;
    const model = this.mapRow(res.recordset[0]);
    model.resimler = await UrunResimSqlRepository.getResimlerByIslemId(0, model.altinUrunId, dbContext);
    if ((!model.resimler || model.resimler.length === 0) && model.resim) {
      model.resimler = [model.resim];
    }
    return model;
  }

  public static async save(
    dto: SaveAltinUrunDto,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<AltinUrunModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    let resimBuffer: Buffer | null = null;
    const primaryResim = (dto.resimler && dto.resimler.length > 0) ? dto.resimler[0] : dto.resim;
    if (primaryResim && typeof primaryResim === "string") {
      const matches = primaryResim.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches[2]) {
        resimBuffer = Buffer.from(matches[2], "base64");
      } else {
        try {
          resimBuffer = Buffer.from(primaryResim, "base64");
        } catch {
          resimBuffer = null;
        }
      }
    }

    const safeFloat = (v: any, fallback = 0): number => {
      if (v === undefined || v === null || v === "") return fallback;
      const parsed = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, "."));
      return isNaN(parsed) ? fallback : parsed;
    };

    const safeNullableFloat = (v: any): number | null => {
      if (v === undefined || v === null || v === "") return null;
      const parsed = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, "."));
      return isNaN(parsed) ? null : parsed;
    };

    const targetId = dto.altinUrunId && Number(dto.altinUrunId) > 0 ? Number(dto.altinUrunId) : null;
    
    let parsedTarih = new Date();
    if (dto.tarih) {
      const d = new Date(dto.tarih);
      if (!isNaN(d.getTime())) parsedTarih = d;
    }

    const grupKoduVal = (dto.grupKodu || "").trim().toUpperCase();
    const urunNoVal = safeFloat(dto.urunNo, 1);
    const barkodVal = dto.barkod ? dto.barkod.trim() : null;
    const ayarVal = dto.ayar ? dto.ayar.trim() : null;
    const ureticiFirmaVal = dto.ureticiFirma ? dto.ureticiFirma.trim() : null;
    const orjinalKodVal = dto.orjinalKod ? dto.orjinalKod.trim() : null;
    const modelVal = dto.model ? dto.model.trim() : null;
    const bankoVal = dto.banko ? dto.banko.trim() : null;
    const miktarVal = safeFloat(dto.miktar);
    const hasGramVal = safeFloat(dto.hasGram);
    const maliyetIscilikVal = safeFloat(dto.maliyetIscilik);
    const maliyetIscilikParaKoduVal = dto.maliyetIscilikParaKodu || "HAS";
    const maliyetIscilikBirimVal = dto.maliyetIscilikBirim || "Gram";
    const maliyetIscilikTutariVal = safeFloat(dto.maliyetIscilikTutari);
    const satisIscilikVal = safeFloat(dto.satisIscilik);
    const satisIscilikTutariVal = safeFloat(dto.satisIscilikTutari);
    const iscilikKariVal = safeFloat(dto.iscilikKari);
    const maliyetVal = safeFloat(dto.maliyet);
    const maliyetParaKoduVal = dto.maliyetParaKodu || "HAS";
    const satisFiyatiVal = safeFloat(dto.satisFiyati);
    const satisParaKoduVal = dto.satisParaKodu || "HAS";
    const satisKariYuzdeVal = safeFloat(dto.satisKariYuzde);
    const hasKuru1Val = safeNullableFloat(dto.hasKuru1);
    const hasKuru2Val = safeNullableFloat(dto.hasKuru2);
    const altinKuruVal = safeNullableFloat(dto.altinKuru || dto.usdKuru2 || dto.usdKuru1);
    const usdKuru1Val = safeNullableFloat(dto.usdKuru1);
    const usdKuru2Val = safeNullableFloat(dto.usdKuru2);
    const satildiVal = dto.satildi ? 1 : 0;

    let savedId: number | null = targetId;

    // Check parameters defined in stored procedure to avoid "too many arguments specified"
    let acceptedParams = new Set<string>();
    try {
      const spParams = await pool.request().query(`
        SELECT PARAMETER_NAME 
        FROM INFORMATION_SCHEMA.PARAMETERS 
        WHERE SPECIFIC_NAME = 'SODVZ_ALTIN_URUN_KAYDET'
      `);
      if (spParams.recordset && spParams.recordset.length > 0) {
        acceptedParams = new Set(
          spParams.recordset.map((r: any) => (r.PARAMETER_NAME || "").replace(/^@/, "").toUpperCase())
        );
      }
    } catch {
      // ignore parameter lookup failure
    }

    let spSuccess = false;
    if (acceptedParams.size > 0) {
      try {
        const req = pool.request();
        req.output("ALTIN_URUN_ID", sql.Int, targetId || null);
        req.input("TARIH", sql.DateTime, parsedTarih);
        req.input("GRUP_KODU", sql.VarChar(50), grupKoduVal);
        req.input("URUN_NO", sql.Int, urunNoVal);
        req.input("BARKOD", sql.VarChar(50), barkodVal);
        req.input("AYAR", sql.VarChar(50), ayarVal);
        req.input("URETICI_FIRMA", sql.VarChar(150), ureticiFirmaVal);
        req.input("ORJINAL_KOD", sql.VarChar(50), orjinalKodVal);
        req.input("MODEL", sql.VarChar(100), modelVal);
        req.input("BANKO", sql.VarChar(50), bankoVal);
        req.input("MIKTAR", sql.Float, miktarVal);
        req.input("HAS_GRAM", sql.Float, hasGramVal);
        req.input("MALIYET_ISCILIK", sql.Float, maliyetIscilikVal);
        req.input("MALIYET_ISCILIK_PARA_KODU", sql.VarChar(20), maliyetIscilikParaKoduVal);
        req.input("MALIYET_ISCILIK_BIRIM", sql.VarChar(20), maliyetIscilikBirimVal);
        req.input("MALIYET_ISCILIK_TUTARI", sql.Float, maliyetIscilikTutariVal);
        req.input("SATIS_ISCILIK", sql.Float, satisIscilikVal);
        req.input("SATIS_ISCILIK_TUTARI", sql.Float, satisIscilikTutariVal);
        req.input("ISCILIK_KARI", sql.Float, iscilikKariVal);
        req.input("MALIYET", sql.Float, maliyetVal);
        req.input("MALIYET_PARA_KODU", sql.VarChar(20), maliyetParaKoduVal);
        req.input("SATIS_FIYATI", sql.Float, satisFiyatiVal);
        req.input("SATIS_PARA_KODU", sql.VarChar(20), satisParaKoduVal);
        req.input("SATIS_KARI_YUZDE", sql.Float, satisKariYuzdeVal);
        req.input("HAS_KURU_1", sql.Float, hasKuru1Val);
        req.input("HAS_KURU_2", sql.Float, hasKuru2Val);
        req.input("ALTIN_KURU", sql.Float, altinKuruVal);
        if (acceptedParams.has("USD_KURU_1")) {
          req.input("USD_KURU_1", sql.Float, usdKuru1Val);
        }
        if (acceptedParams.has("USD_KURU_2")) {
          req.input("USD_KURU_2", sql.Float, usdKuru2Val);
        }
        req.input("SATILDI", sql.Bit, satildiVal);
        req.input("RESIM", sql.VarBinary(sql.MAX), resimBuffer);
        req.input("KULLANICI_ID", sql.Int, kullaniciId || null);
        req.output("YENI_KAYIT", sql.Bit);

        const spRes = await req.execute("SODVZ_ALTIN_URUN_KAYDET");
        savedId = Number(spRes?.output?.ALTIN_URUN_ID) || Number(req.parameters.ALTIN_URUN_ID?.value) || savedId;
        spSuccess = true;
      } catch (spErr: any) {
        logger.warn("[AltinUrunSqlRepository.save] SP Execution failed, attempting direct query fallback:", spErr.message);
      }
    }

    if (!spSuccess) {
      try {
        const directReq = pool.request();
        directReq.input("TARGET_ID", sql.Int, targetId || null);
        directReq.input("TARIH", sql.DateTime, parsedTarih);
        directReq.input("GRUP_KODU", sql.VarChar(50), grupKoduVal);
        directReq.input("URUN_NO", sql.Int, urunNoVal);
        directReq.input("BARKOD", sql.VarChar(50), barkodVal);
        directReq.input("AYAR", sql.VarChar(50), ayarVal);
        directReq.input("URETICI_FIRMA", sql.VarChar(150), ureticiFirmaVal);
        directReq.input("ORJINAL_KOD", sql.VarChar(50), orjinalKodVal);
        directReq.input("MODEL", sql.VarChar(100), modelVal);
        directReq.input("BANKO", sql.VarChar(50), bankoVal);
        directReq.input("MIKTAR", sql.Float, miktarVal);
        directReq.input("HAS_GRAM", sql.Float, hasGramVal);
        directReq.input("MALIYET_ISCILIK", sql.Float, maliyetIscilikVal);
        directReq.input("MALIYET_ISCILIK_PARA_KODU", sql.VarChar(20), maliyetIscilikParaKoduVal);
        directReq.input("MALIYET_ISCILIK_BIRIM", sql.VarChar(20), maliyetIscilikBirimVal);
        directReq.input("MALIYET_ISCILIK_TUTARI", sql.Float, maliyetIscilikTutariVal);
        directReq.input("SATIS_ISCILIK", sql.Float, satisIscilikVal);
        directReq.input("SATIS_ISCILIK_TUTARI", sql.Float, satisIscilikTutariVal);
        directReq.input("ISCILIK_KARI", sql.Float, iscilikKariVal);
        directReq.input("MALIYET", sql.Float, maliyetVal);
        directReq.input("MALIYET_PARA_KODU", sql.VarChar(20), maliyetParaKoduVal);
        directReq.input("SATIS_FIYATI", sql.Float, satisFiyatiVal);
        directReq.input("SATIS_PARA_KODU", sql.VarChar(20), satisParaKoduVal);
        directReq.input("SATIS_KARI_YUZDE", sql.Float, satisKariYuzdeVal);
        directReq.input("HAS_KURU_1", sql.Float, hasKuru1Val);
        directReq.input("HAS_KURU_2", sql.Float, hasKuru2Val);
        directReq.input("ALTIN_KURU", sql.Float, altinKuruVal);
        directReq.input("USD_KURU_1", sql.Float, usdKuru1Val);
        directReq.input("USD_KURU_2", sql.Float, usdKuru2Val);
        directReq.input("SATILDI", sql.Bit, satildiVal);
        directReq.input("RESIM", sql.VarBinary(sql.MAX), resimBuffer);
        directReq.input("KULLANICI_ID", sql.Int, kullaniciId || null);

        const directRes = await directReq.query(`
          DECLARE @ACTUAL_ID INT = @TARGET_ID;

          IF (@ACTUAL_ID IS NULL OR @ACTUAL_ID = 0)
          BEGIN
            SELECT TOP 1 @ACTUAL_ID = ALTIN_URUN_ID
            FROM dbo.TODVZ_ALTIN_URUN
            WHERE GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO;
          END

          IF (@ACTUAL_ID IS NOT NULL AND @ACTUAL_ID > 0)
          BEGIN
            UPDATE dbo.TODVZ_ALTIN_URUN
            SET TARIH = ISNULL(@TARIH, TARIH),
                GRUP_KODU = @GRUP_KODU,
                URUN_NO = @URUN_NO,
                BARKOD = @BARKOD,
                AYAR = @AYAR,
                URETICI_FIRMA = @URETICI_FIRMA,
                ORJINAL_KOD = @ORJINAL_KOD,
                MODEL = @MODEL,
                BANKO = @BANKO,
                MIKTAR = @MIKTAR,
                HAS_GRAM = @HAS_GRAM,
                MALIYET_ISCILIK = @MALIYET_ISCILIK,
                MALIYET_ISCILIK_PARA_KODU = @MALIYET_ISCILIK_PARA_KODU,
                MALIYET_ISCILIK_BIRIM = @MALIYET_ISCILIK_BIRIM,
                MALIYET_ISCILIK_TUTARI = @MALIYET_ISCILIK_TUTARI,
                SATIS_ISCILIK = @SATIS_ISCILIK,
                SATIS_ISCILIK_TUTARI = @SATIS_ISCILIK_TUTARI,
                ISCILIK_KARI = @ISCILIK_KARI,
                MALIYET = @MALIYET,
                MALIYET_PARA_KODU = @MALIYET_PARA_KODU,
                SATIS_FIYATI = @SATIS_FIYATI,
                SATIS_PARA_KODU = @SATIS_PARA_KODU,
                SATIS_KARI_YUZDE = @SATIS_KARI_YUZDE,
                HAS_KURU_1 = @HAS_KURU_1,
                HAS_KURU_2 = @HAS_KURU_2,
                ALTIN_KURU = @ALTIN_KURU,
                USD_KURU_1 = @USD_KURU_1,
                USD_KURU_2 = @USD_KURU_2,
                SATILDI = @SATILDI,
                RESIM = ISNULL(@RESIM, RESIM),
                GUNCELLEYEN_ID = @KULLANICI_ID,
                GUNCELLEME_ZAMANI = GETDATE()
            WHERE ALTIN_URUN_ID = @ACTUAL_ID;

            SELECT @ACTUAL_ID AS ALTIN_URUN_ID;
          END
          ELSE
          BEGIN
            INSERT INTO dbo.TODVZ_ALTIN_URUN (
              TARIH, GRUP_KODU, URUN_NO, BARKOD, AYAR, URETICI_FIRMA, ORJINAL_KOD, MODEL, BANKO,
              MIKTAR, HAS_GRAM, MALIYET_ISCILIK, MALIYET_ISCILIK_PARA_KODU, MALIYET_ISCILIK_BIRIM,
              MALIYET_ISCILIK_TUTARI, SATIS_ISCILIK, SATIS_ISCILIK_TUTARI, ISCILIK_KARI, MALIYET,
              MALIYET_PARA_KODU, SATIS_FIYATI, SATIS_PARA_KODU, SATIS_KARI_YUZDE, HAS_KURU_1, HAS_KURU_2,
              ALTIN_KURU, USD_KURU_1, USD_KURU_2, SATILDI, RESIM, EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
            )
            VALUES (
              ISNULL(@TARIH, GETDATE()), @GRUP_KODU, @URUN_NO, @BARKOD, @AYAR, @URETICI_FIRMA, @ORJINAL_KOD, @MODEL, @BANKO,
              @MIKTAR, @HAS_GRAM, @MALIYET_ISCILIK, @MALIYET_ISCILIK_PARA_KODU, @MALIYET_ISCILIK_BIRIM,
              @MALIYET_ISCILIK_TUTARI, @SATIS_ISCILIK, @SATIS_ISCILIK_TUTARI, @ISCILIK_KARI, @MALIYET,
              @MALIYET_PARA_KODU, @SATIS_FIYATI, @SATIS_PARA_KODU, @SATIS_KARI_YUZDE, @HAS_KURU_1, @HAS_KURU_2,
              @ALTIN_KURU, @USD_KURU_1, @USD_KURU_2, @SATILDI, @RESIM, @KULLANICI_ID, GETDATE(), @KULLANICI_ID, GETDATE()
            );

            SELECT SCOPE_IDENTITY() AS ALTIN_URUN_ID;
          END
        `);

        if (directRes.recordset && directRes.recordset.length > 0) {
          savedId = Number(directRes.recordset[0].ALTIN_URUN_ID) || savedId;
        }
      } catch (directErr: any) {
        logger.error("[AltinUrunSqlRepository.save] Direct SQL Error:", directErr);
        const rawMsg = directErr.originalError?.message || directErr.message || "";
        let friendlyMsg = "Altın ürün kaydedilemedi.";
        if (rawMsg.includes("UQ_TODVZ_ALTIN_URUN_GRUP_NO") || rawMsg.includes("Violation of UNIQUE KEY constraint") || rawMsg.includes("daha önce kaydedilmiş")) {
          friendlyMsg = `⚠️ [${grupKoduVal}-${urunNoVal}] numaralı ürün daha önce kaydedilmiş. Lütfen farklı bir ürün numarası giriniz veya mevcut kaydı seçiniz.`;
        } else if (rawMsg) {
          friendlyMsg = rawMsg;
        }
        throw ApiError.badRequest(friendlyMsg);
      }
    }

    if (!savedId) {
      const lookup = await pool.request()
        .input("GRUP_KODU", sql.VarChar(50), (dto.grupKodu || "").trim().toUpperCase())
        .input("URUN_NO", sql.Int, Number(dto.urunNo))
        .query("SELECT TOP 1 ALTIN_URUN_ID FROM dbo.TODVZ_ALTIN_URUN WHERE GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO ORDER BY ALTIN_URUN_ID DESC");
      if (lookup.recordset && lookup.recordset.length > 0) {
        savedId = Number(lookup.recordset[0].ALTIN_URUN_ID);
      }
    }

    if (!savedId) throw ApiError.internal("Altın ürün kaydedildi ancak kimlik bilgisi alınamadı.");

    // Update USD_KURU columns if available
    try {
      await pool.request()
        .input("SAVED_ID", sql.Int, savedId)
        .input("USD_1", sql.Float, usdKuru1Val)
        .input("USD_2", sql.Float, usdKuru2Val)
        .query(`
          UPDATE dbo.TODVZ_ALTIN_URUN
          SET USD_KURU_1 = COALESCE(@USD_1, USD_KURU_1),
              USD_KURU_2 = COALESCE(@USD_2, USD_KURU_2)
          WHERE ALTIN_URUN_ID = @SAVED_ID
        `);
    } catch {
      // Ignore if columns are not present
    }

    // Sync multi images if provided
    if (dto.resimler && Array.isArray(dto.resimler)) {
      await UrunResimSqlRepository.syncResimlerForIslem(0, savedId, dto.resimler, dbContext);
    } else if (dto.resim) {
      await UrunResimSqlRepository.syncResimlerForIslem(0, savedId, [dto.resim], dbContext);
    }

    const saved = await this.getById(savedId, dbContext);
    if (!saved) throw ApiError.internal("Altın ürün kaydedildi ancak okunamadı.");
    return saved;
  }

  public static async remove(
    altinUrunId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    try {
      const req = pool.request();
      req.input("ALTIN_URUN_ID", sql.Int, altinUrunId);
      await req.execute("SODVZ_ALTIN_URUN_SIL");
      return true;
    } catch (err: any) {
      logger.error(`[AltinUrunSqlRepository.remove(${altinUrunId})] Error:`, err);
      throw ApiError.badRequest(err.message || "Altın ürün silinemedi.");
    }
  }

  public static async markYazdirildi(
    ids: number[],
    yazdirildi: boolean,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<void> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    for (const id of ids) {
      const req = pool.request();
      req.input("ALTIN_URUN_ID", sql.Int, id);
      req.input("YAZDIRILDI", sql.Bit, yazdirildi ? 1 : 0);
      req.input("KULLANICI_ID", sql.Int, kullaniciId || null);
      await req.execute("SODVZ_ALTIN_URUN_YAZDIRILDI_ISARETLE");
    }
  }

  public static async getNextUrunNo(
    grupKodu: string,
    uzunluk: number = 5,
    dbContext?: { dbServer?: string; dbName?: string }
  ) {
    return EtiketNumeratorSqlRepository.getNextNo(0, grupKodu, uzunluk, dbContext);
  }

  public static async getDistinctGrupKodlari(dbContext?: { dbServer?: string; dbName?: string }): Promise<string[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    const res = await pool.request().query(`SELECT DISTINCT GRUP_KODU FROM TODVZ_ALTIN_URUN ORDER BY GRUP_KODU ASC`);
    return (res.recordset || []).map((r: any) => (r.GRUP_KODU || "").trim()).filter(Boolean);
  }

  public static async getDistinctUreticiFirmalar(dbContext?: { dbServer?: string; dbName?: string }): Promise<string[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    const res = await pool.request().query(`SELECT DISTINCT URETICI_FIRMA FROM TODVZ_ALTIN_URUN WHERE URETICI_FIRMA IS NOT NULL AND URETICI_FIRMA <> '' ORDER BY URETICI_FIRMA ASC`);
    return (res.recordset || []).map((r: any) => (r.URETICI_FIRMA || "").trim()).filter(Boolean);
  }
}
