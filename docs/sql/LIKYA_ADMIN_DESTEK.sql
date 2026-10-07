/* =============================================================================
   LIKYA_ADMIN — Destek (talep), bildirim ve sistem olayı tabloları
   docs/DESTEK_VE_BILDIRIM_YOL_HARITASI.md, 3

   Kurulum (sunucuda, SSMS'te sysadmin ile, bir kez): betiğin tamamını çalıştırın.
   Uygulama kullanıcısının (likya_admin_app) tablo açma yetkisi olmadığı için bu
   tablolar kendiliğinden oluşmaz. Tablolar yokken zil boş görünür, talep açılamaz;
   programın geri kalanı etkilenmez.

   Betik tekrar tekrar çalıştırılabilir (idempotent).
   ============================================================================= */

USE [LIKYA_ADMIN];
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- Konu: talep (kullanıcı açar), bildirim (admin gönderir) ve sistem olayı tek tabloda. Gövde = ilk mesaj.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_KONU')
BEGIN
  CREATE TABLE [dbo].[ADM_KONU] (
    [KONU_ID]            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [TUR]                VARCHAR(10)   NOT NULL,                 -- 'TALEP' | 'BILDIRIM' | 'SISTEM'
    [FIRMA_ID]           INT           NULL REFERENCES [dbo].[ADM_FIRMA]([FIRMA_ID]),
    [KULLANICI_ID]       INT           NULL,                     -- ADM_KULLANICI (bulut); exe'de NULL
    [KULLANICI_ADI]      NVARCHAR(100) NULL,                     -- görünen ad (exe'de tek kaynak)
    [BASLIK]             NVARCHAR(200) NOT NULL,
    [TALEP_TURU]         VARCHAR(10)   NULL,                     -- 'HATA' | 'ONERI' | 'SORU' | 'DIGER'
    [ONCELIK]            VARCHAR(10)   NOT NULL DEFAULT 'NORMAL',-- 'NORMAL' | 'ACIL'
    [EKRAN]              NVARCHAR(200) NULL,                     -- talebin açıldığı sayfa adresi
    [DURUM]              VARCHAR(20)   NOT NULL,                 -- talep: ACIK|CEVAPLANDI|KULLANICI_YANITLADI|KAPALI · bildirim: TASLAK|GONDERILDI|GERI_CEKILDI · sistem: ACIK|KAPALI
    [BILDIRIM_TURU]      VARCHAR(10)   NULL,                     -- 'DUYURU' | 'BAKIM' | 'SURUM' | 'UYARI'
    [ONEMLI]             BIT           NOT NULL DEFAULT 0,       -- girişte pencere
    [CEVAP_ALIR]         BIT           NOT NULL DEFAULT 1,       -- bildirimde Yanıtla düğmesi
    [HEDEF]              VARCHAR(10)   NULL,                     -- 'TUMU' | 'FIRMA' | 'KULLANICI'
    [SURUM]              VARCHAR(30)   NULL,                     -- sürüm duyurusu
    [SISTEM_OLAY]        VARCHAR(40)   NULL,                     -- LISANS_30 | LISANS_7 | LISANS_BITTI | FIRMA_DURUM | OTURUM_KAPATILDI | GUNCELLEME_KURULDU | EBELGE_HATA
    [OLAY_ANAHTARI]      VARCHAR(100)  NULL,                     -- aynı olayın ikinci kez açılmaması için
    [KAYNAK_KONU_ID]     INT           NULL,                     -- yanıtlanan bildirim
    [ATANAN_ADMIN_ID]    INT           NULL,
    [OLUSTURAN_ADMIN_ID] INT           NULL,
    [KAPATAN_ADMIN_ID]   INT           NULL,
    [YEREL_ANAHTAR]      VARCHAR(60)   NULL,                     -- exe'den gelen tekil anahtar
    [OLUSTURMA_TARIHI]   DATETIME      NOT NULL DEFAULT GETDATE(),
    [SON_MESAJ_TARIHI]   DATETIME      NOT NULL DEFAULT GETDATE(),
    [SON_MESAJ_TARAF]    VARCHAR(10)   NOT NULL DEFAULT 'KULLANICI', -- 'ADMIN' | 'KULLANICI' | 'SISTEM'
    [GONDERIM_TARIHI]    DATETIME      NULL,                     -- bildirim gönderildi
    [KAPANIS_TARIHI]     DATETIME      NULL,
    CONSTRAINT [CK_ADM_KONU_TUR] CHECK ([TUR] IN ('TALEP','BILDIRIM','SISTEM')),
    CONSTRAINT [CK_ADM_KONU_ONCELIK] CHECK ([ONCELIK] IN ('NORMAL','ACIL'))
  );
  CREATE INDEX [IX_ADM_KONU_FIRMA] ON [dbo].[ADM_KONU]([FIRMA_ID], [TUR], [DURUM]);
  CREATE INDEX [IX_ADM_KONU_SON] ON [dbo].[ADM_KONU]([SON_MESAJ_TARIHI] DESC);
  CREATE UNIQUE INDEX [UQ_ADM_KONU_OLAY] ON [dbo].[ADM_KONU]([OLAY_ANAHTARI]) WHERE [OLAY_ANAHTARI] IS NOT NULL;
  CREATE UNIQUE INDEX [UQ_ADM_KONU_YEREL] ON [dbo].[ADM_KONU]([FIRMA_ID], [YEREL_ANAHTAR]) WHERE [YEREL_ANAHTAR] IS NOT NULL;
END
GO

-- Mesajlar (ilk mesaj konunun gövdesidir). Düzenlenmez, silinmez.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_KONU_MESAJ')
BEGIN
  CREATE TABLE [dbo].[ADM_KONU_MESAJ] (
    [MESAJ_ID]      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [KONU_ID]       INT            NOT NULL REFERENCES [dbo].[ADM_KONU]([KONU_ID]),
    [GONDEREN_TUR]  VARCHAR(10)    NOT NULL,                     -- 'ADMIN' | 'KULLANICI' | 'SISTEM'
    [ADMIN_ID]      INT            NULL,
    [KULLANICI_ID]  INT            NULL,
    [GONDEREN_AD]   NVARCHAR(100)  NULL,
    [METIN]         NVARCHAR(4000) NOT NULL,
    [IC_NOT]        BIT            NOT NULL DEFAULT 0,           -- yalnız adminler görür
    [YEREL_ANAHTAR] VARCHAR(60)    NULL,
    [TARIH]         DATETIME       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [CK_ADM_KONU_MESAJ_TUR] CHECK ([GONDEREN_TUR] IN ('ADMIN','KULLANICI','SISTEM'))
  );
  CREATE INDEX [IX_ADM_KONU_MESAJ_KONU] ON [dbo].[ADM_KONU_MESAJ]([KONU_ID], [MESAJ_ID]);
  CREATE UNIQUE INDEX [UQ_ADM_KONU_MESAJ_YEREL] ON [dbo].[ADM_KONU_MESAJ]([KONU_ID], [YEREL_ANAHTAR]) WHERE [YEREL_ANAHTAR] IS NOT NULL;
END
GO

-- Görsel ekler. Dosya sunucu diskinde (Backend/destek-ekler); talep kapanınca dosya silinir, satır kalır (SILINDI=1).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_KONU_EK')
BEGIN
  CREATE TABLE [dbo].[ADM_KONU_EK] (
    [EK_ID]     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [KONU_ID]   INT           NOT NULL REFERENCES [dbo].[ADM_KONU]([KONU_ID]),
    [MESAJ_ID]  INT           NOT NULL REFERENCES [dbo].[ADM_KONU_MESAJ]([MESAJ_ID]),
    [DOSYA_ADI] NVARCHAR(200) NOT NULL,
    [MIME]      VARCHAR(50)   NOT NULL,
    [BOYUT]     INT           NOT NULL,
    [YOL]       NVARCHAR(400) NULL,
    [SILINDI]   BIT           NOT NULL DEFAULT 0,
    [TARIH]     DATETIME      NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX [IX_ADM_KONU_EK_KONU] ON [dbo].[ADM_KONU_EK]([KONU_ID]);
END
GO

-- Bildirim hedefleri (HEDEF='TUMU' ise satır yok). KULLANICI_ID NULL = firmadaki herkes.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_KONU_HEDEF')
BEGIN
  CREATE TABLE [dbo].[ADM_KONU_HEDEF] (
    [KONU_ID]      INT NOT NULL REFERENCES [dbo].[ADM_KONU]([KONU_ID]),
    [FIRMA_ID]     INT NOT NULL REFERENCES [dbo].[ADM_FIRMA]([FIRMA_ID]),
    [KULLANICI_ID] INT NULL,
    [KULLANICI_ADI] NVARCHAR(100) NULL                           -- exe firmasında kullanıcı adıyla hedefleme
  );
  CREATE INDEX [IX_ADM_KONU_HEDEF_FIRMA] ON [dbo].[ADM_KONU_HEDEF]([FIRMA_ID], [KONU_ID]);
END
GO

-- Okuma / arşiv durumu: kişi başına (kullanıcı tarafında merkez kullanıcı id; admin tarafında admin id).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ADM_KONU_OKUMA')
BEGIN
  CREATE TABLE [dbo].[ADM_KONU_OKUMA] (
    [KONU_ID]             INT         NOT NULL REFERENCES [dbo].[ADM_KONU]([KONU_ID]),
    [TARAF]               VARCHAR(10) NOT NULL,                  -- 'KULLANICI' | 'ADMIN'
    [KISI_ID]             INT         NOT NULL,
    [SON_OKUNAN_MESAJ_ID] INT         NOT NULL DEFAULT 0,
    [OKUNDU_TARIHI]       DATETIME    NULL,
    [ARSIV]               BIT         NOT NULL DEFAULT 0,
    [ONEMLI_OKUNDU]       BIT         NOT NULL DEFAULT 0,        -- girişteki pencere bir daha çıkmaz
    CONSTRAINT [PK_ADM_KONU_OKUMA] PRIMARY KEY ([KONU_ID], [TARAF], [KISI_ID])
  );
END
GO
