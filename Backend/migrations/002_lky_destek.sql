-- Kurulum (exe) için destek köprüsü tabloları. docs/DESTEK_VE_BILDIRIM_YOL_HARITASI.md, K21
-- İnternet yokken yazılan talep/mesajlar burada bekler; merkezden inen liste önbelleklenir; okundu/arşiv yerelde tutulur.
-- Bulut firmalarına da uygulanır (boş kalır, zararsız).

IF OBJECT_ID('dbo.LKY_DESTEK_KUYRUK') IS NULL
  CREATE TABLE dbo.LKY_DESTEK_KUYRUK (
    ID                 int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TUR                varchar(10)   NOT NULL,                      -- 'TALEP' | 'MESAJ'
    MERKEZ_KONU_ID     int           NULL,                          -- MESAJ: hedef konu; TALEP: gönderilince merkezden dönen id
    YEREL_KONU_ANAHTAR varchar(60)   NULL,                          -- MESAJ: henüz gönderilmemiş yerel talebe bağlı
    YEREL_ANAHTAR      varchar(60)   NOT NULL,                      -- merkezde tekrar engeli
    KULLANICI_ADI      nvarchar(50)  NOT NULL,
    KULLANICI_JSON     nvarchar(400) NOT NULL,                      -- {kullaniciAdi, adSoyad, yonetici}
    GOVDE              nvarchar(max) NOT NULL,                      -- istek gövdesi (JSON)
    DURUM              varchar(10)   NOT NULL DEFAULT 'BEKLIYOR',   -- 'BEKLIYOR' | 'GONDERILDI' | 'HATA'
    DENEME             int           NOT NULL DEFAULT 0,
    SON_HATA           nvarchar(400) NULL,
    OLUSTURMA          datetime      NOT NULL DEFAULT GETDATE(),
    GONDERIM           datetime      NULL
  );
GO

IF OBJECT_ID('dbo.LKY_DESTEK_ONBELLEK') IS NULL
  CREATE TABLE dbo.LKY_DESTEK_ONBELLEK (
    ANAHTAR varchar(100)  NOT NULL PRIMARY KEY,                     -- 'liste:<kullanici>' | 'konu:<id>'
    DEGER   nvarchar(max) NOT NULL,
    TARIH   datetime      NOT NULL DEFAULT GETDATE()
  );
GO

IF OBJECT_ID('dbo.LKY_DESTEK_OKUMA') IS NULL
  CREATE TABLE dbo.LKY_DESTEK_OKUMA (
    KONU_ID             int          NOT NULL,
    KULLANICI_ADI       nvarchar(50) NOT NULL,
    SON_OKUNAN_MESAJ_ID int          NOT NULL DEFAULT 0,
    ARSIV               bit          NOT NULL DEFAULT 0,
    ONEMLI_OKUNDU       bit          NOT NULL DEFAULT 0,
    CONSTRAINT PK_LKY_DESTEK_OKUMA PRIMARY KEY (KONU_ID, KULLANICI_ADI)
  );
GO
