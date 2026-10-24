/* =============================================================================
   LIKYA_ADMIN — Dağıtım (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md)

   Panelden "Test'i Güncelle" / "Canlıya Geçir" kayıtları ve yönetim veritabanı göçlerinin otomatik uygulanması.

     1) Klon hesabına (docs/sql/KLON_HESABI.sql, .env.local KLON_DB_USER) bu veritabanında db_owner verilir:
        Backend/migrations-admin klasöründeki göç dosyalarını npm run surum:yayinla bu hesapla uygular (K4). Uygulamanın kendi
        SQL kullanıcısında DDL yetkisi yoktur, o değişmez.
     2) ADM_DAGITIM tablosu (ilk kurulumda elle; sonraki değişiklikler migrations-admin ile gelir).

   Sunucuda SSMS'te, hem LIKYA_ADMIN hem LIKYA_ADMIN_TEST için bir kez; USE satırını değiştirip tekrar çalıştırın.
   Klon hesabının adı KLON_HESABI.sql'dekiyle aynı olmalı (varsayılan likya_klon).
   ============================================================================= */

USE [LIKYA_ADMIN];   -- ikinci çalıştırmada: USE [LIKYA_ADMIN_TEST];
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1) Klon hesabı bu veritabanında db_owner (göç dosyalarını uygulayabilsin)
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'likya_klon')
  CREATE USER [likya_klon] FOR LOGIN [likya_klon];
GO
ALTER ROLE db_owner ADD MEMBER [likya_klon];
GO

-- 2) Göç tablosu (semaGoc.service de yoksa oluşturur; burada hazır dursun)
IF OBJECT_ID('dbo.LKY_SEMA_SURUMU') IS NULL
  CREATE TABLE dbo.LKY_SEMA_SURUMU (SURUM int NOT NULL PRIMARY KEY, AD nvarchar(200) NOT NULL, TARIH datetime NOT NULL DEFAULT GETDATE());
GO

-- 3) ADM_DAGITIM (Backend/migrations-admin/001_dagitim.sql ile aynı)
IF OBJECT_ID('dbo.ADM_DAGITIM') IS NULL
BEGIN
  CREATE TABLE dbo.ADM_DAGITIM (
    DAGITIM_ID        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    HEDEF             VARCHAR(10)   NOT NULL,
    ONCEKI_COMMIT     VARCHAR(60)   NULL,
    HEDEF_COMMIT      VARCHAR(60)   NULL,
    BASLATAN_ADMIN_ID INT           NULL,
    BASLATAN          NVARCHAR(120) NULL,
    BASLANGIC         DATETIME      NOT NULL DEFAULT GETDATE(),
    BITIS             DATETIME      NULL,
    DURUM             VARCHAR(20)   NOT NULL DEFAULT 'CALISIYOR',
    ADIM              NVARCHAR(200) NULL,
    MESAJ             NVARCHAR(1000) NULL,
    LOG_DOSYASI       NVARCHAR(400) NULL,
    GORULDU           BIT           NOT NULL DEFAULT 0
  );
  CREATE INDEX IX_ADM_DAGITIM_DURUM ON dbo.ADM_DAGITIM (DURUM, DAGITIM_ID DESC);
END
GO
-- Göç 001 elle uygulandı sayılsın (surum:yayinla tekrar denemesin)
IF NOT EXISTS (SELECT 1 FROM dbo.LKY_SEMA_SURUMU WHERE SURUM = 1)
  INSERT INTO dbo.LKY_SEMA_SURUMU (SURUM, AD) VALUES (1, N'001_dagitim.sql');
GO
