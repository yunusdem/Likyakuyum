import "dotenv/config";
import { getDbPool } from "../config/mssql.config.js";
import { env } from "../config/env.config.js";
export async function runKonsinyeKatalogMigration() {
    console.log("=== KONSİNYE & KATALOG VERİTABANI & PROSEDÜR MİGRASYONU BAŞLATILIYOR ===");
    try {
        const pool = await getDbPool(env.DB_SERVER, env.DB_NAME, env.DB_USER, env.DB_PASSWORD);
        // 1. TODVZ_ALTIN_URUN Tablosu
        console.log("1. TODVZ_ALTIN_URUN tablosu kontrol ediliyor...");
        await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN')
      BEGIN
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'KONSINYE')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [KONSINYE] BIT NOT NULL CONSTRAINT DF_TODVZ_ALTIN_URUN_KONSINYE DEFAULT(0);
          PRINT 'TODVZ_ALTIN_URUN tablosuna KONSINYE kolonu eklendi.';
        END;

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'KATALOG')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [KATALOG] BIT NOT NULL CONSTRAINT DF_TODVZ_ALTIN_URUN_KATALOG DEFAULT(0);
          PRINT 'TODVZ_ALTIN_URUN tablosuna KATALOG kolonu eklendi.';
        END;
      END
    `);
        // 2. TODVZ_OZEL_URUN Tablosu
        console.log("2. TODVZ_OZEL_URUN tablosu kontrol ediliyor...");
        await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_OZEL_URUN')
      BEGIN
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'KONSINYE')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ADD [KONSINYE] BIT NOT NULL CONSTRAINT DF_TODVZ_OZEL_URUN_KONSINYE DEFAULT(0);
          PRINT 'TODVZ_OZEL_URUN tablosuna KONSINYE kolonu eklendi.';
        END;

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'KATALOG')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ADD [KATALOG] BIT NOT NULL CONSTRAINT DF_TODVZ_OZEL_URUN_KATALOG DEFAULT(0);
          PRINT 'TODVZ_OZEL_URUN tablosuna KATALOG kolonu eklendi.';
        END;
      END
    `);
        // 3. SODVZ_ALTIN_URUN_KAYDET Prosedürü Güncelleme
        console.log("3. SODVZ_ALTIN_URUN_KAYDET prosedürü güncelleniyor...");
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
          @KONSINYE                   BIT = 0,
          @KATALOG                    BIT = 0,
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

          -- 2. Tam Ad Eşleşmesi
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

          -- 3. TODVZ_AYAR üzerinden Standart Ayar
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

          -- Güncelleme ise ve eski kayıtta stok düşülmüşse (konsinye değilse) iade et
          IF @YENI_KAYIT = 0
          BEGIN
              DECLARE @ESKI_VEZNE_ID INT = NULL;
              DECLARE @ESKI_AYAR VARCHAR(250) = NULL;
              DECLARE @ESKI_MIKTAR FLOAT = 0;
              DECLARE @ESKI_PARA_ID INT = NULL;
              DECLARE @ESKI_STOK_PARA_ID INT = NULL;
              DECLARE @ESKI_KONSINYE BIT = 0;

              SELECT @ESKI_VEZNE_ID = COALESCE(STOK_VEZNE_ID, VEZNE_ID), 
                     @ESKI_AYAR = AYAR, 
                     @ESKI_MIKTAR = COALESCE(STOK_MIKTAR, ISNULL(MIKTAR, 0)), 
                     @ESKI_STOK_PARA_ID = STOK_PARA_ID,
                     @ESKI_KONSINYE = ISNULL(KONSINYE, 0)
              FROM dbo.TODVZ_ALTIN_URUN
              WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

              IF (@ESKI_KONSINYE = 0 AND @ESKI_VEZNE_ID IS NOT NULL AND @ESKI_MIKTAR > 0)
              BEGIN
                  SET @ESKI_PARA_ID = @ESKI_STOK_PARA_ID;
                  IF @ESKI_PARA_ID IS NULL SELECT TOP 1 @ESKI_PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@ESKI_AYAR)));
                  IF @ESKI_PARA_ID IS NULL
                      SELECT TOP 1 @ESKI_PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(AD))) LIKE '%' + UPPER(LTRIM(RTRIM(@ESKI_AYAR))) + '%';
                  IF @ESKI_PARA_ID IS NULL
                      SET @ESKI_PARA_ID = @PARA_ID;

                  UPDATE dbo.TODVZ_VEZNE_BAKIYE 
                  SET MIKTAR = MIKTAR + @ESKI_MIKTAR 
                  WHERE VEZNE_ID = @ESKI_VEZNE_ID AND PARA_ID = @ESKI_PARA_ID;
              END
          END

          -- Stok Kontrolü & Vezne Bakiyesinden Düşme: KONSİNYE DEĞİLSE ÇALIŞIR!
          IF (ISNULL(@KONSINYE, 0) = 0 AND @VEZNE_ID IS NOT NULL AND @PARA_ID IS NOT NULL AND @MIKTAR > 0)
          BEGIN
              DECLARE @MEVCUT_STOK FLOAT = 0;
              SELECT @MEVCUT_STOK = ISNULL(MIKTAR, 0) 
              FROM dbo.TODVZ_VEZNE_BAKIYE 
              WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID;

              IF (@MEVCUT_STOK < @MIKTAR)
              BEGIN
                  DECLARE @PARA_ADI_HATA VARCHAR(100);
                  SELECT @PARA_ADI_HATA = AD FROM dbo.TODVZ_PARA WHERE PARA_ID = @PARA_ID;
                  SET @HATA_MESAJI = 'Seçili veznede yeterli ' + ISNULL(@PARA_ADI_HATA, @AYAR) + ' stoğu bulunamadı! Mevcut Stok: ' + CAST(@MEVCUT_STOK AS VARCHAR(30)) + ' gr, İstenen: ' + CAST(@MIKTAR AS VARCHAR(30)) + ' gr.';
                  GOTO UNDO;
              END

              IF EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID)
                  UPDATE dbo.TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR - @MIKTAR WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID;
              ELSE
                  INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@VEZNE_ID, @PARA_ID, -@MIKTAR);
              SET @STOK_DUSTU = 1;
          END

          IF @YENI_KAYIT = 1
          BEGIN
              INSERT INTO dbo.TODVZ_ALTIN_URUN (
                  TARIH, GRUP_KODU, URUN_NO, BARKOD, AYAR, URETICI_FIRMA, ORJINAL_KOD, MODEL, BANKO,
                  MIKTAR, HAS_GRAM, MALIYET_ISCILIK, MALIYET_ISCILIK_PARA_KODU, MALIYET_ISCILIK_BIRIM,
                  MALIYET_ISCILIK_TUTARI, SATIS_ISCILIK, SATIS_ISCILIK_TUTARI, ISCILIK_KARI, MALIYET,
                  MALIYET_PARA_KODU, SATIS_FIYATI, SATIS_PARA_KODU, SATIS_KARI_YUZDE, HAS_KURU_1, HAS_KURU_2,
                  ALTIN_KURU, USD_KURU_1, USD_KURU_2, SATILDI, RESIM, VEZNE_ID, KONSINYE, KATALOG,
                  EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
              )
              VALUES (
                  ISNULL(@TARIH, @SIMDIKI_ZAMAN), @GRUP_KODU, @URUN_NO, @BARKOD, @AYAR, @URETICI_FIRMA, @ORJINAL_KOD, @MODEL, @BANKO,
                  @MIKTAR, @HAS_GRAM, @MALIYET_ISCILIK, @MALIYET_ISCILIK_PARA_KODU, @MALIYET_ISCILIK_BIRIM,
                  @MALIYET_ISCILIK_TUTARI, @SATIS_ISCILIK, @SATIS_ISCILIK_TUTARI, @ISCILIK_KARI, @MALIYET,
                  @MALIYET_PARA_KODU, @SATIS_FIYATI, @SATIS_PARA_KODU, @SATIS_KARI_YUZDE, @HAS_KURU_1, @HAS_KURU_2,
                  @ALTIN_KURU, @USD_KURU_1, @USD_KURU_2, @SATILDI, @RESIM, @VEZNE_ID, ISNULL(@KONSINYE, 0), ISNULL(@KATALOG, 0),
                  @KULLANICI_ID, @SIMDIKI_ZAMAN, @KULLANICI_ID, @SIMDIKI_ZAMAN
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
                  KONSINYE = ISNULL(@KONSINYE, 0),
                  KATALOG = ISNULL(@KATALOG, 0),
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
          ELSE IF (ISNULL(@KONSINYE, 0) = 1)
              UPDATE dbo.TODVZ_ALTIN_URUN SET STOK_VEZNE_ID = NULL, STOK_PARA_ID = NULL, STOK_MIKTAR = NULL WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

          COMMIT TRAN;
          RETURN 0;

      UNDO:
          IF @@TRANCOUNT > 0
              ROLLBACK TRAN;
          RAISERROR (@HATA_MESAJI, 16, 1);
          RETURN 1;
      END;
    `);
        // 4. SODVZ_ALTIN_URUN_SIL Prosedürü Güncelleme
        console.log("4. SODVZ_ALTIN_URUN_SIL prosedürü güncelleniyor...");
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

          -- Stoğu vezneye iade et (KONSİNYE DEĞİLSE)
          DECLARE @VEZNE_ID INT, @AYAR VARCHAR(250), @MIKTAR FLOAT, @IS_KONSINYE BIT = 0;
          DECLARE @SIL_STOK_PARA_ID INT = NULL;
          SELECT @VEZNE_ID = COALESCE(STOK_VEZNE_ID, VEZNE_ID), 
                 @AYAR = AYAR, 
                 @MIKTAR = COALESCE(STOK_MIKTAR, ISNULL(MIKTAR, 0)), 
                 @SIL_STOK_PARA_ID = STOK_PARA_ID,
                 @IS_KONSINYE = ISNULL(KONSINYE, 0)
          FROM dbo.TODVZ_ALTIN_URUN
          WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;

          IF (ISNULL(@IS_KONSINYE, 0) = 0 AND @VEZNE_ID IS NOT NULL AND @MIKTAR > 0)
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
        // 5. SODVZ_OZEL_URUN_KAYDET Prosedürü Güncelleme
        console.log("5. SODVZ_OZEL_URUN_KAYDET prosedürü güncelleniyor...");
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
          @KONSINYE           BIT = 0,
          @KATALOG            BIT = 0,
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

          -- 2. Tam Ad Eşleşmesi
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
          DECLARE @STOK_DUSTU BIT = 0;

          -- Güncelleme ise ve eski kayıtta stok düşülmüşse (konsinye değilse) iade et
          IF @YENI_KAYIT = 0
          BEGIN
              DECLARE @ESKI_VEZNE_ID INT = NULL;
              DECLARE @ESKI_AYAR VARCHAR(250) = NULL;
              DECLARE @ESKI_MIKTAR FLOAT = 0;
              DECLARE @ESKI_PARA_ID INT = NULL;
              DECLARE @ESKI_STOK_PARA_ID INT = NULL;
              DECLARE @ESKI_KONSINYE BIT = 0;

              SELECT @ESKI_VEZNE_ID = COALESCE(STOK_VEZNE_ID, VEZNE_ID), 
                     @ESKI_AYAR = AYAR, 
                     @ESKI_MIKTAR = COALESCE(STOK_MIKTAR, ISNULL(MIKTAR, 0)), 
                     @ESKI_STOK_PARA_ID = STOK_PARA_ID,
                     @ESKI_KONSINYE = ISNULL(KONSINYE, 0)
              FROM dbo.TODVZ_OZEL_URUN
              WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

              IF (@ESKI_KONSINYE = 0 AND @ESKI_VEZNE_ID IS NOT NULL AND @ESKI_MIKTAR > 0)
              BEGIN
                  SET @ESKI_PARA_ID = @ESKI_STOK_PARA_ID;
                  IF @ESKI_PARA_ID IS NULL SELECT TOP 1 @ESKI_PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@ESKI_AYAR)));
                  IF @ESKI_PARA_ID IS NULL
                      SELECT TOP 1 @ESKI_PARA_ID = PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(AD))) LIKE '%' + UPPER(LTRIM(RTRIM(@ESKI_AYAR))) + '%';
                  IF @ESKI_PARA_ID IS NULL
                      SET @ESKI_PARA_ID = @PARA_ID;

                  UPDATE dbo.TODVZ_VEZNE_BAKIYE 
                  SET MIKTAR = MIKTAR + @ESKI_MIKTAR 
                  WHERE VEZNE_ID = @ESKI_VEZNE_ID AND PARA_ID = @ESKI_PARA_ID;
              END
          END

          -- Stok Kontrolü & Vezne Bakiyesinden Düşme: KONSİNYE DEĞİLSE ÇALIŞIR!
          IF (ISNULL(@KONSINYE, 0) = 0 AND @VEZNE_ID IS NOT NULL AND @PARA_ID IS NOT NULL AND @MIKTAR > 0)
          BEGIN
              DECLARE @MEVCUT_STOK FLOAT = 0;
              SELECT @MEVCUT_STOK = ISNULL(MIKTAR, 0) 
              FROM dbo.TODVZ_VEZNE_BAKIYE 
              WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID;

              IF (@MEVCUT_STOK < @MIKTAR)
              BEGIN
                  DECLARE @PARA_ADI_HATA VARCHAR(100);
                  SELECT @PARA_ADI_HATA = AD FROM dbo.TODVZ_PARA WHERE PARA_ID = @PARA_ID;
                  SET @HATA_MESAJI = 'Seçili veznede yeterli ' + ISNULL(@PARA_ADI_HATA, @AYAR) + ' stoğu bulunamadı! Mevcut Stok: ' + CAST(@MEVCUT_STOK AS VARCHAR(30)) + ' gr, İstenen: ' + CAST(@MIKTAR AS VARCHAR(30)) + ' gr.';
                  GOTO UNDO;
              END

              IF EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID)
                  UPDATE dbo.TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR - @MIKTAR WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @PARA_ID;
              ELSE
                  INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@VEZNE_ID, @PARA_ID, -@MIKTAR);
              SET @STOK_DUSTU = 1;
          END

          IF @YENI_KAYIT = 1
          BEGIN
              INSERT INTO dbo.TODVZ_OZEL_URUN (
                  TARIH, GRUP_KODU, URUN_NO, BARKOD, MAMUL_TIPI, URETICI_FIRMA, MIKTAR, MIKTAR_BIRIMI,
                  ORJINAL_KOD, AYAR, MODEL_OZELLIK_1, MODEL_OZELLIK_2, BANKO, MALIYET, MALIYET_PARA_KODU,
                  KAR_YUZDESI, SABITLE, SATIS_FIYATI, SATIS_PARA_KODU, HIZLI_GIRIS, TAS_CINSI, TAS_MIKTAR,
                  TAS_BIRIM, TAS_RENK, TAS_SAFLIK, TAS_ADET, TAS_TUTAR, TAS_TUTAR_BIRIMI, VEZNE_ID, 
                  KONSINYE, KATALOG, SATILDI, RESIM,
                  EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
              )
              VALUES (
                  ISNULL(@TARIH, @SIMDIKI_ZAMAN), @GRUP_KODU, @URUN_NO, @BARKOD, @MAMUL_TIPI, @URETICI_FIRMA, @MIKTAR, @MIKTAR_BIRIMI,
                  @ORJINAL_KOD, @AYAR, @MODEL_OZELLIK_1, @MODEL_OZELLIK_2, @BANKO, @MALIYET, @MALIYET_PARA_KODU,
                  @KAR_YUZDESI, @SABITLE, @SATIS_FIYATI, @SATIS_PARA_KODU, @HIZLI_GIRIS, @TAS_CINSI, @TAS_MIKTAR,
                  @TAS_BIRIM, @TAS_RENK, @TAS_SAFLIK, @TAS_ADET, @TAS_TUTAR, @TAS_TUTAR_BIRIMI, @VEZNE_ID,
                  ISNULL(@KONSINYE, 0), ISNULL(@KATALOG, 0), @SATILDI, @RESIM,
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
                  KONSINYE = ISNULL(@KONSINYE, 0),
                  KATALOG = ISNULL(@KATALOG, 0),
                  SATILDI = @SATILDI, RESIM = ISNULL(@RESIM, RESIM), GUNCELLEYEN_ID = @KULLANICI_ID, GUNCELLEME_ZAMANI = @SIMDIKI_ZAMAN
              WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

              IF @@ERROR <> 0
              BEGIN
                  SET @HATA_MESAJI = 'Özel ürün kaydı güncellenemedi.';
                  GOTO UNDO;
              END
          END

          IF @STOK_DUSTU = 1
              UPDATE dbo.TODVZ_OZEL_URUN SET STOK_VEZNE_ID = @VEZNE_ID, STOK_PARA_ID = @PARA_ID, STOK_MIKTAR = @MIKTAR WHERE OZEL_URUN_ID = @OZEL_URUN_ID;
          ELSE IF (ISNULL(@KONSINYE, 0) = 1)
              UPDATE dbo.TODVZ_OZEL_URUN SET STOK_VEZNE_ID = NULL, STOK_PARA_ID = NULL, STOK_MIKTAR = NULL WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

          COMMIT TRAN;
          RETURN 0;

      UNDO:
          IF @@TRANCOUNT > 0
              ROLLBACK TRAN;
          RAISERROR (@HATA_MESAJI, 16, 1);
          RETURN 1;
      END;
    `);
        // 6. SODVZ_OZEL_URUN_SIL Prosedürü Güncelleme
        console.log("6. SODVZ_OZEL_URUN_SIL prosedürü güncelleniyor...");
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

          -- Stoğu vezneye iade et (KONSİNYE DEĞİLSE)
          DECLARE @VEZNE_ID INT, @AYAR VARCHAR(250), @MIKTAR FLOAT, @IS_KONSINYE BIT = 0;
          DECLARE @SIL_STOK_PARA_ID INT = NULL;
          SELECT @VEZNE_ID = COALESCE(STOK_VEZNE_ID, VEZNE_ID), 
                 @AYAR = AYAR, 
                 @MIKTAR = COALESCE(STOK_MIKTAR, ISNULL(MIKTAR, 0)), 
                 @SIL_STOK_PARA_ID = STOK_PARA_ID,
                 @IS_KONSINYE = ISNULL(KONSINYE, 0)
          FROM dbo.TODVZ_OZEL_URUN
          WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

          IF (ISNULL(@IS_KONSINYE, 0) = 0 AND @VEZNE_ID IS NOT NULL AND @MIKTAR > 0)
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
        console.log("=== KONSİNYE & KATALOG VERİTABANI & PROSEDÜR MİGRASYONU BAŞARIYLA TAMAMLANDI ===");
    }
    catch (error) {
        console.error("Migrasyon sırasında hata:", error);
        throw error;
    }
}
runKonsinyeKatalogMigration()
    .then(() => {
    console.log("Migration finished successfully.");
    process.exit(0);
})
    .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
