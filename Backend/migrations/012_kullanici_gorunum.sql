-- Kullanıcı görünümü (docs/KULLANICI_GORUNUM_YOL_HARITASI.md, G7): yöneticinin çalışana KAPATTIĞI modül kodları.
-- Satır yoksa kullanıcı firmanın lisansındaki her şeyi görür. Kodlar modül kataloğundaki kodlardır
-- (src/config/modulKatalogu.ts) + üst çubuk kontrol düğmeleri (kontrol:*). Tekrar çalıştırılabilir.

IF OBJECT_ID('dbo.TODVZ_KULLANICI_GORUNUM', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TODVZ_KULLANICI_GORUNUM (
    KULLANICI_ID INT NOT NULL,
    MODUL_KODU VARCHAR(160) NOT NULL,
    GUNCELLEME_ZAMANI DATETIME NOT NULL CONSTRAINT DF_TODVZ_KULLANICI_GORUNUM_ZAMAN DEFAULT GETDATE(),
    CONSTRAINT PK_TODVZ_KULLANICI_GORUNUM PRIMARY KEY CLUSTERED (KULLANICI_ID, MODUL_KODU)
  );
END;
GO
