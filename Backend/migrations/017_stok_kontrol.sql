-- ============================================================================
-- Göç 017: Stok kartında stok kontrol seçeneği (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 9, G22)
-- TODVZ_STOK_KART.STOK_KONTROL: NULL = Stok Ayarları'ndaki genel davranış, 'UYAR' / 'ENGELLE' / 'SESSIZ' karta özel.
-- Yalnız ekleme; tekrar çalıştırılabilir. Uygulama da ilk kullanımda aynı dosyayı çalıştırır (ticariSema.ts).
-- ============================================================================

IF OBJECT_ID('dbo.TODVZ_STOK_KART', 'U') IS NOT NULL AND COL_LENGTH('dbo.TODVZ_STOK_KART', 'STOK_KONTROL') IS NULL
BEGIN
  ALTER TABLE [dbo].[TODVZ_STOK_KART] ADD [STOK_KONTROL] VARCHAR(10) NULL;
  PRINT 'TODVZ_STOK_KART tablosuna STOK_KONTROL kolonu eklendi.';
END
GO
