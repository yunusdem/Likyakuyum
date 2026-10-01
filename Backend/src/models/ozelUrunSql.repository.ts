import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { EtiketNumeratorSqlRepository } from "./etiketNumeratorSql.repository.js";
import { UrunResimSqlRepository } from "./urunResimSql.repository.js";

export interface OzelUrunModel {
  ozelUrunId: number;
  tarih: string;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  mamulTipi?: string | null;
  ureticiFirma?: string | null;
  miktar: number;
  miktarBirimi: string;
  orjinalKod?: string | null;
  ayar?: string | null;
  modelOzellik1?: string | null;
  modelOzellik2?: string | null;
  banko?: string | null;
  maliyet: number;
  maliyetParaKodu: string;
  karYuzdesi: number;
  sabitle: boolean;
  satisFiyati: number;
  satisParaKodu: string;
  hizliGiris: boolean;
  tasCinsi?: string | null;
  tasMiktar?: number | null;
  tasBirim: string;
  tasRenk?: string | null;
  tasSaflik?: string | null;
  tasAdet?: number | null;
  tasTutar?: number | null;
  tasTutarBirimi: string;
  resim?: string | null;
  resimler?: string[];
  vezneId?: number | null;
  vezneKod?: string | null;
  vezneAd?: string | null;
  satildi: boolean;
  yazdirildi: boolean;
  yazdirildiZamani?: string | null;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveOzelUrunDto {
  ozelUrunId?: number | null;
  tarih?: string | null;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  mamulTipi?: string | null;
  ureticiFirma?: string | null;
  miktar?: number;
  miktarBirimi?: string;
  orjinalKod?: string | null;
  ayar?: string | null;
  modelOzellik1?: string | null;
  modelOzellik2?: string | null;
  banko?: string | null;
  maliyet?: number;
  maliyetParaKodu?: string;
  karYuzdesi?: number;
  sabitle?: boolean;
  satisFiyati?: number;
  satisParaKodu?: string;
  hizliGiris?: boolean;
  tasCinsi?: string | null;
  tasMiktar?: number | null;
  tasBirim?: string;
  tasRenk?: string | null;
  tasSaflik?: string | null;
  tasAdet?: number | null;
  tasTutar?: number | null;
  tasTutarBirimi?: string;
  resim?: string | null;
  resimler?: string[];
  vezneId?: number | null;
  satildi?: boolean;
}

export class OzelUrunSqlRepository {
  private static ensuredPools = new WeakSet<sql.ConnectionPool>();
  private static acceptedParamsCache: Set<string> | null = null;

  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    if (this.ensuredPools.has(pool)) return;
    try {
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_OZEL_URUN', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_OZEL_URUN] (
            [OZEL_URUN_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
            [GRUP_KODU] VARCHAR(100) NOT NULL,
            [URUN_NO] INT NOT NULL,
            [BARKOD] VARCHAR(100) NULL,
            [MAMUL_TIPI] VARCHAR(250) NULL,
            [URETICI_FIRMA] VARCHAR(500) NULL,
            [MIKTAR] FLOAT NOT NULL DEFAULT 1.00,
            [MIKTAR_BIRIMI] VARCHAR(50) NOT NULL DEFAULT 'Adet',
            [ORJINAL_KOD] VARCHAR(250) NULL,
            [AYAR] VARCHAR(250) NULL,
            [MODEL_OZELLIK_1] VARCHAR(MAX) NULL,
            [MODEL_OZELLIK_2] VARCHAR(MAX) NULL,
            [BANKO] VARCHAR(250) NULL,
            [MALIYET] FLOAT NOT NULL DEFAULT 0,
            [MALIYET_PARA_KODU] VARCHAR(50) NOT NULL DEFAULT 'USD',
            [KAR_YUZDESI] FLOAT NOT NULL DEFAULT 0,
            [SABITLE] BIT NOT NULL DEFAULT 0,
            [SATIS_FIYATI] FLOAT NOT NULL DEFAULT 0,
            [SATIS_PARA_KODU] VARCHAR(50) NOT NULL DEFAULT 'USD',
            [HIZLI_GIRIS] BIT NOT NULL DEFAULT 0,
            [TAS_CINSI] VARCHAR(250) NULL,
            [TAS_MIKTAR] FLOAT NULL,
            [TAS_BIRIM] VARCHAR(50) NOT NULL DEFAULT 'Ct',
            [TAS_RENK] VARCHAR(100) NULL,
            [TAS_SAFLIK] VARCHAR(100) NULL,
            [TAS_ADET] INT NULL,
            [TAS_TUTAR] FLOAT NULL,
            [TAS_TUTAR_BIRIMI] VARCHAR(50) NOT NULL DEFAULT 'USD',
            [VEZNE_ID] INT NULL,
            [SATILDI] BIT NOT NULL DEFAULT 0,
            [RESIM] VARBINARY(MAX) NULL,
            [YAZDIRILDI] BIT NOT NULL DEFAULT 0,
            [YAZDIRILDI_ZAMANI] DATETIME NULL,
            [EKLEYEN_ID] INT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL,
            CONSTRAINT [UQ_TODVZ_OZEL_URUN_GRUP_NO] UNIQUE ([GRUP_KODU], [URUN_NO])
          );
        END;

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_OZEL_URUN')
        BEGIN
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'VEZNE_ID')
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ADD [VEZNE_ID] INT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'YAZDIRILDI')
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ADD [YAZDIRILDI] BIT NOT NULL DEFAULT 0;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'YAZDIRILDI_ZAMANI')
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ADD [YAZDIRILDI_ZAMANI] DATETIME NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'MODEL_OZELLIK_1' AND CHARACTER_MAXIMUM_LENGTH <> -1)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [MODEL_OZELLIK_1] VARCHAR(MAX) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'MODEL_OZELLIK_2' AND CHARACTER_MAXIMUM_LENGTH <> -1)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [MODEL_OZELLIK_2] VARCHAR(MAX) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'URETICI_FIRMA' AND CHARACTER_MAXIMUM_LENGTH < 500)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [URETICI_FIRMA] VARCHAR(500) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'MAMUL_TIPI' AND CHARACTER_MAXIMUM_LENGTH < 250)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [MAMUL_TIPI] VARCHAR(250) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'AYAR' AND CHARACTER_MAXIMUM_LENGTH < 250)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [AYAR] VARCHAR(250) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'ORJINAL_KOD' AND CHARACTER_MAXIMUM_LENGTH < 250)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [ORJINAL_KOD] VARCHAR(250) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'BANKO' AND CHARACTER_MAXIMUM_LENGTH < 250)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [BANKO] VARCHAR(250) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'BARKOD' AND CHARACTER_MAXIMUM_LENGTH < 100)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [BARKOD] VARCHAR(100) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'GRUP_KODU' AND CHARACTER_MAXIMUM_LENGTH < 100)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [GRUP_KODU] VARCHAR(100) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'TAS_CINSI' AND CHARACTER_MAXIMUM_LENGTH < 250)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [TAS_CINSI] VARCHAR(250) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'TAS_RENK' AND CHARACTER_MAXIMUM_LENGTH < 100)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [TAS_RENK] VARCHAR(100) NULL;
          IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'TAS_SAFLIK' AND CHARACTER_MAXIMUM_LENGTH < 100)
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [TAS_SAFLIK] VARCHAR(100) NULL;
        END;
      `);
      this.ensuredPools.add(pool);
    } catch (err: any) {
      logger.warn(`[OzelUrunSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  private static async ensureProcedures(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_OZEL_URUN_KAYDET]
            @OZEL_URUN_ID       INT OUTPUT,
            @TARIH              DATETIME,
            @GRUP_KODU          VARCHAR(100),
            @URUN_NO            INT,
            @BARKOD             VARCHAR(100) = NULL,
            @MAMUL_TIPI         VARCHAR(250) = NULL,
            @URETICI_FIRMA      VARCHAR(500) = NULL,
            @MIKTAR             FLOAT = 1.00,
            @MIKTAR_BIRIMI      VARCHAR(50) = 'Adet',
            @ORJINAL_KOD        VARCHAR(250) = NULL,
            @AYAR               VARCHAR(250) = NULL,
            @MODEL_OZELLIK_1    VARCHAR(MAX) = NULL,
            @MODEL_OZELLIK_2    VARCHAR(MAX) = NULL,
            @BANKO              VARCHAR(250) = NULL,
            @MALIYET            FLOAT = 0,
            @MALIYET_PARA_KODU  VARCHAR(50) = 'USD',
            @KAR_YUZDESI        FLOAT = 0,
            @SABITLE            BIT = 0,
            @SATIS_FIYATI       FLOAT = 0,
            @SATIS_PARA_KODU    VARCHAR(50) = 'USD',
            @HIZLI_GIRIS        BIT = 0,
            @TAS_CINSI          VARCHAR(250) = NULL,
            @TAS_MIKTAR         FLOAT = NULL,
            @TAS_BIRIM          VARCHAR(50) = 'Ct',
            @TAS_RENK           VARCHAR(100) = NULL,
            @TAS_SAFLIK         VARCHAR(100) = NULL,
            @TAS_ADET           INT = NULL,
            @TAS_TUTAR          FLOAT = NULL,
            @TAS_TUTAR_BIRIMI   VARCHAR(50) = 'USD',
            @VEZNE_ID           INT = NULL,
            @SATILDI            BIT = 0,
            @RESIM              VARBINARY(MAX) = NULL,
            @KULLANICI_ID       INT = NULL,
            @YENI_KAYIT         BIT OUTPUT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @HATA_MESAJI VARCHAR(500);
            DECLARE @SIMDIKI_ZAMAN DATETIME = GETDATE();

            IF (@OZEL_URUN_ID IS NULL OR @OZEL_URUN_ID = 0)
            BEGIN
                SELECT TOP 1 @OZEL_URUN_ID = OZEL_URUN_ID
                FROM dbo.TODVZ_OZEL_URUN
                WHERE GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO;

                IF (@OZEL_URUN_ID IS NOT NULL AND @OZEL_URUN_ID > 0)
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

            -- 4. Sayısal Ayar (Örn 22, 14, 18, 24, 8)
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

            -- Stok Kontrolü & Vezne Bakiyesinden Düşme (Montür Gramajı / MIKTAR)
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
                END
                ELSE
                BEGIN
                    -- Güncelleme: Eski kaydın stoğunu geri iade et
                    DECLARE @ESKI_VEZNE_ID INT = NULL;
                    DECLARE @ESKI_AYAR VARCHAR(250) = NULL;
                    DECLARE @ESKI_MIKTAR FLOAT = 0;
                    DECLARE @ESKI_PARA_ID INT = NULL;

                    SELECT @ESKI_VEZNE_ID = VEZNE_ID, @ESKI_AYAR = AYAR, @ESKI_MIKTAR = ISNULL(MIKTAR, 0)
                    FROM dbo.TODVZ_OZEL_URUN
                    WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

                    IF (@ESKI_VEZNE_ID IS NOT NULL AND @ESKI_MIKTAR > 0)
                    BEGIN
                        SELECT TOP 1 @ESKI_PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@ESKI_AYAR)));
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
                END
            END

            IF @YENI_KAYIT = 1
            BEGIN
                INSERT INTO dbo.TODVZ_OZEL_URUN (
                    TARIH, GRUP_KODU, URUN_NO, BARKOD, MAMUL_TIPI, URETICI_FIRMA, MIKTAR, MIKTAR_BIRIMI,
                    ORJINAL_KOD, AYAR, MODEL_OZELLIK_1, MODEL_OZELLIK_2, BANKO, MALIYET, MALIYET_PARA_KODU,
                    KAR_YUZDESI, SABITLE, SATIS_FIYATI, SATIS_PARA_KODU, HIZLI_GIRIS, TAS_CINSI, TAS_MIKTAR,
                    TAS_BIRIM, TAS_RENK, TAS_SAFLIK, TAS_ADET, TAS_TUTAR, TAS_TUTAR_BIRIMI, VEZNE_ID, SATILDI, RESIM,
                    EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
                )
                VALUES (
                    ISNULL(@TARIH, @SIMDIKI_ZAMAN), @GRUP_KODU, @URUN_NO, @BARKOD, @MAMUL_TIPI, @URETICI_FIRMA, @MIKTAR, @MIKTAR_BIRIMI,
                    @ORJINAL_KOD, @AYAR, @MODEL_OZELLIK_1, @MODEL_OZELLIK_2, @BANKO, @MALIYET, @MALIYET_PARA_KODU,
                    @KAR_YUZDESI, @SABITLE, @SATIS_FIYATI, @SATIS_PARA_KODU, @HIZLI_GIRIS, @TAS_CINSI, @TAS_MIKTAR,
                    @TAS_BIRIM, @TAS_RENK, @TAS_SAFLIK, @TAS_ADET, @TAS_TUTAR, @TAS_TUTAR_BIRIMI, @VEZNE_ID, @SATILDI, @RESIM,
                    @KULLANICI_ID, @SIMDIKI_ZAMAN, @KULLANICI_ID, @SIMDIKI_ZAMAN
                );

                IF @@ERROR <> 0
                BEGIN
                    SET @HATA_MESAJI = 'Özel ürün kaydı eklenemedi.';
                    GOTO UNDO;
                END

                SET @OZEL_URUN_ID = SCOPE_IDENTITY();
            END
            ELSE
            BEGIN
                UPDATE dbo.TODVZ_OZEL_URUN
                SET TARIH = ISNULL(@TARIH, TARIH), GRUP_KODU = @GRUP_KODU, URUN_NO = @URUN_NO, BARKOD = @BARKOD,
                    MAMUL_TIPI = @MAMUL_TIPI, URETICI_FIRMA = @URETICI_FIRMA, MIKTAR = @MIKTAR, MIKTAR_BIRIMI = @MIKTAR_BIRIMI,
                    ORJINAL_KOD = @ORJINAL_KOD, AYAR = @AYAR, MODEL_OZELLIK_1 = @MODEL_OZELLIK_1, MODEL_OZELLIK_2 = @MODEL_OZELLIK_2,
                    BANKO = @BANKO, MALIYET = @MALIYET, MALIYET_PARA_KODU = @MALIYET_PARA_KODU, KAR_YUZDESI = @KAR_YUZDESI,
                    SABITLE = @SABITLE, SATIS_FIYATI = @SATIS_FIYATI, SATIS_PARA_KODU = @SATIS_PARA_KODU, HIZLI_GIRIS = @HIZLI_GIRIS,
                    TAS_CINSI = @TAS_CINSI, TAS_MIKTAR = @TAS_MIKTAR, TAS_BIRIM = @TAS_BIRIM, TAS_RENK = @TAS_RENK,
                    TAS_SAFLIK = @TAS_SAFLIK, TAS_ADET = @TAS_ADET, TAS_TUTAR = @TAS_TUTAR, TAS_TUTAR_BIRIMI = @TAS_TUTAR_BIRIMI,
                    VEZNE_ID = ISNULL(@VEZNE_ID, VEZNE_ID),
                    SATILDI = @SATILDI, RESIM = ISNULL(@RESIM, RESIM), GUNCELLEYEN_ID = @KULLANICI_ID, GUNCELLEME_ZAMANI = @SIMDIKI_ZAMAN
                WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

                IF @@ERROR <> 0
                BEGIN
                    SET @HATA_MESAJI = 'Özel ürün kaydı güncellenemedi.';
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
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_OZEL_URUN_SIL]
            @OZEL_URUN_ID INT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @HATA_MESAJI VARCHAR(500);

            IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_OZEL_URUN WHERE OZEL_URUN_ID = @OZEL_URUN_ID)
            BEGIN
                SET @HATA_MESAJI = 'Silinmek istenen özel ürün kaydı bulunamadı.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            IF EXISTS (SELECT 1 FROM dbo.TODVZ_OZEL_URUN WHERE OZEL_URUN_ID = @OZEL_URUN_ID AND SATILDI = 1)
            BEGIN
                SET @HATA_MESAJI = 'Satışı yapılmış olan özel ürün silinemez.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            BEGIN TRAN;

            -- Stoğu vezneye iade et
            DECLARE @VEZNE_ID INT, @AYAR VARCHAR(250), @MIKTAR FLOAT;
            SELECT @VEZNE_ID = VEZNE_ID, @AYAR = AYAR, @MIKTAR = ISNULL(MIKTAR, 0)
            FROM dbo.TODVZ_OZEL_URUN
            WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

            IF (@VEZNE_ID IS NOT NULL AND @MIKTAR > 0)
            BEGIN
                DECLARE @PARA_ID INT = NULL;
                DECLARE @CLEAN_AYAR VARCHAR(50) = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(@AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', ''))));
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

            DELETE FROM dbo.TODVZ_OZEL_URUN WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

            IF @@ERROR <> 0
            BEGIN
                IF @@TRANCOUNT > 0 ROLLBACK TRAN;
                SET @HATA_MESAJI = 'Özel ürün kaydı silinirken hata oluştu.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            COMMIT TRAN;
            RETURN 0;
        END;
      `);

      await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_OZEL_URUN_YAZDIRILDI_ISARETLE]
          @OZEL_URUN_ID INT,
          @YAZDIRILDI BIT,
          @KULLANICI_ID INT = NULL
        AS
        BEGIN
          SET NOCOUNT ON;
          UPDATE dbo.TODVZ_OZEL_URUN
            SET YAZDIRILDI = @YAZDIRILDI,
                YAZDIRILDI_ZAMANI = CASE WHEN @YAZDIRILDI = 1 THEN GETDATE() ELSE NULL END,
                GUNCELLEYEN_ID = @KULLANICI_ID,
                GUNCELLEME_ZAMANI = GETDATE()
            WHERE OZEL_URUN_ID = @OZEL_URUN_ID;
          IF @@ERROR<>0
          BEGIN
            RAISERROR ('Yazdırıldı durumu güncellenemedi.', 16, 1);
            RETURN 1;
          END
          RETURN 0;
        END;
      `);
    } catch (e: any) {
      logger.warn("[OzelUrunSqlRepository.ensureProcedures] Warning:", e.message || e);
    }
  }

  private static mapRow(r: any): OzelUrunModel {
    return {
      ozelUrunId: r.OZEL_URUN_ID,
      tarih: r.TARIH ? new Date(r.TARIH).toISOString() : new Date().toISOString(),
      grupKodu: (r.GRUP_KODU || "").trim(),
      urunNo: r.URUN_NO,
      barkod: r.BARKOD ? r.BARKOD.trim() : null,
      mamulTipi: r.MAMUL_TIPI ? r.MAMUL_TIPI.trim() : null,
      ureticiFirma: r.URETICI_FIRMA ? r.URETICI_FIRMA.trim() : null,
      miktar: Number(r.MIKTAR) || 0,
      miktarBirimi: (r.MIKTAR_BIRIMI || "Adet").trim(),
      orjinalKod: r.ORJINAL_KOD ? r.ORJINAL_KOD.trim() : null,
      ayar: r.AYAR ? r.AYAR.trim() : null,
      modelOzellik1: r.MODEL_OZELLIK_1 ? r.MODEL_OZELLIK_1.trim() : null,
      modelOzellik2: r.MODEL_OZELLIK_2 ? r.MODEL_OZELLIK_2.trim() : null,
      banko: r.BANKO ? r.BANKO.trim() : null,
      maliyet: Number(r.MALIYET) || 0,
      maliyetParaKodu: (r.MALIYET_PARA_KODU || "USD").trim(),
      karYuzdesi: Number(r.KAR_YUZDESI) || 0,
      sabitle: Boolean(r.SABITLE),
      satisFiyati: Number(r.SATIS_FIYATI) || 0,
      satisParaKodu: (r.SATIS_PARA_KODU || "USD").trim(),
      hizliGiris: Boolean(r.HIZLI_GIRIS),
      tasCinsi: r.TAS_CINSI ? r.TAS_CINSI.trim() : null,
      tasMiktar: r.TAS_MIKTAR !== null && r.TAS_MIKTAR !== undefined ? Number(r.TAS_MIKTAR) : null,
      tasBirim: (r.TAS_BIRIM || "Ct").trim(),
      tasRenk: r.TAS_RENK ? r.TAS_RENK.trim() : null,
      tasSaflik: r.TAS_SAFLIK ? r.TAS_SAFLIK.trim() : null,
      tasAdet: r.TAS_ADET !== null && r.TAS_ADET !== undefined ? Number(r.TAS_ADET) : null,
      tasTutar: r.TAS_TUTAR !== null && r.TAS_TUTAR !== undefined ? Number(r.TAS_TUTAR) : null,
      tasTutarBirimi: (r.TAS_TUTAR_BIRIMI || "USD").trim(),
      resim: r.RESIM ? (Buffer.isBuffer(r.RESIM) ? `data:image/jpeg;base64,${r.RESIM.toString("base64")}` : (typeof r.RESIM === "string" ? r.RESIM : null)) : null,
      vezneId: r.VEZNE_ID !== null && r.VEZNE_ID !== undefined ? Number(r.VEZNE_ID) : null,
      vezneKod: r.VEZNE_KOD ? (r.VEZNE_KOD || "").trim() : undefined,
      vezneAd: r.VEZNE_AD ? (r.VEZNE_AD || "").trim() : undefined,
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
  ): Promise<OzelUrunModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const topLimit = filter?.limit && filter.limit > 0 ? filter.limit : 500;
    let query = `
      SELECT TOP (${topLimit}) u.*, v.KOD AS VEZNE_KOD, v.AD AS VEZNE_AD 
      FROM TODVZ_OZEL_URUN u
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
    if (filter?.search && filter.search.trim()) {
      query += ` AND (u.GRUP_KODU LIKE @SEARCH OR u.BARKOD LIKE @SEARCH OR u.MAMUL_TIPI LIKE @SEARCH OR u.ORJINAL_KOD LIKE @SEARCH OR u.URETICI_FIRMA LIKE @SEARCH OR u.TAS_CINSI LIKE @SEARCH)`;
      req.input("SEARCH", sql.VarChar(150), `%${filter.search.trim()}%`);
    }
    query += ` ORDER BY u.OZEL_URUN_ID ASC`;

    const res = await req.query(query);
    const items = (res.recordset || []).map((r: any) => this.mapRow(r));
    if (items.length > 0) {
      try {
        const ids = items.map((x) => x.ozelUrunId).filter(Boolean);
        if (ids.length > 0) {
          const resimRes = await pool.request().query(
            `SELECT ISLEM_ID, DOSYA_YOLU, RESIM_DATA FROM TODVZ_URUN_RESIM WHERE TIP = 1 AND ISLEM_ID IN (${ids.join(",")}) ORDER BY RESIM_ID ASC`
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
            const imgs = resimMap.get(item.ozelUrunId);
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
    ozelUrunId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<OzelUrunModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const res = await pool
      .request()
      .input("OZEL_URUN_ID", sql.Int, ozelUrunId)
      .query(`
        SELECT TOP 1 u.*, v.KOD AS VEZNE_KOD, v.AD AS VEZNE_AD 
        FROM TODVZ_OZEL_URUN u
        LEFT JOIN TODVZ_VEZNE v ON v.VEZNE_ID = u.VEZNE_ID
        WHERE u.OZEL_URUN_ID = @OZEL_URUN_ID
      `);

    if (!res.recordset || res.recordset.length === 0) return null;
    const model = this.mapRow(res.recordset[0]);
    model.resimler = await UrunResimSqlRepository.getResimlerByIslemId(1, ozelUrunId, dbContext);
    if ((!model.resimler || model.resimler.length === 0) && model.resim) {
      model.resimler = [model.resim];
    }
    return model;
  }

  public static async getByBarkod(
    barkod: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<OzelUrunModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    const res = await pool
      .request()
      .input("BARKOD", sql.VarChar(50), barkod.trim())
      .query(`
        SELECT TOP 1 u.*, v.KOD AS VEZNE_KOD, v.AD AS VEZNE_AD 
        FROM TODVZ_OZEL_URUN u
        LEFT JOIN TODVZ_VEZNE v ON v.VEZNE_ID = u.VEZNE_ID
        WHERE u.BARKOD = @BARKOD
           OR (u.GRUP_KODU + CAST(u.URUN_NO AS VARCHAR(20))) = @BARKOD
           OR (u.GRUP_KODU + '-' + CAST(u.URUN_NO AS VARCHAR(20))) = @BARKOD
           OR u.ORJINAL_KOD = @BARKOD
      `);

    if (!res.recordset || res.recordset.length === 0) return null;
    const model = this.mapRow(res.recordset[0]);
    model.resimler = await UrunResimSqlRepository.getResimlerByIslemId(1, model.ozelUrunId, dbContext);
    if ((!model.resimler || model.resimler.length === 0) && model.resim) {
      model.resimler = [model.resim];
    }
    return model;
  }

  public static async save(
    dto: SaveOzelUrunDto,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<OzelUrunModel> {
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

    const targetId = dto.ozelUrunId && Number(dto.ozelUrunId) > 0 ? Number(dto.ozelUrunId) : null;
    const grupKoduVal = (dto.grupKodu || "").trim().toUpperCase();
    const urunNoVal = Number(dto.urunNo) || 1;
    const barkodVal = dto.barkod ? dto.barkod.trim() : null;
    const mamulTipiVal = dto.mamulTipi ? dto.mamulTipi.trim() : null;
    const ureticiFirmaVal = dto.ureticiFirma ? dto.ureticiFirma.trim() : null;
    const miktarVal = dto.miktar !== undefined ? Number(dto.miktar) : 1;
    const miktarBirimiVal = dto.miktarBirimi || "Adet";
    const orjinalKodVal = dto.orjinalKod ? dto.orjinalKod.trim() : null;
    const ayarVal = dto.ayar ? dto.ayar.trim() : null;
    const modelOzellik1Val = dto.modelOzellik1 ? dto.modelOzellik1.trim() : null;
    const modelOzellik2Val = dto.modelOzellik2 ? dto.modelOzellik2.trim() : null;
    const bankoVal = dto.banko ? dto.banko.trim() : null;
    const maliyetVal = Number(dto.maliyet) || 0;
    const maliyetParaKoduVal = dto.maliyetParaKodu || "USD";
    const karYuzdesiVal = Number(dto.karYuzdesi) || 0;
    const sabitleVal = dto.sabitle ? 1 : 0;
    const satisFiyatiVal = Number(dto.satisFiyati) || 0;
    const satisParaKoduVal = dto.satisParaKodu || "USD";
    const hizliGirisVal = dto.hizliGiris ? 1 : 0;
    const tasCinsiVal = dto.tasCinsi ? dto.tasCinsi.trim() : null;
    const tasMiktarVal = dto.tasMiktar ?? null;
    const tasBirimVal = dto.tasBirim || "Ct";
    const tasRenkVal = dto.tasRenk ? dto.tasRenk.trim() : null;
    const tasSaflikVal = dto.tasSaflik ? dto.tasSaflik.trim() : null;
    const tasAdetVal = dto.tasAdet ?? null;
    const tasTutarVal = dto.tasTutar ?? null;
    const tasTutarBirimiVal = dto.tasTutarBirimi || "USD";
    const vezneIdVal = dto.vezneId && Number(dto.vezneId) > 0 ? Number(dto.vezneId) : null;
    const satildiVal = dto.satildi ? 1 : 0;

    let savedId: number | null = targetId;

    let acceptedParams = this.acceptedParamsCache;
    if (!acceptedParams) {
      try {
        const spParams = await pool.request().query(`
          SELECT PARAMETER_NAME 
          FROM INFORMATION_SCHEMA.PARAMETERS 
          WHERE SPECIFIC_NAME = 'SODVZ_OZEL_URUN_KAYDET'
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
        if (acceptedParams.has("OZEL_URUN_ID")) req.output("OZEL_URUN_ID", sql.Int, targetId);
        if (acceptedParams.has("TARIH")) req.input("TARIH", sql.DateTime, dto.tarih ? new Date(dto.tarih) : new Date());
        if (acceptedParams.has("GRUP_KODU")) req.input("GRUP_KODU", sql.VarChar(100), grupKoduVal);
        if (acceptedParams.has("URUN_NO")) req.input("URUN_NO", sql.Int, urunNoVal);
        if (acceptedParams.has("BARKOD")) req.input("BARKOD", sql.VarChar(100), barkodVal);
        if (acceptedParams.has("MAMUL_TIPI")) req.input("MAMUL_TIPI", sql.VarChar(250), mamulTipiVal);
        if (acceptedParams.has("URETICI_FIRMA")) req.input("URETICI_FIRMA", sql.VarChar(500), ureticiFirmaVal);
        if (acceptedParams.has("MIKTAR")) req.input("MIKTAR", sql.Float, miktarVal);
        if (acceptedParams.has("MIKTAR_BIRIMI")) req.input("MIKTAR_BIRIMI", sql.VarChar(50), miktarBirimiVal);
        if (acceptedParams.has("ORJINAL_KOD")) req.input("ORJINAL_KOD", sql.VarChar(250), orjinalKodVal);
        if (acceptedParams.has("AYAR")) req.input("AYAR", sql.VarChar(250), ayarVal);
        if (acceptedParams.has("MODEL_OZELLIK_1")) req.input("MODEL_OZELLIK_1", sql.VarChar(sql.MAX), modelOzellik1Val);
        if (acceptedParams.has("MODEL_OZELLIK_2")) req.input("MODEL_OZELLIK_2", sql.VarChar(sql.MAX), modelOzellik2Val);
        if (acceptedParams.has("BANKO")) req.input("BANKO", sql.VarChar(250), bankoVal);
        if (acceptedParams.has("MALIYET")) req.input("MALIYET", sql.Float, maliyetVal);
        if (acceptedParams.has("MALIYET_PARA_KODU")) req.input("MALIYET_PARA_KODU", sql.VarChar(50), maliyetParaKoduVal);
        if (acceptedParams.has("KAR_YUZDESI")) req.input("KAR_YUZDESI", sql.Float, karYuzdesiVal);
        if (acceptedParams.has("SABITLE")) req.input("SABITLE", sql.Bit, sabitleVal);
        if (acceptedParams.has("SATIS_FIYATI")) req.input("SATIS_FIYATI", sql.Float, satisFiyatiVal);
        if (acceptedParams.has("SATIS_PARA_KODU")) req.input("SATIS_PARA_KODU", sql.VarChar(50), satisParaKoduVal);
        if (acceptedParams.has("HIZLI_GIRIS")) req.input("HIZLI_GIRIS", sql.Bit, hizliGirisVal);
        if (acceptedParams.has("TAS_CINSI")) req.input("TAS_CINSI", sql.VarChar(250), tasCinsiVal);
        if (acceptedParams.has("TAS_MIKTAR")) req.input("TAS_MIKTAR", sql.Float, tasMiktarVal);
        if (acceptedParams.has("TAS_BIRIM")) req.input("TAS_BIRIM", sql.VarChar(50), tasBirimVal);
        if (acceptedParams.has("TAS_RENK")) req.input("TAS_RENK", sql.VarChar(100), tasRenkVal);
        if (acceptedParams.has("TAS_SAFLIK")) req.input("TAS_SAFLIK", sql.VarChar(100), tasSaflikVal);
        if (acceptedParams.has("TAS_ADET")) req.input("TAS_ADET", sql.Int, tasAdetVal);
        if (acceptedParams.has("TAS_TUTAR")) req.input("TAS_TUTAR", sql.Float, tasTutarVal);
        if (acceptedParams.has("TAS_TUTAR_BIRIMI")) req.input("TAS_TUTAR_BIRIMI", sql.VarChar(50), tasTutarBirimiVal);
        if (acceptedParams.has("VEZNE_ID")) req.input("VEZNE_ID", sql.Int, vezneIdVal);
        if (acceptedParams.has("SATILDI")) req.input("SATILDI", sql.Bit, satildiVal);
        if (acceptedParams.has("RESIM")) req.input("RESIM", sql.VarBinary(sql.MAX), resimBuffer);
        if (acceptedParams.has("KULLANICI_ID")) req.input("KULLANICI_ID", sql.Int, kullaniciId || null);
        if (acceptedParams.has("YENI_KAYIT")) req.output("YENI_KAYIT", sql.Bit);

        const result = await req.execute("SODVZ_OZEL_URUN_KAYDET");
        savedId = Number(result?.output?.OZEL_URUN_ID) || Number(req.parameters.OZEL_URUN_ID?.value) || savedId;
        spSuccess = true;
      } catch (spErr: any) {
        logger.warn("[OzelUrunSqlRepository.save] SP Execution failed, attempting direct query fallback:", spErr.message);
        if (spErr.message && (spErr.message.includes("stoğu bulunamadı") || spErr.message.includes("stok"))) {
          throw ApiError.badRequest(spErr.message);
        }
      }
    }

    if (!spSuccess) {
      try {
        const directReq = pool.request();
        directReq.input("TARGET_ID", sql.Int, targetId);
        directReq.input("TARIH", sql.DateTime, dto.tarih ? new Date(dto.tarih) : new Date());
        directReq.input("GRUP_KODU", sql.VarChar(100), grupKoduVal);
        directReq.input("URUN_NO", sql.Int, urunNoVal);
        directReq.input("BARKOD", sql.VarChar(100), barkodVal);
        directReq.input("MAMUL_TIPI", sql.VarChar(250), mamulTipiVal);
        directReq.input("URETICI_FIRMA", sql.VarChar(500), ureticiFirmaVal);
        directReq.input("MIKTAR", sql.Float, miktarVal);
        directReq.input("MIKTAR_BIRIMI", sql.VarChar(50), miktarBirimiVal);
        directReq.input("ORJINAL_KOD", sql.VarChar(250), orjinalKodVal);
        directReq.input("AYAR", sql.VarChar(250), ayarVal);
        directReq.input("MODEL_OZELLIK_1", sql.VarChar(sql.MAX), modelOzellik1Val);
        directReq.input("MODEL_OZELLIK_2", sql.VarChar(sql.MAX), modelOzellik2Val);
        directReq.input("BANKO", sql.VarChar(250), bankoVal);
        directReq.input("MALIYET", sql.Float, maliyetVal);
        directReq.input("MALIYET_PARA_KODU", sql.VarChar(50), maliyetParaKoduVal);
        directReq.input("KAR_YUZDESI", sql.Float, karYuzdesiVal);
        directReq.input("SABITLE", sql.Bit, sabitleVal);
        directReq.input("SATIS_FIYATI", sql.Float, satisFiyatiVal);
        directReq.input("SATIS_PARA_KODU", sql.VarChar(50), satisParaKoduVal);
        directReq.input("HIZLI_GIRIS", sql.Bit, hizliGirisVal);
        directReq.input("TAS_CINSI", sql.VarChar(250), tasCinsiVal);
        directReq.input("TAS_MIKTAR", sql.Float, tasMiktarVal);
        directReq.input("TAS_BIRIM", sql.VarChar(50), tasBirimVal);
        directReq.input("TAS_RENK", sql.VarChar(100), tasRenkVal);
        directReq.input("TAS_SAFLIK", sql.VarChar(100), tasSaflikVal);
        directReq.input("TAS_ADET", sql.Int, tasAdetVal);
        directReq.input("TAS_TUTAR", sql.Float, tasTutarVal);
        directReq.input("TAS_TUTAR_BIRIMI", sql.VarChar(50), tasTutarBirimiVal);
        directReq.input("VEZNE_ID", sql.Int, vezneIdVal);
        directReq.input("SATILDI", sql.Bit, satildiVal);
        directReq.input("RESIM", sql.VarBinary(sql.MAX), resimBuffer);
        directReq.input("KULLANICI_ID", sql.Int, kullaniciId || null);

        const directRes = await directReq.query(`
          DECLARE @ACTUAL_ID INT = @TARGET_ID;

          IF (@ACTUAL_ID IS NULL OR @ACTUAL_ID = 0)
          BEGIN
            SELECT TOP 1 @ACTUAL_ID = OZEL_URUN_ID
            FROM dbo.TODVZ_OZEL_URUN
            WHERE GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO;
          END

          -- Para ID Bulma
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

          -- 4. Sayısal Ayar (Örn 22, 14, 18, 24, 8)
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

          -- Vezne Stok Yönetimi (Montür Gramajı / MIKTAR)
          IF (@VEZNE_ID IS NOT NULL AND @P_ID IS NOT NULL AND @MIKTAR > 0)
          BEGIN
            IF (@ACTUAL_ID IS NOT NULL AND @ACTUAL_ID > 0)
            BEGIN
              -- Eski miktarı iade et
              DECLARE @E_V_ID INT, @E_M FLOAT, @E_A VARCHAR(250), @E_P_ID INT;
              SELECT @E_V_ID = VEZNE_ID, @E_M = ISNULL(MIKTAR, 0), @E_A = AYAR FROM dbo.TODVZ_OZEL_URUN WHERE OZEL_URUN_ID = @ACTUAL_ID;
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
            UPDATE dbo.TODVZ_OZEL_URUN
            SET TARIH = ISNULL(@TARIH, TARIH),
                GRUP_KODU = @GRUP_KODU,
                URUN_NO = @URUN_NO,
                BARKOD = @BARKOD,
                MAMUL_TIPI = @MAMUL_TIPI,
                URETICI_FIRMA = @URETICI_FIRMA,
                MIKTAR = @MIKTAR,
                MIKTAR_BIRIMI = @MIKTAR_BIRIMI,
                ORJINAL_KOD = @ORJINAL_KOD,
                AYAR = @AYAR,
                MODEL_OZELLIK_1 = @MODEL_OZELLIK_1,
                MODEL_OZELLIK_2 = @MODEL_OZELLIK_2,
                BANKO = @BANKO,
                MALIYET = @MALIYET,
                MALIYET_PARA_KODU = @MALIYET_PARA_KODU,
                KAR_YUZDESI = @KAR_YUZDESI,
                SABITLE = @SABITLE,
                SATIS_FIYATI = @SATIS_FIYATI,
                SATIS_PARA_KODU = @SATIS_PARA_KODU,
                HIZLI_GIRIS = @HIZLI_GIRIS,
                TAS_CINSI = @TAS_CINSI,
                TAS_MIKTAR = @TAS_MIKTAR,
                TAS_BIRIM = @TAS_BIRIM,
                TAS_RENK = @TAS_RENK,
                TAS_SAFLIK = @TAS_SAFLIK,
                TAS_ADET = @TAS_ADET,
                TAS_TUTAR = @TAS_TUTAR,
                TAS_TUTAR_BIRIMI = @TAS_TUTAR_BIRIMI,
                VEZNE_ID = ISNULL(@VEZNE_ID, VEZNE_ID),
                SATILDI = @SATILDI,
                RESIM = CASE WHEN @RESIM IS NOT NULL THEN @RESIM ELSE RESIM END,
                GUNCELLEYEN_ID = @KULLANICI_ID,
                GUNCELLEME_ZAMANI = GETDATE()
            WHERE OZEL_URUN_ID = @ACTUAL_ID;

            SELECT @ACTUAL_ID AS OZEL_URUN_ID;
          END
          ELSE
          BEGIN
            INSERT INTO dbo.TODVZ_OZEL_URUN (
              TARIH, GRUP_KODU, URUN_NO, BARKOD, MAMUL_TIPI, URETICI_FIRMA, MIKTAR, MIKTAR_BIRIMI,
              ORJINAL_KOD, AYAR, MODEL_OZELLIK_1, MODEL_OZELLIK_2, BANKO, MALIYET, MALIYET_PARA_KODU,
              KAR_YUZDESI, SABITLE, SATIS_FIYATI, SATIS_PARA_KODU, HIZLI_GIRIS, TAS_CINSI, TAS_MIKTAR,
              TAS_BIRIM, TAS_RENK, TAS_SAFLIK, TAS_ADET, TAS_TUTAR, TAS_TUTAR_BIRIMI, VEZNE_ID, SATILDI, RESIM,
              EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
            )
            VALUES (
              ISNULL(@TARIH, GETDATE()), @GRUP_KODU, @URUN_NO, @BARKOD, @MAMUL_TIPI, @URETICI_FIRMA, @MIKTAR, @MIKTAR_BIRIMI,
              @ORJINAL_KOD, @AYAR, @MODEL_OZELLIK_1, @MODEL_OZELLIK_2, @BANKO, @MALIYET, @MALIYET_PARA_KODU,
              @KAR_YUZDESI, @SABITLE, @SATIS_FIYATI, @SATIS_PARA_KODU, @HIZLI_GIRIS, @TAS_CINSI, @TAS_MIKTAR,
              @TAS_BIRIM, @TAS_RENK, @TAS_SAFLIK, @TAS_ADET, @TAS_TUTAR, @TAS_TUTAR_BIRIMI, @VEZNE_ID, @SATILDI, @RESIM,
              @KULLANICI_ID, GETDATE(), @KULLANICI_ID, GETDATE()
            );

            SELECT SCOPE_IDENTITY() AS OZEL_URUN_ID;
          END
        `);

        if (directRes.recordset && directRes.recordset.length > 0) {
          savedId = Number(directRes.recordset[0].OZEL_URUN_ID) || savedId;
        }
      } catch (directErr: any) {
        logger.error("[OzelUrunSqlRepository.save] Direct SQL Error:", directErr);
        const rawMsg = directErr.originalError?.message || directErr.message || "";
        let friendlyMsg = "Özel ürün kaydedilemedi.";
        if (rawMsg.includes("UQ_TODVZ_OZEL_URUN_GRUP_NO") || rawMsg.includes("Violation of UNIQUE KEY constraint") || rawMsg.includes("daha önce kaydedilmiş")) {
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
        .query("SELECT TOP 1 OZEL_URUN_ID FROM dbo.TODVZ_OZEL_URUN WHERE GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO ORDER BY OZEL_URUN_ID DESC");
      if (lookup.recordset && lookup.recordset.length > 0) {
        savedId = Number(lookup.recordset[0].OZEL_URUN_ID);
      }
    }

    if (!savedId) throw ApiError.internal("Özel ürün kaydedildi ancak kimlik bilgisi alınamadı.");

    // Update VEZNE_ID column if available
    try {
      await pool.request()
        .input("SAVED_ID", sql.Int, savedId)
        .input("VEZNE_ID", sql.Int, vezneIdVal)
        .query(`
          UPDATE dbo.TODVZ_OZEL_URUN
          SET VEZNE_ID = COALESCE(@VEZNE_ID, VEZNE_ID)
          WHERE OZEL_URUN_ID = @SAVED_ID
        `);
    } catch {
      // Ignore if column is not present
    }

    // Sync multi images if provided
    if (dto.resimler && Array.isArray(dto.resimler)) {
      await UrunResimSqlRepository.syncResimlerForIslem(1, savedId, dto.resimler, dbContext);
    } else if (dto.resim) {
      await UrunResimSqlRepository.syncResimlerForIslem(1, savedId, [dto.resim], dbContext);
    }

    const saved = await this.getById(savedId, dbContext);
    if (!saved) throw ApiError.internal("Özel ürün kaydedildi ancak okunamadı.");
    return saved;
  }

  public static async remove(
    ozelUrunId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    await this.ensureProcedures(pool);

    try {
      const req = pool.request();
      req.input("OZEL_URUN_ID", sql.Int, ozelUrunId);
      await req.execute("SODVZ_OZEL_URUN_SIL");
      return true;
    } catch (err: any) {
      logger.error(`[OzelUrunSqlRepository.remove(${ozelUrunId})] Error:`, err);
      throw ApiError.badRequest(err.message || "Özel ürün silinemedi.");
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
      req.input("OZEL_URUN_ID", sql.Int, id);
      req.input("YAZDIRILDI", sql.Bit, yazdirildi ? 1 : 0);
      req.input("KULLANICI_ID", sql.Int, kullaniciId || null);
      await req.execute("SODVZ_OZEL_URUN_YAZDIRILDI_ISARETLE");
    }
  }

  public static async getNextUrunNo(
    grupKodu: string,
    uzunluk: number = 5,
    dbContext?: { dbServer?: string; dbName?: string }
  ) {
    return EtiketNumeratorSqlRepository.getNextNo(1, grupKodu, uzunluk, dbContext);
  }

  public static async getDistinctGrupKodlari(dbContext?: { dbServer?: string; dbName?: string }): Promise<string[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    const res = await pool.request().query(`SELECT DISTINCT GRUP_KODU FROM TODVZ_OZEL_URUN ORDER BY GRUP_KODU ASC`);
    return (res.recordset || []).map((r: any) => (r.GRUP_KODU || "").trim()).filter(Boolean);
  }

  public static async getDistinctUreticiFirmalar(dbContext?: { dbServer?: string; dbName?: string }): Promise<string[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    const res = await pool.request().query(`SELECT DISTINCT URETICI_FIRMA FROM TODVZ_OZEL_URUN WHERE URETICI_FIRMA IS NOT NULL AND URETICI_FIRMA <> '' ORDER BY URETICI_FIRMA ASC`);
    return (res.recordset || []).map((r: any) => (r.URETICI_FIRMA || "").trim()).filter(Boolean);
  }
}
