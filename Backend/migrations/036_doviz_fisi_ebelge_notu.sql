-- Migration 036: Döviz fişine "e-Belge Not" kolonu (e-Döviz 2.0, GİB paket v1.3 — 30.11.2026)
--
-- TODVZ_FIS.E_BELGE_NOT
--    Döviz fişinin F8 Detay penceresinde yazılan serbest not. e-Döviz belgesine ICE Notlar (GİB cbc:Note) olarak gider ve
--    belge çıktısında görünür. Eski programdaki "e-Belge Not" alanının karşılığı. Boş bırakılabilir; eski kayıtlar NULL kalır.
--    Yeniden çalıştırılabilir (COL_LENGTH koruması).
IF OBJECT_ID('dbo.TODVZ_FIS', 'U') IS NOT NULL AND COL_LENGTH('dbo.TODVZ_FIS', 'E_BELGE_NOT') IS NULL
    ALTER TABLE [dbo].[TODVZ_FIS] ADD [E_BELGE_NOT] NVARCHAR(500) NULL;
GO
