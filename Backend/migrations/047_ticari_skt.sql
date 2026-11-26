-- ============================================================================
-- Göç 047: Son kullanma tarihi (SKT) girişte (docs/TICARI_ADISYON_YOL_HARITASI.md, TA16)
--   TODVZ_STOK_GIRIS_SATIRI.SKT / PARTI_NO: giriş satırının son kullanma tarihi ve isteğe bağlı parti numarası.
--   TODVZ_STOK_KART.SKT_TAKIBI: işaretli kartta stok giriş fişinde SKT zorunlu.
--   SKT uyarı eşiği (gün) TODVZ_STOK_AYAR'da 'SKT_UYARI_GUN' (yoksa 30).
--   Satışta parti takibi yok: "SKT yaklaşanlar" eldeki stoğu en yeni girişlere dağıtarak (ilk giren ilk çıkar) tahmin eder.
-- Yalnız ekleme; tekrar çalıştırılabilir. Uygulama da ilk kullanımda aynı dosyayı çalıştırır (ticariSema.ts).
-- ============================================================================

IF COL_LENGTH('dbo.TODVZ_STOK_GIRIS_SATIRI', 'SKT') IS NULL
  ALTER TABLE dbo.TODVZ_STOK_GIRIS_SATIRI ADD SKT DATE NULL;
GO
IF COL_LENGTH('dbo.TODVZ_STOK_GIRIS_SATIRI', 'PARTI_NO') IS NULL
  ALTER TABLE dbo.TODVZ_STOK_GIRIS_SATIRI ADD PARTI_NO NVARCHAR(40) NULL;
GO
IF COL_LENGTH('dbo.TODVZ_STOK_KART', 'SKT_TAKIBI') IS NULL
  ALTER TABLE dbo.TODVZ_STOK_KART ADD SKT_TAKIBI BIT NOT NULL CONSTRAINT DF_TODVZ_STOK_KART_SKT_TAKIBI DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TODVZ_STOK_GIRIS_SATIRI_SKT' AND object_id = OBJECT_ID('dbo.TODVZ_STOK_GIRIS_SATIRI'))
  CREATE NONCLUSTERED INDEX IX_TODVZ_STOK_GIRIS_SATIRI_SKT ON dbo.TODVZ_STOK_GIRIS_SATIRI (STOK_KART_ID, SKT) INCLUDE (MIKTAR, STOK_GIRIS_ID, SATIR_NO) WHERE SKT IS NOT NULL;
GO
