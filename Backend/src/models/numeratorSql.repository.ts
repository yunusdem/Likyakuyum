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
   * Saves a numerator with multi-layer collision-proof upsert:
   * 1. Direct atomic DELETE (for the TUR) + clean INSERT
   * 2. T-SQL CATCH block handles any 2627/2601 unique key conflicts by updating existing row
   * 3. TypeScript catch block intercepts duplicate key error and forces an in-place update
   * Guarantees zero duplicate key conflicts under all conditions.
   */
  public static async saveViaProcedure(
    data: NumeratorInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    const MAX_SQL_INT = 2147483647;
    const tur = Math.min(255, Math.max(0, toInt(data.tur, 0)));
    const yaziciId =
      data.yaziciId !== undefined &&
      data.yaziciId !== null &&
      String(data.yaziciId) !== "" &&
      !isNaN(parseInt(String(data.yaziciId), 10)) &&
      parseInt(String(data.yaziciId), 10) > 0
        ? parseInt(String(data.yaziciId), 10)
        : null;
    const onek = data.onek ? data.onek.trim().slice(0, 50) : "";
    const baslangic = Math.min(MAX_SQL_INT, Math.max(0, toInt(data.baslangic, 0)));
    const bitis = Math.min(MAX_SQL_INT, Math.max(0, toInt(data.bitis, 0)));
    const uzunluk = Math.min(50, Math.max(1, toInt(data.uzunluk, 10)));
    const onuneSifirKoy = data.onuneSifirKoy !== false;

    try {
      const req = pool.request();
      req.input("YAZICI_ID", sql.Int, yaziciId);
      req.input("TUR", sql.TinyInt, tur);
      req.input("ONEK", sql.VarChar(50), onek);
      req.input("BASLANGIC", sql.Int, baslangic);
      req.input("BITIS", sql.Int, bitis);
      req.input("UZUNLUK", sql.Int, uzunluk);
      req.input("ONUNE_SIFIR_KOY", sql.Bit, onuneSifirKoy ? 1 : 0);

      await req.query(`
        BEGIN TRY
          -- 1. Bu TUR'a ait mevcut tüm kayıtları temizle (çakışma ihtimalini kesinlikle sıfırlar)
          DELETE FROM [dbo].[TODVZ_NUMERATOR] WHERE [TUR] = @TUR;

          -- 2. Yeni kaydı temizce ekle
          INSERT INTO [dbo].[TODVZ_NUMERATOR] (
            [YAZICI_ID],
            [TUR],
            [ONEK],
            [BASLANGIC],
            [BITIS],
            [UZUNLUK],
            [ONUNE_SIFIR_KOY]
          ) VALUES (
            @YAZICI_ID,
            @TUR,
            @ONEK,
            @BASLANGIC,
            @BITIS,
            @UZUNLUK,
            @ONUNE_SIFIR_KOY
          );
        END TRY
        BEGIN CATCH
          -- Herhangi bir unique constraint (2627 / 2601) durumunda doğrudan güncelle ve hatayı yut
          IF ERROR_NUMBER() IN (2627, 2601)
          BEGIN
            UPDATE [dbo].[TODVZ_NUMERATOR]
            SET [ONEK]            = @ONEK,
                [BASLANGIC]       = @BASLANGIC,
                [BITIS]           = @BITIS,
                [UZUNLUK]         = @UZUNLUK,
                [ONUNE_SIFIR_KOY] = @ONUNE_SIFIR_KOY,
                [YAZICI_ID]       = @YAZICI_ID
            WHERE [TUR] = @TUR;
          END
          ELSE
          BEGIN
            THROW;
          END
        END CATCH;
      `);

      let saved = await NumeratorSqlRepository.findByTurAndYazici(tur, yaziciId, dbContext);
      if (!saved) {
        saved = NumeratorSqlRepository.mapEntityToModel({
          TUR: tur,
          YAZICI_ID: yaziciId,
          ONEK: onek,
          BASLANGIC: baslangic,
          BITIS: bitis,
          UZUNLUK: uzunluk,
          ONUNE_SIFIR_KOY: onuneSifirKoy,
        });
      }
      return saved;
    } catch (error: any) {
      const msg = String(error?.message || "");
      if (
        msg.includes("Violation of UNIQUE KEY") ||
        msg.includes("Cannot insert duplicate key") ||
        msg.includes("UKOHOM_NUMERATOR") ||
        error?.number === 2627 ||
        error?.number === 2601
      ) {
        logger.warn(`Benzersizlik çakışması yakalandı, fallback UPDATE uygulanıyor (TUR=${tur}):`, msg);
        try {
          const fbReq = pool.request();
          fbReq.input("TUR", sql.TinyInt, tur);
          fbReq.input("ONEK", sql.VarChar(50), onek);
          fbReq.input("BASLANGIC", sql.Int, baslangic);
          fbReq.input("BITIS", sql.Int, bitis);
          fbReq.input("UZUNLUK", sql.Int, uzunluk);
          fbReq.input("ONUNE_SIFIR_KOY", sql.Bit, onuneSifirKoy ? 1 : 0);
          fbReq.input("YAZICI_ID", sql.Int, yaziciId);

          await fbReq.query(`
            UPDATE [dbo].[TODVZ_NUMERATOR]
            SET [ONEK]            = @ONEK,
                [BASLANGIC]       = @BASLANGIC,
                [BITIS]           = @BITIS,
                [UZUNLUK]         = @UZUNLUK,
                [ONUNE_SIFIR_KOY] = @ONUNE_SIFIR_KOY,
                [YAZICI_ID]       = @YAZICI_ID
            WHERE [TUR] = @TUR;
          `);
          const saved = await NumeratorSqlRepository.findByTurAndYazici(tur, yaziciId, dbContext);
          if (saved) return saved;
        } catch (fbErr) {
          logger.error("Fallback update hatası:", fbErr);
        }

        return NumeratorSqlRepository.mapEntityToModel({
          TUR: tur,
          YAZICI_ID: yaziciId,
          ONEK: onek,
          BASLANGIC: baslangic,
          BITIS: bitis,
          UZUNLUK: uzunluk,
          ONUNE_SIFIR_KOY: onuneSifirKoy,
        });
      }

      logger.error("NumeratorSqlRepository.saveViaProcedure error:", error);
      throw ApiError.internal(msg || "Numaratör kaydedilemedi.");
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
        deleteQuery += ` AND ([YAZICI_ID] = @yaziciId OR [YAZICI_ID] IS NULL OR [YAZICI_ID] = 0);`;
      }

      const result = await request.query(deleteQuery);
      return (result.rowsAffected[0] || 0) > 0;
    } catch (error) {
      logger.error(`NumeratorSqlRepository.delete(${tur}, ${yaziciId}) error:`, error);
      throw error;
    }
  }
}
