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
  vezneId?: number | null;
  vezneKod?: string | null;
  vezneAd?: string | null;
  satildi: boolean;
  yazdirildi: boolean;
  yazdirildiZamani?: string | null;
  rfidEpc?: string | null;
  rfidStatus?: number | null;
  etiketBasimTarihi?: string | null;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveAltinUrunDto {
  altinUrunId?: number | null;
  rfidEpc?: string | null;
  rfidStatus?: number | null;
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
  vezneId?: number | null;
  satildi?: boolean;
}

export class AltinUrunSqlRepository {
  private static ensuredPools = new WeakSet<sql.ConnectionPool>();
  private static acceptedParamsCache: Set<string> | null = null;

  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    if (this.ensuredPools.has(pool)) return;
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
            [VEZNE_ID] INT NULL,
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
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'VEZNE_ID')
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [VEZNE_ID] INT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'YAZDIRILDI')
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [YAZDIRILDI] BIT NOT NULL DEFAULT 0;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'YAZDIRILDI_ZAMANI')
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [YAZDIRILDI_ZAMANI] DATETIME NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'USD_KURU_1')
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [USD_KURU_1] FLOAT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'USD_KURU_2')
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [USD_KURU_2] FLOAT NULL;

          -- Expand any truncated columns
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'AYAR' AND (CHARACTER_MAXIMUM_LENGTH < 250 OR CHARACTER_MAXIMUM_LENGTH = 50))
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [AYAR] VARCHAR(250) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'URETICI_FIRMA' AND (CHARACTER_MAXIMUM_LENGTH < 500 OR CHARACTER_MAXIMUM_LENGTH = 150))
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [URETICI_FIRMA] VARCHAR(500) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'MODEL' AND (CHARACTER_MAXIMUM_LENGTH < 500 OR CHARACTER_MAXIMUM_LENGTH = 100))
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [MODEL] VARCHAR(MAX) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'ORJINAL_KOD' AND (CHARACTER_MAXIMUM_LENGTH < 250 OR CHARACTER_MAXIMUM_LENGTH = 50))
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [ORJINAL_KOD] VARCHAR(250) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'BANKO' AND (CHARACTER_MAXIMUM_LENGTH < 250 OR CHARACTER_MAXIMUM_LENGTH = 50))
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [BANKO] VARCHAR(250) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'BARKOD' AND (CHARACTER_MAXIMUM_LENGTH < 100 OR CHARACTER_MAXIMUM_LENGTH = 50))
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [BARKOD] VARCHAR(100) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'GRUP_KODU' AND (CHARACTER_MAXIMUM_LENGTH < 100 OR CHARACTER_MAXIMUM_LENGTH = 50))
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [GRUP_KODU] VARCHAR(100) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'MALIYET_ISCILIK_PARA_KODU' AND CHARACTER_MAXIMUM_LENGTH < 50)
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [MALIYET_ISCILIK_PARA_KODU] VARCHAR(50) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'MALIYET_ISCILIK_BIRIM' AND CHARACTER_MAXIMUM_LENGTH < 50)
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [MALIYET_ISCILIK_BIRIM] VARCHAR(50) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'MALIYET_PARA_KODU' AND CHARACTER_MAXIMUM_LENGTH < 50)
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [MALIYET_PARA_KODU] VARCHAR(50) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'SATIS_PARA_KODU' AND CHARACTER_MAXIMUM_LENGTH < 50)
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [SATIS_PARA_KODU] VARCHAR(50) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'RESIM' AND DATA_TYPE = 'varbinary' AND CHARACTER_MAXIMUM_LENGTH <> -1)
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [RESIM] VARBINARY(MAX) NULL;
        END;

        -- Ensure standard gold ayar currencies exist in TODVZ_PARA
        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_PARA WHERE KOD = '22')
          INSERT INTO dbo.TODVZ_PARA (KOD, AD, PARITE_ISLEMI, SIRA_NO, HAS_ORANI, URUN_TIPI) VALUES ('22', '22 Ayar Altın', 0, 30, 0.916, 0);

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_PARA WHERE KOD = '14')
          INSERT INTO dbo.TODVZ_PARA (KOD, AD, PARITE_ISLEMI, SIRA_NO, HAS_ORANI, URUN_TIPI) VALUES ('14', '14 Ayar Altın', 0, 31, 0.585, 0);

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_PARA WHERE KOD = '18')
          INSERT INTO dbo.TODVZ_PARA (KOD, AD, PARITE_ISLEMI, SIRA_NO, HAS_ORANI, URUN_TIPI) VALUES ('18', '18 Ayar Altın', 0, 32, 0.750, 0);

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_PARA WHERE KOD = '8')
          INSERT INTO dbo.TODVZ_PARA (KOD, AD, PARITE_ISLEMI, SIRA_NO, HAS_ORANI, URUN_TIPI) VALUES ('8', '8 Ayar Altın', 0, 33, 0.333, 0);

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_PARA WHERE KOD = '24')
          INSERT INTO dbo.TODVZ_PARA (KOD, AD, PARITE_ISLEMI, SIRA_NO, HAS_ORANI, URUN_TIPI) VALUES ('24', '24 Ayar Altın', 0, 34, 1.000, 0);
      `);
      this.ensuredPools.add(pool);
    } catch (err: any) {
      logger.warn(`[AltinUrunSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  private static async ensureProcedures(pool: sql.ConnectionPool): Promise<void> {
    try {
      // Vezneden düşülen stok (vezne / para / miktar) üründe saklanır: düzeltme ve silme aynısını geri alır, raporlar ("Ürün tanımı") bunu okur
      // (rapor denetimi 01.10.2026 — önceden düzeltme / silme parayı kayıttan farklı bir eşleştirmeyle buluyordu)
      await pool.request().query(`
        IF COL_LENGTH('dbo.TODVZ_ALTIN_URUN', 'STOK_VEZNE_ID') IS NULL ALTER TABLE dbo.TODVZ_ALTIN_URUN ADD [STOK_VEZNE_ID] INT NULL;
        IF COL_LENGTH('dbo.TODVZ_ALTIN_URUN', 'STOK_PARA_ID') IS NULL ALTER TABLE dbo.TODVZ_ALTIN_URUN ADD [STOK_PARA_ID] INT NULL;
        IF COL_LENGTH('dbo.TODVZ_ALTIN_URUN', 'STOK_MIKTAR') IS NULL ALTER TABLE dbo.TODVZ_ALTIN_URUN ADD [STOK_MIKTAR] FLOAT NULL;
      `);
      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_ALTIN_URUN_KAYDET]
            @ALTIN_URUN_ID              INT OUTPUT,
            @TARIH                      DATETIME,
            @GRUP_KODU                  VARCHAR(100),
            @URUN_NO                    INT,
            @BARKOD                     VARCHAR(100) = NULL,
            @AYAR                       VARCHAR(250),
            @URETICI_FIRMA              VARCHAR(500) = NULL,
            @ORJINAL_KOD                VARCHAR(250) = NULL,
            @MODEL                      VARCHAR(MAX) = NULL,
            @BANKO                      VARCHAR(250) = NULL,
            @MIKTAR                     FLOAT = 0,
            @HAS_GRAM                   FLOAT = 0,
            @MALIYET_ISCILIK            FLOAT = 0,
            @MALIYET_ISCILIK_PARA_KODU  VARCHAR(50) = 'HAS',
            @MALIYET_ISCILIK_BIRIM      VARCHAR(50) = 'Gram',
            @MALIYET_ISCILIK_TUTARI     FLOAT = 0,
            @SATIS_ISCILIK              FLOAT = 0,
            @SATIS_ISCILIK_TUTARI       FLOAT = 0,
            @ISCILIK_KARI               FLOAT = 0,
            @MALIYET                    FLOAT = 0,
            @MALIYET_PARA_KODU          VARCHAR(50) = 'HAS',
            @SATIS_FIYATI               FLOAT = 0,
            @SATIS_PARA_KODU            VARCHAR(50) = 'HAS',
            @SATIS_KARI_YUZDE           FLOAT = 0,
            @HAS_KURU_1                 FLOAT = NULL,
            @HAS_KURU_2                 FLOAT = NULL,
            @ALTIN_KURU                 FLOAT = NULL,
            @USD_KURU_1                 FLOAT = NULL,
            @USD_KURU_2                 FLOAT = NULL,
            @SATILDI                    BIT = 0,
            @RESIM                      VARBINARY(MAX) = NULL,
            @VEZNE_ID                   INT = NULL,
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

            -- Para ID Bulma (Ayar -> TODVZ_PARA)
            DECLARE @PARA_ID INT = NULL;
            DECLARE @CLEAN_AYAR VARCHAR(50) = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(@AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', ''))));
            
            -- 1. Tam Kod Eşleşmesi
            SELECT TOP 1 @PARA_ID = PARA_ID 
            FROM dbo.TODVZ_PARA 
            WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@AYAR)))
               OR UPPER(LTRIM(RTRIM(KOD))) = @CLEAN_AYAR;

            -- 2. Tam Ad Eşleşmesi (Ziynet coins hariç)
            IF @PARA_ID IS NULL
            BEGIN
                SELECT TOP 1 @PARA_ID = PARA_ID 
                FROM dbo.TODVZ_PARA 
                WHERE (UPPER(LTRIM(RTRIM(AD))) = UPPER(LTRIM(RTRIM(@AYAR)))
                   OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_AYAR + ' AYAR'
                   OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_AYAR + ' AYAR ALTIN'
                   OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_AYAR)
                  AND UPPER(LTRIM(RTRIM(KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM');
            END

            -- 3. TODVZ_AYAR tablosu üzerinden Standart Ayar
            IF @PARA_ID IS NULL
            BEGIN
                DECLARE @STD_AYAR INT = NULL;
                SELECT TOP 1 @STD_AYAR = STANDART_AYAR 
                FROM dbo.TODVZ_AYAR 
                WHERE UPPER(LTRIM(RTRIM(AYAR_KODU))) = UPPER(LTRIM(RTRIM(@AYAR)))
                   OR UPPER(LTRIM(RTRIM(AYAR_ADI))) = UPPER(LTRIM(RTRIM(@AYAR)))
                   OR UPPER(LTRIM(RTRIM(AYAR_KODU))) = @CLEAN_AYAR;

                IF @STD_AYAR IS NOT NULL
                BEGIN
                    SELECT TOP 1 @PARA_ID = PARA_ID 
                    FROM dbo.TODVZ_PARA 
                    WHERE (UPPER(LTRIM(RTRIM(KOD))) = CAST(@STD_AYAR AS VARCHAR(10))
                       OR UPPER(LTRIM(RTRIM(KOD))) = CAST(@STD_AYAR AS VARCHAR(10)) + ' AYAR'
                       OR UPPER(LTRIM(RTRIM(AD))) = CAST(@STD_AYAR AS VARCHAR(10)) + ' AYAR ALTIN'
                       OR UPPER(LTRIM(RTRIM(AD))) = CAST(@STD_AYAR AS VARCHAR(10)) + ' AYAR')
                      AND UPPER(LTRIM(RTRIM(KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM');
                END
            END

            -- 4. Sayısal Ayar (22, 14, 18, 24, 8)
            IF @PARA_ID IS NULL AND TRY_CAST(@CLEAN_AYAR AS INT) IS NOT NULL
            BEGIN
                DECLARE @NUM_AYAR INT = CAST(@CLEAN_AYAR AS INT);
                SELECT TOP 1 @PARA_ID = PARA_ID 
                FROM dbo.TODVZ_PARA 
                WHERE (UPPER(LTRIM(RTRIM(KOD))) = CAST(@NUM_AYAR AS VARCHAR(10))
                   OR UPPER(LTRIM(RTRIM(KOD))) = CAST(@NUM_AYAR AS VARCHAR(10)) + ' AYAR'
                   OR UPPER(LTRIM(RTRIM(AD))) = CAST(@NUM_AYAR AS VARCHAR(10)) + ' AYAR ALTIN'
                   OR UPPER(LTRIM(RTRIM(AD))) = CAST(@NUM_AYAR AS VARCHAR(10)) + ' AYAR')
                  AND UPPER(LTRIM(RTRIM(KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM');
            END

            -- 5. Fallback: HAS / 24 Ayar
            IF @PARA_ID IS NULL
            BEGIN
                SELECT TOP 1 @PARA_ID = PARA_ID 
                FROM dbo.TODVZ_PARA 
                WHERE UPPER(LTRIM(RTRIM(KOD))) IN ('HAS', '24', '24 AYAR')
                ORDER BY PARA_ID ASC;
            END

            BEGIN TRAN;
            DECLARE @STOK_DUSTU BIT = 0;

            -- Stok Kontrolü & Vezne Bakiyesinden Düşme
            IF (@VEZNE_ID IS NOT NULL AND @PARA_ID IS NOT NULL AND @MIKTAR > 0)
            BEGIN
                DECLARE @MEVCUT_STOK FLOAT = 0;
                SELECT @MEVCUT_STOK = ISNULL(MIKTAR, 0) 
                FROM dbo.TODVZ_VEZNE_BAKIYE 
                WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID;

                IF @YENI_KAYIT = 1
                BEGIN
                    IF (@MEVCUT_STOK < @MIKTAR)
                    BEGIN
                        DECLARE @PARA_ADI_HATA VARCHAR(100);
                        SELECT @PARA_ADI_HATA = AD FROM dbo.TODVZ_PARA WHERE PARA_ID = @PARA_ID;
                        SET @HATA_MESAJI = 'Seçili veznede yeterli ' + ISNULL(@PARA_ADI_HATA, @AYAR) + ' stoğu bulunamadı! Mevcut Stok: ' + CAST(@MEVCUT_STOK AS VARCHAR(30)) + ' gr, İstenen: ' + CAST(@MIKTAR AS VARCHAR(30)) + ' gr.';
                        GOTO UNDO;
                    END

                    -- Stoktan Düş
                    IF EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID)
                        UPDATE dbo.TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR - @MIKTAR WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID;
                    ELSE
                        INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@VEZNE_ID, @PARA_ID, -@MIKTAR);
                    SET @STOK_DUSTU = 1;
                END
                ELSE
                BEGIN
                    -- Güncelleme: Eski kaydın stoğunu geri iade et
                    DECLARE @ESKI_VEZNE_ID INT = NULL;
                    DECLARE @ESKI_AYAR VARCHAR(250) = NULL;
                    DECLARE @ESKI_MIKTAR FLOAT = 0;
                    DECLARE @ESKI_PARA_ID INT = NULL;

                    DECLARE @ESKI_STOK_PARA_ID INT = NULL;
                    SELECT @ESKI_VEZNE_ID = COALESCE(STOK_VEZNE_ID, VEZNE_ID), @ESKI_AYAR = AYAR, @ESKI_MIKTAR = COALESCE(STOK_MIKTAR, ISNULL(MIKTAR, 0)), @ESKI_STOK_PARA_ID = STOK_PARA_ID
                    FROM dbo.TODVZ_ALTIN_URUN
                    WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

                    IF (@ESKI_VEZNE_ID IS NOT NULL AND @ESKI_MIKTAR > 0)
                    BEGIN
                        SET @ESKI_PARA_ID = @ESKI_STOK_PARA_ID;
                        -- Eski PARA_ID bul
                        IF @ESKI_PARA_ID IS NULL SELECT TOP 1 @ESKI_PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@ESKI_AYAR)));
                        IF @ESKI_PARA_ID IS NULL
                            SELECT TOP 1 @ESKI_PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(AD))) LIKE '%' + UPPER(LTRIM(RTRIM(@ESKI_AYAR))) + '%';
                        IF @ESKI_PARA_ID IS NULL
                            SET @ESKI_PARA_ID = @PARA_ID;

                        UPDATE dbo.TODVZ_VEZNE_BAKIYE 
                        SET MIKTAR = MIKTAR + @ESKI_MIKTAR 
                        WHERE VEZNE_ID = @ESKI_VEZNE_ID AND PARA_ID = @ESKI_PARA_ID;
                    END

                    -- Yeni miktar için kontrol ve düşüş
                    SELECT @MEVCUT_STOK = ISNULL(MIKTAR, 0) 
                    FROM dbo.TODVZ_VEZNE_BAKIYE 
                    WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID;

                    IF (@MEVCUT_STOK < @MIKTAR)
                    BEGIN
                        DECLARE @PARA_ADI_HATA2 VARCHAR(100);
                        SELECT @PARA_ADI_HATA2 = AD FROM dbo.TODVZ_PARA WHERE PARA_ID = @PARA_ID;
                        SET @HATA_MESAJI = 'Seçili veznede yeterli ' + ISNULL(@PARA_ADI_HATA2, @AYAR) + ' stoğu bulunamadı! Mevcut Stok: ' + CAST(@MEVCUT_STOK AS VARCHAR(30)) + ' gr, İstenen: ' + CAST(@MIKTAR AS VARCHAR(30)) + ' gr.';
                        GOTO UNDO;
                    END

                    IF EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID)
                        UPDATE dbo.TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR - @MIKTAR WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID;
                    ELSE
                        INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@VEZNE_ID, @PARA_ID, -@MIKTAR);
                    SET @STOK_DUSTU = 1;
                END
            END

            IF @YENI_KAYIT = 1
            BEGIN
                INSERT INTO dbo.TODVZ_ALTIN_URUN (
                    TARIH, GRUP_KODU, URUN_NO, BARKOD, AYAR, URETICI_FIRMA, ORJINAL_KOD, MODEL, BANKO,
                    MIKTAR, HAS_GRAM, MALIYET_ISCILIK, MALIYET_ISCILIK_PARA_KODU, MALIYET_ISCILIK_BIRIM,
                    MALIYET_ISCILIK_TUTARI, SATIS_ISCILIK, SATIS_ISCILIK_TUTARI, ISCILIK_KARI, MALIYET,
                    MALIYET_PARA_KODU, SATIS_FIYATI, SATIS_PARA_KODU, SATIS_KARI_YUZDE, HAS_KURU_1, HAS_KURU_2,
                    ALTIN_KURU, USD_KURU_1, USD_KURU_2, SATILDI, RESIM, VEZNE_ID, EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
                )
                VALUES (
                    ISNULL(@TARIH, @SIMDIKI_ZAMAN), @GRUP_KODU, @URUN_NO, @BARKOD, @AYAR, @URETICI_FIRMA, @ORJINAL_KOD, @MODEL, @BANKO,
                    @MIKTAR, @HAS_GRAM, @MALIYET_ISCILIK, @MALIYET_ISCILIK_PARA_KODU, @MALIYET_ISCILIK_BIRIM,
                    @MALIYET_ISCILIK_TUTARI, @SATIS_ISCILIK, @SATIS_ISCILIK_TUTARI, @ISCILIK_KARI, @MALIYET,
                    @MALIYET_PARA_KODU, @SATIS_FIYATI, @SATIS_PARA_KODU, @SATIS_KARI_YUZDE, @HAS_KURU_1, @HAS_KURU_2,
                    @ALTIN_KURU, @USD_KURU_1, @USD_KURU_2, @SATILDI, @RESIM, @VEZNE_ID, @KULLANICI_ID, @SIMDIKI_ZAMAN, @KULLANICI_ID, @SIMDIKI_ZAMAN
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
                    VEZNE_ID = ISNULL(@VEZNE_ID, VEZNE_ID),
                    GUNCELLEYEN_ID = @KULLANICI_ID, GUNCELLEME_ZAMANI = @SIMDIKI_ZAMAN
                WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

                IF @@ERROR <> 0
                BEGIN
                    SET @HATA_MESAJI = 'Altın ürün kaydı güncellenemedi.';
                    GOTO UNDO;
                END
            END

            IF @STOK_DUSTU = 1
                UPDATE dbo.TODVZ_ALTIN_URUN SET STOK_VEZNE_ID = @VEZNE_ID, STOK_PARA_ID = @PARA_ID, STOK_MIKTAR = @MIKTAR WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

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

            BEGIN TRAN;

            -- Stoğu vezneye iade et
            DECLARE @VEZNE_ID INT, @AYAR VARCHAR(250), @MIKTAR FLOAT;
            DECLARE @SIL_STOK_PARA_ID INT = NULL;
            SELECT @VEZNE_ID = COALESCE(STOK_VEZNE_ID, VEZNE_ID), @AYAR = AYAR, @MIKTAR = COALESCE(STOK_MIKTAR, ISNULL(MIKTAR, 0)), @SIL_STOK_PARA_ID = STOK_PARA_ID
            FROM dbo.TODVZ_ALTIN_URUN
            WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

            IF (@VEZNE_ID IS NOT NULL AND @MIKTAR > 0)
            BEGIN
                DECLARE @PARA_ID INT = @SIL_STOK_PARA_ID;
                DECLARE @CLEAN_AYAR VARCHAR(50) = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(@AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', ''))));
                IF @PARA_ID IS NULL
                    SELECT TOP 1 @PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@AYAR))) OR UPPER(LTRIM(RTRIM(KOD))) = @CLEAN_AYAR;
                IF @PARA_ID IS NULL
                    SELECT TOP 1 @PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(AD))) LIKE '%' + @CLEAN_AYAR + '%';
                IF @PARA_ID IS NULL
                    SELECT TOP 1 @PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) IN ('HAS', '24');

                IF @PARA_ID IS NOT NULL
                BEGIN
                    IF EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID)
                        UPDATE dbo.TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR + @MIKTAR WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID;
                    ELSE
                        INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@VEZNE_ID, @PARA_ID, @MIKTAR);
                END
            END

            DELETE FROM dbo.TODVZ_ALTIN_URUN WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

            IF @@ERROR <> 0
            BEGIN
                IF @@TRANCOUNT > 0 ROLLBACK TRAN;
                SET @HATA_MESAJI = 'Altın ürün kaydı silinirken hata oluştu.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            COMMIT TRAN;
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
      vezneId: r.VEZNE_ID !== null && r.VEZNE_ID !== undefined ? Number(r.VEZNE_ID) : null,
      vezneKod: r.VEZNE_KOD ? (r.VEZNE_KOD || "").trim() : undefined,
      vezneAd: r.VEZNE_AD ? (r.VEZNE_AD || "").trim() : undefined,
      satildi: Boolean(r.SATILDI),
      yazdirildi: Boolean(r.YAZDIRILDI),
      yazdirildiZamani: r.YAZDIRILDI_ZAMANI ? new Date(r.YAZDIRILDI_ZAMANI).toISOString() : null,
      rfidEpc: r.RFID_EPC ? r.RFID_EPC.trim() : null,
      rfidStatus: r.RFID_STATUS !== null && r.RFID_STATUS !== undefined ? Number(r.RFID_STATUS) : null,
      etiketBasimTarihi: r.ETIKET_BASIM_TARIHI ? new Date(r.ETIKET_BASIM_TARIHI).toISOString() : null,
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
    let query = `
      SELECT TOP (${topLimit}) u.*, v.KOD AS VEZNE_KOD, v.AD AS VEZNE_AD 
      FROM TODVZ_ALTIN_URUN u
      LEFT JOIN TODVZ_VEZNE v ON v.VEZNE_ID = u.VEZNE_ID
      WHERE 1=1
    `;
    const req = pool.request();

    if (filter?.grupKodu) {
      query += ` AND u.GRUP_KODU = @GRUP_KODU`;
      req.input("GRUP_KODU", sql.VarChar(50), filter.grupKodu.trim().toUpperCase());
    }
    if (filter?.ureticiFirma) {
      query += ` AND u.URETICI_FIRMA = @URETICI_FIRMA`;
      req.input("URETICI_FIRMA", sql.VarChar(150), filter.ureticiFirma.trim());
    }
    if (filter?.baslangicTarihi) {
      query += ` AND u.TARIH >= @BASLANGIC`;
      req.input("BASLANGIC", sql.DateTime, new Date(filter.baslangicTarihi));
    }
    if (filter?.bitisTarihi) {
      query += ` AND u.TARIH <= @BITIS`;
      req.input("BITIS", sql.DateTime, new Date(filter.bitisTarihi));
    }
    if (filter?.yazdirildi !== undefined) {
      query += ` AND u.YAZDIRILDI = @YAZDIRILDI`;
      req.input("YAZDIRILDI", sql.Bit, filter.yazdirildi ? 1 : 0);
    }
    if (filter?.satildi !== undefined) {
      query += ` AND u.SATILDI = @SATILDI`;
      req.input("SATILDI", sql.Bit, filter.satildi ? 1 : 0);
    }
    if (filter?.search) {
      query += ` AND (u.GRUP_KODU LIKE @SEARCH OR u.BARKOD LIKE @SEARCH OR u.MODEL LIKE @SEARCH OR u.ORJINAL_KOD LIKE @SEARCH OR u.URETICI_FIRMA LIKE @SEARCH)`;
      req.input("SEARCH", sql.VarChar(100), `%${filter.search.trim()}%`);
    }
    query += ` ORDER BY u.ALTIN_URUN_ID ASC`;

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
      .query(`
        SELECT TOP 1 u.*, v.KOD AS VEZNE_KOD, v.AD AS VEZNE_AD 
        FROM TODVZ_ALTIN_URUN u
        LEFT JOIN TODVZ_VEZNE v ON v.VEZNE_ID = u.VEZNE_ID
        WHERE u.ALTIN_URUN_ID = @ALTIN_URUN_ID
      `);

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
      .query(`
        SELECT TOP 1 u.*, v.KOD AS VEZNE_KOD, v.AD AS VEZNE_AD 
        FROM TODVZ_ALTIN_URUN u
        LEFT JOIN TODVZ_VEZNE v ON v.VEZNE_ID = u.VEZNE_ID
        WHERE u.BARKOD = @BARKOD
           OR (u.GRUP_KODU + CAST(u.URUN_NO AS VARCHAR(20))) = @BARKOD
           OR (u.GRUP_KODU + '-' + CAST(u.URUN_NO AS VARCHAR(20))) = @BARKOD
           OR u.ORJINAL_KOD = @BARKOD
      `);

    if (!res.recordset || res.recordset.length === 0) return null;
    const model = this.mapRow(res.recordset[0]);
    model.resimler = await UrunResimSqlRepository.getResimlerByIslemId(0, model.altinUrunId, dbContext);
    if ((!model.resimler || model.resimler.length === 0) && model.resim) {
      model.resimler = [model.resim];
    }
    return model;
  }

  public static async getStok(
    vezneId: number,
    ayar: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ 
    paraId: number | null; 
    paraKodu: string | null; 
    paraAdi: string | null; 
    bakiye: number; 
    tumBakiyeler: Record<string, number>;
  }> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    const cleanAyar = (ayar || "").trim().toUpperCase().replace(/AYAR/g, "").replace(/\s+/g, "");

    const req = pool.request();
    req.input("AYAR", sql.VarChar(100), (ayar || "").trim());
    req.input("CLEAN_AYAR", sql.VarChar(50), cleanAyar);
    req.input("VEZNE_ID", sql.Int, vezneId);

    const res = await req.query(`
      DECLARE @PARA_ID INT = NULL;

      -- 1. Tam Kod Eşleşmesi (Örn: '22', '14', '18', '24', 'HAS', '22 FANTAZI')
      SELECT TOP 1 @PARA_ID = PARA_ID 
      FROM dbo.TODVZ_PARA 
      WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@AYAR)))
         OR UPPER(LTRIM(RTRIM(KOD))) = @CLEAN_AYAR;

      -- 2. Özel Para Birimi Aliasları (USD, EUR, TL, HAS vb.)
      IF @PARA_ID IS NULL
      BEGIN
        IF UPPER(@CLEAN_AYAR) IN ('USD', '$', 'DOLAR', 'DOLLAR', 'AMERIKANDOLARI')
          SELECT TOP 1 @PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) IN ('USD', '$') OR UPPER(LTRIM(RTRIM(AD))) LIKE '%DOLAR%';
        ELSE IF UPPER(@CLEAN_AYAR) IN ('EUR', 'EURO', '€')
          SELECT TOP 1 @PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) IN ('EUR', 'EURO', '€') OR UPPER(LTRIM(RTRIM(AD))) LIKE '%EURO%';
        ELSE IF UPPER(@CLEAN_AYAR) IN ('TL', 'TRY', '₺', 'TURKLIRASI')
          SELECT TOP 1 @PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) IN ('TL', 'TRY', '₺') OR UPPER(LTRIM(RTRIM(AD))) LIKE '%TURK%';
        ELSE IF UPPER(@CLEAN_AYAR) IN ('HAS', 'ALTIN', '24', '24AYAR', 'HASALTIN')
          SELECT TOP 1 @PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) IN ('HAS', '24', '24 AYAR') OR UPPER(LTRIM(RTRIM(AD))) LIKE '%HAS%';
      END

      -- 3. Tam Ad Eşleşmesi (Ziynet coins hariç)
      IF @PARA_ID IS NULL
      BEGIN
          SELECT TOP 1 @PARA_ID = PARA_ID 
          FROM dbo.TODVZ_PARA 
          WHERE (UPPER(LTRIM(RTRIM(AD))) = UPPER(LTRIM(RTRIM(@AYAR)))
             OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_AYAR + ' AYAR'
             OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_AYAR + ' AYAR ALTIN'
             OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_AYAR)
            AND UPPER(LTRIM(RTRIM(KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM');
      END

      -- 4. TODVZ_AYAR tablosu üzerinden Standart Ayar
      IF @PARA_ID IS NULL
      BEGIN
          DECLARE @STD_AYAR INT = NULL;
          SELECT TOP 1 @STD_AYAR = STANDART_AYAR 
          FROM dbo.TODVZ_AYAR 
          WHERE UPPER(LTRIM(RTRIM(AYAR_KODU))) = UPPER(LTRIM(RTRIM(@AYAR)))
             OR UPPER(LTRIM(RTRIM(AYAR_ADI))) = UPPER(LTRIM(RTRIM(@AYAR)))
             OR UPPER(LTRIM(RTRIM(AYAR_KODU))) = @CLEAN_AYAR;

          IF @STD_AYAR IS NOT NULL
          BEGIN
              SELECT TOP 1 @PARA_ID = PARA_ID 
              FROM dbo.TODVZ_PARA 
              WHERE (UPPER(LTRIM(RTRIM(KOD))) = CAST(@STD_AYAR AS VARCHAR(10))
                 OR UPPER(LTRIM(RTRIM(KOD))) = CAST(@STD_AYAR AS VARCHAR(10)) + ' AYAR'
                 OR UPPER(LTRIM(RTRIM(AD))) = CAST(@STD_AYAR AS VARCHAR(10)) + ' AYAR ALTIN'
                 OR UPPER(LTRIM(RTRIM(AD))) = CAST(@STD_AYAR AS VARCHAR(10)) + ' AYAR')
                AND UPPER(LTRIM(RTRIM(KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM');
          END
      END

      -- 5. Sayısal Ayar (22, 14, 18, 24, 8)
      IF @PARA_ID IS NULL AND TRY_CAST(@CLEAN_AYAR AS INT) IS NOT NULL
      BEGIN
          DECLARE @NUM_AYAR INT = CAST(@CLEAN_AYAR AS INT);
          SELECT TOP 1 @PARA_ID = PARA_ID 
          FROM dbo.TODVZ_PARA 
          WHERE (UPPER(LTRIM(RTRIM(KOD))) = CAST(@NUM_AYAR AS VARCHAR(10))
             OR UPPER(LTRIM(RTRIM(KOD))) = CAST(@NUM_AYAR AS VARCHAR(10)) + ' AYAR'
             OR UPPER(LTRIM(RTRIM(AD))) = CAST(@NUM_AYAR AS VARCHAR(10)) + ' AYAR ALTIN'
             OR UPPER(LTRIM(RTRIM(AD))) = CAST(@NUM_AYAR AS VARCHAR(10)) + ' AYAR')
            AND UPPER(LTRIM(RTRIM(KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM');
      END

      -- 6. Fallback to HAS / 24
      IF @PARA_ID IS NULL
      BEGIN
          SELECT TOP 1 @PARA_ID = PARA_ID 
          FROM dbo.TODVZ_PARA 
          WHERE UPPER(LTRIM(RTRIM(KOD))) IN ('HAS', '24', '24 AYAR')
          ORDER BY PARA_ID ASC;
      END

      -- Seçili Para / Ayar Bakiyesi
      SELECT 
        p.PARA_ID AS paraId,
        LTRIM(RTRIM(ISNULL(p.KOD, ''))) AS paraKodu,
        LTRIM(RTRIM(ISNULL(p.AD, ''))) AS paraAdi,
        ISNULL(b.MIKTAR, 0) AS bakiye
      FROM dbo.TODVZ_PARA p
      LEFT JOIN dbo.TODVZ_VEZNE_BAKIYE b ON b.PARA_ID = p.PARA_ID AND b.VEZNE_ID = @VEZNE_ID
      WHERE p.PARA_ID = @PARA_ID;

      -- Veznenin Tüm Bakiyeleri (Vezne İzleme ile %100 Senkron)
      SELECT 
        p.PARA_ID AS paraId,
        LTRIM(RTRIM(ISNULL(p.KOD, ''))) AS paraKodu,
        LTRIM(RTRIM(ISNULL(p.AD, ''))) AS paraAdi,
        ISNULL(b.MIKTAR, 0) AS bakiye
      FROM dbo.TODVZ_PARA p
      LEFT JOIN dbo.TODVZ_VEZNE_BAKIYE b ON b.PARA_ID = p.PARA_ID AND b.VEZNE_ID = @VEZNE_ID
      ORDER BY p.PARA_ID ASC;
    `);

    const specificRow = (res.recordsets as any)?.[0]?.[0] || null;
    const allRows = ((res.recordsets as any)?.[1] || []) as any[];

    const tumBakiyeler: Record<string, number> = {};
    for (const r of allRows) {
      const k = (r.paraKodu || "").trim().toUpperCase();
      if (k) {
        tumBakiyeler[k] = Number(r.bakiye) || 0;
      }
      if (r.paraAdi) {
        tumBakiyeler[r.paraAdi.trim().toUpperCase()] = Number(r.bakiye) || 0;
      }
    }

    return {
      paraId: specificRow?.paraId ? Number(specificRow.paraId) : null,
      paraKodu: specificRow?.paraKodu ? (specificRow.paraKodu || "").trim() : null,
      paraAdi: specificRow?.paraAdi ? (specificRow.paraAdi || "").trim() : null,
      bakiye: specificRow?.bakiye !== undefined && specificRow.bakiye !== null ? Number(specificRow.bakiye) : 0,
      tumBakiyeler,
    };
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
    const maliyetIscilikParaKoduVal = (dto.maliyetIscilikParaKodu || "HAS").trim();
    const maliyetIscilikBirimVal = (dto.maliyetIscilikBirim || "Gram").trim();
    const maliyetIscilikTutariVal = safeFloat(dto.maliyetIscilikTutari);
    const satisIscilikVal = safeFloat(dto.satisIscilik);
    const satisIscilikTutariVal = safeFloat(dto.satisIscilikTutari);
    const iscilikKariVal = safeFloat(dto.iscilikKari);
    const maliyetVal = safeFloat(dto.maliyet);
    const maliyetParaKoduVal = (dto.maliyetParaKodu || "HAS").trim();
    const satisFiyatiVal = safeFloat(dto.satisFiyati);
    const satisParaKoduVal = (dto.satisParaKodu || "HAS").trim();
    const satisKariYuzdeVal = safeFloat(dto.satisKariYuzde);
    const hasKuru1Val = safeNullableFloat(dto.hasKuru1);
    const hasKuru2Val = safeNullableFloat(dto.hasKuru2);
    const altinKuruVal = safeNullableFloat(dto.altinKuru || dto.usdKuru2 || dto.usdKuru1);
    const usdKuru1Val = safeNullableFloat(dto.usdKuru1);
    const usdKuru2Val = safeNullableFloat(dto.usdKuru2);
    const vezneIdVal = dto.vezneId && Number(dto.vezneId) > 0 ? Number(dto.vezneId) : null;
    const satildiVal = dto.satildi ? 1 : 0;

    let savedId: number | null = targetId;

    // Check parameters defined in stored procedure to avoid "too many arguments specified"
    let acceptedParams = this.acceptedParamsCache;
    if (!acceptedParams) {
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
          this.acceptedParamsCache = acceptedParams;
        }
      } catch {
        // ignore parameter lookup failure
      }
    }
    acceptedParams = acceptedParams || new Set<string>();

    let spSuccess = false;
    if (acceptedParams.size > 0) {
      try {
        const req = pool.request();
        if (acceptedParams.has("ALTIN_URUN_ID")) req.output("ALTIN_URUN_ID", sql.Int, targetId || null);
        if (acceptedParams.has("TARIH")) req.input("TARIH", sql.DateTime, parsedTarih);
        if (acceptedParams.has("GRUP_KODU")) req.input("GRUP_KODU", sql.VarChar(100), grupKoduVal);
        if (acceptedParams.has("URUN_NO")) req.input("URUN_NO", sql.Int, urunNoVal);
        if (acceptedParams.has("BARKOD")) req.input("BARKOD", sql.VarChar(100), barkodVal);
        if (acceptedParams.has("AYAR")) req.input("AYAR", sql.VarChar(250), ayarVal);
        if (acceptedParams.has("URETICI_FIRMA")) req.input("URETICI_FIRMA", sql.VarChar(500), ureticiFirmaVal);
        if (acceptedParams.has("ORJINAL_KOD")) req.input("ORJINAL_KOD", sql.VarChar(250), orjinalKodVal);
        if (acceptedParams.has("MODEL")) req.input("MODEL", sql.VarChar(sql.MAX), modelVal);
        if (acceptedParams.has("BANKO")) req.input("BANKO", sql.VarChar(250), bankoVal);
        if (acceptedParams.has("MIKTAR")) req.input("MIKTAR", sql.Float, miktarVal);
        if (acceptedParams.has("HAS_GRAM")) req.input("HAS_GRAM", sql.Float, hasGramVal);
        if (acceptedParams.has("MALIYET_ISCILIK")) req.input("MALIYET_ISCILIK", sql.Float, maliyetIscilikVal);
        if (acceptedParams.has("MALIYET_ISCILIK_PARA_KODU")) req.input("MALIYET_ISCILIK_PARA_KODU", sql.VarChar(50), maliyetIscilikParaKoduVal);
        if (acceptedParams.has("MALIYET_ISCILIK_BIRIM")) req.input("MALIYET_ISCILIK_BIRIM", sql.VarChar(50), maliyetIscilikBirimVal);
        if (acceptedParams.has("MALIYET_ISCILIK_TUTARI")) req.input("MALIYET_ISCILIK_TUTARI", sql.Float, maliyetIscilikTutariVal);
        if (acceptedParams.has("SATIS_ISCILIK")) req.input("SATIS_ISCILIK", sql.Float, satisIscilikVal);
        if (acceptedParams.has("SATIS_ISCILIK_TUTARI")) req.input("SATIS_ISCILIK_TUTARI", sql.Float, satisIscilikTutariVal);
        if (acceptedParams.has("ISCILIK_KARI")) req.input("ISCILIK_KARI", sql.Float, iscilikKariVal);
        if (acceptedParams.has("MALIYET")) req.input("MALIYET", sql.Float, maliyetVal);
        if (acceptedParams.has("MALIYET_PARA_KODU")) req.input("MALIYET_PARA_KODU", sql.VarChar(50), maliyetParaKoduVal);
        if (acceptedParams.has("SATIS_FIYATI")) req.input("SATIS_FIYATI", sql.Float, satisFiyatiVal);
        if (acceptedParams.has("SATIS_PARA_KODU")) req.input("SATIS_PARA_KODU", sql.VarChar(50), satisParaKoduVal);
        if (acceptedParams.has("SATIS_KARI_YUZDE")) {
          req.input("SATIS_KARI_YUZDE", sql.Float, satisKariYuzdeVal);
        } else if (acceptedParams.has("SATIS_KARIYUZDE")) {
          req.input("SATIS_KARIYUZDE", sql.Float, satisKariYuzdeVal);
        }
        if (acceptedParams.has("HAS_KURU_1")) req.input("HAS_KURU_1", sql.Float, hasKuru1Val);
        if (acceptedParams.has("HAS_KURU_2")) req.input("HAS_KURU_2", sql.Float, hasKuru2Val);
        if (acceptedParams.has("ALTIN_KURU")) req.input("ALTIN_KURU", sql.Float, altinKuruVal);
        if (acceptedParams.has("USD_KURU_1")) req.input("USD_KURU_1", sql.Float, usdKuru1Val);
        if (acceptedParams.has("USD_KURU_2")) req.input("USD_KURU_2", sql.Float, usdKuru2Val);
        if (acceptedParams.has("VEZNE_ID")) req.input("VEZNE_ID", sql.Int, vezneIdVal);
        if (acceptedParams.has("SATILDI")) req.input("SATILDI", sql.Bit, satildiVal);
        if (acceptedParams.has("RESIM")) req.input("RESIM", sql.VarBinary(sql.MAX), resimBuffer);
        if (acceptedParams.has("KULLANICI_ID")) req.input("KULLANICI_ID", sql.Int, kullaniciId || null);
        if (acceptedParams.has("YENI_KAYIT")) req.output("YENI_KAYIT", sql.Bit);

        const spRes = await req.execute("SODVZ_ALTIN_URUN_KAYDET");
        savedId = Number(spRes?.output?.ALTIN_URUN_ID) || Number(req.parameters.ALTIN_URUN_ID?.value) || savedId;
        spSuccess = true;
      } catch (spErr: any) {
        logger.warn("[AltinUrunSqlRepository.save] SP Execution failed, attempting direct query fallback:", spErr.message);
        if (spErr.message && (spErr.message.includes("stoğu bulunamadı") || spErr.message.includes("stok"))) {
          throw ApiError.badRequest(spErr.message);
        }
      }
    }

    if (!spSuccess) {
      const executeDirectUpsert = async (withResim: boolean) => {
        const directReq = pool.request();
        directReq.input("TARGET_ID", sql.Int, targetId || null);
        directReq.input("TARIH", sql.DateTime, parsedTarih);
        directReq.input("GRUP_KODU", sql.VarChar(100), grupKoduVal);
        directReq.input("URUN_NO", sql.Int, urunNoVal);
        directReq.input("BARKOD", sql.VarChar(100), barkodVal);
        directReq.input("AYAR", sql.VarChar(250), ayarVal);
        directReq.input("URETICI_FIRMA", sql.VarChar(500), ureticiFirmaVal);
        directReq.input("ORJINAL_KOD", sql.VarChar(250), orjinalKodVal);
        directReq.input("MODEL", sql.VarChar(sql.MAX), modelVal);
        directReq.input("BANKO", sql.VarChar(250), bankoVal);
        directReq.input("MIKTAR", sql.Float, miktarVal);
        directReq.input("HAS_GRAM", sql.Float, hasGramVal);
        directReq.input("MALIYET_ISCILIK", sql.Float, maliyetIscilikVal);
        directReq.input("MALIYET_ISCILIK_PARA_KODU", sql.VarChar(50), maliyetIscilikParaKoduVal);
        directReq.input("MALIYET_ISCILIK_BIRIM", sql.VarChar(50), maliyetIscilikBirimVal);
        directReq.input("MALIYET_ISCILIK_TUTARI", sql.Float, maliyetIscilikTutariVal);
        directReq.input("SATIS_ISCILIK", sql.Float, satisIscilikVal);
        directReq.input("SATIS_ISCILIK_TUTARI", sql.Float, satisIscilikTutariVal);
        directReq.input("ISCILIK_KARI", sql.Float, iscilikKariVal);
        directReq.input("MALIYET", sql.Float, maliyetVal);
        directReq.input("MALIYET_PARA_KODU", sql.VarChar(50), maliyetParaKoduVal);
        directReq.input("SATIS_FIYATI", sql.Float, satisFiyatiVal);
        directReq.input("SATIS_PARA_KODU", sql.VarChar(50), satisParaKoduVal);
        directReq.input("SATIS_KARI_YUZDE", sql.Float, satisKariYuzdeVal);
        directReq.input("HAS_KURU_1", sql.Float, hasKuru1Val);
        directReq.input("HAS_KURU_2", sql.Float, hasKuru2Val);
        directReq.input("ALTIN_KURU", sql.Float, altinKuruVal);
        directReq.input("USD_KURU_1", sql.Float, usdKuru1Val);
        directReq.input("USD_KURU_2", sql.Float, usdKuru2Val);
        directReq.input("VEZNE_ID", sql.Int, vezneIdVal);
        directReq.input("SATILDI", sql.Bit, satildiVal);
        directReq.input("RESIM", sql.VarBinary(sql.MAX), withResim ? resimBuffer : null);
        directReq.input("KULLANICI_ID", sql.Int, kullaniciId || null);

        return await directReq.query(`
          DECLARE @ACTUAL_ID INT = @TARGET_ID;

          IF (@ACTUAL_ID IS NULL OR @ACTUAL_ID = 0)
          BEGIN
            SELECT TOP 1 @ACTUAL_ID = ALTIN_URUN_ID
            FROM dbo.TODVZ_ALTIN_URUN
            WHERE GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO;
          END

          -- Para ID Bulma (getStok ile birebir aynı arama)
          DECLARE @CLEAN_A VARCHAR(50) = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(@AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', ''))));
          DECLARE @P_ID INT = NULL;

          -- 1. Tam Kod Eşleşmesi
          SELECT TOP 1 @P_ID = PARA_ID 
          FROM dbo.TODVZ_PARA 
          WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@AYAR)))
             OR UPPER(LTRIM(RTRIM(KOD))) = @CLEAN_A;

          -- 2. Tam Ad Eşleşmesi (Ziynet coins hariç)
          IF @P_ID IS NULL
          BEGIN
              SELECT TOP 1 @P_ID = PARA_ID 
              FROM dbo.TODVZ_PARA 
              WHERE (UPPER(LTRIM(RTRIM(AD))) = UPPER(LTRIM(RTRIM(@AYAR)))
                 OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_A + ' AYAR'
                 OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_A + ' AYAR ALTIN'
                 OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_A)
                AND UPPER(LTRIM(RTRIM(KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM');
          END

          -- 3. TODVZ_AYAR tablosu üzerinden Standart Ayar
          IF @P_ID IS NULL
          BEGIN
              DECLARE @S_AYAR INT = NULL;
              SELECT TOP 1 @S_AYAR = STANDART_AYAR 
              FROM dbo.TODVZ_AYAR 
              WHERE UPPER(LTRIM(RTRIM(AYAR_KODU))) = UPPER(LTRIM(RTRIM(@AYAR)))
                 OR UPPER(LTRIM(RTRIM(AYAR_ADI))) = UPPER(LTRIM(RTRIM(@AYAR)))
                 OR UPPER(LTRIM(RTRIM(AYAR_KODU))) = @CLEAN_A;

              IF @S_AYAR IS NOT NULL
              BEGIN
                  SELECT TOP 1 @P_ID = PARA_ID 
                  FROM dbo.TODVZ_PARA 
                  WHERE (UPPER(LTRIM(RTRIM(KOD))) = CAST(@S_AYAR AS VARCHAR(10))
                     OR UPPER(LTRIM(RTRIM(KOD))) = CAST(@S_AYAR AS VARCHAR(10)) + ' AYAR'
                     OR UPPER(LTRIM(RTRIM(AD))) = CAST(@S_AYAR AS VARCHAR(10)) + ' AYAR ALTIN'
                     OR UPPER(LTRIM(RTRIM(AD))) = CAST(@S_AYAR AS VARCHAR(10)) + ' AYAR')
                    AND UPPER(LTRIM(RTRIM(KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM');
              END
          END

          -- 4. Sayısal Ayar (22, 14, 18, 24, 8)
          IF @P_ID IS NULL AND TRY_CAST(@CLEAN_A AS INT) IS NOT NULL
          BEGIN
              DECLARE @N_AYAR INT = CAST(@CLEAN_A AS INT);
              SELECT TOP 1 @P_ID = PARA_ID 
              FROM dbo.TODVZ_PARA 
              WHERE (UPPER(LTRIM(RTRIM(KOD))) = CAST(@N_AYAR AS VARCHAR(10))
                 OR UPPER(LTRIM(RTRIM(KOD))) = CAST(@N_AYAR AS VARCHAR(10)) + ' AYAR'
                 OR UPPER(LTRIM(RTRIM(AD))) = CAST(@N_AYAR AS VARCHAR(10)) + ' AYAR ALTIN'
                 OR UPPER(LTRIM(RTRIM(AD))) = CAST(@N_AYAR AS VARCHAR(10)) + ' AYAR')
                AND UPPER(LTRIM(RTRIM(KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM');
          END

          -- 5. Fallback: HAS / 24 Ayar
          IF @P_ID IS NULL
          BEGIN
              SELECT TOP 1 @P_ID = PARA_ID 
              FROM dbo.TODVZ_PARA 
              WHERE UPPER(LTRIM(RTRIM(KOD))) IN ('HAS', '24', '24 AYAR')
              ORDER BY PARA_ID ASC;
          END

          -- Vezne Stok Yönetimi
          IF (@VEZNE_ID IS NOT NULL AND @P_ID IS NOT NULL AND @MIKTAR > 0)
          BEGIN
            IF (@ACTUAL_ID IS NOT NULL AND @ACTUAL_ID > 0)
            BEGIN
              -- Eski miktarı iade et
              DECLARE @E_V_ID INT, @E_M FLOAT, @E_A VARCHAR(250), @E_P_ID INT;
              SELECT @E_V_ID = VEZNE_ID, @E_M = ISNULL(MIKTAR, 0), @E_A = AYAR FROM dbo.TODVZ_ALTIN_URUN WHERE ALTIN_URUN_ID = @ACTUAL_ID;
              IF (@E_V_ID IS NOT NULL AND @E_M > 0)
              BEGIN
                SELECT TOP 1 @E_P_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@E_A)));
                IF @E_P_ID IS NULL SET @E_P_ID = @P_ID;
                UPDATE dbo.TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR + @E_M WHERE VEZNE_ID = @E_V_ID AND PARA_ID = @E_P_ID;
              END
            END

            -- Yeni miktar için stok kontrolü
            DECLARE @CURR_STOK FLOAT = 0;
            SELECT @CURR_STOK = ISNULL(MIKTAR, 0) FROM dbo.TODVZ_VEZNE_BAKIYE WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @P_ID;
            IF (@CURR_STOK < @MIKTAR)
            BEGIN
              DECLARE @ERR_P_AD VARCHAR(100);
              SELECT @ERR_P_AD = AD FROM dbo.TODVZ_PARA WHERE PARA_ID = @P_ID;
              DECLARE @ERR_MSG VARCHAR(500) = 'Seçili veznede yeterli ' + ISNULL(@ERR_P_AD, @AYAR) + ' stoğu bulunamadı! Mevcut Stok: ' + CAST(@CURR_STOK AS VARCHAR(30)) + ' gr, İstenen: ' + CAST(@MIKTAR AS VARCHAR(30)) + ' gr.';
              RAISERROR (@ERR_MSG, 16, 1);
              RETURN;
            END

            IF EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @P_ID)
              UPDATE dbo.TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR - @MIKTAR WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @P_ID;
            ELSE
              INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@VEZNE_ID, @P_ID, -@MIKTAR);
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
                VEZNE_ID = ISNULL(@VEZNE_ID, VEZNE_ID),
                SATILDI = @SATILDI,
                RESIM = CASE WHEN @RESIM IS NOT NULL THEN @RESIM ELSE RESIM END,
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
              ALTIN_KURU, USD_KURU_1, USD_KURU_2, VEZNE_ID, SATILDI, RESIM, EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
            )
            VALUES (
              ISNULL(@TARIH, GETDATE()), @GRUP_KODU, @URUN_NO, @BARKOD, @AYAR, @URETICI_FIRMA, @ORJINAL_KOD, @MODEL, @BANKO,
              @MIKTAR, @HAS_GRAM, @MALIYET_ISCILIK, @MALIYET_ISCILIK_PARA_KODU, @MALIYET_ISCILIK_BIRIM,
              @MALIYET_ISCILIK_TUTARI, @SATIS_ISCILIK, @SATIS_ISCILIK_TUTARI, @ISCILIK_KARI, @MALIYET,
              @MALIYET_PARA_KODU, @SATIS_FIYATI, @SATIS_PARA_KODU, @SATIS_KARI_YUZDE, @HAS_KURU_1, @HAS_KURU_2,
              @ALTIN_KURU, @USD_KURU_1, @USD_KURU_2, @VEZNE_ID, @SATILDI, @RESIM, @KULLANICI_ID, GETDATE(), @KULLANICI_ID, GETDATE()
            );

            SELECT SCOPE_IDENTITY() AS ALTIN_URUN_ID;
          END
        `);
      };

      try {
        let directRes: any;
        try {
          directRes = await executeDirectUpsert(true);
        } catch (initialErr: any) {
          if (String(initialErr?.message || "").includes("truncated")) {
            directRes = await executeDirectUpsert(false);
          } else {
            throw initialErr;
          }
        }

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

    // Update USD_KURU and VEZNE_ID columns if available
    try {
      await pool.request()
        .input("SAVED_ID", sql.Int, savedId)
        .input("USD_1", sql.Float, usdKuru1Val)
        .input("USD_2", sql.Float, usdKuru2Val)
        .input("VEZNE_ID", sql.Int, vezneIdVal)
        .query(`
          UPDATE dbo.TODVZ_ALTIN_URUN
          SET USD_KURU_1 = COALESCE(@USD_1, USD_KURU_1),
              USD_KURU_2 = COALESCE(@USD_2, USD_KURU_2),
              VEZNE_ID = COALESCE(@VEZNE_ID, VEZNE_ID)
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

