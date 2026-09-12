import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface TodvzNumeratorEntity {
  YAZICI_ID: number | null;
  TUR: number;
  ONEK: string | null;
  BASLANGIC: number;
  BITIS: number;
  UZUNLUK: number;
  ONUNE_SIFIR_KOY: boolean | null;
  YAZICI_ADI?: string | null;
}

export interface NumeratorModel {
  id: string; // Composite ID: `${tur}_${yaziciId ?? "null"}`
  tur: number;
  yaziciId: number | null;
  yaziciAdi?: string | null;
  onek: string;
  baslangic: number;
  bitis: number;
  uzunluk: number;
  onuneSifirKoy: boolean;
  ornekNumara: string;
}

export interface NumeratorInputDto {
  tur: number;
  yaziciId?: number | null;
  yaziciOrtakAlan?: boolean;
  onek?: string | null;
  baslangic?: number;
  bitis?: number;
  uzunluk?: number;
  onuneSifirKoy?: boolean;
}

const toFloat = (val: any, defaultVal = 0): number => {
  if (val === undefined || val === null || val === "") return defaultVal;
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? defaultVal : parsed;
};

const toInt = (val: any, defaultVal = 0): number => {
  if (val === undefined || val === null || val === "") return defaultVal;
  const parsed = parseInt(String(val), 10);
  return isNaN(parsed) ? defaultVal : parsed;
};

function formatOrnekNumara(onek: string, baslangic: number, uzunluk: number, onuneSifirKoy: boolean): string {
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
  private static mapEntityToModel(entity: TodvzNumeratorEntity): NumeratorModel {
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

  public static async findAll(dbContext?: { dbServer?: string; dbName?: string }): Promise<NumeratorModel[]> {
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
      const result = await pool.request().query<TodvzNumeratorEntity>(query);
      return result.recordset.map(NumeratorSqlRepository.mapEntityToModel);
    } catch (error) {
      logger.error("NumeratorSqlRepository.findAll error:", error);
      throw error;
    }
  }

  public static async findByTurAndYazici(
    tur: number,
    yaziciId: number | null,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel | null> {
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
      } else {
        query += ` AND (n.[YAZICI_ID] IS NULL OR n.[YAZICI_ID] = 0);`;
      }

      const result = await request.query<TodvzNumeratorEntity>(query);
      if (!result.recordset || result.recordset.length === 0) {
        // Fallback: search by TUR alone if exact yazici match was empty
        const fallbackReq = pool.request();
        fallbackReq.input("tur", sql.TinyInt, toInt(tur, 0));
        const fallbackRes = await fallbackReq.query<TodvzNumeratorEntity>(`
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
          WHERE n.[TUR] = @tur;
        `);
        if (!fallbackRes.recordset || fallbackRes.recordset.length === 0) return null;
        return NumeratorSqlRepository.mapEntityToModel(fallbackRes.recordset[0]);
      }
      return NumeratorSqlRepository.mapEntityToModel(result.recordset[0]);
    } catch (error) {
      logger.error(`NumeratorSqlRepository.findByTurAndYazici(${tur}, ${yaziciId}) error:`, error);
      throw error;
    }
  }

  /**
   * Saves (inserts or updates) a numerator definition using the SODVZ_NUMERATOR_KAYDET stored procedure.
   * Cleans up mismatched records for the same TUR first to prevent duplicate key constraint violations.
   */
  public static async saveViaProcedure(
    data: NumeratorInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

      const MAX_SQL_INT = 2147483647;
      const tur = Math.min(255, Math.max(0, toInt(data.tur, 0)));
      const rawYaziciId =
        data.yaziciId !== undefined &&
        data.yaziciId !== null &&
        String(data.yaziciId) !== "" &&
        !isNaN(parseInt(String(data.yaziciId), 10))
          ? parseInt(String(data.yaziciId), 10)
          : null;
      const cleanYaziciId = rawYaziciId !== null && rawYaziciId > 0 ? rawYaziciId : null;
      const onek = data.onek ? data.onek.trim().slice(0, 50) : "";
      const baslangic = Math.min(MAX_SQL_INT, Math.max(0, toInt(data.baslangic, 0)));
      const bitis = Math.min(MAX_SQL_INT, Math.max(0, toInt(data.bitis, 0)));
      const uzunluk = Math.min(50, Math.max(1, toInt(data.uzunluk, 10)));
      const onuneSifirKoy = data.onuneSifirKoy !== false;
      const yaziciOrtakAlan = cleanYaziciId === null ? 1 : 0;

      // 1. Yazıcı değişikliği veya yeniden oluşturma durumlarında çakışan eski kaydı temizle
      const cleanupReq = pool.request();
      cleanupReq.input("TUR", sql.TinyInt, tur);
      if (cleanYaziciId !== null) {
        cleanupReq.input("YAZICI_ID", sql.Int, cleanYaziciId);
        await cleanupReq.query(`
          DELETE FROM [dbo].[TODVZ_NUMERATOR] 
          WHERE [TUR] = @TUR AND ([YAZICI_ID] IS NULL OR [YAZICI_ID] <> @YAZICI_ID);
        `);
      } else {
        await cleanupReq.query(`
          DELETE FROM [dbo].[TODVZ_NUMERATOR] 
          WHERE [TUR] = @TUR AND [YAZICI_ID] IS NOT NULL;
        `);
      }

      // 2. SODVZ_NUMERATOR_KAYDET Stored Procedure çağrısı
      try {
        const procReq = pool.request();
        procReq.input("YAZICI_ORTAK_ALAN", sql.Bit, yaziciOrtakAlan);
        procReq.input("YAZICI_ID", sql.Int, cleanYaziciId);
        procReq.input("TUR", sql.TinyInt, tur);
        procReq.input("ONEK", sql.VarChar(50), onek);
        procReq.input("BASLANGIC", sql.Int, baslangic);
        procReq.input("BITIS", sql.Int, bitis);
        procReq.input("UZUNLUK", sql.Int, uzunluk);
        procReq.input("ONUNE_SIFIR_KOY", sql.Bit, onuneSifirKoy ? 1 : 0);

        await procReq.execute("SODVZ_NUMERATOR_KAYDET");
      } catch (procErr: any) {
        logger.warn(`SODVZ_NUMERATOR_KAYDET SP hatası, direkt sorgu ile tamamlanıyor: ${procErr?.message}`);
        
        // Fallback: Prosedürde beklenmeyen bir durum olursa doğrudan atomik upsert yap
        const fallbackReq = pool.request();
        fallbackReq.input("YAZICI_ID", sql.Int, cleanYaziciId);
        fallbackReq.input("TUR", sql.TinyInt, tur);
        fallbackReq.input("ONEK", sql.VarChar(50), onek);
        fallbackReq.input("BASLANGIC", sql.Int, baslangic);
        fallbackReq.input("BITIS", sql.Int, bitis);
        fallbackReq.input("UZUNLUK", sql.Int, uzunluk);
        fallbackReq.input("ONUNE_SIFIR_KOY", sql.Bit, onuneSifirKoy ? 1 : 0);

        await fallbackReq.query(`
          IF EXISTS (SELECT 1 FROM [dbo].[TODVZ_NUMERATOR] WHERE [TUR] = @TUR)
          BEGIN
            UPDATE [dbo].[TODVZ_NUMERATOR]
            SET [YAZICI_ID] = @YAZICI_ID,
                [ONEK] = @ONEK,
                [BASLANGIC] = @BASLANGIC,
                [BITIS] = @BITIS,
                [UZUNLUK] = @UZUNLUK,
                [ONUNE_SIFIR_KOY] = @ONUNE_SIFIR_KOY
            WHERE [TUR] = @TUR;
          END
          ELSE
          BEGIN
            INSERT INTO [dbo].[TODVZ_NUMERATOR] (
              [YAZICI_ID], [TUR], [ONEK], [BASLANGIC], [BITIS], [UZUNLUK], [ONUNE_SIFIR_KOY]
            )
            VALUES (
              @YAZICI_ID, @TUR, @ONEK, @BASLANGIC, @BITIS, @UZUNLUK, @ONUNE_SIFIR_KOY
            );
          END
        `);
      }

      const saved = await NumeratorSqlRepository.findByTurAndYazici(tur, cleanYaziciId, dbContext);
      if (!saved) {
        throw ApiError.internal("Numaratör kaydedildi fakat güncel veri okunamadı.");
      }
      return saved;
    } catch (error: any) {
      logger.error("NumeratorSqlRepository.saveViaProcedure error:", error);
      const msg = error?.message || "Numaratör kaydedilemedi.";
      throw ApiError.internal(msg);
    }
  }

  public static async create(
    data: NumeratorInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel> {
    return NumeratorSqlRepository.saveViaProcedure(data, dbContext);
  }

  public static async update(
    _originalTur: number,
    _originalYaziciId: number | null,
    data: NumeratorInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel | null> {
    return NumeratorSqlRepository.saveViaProcedure(data, dbContext);
  }

  public static async delete(
    tur: number,
    yaziciId: number | null,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();
      request.input("tur", sql.TinyInt, toInt(tur, 0));

      let deleteQuery = `DELETE FROM [dbo].[TODVZ_NUMERATOR] WHERE [TUR] = @tur`;
      if (yaziciId !== null && yaziciId !== undefined && yaziciId !== 0) {
        request.input("yaziciId", sql.Int, toInt(yaziciId));
        deleteQuery += ` AND [YAZICI_ID] = @yaziciId;`;
      } else {
        deleteQuery += ` AND (ISNULL([YAZICI_ID], 0) = 0);`;
      }

      const result = await request.query(deleteQuery);
      return (result.rowsAffected[0] || 0) > 0;
    } catch (error) {
      logger.error(`NumeratorSqlRepository.delete(${tur}, ${yaziciId}) error:`, error);
      throw error;
    }
  }
}
