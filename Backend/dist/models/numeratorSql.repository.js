import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
const toFloat = (val, defaultVal = 0) => {
    if (val === undefined || val === null || val === "")
        return defaultVal;
    const parsed = parseFloat(String(val));
    return isNaN(parsed) ? defaultVal : parsed;
};
const toInt = (val, defaultVal = 0) => {
    if (val === undefined || val === null || val === "")
        return defaultVal;
    const parsed = parseInt(String(val), 10);
    return isNaN(parsed) ? defaultVal : parsed;
};
function formatOrnekNumara(onek, baslangic, uzunluk, onuneSifirKoy) {
    const prefix = (onek || "").trim();
    const numStr = String(baslangic || 0);
    if (!onuneSifirKoy || uzunluk <= prefix.length) {
        return `${prefix}${numStr}`;
    }
    const remainingLen = Math.max(1, uzunluk - prefix.length);
    const paddedNum = numStr.padStart(remainingLen, "0");
    return `${prefix}${paddedNum}`;
}
export class NumeratorSqlRepository {
    static mapEntityToModel(entity) {
        const onek = (entity.ONEK || "").trim();
        const baslangic = entity.BASLANGIC ?? 0;
        const uzunluk = entity.UZUNLUK ?? 10;
        const onuneSifirKoy = entity.ONUNE_SIFIR_KOY !== false;
        return {
            id: `${entity.TUR}_${entity.YAZICI_ID !== null && entity.YAZICI_ID !== undefined ? entity.YAZICI_ID : "null"}`,
            tur: entity.TUR,
            yaziciId: entity.YAZICI_ID !== null && entity.YAZICI_ID !== undefined ? entity.YAZICI_ID : null,
            yaziciAdi: entity.YAZICI_ADI ? entity.YAZICI_ADI.trim() : null,
            onek,
            baslangic,
            bitis: entity.BITIS ?? 0,
            uzunluk,
            onuneSifirKoy,
            ornekNumara: formatOrnekNumara(onek, baslangic, uzunluk, onuneSifirKoy),
        };
    }
    static async findAll(dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const query = `
        SELECT 
          n.[YAZICI_ID],
          n.[TUR],
          n.[ONEK],
          n.[BASLANGIC],
          n.[BITIS],
          n.[UZUNLUK],
          n.[ONUNE_SIFIR_KOY],
          y.[AD] AS [YAZICI_ADI]
        FROM [dbo].[TODVZ_NUMERATOR] n
        LEFT JOIN [dbo].[TODVZ_YAZICI] y ON n.[YAZICI_ID] = y.[YAZICI_ID]
        ORDER BY n.[TUR] ASC, n.[YAZICI_ID] ASC;
      `;
            const result = await pool.request().query(query);
            return result.recordset.map(NumeratorSqlRepository.mapEntityToModel);
        }
        catch (error) {
            logger.error("NumeratorSqlRepository.findAll error:", error);
            throw error;
        }
    }
    static async findByTurAndYazici(tur, yaziciId, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            request.input("tur", sql.TinyInt, toInt(tur, 0));
            let query = `
        SELECT TOP 1
          n.[YAZICI_ID],
          n.[TUR],
          n.[ONEK],
          n.[BASLANGIC],
          n.[BITIS],
          n.[UZUNLUK],
          n.[ONUNE_SIFIR_KOY],
          y.[AD] AS [YAZICI_ADI]
        FROM [dbo].[TODVZ_NUMERATOR] n
        LEFT JOIN [dbo].[TODVZ_YAZICI] y ON n.[YAZICI_ID] = y.[YAZICI_ID]
        WHERE n.[TUR] = @tur
      `;
            if (yaziciId !== null && yaziciId !== undefined && yaziciId !== 0) {
                request.input("yaziciId", sql.Int, toInt(yaziciId));
                query += ` AND n.[YAZICI_ID] = @yaziciId;`;
            }
            else {
                query += ` AND (n.[YAZICI_ID] IS NULL OR n.[YAZICI_ID] = 0);`;
            }
            const result = await request.query(query);
            if (!result.recordset || result.recordset.length === 0)
                return null;
            return NumeratorSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            logger.error(`NumeratorSqlRepository.findByTurAndYazici(${tur}, ${yaziciId}) error:`, error);
            throw error;
        }
    }
    /**
     * Saves (inserts or updates) a numerator definition using the SODVZ_NUMERATOR_KAYDET stored procedure.
     */
    static async saveViaProcedure(data, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            const tur = toInt(data.tur, 0);
            const yaziciId = data.yaziciId !== undefined &&
                data.yaziciId !== null &&
                String(data.yaziciId) !== "" &&
                !isNaN(parseInt(String(data.yaziciId), 10))
                ? parseInt(String(data.yaziciId), 10)
                : null;
            const onek = data.onek ? data.onek.trim().slice(0, 50) : "";
            const baslangic = toInt(data.baslangic, 0);
            const bitis = toInt(data.bitis, 0);
            const uzunluk = Math.max(1, toInt(data.uzunluk, 10));
            const onuneSifirKoy = data.onuneSifirKoy !== false;
            const yaziciOrtakAlan = data.yaziciOrtakAlan !== undefined
                ? (data.yaziciOrtakAlan ? 1 : 0)
                : (yaziciId === null ? 1 : 0);
            logger.info(`[SODVZ_NUMERATOR_KAYDET] Çağrılıyor: TUR=${tur}, YAZICI_ID=${yaziciId}, ONEK='${onek}', BASLANGIC=${baslangic}, BITIS=${bitis}, UZUNLUK=${uzunluk}, ONUNE_SIFIR_KOY=${onuneSifirKoy ? 1 : 0}, YAZICI_ORTAK_ALAN=${yaziciOrtakAlan}`);
            request.input("YAZICI_ORTAK_ALAN", sql.Bit, yaziciOrtakAlan);
            request.input("YAZICI_ID", sql.Int, yaziciId);
            request.input("TUR", sql.TinyInt, tur);
            request.input("ONEK", sql.VarChar(50), onek);
            request.input("BASLANGIC", sql.Int, baslangic);
            request.input("BITIS", sql.Int, bitis);
            request.input("UZUNLUK", sql.Int, uzunluk);
            request.input("ONUNE_SIFIR_KOY", sql.Bit, onuneSifirKoy ? 1 : 0);
            const execQuery = `
        EXEC [dbo].[SODVZ_NUMERATOR_KAYDET]
          @YAZICI_ORTAK_ALAN = @YAZICI_ORTAK_ALAN,
          @YAZICI_ID = @YAZICI_ID,
          @TUR = @TUR,
          @ONEK = @ONEK,
          @BASLANGIC = @BASLANGIC,
          @BITIS = @BITIS,
          @UZUNLUK = @UZUNLUK,
          @ONUNE_SIFIR_KOY = @ONUNE_SIFIR_KOY;
      `;
            await request.query(execQuery);
            const saved = await NumeratorSqlRepository.findByTurAndYazici(tur, yaziciId, dbContext);
            if (!saved) {
                throw ApiError.internal("Numaratör kaydedildi fakat güncel veri okunamadı.");
            }
            return saved;
        }
        catch (error) {
            logger.error("NumeratorSqlRepository.saveViaProcedure error:", error);
            const msg = error?.message || "Numaratör kaydedilemedi.";
            throw ApiError.internal(msg);
        }
    }
    static async create(data, dbContext) {
        return NumeratorSqlRepository.saveViaProcedure(data, dbContext);
    }
    static async update(_originalTur, _originalYaziciId, data, dbContext) {
        // SODVZ_NUMERATOR_KAYDET stored procedure'ü (YAZICI_ID, TUR) ikilisine göre
        // kayıt varsa UPDATE, yoksa INSERT yapmaktadır. Doğrudan SQL UPDATE kesinlikle yapılmaz.
        return NumeratorSqlRepository.saveViaProcedure(data, dbContext);
    }
    static async delete(tur, yaziciId, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            request.input("tur", sql.TinyInt, toInt(tur, 0));
            let deleteQuery = `DELETE FROM [dbo].[TODVZ_NUMERATOR] WHERE [TUR] = @tur`;
            if (yaziciId !== null && yaziciId !== undefined && yaziciId !== 0) {
                request.input("yaziciId", sql.Int, toInt(yaziciId));
                deleteQuery += ` AND [YAZICI_ID] = @yaziciId;`;
            }
            else {
                deleteQuery += ` AND (ISNULL([YAZICI_ID], 0) = 0);`;
            }
            const result = await request.query(deleteQuery);
            return (result.rowsAffected[0] || 0) > 0;
        }
        catch (error) {
            logger.error(`NumeratorSqlRepository.delete(${tur}, ${yaziciId}) error:`, error);
            throw error;
        }
    }
}
