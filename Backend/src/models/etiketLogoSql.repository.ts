import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

// URUN_TIPI: 0: Altın, 1: Özel Ürün, 9: Etiket Sektörel Logo & Damga
export const ETIKET_LOGO_URUN_TIPI = 9;

export interface EtiketLogoModel {
  fotografId: number;
  urunTipi: number;
  urunId: number;
  dosyaAdi: string;
  mimeTipi: string;
  dataUrl: string;
  eklemeZamani?: string | null;
}

export class EtiketLogoSqlRepository {
  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_FOTOGRAF', 'U') IS NULL
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
        END
      `);
    } catch (err: any) {
      logger.warn(`[EtiketLogoSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  public static async listLogos(
    tip: number = ETIKET_LOGO_URUN_TIPI,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<EtiketLogoModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    const req = pool.request();
    req.input("URUN_TIPI", sql.TinyInt, tip);

    const result = await req.query(`
      SELECT 
        FOTOGRAF_ID,
        URUN_TIPI,
        URUN_ID,
        DOSYA_ADI,
        MIME_TIPI,
        FOTOGRAF_DATA,
        EKLEME_ZAMANI
      FROM [dbo].[TODVZ_FOTOGRAF]
      WHERE URUN_TIPI = @URUN_TIPI
      ORDER BY FOTOGRAF_ID DESC
    `);

    return result.recordset.map((row: any) => {
      let dataUrl = "";
      if (row.FOTOGRAF_DATA) {
        const mime = row.MIME_TIPI || "image/png";
        const base64 = Buffer.isBuffer(row.FOTOGRAF_DATA)
          ? row.FOTOGRAF_DATA.toString("base64")
          : Buffer.from(row.FOTOGRAF_DATA).toString("base64");
        dataUrl = `data:${mime};base64,${base64}`;
      }
      return {
        fotografId: row.FOTOGRAF_ID,
        urunTipi: row.URUN_TIPI,
        urunId: row.URUN_ID,
        dosyaAdi: row.DOSYA_ADI || "logo.png",
        mimeTipi: row.MIME_TIPI || "image/png",
        dataUrl,
        eklemeZamani: row.EKLEME_ZAMANI,
      };
    });
  }

  public static async saveLogo(
    data: { base64: string; dosyaAdi?: string; mimeTipi?: string },
    kullaniciId?: number,
    tip: number = ETIKET_LOGO_URUN_TIPI,
    urunId: number = 0,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<EtiketLogoModel> {
    if (!data.base64) {
      throw ApiError.badRequest("Fotoğraf verisi (base64) zorunludur.");
    }

    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    // Clean base64 and extract mime if present in data URL
    let mime = data.mimeTipi || "image/png";
    let base64Clean = data.base64;
    const match = data.base64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mime = match[1];
      base64Clean = match[2];
    }

    const buffer = Buffer.from(base64Clean, "base64");
    const dosyaAdi = data.dosyaAdi || "logo.png";

    try {
      // Try using stored procedure SODVZ_FOTOGRAF_KAYDET first
      const req = pool.request();
      req.output("FOTOGRAF_ID", sql.Int);
      req.input("URUN_TIPI", sql.TinyInt, tip);
      req.input("URUN_ID", sql.Int, urunId);
      req.input("FOTOGRAF_DATA", sql.VarBinary(sql.MAX), buffer);
      req.input("DOSYA_ADI", sql.VarChar(255), dosyaAdi);
      req.input("MIME_TIPI", sql.VarChar(50), mime);
      req.input("VARSAYILAN", sql.Bit, 1);
      req.input("KULLANICI_ID", sql.Int, kullaniciId || null);

      const spResult = await req.execute("dbo.SODVZ_FOTOGRAF_KAYDET");
      const fotografId = spResult.output.FOTOGRAF_ID || spResult.recordset?.[0]?.FOTOGRAF_ID;

      return {
        fotografId: Number(fotografId),
        urunTipi: tip,
        urunId,
        dosyaAdi,
        mimeTipi: mime,
        dataUrl: `data:${mime};base64,${base64Clean}`,
        eklemeZamani: new Date().toISOString(),
      };
    } catch (spErr: any) {
      logger.warn(`[EtiketLogoSqlRepository.saveLogo] SP error, falling back to INSERT: ${spErr.message}`);

      const req = pool.request();
      req.input("URUN_TIPI", sql.TinyInt, tip);
      req.input("URUN_ID", sql.Int, urunId);
      req.input("FOTOGRAF_DATA", sql.VarBinary(sql.MAX), buffer);
      req.input("DOSYA_ADI", sql.VarChar(255), dosyaAdi);
      req.input("MIME_TIPI", sql.VarChar(50), mime);
      req.input("VARSAYILAN", sql.Bit, 1);
      req.input("KULLANICI_ID", sql.Int, kullaniciId || null);

      const res = await req.query(`
        INSERT INTO [dbo].[TODVZ_FOTOGRAF] (
          [URUN_TIPI], [URUN_ID], [FOTOGRAF_DATA], [DOSYA_ADI], [MIME_TIPI], [VARSAYILAN], [EKLEYEN_ID], [EKLEME_ZAMANI]
        )
        OUTPUT INSERTED.FOTOGRAF_ID
        VALUES (
          @URUN_TIPI, @URUN_ID, @FOTOGRAF_DATA, @DOSYA_ADI, @MIME_TIPI, @VARSAYILAN, @KULLANICI_ID, GETDATE()
        );
      `);

      const fotografId = res.recordset[0]?.FOTOGRAF_ID;
      return {
        fotografId: Number(fotografId),
        urunTipi: tip,
        urunId,
        dosyaAdi,
        mimeTipi: mime,
        dataUrl: `data:${mime};base64,${base64Clean}`,
        eklemeZamani: new Date().toISOString(),
      };
    }
  }

  public static async deleteLogo(
    fotografId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    try {
      // Try using stored procedure SODVZ_FOTOGRAF_SIL
      const req = pool.request();
      req.input("FOTOGRAF_ID", sql.Int, fotografId);
      req.input("URUN_TIPI", sql.TinyInt, null);
      req.input("URUN_ID", sql.Int, null);
      await req.execute("dbo.SODVZ_FOTOGRAF_SIL");
      return true;
    } catch (spErr: any) {
      logger.warn(`[EtiketLogoSqlRepository.deleteLogo] SP error, falling back to direct DELETE: ${spErr.message}`);

      const req = pool.request();
      req.input("FOTOGRAF_ID", sql.Int, fotografId);
      await req.query(`DELETE FROM [dbo].[TODVZ_FOTOGRAF] WHERE FOTOGRAF_ID = @FOTOGRAF_ID`);
      return true;
    }
  }
}
