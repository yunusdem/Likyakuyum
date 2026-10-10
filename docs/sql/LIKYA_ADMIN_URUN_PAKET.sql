/* =============================================================================
   LIKYA_ADMIN — Lisans ürün paketleri (Döviz / Gümüş / Kuyum / Ticari / Connector / ERP)
   docs/LISANS_URUN_PAKETLERI.md, 3.1

   Kurulum (sunucuda, SSMS'te sysadmin ile, bir kez): betiğin tamamını çalıştırın.
   Uygulama kullanıcısının (likya_admin_app) tablo açma yetkisi olmadığı için bu
   tablolar kendiliğinden oluşmaz. Tablolar yokken lisans penceresi eskisi gibi
   çalışır (ürün seçimi görünmez); programın geri kalanı etkilenmez.

   Paket İÇERİKLERİ burada yazılmaz: yönetim paneli Paket Tanımları sayfası ilk
   açıldığında boş paketleri menüden üretilen ilk içerikle bir kez doldurur.

   Betik tekrar tekrar çalıştırılabilir (idempotent).
   ============================================================================= */

USE [LIKYA_ADMIN];
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- Paketler. CEKIRDEK=1: her ürünle birlikte açılan ortak sayfalar. HEPSI=1: katalogun tamamı (ERP).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_PAKET')
BEGIN
  CREATE TABLE [dbo].[ADM_PAKET] (
    [PAKET_KODU]           VARCHAR(20)   NOT NULL PRIMARY KEY,
    [AD]                   NVARCHAR(100) NOT NULL,
    [SIRA]                 INT           NOT NULL,
    [CEKIRDEK]             BIT           NOT NULL CONSTRAINT [DF_ADM_PAKET_CEKIRDEK] DEFAULT 0,
    [HEPSI]                BIT           NOT NULL CONSTRAINT [DF_ADM_PAKET_HEPSI] DEFAULT 0,
    [ILK_ICERIK]           BIT           NOT NULL CONSTRAINT [DF_ADM_PAKET_ILK] DEFAULT 0,  -- ilk içerik yüklendi mi
    [GUNCELLEYEN_ADMIN_ID] INT           NULL,
    [GUNCELLEME_TARIHI]    DATETIME      NULL
  );
END
GO

-- Türkçe harfler NCHAR ile: sqlcmd BOM'suz dosyayı ANSI okur, harf bozulmasın
MERGE dbo.ADM_PAKET AS h
USING (VALUES
  ('cekirdek',  NCHAR(199) + N'ekirdek',        0, 1, 0),
  ('kuyum',     N'Likya.Kuyum',     1, 0, 0),
  ('doviz',     N'Likya.D' + NCHAR(246) + N'viz',     2, 0, 0),
  ('gumus',     N'Likya.G' + NCHAR(252) + N'm' + NCHAR(252) + NCHAR(351),     3, 0, 0),
  ('ticari',    N'Likya.Ticari',    4, 0, 0),
  ('connector', N'Likya.Connector', 5, 0, 0),
  ('erp',       N'Likya.ERP',       6, 0, 1)
) AS k (PAKET_KODU, AD, SIRA, CEKIRDEK, HEPSI) ON h.PAKET_KODU = k.PAKET_KODU
WHEN NOT MATCHED BY TARGET THEN
  INSERT (PAKET_KODU, AD, SIRA, CEKIRDEK, HEPSI, ILK_ICERIK)
  VALUES (k.PAKET_KODU, k.AD, k.SIRA, k.CEKIRDEK, k.HEPSI, k.HEPSI);  -- ERP'nin listesi yoktur, ilk içerik gerekmez
GO

-- Paketin açtığı modül kodları (ADM_MODUL.MODUL_KODU; menüden kalkan kod burada kalabilir, hesapta yok sayılır)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_PAKET_MODUL')
BEGIN
  CREATE TABLE [dbo].[ADM_PAKET_MODUL] (
    [PAKET_KODU] VARCHAR(20)  NOT NULL,
    [MODUL_KODU] VARCHAR(100) NOT NULL,
    CONSTRAINT [PK_ADM_PAKET_MODUL] PRIMARY KEY ([PAKET_KODU], [MODUL_KODU]),
    CONSTRAINT [FK_ADM_PAKET_MODUL_PAKET] FOREIGN KEY ([PAKET_KODU]) REFERENCES [dbo].[ADM_PAKET]([PAKET_KODU])
  );
END
GO

-- Lisansın ürünleri: virgüllü paket kodları ("kuyum,connector"). NULL/boş = ürünsüz (eski usul modül ayarı)
IF COL_LENGTH('dbo.ADM_LISANS', 'URUNLER') IS NULL
  ALTER TABLE [dbo].[ADM_LISANS] ADD [URUNLER] VARCHAR(200) NULL;
GO

-- Ürünlü firmada elle açılan (EK) / kapatılan (CIKAR) sayfalar. Paket değişse de korunur.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_FIRMA_MODUL_ISTISNA')
BEGIN
  CREATE TABLE [dbo].[ADM_FIRMA_MODUL_ISTISNA] (
    [FIRMA_ID]   INT          NOT NULL,
    [MODUL_KODU] VARCHAR(100) NOT NULL,
    [TUR]        VARCHAR(5)   NOT NULL CONSTRAINT [CK_ADM_FIRMA_MODUL_ISTISNA_TUR] CHECK ([TUR] IN ('EK', 'CIKAR')),
    [ADMIN_ID]   INT          NULL,
    [TARIH]      DATETIME     NOT NULL CONSTRAINT [DF_ADM_FIRMA_MODUL_ISTISNA_TARIH] DEFAULT GETDATE(),
    CONSTRAINT [PK_ADM_FIRMA_MODUL_ISTISNA] PRIMARY KEY ([FIRMA_ID], [MODUL_KODU]),
    CONSTRAINT [FK_ADM_FIRMA_MODUL_ISTISNA_FIRMA] FOREIGN KEY ([FIRMA_ID]) REFERENCES [dbo].[ADM_FIRMA]([FIRMA_ID])
  );
END
GO

-- Yetki: likya_admin_app db_datareader + db_datawriter üyesidir (LIKYA_ADMIN.sql); ayrıca GRANT gerekmez.
