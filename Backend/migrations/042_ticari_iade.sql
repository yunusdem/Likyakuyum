-- ============================================================================
-- Göç 042: Ticari satış iadesi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA6)
-- İade fişi TODVZ_FATURA'ya FIS_KAYNAGI = 1, FATURA_TIPI = 2 ile yazılır (eski tablolara kolon eklenmez; bağ burada):
--   TODVZ_TICARI_IADE: iade fişi ↔ asıl satış fişi, iade nedeni.
--   TODVZ_TICARI_IADE_SATIR: iade satırı ↔ asıl satış satırı (satır başına iade edilebilir miktar denetimi için).
-- Yalnız ekleme; tekrar çalıştırılabilir. Uygulama da ilk kullanımda aynı dosyayı çalıştırır (ticariSema.ts).
-- ============================================================================

IF OBJECT_ID('dbo.TODVZ_TICARI_IADE', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TODVZ_TICARI_IADE (
    IADE_FATURA_ID INT NOT NULL CONSTRAINT PK_TODVZ_TICARI_IADE PRIMARY KEY,
    ASIL_FATURA_ID INT NOT NULL,
    NEDEN NVARCHAR(200) NULL,
    EKLEYEN_ID INT NULL,
    EKLEME_ZAMANI DATETIME NOT NULL CONSTRAINT DF_TODVZ_TICARI_IADE_ZAMAN DEFAULT GETDATE()
  );
  CREATE NONCLUSTERED INDEX IX_TODVZ_TICARI_IADE_ASIL ON dbo.TODVZ_TICARI_IADE (ASIL_FATURA_ID);
  PRINT 'TODVZ_TICARI_IADE tablosu kuruldu.';
END
GO

IF OBJECT_ID('dbo.TODVZ_TICARI_IADE_SATIR', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TODVZ_TICARI_IADE_SATIR (
    IADE_FATURA_ID INT NOT NULL,
    IADE_SATIR_NO INT NOT NULL,
    ASIL_SATIR_NO INT NOT NULL,
    CONSTRAINT PK_TODVZ_TICARI_IADE_SATIR PRIMARY KEY (IADE_FATURA_ID, IADE_SATIR_NO)
  );
  PRINT 'TODVZ_TICARI_IADE_SATIR tablosu kuruldu.';
END
GO
