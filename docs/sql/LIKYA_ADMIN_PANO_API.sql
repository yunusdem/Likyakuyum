/* =============================================================================
   LIKYA_ADMIN — Pano Entegrasyonu (docs/PANO_API_YOL_HARITASI.md)

   Firma, pano tanımındaki komisyonlu fiyatlarını anahtarlı açık adresten JSON / XML / TXT / HTML
   olarak LED pano yazılımına verir. Anahtarlar pano başına burada tutulur (P2, P13).

     1) ADM_MODUL'e kur:kur/pano-entegrasyonu (Kur menüsü › Pano Entegrasyonu). Firmalara ACIK yazılmaz:
        modül her firmada KAPALI başlar, yönetici firma bazında açar (P3).
     2) İçeriği yüklenmiş ürün paketlerine (Döviz, Gümüş, Kuyum, Connector — pano ile aynı paketler).
     3) ADM_PANO_ANAHTAR tablosu.

   Kurulum (sunucuda, SSMS'te, deploy ile birlikte bir kez). Tekrar çalıştırılabilir.
   ============================================================================= */

USE [LIKYA_ADMIN];
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1) Katalog
IF NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL WHERE MODUL_KODU = 'kur:kur/pano-entegrasyonu')
  INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
  SELECT 'kur:kur/pano-entegrasyonu', 'kur', N'Pano Entegrasyonu', 'ALT', ISNULL(MAX(SIRA), 0) + 1 FROM dbo.ADM_MODUL;
GO

-- 2) Ürün paketleri (tablolar yoksa atlanır; içeriği henüz yüklenmemiş paketi panel menüden doldurur)
IF OBJECT_ID('dbo.ADM_PAKET_MODUL') IS NOT NULL
BEGIN
  INSERT INTO dbo.ADM_PAKET_MODUL (PAKET_KODU, MODUL_KODU)
  SELECT p.PAKET_KODU, k.MODUL_KODU
  FROM dbo.ADM_PAKET p
  CROSS JOIN (VALUES ('kur'), ('kur:kur/pano-entegrasyonu')) AS k (MODUL_KODU)
  WHERE p.PAKET_KODU IN ('doviz', 'gumus', 'kuyum', 'connector')
    AND p.ILK_ICERIK = 1
    AND NOT EXISTS (SELECT 1 FROM dbo.ADM_PAKET_MODUL x WHERE x.PAKET_KODU = p.PAKET_KODU AND x.MODUL_KODU = k.MODUL_KODU);
END
GO

-- 3) Anahtarlar: firma + pano başına en çok bir AKTIF anahtar; "yenile" eskisini IPTAL yapıp yenisini ekler.
--    SON_ERISIM / ISTEK_SAYISI sunucuda bellekte sayılır, 60 sn'de bir toplu yazılır (P10).
IF OBJECT_ID('dbo.ADM_PANO_ANAHTAR') IS NULL
BEGIN
  CREATE TABLE dbo.ADM_PANO_ANAHTAR (
    ANAHTAR_ID       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ADM_PANO_ANAHTAR PRIMARY KEY,
    FIRMA_ID         INT           NOT NULL CONSTRAINT FK_ADM_PANO_ANAHTAR_FIRMA REFERENCES dbo.ADM_FIRMA (FIRMA_ID),
    PANO_ID          INT           NOT NULL,                       -- firma DB'sindeki TODVZ_PANO.PANO_ID
    ANAHTAR          VARCHAR(40)   COLLATE Latin1_General_BIN2 NOT NULL CONSTRAINT UQ_ADM_PANO_ANAHTAR UNIQUE,
    ONBELLEK_SN      INT           NOT NULL CONSTRAINT DF_ADM_PANO_ANAHTAR_ONBELLEK DEFAULT 2,
    DURUM            VARCHAR(10)   NOT NULL CONSTRAINT DF_ADM_PANO_ANAHTAR_DURUM DEFAULT 'AKTIF',  -- 'AKTIF' | 'IPTAL'
    OLUSTURAN        NVARCHAR(100) NULL,                           -- 'admin:<kullanıcı adı>' | 'firma:<kullanıcı adı>'
    OLUSTURMA_TARIHI DATETIME      NOT NULL CONSTRAINT DF_ADM_PANO_ANAHTAR_OLUSTURMA DEFAULT GETDATE(),
    IPTAL_EDEN       NVARCHAR(100) NULL,
    IPTAL_TARIHI     DATETIME      NULL,
    SON_ERISIM       DATETIME      NULL,
    ISTEK_SAYISI     BIGINT        NOT NULL CONSTRAINT DF_ADM_PANO_ANAHTAR_ISTEK DEFAULT 0
  );
  CREATE INDEX IX_ADM_PANO_ANAHTAR_FIRMA ON dbo.ADM_PANO_ANAHTAR (FIRMA_ID, PANO_ID, DURUM);
END
GO
