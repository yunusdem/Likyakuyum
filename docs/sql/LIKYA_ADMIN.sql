/* =============================================================================
   LIKYA_ADMIN
   Ana admin panelinin (admin.likyakuyum.com) merkezi veritabanı. Firma
   veritabanlarından tamamen ayrıdır; adminler, firmalar, lisanslar, modül
   açma-kapama, merkezi kullanıcı hesapları, oturumlar ve loglar burada durur.

   Kurulum (sunucuda, SSMS'te sysadmin ile, bir kez):
     1) Aşağıdaki "VERITABANI" bölümünü çalıştırın.
     2) "SQL KULLANICISI" bölümündeki şifreyi KENDİNİZ belirleyip çalıştırın;
        aynı şifreyi sunucudaki Backend/.env içine ADMIN_DB_PASSWORD olarak yazın.
     3) "TABLOLAR" bölümünü çalıştırın.
     4) Backend klasöründe:  npm run ilk-admin -- <kullaniciAdi> "<Ad Soyad>"

   Betik tekrar tekrar çalıştırılabilir (idempotent).
   ============================================================================= */

/* ------------------------------- VERITABANI -------------------------------- */
IF DB_ID('LIKYA_ADMIN') IS NULL
  CREATE DATABASE [LIKYA_ADMIN];
GO

/* ----------------------------- SQL KULLANICISI ------------------------------
   Şifreyi değiştirmeden ÇALIŞTIRMAYIN. Bu kullanıcı yalnızca LIKYA_ADMIN'e erişir.

   USE [master];
   CREATE LOGIN [likya_admin_app] WITH PASSWORD = N'Admin2026*', CHECK_POLICY = ON;
   USE [LIKYA_ADMIN];
   CREATE USER [likya_admin_app] FOR LOGIN [likya_admin_app];
   ALTER ROLE [db_datareader] ADD MEMBER [likya_admin_app];
   ALTER ROLE [db_datawriter] ADD MEMBER [likya_admin_app];
   --------------------------------------------------------------------------- */

USE [LIKYA_ADMIN];
GO

-- Filtreli indeks (UX_ADM_LISANS_FIRMA_AKTIF) icin gerekli; sqlcmd varsayilani OFF oldugundan acikca ayarlanir
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* --------------------------------- TABLOLAR -------------------------------- */

-- Ana adminler (en fazla 3 aktif; kural uygulamada ve INSERT koşulunda)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_ADMIN')
BEGIN
  CREATE TABLE [dbo].[ADM_ADMIN] (
    [ADMIN_ID]           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    -- Turkce siralamada 'I' ile 'i' farkli harftir; kullanici adi dilden bagimsiz ve buyuk/kucuk harfe duyarsiz olsun
    [KULLANICI_ADI]      NVARCHAR(50)  COLLATE Latin1_General_CI_AS NOT NULL,
    [AD_SOYAD]           NVARCHAR(100) NOT NULL,
    [SIFRE_HASH]         VARCHAR(100)  NOT NULL,              -- bcrypt
    [SIFRE_DEGISMELI]    BIT           NOT NULL DEFAULT 1,    -- 1: ilk girişte şifre belirlemek zorunda
    [DURUM]              VARCHAR(10)   NOT NULL DEFAULT 'AKTIF', -- 'AKTIF' | 'PASIF'
    [SON_GIRIS]          DATETIME      NULL,
    [OLUSTURAN_ADMIN_ID] INT           NULL,
    [OLUSTURMA_TARIHI]   DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [UQ_ADM_ADMIN_KULLANICI_ADI] UNIQUE ([KULLANICI_ADI]),
    CONSTRAINT [CK_ADM_ADMIN_DURUM] CHECK ([DURUM] IN ('AKTIF','PASIF'))
  );
END
GO

-- Firmalar
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_FIRMA')
BEGIN
  CREATE TABLE [dbo].[ADM_FIRMA] (
    [FIRMA_ID]            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [FIRMA_KODU]          VARCHAR(20)    COLLATE Latin1_General_CI_AS NOT NULL, -- uygulama BUYUK harfle yazar
    -- Firmanin musteri numarasi (or. D20AC0001). Admin yazar, uygulama BUYUK harfe cevirir; benzersizlik asagidaki filtreli indekste.
    [MUSTERI_NO]          VARCHAR(20)    COLLATE Latin1_General_CI_AS NULL,
    [PRG_TUR]             INT            NOT NULL CONSTRAINT [DF_ADM_FIRMA_PRG_TUR] DEFAULT 0, -- program turu; simdilik yalniz 0
    [UNVAN]               NVARCHAR(200)  NOT NULL,
    [VKN_TCKN]            VARCHAR(11)    NULL,
    [VERGI_DAIRESI]       NVARCHAR(100)  NULL,
    [YETKILI_KISI]        NVARCHAR(100)  NULL,
    [TELEFON]             VARCHAR(30)    NULL,
    [EPOSTA]              NVARCHAR(150)  NULL,
    [ADRES]               NVARCHAR(500)  NULL,
    [DURUM]               VARCHAR(12)    NOT NULL DEFAULT 'AKTIF', -- 'AKTIF' | 'DONDURULMUS' | 'PASIF'
    [DURUM_NOTU]          NVARCHAR(500)  NULL,
    [DURUM_TARIHI]        DATETIME       NULL,
    [BAGLANTI_MODU]       VARCHAR(10)    NOT NULL DEFAULT 'cloud', -- 'cloud' | 'local'
    [DB_SERVER]           NVARCHAR(200)  NOT NULL,                 -- girildigi gibi (baglanirken kullanilir)
    [DB_PORT]             INT            NOT NULL DEFAULT 1433,
    [DB_NAME]             NVARCHAR(128)  NOT NULL,
    -- Esleme anahtari: kucukharf(host):port:kucukharf(db). Uygulama uretir; Turkce siralamadaki I/i farkindan
    -- etkilenmesin diye ikili (BIN2) karsilastirilir. Giriste firma bu anahtarla bulunur.
    [DB_ANAHTAR]          VARCHAR(400)   COLLATE Latin1_General_BIN2 NOT NULL,
    [DB_USER]             NVARCHAR(128)  NULL,
    [DB_SIFRE_ENC]        VARCHAR(600)   NULL,                     -- AES-256-GCM, anahtar .env'de
    [DOGRULANDI]          BIT            NOT NULL DEFAULT 0,
    [DOGRULAYAN_ADMIN_ID] INT            NULL,
    [DOGRULAMA_TARIHI]    DATETIME       NULL,
    [DOGRULAMA_NOTU]      NVARCHAR(500)  NULL,
    [DB_SON_TEST_TARIHI]  DATETIME       NULL,
    [DB_SON_TEST_SONUCU]  NVARCHAR(500)  NULL,
    [MASAK_DURUMU]        NVARCHAR(200)  NULL,
    [MASAK_SON_KONTROL]   DATETIME       NULL,
    [OLUSTURMA_TARIHI]    DATETIME       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [UQ_ADM_FIRMA_KODU] UNIQUE ([FIRMA_KODU]),
    CONSTRAINT [UQ_ADM_FIRMA_DB_ANAHTAR] UNIQUE ([DB_ANAHTAR]),
    CONSTRAINT [CK_ADM_FIRMA_DURUM] CHECK ([DURUM] IN ('AKTIF','DONDURULMUS','PASIF'))
  );
END
GO

-- Onceki surumle kurulmus veritabanlari icin: musteri no ve program turu kolonlari (tekrar calistirilabilir)
IF COL_LENGTH('dbo.ADM_FIRMA', 'MUSTERI_NO') IS NULL
  ALTER TABLE [dbo].[ADM_FIRMA] ADD [MUSTERI_NO] VARCHAR(20) COLLATE Latin1_General_CI_AS NULL;
GO
IF COL_LENGTH('dbo.ADM_FIRMA', 'PRG_TUR') IS NULL
  ALTER TABLE [dbo].[ADM_FIRMA] ADD [PRG_TUR] INT NOT NULL CONSTRAINT [DF_ADM_FIRMA_PRG_TUR] DEFAULT 0;
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_ADM_FIRMA_MUSTERI_NO')
  CREATE UNIQUE INDEX [UX_ADM_FIRMA_MUSTERI_NO] ON [dbo].[ADM_FIRMA]([MUSTERI_NO]) WHERE [MUSTERI_NO] IS NOT NULL;
GO

-- Lisanslar (uzatma = yeni satır; firma başına tek AKTIF=1)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_LISANS')
BEGIN
  CREATE TABLE [dbo].[ADM_LISANS] (
    [LISANS_ID]          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [FIRMA_ID]           INT           NOT NULL REFERENCES [dbo].[ADM_FIRMA]([FIRMA_ID]),
    [LISANS_ANAHTARI]    NVARCHAR(100) NULL,
    [BASLANGIC]          DATE          NOT NULL,
    [BITIS]              DATE          NOT NULL,
    [KULLANICI_LIMITI]   INT           NOT NULL DEFAULT 1,
    [PAKET_ADI]          NVARCHAR(100) NULL,
    [NOTLAR]             NVARCHAR(1000) NULL,
    [AKTIF]              BIT           NOT NULL DEFAULT 1,
    [OLUSTURAN_ADMIN_ID] INT           NULL,
    [OLUSTURMA_TARIHI]   DATETIME      NOT NULL DEFAULT GETDATE()
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_ADM_LISANS_FIRMA_AKTIF')
  CREATE UNIQUE INDEX [UX_ADM_LISANS_FIRMA_AKTIF] ON [dbo].[ADM_LISANS]([FIRMA_ID]) WHERE [AKTIF] = 1;
GO

-- Modül kataloğu (menü ağacı) ve firma bazlı açık/kapalı durumu
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_MODUL')
BEGIN
  CREATE TABLE [dbo].[ADM_MODUL] (
    [MODUL_KODU]   VARCHAR(100)  NOT NULL PRIMARY KEY,  -- ör. 'vezne', 'vezne.sarraf-fisi-kayit', 'ust.masak'
    [UST_KODU]     VARCHAR(100)  NULL,
    [BASLIK]       NVARCHAR(200) NOT NULL,
    [TUR]          VARCHAR(15)   NOT NULL,              -- 'ANA' | 'ALT' | 'UST_KISAYOL'
    [SIRA]         INT           NOT NULL DEFAULT 0,
    [API_ONEKLERI] VARCHAR(500)  NULL
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_FIRMA_MODUL')
BEGIN
  CREATE TABLE [dbo].[ADM_FIRMA_MODUL] (
    [FIRMA_ID]            INT          NOT NULL REFERENCES [dbo].[ADM_FIRMA]([FIRMA_ID]),
    [MODUL_KODU]          VARCHAR(100) NOT NULL,
    [ACIK]                BIT          NOT NULL DEFAULT 0,
    [DEGISTIREN_ADMIN_ID] INT          NULL,
    [DEGISTIRME_TARIHI]   DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_ADM_FIRMA_MODUL] PRIMARY KEY ([FIRMA_ID], [MODUL_KODU])
  );
END
GO

-- Merkezi kullanıcı hesapları (firma DB'sindeki TODVZ_KULLANICI ile eşleşir)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_KULLANICI')
BEGIN
  CREATE TABLE [dbo].[ADM_KULLANICI] (
    [KULLANICI_ID]          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [FIRMA_ID]              INT           NOT NULL REFERENCES [dbo].[ADM_FIRMA]([FIRMA_ID]),
    [KULLANICI_ADI]         NVARCHAR(50)  NOT NULL,
    [AD_SOYAD]              NVARCHAR(100) NULL,
    [SIFRE_HASH]            VARCHAR(100)  NOT NULL,
    [SIFRE_DEGISMELI]       BIT           NOT NULL DEFAULT 1,
    [DURUM]                 VARCHAR(10)   NOT NULL DEFAULT 'AKTIF', -- 'AKTIF' | 'PASIF'
    [FIRMA_YONETICISI]      BIT           NOT NULL DEFAULT 0,
    [FIRMA_DB_KULLANICI_ID] INT           NULL,                     -- TODVZ_KULLANICI.KULLANICI_ID
    [HATALI_GIRIS_SAYISI]   INT           NOT NULL DEFAULT 0,
    [SON_GIRIS]             DATETIME      NULL,
    [OLUSTURAN]             NVARCHAR(100) NULL,                     -- 'ADMIN:<id>' | 'FIRMA:<kullanıcı>' | 'ICE_AKTARIM'
    [OLUSTURMA_TARIHI]      DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [UQ_ADM_KULLANICI_FIRMA_AD] UNIQUE ([FIRMA_ID], [KULLANICI_ADI]),
    CONSTRAINT [CK_ADM_KULLANICI_DURUM] CHECK ([DURUM] IN ('AKTIF','PASIF'))
  );
END
GO

-- Oturumlar (token içindeki sid); admin ve kullanıcı oturumları birlikte
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_OTURUM')
BEGIN
  CREATE TABLE [dbo].[ADM_OTURUM] (
    [OTURUM_ID]           UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    [TUR]                 VARCHAR(10)   NOT NULL,   -- 'ADMIN' | 'KULLANICI'
    [ADMIN_ID]            INT           NULL,
    [KULLANICI_ID]        INT           NULL,
    [FIRMA_ID]            INT           NULL,
    [IP]                  VARCHAR(64)   NULL,
    [TARAYICI]            NVARCHAR(400) NULL,
    [BASLANGIC]           DATETIME      NOT NULL DEFAULT GETDATE(),
    [SON_ISLEM]           DATETIME      NOT NULL DEFAULT GETDATE(),
    [BITIS]               DATETIME      NULL,       -- çıkış veya iptal zamanı
    [IPTAL_EDILDI]        BIT           NOT NULL DEFAULT 0,
    [IPTAL_EDEN_ADMIN_ID] INT           NULL
  );
  CREATE INDEX [IX_ADM_OTURUM_ADMIN] ON [dbo].[ADM_OTURUM]([ADMIN_ID], [BITIS]);
  CREATE INDEX [IX_ADM_OTURUM_FIRMA] ON [dbo].[ADM_OTURUM]([FIRMA_ID], [BITIS]);
END
GO

-- Giriş denemeleri (başarılı ve başarısız)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_GIRIS_LOG')
BEGIN
  CREATE TABLE [dbo].[ADM_GIRIS_LOG] (
    [LOG_ID]        BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [TARIH]         DATETIME      NOT NULL DEFAULT GETDATE(),
    [TUR]           VARCHAR(10)   NOT NULL,   -- 'ADMIN' | 'KULLANICI'
    [FIRMA_ID]      INT           NULL,
    [KULLANICI_ADI] NVARCHAR(100) NULL,
    [BASARILI]      BIT           NOT NULL,
    [RED_NEDENI]    NVARCHAR(200) NULL,
    [IP]            VARCHAR(64)   NULL,
    [TARAYICI]      NVARCHAR(400) NULL
  );
  CREATE INDEX [IX_ADM_GIRIS_LOG_TARIH] ON [dbo].[ADM_GIRIS_LOG]([TARIH] DESC);
END
GO

-- Admin işlem kaydı (denetim izi). Şifre hiçbir zaman yazılmaz.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_ISLEM_LOG')
BEGIN
  CREATE TABLE [dbo].[ADM_ISLEM_LOG] (
    [LOG_ID]     BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [TARIH]      DATETIME      NOT NULL DEFAULT GETDATE(),
    [ADMIN_ID]   INT           NULL,
    [ISLEM]      VARCHAR(40)   NOT NULL,
    [HEDEF_TUR]  VARCHAR(20)   NULL,
    [HEDEF_ID]   VARCHAR(50)   NULL,
    [ESKI_DEGER] NVARCHAR(MAX) NULL,
    [YENI_DEGER] NVARCHAR(MAX) NULL
  );
  CREATE INDEX [IX_ADM_ISLEM_LOG_TARIH] ON [dbo].[ADM_ISLEM_LOG]([TARIH] DESC);
END
GO
