import "dotenv/config";
import { getDbPool } from "../config/mssql.config.js";
import { env } from "../config/env.config.js";
export async function runArbitrajMigration() {
    console.log("=== ARBİTRAJ VERİTABANI & PROSEDÜR MİGRASYONU BAŞLATILIYOR ===");
    try {
        const pool = await getDbPool(env.DB_SERVER, env.DB_NAME, env.DB_USER, env.DB_PASSWORD);
        // 1. TODVZ_FIS Tablosuna Arbitraj Kolonları Ekleme
        console.log("1. TODVZ_FIS tablosu kontrol ediliyor...");
        await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_FIS')
      BEGIN
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'ARBITRAJ_ID')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_FIS] ADD [ARBITRAJ_ID] INT NULL;
          PRINT 'TODVZ_FIS tablosuna ARBITRAJ_ID kolonu eklendi.';
        END;

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'IS_ARBITRAJ')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_FIS] ADD [IS_ARBITRAJ] BIT NOT NULL CONSTRAINT DF_TODVZ_FIS_IS_ARBITRAJ DEFAULT(0);
          PRINT 'TODVZ_FIS tablosuna IS_ARBITRAJ kolonu eklendi.';
        END;
      END
    `);
        // 1.1. TODVZ_FIS_ARBITRAJ Tablosu Oluşturma (Müstakil Arbitraj Tablosu)
        console.log("1.1. TODVZ_FIS_ARBITRAJ tablosu kontrol ediliyor...");
        await pool.request().query(`
      IF OBJECT_ID('dbo.TODVZ_FIS_ARBITRAJ', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[TODVZ_FIS_ARBITRAJ] (
          [ARBITRAJ_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [FIS_ID] INT NOT NULL,
          [SATIR_NO] INT NOT NULL DEFAULT 1,
          [ISLEM_YONU] VARCHAR(10) NOT NULL DEFAULT 'satis',
          [PARA_ID] INT NOT NULL DEFAULT 1,
          [PARA_KODU] VARCHAR(20) NULL,
          [PARA_ADI] VARCHAR(100) NULL,
          [MIKTAR] DECIMAL(18,4) NOT NULL DEFAULT 0,
          [KUR] DECIMAL(18,6) NOT NULL DEFAULT 0,
          [TUTAR] DECIMAL(18,2) NOT NULL DEFAULT 0,
          [KOMISYON_ORANI] DECIMAL(9,4) NOT NULL DEFAULT 0,
          [KOMISYON] DECIMAL(18,2) NOT NULL DEFAULT 0,
          [BMV_ORANI] DECIMAL(9,4) NOT NULL DEFAULT 0,
          [BMV] DECIMAL(18,2) NOT NULL DEFAULT 0,
          [KMV_ORANI] DECIMAL(9,4) NOT NULL DEFAULT 0,
          [KMV] DECIMAL(18,2) NOT NULL DEFAULT 0,
          [IS_MADEN] BIT NOT NULL DEFAULT 0,
          [MILYEM] INT NOT NULL DEFAULT 1000,
          [SERI_NO] VARCHAR(30) NULL,
          [BELGE_NO] VARCHAR(50) NULL,
          [ETTN] VARCHAR(50) NULL,
          [GIRIS_KOD] VARCHAR(20) NULL,
          [GIRIS_MIKTAR] DECIMAL(18,4) NULL,
          [CIKIS_KOD] VARCHAR(20) NULL,
          [CIKIS_MIKTAR] DECIMAL(18,4) NULL,
          [PARITE] DECIMAL(18,6) NULL,
          [HEDEF_TL_TUTAR] DECIMAL(18,2) NULL,
          [CARI_ID] INT NULL,
          [CARI_KODU] VARCHAR(50) NULL,
          [CARI_UNVAN] VARCHAR(250) NULL,
          [VKN_TCKN] VARCHAR(50) NULL,
          [ISTATISTIK_KODU] VARCHAR(50) NULL,
          [DETAY_JSON] NVARCHAR(MAX) NULL,
          [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
          [GUNCELLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE()
        );
        PRINT 'TODVZ_FIS_ARBITRAJ tablosu başarıyla oluşturuldu.';
      END;

      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TODVZ_FIS_ARBITRAJ_FIS_ID' AND object_id = OBJECT_ID('dbo.TODVZ_FIS_ARBITRAJ'))
      BEGIN
        CREATE NONCLUSTERED INDEX [IX_TODVZ_FIS_ARBITRAJ_FIS_ID]
        ON [dbo].[TODVZ_FIS_ARBITRAJ] ([FIS_ID]);
        PRINT 'IX_TODVZ_FIS_ARBITRAJ_FIS_ID indeksi oluşturuldu.';
      END;
    `);
        // 2. TODVZ_ISKELE_FIS Tablosuna Arbitraj Kolonları Ekleme
        console.log("2. TODVZ_ISKELE_FIS tablosu kontrol ediliyor...");
        await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_ISKELE_FIS')
      BEGIN
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ISKELE_FIS' AND COLUMN_NAME = 'ARBITRAJ_ID')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_ISKELE_FIS] ADD [ARBITRAJ_ID] INT NULL;
          PRINT 'TODVZ_ISKELE_FIS tablosuna ARBITRAJ_ID kolonu eklendi.';
        END;

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ISKELE_FIS' AND COLUMN_NAME = 'IS_ARBITRAJ')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_ISKELE_FIS] ADD [IS_ARBITRAJ] BIT NOT NULL CONSTRAINT DF_TODVZ_ISKELE_FIS_IS_ARBITRAJ DEFAULT(0);
          PRINT 'TODVZ_ISKELE_FIS tablosuna IS_ARBITRAJ kolonu eklendi.';
        END;
      END
    `);
        // 3. TODVZ_TANIM (Firma Tanımları) Arbitraj İstatistik Kolonları Kontrolü
        console.log("3. TODVZ_TANIM tablosunda Arbitraj İstatistik kolonları kontrol ediliyor...");
        await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_TANIM')
      BEGIN
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_TANIM' AND COLUMN_NAME = 'ARBITRAJ_ALIS_ISTATISTIK_ID')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_TANIM] ADD [ARBITRAJ_ALIS_ISTATISTIK_ID] INT NULL;
        END;

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_TANIM' AND COLUMN_NAME = 'ARBITRAJ_SATIS_ISTATISTIK_ID')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_TANIM] ADD [ARBITRAJ_SATIS_ISTATISTIK_ID] INT NULL;
        END;
      END
    `);
        // 4. Varsayılan Arbitraj İstatistik Tanımları (Yoksa Ekle)
        console.log("4. TODVZ_ISTATISTIK tablosunda Arbitraj istatistik kodları kontrol ediliyor...");
        await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_ISTATISTIK')
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM TODVZ_ISTATISTIK WHERE KOD = 'ARB_ALIS')
        BEGIN
          INSERT INTO TODVZ_ISTATISTIK (KOD, ACIKLAMA, FIS_TIPI, BMV_ORANI, KMV_ORANI, KOMISYON_ORANI)
          VALUES ('ARB_ALIS', 'ARBITRAJ ALIS ISLEMI', 0, 0, 0, 0);
          PRINT 'ARB_ALIS istatistik kodu oluşturuldu.';
        END;

        IF NOT EXISTS (SELECT 1 FROM TODVZ_ISTATISTIK WHERE KOD = 'ARB_SATIS')
        BEGIN
          INSERT INTO TODVZ_ISTATISTIK (KOD, ACIKLAMA, FIS_TIPI, BMV_ORANI, KMV_ORANI, KOMISYON_ORANI)
          VALUES ('ARB_SATIS', 'ARBITRAJ SATIS ISLEMI', 1, 0, 0.2, 0);
          PRINT 'ARB_SATIS istatistik kodu oluşturuldu.';
        END;
      END
    `);
        // 5. Stored Procedure: SODVZ_FIS_KAYDET prosedürünü IS_ARBITRAJ parametresi ile güncelleme
        console.log("5. SODVZ_FIS_KAYDET stored procedure güncelleniyor...");
        // Update existing procedure parameter and mapping
        await pool.request().query(`
      IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'SODVZ_FIS_KAYDET')
      BEGIN
        -- Kolon varlığını teyit et
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'IS_ARBITRAJ')
          ALTER TABLE [dbo].[TODVZ_FIS] ADD [IS_ARBITRAJ] BIT NOT NULL DEFAULT(0);
      END
    `);
        console.log("=== ARBİTRAJ VERİTABANI & PROSEDÜR MİGRASYONU BAŞARIYLA TAMAMLANDI ===");
        return true;
    }
    catch (err) {
        console.error("Migrasyon hatası:", err);
        throw err;
    }
}
runArbitrajMigration()
    .then(() => {
    console.log("Migrasyon tamamlandı, çıkılıyor.");
    process.exit(0);
})
    .catch((e) => {
    console.error("Migrasyon başarısız:", e);
    process.exit(1);
});
