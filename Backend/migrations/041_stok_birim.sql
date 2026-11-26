-- ============================================================================
-- Göç 041: Koli / çoklu birim (docs/TICARI_ADISYON_YOL_HARITASI.md, TA5)
-- TODVZ_STOK_BIRIM: kartın ek birimleri (Koli = 12 Adet). CARPAN = kaç ana birim; SATIS_FIYATI boşsa çarpan × kart fiyatı
--   (kartın KDV dahil işareti ve para birimiyle). Stok ve fiş satırı her zaman ana birimde tutulur.
-- TODVZ_STOK_BARKOD.STOK_BIRIM_ID: barkod bir ek birime aitse (koli barkodu) o birim; NULL = kartın kendi barkodu.
-- Yalnız ekleme; tekrar çalıştırılabilir. Uygulama da ilk kullanımda aynı dosyayı çalıştırır (ticariSema.ts).
-- ============================================================================

IF OBJECT_ID('dbo.TODVZ_STOK_BIRIM', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TODVZ_STOK_BIRIM (
    STOK_BIRIM_ID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TODVZ_STOK_BIRIM PRIMARY KEY,
    STOK_KART_ID INT NOT NULL CONSTRAINT FK_TODVZ_STOK_BIRIM_KART REFERENCES dbo.TODVZ_STOK_KART (STOK_KART_ID),
    BIRIM VARCHAR(20) NOT NULL,
    CARPAN FLOAT NOT NULL CONSTRAINT CK_TODVZ_STOK_BIRIM_CARPAN CHECK (CARPAN > 0),
    SATIS_FIYATI FLOAT NULL,
    SIRA INT NOT NULL CONSTRAINT DF_TODVZ_STOK_BIRIM_SIRA DEFAULT 0,
    CONSTRAINT UQ_TODVZ_STOK_BIRIM UNIQUE (STOK_KART_ID, BIRIM)
  );
  PRINT 'TODVZ_STOK_BIRIM tablosu kuruldu.';
END
GO

IF OBJECT_ID('dbo.TODVZ_STOK_BARKOD', 'U') IS NOT NULL AND COL_LENGTH('dbo.TODVZ_STOK_BARKOD', 'STOK_BIRIM_ID') IS NULL
BEGIN
  ALTER TABLE [dbo].[TODVZ_STOK_BARKOD] ADD [STOK_BIRIM_ID] INT NULL;
  PRINT 'TODVZ_STOK_BARKOD tablosuna STOK_BIRIM_ID kolonu eklendi.';
END
GO

IF OBJECT_ID('dbo.TODVZ_STOK_BARKOD', 'U') IS NOT NULL AND OBJECT_ID('dbo.TODVZ_STOK_BIRIM', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.FK_TODVZ_STOK_BARKOD_BIRIM', 'F') IS NULL
  EXEC('ALTER TABLE dbo.TODVZ_STOK_BARKOD ADD CONSTRAINT FK_TODVZ_STOK_BARKOD_BIRIM FOREIGN KEY (STOK_BIRIM_ID) REFERENCES dbo.TODVZ_STOK_BIRIM (STOK_BIRIM_ID)');
GO
