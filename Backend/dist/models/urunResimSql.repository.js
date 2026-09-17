import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";
export class UrunResimSqlRepository {
    static async ensureTables(pool) {
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
            // Ensure uploads folder exists on disk as secondary storage
            const uploadDir = path.join(process.cwd(), "uploads", "urunler");
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
        }
        catch (err) {
            logger.warn(`[UrunResimSqlRepository.ensureTables] Warning: ${err.message}`);
        }
    }
    static async saveResimFile(base64Data, originalName = "urun.jpg", tip = 0, islemId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const uploadDir = path.join(process.cwd(), "uploads", "urunler");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        // Strip base64 header if present
        const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Clean, "base64");
        const ext = path.extname(originalName) || ".jpg";
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        const filePath = path.join(uploadDir, uniqueName);
        const publicUrl = `/uploads/urunler/${uniqueName}`;
        try {
            await fs.promises.writeFile(filePath, buffer);
        }
        catch {
            // Diske yazma opsiyoneldir, asıl kaynak veritabanıdır
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
    static async linkResimToIslem(dosyaYolu, tip, islemId, dbContext) {
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
        }
        catch (err) {
            logger.warn(`[UrunResimSqlRepository.linkResimToIslem] Warning: ${err.message}`);
        }
    }
    static async getResimlerByIslemId(tip, islemId, dbContext) {
        if (!islemId)
            return [];
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
            return (result.recordset || [])
                .map((r) => {
                if (r.RESIM_DATA && Buffer.isBuffer(r.RESIM_DATA)) {
                    return `data:image/jpeg;base64,${r.RESIM_DATA.toString("base64")}`;
                }
                if (r.DOSYA_YOLU && typeof r.DOSYA_YOLU === "string") {
                    // Eğer diskte varsa oku ve base64 yap
                    try {
                        const cleanRel = r.DOSYA_YOLU.replace(/^\//, "");
                        const localPath = path.join(process.cwd(), cleanRel);
                        if (fs.existsSync(localPath)) {
                            const fBuf = fs.readFileSync(localPath);
                            return `data:image/jpeg;base64,${fBuf.toString("base64")}`;
                        }
                    }
                    catch {
                        // fallback
                    }
                    return r.DOSYA_YOLU;
                }
                return null;
            })
                .filter(Boolean);
        }
        catch (err) {
            logger.warn(`[UrunResimSqlRepository.getResimlerByIslemId] Warning: ${err.message}`);
            return [];
        }
    }
    static async syncResimlerForIslem(tip, islemId, resimler = [], dbContext) {
        if (!islemId || !Array.isArray(resimler))
            return [];
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await this.ensureTables(pool);
            // Clean existing links for this item
            const delReq = pool.request();
            delReq.input("TIP", sql.TinyInt, tip);
            delReq.input("ISLEM_ID", sql.Int, islemId);
            await delReq.query(`DELETE FROM [dbo].[TODVZ_URUN_RESIM] WHERE [TIP] = @TIP AND [ISLEM_ID] = @ISLEM_ID`);
            const finalUrls = [];
            for (let i = 0; i < resimler.length; i++) {
                const img = resimler[i];
                if (!img)
                    continue;
                if (img.startsWith("data:") || (img.length > 200 && !img.startsWith("/") && !img.startsWith("http"))) {
                    const saved = await this.saveResimFile(img, `urun_${tip}_${islemId}_${i + 1}.jpg`, tip, islemId, dbContext);
                    finalUrls.push(saved.url);
                }
                else {
                    // Var olan relative veya url yolundan buffer bulmaya çalış
                    let buffer = null;
                    try {
                        const cleanRel = img.replace(/^\//, "");
                        const localPath = path.join(process.cwd(), cleanRel);
                        if (fs.existsSync(localPath)) {
                            buffer = fs.readFileSync(localPath);
                        }
                    }
                    catch {
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
                    }
                    else {
                        finalUrls.push(img);
                    }
                }
            }
            return finalUrls;
        }
        catch (err) {
            logger.warn(`[UrunResimSqlRepository.syncResimlerForIslem] Warning: ${err.message}`);
            return resimler;
        }
    }
}
