import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
const mapRow = (r) => {
    let satirlar = [];
    try {
        const parsed = JSON.parse(r.PAYLOAD_JSON || "{}");
        if (Array.isArray(parsed?.satirlar))
            satirlar = parsed.satirlar;
    }
    catch {
        satirlar = [];
    }
    return {
        onayId: Number(r.ONAY_ID),
        talepEdenId: Number(r.TALEP_EDEN_ID),
        talepEdenAd: String(r.TALEP_EDEN_AD || "").trim(),
        talepEdenVezneId: r.TALEP_EDEN_VEZNE_ID != null ? Number(r.TALEP_EDEN_VEZNE_ID) : null,
        onayVezneId: Number(r.ONAY_VEZNE_ID),
        onayVezneAd: r.ONAY_VEZNE_AD ? String(r.ONAY_VEZNE_AD).trim() : undefined,
        islemTipi: String(r.ISLEM_TIPI || "KAYIT").toUpperCase() === "DUZELTME" ? "DUZELTME" : "KAYIT",
        transferId: r.TRANSFER_ID != null ? Number(r.TRANSFER_ID) : null,
        alanVezneId: Number(r.ALAN_VEZNE_ID),
        alanVezneAd: String(r.ALAN_VEZNE_AD || "").trim(),
        verenVezneId: Number(r.VEREN_VEZNE_ID),
        verenVezneAd: String(r.VEREN_VEZNE_AD || "").trim(),
        tarih: String(r.TARIH || ""),
        aciklama: String(r.ACIKLAMA || ""),
        payloadJson: String(r.PAYLOAD_JSON || "{}"),
        satirlar,
        durum: String(r.DURUM || "BEKLIYOR").toUpperCase(),
        kararVerenId: r.KARAR_VEREN_ID != null ? Number(r.KARAR_VEREN_ID) : null,
        kararVerenAd: r.KARAR_VEREN_AD ? String(r.KARAR_VEREN_AD).trim() : null,
        kararNotu: r.KARAR_NOTU ? String(r.KARAR_NOTU).trim() : null,
        olusturmaZamani: r.OLUSTURMA_ZAMANI ? new Date(r.OLUSTURMA_ZAMANI).toISOString() : new Date().toISOString(),
        kararZamani: r.KARAR_ZAMANI ? new Date(r.KARAR_ZAMANI).toISOString() : null,
    };
};
export class VezneTransferOnaySqlRepository {
    static async ensureTable(pool) {
        try {
            await pool.request().query(`
        IF OBJECT_ID('dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_VEZNE_TRANSFER_ONAY_TALEP] (
            [ONAY_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [TALEP_EDEN_ID] INT NOT NULL,
            [TALEP_EDEN_AD] VARCHAR(150) NOT NULL,
            [TALEP_EDEN_VEZNE_ID] INT NULL,
            [ONAY_VEZNE_ID] INT NOT NULL,
            [ISLEM_TIPI] VARCHAR(20) NOT NULL DEFAULT 'KAYIT',
            [TRANSFER_ID] INT NULL,
            [ALAN_VEZNE_ID] INT NOT NULL,
            [ALAN_VEZNE_AD] VARCHAR(150) NULL,
            [VEREN_VEZNE_ID] INT NOT NULL,
            [VEREN_VEZNE_AD] VARCHAR(150) NULL,
            [TARIH] VARCHAR(20) NOT NULL,
            [ACIKLAMA] VARCHAR(300) NULL,
            [PAYLOAD_JSON] NVARCHAR(MAX) NOT NULL,
            [DURUM] VARCHAR(20) NOT NULL DEFAULT 'BEKLIYOR',
            [KARAR_VEREN_ID] INT NULL,
            [KARAR_VEREN_AD] VARCHAR(150) NULL,
            [KARAR_NOTU] VARCHAR(300) NULL,
            [OLUSTURMA_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [KARAR_ZAMANI] DATETIME NULL,
            [TALEP_EDEN_GORDU] BIT NOT NULL CONSTRAINT DF_TODVZ_VEZNE_TRANSFER_ONAY_TALEP_GORDU DEFAULT 0
          );
        END;
        IF COL_LENGTH('dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP', 'TALEP_EDEN_GORDU') IS NULL
        BEGIN
          ALTER TABLE dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP ADD [TALEP_EDEN_GORDU] BIT NOT NULL CONSTRAINT DF_TODVZ_VEZNE_TRANSFER_ONAY_TALEP_GORDU DEFAULT 0;
        END;
      `);
        }
        catch (err) {
            logger.warn("[VezneTransferOnaySqlRepository.ensureTable] Warning:", err?.message || err);
        }
    }
    static async createRequest(input, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTable(pool);
        const vezneRes = await pool
            .request()
            .input("ALAN_ID", sql.Int, input.alanVezneId)
            .input("VEREN_ID", sql.Int, input.verenVezneId)
            .input("ONAY_ID_V", sql.Int, input.onayVezneId)
            .query(`
        SELECT VEZNE_ID, RTRIM(ISNULL(KOD,'')) AS KOD, RTRIM(ISNULL(AD,'')) AS AD
        FROM dbo.TODVZ_VEZNE
        WHERE VEZNE_ID IN (@ALAN_ID, @VEREN_ID, @ONAY_ID_V)
      `);
        const vMap = new Map();
        for (const row of vezneRes.recordset || []) {
            const label = row.KOD ? `${row.KOD} - ${row.AD}` : row.AD;
            vMap.set(Number(row.VEZNE_ID), label || `Vezne #${row.VEZNE_ID}`);
        }
        const req = pool.request();
        req.input("TALEP_EDEN_ID", sql.Int, input.talepEdenId);
        req.input("TALEP_EDEN_AD", sql.VarChar(150), input.talepEdenAd.slice(0, 150));
        req.input("TALEP_EDEN_VEZNE_ID", sql.Int, input.talepEdenVezneId);
        req.input("ONAY_VEZNE_ID", sql.Int, input.onayVezneId);
        req.input("ISLEM_TIPI", sql.VarChar(20), input.islemTipi);
        req.input("TRANSFER_ID", sql.Int, input.transferId);
        req.input("ALAN_VEZNE_ID", sql.Int, input.alanVezneId);
        req.input("ALAN_VEZNE_AD", sql.VarChar(150), (vMap.get(input.alanVezneId) || `Vezne #${input.alanVezneId}`).slice(0, 150));
        req.input("VEREN_VEZNE_ID", sql.Int, input.verenVezneId);
        req.input("VEREN_VEZNE_AD", sql.VarChar(150), (vMap.get(input.verenVezneId) || `Vezne #${input.verenVezneId}`).slice(0, 150));
        req.input("TARIH", sql.VarChar(20), input.tarih.slice(0, 20));
        req.input("ACIKLAMA", sql.VarChar(300), (input.aciklama || "").slice(0, 300));
        req.input("PAYLOAD_JSON", sql.NVarChar(sql.MAX), input.payloadJson);
        const res = await req.query(`
      INSERT INTO dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP (
        TALEP_EDEN_ID, TALEP_EDEN_AD, TALEP_EDEN_VEZNE_ID, ONAY_VEZNE_ID,
        ISLEM_TIPI, TRANSFER_ID, ALAN_VEZNE_ID, ALAN_VEZNE_AD,
        VEREN_VEZNE_ID, VEREN_VEZNE_AD, TARIH, ACIKLAMA, PAYLOAD_JSON, DURUM
      )
      OUTPUT INSERTED.*
      VALUES (
        @TALEP_EDEN_ID, @TALEP_EDEN_AD, @TALEP_EDEN_VEZNE_ID, @ONAY_VEZNE_ID,
        @ISLEM_TIPI, @TRANSFER_ID, @ALAN_VEZNE_ID, @ALAN_VEZNE_AD,
        @VEREN_VEZNE_ID, @VEREN_VEZNE_AD, @TARIH, @ACIKLAMA, @PAYLOAD_JSON, 'BEKLIYOR'
      );
    `);
        const rec = mapRow(res.recordset[0]);
        rec.onayVezneAd = vMap.get(input.onayVezneId) || `Vezne #${input.onayVezneId}`;
        return rec;
    }
    static async listPendingForVezne(onayVezneId, excludeUserId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTable(pool);
        const res = await pool
            .request()
            .input("ONAY_VEZNE_ID", sql.Int, onayVezneId)
            .input("EXCLUDE_UID", sql.Int, excludeUserId)
            .query(`
        SELECT TOP 20 O.*,
          RTRIM(ISNULL(V.KOD,'')) + CASE WHEN ISNULL(V.AD,'') <> '' THEN ' - ' + RTRIM(V.AD) ELSE '' END AS ONAY_VEZNE_AD
        FROM dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP O
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID = O.ONAY_VEZNE_ID
        WHERE O.DURUM = 'BEKLIYOR'
          AND O.ONAY_VEZNE_ID = @ONAY_VEZNE_ID
          AND O.TALEP_EDEN_ID <> @EXCLUDE_UID
        ORDER BY O.ONAY_ID ASC
      `);
        return (res.recordset || []).map(mapRow);
    }
    static async getById(onayId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTable(pool);
        const res = await pool
            .request()
            .input("ONAY_ID", sql.Int, onayId)
            .query(`
        SELECT O.*,
          RTRIM(ISNULL(V.KOD,'')) + CASE WHEN ISNULL(V.AD,'') <> '' THEN ' - ' + RTRIM(V.AD) ELSE '' END AS ONAY_VEZNE_AD
        FROM dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP O
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID = O.ONAY_VEZNE_ID
        WHERE O.ONAY_ID = @ONAY_ID
      `);
        if (!res.recordset || res.recordset.length === 0)
            return null;
        return mapRow(res.recordset[0]);
    }
    static async updateDecision(onayId, karar, kararVerenId, kararVerenAd, transferId, kararNotu, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTable(pool);
        const res = await pool
            .request()
            .input("ONAY_ID", sql.Int, onayId)
            .input("DURUM", sql.VarChar(20), karar)
            .input("KARAR_VEREN_ID", sql.Int, kararVerenId)
            .input("KARAR_VEREN_AD", sql.VarChar(150), (kararVerenAd || "").slice(0, 150))
            .input("TRANSFER_ID", sql.Int, transferId)
            .input("KARAR_NOTU", sql.VarChar(300), (kararNotu || "").slice(0, 300) || null)
            .query(`
        UPDATE dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP
        SET
          DURUM = @DURUM,
          KARAR_VEREN_ID = @KARAR_VEREN_ID,
          KARAR_VEREN_AD = @KARAR_VEREN_AD,
          TRANSFER_ID = COALESCE(@TRANSFER_ID, TRANSFER_ID),
          KARAR_NOTU = @KARAR_NOTU,
          KARAR_ZAMANI = GETDATE()
        WHERE ONAY_ID = @ONAY_ID AND DURUM = 'BEKLIYOR';

        SELECT O.*,
          RTRIM(ISNULL(V.KOD,'')) + CASE WHEN ISNULL(V.AD,'') <> '' THEN ' - ' + RTRIM(V.AD) ELSE '' END AS ONAY_VEZNE_AD
        FROM dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP O
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID = O.ONAY_VEZNE_ID
        WHERE O.ONAY_ID = @ONAY_ID;
      `);
        if (!res.recordset || res.recordset.length === 0)
            return null;
        return mapRow(res.recordset[0]);
    }
    static async listUnseenResultsForRequester(talepEdenId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTable(pool);
        const res = await pool
            .request()
            .input("TALEP_EDEN_ID", sql.Int, talepEdenId)
            .query(`
        SELECT TOP 20 O.*,
          RTRIM(ISNULL(V.KOD,'')) + CASE WHEN ISNULL(V.AD,'') <> '' THEN ' - ' + RTRIM(V.AD) ELSE '' END AS ONAY_VEZNE_AD
        FROM dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP O
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID = O.ONAY_VEZNE_ID
        WHERE O.TALEP_EDEN_ID = @TALEP_EDEN_ID
          AND O.DURUM IN ('ONAYLANDI', 'REDDEDILDI')
          AND ISNULL(O.TALEP_EDEN_GORDU, 0) = 0
        ORDER BY O.KARAR_ZAMANI ASC, O.ONAY_ID ASC
      `);
        return (res.recordset || []).map(mapRow);
    }
    static async markSeenByRequester(onayId, talepEdenId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTable(pool);
        await pool
            .request()
            .input("ONAY_ID", sql.Int, onayId)
            .input("TALEP_EDEN_ID", sql.Int, talepEdenId)
            .query(`
        UPDATE dbo.TODVZ_VEZNE_TRANSFER_ONAY_TALEP
        SET TALEP_EDEN_GORDU = 1
        WHERE ONAY_ID = @ONAY_ID AND TALEP_EDEN_ID = @TALEP_EDEN_ID
      `);
    }
}
