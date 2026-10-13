import "dotenv/config";
import sql from "mssql";
import fs from "fs";
import path from "path";
import { getDbPool } from "../config/mssql.config.js";
import { env } from "../config/env.config.js";
import { resimDiskYolu } from "../models/urunResimSql.repository.js";
import { logger } from "../utils/logger.js";

/**
 * Migration: Doğrudan SQL Resim Saklama ve Alma (VARBINARY(MAX))
 * - TODVZ_URUN_RESIM.RESIM_DATA VARBINARY(MAX)
 * - TODVZ_ALTIN_URUN.RESIM VARBINARY(MAX)
 * - TODVZ_OZEL_URUN.RESIM VARBINARY(MAX)
 * - TODVZ_FOTOGRAF.FOTOGRAF_DATA VARBINARY(MAX)
 * - Disk üzerinde kalmış eski dosyaları okuyup doğrudan SQL tablosuna binary olarak gömer.
 */
export async function runResimSqlSaklamaMigration() {
  console.log("=== RESİM DOĞRUDAN SQL SAKLAMA MİGRASYONU BAŞLATILIYOR ===");
  try {
    const pool = await getDbPool(env.DB_SERVER, env.DB_NAME, env.DB_USER, env.DB_PASSWORD);

    // 1. TODVZ_URUN_RESIM tablosu ve RESIM_DATA kolonu kontrolü
    console.log("1. TODVZ_URUN_RESIM tablosu kontrol ediliyor...");
    await pool.request().batch(`
      IF OBJECT_ID('dbo.TODVZ_URUN_RESIM', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[TODVZ_URUN_RESIM] (
          [RESIM_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [TIP] TINYINT NOT NULL DEFAULT 0,
          [ISLEM_ID] INT NULL,
          [DOSYA_ADI] VARCHAR(255) NOT NULL,
          [DOSYA_YOLU] VARCHAR(500) NOT NULL,
          [DOSYA_BOYUTU] INT NULL,
          [DOSYA_TIPI] VARCHAR(50) NULL,
          [RESIM_DATA] VARBINARY(MAX) NULL,
          [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE()
        );
        PRINT 'TODVZ_URUN_RESIM tablosu sıfırdan oluşturuldu.';
      END
      ELSE
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TODVZ_URUN_RESIM') AND name = 'RESIM_DATA')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_URUN_RESIM] ADD [RESIM_DATA] VARBINARY(MAX) NULL;
          PRINT 'TODVZ_URUN_RESIM tablosuna RESIM_DATA VARBINARY(MAX) eklendi.';
        END;
      END;
    `);

    // 2. TODVZ_ALTIN_URUN tablosunda RESIM kolonu kontrolü
    console.log("2. TODVZ_ALTIN_URUN tablosunda RESIM VARBINARY(MAX) kontrol ediliyor...");
    await pool.request().batch(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN')
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'RESIM')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [RESIM] VARBINARY(MAX) NULL;
          PRINT 'TODVZ_ALTIN_URUN tablosuna RESIM VARBINARY(MAX) eklendi.';
        END
        ELSE
        BEGIN
          IF EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'RESIM' 
              AND (DATA_TYPE <> 'varbinary' OR CHARACTER_MAXIMUM_LENGTH <> -1)
          )
          BEGIN
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ALTER COLUMN [RESIM] VARBINARY(MAX) NULL;
            PRINT 'TODVZ_ALTIN_URUN tablosundaki RESIM kolonu VARBINARY(MAX) olarak güncellendi.';
          END;
        END;
      END;
    `);

    // 3. TODVZ_OZEL_URUN tablosunda RESIM kolonu kontrolü
    console.log("3. TODVZ_OZEL_URUN tablosunda RESIM VARBINARY(MAX) kontrol ediliyor...");
    await pool.request().batch(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_OZEL_URUN')
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'RESIM')
        BEGIN
          ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ADD [RESIM] VARBINARY(MAX) NULL;
          PRINT 'TODVZ_OZEL_URUN tablosuna RESIM VARBINARY(MAX) eklendi.';
        END
        ELSE
        BEGIN
          IF EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'RESIM' 
              AND (DATA_TYPE <> 'varbinary' OR CHARACTER_MAXIMUM_LENGTH <> -1)
          )
          BEGIN
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ALTER COLUMN [RESIM] VARBINARY(MAX) NULL;
            PRINT 'TODVZ_OZEL_URUN tablosundaki RESIM kolonu VARBINARY(MAX) olarak güncellendi.';
          END;
        END;
      END;
    `);

    // 4. TODVZ_FOTOGRAF tablosu kontrolü
    console.log("4. TODVZ_FOTOGRAF tablosu kontrol ediliyor...");
    await pool.request().batch(`
      IF OBJECT_ID('dbo.TODVZ_FOTOGRAF', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[TODVZ_FOTOGRAF] (
          [FOTOGRAF_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [URUN_TIPI] TINYINT NOT NULL DEFAULT 0,
          [URUN_ID] INT NOT NULL DEFAULT 0,
          [FOTOGRAF_DATA] VARBINARY(MAX) NOT NULL,
          [DOSYA_ADI] VARCHAR(255) NULL,
          [MIME_TIPI] VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
          [VARSAYILAN] BIT NOT NULL DEFAULT 1,
          [EKLEYEN_ID] INT NULL,
          [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE()
        );
        PRINT 'TODVZ_FOTOGRAF tablosu oluşturuldu.';
      END;
    `);

    // 5. Disk üzerindeki dosyaları TODVZ_URUN_RESIM.RESIM_DATA içerisine aktarma
    console.log("5. Disk üzerindeki resimler taranıyor ve SQL veritabanına aktarılıyor...");
    const missingResimler = await pool.request().query(`
      SELECT RESIM_ID, DOSYA_YOLU FROM dbo.TODVZ_URUN_RESIM
      WHERE RESIM_DATA IS NULL AND DOSYA_YOLU IS NOT NULL AND LTRIM(RTRIM(DOSYA_YOLU)) <> ''
    `);

    let aktarilanSayisi = 0;
    for (const row of missingResimler.recordset || []) {
      try {
        const localPath = await resimDiskYolu(row.DOSYA_YOLU);
        if (localPath && fs.existsSync(localPath)) {
          const buf = fs.readFileSync(localPath);
          const upReq = pool.request();
          upReq.input("RESIM_ID", sql.Int, row.RESIM_ID);
          upReq.input("RESIM_DATA", sql.VarBinary(sql.MAX), buf);
          upReq.input("DOSYA_BOYUTU", sql.Int, buf.length);
          await upReq.query(`
            UPDATE dbo.TODVZ_URUN_RESIM
            SET RESIM_DATA = @RESIM_DATA,
                DOSYA_BOYUTU = ISNULL(DOSYA_BOYUTU, @DOSYA_BOYUTU)
            WHERE RESIM_ID = @RESIM_ID
          `);
          aktarilanSayisi++;
        }
      } catch (err: any) {
        logger.warn(`Resim aktarılamadı (ID ${row.RESIM_ID}): ${err.message}`);
      }
    }
    console.log(`Diskten SQL'e aktarılan resim sayısı: ${aktarilanSayisi}`);

    // 6. TODVZ_ALTIN_URUN tablosundaki eksik resimleri TODVZ_URUN_RESIM tablosundan senkronize etme
    console.log("6. TODVZ_ALTIN_URUN eksik resimleri TODVZ_URUN_RESIM üzerinden senkronize ediliyor...");
    await pool.request().query(`
      UPDATE u
      SET u.RESIM = r.RESIM_DATA
      FROM dbo.TODVZ_ALTIN_URUN u
      CROSS APPLY (
        SELECT TOP 1 RESIM_DATA 
        FROM dbo.TODVZ_URUN_RESIM 
        WHERE TIP = 0 AND ISLEM_ID = u.ALTIN_URUN_ID AND RESIM_DATA IS NOT NULL
        ORDER BY RESIM_ID ASC
      ) r
      WHERE u.RESIM IS NULL;
    `);

    // 7. TODVZ_OZEL_URUN tablosundaki eksik resimleri TODVZ_URUN_RESIM tablosundan senkronize etme
    console.log("7. TODVZ_OZEL_URUN eksik resimleri TODVZ_URUN_RESIM üzerinden senkronize ediliyor...");
    await pool.request().query(`
      UPDATE o
      SET o.RESIM = r.RESIM_DATA
      FROM dbo.TODVZ_OZEL_URUN o
      CROSS APPLY (
        SELECT TOP 1 RESIM_DATA 
        FROM dbo.TODVZ_URUN_RESIM 
        WHERE TIP = 1 AND ISLEM_ID = o.OZEL_URUN_ID AND RESIM_DATA IS NOT NULL
        ORDER BY RESIM_ID ASC
      ) r
      WHERE o.RESIM IS NULL;
    `);

    console.log("=== RESİM DOĞRUDAN SQL SAKLAMA MİGRASYONU BAŞARIYLA TAMAMLANDI ===");
  } catch (error: any) {
    console.error("Migration Hatası:", error);
    throw error;
  }
}

runResimSqlSaklamaMigration()
  .then(() => {
    console.log("Göç tamamlandı.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Migration başarısız:", e);
    process.exit(1);
  });

