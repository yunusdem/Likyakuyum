/* =============================================================================
   TODVZ_MASAK_GUNCELLEME
   MASAK listelerinin güncelleme geçmişi. Her güncelleme denemesi (başarılı veya
   başarısız) liste başına bir satır olarak buraya yazılır.

   Amaç: MASAK denetiminde "listeleri düzenli güncelliyoruz" kaydı ve sorun
         çıktığında iz sürme (kim, ne zaman, hangi adresten, kaç kayıt).

   Not: Uygulama bu tabloyu ilk istekte otomatik oluşturur
        (MasakSqlRepository.ensureTablesExist). Bu betik yalnızca elle kurulum
        veya inceleme içindir; tekrar tekrar çalıştırılabilir (idempotent).
   ============================================================================= */

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_MASAK_GUNCELLEME')
BEGIN
  CREATE TABLE [dbo].[TODVZ_MASAK_GUNCELLEME] (
    [GUNCELLEME_ID]       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [LISTE_KOD]           VARCHAR(10)    NOT NULL,   -- 'A' | 'B' | 'C' | '3AB'
    [BASLAMA_ZAMANI]      DATETIME       NOT NULL DEFAULT GETDATE(),
    [BITIS_ZAMANI]        DATETIME       NULL,
    [SURE_MS]             INT            NULL,
    [DURUM]               VARCHAR(15)    NOT NULL,   -- 'BASARILI' | 'HATA'
    [KAYIT_SAYISI]        INT            NULL,       -- yazılan satır sayısı
    [ONCEKI_KAYIT_SAYISI] INT            NULL,       -- güncelleme öncesi satır sayısı
    [KAYNAK_URL]          NVARCHAR(1000) NULL,       -- kullanılan adres
    [KAYNAK_HASH]         VARCHAR(64)    NULL,       -- dosyanın SHA-256'sı
    [DOSYA_BOYUTU]        INT            NULL,
    [KULLANICI_ADI]       NVARCHAR(100)  NULL,
    [KULLANICI_ID]        NVARCHAR(50)   NULL,
    [HATA_MESAJI]         NVARCHAR(1000) NULL
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_GUNCELLEME_LISTE' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_GUNCELLEME]'))
  CREATE INDEX [IX_TODVZ_MASAK_GUNCELLEME_LISTE] ON [dbo].[TODVZ_MASAK_GUNCELLEME]([LISTE_KOD], [BASLAMA_ZAMANI] DESC);
GO

/* Son güncelleme durumu (ekranda gösterilen özet):

   SELECT LISTE_KOD, COUNT(*) AS KAYIT, MAX(GUNCELLEME_ZAMANI) AS SON_GUNCELLEME
   FROM dbo.TODVZ_MASAK_LISTE GROUP BY LISTE_KOD;

   Son denemeler:

   SELECT TOP 20 * FROM dbo.TODVZ_MASAK_GUNCELLEME ORDER BY GUNCELLEME_ID DESC;
*/
