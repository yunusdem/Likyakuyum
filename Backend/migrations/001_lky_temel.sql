-- Kurulum (exe) ve şablon için temel tablolar. docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 7.2
-- Göç dosyaları sırayla ve bir kez uygulanır (LKY_SEMA_SURUMU). Her dosya tek işlemdir; GO ile batch'lere ayrılabilir.
-- Kural: yalnız ekleme / tekrar çalıştırılabilir değişiklik; mevcut veriyi silen göç YAZILMAZ.

IF OBJECT_ID('dbo.LKY_DURUM') IS NULL
  CREATE TABLE dbo.LKY_DURUM (
    ANAHTAR varchar(50)   NOT NULL PRIMARY KEY,
    DEGER   nvarchar(max) NULL,
    TARIH   datetime      NOT NULL DEFAULT GETDATE()
  );
