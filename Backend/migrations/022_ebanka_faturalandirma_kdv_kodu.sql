-- ============================================================================
-- Migration: 022_ebanka_faturalandirma_kdv_kodu.sql
-- Tanım: Kuyum e-Banka Faturalandırma + sarraf fişi e-Belge KDV kodu
--   1. TODVZ_SARRAF_FISI.E_BELGE_ISTISNA_KODU : fişte seçilen GİB kodu (805, 808, 230, 231, 232, 301)
--   2. TODVZ_EBANKA_MUTABAKAT_ISARET.KALDIRILAN_BELGELER : banka hareketinden bağı kaldırılan belgeler (ETTN listesi)
-- Tekrar çalıştırılabilir (Idempotent), veri koruyucu göç dosyası. Tablo yoksa atlanır (uygulama ilk kullanımda kurar).
-- ============================================================================

IF OBJECT_ID('dbo.TODVZ_SARRAF_FISI', 'U') IS NOT NULL AND COL_LENGTH('dbo.TODVZ_SARRAF_FISI', 'E_BELGE_ISTISNA_KODU') IS NULL
BEGIN
	ALTER TABLE dbo.TODVZ_SARRAF_FISI ADD [E_BELGE_ISTISNA_KODU] VARCHAR(10) NULL;
END;
GO

IF OBJECT_ID('dbo.TODVZ_EBANKA_MUTABAKAT_ISARET', 'U') IS NOT NULL AND COL_LENGTH('dbo.TODVZ_EBANKA_MUTABAKAT_ISARET', 'KALDIRILAN_BELGELER') IS NULL
BEGIN
	ALTER TABLE dbo.TODVZ_EBANKA_MUTABAKAT_ISARET ADD [KALDIRILAN_BELGELER] NVARCHAR(MAX) NULL;
END;
GO
