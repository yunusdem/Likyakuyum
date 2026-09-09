import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { ParaSqlRepository } from "./paraSql.repository.js";
export class BanknotSqlRepository {
    /**
     * Ensures TODVZ_BANKNOT table exists in the database
     */
    static async ensureTableExists(pool) {
        const script = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_BANKNOT')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_BANKNOT] (
          [PARA_ID] INT NOT NULL,
          [BANKNOT_ID] INT NOT NULL,
          [MIKTAR] FLOAT NOT NULL DEFAULT 0,
          CONSTRAINT [PK_TODVZ_BANKNOT] PRIMARY KEY CLUSTERED ([PARA_ID] ASC, [BANKNOT_ID] ASC)
        );
      END
    `;
        try {
            await pool.request().batch(script);
        }
        catch (err) {
            logger.warn("BanknotSqlRepository.ensureTableExists warning:", err);
        }
    }
    /**
     * Default banknot denominations for common currencies if none are configured yet
     */
    static getDefaultDenominations(code) {
        const clean = code.trim().toUpperCase();
        if (["TL", "TRY", "TRL", "YTL", "TURK LIRASI", "TÜRK LİRASI"].includes(clean)) {
            return [200, 100, 50, 20, 10, 5, 1];
        }
        if (["USD", "DOLAR"].includes(clean)) {
            return [100, 50, 20, 10, 5, 2, 1];
        }
        if (["EUR", "EURO"].includes(clean)) {
            return [500, 200, 100, 50, 20, 10, 5];
        }
        if (["GBP", "STERLIN"].includes(clean)) {
            return [50, 20, 10, 5];
        }
        if (["CHF"].includes(clean)) {
            return [1000, 200, 100, 50, 20, 10];
        }
        if (["CAD", "AUD"].includes(clean)) {
            return [100, 50, 20, 10, 5];
        }
        if (["SAR"].includes(clean)) {
            return [500, 100, 50, 20, 10, 5, 1];
        }
        return [100, 50, 20, 10, 5, 1];
    }
    /**
     * Retrieves all currencies with their current banknot count
     */
    static async getCurrencies(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTableExists(pool);
        const query = `
      SELECT 
        P.[PARA_ID] as id,
        LTRIM(RTRIM(ISNULL(P.[KOD], ''))) as kod,
        LTRIM(RTRIM(ISNULL(P.[AD], ''))) as ad,
        ISNULL(P.[SIRA_NO], 999) as siraNo,
        COUNT(B.[BANKNOT_ID]) as banknotSayisi
      FROM [dbo].[TODVZ_PARA] P
      LEFT JOIN [dbo].[TODVZ_BANKNOT] B ON P.[PARA_ID] = B.[PARA_ID]
      GROUP BY P.[PARA_ID], P.[KOD], P.[AD], P.[SIRA_NO]
      ORDER BY ISNULL(P.[SIRA_NO], 999) ASC, P.[PARA_ID] ASC
    `;
        const res = await pool.request().query(query);
        return res.recordset.map((r) => ({
            id: r.id,
            kod: r.kod || "",
            ad: r.ad || r.kod || "",
            siraNo: r.siraNo,
            banknotSayisi: Number(r.banknotSayisi) || 0,
        }));
    }
    /**
     * Adds or finds a currency in TODVZ_PARA
     */
    static async createCurrency(kod, ad, dbContext) {
        const cleanKod = (kod || "").trim().toUpperCase().slice(0, 5);
        const cleanAd = (ad || "").trim().slice(0, 200);
        if (!cleanKod || !cleanAd) {
            throw ApiError.badRequest("Para kodu ve adı gereklidir.");
        }
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        // 1. Check if currency already exists in TODVZ_PARA
        const existing = await pool
            .request()
            .input("kod", sql.VarChar(5), cleanKod)
            .query(`
        SELECT TOP 1 [PARA_ID] as id, [KOD] as kod, [AD] as ad, ISNULL([SIRA_NO], 999) as siraNo
        FROM [dbo].[TODVZ_PARA]
        WHERE UPPER(LTRIM(RTRIM([KOD]))) = @kod
      `);
        if (existing.recordset.length > 0) {
            const existingId = existing.recordset[0].id;
            // If the currency already exists with this code, update its name so it reflects the user's input instead of an old name
            if (existing.recordset[0].ad !== cleanAd) {
                await pool
                    .request()
                    .input("id", sql.Int, existingId)
                    .input("ad", sql.VarChar(200), cleanAd)
                    .query("UPDATE [dbo].[TODVZ_PARA] SET [AD] = @ad WHERE [PARA_ID] = @id");
            }
            return {
                id: existingId,
                kod: existing.recordset[0].kod,
                ad: cleanAd,
                siraNo: existing.recordset[0].siraNo ?? 999,
                banknotSayisi: 0,
            };
        }
        // 2. Get next sira no
        const siraRes = await pool.request().query(`
      SELECT ISNULL(MAX([SIRA_NO]), 0) + 1 AS nextSira FROM [dbo].[TODVZ_PARA]
    `);
        const nextSira = siraRes.recordset[0]?.nextSira || 1;
        // 3. Create using official ParaSqlRepository to guarantee compliance with all SQL Server constraints (CKODVZ_PARA, etc.)
        const created = await ParaSqlRepository.create({
            kod: cleanKod,
            ad: cleanAd,
            urunTipi: 0,
            pariteIslemi: 0,
            siraNo: nextSira,
            dovizAlisHucreOrani: 1,
            dovizSatisHucreOrani: 1,
            efektifAlisHucreOrani: 1,
            efektifSatisHucreOrani: 1,
        }, dbContext);
        return {
            id: created.id,
            kod: created.kod,
            ad: created.ad,
            siraNo: created.siraNo,
            banknotSayisi: 0,
        };
    }
    /**
     * Retrieves all banknotes for a specific currency (PARA_ID)
     */
    static async getBanknotlarByParaId(paraId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTableExists(pool);
        const query = `
      SELECT 
        [PARA_ID] as paraId,
        [BANKNOT_ID] as banknotId,
        [MIKTAR] as miktar
      FROM [dbo].[TODVZ_BANKNOT]
      WHERE [PARA_ID] = @paraId
      ORDER BY [BANKNOT_ID] ASC
    `;
        const res = await pool.request().input("paraId", sql.Int, paraId).query(query);
        // If records exist in DB, return them
        if (res.recordset.length > 0) {
            return res.recordset.map((r) => ({
                paraId: r.paraId,
                banknotId: r.banknotId,
                miktar: Number(r.miktar) || 0,
            }));
        }
        // If no banknot records exist yet, generate default suggestions based on currency code
        const paraRes = await pool
            .request()
            .input("paraId", sql.Int, paraId)
            .query("SELECT [KOD], [AD] FROM [dbo].[TODVZ_PARA] WHERE [PARA_ID] = @paraId");
        const currencyCode = paraRes.recordset[0]?.KOD || "";
        const defaults = this.getDefaultDenominations(currencyCode);
        return defaults.map((amount, idx) => ({
            paraId,
            banknotId: idx + 1,
            miktar: amount,
        }));
    }
    /**
     * Atomically saves or updates all banknotes for a specific currency (PARA_ID)
     */
    static async saveBanknotlar(paraId, banknotlar, dbContext) {
        if (!paraId || paraId <= 0) {
            throw ApiError.badRequest("Geçerli bir Para Birimi (PARA_ID) seçilmelidir.");
        }
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTableExists(pool);
        // Sanitize and filter out zero/negative values, sort descending by denomination
        const cleanList = (banknotlar || [])
            .filter((b) => b && Number(b.miktar) > 0)
            .sort((a, b) => Number(b.miktar) - Number(a.miktar))
            .map((b, idx) => ({
            paraId,
            banknotId: b.banknotId && b.banknotId > 0 ? b.banknotId : idx + 1,
            miktar: Number(b.miktar) || 0,
        }));
        // Re-index banknotId sequentially 1..N
        cleanList.forEach((item, index) => {
            item.banknotId = index + 1;
        });
        // Detect if BANKNOT_ID is an identity column in TODVZ_BANKNOT
        let isIdentity = false;
        try {
            const colCheck = await pool.request().query(`
        SELECT is_identity 
        FROM sys.columns 
        WHERE object_id = OBJECT_ID('[dbo].[TODVZ_BANKNOT]') AND name = 'BANKNOT_ID'
      `);
            if (colCheck.recordset.length > 0) {
                isIdentity = Boolean(colCheck.recordset[0].is_identity);
            }
        }
        catch (e) {
            logger.warn("Could not check is_identity on TODVZ_BANKNOT:", e);
        }
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            // 1. Delete existing banknotes for this currency
            const deleteReq = new sql.Request(transaction);
            deleteReq.input("paraId", sql.Int, paraId);
            await deleteReq.query("DELETE FROM [dbo].[TODVZ_BANKNOT] WHERE [PARA_ID] = @paraId");
            // 2. Insert sanitized banknotes (handling IDENTITY columns seamlessly)
            for (const item of cleanList) {
                const insertReq = new sql.Request(transaction);
                insertReq.input("paraId", sql.Int, paraId);
                insertReq.input("miktar", sql.Float, item.miktar);
                if (isIdentity) {
                    const inserted = await insertReq.query(`
            INSERT INTO [dbo].[TODVZ_BANKNOT] ([PARA_ID], [MIKTAR])
            OUTPUT INSERTED.BANKNOT_ID as banknotId
            VALUES (@paraId, @miktar)
          `);
                    if (inserted.recordset[0]?.banknotId) {
                        item.banknotId = inserted.recordset[0].banknotId;
                    }
                }
                else {
                    insertReq.input("banknotId", sql.Int, item.banknotId);
                    try {
                        await insertReq.query(`
              INSERT INTO [dbo].[TODVZ_BANKNOT] ([PARA_ID], [BANKNOT_ID], [MIKTAR])
              VALUES (@paraId, @banknotId, @miktar)
            `);
                    }
                    catch (insertErr) {
                        if (insertErr?.message?.includes("IDENTITY_INSERT") ||
                            insertErr?.message?.includes("identity column")) {
                            isIdentity = true;
                            const inserted = await insertReq.query(`
                INSERT INTO [dbo].[TODVZ_BANKNOT] ([PARA_ID], [MIKTAR])
                OUTPUT INSERTED.BANKNOT_ID as banknotId
                VALUES (@paraId, @miktar)
              `);
                            if (inserted.recordset[0]?.banknotId) {
                                item.banknotId = inserted.recordset[0].banknotId;
                            }
                        }
                        else {
                            throw insertErr;
                        }
                    }
                }
            }
            await transaction.commit();
            return cleanList;
        }
        catch (err) {
            await transaction.rollback();
            logger.error(`BanknotSqlRepository.saveBanknotlar(${paraId}) error:`, err);
            throw err;
        }
    }
    /**
     * Deletes all banknotes for a currency (PARA_ID)
     */
    static async deleteBanknotlar(paraId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTableExists(pool);
        const res = await pool
            .request()
            .input("paraId", sql.Int, paraId)
            .query("DELETE FROM [dbo].[TODVZ_BANKNOT] WHERE [PARA_ID] = @paraId");
        return (res.rowsAffected[0] || 0) >= 0;
    }
    /**
     * Deletes a currency completely (both TODVZ_BANKNOT and TODVZ_PARA)
     */
    static async deleteCurrency(paraId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTableExists(pool);
        // 1. Check if currency is assigned to any Vezne
        try {
            const vezneCheck = await pool
                .request()
                .input("paraId", sql.Int, paraId)
                .query("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_VEZNE] WHERE [PARA_ID] = @paraId");
            if (vezneCheck.recordset[0]?.COUNT > 0) {
                throw ApiError.badRequest("Bu para birimine bağlı vezne tanımları bulunmaktadır. Önce ilgili veznelerdeki para birimini değiştiriniz.");
            }
        }
        catch (e) {
            if (e?.statusCode)
                throw e;
        }
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            // 2. Delete all banknotes from TODVZ_BANKNOT for this currency
            await new sql.Request(transaction)
                .input("paraId", sql.Int, paraId)
                .query("DELETE FROM [dbo].[TODVZ_BANKNOT] WHERE [PARA_ID] = @paraId");
            // 3. Delete the currency from TODVZ_PARA
            const delRes = await new sql.Request(transaction)
                .input("paraId", sql.Int, paraId)
                .query("DELETE FROM [dbo].[TODVZ_PARA] WHERE [PARA_ID] = @paraId");
            await transaction.commit();
            return (delRes.rowsAffected[0] || 0) > 0;
        }
        catch (err) {
            await transaction.rollback();
            logger.error(`BanknotSqlRepository.deleteCurrency(${paraId}) error:`, err);
            throw err;
        }
    }
}
