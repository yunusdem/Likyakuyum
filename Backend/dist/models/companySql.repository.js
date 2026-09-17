import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
export class CompanySqlRepository {
    /**
     * Fetches company definitions from [dbo].[TODVZ_TANIM] in the target database
     */
    static async getDefinitions(dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const result = await pool.request().query(`
        SELECT TOP 1 *
        FROM [dbo].[TODVZ_TANIM]
      `);
            return result.recordset[0] || null;
        }
        catch (error) {
            logger.error("Error fetching TODVZ_TANIM:", error);
            throw ApiError.internal("Firma tanımları veritabanından yüklenirken bir hata oluştu.");
        }
    }
    static async sanitizeFkIds(data, pool) {
        const copy = { ...data };
        const toValidId = (v) => {
            if (v === undefined || v === null || v === "")
                return null;
            const n = Number(v);
            return !isNaN(n) && n > 0 ? n : null;
        };
        // 1. Check & Ensure POSTA_KODU_ID in TODVZ_TABLO_MADDESI (TUR = 4)
        if (copy.POSTA_KODU_ID !== undefined && copy.POSTA_KODU_ID !== null) {
            const pkId = toValidId(copy.POSTA_KODU_ID);
            if (pkId) {
                try {
                    const pkCheck = await pool.request().query(`
            SELECT TOP 1 [TABLO_MADDESI_ID] FROM [dbo].[TODVZ_TABLO_MADDESI] WHERE [TABLO_MADDESI_ID] = ${pkId}
          `);
                    if (pkCheck.recordset && pkCheck.recordset.length > 0) {
                        copy.POSTA_KODU_ID = pkCheck.recordset[0].TABLO_MADDESI_ID;
                    }
                    else {
                        const pkStr = String(pkId);
                        const findByKod = await pool
                            .request()
                            .input("kod", sql.VarChar(20), pkStr)
                            .query(`
                SELECT TOP 1 [TABLO_MADDESI_ID] FROM [dbo].[TODVZ_TABLO_MADDESI] WHERE [TUR] = 4 AND ([KOD] = @kod OR [AD] = @kod)
              `);
                        if (findByKod.recordset && findByKod.recordset.length > 0) {
                            copy.POSTA_KODU_ID = findByKod.recordset[0].TABLO_MADDESI_ID;
                        }
                        else {
                            const insPk = await pool
                                .request()
                                .input("kod", sql.VarChar(20), pkStr)
                                .input("ad", sql.VarChar(100), pkStr)
                                .query(`
                  INSERT INTO [dbo].[TODVZ_TABLO_MADDESI] (TUR, KOD, AD) VALUES (4, @kod, @ad);
                  SELECT SCOPE_IDENTITY() AS newId;
                `);
                            copy.POSTA_KODU_ID = insPk.recordset[0]?.newId || null;
                        }
                    }
                }
                catch {
                    copy.POSTA_KODU_ID = null;
                }
            }
            else {
                copy.POSTA_KODU_ID = null;
            }
        }
        // 2. Validate TABLO_MADDESI IDs (VERGI_DAIRESI_ID, ILCE_ID, IL_ID, POSTA_KODU_ID)
        const tmFields = ["VERGI_DAIRESI_ID", "ILCE_ID", "IL_ID", "POSTA_KODU_ID"];
        const tmIdsToCheck = tmFields
            .map((f) => ({ field: f, id: toValidId(copy[f]) }))
            .filter((x) => x.id !== null);
        if (tmIdsToCheck.length > 0) {
            const ids = tmIdsToCheck.map((x) => x.id);
            try {
                const res = await pool.request().query(`
          SELECT [TABLO_MADDESI_ID] FROM [dbo].[TODVZ_TABLO_MADDESI] WHERE [TABLO_MADDESI_ID] IN (${ids.join(",")})
        `);
                const validSet = new Set(res.recordset.map((r) => r.TABLO_MADDESI_ID));
                tmIdsToCheck.forEach(({ field, id }) => {
                    if (id !== null && !validSet.has(id)) {
                        copy[field] = null;
                    }
                });
            }
            catch {
                tmIdsToCheck.forEach(({ field }) => {
                    copy[field] = null;
                });
            }
        }
        // 3. Validate ULKE_ID in TODVZ_ULKE
        if (copy.ULKE_ID !== undefined && copy.ULKE_ID !== null) {
            const uId = toValidId(copy.ULKE_ID);
            if (uId) {
                try {
                    const res = await pool.request().query(`
            SELECT TOP 1 [ULKE_ID] FROM [dbo].[TODVZ_ULKE] WHERE [ULKE_ID] = ${uId}
          `);
                    if (!res.recordset || res.recordset.length === 0)
                        copy.ULKE_ID = null;
                }
                catch {
                    copy.ULKE_ID = null;
                }
            }
            else {
                copy.ULKE_ID = null;
            }
        }
        // 4. Validate PARA IDs in TODVZ_PARA
        const paraFields = [
            "USD_PARA_ID",
            "EUR_PARA_ID",
            "RAPOR_PARA_ID",
            "DOVIZ_VERGI_SINIRI_PARA_ID",
            "ALTIN_VERGI_SINIRI_PARA_ID",
            "FAVORI_PARA_ID",
            "HAS_ALTIN_PARA_ID",
            "HAS_GUMUS_PARA_ID",
        ];
        const paraIdsToCheck = paraFields
            .map((f) => ({ field: f, id: toValidId(copy[f]) }))
            .filter((x) => x.id !== null);
        if (paraIdsToCheck.length > 0) {
            const ids = paraIdsToCheck.map((x) => x.id);
            try {
                const res = await pool.request().query(`
          SELECT [PARA_ID] FROM [dbo].[TODVZ_PARA] WHERE [PARA_ID] IN (${ids.join(",")})
        `);
                const validParaSet = new Set(res.recordset.map((r) => r.PARA_ID));
                paraIdsToCheck.forEach(({ field, id }) => {
                    if (id !== null && !validParaSet.has(id)) {
                        copy[field] = null;
                    }
                });
            }
            catch {
                paraIdsToCheck.forEach(({ field }) => {
                    copy[field] = null;
                });
            }
        }
        // 5. Validate ISTATISTIK IDs in TODVZ_ISTATISTIK
        const statFields = [
            "ALIS_ISTATISTIK_ID",
            "SATIS_ISTATISTIK_ID",
            "ARBITRAJ_ALIS_ISTATISTIK_ID",
            "ARBITRAJ_SATIS_ISTATISTIK_ID",
        ];
        const statIdsToCheck = statFields
            .map((f) => ({ field: f, id: toValidId(copy[f]) }))
            .filter((x) => x.id !== null);
        if (statIdsToCheck.length > 0) {
            const ids = statIdsToCheck.map((x) => x.id);
            try {
                const res = await pool.request().query(`
          SELECT [ISTATISTIK_ID] FROM [dbo].[TODVZ_ISTATISTIK] WHERE [ISTATISTIK_ID] IN (${ids.join(",")})
        `);
                const validStatSet = new Set(res.recordset.map((r) => r.ISTATISTIK_ID));
                statIdsToCheck.forEach(({ field, id }) => {
                    if (id !== null && !validStatSet.has(id)) {
                        copy[field] = null;
                    }
                });
            }
            catch {
                statIdsToCheck.forEach(({ field }) => {
                    copy[field] = null;
                });
            }
        }
        // 6. Validate FOREKS_KUR_VEZNE_ID in TODVZ_VEZNE
        if (copy.FOREKS_KUR_VEZNE_ID !== undefined && copy.FOREKS_KUR_VEZNE_ID !== null) {
            const vId = toValidId(copy.FOREKS_KUR_VEZNE_ID);
            if (vId) {
                try {
                    const res = await pool.request().query(`
            SELECT TOP 1 [VEZNE_ID] FROM [dbo].[TODVZ_VEZNE] WHERE [VEZNE_ID] = ${vId}
          `);
                    if (!res.recordset || res.recordset.length === 0)
                        copy.FOREKS_KUR_VEZNE_ID = null;
                }
                catch {
                    copy.FOREKS_KUR_VEZNE_ID = null;
                }
            }
            else {
                copy.FOREKS_KUR_VEZNE_ID = null;
            }
        }
        // 7. Validate SERMAYE_HESABI_ID & URETIM_HESABI_ID
        const hesapFields = ["SERMAYE_HESABI_ID", "URETIM_HESABI_ID"];
        for (const hf of hesapFields) {
            const hId = toValidId(copy[hf]);
            if (hId) {
                let valid = false;
                try {
                    const muhRes = await pool.request().query(`
            SELECT 1 FROM sys.tables WHERE name = 'TODVZ_MUH_HESAP'
          `);
                    if (muhRes.recordset && muhRes.recordset.length > 0) {
                        const res = await pool.request().query(`
              SELECT TOP 1 1 FROM [dbo].[TODVZ_MUH_HESAP] WHERE [MUH_HESAP_ID] = ${hId}
            `);
                        if (res.recordset && res.recordset.length > 0)
                            valid = true;
                    }
                    if (!valid) {
                        const hRes = await pool.request().query(`
              SELECT 1 FROM sys.tables WHERE name = 'TODVZ_HESAP'
            `);
                        if (hRes.recordset && hRes.recordset.length > 0) {
                            const res = await pool.request().query(`
                SELECT TOP 1 1 FROM [dbo].[TODVZ_HESAP] WHERE [HESAP_ID] = ${hId}
              `);
                            if (res.recordset && res.recordset.length > 0)
                                valid = true;
                        }
                    }
                }
                catch { }
                if (!valid)
                    copy[hf] = null;
            }
            else {
                copy[hf] = null;
            }
        }
        return copy;
    }
    /**
     * Updates or inserts company definitions into [dbo].[TODVZ_TANIM] in the target database
     */
    static async updateDefinitions(data, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            // Sanitize foreign key IDs to prevent TABLO_MADDESI_ID / ULKE_ID / PARA_ID FK violations
            const sanitizedData = await CompanySqlRepository.sanitizeFkIds(data, pool);
            // Check if row exists in TODVZ_TANIM
            const existing = await pool.request().query(`
        SELECT TOP 1 * FROM [dbo].[TODVZ_TANIM]
      `);
            // Ensure at least one row exists in TODVZ_TANIM
            if (existing.recordset.length === 0) {
                await pool.request().query(`
          INSERT INTO [dbo].[TODVZ_TANIM] (SURUM, SUBE_KODU, FIRMA_ADI) 
          VALUES ('2016', '1', 'Firma Tanımı');
        `);
            }
            // Ensure URETIM_HESABI_ID column exists in TODVZ_TANIM table
            try {
                await pool.request().query(`
          IF NOT EXISTS (
            SELECT 1 FROM sys.columns 
            WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_TANIM]') 
            AND name = 'URETIM_HESABI_ID'
          )
          BEGIN
            ALTER TABLE [dbo].[TODVZ_TANIM] ADD [URETIM_HESABI_ID] INT NULL;
          END
        `);
            }
            catch (colErr) {
                logger.warn("Could not check/create URETIM_HESABI_ID column in TODVZ_TANIM:", colErr.message);
            }
            // Re-fetch existing row
            const currentRes = await pool.request().query(`
        SELECT TOP 1 * FROM [dbo].[TODVZ_TANIM]
      `);
            const existingRow = currentRes.recordset[0] || {};
            // 1. Check if SODVZ_FIRMA_TANIMI_KAYDET procedure exists / create or alter it
            try {
                await pool.request().query(`
          CREATE OR ALTER PROCEDURE [dbo].[SODVZ_FIRMA_TANIMI_KAYDET]
            @FIRMA_ADI VARCHAR(200) = NULL,
            @DOSYA_NO VARCHAR(20) = NULL,
            @SUBE_KODU VARCHAR(20) = NULL,
            @SUBE_ADI VARCHAR(200) = NULL,
            @VERGI_DAIRESI_ID INT = NULL,
            @VERGI_KIMLIK_NO VARCHAR(50) = NULL,
            @ADRES VARCHAR(200) = NULL,
            @POSTA_KODU_ID INT = NULL,
            @ILCE_ID INT = NULL,
            @IL_ID INT = NULL,
            @ULKE_ID INT = NULL,
            @TELEFON VARCHAR(20) = NULL,
            @WEB_ADRESI VARCHAR(100) = NULL,
            @EPOSTA VARCHAR(100) = NULL,
            @MERSIS_NO VARCHAR(20) = NULL,
            @TICARET_SICIL_NO VARCHAR(20) = NULL,
            @YETKILI_MUESSESE_TIPI TINYINT = 0,
            @E_DEFTER_MUKELLEFI BIT = 0,
            @URETIM_HESABI_ID INT = NULL
          AS
          BEGIN
            SET NOCOUNT ON;
            UPDATE [dbo].[TODVZ_TANIM]
            SET 
              [FIRMA_ADI] = @FIRMA_ADI,
              [DOSYA_NO] = @DOSYA_NO,
              [SUBE_KODU] = @SUBE_KODU,
              [SUBE_ADI] = @SUBE_ADI,
              [VERGI_DAIRESI_ID] = @VERGI_DAIRESI_ID,
              [VERGI_KIMLIK_NO] = @VERGI_KIMLIK_NO,
              [ADRES] = @ADRES,
              [POSTA_KODU_ID] = @POSTA_KODU_ID,
              [ILCE_ID] = @ILCE_ID,
              [IL_ID] = @IL_ID,
              [ULKE_ID] = @ULKE_ID,
              [TELEFON] = @TELEFON,
              [WEB_ADRESI] = @WEB_ADRESI,
              [EPOSTA] = @EPOSTA,
              [MERSIS_NO] = @MERSIS_NO,
              [TICARET_SICIL_NO] = @TICARET_SICIL_NO,
              [YETKILI_MUESSESE_TIPI] = @YETKILI_MUESSESE_TIPI,
              [E_DEFTER_MUKELLEFI] = @E_DEFTER_MUKELLEFI,
              [URETIM_HESABI_ID] = @URETIM_HESABI_ID;
          END;
        `);
            }
            catch (procCreateErr) {
                logger.warn("Could not check/create SODVZ_FIRMA_TANIMI_KAYDET procedure:", procCreateErr.message);
            }
            // 2. Execute SODVZ_FIRMA_TANIMI_KAYDET stored procedure
            const parseNum = (v) => (v !== undefined && v !== null && v !== "" && !isNaN(Number(v))) ? Number(v) : null;
            try {
                const procReq = pool.request();
                const fAdi = (sanitizedData.FIRMA_ADI !== undefined ? sanitizedData.FIRMA_ADI : existingRow.FIRMA_ADI) || null;
                const dosyaNo = (sanitizedData.DOSYA_NO !== undefined ? sanitizedData.DOSYA_NO : existingRow.DOSYA_NO) || null;
                const subeKodu = (sanitizedData.SUBE_KODU !== undefined ? sanitizedData.SUBE_KODU : existingRow.SUBE_KODU) || "1";
                const subeAdi = (sanitizedData.SUBE_ADI !== undefined ? sanitizedData.SUBE_ADI : existingRow.SUBE_ADI) || null;
                const vdId = parseNum(sanitizedData.VERGI_DAIRESI_ID) ?? parseNum(existingRow.VERGI_DAIRESI_ID);
                const vkn = (sanitizedData.VERGI_KIMLIK_NO !== undefined ? sanitizedData.VERGI_KIMLIK_NO : existingRow.VERGI_KIMLIK_NO) || null;
                const adres = (sanitizedData.ADRES !== undefined ? sanitizedData.ADRES : existingRow.ADRES) || null;
                const pkId = parseNum(sanitizedData.POSTA_KODU_ID) ?? parseNum(existingRow.POSTA_KODU_ID);
                const ilceId = parseNum(sanitizedData.ILCE_ID) ?? parseNum(existingRow.ILCE_ID);
                const ilId = parseNum(sanitizedData.IL_ID) ?? parseNum(existingRow.IL_ID);
                const ulkeId = parseNum(sanitizedData.ULKE_ID) ?? parseNum(existingRow.ULKE_ID);
                const telefon = (sanitizedData.TELEFON !== undefined ? sanitizedData.TELEFON : existingRow.TELEFON) || null;
                const webAdresi = (sanitizedData.WEB_ADRESI !== undefined ? sanitizedData.WEB_ADRESI : existingRow.WEB_ADRESI) || null;
                const eposta = (sanitizedData.EPOSTA !== undefined ? sanitizedData.EPOSTA : existingRow.EPOSTA) || null;
                const mersisNo = (sanitizedData.MERSIS_NO !== undefined ? sanitizedData.MERSIS_NO : existingRow.MERSIS_NO) || null;
                const tSicilNo = (sanitizedData.TICARET_SICIL_NO !== undefined ? sanitizedData.TICARET_SICIL_NO : existingRow.TICARET_SICIL_NO) || null;
                const muesseseTipi = Number(sanitizedData.YETKILI_MUESSESE_TIPI ?? existingRow.YETKILI_MUESSESE_TIPI ?? 0);
                const eDefter = sanitizedData.E_DEFTER_MUKELLEFI !== undefined ? (sanitizedData.E_DEFTER_MUKELLEFI ? 1 : 0) : (existingRow.E_DEFTER_MUKELLEFI ? 1 : 0);
                const uretimHesabiId = parseNum(sanitizedData.URETIM_HESABI_ID) ?? parseNum(existingRow.URETIM_HESABI_ID);
                procReq.input("FIRMA_ADI", sql.VarChar(200), fAdi);
                procReq.input("DOSYA_NO", sql.VarChar(20), dosyaNo ? String(dosyaNo).slice(0, 20) : null);
                procReq.input("SUBE_KODU", sql.VarChar(20), subeKodu ? String(subeKodu).slice(0, 20) : "1");
                procReq.input("SUBE_ADI", sql.VarChar(200), subeAdi);
                procReq.input("VERGI_DAIRESI_ID", sql.Int, vdId);
                procReq.input("VERGI_KIMLIK_NO", sql.VarChar(50), vkn);
                procReq.input("ADRES", sql.VarChar(200), adres);
                procReq.input("POSTA_KODU_ID", sql.Int, pkId);
                procReq.input("ILCE_ID", sql.Int, ilceId);
                procReq.input("IL_ID", sql.Int, ilId);
                procReq.input("ULKE_ID", sql.Int, ulkeId);
                procReq.input("TELEFON", sql.VarChar(20), telefon ? String(telefon).slice(0, 20) : null);
                procReq.input("WEB_ADRESI", sql.VarChar(100), webAdresi);
                procReq.input("EPOSTA", sql.VarChar(100), eposta);
                procReq.input("MERSIS_NO", sql.VarChar(20), mersisNo ? String(mersisNo).slice(0, 20) : null);
                procReq.input("TICARET_SICIL_NO", sql.VarChar(20), tSicilNo ? String(tSicilNo).slice(0, 20) : null);
                procReq.input("YETKILI_MUESSESE_TIPI", sql.TinyInt, muesseseTipi);
                procReq.input("E_DEFTER_MUKELLEFI", sql.Bit, eDefter);
                procReq.input("URETIM_HESABI_ID", sql.Int, uretimHesabiId);
                await procReq.execute("SODVZ_FIRMA_TANIMI_KAYDET");
            }
            catch (procErr) {
                logger.warn("SODVZ_FIRMA_TANIMI_KAYDET execution error, continuing with full update:", procErr.message);
            }
            // 3. Update all table columns to ensure other tabs (Para, Muhasebe, Limitler, E-Belge, Fiş vb.) are saved
            const columnMapping = [
                { name: "SURUM", type: sql.VarChar, len: 20 },
                { name: "FIRMA_ADI", type: sql.VarChar, len: 200 },
                { name: "DOSYA_NO", type: sql.VarChar, len: 20 },
                { name: "SUBE_KODU", type: sql.VarChar, len: 20 },
                { name: "SUBE_ADI", type: sql.VarChar, len: 200 },
                { name: "VERGI_DAIRESI_ID", type: sql.Int },
                { name: "VERGI_KIMLIK_NO", type: sql.VarChar, len: 50 },
                { name: "ADRES", type: sql.VarChar, len: 200 },
                { name: "POSTA_KODU_ID", type: sql.Int },
                { name: "ILCE_ID", type: sql.Int },
                { name: "IL_ID", type: sql.Int },
                { name: "ULKE_ID", type: sql.Int },
                { name: "TELEFON", type: sql.VarChar, len: 20 },
                { name: "WEB_ADRESI", type: sql.VarChar, len: 100 },
                { name: "EPOSTA", type: sql.VarChar, len: 100 },
                { name: "MERSIS_NO", type: sql.VarChar, len: 20 },
                { name: "TICARET_SICIL_NO", type: sql.VarChar, len: 20 },
                { name: "YETKILI_MUESSESE_TIPI", type: sql.TinyInt },
                { name: "E_DEFTER_MUKELLEFI", type: sql.Bit },
                { name: "URETIM_HESABI_ID", type: sql.Int },
                { name: "USD_PARA_ID", type: sql.Int },
                { name: "EUR_PARA_ID", type: sql.Int },
                { name: "RAPOR_PARA_ID", type: sql.Int },
                { name: "DOVIZ_VERGI_SINIRI_PARA_ID", type: sql.Int },
                { name: "ALTIN_VERGI_SINIRI_PARA_ID", type: sql.Int },
                { name: "FAVORI_PARA_ID", type: sql.Int },
                { name: "HAS_ALTIN_PARA_ID", type: sql.Int },
                { name: "HAS_GUMUS_PARA_ID", type: sql.Int },
                { name: "ALIS_ISTATISTIK_ID", type: sql.Int },
                { name: "SATIS_ISTATISTIK_ID", type: sql.Int },
                { name: "E_BELGE_BASLANGIC_TARIHI", type: sql.DateTime },
            ];
            const updateReq = pool.request();
            for (const col of columnMapping) {
                let val = sanitizedData[col.name];
                // If field was not provided in incoming data, preserve existing value from database
                if (val === undefined && existingRow && existingRow[col.name] !== undefined) {
                    val = existingRow[col.name];
                }
                // Special handling for NOT NULL columns like SURUM
                if (col.name === "SURUM") {
                    val = (val || existingRow?.SURUM || "2016").toString().trim().slice(0, col.len || 20);
                }
                if (col.type === sql.DateTime) {
                    let dateVal = null;
                    if (val instanceof Date && !isNaN(val.getTime())) {
                        dateVal = val;
                    }
                    else if (typeof val === "string" || typeof val === "number") {
                        const parsed = new Date(val);
                        if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
                            dateVal = parsed;
                        }
                    }
                    updateReq.input(col.name, sql.DateTime, dateVal);
                    continue;
                }
                if (col.type === sql.Bit) {
                    updateReq.input(col.name, sql.Bit, val ? 1 : 0);
                    continue;
                }
                if (col.type === sql.Int || col.type === sql.TinyInt || col.type === sql.Float) {
                    const numVal = (val !== undefined && val !== null && val !== "") ? Number(val) : null;
                    updateReq.input(col.name, col.type, (numVal !== null && !isNaN(numVal)) ? numVal : null);
                    continue;
                }
                if (col.len && (col.type === sql.VarChar || col.type === sql.Char)) {
                    const strVal = (val !== undefined && val !== null) ? String(val).slice(0, col.len) : null;
                    updateReq.input(col.name, col.type(col.len), strVal);
                    continue;
                }
                updateReq.input(col.name, col.type, val !== undefined ? val : null);
            }
            const setClauses = columnMapping.map((col) => `[${col.name}] = @${col.name}`).join(",\n");
            const updateQuery = `
        UPDATE [dbo].[TODVZ_TANIM]
        SET ${setClauses};

        SELECT TOP 1 * FROM [dbo].[TODVZ_TANIM];
      `;
            const result = await updateReq.query(updateQuery);
            return result.recordset[0];
        }
        catch (error) {
            logger.error("Error updating TODVZ_TANIM:", error);
            throw ApiError.internal(`Firma tanımları güncellenirken hata oluştu: ${error.message}`);
        }
    }
}
