/* =============================================================================
   LIKYA_ADMIN — POS cihazı entegrasyonu (Inpos + Beko) tabloları
   docs/POS_ENTEGRASYON_YOL_HARITASI.md, 3.5

   Kurulum (sunucuda, SSMS'te sysadmin ile, bir kez): betiğin tamamını çalıştırın.
   Uygulama kullanıcısının (likya_admin_app) tablo açma yetkisi olmadığı için bu
   tablolar kendiliğinden oluşmaz. Tablolar yokken POS entegrasyonu her firmada
   KAPALI davranır; programın geri kalanı etkilenmez.

   Betik tekrar tekrar çalıştırılabilir (idempotent).
   ============================================================================= */

USE [LIKYA_ADMIN];
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- Merkezi ayarlar (tek satır). Entegratör kimliği bize aittir, firma bazında değildir.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_POS_AYAR')
BEGIN
  CREATE TABLE [dbo].[ADM_POS_AYAR] (
    [AYAR_ID]                 TINYINT       NOT NULL PRIMARY KEY,   -- hep 1
    [TOKEN_CLIENT_ID]         VARCHAR(200)  NULL,                   -- Beko (Token) entegratör kimliği
    [TOKEN_CLIENT_SECRET_ENC] VARCHAR(1000) NULL,                   -- AES-256-GCM (ADMIN_DB_ENC_KEY)
    [TOKEN_AUTH_URL]          VARCHAR(300)  NULL,
    [TOKEN_API_URL]           VARCHAR(300)  NULL,
    [TOKEN_ERISIM_ENC]        VARCHAR(MAX)  NULL,                   -- 24 saatlik erişim anahtarı (şifreli)
    [TOKEN_ERISIM_BITIS]      DATETIME      NULL,
    [DONUS_KOK]               VARCHAR(300)  NULL,                   -- sunucunun dış adresi (cihaz sonucu buraya bildirilir)
    [INPOS_UYGULAMA_NO]       VARCHAR(50)   NULL,
    [GUNCELLEYEN_ADMIN_ID]    INT           NULL,
    [GUNCELLEME_TARIHI]       DATETIME      NULL
  );
END
GO

-- Firma bazında POS modu. Satırı olmayan firma KAPALI sayılır.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_POS_FIRMA')
BEGIN
  CREATE TABLE [dbo].[ADM_POS_FIRMA] (
    [FIRMA_ID]            INT         NOT NULL PRIMARY KEY REFERENCES [dbo].[ADM_FIRMA]([FIRMA_ID]),
    [MOD]                 VARCHAR(10) NOT NULL DEFAULT 'kapali',    -- 'kapali' | 'test' | 'canli'
    [DEGISTIREN_ADMIN_ID] INT         NULL,
    [DEGISTIRME_TARIHI]   DATETIME    NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [CK_ADM_POS_FIRMA_MOD] CHECK ([MOD] IN ('kapali','test','canli'))
  );
END
GO

-- Doğrulama senaryoları: cihaz modeli başına Geçti / Kaldı işaretleri (kabul ölçütü)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_POS_DOGRULAMA')
BEGIN
  CREATE TABLE [dbo].[ADM_POS_DOGRULAMA] (
    [MODEL]      VARCHAR(20)   NOT NULL,                            -- '300TR' | 'X30TR' | 'M530' ...
    [SENARYO_NO] INT           NOT NULL,
    [SONUC]      VARCHAR(10)   NOT NULL,                            -- 'GECTI' | 'KALDI'
    [NOTU]       NVARCHAR(300) NULL,
    [ADMIN_ID]   INT           NULL,
    [TARIH]      DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_ADM_POS_DOGRULAMA] PRIMARY KEY ([MODEL], [SENARYO_NO]),
    CONSTRAINT [CK_ADM_POS_DOGRULAMA_SONUC] CHECK ([SONUC] IN ('GECTI','KALDI'))
  );
END
GO

-- Cihaz servisine giden istekler ve cihazdan gelen bildirimler (test konsolu). Kimlik bilgisi yazılmaz.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_POS_LOG')
BEGIN
  CREATE TABLE [dbo].[ADM_POS_LOG] (
    [LOG_ID]   BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [TARIH]    DATETIME      NOT NULL DEFAULT GETDATE(),
    [TUR]      VARCHAR(10)   NOT NULL,                              -- 'ISTEK' | 'DONUS'
    [FIRMA_ID] INT           NULL,
    [OZET]     NVARCHAR(300) NOT NULL,
    [ISTEK]    NVARCHAR(MAX) NULL,
    [YANIT]    NVARCHAR(MAX) NULL,
    [BASARILI] BIT           NOT NULL DEFAULT 1
  );
  CREATE INDEX [IX_ADM_POS_LOG_TARIH] ON [dbo].[ADM_POS_LOG]([TARIH] DESC);
END
GO
