/* =============================================================================
   LIKYA_ADMIN — Mobil Cari Erişimi (docs/MOBIL_CARI_YOL_HARITASI.md)

   Firmanın carisi mobil.likyaerp.com'dan müşteri no + mobil kullanıcı adı + şifre ile girer. Kimlik burada tutulur
   (bir mobil kullanıcı aynı müşteri nonun birden çok veritabanına bağlanabilir); fiyat / döküm / emir firma
   veritabanından okunur (Backend/migrations/024_mobil.sql).

     1) ADM_MODUL: "mobil" ana modülü ve 3 sayfası. Firmalara ACIK yazılmaz, her firmada KAPALI başlar (K11).
        Kısıtsız (modül ayarı yapılmamış) firmada da kapalı sayılır; ERP ("hepsi") paketine girmez.
     2) ADM_MOBIL_FIRMA: firma başına mobil kullanıcı sınırı (K7, K26) ve soldaki kısa ad (K2).
     3) ADM_MOBIL_KULLANICI / ADM_MOBIL_ERISIM / ADM_MOBIL_OTURUM.

   Kurulum (sunucuda, SSMS'te, DEPLOY'DAN ÖNCE bir kez). Tekrar çalıştırılabilir.
   ============================================================================= */

USE [LIKYA_ADMIN];
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1) Katalog (yönetim paneli açılınca kendi kataloğuyla da eşitler; burada hemen görünsün diye eklenir)
IF NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL WHERE MODUL_KODU = 'mobil')
  INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
  SELECT 'mobil', NULL, N'M- Mobil', 'ANA', ISNULL(MAX(SIRA), 0) + 1 FROM dbo.ADM_MODUL;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL WHERE MODUL_KODU = 'mobil:mobil/emirler')
  INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
  SELECT 'mobil:mobil/emirler', 'mobil', N'A- Mobil Emirler', 'ALT', ISNULL(MAX(SIRA), 0) + 1 FROM dbo.ADM_MODUL;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL WHERE MODUL_KODU = 'mobil:mobil/kullanicilar')
  INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
  SELECT 'mobil:mobil/kullanicilar', 'mobil', N'B- Mobil Kullanıcılar', 'ALT', ISNULL(MAX(SIRA), 0) + 1 FROM dbo.ADM_MODUL;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL WHERE MODUL_KODU = 'mobil:mobil/ayarlar')
  INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
  SELECT 'mobil:mobil/ayarlar', 'mobil', N'C- Mobil Ayarları', 'ALT', ISNULL(MAX(SIRA), 0) + 1 FROM dbo.ADM_MODUL;
GO

-- 2) Firma başına mobil ayarı (yalnız panelden yazılır)
IF OBJECT_ID('dbo.ADM_MOBIL_FIRMA') IS NULL
BEGIN
  CREATE TABLE dbo.ADM_MOBIL_FIRMA (
    FIRMA_ID           INT           NOT NULL CONSTRAINT PK_ADM_MOBIL_FIRMA PRIMARY KEY
                                     CONSTRAINT FK_ADM_MOBIL_FIRMA_FIRMA REFERENCES dbo.ADM_FIRMA (FIRMA_ID),
    KULLANICI_LIMITI   INT           NOT NULL CONSTRAINT DF_ADM_MOBIL_FIRMA_LIMIT DEFAULT 0,   -- 0 = tanımlanamaz
    KISA_AD            NVARCHAR(40)  NULL,                                                    -- boş = ünvanın ilk sözcüğü
    GUNCELLEYEN_ADMIN_ID INT         NULL,
    GUNCELLEME_TARIHI  DATETIME      NOT NULL CONSTRAINT DF_ADM_MOBIL_FIRMA_TARIH DEFAULT GETDATE()
  );
END
GO

-- 3a) Mobil kullanıcı: müşteri no + kullanıcı adı birlikte benzersiz. Şifre yalnız özet (bcrypt).
IF OBJECT_ID('dbo.ADM_MOBIL_KULLANICI') IS NULL
BEGIN
  CREATE TABLE dbo.ADM_MOBIL_KULLANICI (
    MOBIL_KULLANICI_ID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ADM_MOBIL_KULLANICI PRIMARY KEY,
    MUSTERI_NO         VARCHAR(20)   COLLATE Latin1_General_CI_AS NOT NULL,
    KULLANICI_ADI      VARCHAR(50)   COLLATE Latin1_General_CI_AS NOT NULL,
    AD_SOYAD           NVARCHAR(100) NULL,
    EPOSTA             NVARCHAR(200) NULL,
    SIFRE_OZET         VARCHAR(100)  NOT NULL,
    SIFRE_DEGISMELI    BIT           NOT NULL CONSTRAINT DF_ADM_MOBIL_KULLANICI_SD DEFAULT 1,
    DURUM              VARCHAR(10)   NOT NULL CONSTRAINT DF_ADM_MOBIL_KULLANICI_DURUM DEFAULT 'AKTIF', -- 'AKTIF' | 'PASIF'
    HATALI_DENEME      INT           NOT NULL CONSTRAINT DF_ADM_MOBIL_KULLANICI_HD DEFAULT 0,
    KILIT_BITIS        DATETIME      NULL,
    SON_GIRIS          DATETIME      NULL,
    OLUSTURAN          NVARCHAR(100) NULL,
    OLUSTURMA_TARIHI   DATETIME      NOT NULL CONSTRAINT DF_ADM_MOBIL_KULLANICI_OT DEFAULT GETDATE(),
    GUNCELLEME_TARIHI  DATETIME      NULL
  );
  CREATE UNIQUE INDEX UX_ADM_MOBIL_KULLANICI_AD ON dbo.ADM_MOBIL_KULLANICI (MUSTERI_NO, KULLANICI_ADI);
END
GO

-- 3b) Erişim: mobil kullanıcı → firma (veritabanı) + o veritabanındaki cari kart + yetkiler (K6, K10, K25)
IF OBJECT_ID('dbo.ADM_MOBIL_ERISIM') IS NULL
BEGIN
  CREATE TABLE dbo.ADM_MOBIL_ERISIM (
    ERISIM_ID          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ADM_MOBIL_ERISIM PRIMARY KEY,
    MOBIL_KULLANICI_ID INT           NOT NULL CONSTRAINT FK_ADM_MOBIL_ERISIM_KULLANICI REFERENCES dbo.ADM_MOBIL_KULLANICI (MOBIL_KULLANICI_ID),
    FIRMA_ID           INT           NOT NULL CONSTRAINT FK_ADM_MOBIL_ERISIM_FIRMA REFERENCES dbo.ADM_FIRMA (FIRMA_ID),
    CARI_KART_ID       INT           NOT NULL,          -- firma DB'sindeki TODVZ_CARI_KART.CARI_KART_ID
    CARI_KOD           NVARCHAR(30)  NULL,              -- listeler için (kartta değişirse görüntülemede yenilenir)
    CARI_AD            NVARCHAR(200) NULL,
    YETKI_FIYAT        BIT           NOT NULL CONSTRAINT DF_ADM_MOBIL_ERISIM_YF DEFAULT 1,
    YETKI_BAKIYE       BIT           NOT NULL CONSTRAINT DF_ADM_MOBIL_ERISIM_YB DEFAULT 1,
    YETKI_DOKUM        BIT           NOT NULL CONSTRAINT DF_ADM_MOBIL_ERISIM_YD DEFAULT 1,
    YETKI_ALIS         BIT           NOT NULL CONSTRAINT DF_ADM_MOBIL_ERISIM_YA DEFAULT 0,  -- cari alır (firma satar)
    YETKI_SATIS        BIT           NOT NULL CONSTRAINT DF_ADM_MOBIL_ERISIM_YS DEFAULT 0,  -- cari satar (firma alır)
    DURUM              VARCHAR(10)   NOT NULL CONSTRAINT DF_ADM_MOBIL_ERISIM_DURUM DEFAULT 'AKTIF', -- 'AKTIF' | 'PASIF'
    OLUSTURAN          NVARCHAR(100) NULL,
    OLUSTURMA_TARIHI   DATETIME      NOT NULL CONSTRAINT DF_ADM_MOBIL_ERISIM_OT DEFAULT GETDATE(),
    GUNCELLEYEN        NVARCHAR(100) NULL,
    GUNCELLEME_TARIHI  DATETIME      NULL
  );
  CREATE UNIQUE INDEX UX_ADM_MOBIL_ERISIM ON dbo.ADM_MOBIL_ERISIM (MOBIL_KULLANICI_ID, FIRMA_ID);
  CREATE INDEX IX_ADM_MOBIL_ERISIM_FIRMA ON dbo.ADM_MOBIL_ERISIM (FIRMA_ID, CARI_KART_ID);
END
GO

-- 3c) Oturum: şifre sıfırlanınca / erişim kapanınca açık oturum düşer
IF OBJECT_ID('dbo.ADM_MOBIL_OTURUM') IS NULL
BEGIN
  CREATE TABLE dbo.ADM_MOBIL_OTURUM (
    OTURUM_ID          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ADM_MOBIL_OTURUM PRIMARY KEY,
    MOBIL_KULLANICI_ID INT           NOT NULL CONSTRAINT FK_ADM_MOBIL_OTURUM_KULLANICI REFERENCES dbo.ADM_MOBIL_KULLANICI (MOBIL_KULLANICI_ID),
    BASLANGIC          DATETIME      NOT NULL CONSTRAINT DF_ADM_MOBIL_OTURUM_B DEFAULT GETDATE(),
    SON_ISLEM          DATETIME      NOT NULL CONSTRAINT DF_ADM_MOBIL_OTURUM_S DEFAULT GETDATE(),
    BITIS              DATETIME      NULL,
    KAPANMA_NEDENI     VARCHAR(30)   NULL,
    IP                 VARCHAR(64)   NULL,
    TARAYICI           NVARCHAR(400) NULL
  );
  CREATE INDEX IX_ADM_MOBIL_OTURUM_KULLANICI ON dbo.ADM_MOBIL_OTURUM (MOBIL_KULLANICI_ID, BITIS);
END
GO

-- Kontrol
SELECT (SELECT COUNT(*) FROM dbo.ADM_MODUL WHERE MODUL_KODU LIKE 'mobil%') AS MOBIL_MODUL,
       OBJECT_ID('dbo.ADM_MOBIL_FIRMA') AS T1, OBJECT_ID('dbo.ADM_MOBIL_KULLANICI') AS T2,
       OBJECT_ID('dbo.ADM_MOBIL_ERISIM') AS T3, OBJECT_ID('dbo.ADM_MOBIL_OTURUM') AS T4;
GO
