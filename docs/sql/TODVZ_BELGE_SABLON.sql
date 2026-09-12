-- Belge / Rapor şablon meta tablosu (docs/belgeverapor.md, Bölüm 6)
-- Uygulama bu tabloyu ilk istekte kendisi oluşturur (BelgeSqlRepository.ensureTablesExist).
-- Bu dosya yalnızca belgeleme ve elle kurulum içindir.
IF OBJECT_ID('dbo.TODVZ_BELGE_SABLON','U') IS NULL
CREATE TABLE dbo.TODVZ_BELGE_SABLON (
  SABLON_ID     int IDENTITY(1,1) NOT NULL PRIMARY KEY,
  KOD           varchar(20)   NOT NULL UNIQUE,      -- ALFIS1, STFIS1, (rapor: GUNKASA1 ...)
  AD            nvarchar(100) NOT NULL,
  TUR           varchar(10)   NOT NULL,             -- 'BELGE' | 'RAPOR'
  FIS_TIPI      tinyint       NULL,                 -- 0 Alış, 1 Satış (BELGE); NULL rapor
  DUZEN_DOSYASI varchar(100)  NOT NULL,             -- 'belge/ALFIS1.json' (Backend/ köküne göre)
  KAGIT         varchar(10)   NOT NULL DEFAULT 'A4',
  VARSAYILAN    bit           NOT NULL DEFAULT 0,   -- aynı FIS_TIPI için otomatik seçilen şablon
  AKTIF         bit           NOT NULL DEFAULT 1,
  ARSIV_DIZINI  nvarchar(200) NULL,                 -- boşsa TODVZ_TANIM.BELGE_DIZINI, o da boşsa Backend/belge-arsiv
  EKLEME_ZAMANI datetime2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_BELGE_SABLON WHERE KOD='ALFIS1')
  INSERT INTO dbo.TODVZ_BELGE_SABLON (KOD,AD,TUR,FIS_TIPI,DUZEN_DOSYASI,KAGIT,VARSAYILAN,AKTIF)
  VALUES ('ALFIS1',N'Alış Fişi','BELGE',0,'belge/ALFIS1.json','A4',1,1);
IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_BELGE_SABLON WHERE KOD='STFIS1')
  INSERT INTO dbo.TODVZ_BELGE_SABLON (KOD,AD,TUR,FIS_TIPI,DUZEN_DOSYASI,KAGIT,VARSAYILAN,AKTIF)
  VALUES ('STFIS1',N'Satış Fişi','BELGE',1,'belge/STFIS1.json','A4',1,1);
GO
-- Kontrol
SELECT * FROM dbo.TODVZ_BELGE_SABLON ORDER BY TUR, FIS_TIPI, KOD;
