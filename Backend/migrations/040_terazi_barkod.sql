-- ============================================================================
-- Göç 040: Terazi etiketli barkod (docs/TICARI_ADISYON_YOL_HARITASI.md, TA3)
-- TODVZ_STOK_KART.TERAZI_KODU: terazinin PLU / ürün kodu (barkoddaki ürün kodu hanesi); boş = teraziye bağlı değil, dolu ise tekil.
-- TODVZ_TERAZI_BARKOD: EAN-13 terazi barkodu düzenleri — önek (27/28/29), ürün kodu hane sayısı, gömülü değer (A: ağırlık, F: fiyat)
--   ve ondalık (ağırlıkta kg'nin ondalığı: 3 = gram; fiyatta TL'nin ondalığı: 2 = kuruş). Kalan haneler değerdir, son hane kontrol.
--   Varsayılan: 27 + 5 hane kod + 5 hane gram.
-- Yalnız ekleme; tekrar çalıştırılabilir. Uygulama da ilk kullanımda aynı dosyayı çalıştırır (ticariSema.ts).
-- ============================================================================

IF OBJECT_ID('dbo.TODVZ_STOK_KART', 'U') IS NOT NULL AND COL_LENGTH('dbo.TODVZ_STOK_KART', 'TERAZI_KODU') IS NULL
BEGIN
  ALTER TABLE [dbo].[TODVZ_STOK_KART] ADD [TERAZI_KODU] INT NULL;
  PRINT 'TODVZ_STOK_KART tablosuna TERAZI_KODU kolonu eklendi.';
END
GO

IF OBJECT_ID('dbo.TODVZ_STOK_KART', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.TODVZ_STOK_KART') AND name = 'UX_TODVZ_STOK_KART_TERAZI')
  EXEC('CREATE UNIQUE NONCLUSTERED INDEX UX_TODVZ_STOK_KART_TERAZI ON dbo.TODVZ_STOK_KART (TERAZI_KODU) WHERE TERAZI_KODU IS NOT NULL');
GO

IF OBJECT_ID('dbo.TODVZ_TERAZI_BARKOD', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TODVZ_TERAZI_BARKOD (
    TERAZI_BARKOD_ID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TODVZ_TERAZI_BARKOD PRIMARY KEY,
    ONEK VARCHAR(2) NOT NULL CONSTRAINT UQ_TODVZ_TERAZI_BARKOD_ONEK UNIQUE,
    KOD_HANE TINYINT NOT NULL,
    DEGER_TURU CHAR(1) NOT NULL CONSTRAINT CK_TODVZ_TERAZI_BARKOD_TUR CHECK (DEGER_TURU IN ('A', 'F')),
    ONDALIK TINYINT NOT NULL,
    AKTIF BIT NOT NULL CONSTRAINT DF_TODVZ_TERAZI_BARKOD_AKTIF DEFAULT 1,
    ACIKLAMA NVARCHAR(100) NULL
  );
  INSERT INTO dbo.TODVZ_TERAZI_BARKOD (ONEK, KOD_HANE, DEGER_TURU, ONDALIK, AKTIF, ACIKLAMA)
  VALUES ('27', 5, 'A', 3, 1, N'Varsayılan: 27 + 5 hane ürün kodu + 5 hane gram');
  PRINT 'TODVZ_TERAZI_BARKOD tablosu kuruldu.';
END
GO
