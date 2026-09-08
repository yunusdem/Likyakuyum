/* =============================================================================
   TODVZ_MASAK_LISTE
   MASAK 'Malvarlıkları Dondurulanlar' listelerinin (A / B / C / 3AB) tutulduğu tablo.

   Not: Uygulama bu tabloyu ilk istekte otomatik oluşturur
        (MasakSqlRepository.ensureTablesExist). Bu betik yalnızca elle kurulum
        veya inceleme içindir; tekrar tekrar çalıştırılabilir (idempotent).
   ============================================================================= */

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_MASAK_LISTE')
BEGIN
  CREATE TABLE [dbo].[TODVZ_MASAK_LISTE] (
    [MASAK_ID]            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [LISTE_KOD]           VARCHAR(10)    NOT NULL,   -- 'A' | 'B' | 'C' | '3AB'
    [LISTE_ADI]           NVARCHAR(200)  NULL,
    [SIRA_NO]             INT            NULL,       -- Excel'deki sıra no
    [AD_UNVAN]            NVARCHAR(500)  NOT NULL,   -- ad-soyad / ünvan
    [AD_UNVAN_NORM]       NVARCHAR(500)  NULL,       -- normalize (aksansız, büyük harf, tek boşluk)
    [KAYIT_TIPI]          VARCHAR(10)    NULL,       -- 'GERCEK' | 'TUZEL' (tahmini)
    [KIMLIK_NO]           NVARCHAR(1000) NULL,       -- ham metin (cümle olabilir)
    [TCKN]                VARCHAR(11)    NULL,       -- metinden ayıklanan 11 hane
    [VKN]                 VARCHAR(10)    NULL,       -- metinden ayıklanan 10 hane
    [DIGER_ISIMLER]       NVARCHAR(MAX)  NULL,       -- alias'lar
    [DIGER_ISIMLER_NORM]  NVARCHAR(MAX)  NULL,       -- alias arama için normalize
    [ORIJINAL_AD]         NVARCHAR(500)  NULL,       -- orijinal dilde yazım (Arapça vb.)
    [ESKI_ADI]            NVARCHAR(500)  NULL,
    [GOREVI]              NVARCHAR(500)  NULL,
    [ADRES]               NVARCHAR(MAX)  NULL,
    [UYRUK]               NVARCHAR(200)  NULL,
    [DIGER_UYRUK]         NVARCHAR(300)  NULL,
    [YAPTIRIM_TURU]       NVARCHAR(200)  NULL,
    [ANNE_ADI]            NVARCHAR(150)  NULL,
    [BABA_ADI]            NVARCHAR(150)  NULL,
    [DOGUM_TARIHI]        NVARCHAR(300)  NULL,       -- ham metin ("a)1970 b)1971")
    [DOGUM_TARIHI_DT]     DATE           NULL,       -- ayrıştırılabildiyse
    [DOGUM_YERI]          NVARCHAR(300)  NULL,
    [ORGUT]               NVARCHAR(300)  NULL,
    [KURULUS_YAPISI]      NVARCHAR(300)  NULL,
    [LISTEYE_ALINMA]      NVARCHAR(300)  NULL,
    [KARAR_BILGI]         NVARCHAR(300)  NULL,       -- karar tarih-sayısı / BKK-CBK
    [RESMI_GAZETE]        NVARCHAR(300)  NULL,
    [DIGER_BILGILER]      NVARCHAR(MAX)  NULL,
    [EK_BILGI]            NVARCHAR(MAX)  NULL,       -- eşlenemeyen kolonlar (JSON)
    [KAYNAK_URL]          NVARCHAR(1000) NULL,       -- indirmede kullanılan adres
    [KAYNAK_HASH]         VARCHAR(64)    NULL,       -- dosyanın SHA-256'sı
    [GUNCELLEME_ZAMANI]   DATETIME       NOT NULL DEFAULT GETDATE(),
    [AKTIF]               BIT            NOT NULL DEFAULT 1
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_LISTE_LISTE' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_LISTE]'))
  CREATE INDEX [IX_TODVZ_MASAK_LISTE_LISTE] ON [dbo].[TODVZ_MASAK_LISTE]([LISTE_KOD], [SIRA_NO]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_LISTE_TCKN' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_LISTE]'))
  CREATE INDEX [IX_TODVZ_MASAK_LISTE_TCKN] ON [dbo].[TODVZ_MASAK_LISTE]([TCKN]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_LISTE_VKN' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_LISTE]'))
  CREATE INDEX [IX_TODVZ_MASAK_LISTE_VKN] ON [dbo].[TODVZ_MASAK_LISTE]([VKN]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_LISTE_ADNORM' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_LISTE]'))
  CREATE INDEX [IX_TODVZ_MASAK_LISTE_ADNORM] ON [dbo].[TODVZ_MASAK_LISTE]([AD_UNVAN_NORM]);
GO
