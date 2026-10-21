-- 013_doviz_fisi_aktarma_ve_firma_hesap.sql
-- Döviz Fişi Aktarma Modülü, Firma Tanımları Aktarma Hesabı Kolonları ve sp_DovizFisiAktar Stored Procedure
-- Tekrar çalıştırılabilir (Idempotent), mevcut verileri koruyan göç dosyası.

-- 1. ADIM: Firma Tanımları Tablosuna Kolon Kontrolü ve Eklenmesi
IF OBJECT_ID('dbo.TODVZ_FIRMA', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.TODVZ_FIRMA') AND name = 'FIS_AKTARMA_HESAP_KODU'
    )
    BEGIN
        ALTER TABLE dbo.TODVZ_FIRMA ADD FIS_AKTARMA_HESAP_KODU VARCHAR(50) NULL;
    END;
END;
GO

IF OBJECT_ID('dbo.TODVZ_TANIM', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.TODVZ_TANIM') AND name = 'FIS_AKTARMA_HESAP_KODU'
    )
    BEGIN
        ALTER TABLE dbo.TODVZ_TANIM ADD FIS_AKTARMA_HESAP_KODU VARCHAR(50) NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.TODVZ_TANIM') AND name = 'FIS_AKTARILACAK_HESAP_ID'
    )
    BEGIN
        ALTER TABLE dbo.TODVZ_TANIM ADD FIS_AKTARILACAK_HESAP_ID INT NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.TODVZ_TANIM') AND name = 'FIS_AKTARMA_HESABI'
    )
    BEGIN
        ALTER TABLE dbo.TODVZ_TANIM ADD FIS_AKTARMA_HESABI VARCHAR(50) NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.TODVZ_TANIM') AND name = 'DIGER_VERITABANI_ADI'
    )
    BEGIN
        ALTER TABLE dbo.TODVZ_TANIM ADD DIGER_VERITABANI_ADI VARCHAR(200) NULL;
    END;
END;
GO

-- TODVZ_FIS Tablosuna Aktarım Takip Kolonları
IF OBJECT_ID('dbo.TODVZ_FIS', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.TODVZ_FIS') AND name = 'AKTARILDI'
    )
    BEGIN
        ALTER TABLE dbo.TODVZ_FIS ADD AKTARILDI BIT NOT NULL CONSTRAINT DF_TODVZ_FIS_AKTARILDI DEFAULT 0;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.TODVZ_FIS') AND name = 'AKTARIM_TARIHI'
    )
    BEGIN
        ALTER TABLE dbo.TODVZ_FIS ADD AKTARIM_TARIHI DATETIME NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.TODVZ_FIS') AND name = 'KAYNAK_FIS_ID'
    )
    BEGIN
        ALTER TABLE dbo.TODVZ_FIS ADD KAYNAK_FIS_ID INT NULL;
    END;
END;
GO

-- e-Belge Kaynak ve Giden Tabloları (Varsa atlar, yoksa oluşturur)
IF OBJECT_ID('dbo.TODVZ_EBELGE_KAYNAK', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TODVZ_EBELGE_KAYNAK (
        ANAHTAR VARCHAR(80) NOT NULL PRIMARY KEY,
        BELGE_NO VARCHAR(40) NOT NULL,
        DURUM VARCHAR(30) NOT NULL,
        HATA NVARCHAR(2000) NULL,
        TARIH DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END;
GO

IF OBJECT_ID('dbo.TODVZ_EBELGE_GIDEN', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TODVZ_EBELGE_GIDEN (
        UUID VARCHAR(60) NOT NULL PRIMARY KEY,
        BELGE_NO VARCHAR(40) NOT NULL,
        BELGE_TURU VARCHAR(20) NOT NULL DEFAULT 'EFatura',
        PROFIL VARCHAR(40) NULL,
        FATURA_TIPI VARCHAR(30) NULL,
        TASLAK_MI BIT NOT NULL DEFAULT 1,
        ALICI_VKN VARCHAR(11) NULL,
        ALICI_ALIAS NVARCHAR(150) NULL,
        ALICI_UNVAN NVARCHAR(300) NULL,
        DUZENLEME_TARIHI DATETIME NULL,
        TUTAR FLOAT NULL,
        PARA_BIRIMI VARCHAR(10) NULL,
        GONDERIM_DURUMU VARCHAR(20) NOT NULL DEFAULT 'HAZIRLANDI',
        SEMA_GECERLI BIT NULL,
        SCHEMATRON_GECERLI BIT NULL,
        ICE_RESPONSE_CODE VARCHAR(20) NULL,
        ICE_RESPONSE_MESAJ NVARCHAR(1000) NULL,
        GIB_STATU_KODU INT NULL,
        GIB_STATU_ACIKLAMA NVARCHAR(500) NULL,
        KAYNAK_FIS_ID VARCHAR(60) NULL,
        XML_ICERIK NVARCHAR(MAX) NULL,
        OLUSTURAN NVARCHAR(50) NULL,
        OLUSTURMA_TARIHI DATETIME NOT NULL DEFAULT GETDATE(),
        GONDEREN NVARCHAR(50) NULL,
        GONDERIM_TARIHI DATETIME NULL,
        IPTAL_TARIHI DATETIME NULL,
        IPTAL_EDEN NVARCHAR(50) NULL
    );
END;
GO

-- 2. ADIM: Döviz Fişi Aktarma Stored Procedure (sp_DovizFisiAktar)
CREATE OR ALTER PROCEDURE dbo.sp_DovizFisiAktar
    @BaslangicTarihi DATETIME,
    @BitisTarihi DATETIME,
    @DizaynKodu VARCHAR(20) = NULL,          -- Combobox'tan seçilen Dizayn 1, Dizayn 2 vb.
    @HedefHesapKodu VARCHAR(50) = NULL,      -- Firma tanımlarından gelen aktarma hesabı
    @KaynakAlanID INT = NULL,                -- Kaynak defter/alan ID (Örn: Gayri Resmi)
    @HedefAlanID INT = NULL                  -- Hedef defter/alan ID (Örn: Resmi)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- 1. Hedef Hesap Kodu verilmemişse Firma Tanımlarından al
        IF (@HedefHesapKodu IS NULL OR LTRIM(RTRIM(@HedefHesapKodu)) = '')
        BEGIN
            IF OBJECT_ID('dbo.TODVZ_TANIM', 'U') IS NOT NULL
            BEGIN
                SELECT TOP 1 @HedefHesapKodu = COALESCE(NULLIF(FIS_AKTARMA_HESAP_KODU, ''), NULLIF(FIS_AKTARMA_HESABI, ''))
                FROM dbo.TODVZ_TANIM;
            END;

            IF (@HedefHesapKodu IS NULL AND OBJECT_ID('dbo.TODVZ_FIRMA', 'U') IS NOT NULL)
            BEGIN
                SELECT TOP 1 @HedefHesapKodu = NULLIF(FIS_AKTARMA_HESAP_KODU, '')
                FROM dbo.TODVZ_FIRMA;
            END;
        END;

        -- Hedef hesap cari kartı bul (varsa)
        DECLARE @HedefCariId INT = NULL;
        IF @HedefHesapKodu IS NOT NULL AND OBJECT_ID('dbo.TODVZ_CARI_KART', 'U') IS NOT NULL
        BEGIN
            SELECT TOP 1 @HedefCariId = CARI_KART_ID 
            FROM dbo.TODVZ_CARI_KART 
            WHERE KOD = @HedefHesapKodu OR UNVAN = @HedefHesapKodu;
        END;

        -- 2. Tarih aralığını normalize et (gün başı ve sonu)
        DECLARE @Baslangic DATETIME = CAST(CONVERT(VARCHAR(10), @BaslangicTarihi, 120) + ' 00:00:00' AS DATETIME);
        DECLARE @Bitis DATETIME = CAST(CONVERT(VARCHAR(10), @BitisTarihi, 120) + ' 23:59:59' AS DATETIME);

        -- Filtrelere uyan fişleri tara
        IF OBJECT_ID('tempdb..#FislerToAktar') IS NOT NULL DROP TABLE #FislerToAktar;
        CREATE TABLE #FislerToAktar (
            FIS_ID INT PRIMARY KEY,
            SERI_NO VARCHAR(20),
            BELGE_NO VARCHAR(50),
            TARIH DATETIME
        );

        INSERT INTO #FislerToAktar (FIS_ID, SERI_NO, BELGE_NO, TARIH)
        SELECT f.FIS_ID, f.SERI_NO, f.BELGE_NO, f.TARIH
        FROM dbo.TODVZ_FIS f
        LEFT JOIN dbo.TODVZ_ISTATISTIK ist ON ist.ISTATISTIK_ID = f.ISTATISTIK_ID
        WHERE f.TARIH >= @Baslangic AND f.TARIH <= @Bitis
          AND (
            @DizaynKodu IS NULL 
            OR @DizaynKodu = '' 
            OR @DizaynKodu = 'Tümü'
            OR CAST(ISNULL(ist.FIS_DIZAYN_TIPI, 0) AS VARCHAR(20)) = @DizaynKodu
            OR REPLACE(@DizaynKodu, 'Dizayn ', '') = CAST(ISNULL(ist.FIS_DIZAYN_TIPI, 0) AS VARCHAR(20))
            OR ist.KOD = @DizaynKodu
          );

        DECLARE @AktarilanSayisi INT = 0;
        DECLARE @YeniSayisi INT = 0;
        DECLARE @GuncellenenSayisi INT = 0;

        DECLARE @CurrFisId INT, @CurrSeri VARCHAR(20), @CurrBelge VARCHAR(50), @CurrTarih DATETIME;
        DECLARE @HedefFisId INT;

        DECLARE fisCursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT FIS_ID, SERI_NO, BELGE_NO, TARIH FROM #FislerToAktar;

        OPEN fisCursor;
        FETCH NEXT FROM fisCursor INTO @CurrFisId, @CurrSeri, @CurrBelge, @CurrTarih;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @HedefFisId = NULL;

            -- Hedef alanda bu fiş referansı zaten var mı kontrol et
            SELECT TOP 1 @HedefFisId = FIS_ID
            FROM dbo.TODVZ_FIS
            WHERE (KAYNAK_FIS_ID = @CurrFisId AND FIS_ID <> @CurrFisId)
               OR (SERI_NO = @CurrSeri AND BELGE_NO = @CurrBelge AND CAST(TARIH AS DATE) = CAST(@CurrTarih AS DATE) AND FIS_ID <> @CurrFisId);

            IF @HedefFisId IS NOT NULL
            BEGIN
                -- 1. Hedefte fiş zaten varsa: UPDATE işlemi yap
                UPDATE hedef
                SET 
                    hedef.TIP = kaynak.TIP,
                    hedef.TARIH = kaynak.TARIH,
                    hedef.ZAMAN = kaynak.ZAMAN,
                    hedef.GELIS_NEDENI = kaynak.GELIS_NEDENI,
                    hedef.KUR_TURU = kaynak.KUR_TURU,
                    hedef.ISTATISTIK_ID = kaynak.ISTATISTIK_ID,
                    hedef.CARI_KART_ID = COALESCE(@HedefCariId, hedef.CARI_KART_ID, kaynak.CARI_KART_ID),
                    hedef.UNVAN = COALESCE(@HedefHesapKodu, hedef.UNVAN, kaynak.UNVAN),
                    hedef.TOPLAM_TUTAR = kaynak.TOPLAM_TUTAR,
                    hedef.ODEME_TUTARI = kaynak.ODEME_TUTARI,
                    hedef.KAYNAK_FIS_ID = @CurrFisId,
                    hedef.AKTARIM_TARIHI = GETDATE()
                FROM dbo.TODVZ_FIS hedef
                INNER JOIN dbo.TODVZ_FIS kaynak ON kaynak.FIS_ID = @CurrFisId
                WHERE hedef.FIS_ID = @HedefFisId;

                -- Satır detaylarını senkronize et
                DELETE FROM dbo.TODVZ_FIS_SATIRI WHERE FIS_ID = @HedefFisId;

                INSERT INTO dbo.TODVZ_FIS_SATIRI (
                    FIS_ID, SATIR_NO, MIKTAR, PARA_ID, KUR, ISCILIK, GISE_KURU, TUTAR,
                    KOMISYON_ORANI, KOMISYON, BMV_ORANI, BMV, KMV_ORANI, KMV, KDV_ORANI, KDV,
                    BANKA_HESABI_ID, SERI_NO, BELGE_NO
                )
                SELECT 
                    @HedefFisId, SATIR_NO, MIKTAR, PARA_ID, KUR, ISCILIK, GISE_KURU, TUTAR,
                    KOMISYON_ORANI, KOMISYON, BMV_ORANI, BMV, KMV_ORANI, KMV, KDV_ORANI, KDV,
                    BANKA_HESABI_ID, SERI_NO, BELGE_NO
                FROM dbo.TODVZ_FIS_SATIRI
                WHERE FIS_ID = @CurrFisId;

                SET @GuncellenenSayisi = @GuncellenenSayisi + 1;
            END
            ELSE
            BEGIN
                -- 2. Hedefte fiş yoksa: INSERT işlemi yap (Yeni kayıt aç)
                INSERT INTO dbo.TODVZ_FIS (
                    VEZNE_ID, TIP, TARIH, ZAMAN, SERI_NO, BELGE_NO, GELIS_NEDENI, KUR_TURU,
                    ISTATISTIK_ID, CARI_KART_ID, UNVAN, KISILIK_TIPI, UYRUK_ID, ULKE_ID,
                    PASAPORT_NO, VERGI_DAIRESI_ID, VERGI_KIMLIK_NO, BABA_ADI, ADRES,
                    TOPLAM_TUTAR, ODEME_TUTARI, BANKA_HESABI_ID, KMV_UYGULAMA_SEKLI,
                    KULLANICI_ID, KAYNAK_FIS_ID, AKTARIM_TARIHI
                )
                SELECT 
                    kaynak.VEZNE_ID, kaynak.TIP, kaynak.TARIH, kaynak.ZAMAN, kaynak.SERI_NO, kaynak.BELGE_NO, kaynak.GELIS_NEDENI, kaynak.KUR_TURU,
                    kaynak.ISTATISTIK_ID, COALESCE(@HedefCariId, kaynak.CARI_KART_ID), COALESCE(@HedefHesapKodu, kaynak.UNVAN), kaynak.KISILIK_TIPI, kaynak.UYRUK_ID, kaynak.ULKE_ID,
                    kaynak.PASAPORT_NO, kaynak.VERGI_DAIRESI_ID, kaynak.VERGI_KIMLIK_NO, kaynak.BABA_ADI, kaynak.ADRES,
                    kaynak.TOPLAM_TUTAR, kaynak.ODEME_TUTARI, kaynak.BANKA_HESABI_ID, kaynak.KMV_UYGULAMA_SEKLI,
                    kaynak.KULLANICI_ID, @CurrFisId, GETDATE()
                FROM dbo.TODVZ_FIS kaynak
                WHERE kaynak.FIS_ID = @CurrFisId;

                SET @HedefFisId = SCOPE_IDENTITY();

                -- Satır detaylarını ekle
                INSERT INTO dbo.TODVZ_FIS_SATIRI (
                    FIS_ID, SATIR_NO, MIKTAR, PARA_ID, KUR, ISCILIK, GISE_KURU, TUTAR,
                    KOMISYON_ORANI, KOMISYON, BMV_ORANI, BMV, KMV_ORANI, KMV, KDV_ORANI, KDV,
                    BANKA_HESABI_ID, SERI_NO, BELGE_NO
                )
                SELECT 
                    @HedefFisId, SATIR_NO, MIKTAR, PARA_ID, KUR, ISCILIK, GISE_KURU, TUTAR,
                    KOMISYON_ORANI, KOMISYON, BMV_ORANI, BMV, KMV_ORANI, KMV, KDV_ORANI, KDV,
                    BANKA_HESABI_ID, SERI_NO, BELGE_NO
                FROM dbo.TODVZ_FIS_SATIRI
                WHERE FIS_ID = @CurrFisId;

                SET @YeniSayisi = @YeniSayisi + 1;
            END;

            -- Kaynak fişi aktarıldı olarak işaretle
            UPDATE dbo.TODVZ_FIS
            SET AKTARILDI = 1, AKTARIM_TARIHI = GETDATE()
            WHERE FIS_ID = @CurrFisId;

            SET @AktarilanSayisi = @AktarilanSayisi + 1;

            FETCH NEXT FROM fisCursor INTO @CurrFisId, @CurrSeri, @CurrBelge, @CurrTarih;
        END;

        CLOSE fisCursor;
        DEALLOCATE fisCursor;

        COMMIT TRANSACTION;

        SELECT 
            1 AS Sonuc, 
            'Fişler hedef alana başarıyla aktarıldı.' AS Mesaj,
            @AktarilanSayisi AS AktarilanSayisi,
            @YeniSayisi AS YeniKayitSayisi,
            @GuncellenenSayisi AS GuncellenenSayisi;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
