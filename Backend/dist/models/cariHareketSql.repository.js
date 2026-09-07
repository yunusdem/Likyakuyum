import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
const HAREKET_TIPI_LABELS = {
    0: "Nakit",
    1: "Banka / Havale",
    2: "POS / Kredi Kartı",
    3: "Dekont",
    4: "Virman",
    5: "Devir",
};
export class CariHareketSqlRepository {
    /**
     * Automatically ensure tables TODVZ_CARI_HAREKET and TODVZ_CARI_HAREKET_SATIRI exist in the database.
     */
    static async ensureTablesExist(pool) {
        const checkQuery = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_CARI_HAREKET')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_CARI_HAREKET] (
          [CARI_HAREKET_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [CARI_KART_ID] INT NOT NULL,
          [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
          [HAREKET_TIPI] TINYINT NOT NULL DEFAULT 0,
          [ACIKLAMA] VARCHAR(100) NULL,
          [TIP] TINYINT NOT NULL DEFAULT 0,
          [EKLEYEN_ID] INT NOT NULL DEFAULT 1,
          [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
          [GUNCELLEYEN_ID] INT NOT NULL DEFAULT 1,
          [GUNCELLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
          [VEZNE_ID] INT NOT NULL DEFAULT 1,
          [POS_CIHAZI_ID] INT NULL
        );
      END

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_CARI_HAREKET_SATIRI')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_CARI_HAREKET_SATIRI] (
          [CARI_HAREKET_ID] INT NOT NULL,
          [SATIR_NO] INT NOT NULL,
          [PARA_ID] INT NOT NULL,
          [MEBLAG] FLOAT NOT NULL DEFAULT 0,
          CONSTRAINT [PK_TODVZ_CARI_HAREKET_SATIRI] PRIMARY KEY CLUSTERED ([CARI_HAREKET_ID] ASC, [SATIR_NO] ASC)
        );
      END
    `;
        try {
            await pool.request().query(checkQuery);
        }
        catch (err) {
            logger.warn("CariHareketSqlRepository.ensureTablesExist warning:", err);
        }
    }
    static formatIsoDate(d) {
        if (!d)
            return "";
        try {
            return new Date(d).toISOString();
        }
        catch {
            return "";
        }
    }
    static async findAll(filters, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await CariHareketSqlRepository.ensureTablesExist(pool);
            const request = pool.request();
            let whereClauses = ["1=1"];
            if (filters?.startDate) {
                request.input("startDate", sql.DateTime, new Date(filters.startDate));
                whereClauses.push("H.[TARIH] >= @startDate");
            }
            if (filters?.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                request.input("endDate", sql.DateTime, end);
                whereClauses.push("H.[TARIH] <= @endDate");
            }
            if (filters?.cariKartId) {
                request.input("cariKartId", sql.Int, Number(filters.cariKartId));
                whereClauses.push("H.[CARI_KART_ID] = @cariKartId");
            }
            if (filters?.vezneId) {
                request.input("vezneId", sql.Int, Number(filters.vezneId));
                whereClauses.push("H.[VEZNE_ID] = @vezneId");
            }
            if (filters?.tip !== undefined && filters?.tip !== null && String(filters?.tip) !== "-1") {
                request.input("tip", sql.TinyInt, Number(filters.tip));
                whereClauses.push("H.[TIP] = @tip");
            }
            if (filters?.hareketTipi !== undefined && filters?.hareketTipi !== null && String(filters?.hareketTipi) !== "-1") {
                request.input("hareketTipi", sql.TinyInt, Number(filters.hareketTipi));
                whereClauses.push("H.[HAREKET_TIPI] = @hareketTipi");
            }
            if (filters?.search && filters.search.trim()) {
                request.input("search", sql.VarChar(100), `%${filters.search.trim()}%`);
                whereClauses.push("(C.[KOD] LIKE @search OR C.[AD] LIKE @search OR H.[ACIKLAMA] LIKE @search OR V.[KOD] LIKE @search OR V.[AD] LIKE @search)");
            }
            const query = `
        SELECT 
          H.[CARI_HAREKET_ID],
          H.[CARI_KART_ID],
          H.[TARIH],
          H.[HAREKET_TIPI],
          H.[ACIKLAMA],
          H.[TIP],
          H.[EKLEYEN_ID],
          H.[EKLEME_ZAMANI],
          H.[GUNCELLEYEN_ID],
          H.[GUNCELLEME_ZAMANI],
          H.[VEZNE_ID],
          H.[POS_CIHAZI_ID],
          LTRIM(RTRIM(ISNULL(C.[KOD], ''))) AS [CARI_KOD],
          LTRIM(RTRIM(ISNULL(C.[AD], ''))) AS [CARI_AD],
          LTRIM(RTRIM(ISNULL(V.[KOD], ''))) AS [VEZNE_KOD],
          LTRIM(RTRIM(ISNULL(V.[AD], ''))) AS [VEZNE_AD]
        FROM [dbo].[TODVZ_CARI_HAREKET] H
        LEFT JOIN [dbo].[TODVZ_CARI_KART] C ON H.[CARI_KART_ID] = C.[CARI_KART_ID]
        LEFT JOIN [dbo].[TODVZ_VEZNE] V ON H.[VEZNE_ID] = V.[VEZNE_ID]
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY H.[TARIH] DESC, H.[CARI_HAREKET_ID] DESC;
      `;
            const result = await request.query(query);
            const headers = result.recordset || [];
            if (headers.length === 0)
                return [];
            // Fetch all lines for these transactions in one query for high efficiency
            const ids = headers.map((h) => h.CARI_HAREKET_ID);
            const linesQuery = `
        SELECT 
          S.[CARI_HAREKET_ID],
          S.[SATIR_NO],
          S.[PARA_ID],
          S.[MEBLAG],
          LTRIM(RTRIM(ISNULL(P.[KOD], ''))) AS [PARA_KOD],
          LTRIM(RTRIM(ISNULL(P.[AD], ''))) AS [PARA_AD],
          P.[HAS_ORANI]
        FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] S
        LEFT JOIN [dbo].[TODVZ_PARA] P ON S.[PARA_ID] = P.[PARA_ID]
        WHERE S.[CARI_HAREKET_ID] IN (${ids.join(",")})
        ORDER BY S.[CARI_HAREKET_ID] ASC, S.[SATIR_NO] ASC;
      `;
            const linesResult = await pool.request().query(linesQuery);
            const linesByHeaderId = new Map();
            for (const line of linesResult.recordset || []) {
                if (!linesByHeaderId.has(line.CARI_HAREKET_ID)) {
                    linesByHeaderId.set(line.CARI_HAREKET_ID, []);
                }
                linesByHeaderId.get(line.CARI_HAREKET_ID).push({
                    satirNo: line.SATIR_NO,
                    paraId: line.PARA_ID,
                    paraKodu: line.PARA_KOD || "",
                    paraAdi: line.PARA_AD || "",
                    meblag: line.MEBLAG || 0,
                    hasOrani: line.HAS_ORANI ?? 1,
                });
            }
            return headers.map((h) => {
                const lines = linesByHeaderId.get(h.CARI_HAREKET_ID) || [];
                const ozet = lines
                    .map((l) => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(l.meblag)} ${l.paraKodu}`)
                    .join(", ");
                return {
                    id: h.CARI_HAREKET_ID,
                    cariKartId: h.CARI_KART_ID,
                    cariKod: h.CARI_KOD || "",
                    cariAd: h.CARI_AD || "",
                    tarih: CariHareketSqlRepository.formatIsoDate(h.TARIH),
                    hareketTipi: h.HAREKET_TIPI,
                    hareketTipiLabel: HAREKET_TIPI_LABELS[h.HAREKET_TIPI] || "Diğer",
                    aciklama: (h.ACIKLAMA || "").trim(),
                    tip: h.TIP,
                    tipLabel: h.TIP === 0 ? "Borç" : "Alacak",
                    ekleyenId: h.EKLEYEN_ID,
                    eklemeZamani: CariHareketSqlRepository.formatIsoDate(h.EKLEME_ZAMANI),
                    guncelleyenId: h.GUNCELLEYEN_ID,
                    guncellemeZamani: CariHareketSqlRepository.formatIsoDate(h.GUNCELLEME_ZAMANI),
                    vezneId: h.VEZNE_ID,
                    vezneKod: h.VEZNE_KOD || "",
                    vezneAd: h.VEZNE_AD || "",
                    posCihaziId: h.POS_CIHAZI_ID ?? null,
                    satirlar: lines,
                    toplamSatirSayisi: lines.length,
                    satirlarOzet: ozet,
                };
            });
        }
        catch (error) {
            logger.error("CariHareketSqlRepository.findAll error:", error);
            throw error;
        }
    }
    static async findById(id, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await CariHareketSqlRepository.ensureTablesExist(pool);
            const request = pool.request();
            request.input("id", sql.Int, parseInt(String(id), 10));
            const query = `
        SELECT TOP 1
          H.[CARI_HAREKET_ID],
          H.[CARI_KART_ID],
          H.[TARIH],
          H.[HAREKET_TIPI],
          H.[ACIKLAMA],
          H.[TIP],
          H.[EKLEYEN_ID],
          H.[EKLEME_ZAMANI],
          H.[GUNCELLEYEN_ID],
          H.[GUNCELLEME_ZAMANI],
          H.[VEZNE_ID],
          H.[POS_CIHAZI_ID],
          LTRIM(RTRIM(ISNULL(C.[KOD], ''))) AS [CARI_KOD],
          LTRIM(RTRIM(ISNULL(C.[AD], ''))) AS [CARI_AD],
          LTRIM(RTRIM(ISNULL(V.[KOD], ''))) AS [VEZNE_KOD],
          LTRIM(RTRIM(ISNULL(V.[AD], ''))) AS [VEZNE_AD]
        FROM [dbo].[TODVZ_CARI_HAREKET] H
        LEFT JOIN [dbo].[TODVZ_CARI_KART] C ON H.[CARI_KART_ID] = C.[CARI_KART_ID]
        LEFT JOIN [dbo].[TODVZ_VEZNE] V ON H.[VEZNE_ID] = V.[VEZNE_ID]
        WHERE H.[CARI_HAREKET_ID] = @id;
      `;
            const result = await request.query(query);
            if (!result.recordset || result.recordset.length === 0)
                return null;
            const h = result.recordset[0];
            // Fetch lines
            const lineRequest = pool.request();
            lineRequest.input("id", sql.Int, h.CARI_HAREKET_ID);
            const linesResult = await lineRequest.query(`
        SELECT 
          S.[CARI_HAREKET_ID],
          S.[SATIR_NO],
          S.[PARA_ID],
          S.[MEBLAG],
          LTRIM(RTRIM(ISNULL(P.[KOD], ''))) AS [PARA_KOD],
          LTRIM(RTRIM(ISNULL(P.[AD], ''))) AS [PARA_AD],
          P.[HAS_ORANI]
        FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] S
        LEFT JOIN [dbo].[TODVZ_PARA] P ON S.[PARA_ID] = P.[PARA_ID]
        WHERE S.[CARI_HAREKET_ID] = @id
        ORDER BY S.[SATIR_NO] ASC;
      `);
            const lines = (linesResult.recordset || []).map((l) => ({
                satirNo: l.SATIR_NO,
                paraId: l.PARA_ID,
                paraKodu: l.PARA_KOD || "",
                paraAdi: l.PARA_AD || "",
                meblag: l.MEBLAG || 0,
                hasOrani: l.HAS_ORANI ?? 1,
            }));
            const ozet = lines
                .map((l) => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(l.meblag)} ${l.paraKodu}`)
                .join(", ");
            return {
                id: h.CARI_HAREKET_ID,
                cariKartId: h.CARI_KART_ID,
                cariKod: h.CARI_KOD || "",
                cariAd: h.CARI_AD || "",
                tarih: CariHareketSqlRepository.formatIsoDate(h.TARIH),
                hareketTipi: h.HAREKET_TIPI,
                hareketTipiLabel: HAREKET_TIPI_LABELS[h.HAREKET_TIPI] || "Diğer",
                aciklama: (h.ACIKLAMA || "").trim(),
                tip: h.TIP,
                tipLabel: h.TIP === 0 ? "Borç" : "Alacak",
                ekleyenId: h.EKLEYEN_ID,
                eklemeZamani: CariHareketSqlRepository.formatIsoDate(h.EKLEME_ZAMANI),
                guncelleyenId: h.GUNCELLEYEN_ID,
                guncellemeZamani: CariHareketSqlRepository.formatIsoDate(h.GUNCELLEME_ZAMANI),
                vezneId: h.VEZNE_ID,
                vezneKod: h.VEZNE_KOD || "",
                vezneAd: h.VEZNE_AD || "",
                posCihaziId: h.POS_CIHAZI_ID ?? null,
                satirlar: lines,
                toplamSatirSayisi: lines.length,
                satirlarOzet: ozet,
            };
        }
        catch (error) {
            logger.error(`CariHareketSqlRepository.findById(${id}) error:`, error);
            throw error;
        }
    }
    static async create(data, userId = 1, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await CariHareketSqlRepository.ensureTablesExist(pool);
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            const headerRequest = new sql.Request(transaction);
            headerRequest.input("CARI_KART_ID", sql.Int, data.cariKartId);
            headerRequest.input("TARIH", sql.DateTime, data.tarih ? new Date(data.tarih) : new Date());
            headerRequest.input("HAREKET_TIPI", sql.TinyInt, data.hareketTipi ?? 0);
            headerRequest.input("ACIKLAMA", sql.VarChar(100), (data.aciklama || "").trim().slice(0, 100));
            headerRequest.input("TIP", sql.TinyInt, data.tip ?? 0);
            headerRequest.input("EKLEYEN_ID", sql.Int, userId);
            headerRequest.input("GUNCELLEYEN_ID", sql.Int, userId);
            headerRequest.input("VEZNE_ID", sql.Int, data.vezneId);
            headerRequest.input("POS_CIHAZI_ID", sql.Int, data.posCihaziId || null);
            const insertHeaderQuery = `
        INSERT INTO [dbo].[TODVZ_CARI_HAREKET] (
          [CARI_KART_ID], [TARIH], [HAREKET_TIPI], [ACIKLAMA], [TIP],
          [EKLEYEN_ID], [EKLEME_ZAMANI], [GUNCELLEYEN_ID], [GUNCELLEME_ZAMANI],
          [VEZNE_ID], [POS_CIHAZI_ID]
        )
        VALUES (
          @CARI_KART_ID, @TARIH, @HAREKET_TIPI, @ACIKLAMA, @TIP,
          @EKLEYEN_ID, GETDATE(), @GUNCELLEYEN_ID, GETDATE(),
          @VEZNE_ID, @POS_CIHAZI_ID
        );
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS [CARI_HAREKET_ID];
      `;
            const headerRes = await headerRequest.query(insertHeaderQuery);
            const newId = headerRes.recordset[0]?.CARI_HAREKET_ID;
            if (!newId) {
                throw new Error("Cari hareket başlığı oluşturulamadı.");
            }
            // Insert lines
            const validLines = (data.satirlar || []).filter((s) => s.paraId && s.meblag > 0);
            for (let i = 0; i < validLines.length; i++) {
                const line = validLines[i];
                const lineReq = new sql.Request(transaction);
                lineReq.input("CARI_HAREKET_ID", sql.Int, newId);
                lineReq.input("SATIR_NO", sql.Int, i + 1);
                lineReq.input("PARA_ID", sql.Int, line.paraId);
                lineReq.input("MEBLAG", sql.Float, Number(line.meblag));
                await lineReq.query(`
          INSERT INTO [dbo].[TODVZ_CARI_HAREKET_SATIRI] ([CARI_HAREKET_ID], [SATIR_NO], [PARA_ID], [MEBLAG])
          VALUES (@CARI_HAREKET_ID, @SATIR_NO, @PARA_ID, @MEBLAG);
        `);
            }
            await transaction.commit();
            const created = await CariHareketSqlRepository.findById(newId, dbContext);
            if (!created) {
                throw ApiError.internal("Cari hareket eklendi ancak veri okunamadı.");
            }
            return created;
        }
        catch (error) {
            await transaction.rollback();
            logger.error("CariHareketSqlRepository.create error:", error);
            throw error;
        }
    }
    static async update(id, data, userId = 1, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await CariHareketSqlRepository.ensureTablesExist(pool);
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            const numId = parseInt(String(id), 10);
            const headerRequest = new sql.Request(transaction);
            headerRequest.input("CARI_HAREKET_ID", sql.Int, numId);
            headerRequest.input("CARI_KART_ID", sql.Int, data.cariKartId);
            headerRequest.input("TARIH", sql.DateTime, data.tarih ? new Date(data.tarih) : new Date());
            headerRequest.input("HAREKET_TIPI", sql.TinyInt, data.hareketTipi ?? 0);
            headerRequest.input("ACIKLAMA", sql.VarChar(100), (data.aciklama || "").trim().slice(0, 100));
            headerRequest.input("TIP", sql.TinyInt, data.tip ?? 0);
            headerRequest.input("GUNCELLEYEN_ID", sql.Int, userId);
            headerRequest.input("VEZNE_ID", sql.Int, data.vezneId);
            headerRequest.input("POS_CIHAZI_ID", sql.Int, data.posCihaziId || null);
            await headerRequest.query(`
        UPDATE [dbo].[TODVZ_CARI_HAREKET]
        SET
          [CARI_KART_ID] = @CARI_KART_ID,
          [TARIH] = @TARIH,
          [HAREKET_TIPI] = @HAREKET_TIPI,
          [ACIKLAMA] = @ACIKLAMA,
          [TIP] = @TIP,
          [GUNCELLEYEN_ID] = @GUNCELLEYEN_ID,
          [GUNCELLEME_ZAMANI] = GETDATE(),
          [VEZNE_ID] = @VEZNE_ID,
          [POS_CIHAZI_ID] = @POS_CIHAZI_ID
        WHERE [CARI_HAREKET_ID] = @CARI_HAREKET_ID;
      `);
            // Delete existing lines
            const delReq = new sql.Request(transaction);
            delReq.input("CARI_HAREKET_ID", sql.Int, numId);
            await delReq.query("DELETE FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] WHERE [CARI_HAREKET_ID] = @CARI_HAREKET_ID;");
            // Insert new lines
            const validLines = (data.satirlar || []).filter((s) => s.paraId && s.meblag > 0);
            for (let i = 0; i < validLines.length; i++) {
                const line = validLines[i];
                const lineReq = new sql.Request(transaction);
                lineReq.input("CARI_HAREKET_ID", sql.Int, numId);
                lineReq.input("SATIR_NO", sql.Int, i + 1);
                lineReq.input("PARA_ID", sql.Int, line.paraId);
                lineReq.input("MEBLAG", sql.Float, Number(line.meblag));
                await lineReq.query(`
          INSERT INTO [dbo].[TODVZ_CARI_HAREKET_SATIRI] ([CARI_HAREKET_ID], [SATIR_NO], [PARA_ID], [MEBLAG])
          VALUES (@CARI_HAREKET_ID, @SATIR_NO, @PARA_ID, @MEBLAG);
        `);
            }
            await transaction.commit();
            const updated = await CariHareketSqlRepository.findById(numId, dbContext);
            if (!updated) {
                throw ApiError.internal("Cari hareket güncellendi ancak okunamadı.");
            }
            return updated;
        }
        catch (error) {
            await transaction.rollback();
            logger.error(`CariHareketSqlRepository.update(${id}) error:`, error);
            throw error;
        }
    }
    static async delete(id, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await CariHareketSqlRepository.ensureTablesExist(pool);
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            const numId = parseInt(String(id), 10);
            const delLines = new sql.Request(transaction);
            delLines.input("CARI_HAREKET_ID", sql.Int, numId);
            await delLines.query("DELETE FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] WHERE [CARI_HAREKET_ID] = @CARI_HAREKET_ID;");
            const delHeader = new sql.Request(transaction);
            delHeader.input("CARI_HAREKET_ID", sql.Int, numId);
            const res = await delHeader.query("DELETE FROM [dbo].[TODVZ_CARI_HAREKET] WHERE [CARI_HAREKET_ID] = @CARI_HAREKET_ID;");
            await transaction.commit();
            return (res.rowsAffected[0] || 0) > 0;
        }
        catch (error) {
            await transaction.rollback();
            logger.error(`CariHareketSqlRepository.delete(${id}) error:`, error);
            throw error;
        }
    }
    static async getNavigationIds(currentId, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await CariHareketSqlRepository.ensureTablesExist(pool);
            const query = `
        SELECT [CARI_HAREKET_ID]
        FROM [dbo].[TODVZ_CARI_HAREKET]
        ORDER BY [CARI_HAREKET_ID] ASC;
      `;
            const res = await pool.request().query(query);
            const ids = (res.recordset || []).map((r) => r.CARI_HAREKET_ID);
            if (ids.length === 0) {
                return { firstId: null, prevId: null, nextId: null, lastId: null, currentIndex: -1, total: 0 };
            }
            const firstId = ids[0];
            const lastId = ids[ids.length - 1];
            if (!currentId) {
                return { firstId, prevId: null, nextId: ids[1] || null, lastId, currentIndex: 0, total: ids.length };
            }
            const cur = parseInt(String(currentId), 10);
            const idx = ids.indexOf(cur);
            return {
                firstId,
                prevId: idx > 0 ? ids[idx - 1] : null,
                nextId: idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null,
                lastId,
                currentIndex: idx,
                total: ids.length,
            };
        }
        catch (error) {
            logger.error("CariHareketSqlRepository.getNavigationIds error:", error);
            return { firstId: null, prevId: null, nextId: null, lastId: null, currentIndex: -1, total: 0 };
        }
    }
    /**
     * Calculates the real-time balance breakdown of a Cari Kart for all currencies.
     */
    static async getCariBakiye(cariKartId, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await CariHareketSqlRepository.ensureTablesExist(pool);
            const id = parseInt(String(cariKartId), 10);
            // 1. Get Cari Card details
            const cariRes = await pool
                .request()
                .input("id", sql.Int, id)
                .query(`
          SELECT [CARI_KART_ID], LTRIM(RTRIM(ISNULL([KOD], ''))) AS [KOD], LTRIM(RTRIM(ISNULL([AD], ''))) AS [AD]
          FROM [dbo].[TODVZ_CARI_KART]
          WHERE [CARI_KART_ID] = @id;
        `);
            const cari = cariRes.recordset[0] || { CARI_KART_ID: id, KOD: "", AD: "" };
            // 2. Aggregate all lines for this customer
            // TIP = 0: Borç, TIP = 1: Alacak
            const bakiyeQuery = `
        SELECT 
          P.[PARA_ID],
          LTRIM(RTRIM(ISNULL(P.[KOD], ''))) AS [PARA_KOD],
          LTRIM(RTRIM(ISNULL(P.[AD], ''))) AS [PARA_AD],
          ISNULL(P.[HAS_ORANI], 1) AS [HAS_ORANI],
          ISNULL(P.[SIRA_NO], 99) AS [SIRA_NO],
          SUM(CASE WHEN H.[TIP] = 0 THEN S.[MEBLAG] ELSE 0 END) AS [TOPLAM_BORC],
          SUM(CASE WHEN H.[TIP] = 1 THEN S.[MEBLAG] ELSE 0 END) AS [TOPLAM_ALACAK]
        FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] S
        INNER JOIN [dbo].[TODVZ_CARI_HAREKET] H ON S.[CARI_HAREKET_ID] = H.[CARI_HAREKET_ID]
        INNER JOIN [dbo].[TODVZ_PARA] P ON S.[PARA_ID] = P.[PARA_ID]
        WHERE H.[CARI_KART_ID] = @id
        GROUP BY P.[PARA_ID], P.[KOD], P.[AD], P.[HAS_ORANI], P.[SIRA_NO]
        ORDER BY P.[SIRA_NO] ASC, P.[KOD] ASC;
      `;
            const result = await pool.request().input("id", sql.Int, id).query(bakiyeQuery);
            const rows = [];
            let totalNetHas = 0; // positive = Alacak, negative = Borç
            for (const r of result.recordset || []) {
                const borc = r.TOPLAM_BORC || 0;
                const alacak = r.TOPLAM_ALACAK || 0;
                const diff = alacak - borc; // > 0 Alacak, < 0 Borç
                let borcBakiye = 0;
                let alacakBakiye = 0;
                let yon = "-";
                if (diff < -0.0001) {
                    borcBakiye = Math.abs(diff);
                    yon = "B";
                }
                else if (diff > 0.0001) {
                    alacakBakiye = diff;
                    yon = "A";
                }
                const hasOrani = r.HAS_ORANI || 1;
                const isGoldOrHas = (r.PARA_KOD || "").toUpperCase().includes("HAS") || hasOrani > 0;
                if (isGoldOrHas && (borcBakiye > 0 || alacakBakiye > 0)) {
                    totalNetHas += diff * hasOrani;
                }
                if (borc > 0 || alacak > 0 || borcBakiye > 0 || alacakBakiye > 0) {
                    rows.push({
                        paraId: r.PARA_ID,
                        kod: r.PARA_KOD,
                        ad: r.PARA_AD,
                        borcBakiye,
                        alacakBakiye,
                        netBakiye: Math.abs(diff),
                        yon,
                        hasOrani,
                    });
                }
            }
            let netHasYon = "-";
            let absHas = Math.abs(totalNetHas);
            if (totalNetHas > 0.001) {
                netHasYon = "A";
            }
            else if (totalNetHas < -0.001) {
                netHasYon = "B";
            }
            const formattedHas = new Intl.NumberFormat("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(absHas);
            const headerLabel = absHas > 0.001 ? `${formattedHas} HAS ${netHasYon}` : "HAS 0.00";
            return {
                cariKartId: id,
                kod: cari.KOD,
                ad: cari.AD,
                satirlar: rows,
                netHasBakiye: absHas,
                netHasYon,
                headerLabel,
            };
        }
        catch (error) {
            logger.error(`CariHareketSqlRepository.getCariBakiye(${cariKartId}) error:`, error);
            return {
                cariKartId: Number(cariKartId),
                kod: "",
                ad: "",
                satirlar: [],
                netHasBakiye: 0,
                netHasYon: "-",
                headerLabel: "HAS 0.00",
            };
        }
    }
}
