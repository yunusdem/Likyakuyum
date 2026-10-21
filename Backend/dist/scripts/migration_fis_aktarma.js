import "dotenv/config";
import { getDbPool, getActivePool } from "../config/mssql.config.js";
import { env } from "../config/env.config.js";
export async function runFisAktarmaMigration() {
    console.log("=== FİŞ AKTARMA VERİTABANI & KOLON MİGRASYONU BAŞLATILIYOR ===");
    try {
        let pool = await getActivePool();
        if (!pool) {
            pool = await getDbPool(env.DB_SERVER, env.DB_NAME, env.DB_USER, env.DB_PASSWORD);
        }
        // 1. TODVZ_TANIM Tablosuna Fiş Aktarma Hesabı Kolonları
        console.log("1. TODVZ_TANIM tablosu kontrol ediliyor...");
        await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_TANIM')
      BEGIN
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_TANIM' AND COLUMN_NAME = 'FIS_AKTARILACAK_HESAP_ID')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_TANIM] ADD [FIS_AKTARILACAK_HESAP_ID] INT NULL;
          PRINT 'TODVZ_TANIM tablosuna FIS_AKTARILACAK_HESAP_ID kolonu eklendi.';
        END;

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_TANIM' AND COLUMN_NAME = 'FIS_AKTARMA_HESABI')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_TANIM] ADD [FIS_AKTARMA_HESABI] VARCHAR(50) NULL;
          PRINT 'TODVZ_TANIM tablosuna FIS_AKTARMA_HESABI kolonu eklendi.';
        END;

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_TANIM' AND COLUMN_NAME = 'DIGER_VERITABANI_ADI')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_TANIM] ADD [DIGER_VERITABANI_ADI] VARCHAR(200) NULL;
          PRINT 'TODVZ_TANIM tablosuna DIGER_VERITABANI_ADI kolonu eklendi.';
        END;
      END
    `);
        // 2. TODVZ_FIS Tablosuna Aktarım Takip Kolonları
        console.log("2. TODVZ_FIS tablosu kontrol ediliyor...");
        await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_FIS')
      BEGIN
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'AKTARILDI')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_FIS] ADD [AKTARILDI] BIT NOT NULL CONSTRAINT DF_TODVZ_FIS_AKTARILDI DEFAULT(0);
          PRINT 'TODVZ_FIS tablosuna AKTARILDI kolonu eklendi.';
        END;

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'AKTARIM_TARIHI')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_FIS] ADD [AKTARIM_TARIHI] DATETIME NULL;
          PRINT 'TODVZ_FIS tablosuna AKTARIM_TARIHI kolonu eklendi.';
        END;

        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'KAYNAK_FIS_ID')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_FIS] ADD [KAYNAK_FIS_ID] INT NULL;
          PRINT 'TODVZ_FIS tablosuna KAYNAK_FIS_ID kolonu eklendi.';
        END;
      END
    `);
        console.log("=== FİŞ AKTARMA MİGRASYONU BAŞARIYLA TAMAMLANDI ===");
    }
    catch (error) {
        console.error("Fiş aktarma migrasyonu sırasında hata:", error);
    }
}
if (process.argv[1] && process.argv[1].endsWith("migration_fis_aktarma.ts")) {
    runFisAktarmaMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}
