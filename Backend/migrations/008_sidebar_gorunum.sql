-- ====================================================================================
-- Migration: 008_sidebar_gorunum.sql
-- Tanım: Kullanıcı tanımları için 6 farklı sidebar / menü görünümü desteği
-- Seçenekler:
--   1: 'hover'   (Üzerine mouse ile gelince açılan, ayrılınca kapanan mini sidebar)
--   2: 'classic' (Mevcut klasik dikey sabit sidebar)
--   3: 'flyout'  (Tıklanınca/üzerine gelince alt menüleri sağında açılan popover menü)
--   4: 'topbar'  (En üstte header'ın üstünde yatay menü, sayfalar soldan başlar)
--   5: 'dual'    (İki kademeli kompakt dikey sidebar: sol ikon barı + açılan alt panel)
--   6: 'drawer'  (Yüzen / gizli offcanvas drawer sidebar, sol taraf boş)
-- ====================================================================================

IF COL_LENGTH('dbo.TODVZ_KULLANICI', 'SIDEBAR_GORUNUM') IS NULL
BEGIN
    ALTER TABLE dbo.TODVZ_KULLANICI ADD [SIDEBAR_GORUNUM] VARCHAR(30) NOT NULL CONSTRAINT DF_TODVZ_KULLANICI_SIDEBAR_GORUNUM DEFAULT 'classic';
END;
GO

-- Varsa eski veya geçersiz değerleri 'classic'e çek
UPDATE dbo.TODVZ_KULLANICI
SET [SIDEBAR_GORUNUM] = 'classic'
WHERE [SIDEBAR_GORUNUM] IS NULL OR [SIDEBAR_GORUNUM] = '';
GO
