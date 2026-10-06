USE [LIKYA_ADMIN];
GO
/* =============================================================================
   LIKYA_ADMIN — Bulut klonlama, kurulum (exe), çevrimdışı lisans ve sürüm tabloları
   docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, bölüm 7.1

   Kurulum (sunucuda, SSMS'te sysadmin ile): betiğin TAMAMINI çalıştırın.
   - Yalnızca EKLEME yapar: yeni kolonlar (hepsi boş bırakılabilir) ve yeni tablolar.
     Mevcut kayıtlar, mevcut kolonlar ve BAGLANTI_MODU değerleri DEĞİŞMEZ; bugünkü
     uygulama aynen çalışmaya devam eder.
   - Firma durumuna SILINECEK / SILINDI değerleri izin olarak eklenir (kısıt
     genişletilir); mevcut AKTIF / DONDURULMUS / PASIF kayıtlar etkilenmez.
   - Tekrar tekrar çalıştırılabilir (idempotent).
   - Uygulama kullanıcısı (likya_admin_app) db_datareader + db_datawriter
     olduğu için yeni tablolara ayrıca yetki gerekmez.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ------------------------------ ADM_FIRMA ekleri ------------------------------ */
IF COL_LENGTH('dbo.ADM_FIRMA', 'SILINME_PLANI') IS NULL
  ALTER TABLE [dbo].[ADM_FIRMA] ADD
    [SILINME_PLANI]        DATETIME      NULL,   -- "Sil" basıldığında +30 gün; dolunca kalıcı silinir
    [SILINME_ISTEYEN_ADMIN_ID] INT       NULL,
    [SILINDI_TARIHI]       DATETIME      NULL,   -- veritabanı ve SQL kullanıcısı silindiği an
    [YEDEK_DOSYA]          NVARCHAR(400) NULL,   -- son yedeğin tam yolu (firma başına tek dosya)
    [YEDEK_TARIHI]         DATETIME      NULL,
    [YEDEK_BOYUT]          BIGINT        NULL,   -- bayt
    [YEDEK_SILINME_PLANI]  DATETIME      NULL;   -- silinen firmanın yedeği +90 gün sonra silinir
GO
IF COL_LENGTH('dbo.ADM_FIRMA', 'MAKINE_KIMLIGI') IS NULL
  ALTER TABLE [dbo].[ADM_FIRMA] ADD
    [MAKINE_KIMLIGI]              VARCHAR(40)   NULL,   -- kurulum: XXXX-XXXX-XXXX-XXXX
    [MAKINE_KIMLIGI_TARIHI]       DATETIME      NULL,
    [SURUM]                       VARCHAR(30)   NULL,   -- kurulumun bildirdiği çalışan sürüm
    [HEDEF_SURUM]                 VARCHAR(30)   NULL,   -- NULL = en son sürüm; dolu = bu sürüme sabitle
    [SON_GORULME]                 DATETIME      NULL,   -- son heartbeat
    [BILDIRILEN_LISANS_DURUMU]    VARCHAR(20)   NULL,   -- GECERLI | UYARI | KILITLI
    [BILDIRILEN_KILIT_NEDENI]     VARCHAR(30)   NULL,   -- LISANS_DOLDU | SAAT_GERI_ALINDI | ...
    [BILDIRILEN_KULLANICI_SAYISI] INT           NULL,
    [SEMA_SURUMU]                 INT           NULL;   -- firma veritabanındaki LKY_SEMA_SURUMU
GO

-- Durum kısıtına SILINECEK / SILINDI eklenir (yalnız genişletme)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ADM_FIRMA_DURUM'
           AND definition NOT LIKE '%SILINECEK%')
BEGIN
  ALTER TABLE [dbo].[ADM_FIRMA] DROP CONSTRAINT [CK_ADM_FIRMA_DURUM];
  ALTER TABLE [dbo].[ADM_FIRMA] ADD CONSTRAINT [CK_ADM_FIRMA_DURUM]
    CHECK ([DURUM] IN ('AKTIF','DONDURULMUS','PASIF','SILINECEK','SILINDI'));
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ADM_FIRMA_SILINME_PLANI')
  CREATE INDEX [IX_ADM_FIRMA_SILINME_PLANI] ON [dbo].[ADM_FIRMA]([SILINME_PLANI]) WHERE [SILINME_PLANI] IS NOT NULL;
GO

/* ------------------------------ ADM_LISANS ekleri ----------------------------- */
IF COL_LENGTH('dbo.ADM_LISANS', 'LISANS_KODU') IS NULL
  ALTER TABLE [dbo].[ADM_LISANS] ADD
    [LISANS_KODU]    VARCHAR(4000) NULL,   -- imzalı tam kod (LKY1.<veri>.<imza>)
    [MAKINE_KIMLIGI] VARCHAR(40)   NULL,   -- kurulum lisansı hangi makineye bağlı (bulutta NULL)
    [SERI_NO]        INT           NULL,   -- firma içinde artan; eski kodu yenisinden ayırmak için
    [IPTAL]          BIT           NOT NULL CONSTRAINT [DF_ADM_LISANS_IPTAL] DEFAULT 0,
    [IPTAL_TARIHI]   DATETIME      NULL,
    [IPTAL_EDEN_ADMIN_ID] INT      NULL,
    [TESLIM]         VARCHAR(10)   NULL,   -- KOD (elle yapıştırıldı) | HEARTBEAT (kendisi indi)
    [TESLIM_TARIHI]  DATETIME      NULL;
GO

/* --------------------------------- ADM_SURUM --------------------------------- */
-- Her deploy bir sürüm paketi üretir; kurulumlar buradan güncellenir.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_SURUM')
BEGIN
  CREATE TABLE [dbo].[ADM_SURUM] (
    [SURUM]        VARCHAR(30)    NOT NULL PRIMARY KEY,   -- ör. 1.4.0+20261006.1530
    [YAYIN_TARIHI] DATETIME       NOT NULL DEFAULT GETDATE(),
    [DOSYA_YOLU]   NVARCHAR(400)  NOT NULL,
    [BOYUT]        BIGINT         NOT NULL,
    [SHA256]       CHAR(64)       NOT NULL,
    [IMZA]         VARCHAR(200)   NOT NULL,                -- paketin Ed25519 imzası (base64)
    [SEMA_SURUMU]  INT            NULL,                    -- paketle gelen en yüksek göç numarası
    [NOTLAR]       NVARCHAR(2000) NULL,
    [AKTIF]        BIT            NOT NULL DEFAULT 1       -- 0: dağıtımdan çekildi
  );
END
GO

/* ---------------------------------- ADM_AYAR ---------------------------------- */
-- Panelden düzenlenen genel ayarlar (lisans kilit ekranındaki iletişim bilgisi vb.)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_AYAR')
BEGIN
  CREATE TABLE [dbo].[ADM_AYAR] (
    [ANAHTAR]             VARCHAR(60)    NOT NULL PRIMARY KEY,
    [DEGER]               NVARCHAR(2000) NULL,
    [DEGISTIREN_ADMIN_ID] INT            NULL,
    [TARIH]               DATETIME       NOT NULL DEFAULT GETDATE()
  );
END
GO
-- Varsayılan satırlar (var olanın değerine dokunmaz)
INSERT INTO [dbo].[ADM_AYAR] ([ANAHTAR], [DEGER])
SELECT v.ANAHTAR, v.DEGER
FROM (VALUES
  ('LISANS_ILETISIM_TELEFON', NULL),
  ('LISANS_ILETISIM_EPOSTA',  NULL),
  ('LISANS_ILETISIM_METIN',   N'Lisans süreniz doldu. Programı kullanmaya devam etmek için lütfen bizimle iletişime geçin.'),
  ('YEDEK_KLASORU',           N'C:\LikyaYedek'),
  ('SURUM_KLASORU',           NULL),
  ('SABLON_YEDEK_DOSYASI',    N'C:\LikyaYedek\Sablon\sablon.bak')
) v (ANAHTAR, DEGER)
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[ADM_AYAR] a WHERE a.ANAHTAR = v.ANAHTAR);
GO

/* --------------------------- ADM_INDIRME_BAGLANTISI --------------------------- */
-- Firmaya özel, süreli indirme bağlantıları (kurulum paketi, yedek dosyası).
-- Bağlantıdaki anahtarın yalnızca SHA-256 özeti saklanır.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_INDIRME_BAGLANTISI')
BEGIN
  CREATE TABLE [dbo].[ADM_INDIRME_BAGLANTISI] (
    [BAGLANTI_ID]        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [TOKEN_HASH]         CHAR(64)     NOT NULL,
    [FIRMA_ID]           INT          NOT NULL REFERENCES [dbo].[ADM_FIRMA]([FIRMA_ID]),
    [TUR]                VARCHAR(10)  NOT NULL,   -- KURULUM | YEDEK
    [SON_GECERLILIK]     DATETIME     NOT NULL,
    [KULLANIM_SAYISI]    INT          NOT NULL DEFAULT 0,
    [SON_KULLANIM]       DATETIME     NULL,
    [IPTAL]              BIT          NOT NULL DEFAULT 0,
    [OLUSTURAN_ADMIN_ID] INT          NULL,
    [OLUSTURMA_TARIHI]   DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [UQ_ADM_INDIRME_TOKEN] UNIQUE ([TOKEN_HASH]),
    CONSTRAINT [CK_ADM_INDIRME_TUR] CHECK ([TUR] IN ('KURULUM','YEDEK'))
  );
END
GO

/* ----------------------------- ADM_HEARTBEAT_LOG ------------------------------ */
-- Kurulumların merkeze bildirimleri (30 gün tutulur; temizliği uygulama yapar).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_HEARTBEAT_LOG')
BEGIN
  CREATE TABLE [dbo].[ADM_HEARTBEAT_LOG] (
    [LOG_ID]           BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [FIRMA_ID]         INT          NOT NULL,
    [TARIH]            DATETIME     NOT NULL DEFAULT GETDATE(),
    [SURUM]            VARCHAR(30)  NULL,
    [MAKINE_KIMLIGI]   VARCHAR(40)  NULL,
    [LISANS_DURUMU]    VARCHAR(20)  NULL,
    [KILIT_NEDENI]     VARCHAR(30)  NULL,
    [KULLANICI_SAYISI] INT          NULL,
    [SEMA_SURUMU]      INT          NULL,
    [IP]               VARCHAR(45)  NULL
  );
  CREATE INDEX [IX_ADM_HEARTBEAT_FIRMA_TARIH] ON [dbo].[ADM_HEARTBEAT_LOG]([FIRMA_ID], [TARIH] DESC);
END
GO

PRINT N'TAMAM: LIKYA_ADMIN bulut/kurulum/lisans tabloları hazır. Mevcut kayıtlar değişmedi.';
GO
