import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
export class PosCihaziSqlRepository {
    static async ensureTables(pool) {
        try {
            const ddl = `
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.TODVZ_POS_CIHAZI') AND type in (N'U'))
        BEGIN
          CREATE TABLE dbo.TODVZ_POS_CIHAZI (
            POS_CIHAZI_ID INT IDENTITY(1,1) PRIMARY KEY,
            CARI_KART_ID INT NULL,
            KOD VARCHAR(50) NOT NULL,
            AD VARCHAR(150) NOT NULL,
            DEVIR FLOAT NOT NULL DEFAULT 0
          );
        END;
      `;
            await pool.request().batch(ddl);
        }
        catch (err) {
            logger.warn(`[PosCihaziSqlRepository.ensureTables] Warning: ${err.message}`);
        }
    }
    static async getAll(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const query = `
      SELECT 
        p.POS_CIHAZI_ID AS posCihaziId,
        p.CARI_KART_ID AS cariKartId,
        c.KOD AS cariKodu,
        c.AD AS cariUnvan,
        p.KOD AS kod,
        p.AD AS ad,
        ISNULL(p.DEVIR, 0) AS devir
      FROM dbo.TODVZ_POS_CIHAZI p
      LEFT JOIN dbo.TODVZ_CARI_KART c ON c.CARI_KART_ID = p.CARI_KART_ID
      ORDER BY p.KOD ASC
    `;
        const res = await pool.request().query(query);
        const list = res.recordset || [];
        // Her cihaz için bakiye al
        for (const item of list) {
            item.bakiye = await this.getBakiye(item.posCihaziId, dbContext);
        }
        return list;
    }
    static async getById(posCihaziId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const query = `
      SELECT 
        p.POS_CIHAZI_ID AS posCihaziId,
        p.CARI_KART_ID AS cariKartId,
        c.KOD AS cariKodu,
        c.AD AS cariUnvan,
        p.KOD AS kod,
        p.AD AS ad,
        ISNULL(p.DEVIR, 0) AS devir
      FROM dbo.TODVZ_POS_CIHAZI p
      LEFT JOIN dbo.TODVZ_CARI_KART c ON c.CARI_KART_ID = p.CARI_KART_ID
      WHERE p.POS_CIHAZI_ID = @POS_CIHAZI_ID
    `;
        const res = await pool.request().input("POS_CIHAZI_ID", sql.Int, posCihaziId).query(query);
        const item = res.recordset?.[0] || null;
        if (item) {
            item.bakiye = await this.getBakiye(item.posCihaziId, dbContext);
        }
        return item;
    }
    static async getBakiye(posCihaziId, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await this.ensureTables(pool);
            const req = pool.request();
            req.input("POS_CIHAZI_ID", sql.Int, posCihaziId);
            req.output("BAKIYE", sql.Float);
            const result = await req.execute("dbo.SODVZ_POS_CIHAZI_BAKIYEYI_SOYLE");
            return Number(result.output?.BAKIYE || 0);
        }
        catch (err) {
            logger.error("[PosCihaziSqlRepository.getBakiye] Error:", err);
            return 0;
        }
    }
    static async getNextPosKod(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const res = await pool.request().query("SELECT KOD FROM dbo.TODVZ_POS_CIHAZI WHERE KOD IS NOT NULL AND KOD <> ''");
        const records = res.recordset || [];
        let maxNum = 0;
        for (const r of records) {
            const match = String(r.KOD || "").match(/(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > maxNum)
                    maxNum = num;
            }
        }
        const nextNum = maxNum > 0 ? maxNum + 1 : records.length + 1;
        return `POS.${String(nextNum).padStart(2, "0")}`;
    }
    static async save(dto, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        let kodVal = (dto.kod || "").trim();
        if (!kodVal) {
            kodVal = await this.getNextPosKod(dbContext);
        }
        const targetId = dto.posCihaziId && Number(dto.posCihaziId) > 0 ? Number(dto.posCihaziId) : null;
        const req = pool.request();
        req.output("POS_CIHAZI_ID", sql.Int, targetId);
        req.input("CARI_KART_ID", sql.Int, dto.cariKartId ? Number(dto.cariKartId) : null);
        req.input("KOD", sql.VarChar(50), kodVal);
        req.input("AD", sql.VarChar(150), (dto.ad || "").trim());
        req.input("DEVIR", sql.Float, Number(dto.devir || 0));
        try {
            const result = await req.execute("dbo.SODVZ_POS_CIHAZI_KAYDET");
            const savedId = Number(result.output?.POS_CIHAZI_ID) || targetId;
            if (!savedId) {
                throw new Error("POS cihazı kaydedildi ancak ID alınamadı.");
            }
            const saved = await this.getById(savedId, dbContext);
            if (!saved)
                throw new Error("POS cihazı kaydedildi ancak okunamadı.");
            return saved;
        }
        catch (err) {
            logger.error("[PosCihaziSqlRepository.save] Error:", err);
            const rawMsg = err.originalError?.message || err.message || "";
            throw ApiError.badRequest(rawMsg || "POS cihazı kaydedilemedi.");
        }
    }
    static async delete(posCihaziId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const res = await pool.request()
            .input("POS_CIHAZI_ID", sql.Int, posCihaziId)
            .query("DELETE FROM dbo.TODVZ_POS_CIHAZI WHERE POS_CIHAZI_ID = @POS_CIHAZI_ID");
        return (res.rowsAffected?.[0] || 0) > 0;
    }
}
