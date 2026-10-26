-- ============================================================================
-- Göç 014: Cari Kart Kimlik / Pasaport / Vergi Levhası Fotoğraf Saklama
-- ============================================================================

-- 1. TODVZ_FOTOGRAF tablosunda CARI_KART_ID kolonu kontrolü
IF OBJECT_ID('dbo.TODVZ_FOTOGRAF', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.TODVZ_FOTOGRAF', 'CARI_KART_ID') IS NULL
  BEGIN
    ALTER TABLE [dbo].[TODVZ_FOTOGRAF] ADD [CARI_KART_ID] INT NULL;
    PRINT 'TODVZ_FOTOGRAF tablosuna CARI_KART_ID kolonu eklendi.';
  END
END
GO

-- 2. TODVZ_FOTOGRAF tablosunda indeks oluşturma
IF OBJECT_ID('dbo.TODVZ_FOTOGRAF', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TODVZ_FOTOGRAF_CARI_KART_ID' AND object_id = OBJECT_ID('dbo.TODVZ_FOTOGRAF'))
  BEGIN
    CREATE NONCLUSTERED INDEX [IX_TODVZ_FOTOGRAF_CARI_KART_ID]
    ON [dbo].[TODVZ_FOTOGRAF] ([CARI_KART_ID])
    WHERE [CARI_KART_ID] IS NOT NULL;
    PRINT 'IX_TODVZ_FOTOGRAF_CARI_KART_ID indeksi oluşturuldu.';
  END
END
GO

-- 3. TODVZ_CARI_KART tablosunda FOTOGRAF_ID kolonu kontrolü
IF OBJECT_ID('dbo.TODVZ_CARI_KART', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.TODVZ_CARI_KART', 'FOTOGRAF_ID') IS NULL
  BEGIN
    ALTER TABLE [dbo].[TODVZ_CARI_KART] ADD [FOTOGRAF_ID] INT NULL;
    PRINT 'TODVZ_CARI_KART tablosuna FOTOGRAF_ID kolonu eklendi.';
  END

  IF COL_LENGTH('dbo.TODVZ_CARI_KART', 'KIMLIK_BELGE_TURU') IS NULL
  BEGIN
    ALTER TABLE [dbo].[TODVZ_CARI_KART] ADD [KIMLIK_BELGE_TURU] TINYINT NULL;
    PRINT 'TODVZ_CARI_KART tablosuna KIMLIK_BELGE_TURU kolonu eklendi.';
  END
END
GO

-- 4. Mevcut CARI fotoğrafları varsa CARI_KART_ID'yi senkronla (URUN_TIPI 20, 21, 22)
IF OBJECT_ID('dbo.TODVZ_FOTOGRAF', 'U') IS NOT NULL
BEGIN
  EXEC('UPDATE [dbo].[TODVZ_FOTOGRAF] SET [CARI_KART_ID] = [URUN_ID] WHERE [URUN_TIPI] IN (20, 21, 22, 23) AND [CARI_KART_ID] IS NULL AND [URUN_ID] > 0;');
END
GO
