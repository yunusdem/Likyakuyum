/* LIKYA_ADMIN göçü 001 — ADM_DAGITIM: panelden başlatılan test / canlı dağıtımları (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md).
   Bu klasördeki dosyalar npm run surum:yayinla (ve --yalniz-sema) ile klon hesabı üzerinden yönetim veritabanına uygulanır;
   LKY_SEMA_SURUMU tablosuna işlenir. Tekrar çalıştırılabilir yazılır. */
IF OBJECT_ID('dbo.ADM_DAGITIM') IS NULL
BEGIN
  CREATE TABLE dbo.ADM_DAGITIM (
    DAGITIM_ID        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    HEDEF             VARCHAR(10)   NOT NULL,            -- canli | test
    ONCEKI_COMMIT     VARCHAR(60)   NULL,
    HEDEF_COMMIT      VARCHAR(60)   NULL,
    BASLATAN_ADMIN_ID INT           NULL,
    BASLATAN          NVARCHAR(120) NULL,
    BASLANGIC         DATETIME      NOT NULL DEFAULT GETDATE(),
    BITIS             DATETIME      NULL,
    DURUM             VARCHAR(20)   NOT NULL DEFAULT 'CALISIYOR', -- CALISIYOR | BASARILI | HATA | GERI_DONDU | GERI_DONUS_HATASI
    ADIM              NVARCHAR(200) NULL,
    MESAJ             NVARCHAR(1000) NULL,
    LOG_DOSYASI       NVARCHAR(400) NULL,
    GORULDU           BIT           NOT NULL DEFAULT 0
  );
  CREATE INDEX IX_ADM_DAGITIM_DURUM ON dbo.ADM_DAGITIM (DURUM, DAGITIM_ID DESC);
END
GO
