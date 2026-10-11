import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";
import { firmaKlasoru, firmaKoku, guvenliBirlestir, icindeMi } from "../services/firmaKlasoru.js";

/** Firma klasöründeki resimlerin DOSYA_YOLU ön eki (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K9) */
export const FIRMA_RESIM_ONEKI = "/firma/Resimler/";

/** DOSYA_YOLU → diskteki dosya. Yeni kayıtlar firma klasöründe, eskiler `uploads` altında kalır. */
export async function resimDiskYolu(dosyaYolu: string, dbContext?: { dbServer?: string; dbName?: string }): Promise<string | null> {
  if (dosyaYolu.startsWith(FIRMA_RESIM_ONEKI)) {
    const { yol } = await firmaKoku(dbContext);
    return guvenliBirlestir(yol, "Resimler", path.basename(dosyaYolu));
  }
  const uploads = path.join(process.cwd(), "uploads");
  const yerel = path.join(process.cwd(), dosyaYolu.replace(/^\//, ""));
  return icindeMi(uploads, yerel) ? yerel : null;
}

export interface UrunResimModel {
  resimId: number;
  tip: number; // 0: Altın, 1: Özel
  islemId?: number | null;
  dosyaAdi: string;
  dosyaYolu: string;
  dosyaBoyutu?: number | null;
  dosyaTipi?: string | null;
  resimData?: string | null;
  eklemeZamani: string;
}

export class UrunResimSqlRepository {
  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_URUN_RESIM', 'U') IS NULL
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
        END
        ELSE
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TODVZ_URUN_RESIM') AND name = 'RESIM_DATA')
          BEGIN
            ALTER TABLE [dbo].[TODVZ_URUN_RESIM] ADD [RESIM_DATA] VARBINARY(MAX) NULL;
          END;
        END;
      `);
    } catch (err: any) {
      logger.warn(`[UrunResimSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  public static async saveResimFile(
    base64Data: string,
    originalName: string = "urun.jpg",
    tip: number = 0,
    islemId?: number | null,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ resimId: number; url: string; dosyaYolu: string }> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    // Strip base64 header if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Clean, "base64");

    const ext = (path.extname(originalName) || ".jpg").replace(/[^.A-Za-z0-9]/g, "").slice(0, 10) || ".jpg";
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const publicUrl = `${FIRMA_RESIM_ONEKI}${uniqueName}`;

    try {
      const uploadDir = await firmaKlasoru(dbContext, "Resimler");
      await fs.promises.writeFile(path.join(uploadDir, uniqueName), buffer);
    } catch (err: any) {
      // Diske yazma opsiyoneldir, asıl kaynak veritabanıdır
      logger.warn(`[UrunResimSqlRepository.saveResimFile] Resim firma klasörüne yazılamadı: ${err?.message || err}`);
    }

    const fullDataUrl = `data:image/jpeg;base64,${base64Clean}`;

    const req = pool.request();
    req.input("TIP", sql.TinyInt, tip);
    req.input("ISLEM_ID", sql.Int, islemId || null);
    req.input("DOSYA_ADI", sql.VarChar(255), originalName.slice(0, 255));
    req.input("DOSYA_YOLU", sql.VarChar(500), publicUrl);
    req.input("DOSYA_BOYUTU", sql.Int, buffer.length);
    req.input("DOSYA_TIPI", sql.VarChar(50), ext.replace(".", ""));
    req.input("RESIM_DATA", sql.VarBinary(sql.MAX), buffer);

    const result = await req.query(`
      INSERT INTO [dbo].[TODVZ_URUN_RESIM] (
        [TIP], [ISLEM_ID], [DOSYA_ADI], [DOSYA_YOLU], [DOSYA_BOYUTU], [DOSYA_TIPI], [RESIM_DATA], [EKLEME_ZAMANI]
      )
      OUTPUT INSERTED.RESIM_ID
      VALUES (
        @TIP, @ISLEM_ID, @DOSYA_ADI, @DOSYA_YOLU, @DOSYA_BOYUTU, @DOSYA_TIPI, @RESIM_DATA, GETDATE()
      );
    `);

    const resimId = result.recordset[0]?.RESIM_ID || 0;
    return { resimId, url: fullDataUrl, dosyaYolu: publicUrl };
  }

  public static async linkResimToIslem(
    dosyaYolu: string,
    tip: number,
    islemId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<void> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      await this.ensureTables(pool);

      const req = pool.request();
      req.input("DOSYA_YOLU", sql.VarChar(500), dosyaYolu);
      req.input("TIP", sql.TinyInt, tip);
      req.input("ISLEM_ID", sql.Int, islemId);

      await req.query(`
        UPDATE [dbo].[TODVZ_URUN_RESIM]
        SET [ISLEM_ID] = @ISLEM_ID, [TIP] = @TIP
        WHERE [DOSYA_YOLU] = @DOSYA_YOLU;
      `);
    } catch (err: any) {
      logger.warn(`[UrunResimSqlRepository.linkResimToIslem] Warning: ${err.message}`);
    }
  }

  public static async getResimlerByIslemId(
    tip: number,
    islemId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<string[]> {
    if (!islemId) return [];
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      await this.ensureTables(pool);

      const req = pool.request();
      req.input("TIP", sql.TinyInt, tip);
      req.input("ISLEM_ID", sql.Int, islemId);

      const result = await req.query(`
        SELECT [DOSYA_YOLU], [RESIM_DATA] FROM [dbo].[TODVZ_URUN_RESIM]
        WHERE [TIP] = @TIP AND [ISLEM_ID] = @ISLEM_ID
        ORDER BY [RESIM_ID] ASC;
      `);

      const resimler = await Promise.all(
        (result.recordset || []).map(async (r: any) => {
          if (r.RESIM_DATA && Buffer.isBuffer(r.RESIM_DATA)) {
            return `data:image/jpeg;base64,${r.RESIM_DATA.toString("base64")}`;
          }
          if (r.DOSYA_YOLU && typeof r.DOSYA_YOLU === "string") {
            // Eğer diskte varsa oku ve base64 yap
            try {
              const localPath = await resimDiskYolu(r.DOSYA_YOLU, dbContext);
              if (localPath && fs.existsSync(localPath)) {
                const fBuf = fs.readFileSync(localPath);
                return `data:image/jpeg;base64,${fBuf.toString("base64")}`;
              }
            } catch {
              // fallback
            }
            return r.DOSYA_YOLU;
          }
          return null;
        })
      );
      return resimler.filter(Boolean) as string[];
    } catch (err: any) {
      logger.warn(`[UrunResimSqlRepository.getResimlerByIslemId] Warning: ${err.message}`);
      return [];
    }
  }

  public static async syncResimlerForIslem(
    tip: number,
    islemId: number,
    resimler: string[] = [],
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<string[]> {
    if (!islemId || !Array.isArray(resimler)) return [];
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      await this.ensureTables(pool);

      // Clean existing links for this item
      const delReq = pool.request();
      delReq.input("TIP", sql.TinyInt, tip);
      delReq.input("ISLEM_ID", sql.Int, islemId);
      await delReq.query(`DELETE FROM [dbo].[TODVZ_URUN_RESIM] WHERE [TIP] = @TIP AND [ISLEM_ID] = @ISLEM_ID`);

      const finalUrls: string[] = [];

      for (let i = 0; i < resimler.length; i++) {
        const img = resimler[i];
        if (!img) continue;

        if (img.startsWith("data:") || (img.length > 200 && !img.startsWith("/") && !img.startsWith("http"))) {
          const saved = await this.saveResimFile(img, `urun_${tip}_${islemId}_${i + 1}.jpg`, tip, islemId, dbContext);
          finalUrls.push(saved.url);
        } else {
          // Var olan relative veya url yolundan buffer bulmaya çalış
          let buffer: Buffer | null = null;
          try {
            const localPath = await resimDiskYolu(img, dbContext);
            if (localPath && fs.existsSync(localPath)) {
              buffer = fs.readFileSync(localPath);
            }
          } catch {
            // fallback
          }

          const insReq = pool.request();
          insReq.input("TIP", sql.TinyInt, tip);
          insReq.input("ISLEM_ID", sql.Int, islemId);
          insReq.input("DOSYA_ADI", sql.VarChar(255), path.basename(img) || `foto_${i + 1}.jpg`);
          insReq.input("DOSYA_YOLU", sql.VarChar(500), img.slice(0, 500));
          insReq.input("RESIM_DATA", sql.VarBinary(sql.MAX), buffer);

          await insReq.query(`
            INSERT INTO [dbo].[TODVZ_URUN_RESIM] ([TIP], [ISLEM_ID], [DOSYA_ADI], [DOSYA_YOLU], [RESIM_DATA], [EKLEME_ZAMANI])
            VALUES (@TIP, @ISLEM_ID, @DOSYA_ADI, @DOSYA_YOLU, @RESIM_DATA, GETDATE());
          `);

          if (buffer) {
            finalUrls.push(`data:image/jpeg;base64,${buffer.toString("base64")}`);
          } else {
            finalUrls.push(img);
          }
        }
      }
      return finalUrls;
    } catch (err: any) {
      logger.warn(`[UrunResimSqlRepository.syncResimlerForIslem] Warning: ${err.message}`);
      return resimler;
    }
  }
}

