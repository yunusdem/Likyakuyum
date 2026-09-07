import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface TodvzYaziciEntity {
  YAZICI_ID: number;
  SIRA_NO: number;
  AD: string;
  CIHAZ_ADI: string | null;
  BAGLANTI_NOKTASI: string | null;
  BELGE_YAZICI_MODU: number | null;
  BELGE_YAZICI_DIZINI: string | null;
  KOPYA_SAYISI: number | null;
}

export interface YaziciModel {
  id: number;
  siraNo: number;
  ad: string;
  cihazAdi: string | null;
  baglantiNoktasi: string | null;
  belgeYaziciModu: number;
  belgeYaziciDizini: string | null;
  kopyaSayisi: number;
}

export interface YaziciInputDto {
  siraNo?: number;
  ad: string;
  cihazAdi?: string | null;
  baglantiNoktasi?: string | null;
  belgeYaziciModu?: number;
  belgeYaziciDizini?: string | null;
  kopyaSayisi?: number;
}

const toNullableString = (val?: string | null, maxLen?: number): string | null => {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return maxLen ? trimmed.slice(0, maxLen) : trimmed;
};

const toInt = (val: any, defaultVal = 0): number => {
  if (val === undefined || val === null || val === "") return defaultVal;
  const parsed = parseInt(String(val), 10);
  return isNaN(parsed) ? defaultVal : parsed;
};

export class YaziciSqlRepository {
  private static mapEntityToModel(entity: TodvzYaziciEntity): YaziciModel {
    return {
      id: entity.YAZICI_ID,
      siraNo: entity.SIRA_NO ?? 1,
      ad: (entity.AD || "").trim(),
      cihazAdi: entity.CIHAZ_ADI ? entity.CIHAZ_ADI.trim() : null,
      baglantiNoktasi: entity.BAGLANTI_NOKTASI ? entity.BAGLANTI_NOKTASI.trim() : null,
      belgeYaziciModu: entity.BELGE_YAZICI_MODU ?? 0,
      belgeYaziciDizini: entity.BELGE_YAZICI_DIZINI ? entity.BELGE_YAZICI_DIZINI.trim() : null,
      kopyaSayisi: entity.KOPYA_SAYISI ?? 1,
    };
  }

  public static async findAll(dbContext?: { dbServer?: string; dbName?: string }): Promise<YaziciModel[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const query = `
        SELECT 
          [YAZICI_ID],
          [SIRA_NO],
          [AD],
          [CIHAZ_ADI],
          [BAGLANTI_NOKTASI],
          [BELGE_YAZICI_MODU],
          [BELGE_YAZICI_DIZINI],
          [KOPYA_SAYISI]
        FROM [dbo].[TODVZ_YAZICI]
        ORDER BY [SIRA_NO] ASC, [YAZICI_ID] ASC;
      `;
      const result = await pool.request().query<TodvzYaziciEntity>(query);
      return result.recordset.map(YaziciSqlRepository.mapEntityToModel);
    } catch (error) {
      logger.error("YaziciSqlRepository.findAll error:", error);
      throw error;
    }
  }

  public static async findById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();
      request.input("id", sql.Int, parseInt(String(id), 10));

      const query = `
        SELECT TOP 1
          [YAZICI_ID],
          [SIRA_NO],
          [AD],
          [CIHAZ_ADI],
          [BAGLANTI_NOKTASI],
          [BELGE_YAZICI_MODU],
          [BELGE_YAZICI_DIZINI],
          [KOPYA_SAYISI]
        FROM [dbo].[TODVZ_YAZICI]
        WHERE [YAZICI_ID] = @id;
      `;
      const result = await request.query<TodvzYaziciEntity>(query);
      if (!result.recordset || result.recordset.length === 0) return null;
      return YaziciSqlRepository.mapEntityToModel(result.recordset[0]);
    } catch (error) {
      logger.error(`YaziciSqlRepository.findById(${id}) error:`, error);
      throw error;
    }
  }

  public static async create(
    data: YaziciInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();

      request.input("SIRA_NO", sql.Int, toInt(data.siraNo, 1));
      request.input("AD", sql.VarChar(200), (data.ad || "").trim().slice(0, 200));
      request.input("CIHAZ_ADI", sql.VarChar(200), toNullableString(data.cihazAdi, 200));
      request.input("BAGLANTI_NOKTASI", sql.VarChar(200), toNullableString(data.baglantiNoktasi, 200));
      request.input("BELGE_YAZICI_MODU", sql.TinyInt, data.belgeYaziciModu ?? 0);
      request.input("BELGE_YAZICI_DIZINI", sql.VarChar(100), toNullableString(data.belgeYaziciDizini, 100));
      request.input("KOPYA_SAYISI", sql.Int, Math.max(1, toInt(data.kopyaSayisi, 1)));

      const insertQuery = `
        INSERT INTO [dbo].[TODVZ_YAZICI] (
          [SIRA_NO],
          [AD],
          [CIHAZ_ADI],
          [BAGLANTI_NOKTASI],
          [BELGE_YAZICI_MODU],
          [BELGE_YAZICI_DIZINI],
          [KOPYA_SAYISI]
        )
        VALUES (
          @SIRA_NO,
          @AD,
          @CIHAZ_ADI,
          @BAGLANTI_NOKTASI,
          @BELGE_YAZICI_MODU,
          @BELGE_YAZICI_DIZINI,
          @KOPYA_SAYISI
        );
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS [YAZICI_ID];
      `;

      const result = await request.query<{ YAZICI_ID: number }>(insertQuery);
      const newId = result.recordset[0]?.YAZICI_ID;


      const created = await YaziciSqlRepository.findById(newId, dbContext);
      if (!created) {
        throw ApiError.internal("Yazıcı tanımlandı fakat kayıt bilgisi okunamadı.");
      }
      return created;
    } catch (error) {
      logger.error("YaziciSqlRepository.create error:", error);
      throw error;
    }
  }

  public static async update(
    id: number | string,
    data: YaziciInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();

      request.input("YAZICI_ID", sql.Int, parseInt(String(id), 10));
      request.input("SIRA_NO", sql.Int, toInt(data.siraNo, 1));
      request.input("AD", sql.VarChar(200), (data.ad || "").trim().slice(0, 200));
      request.input("CIHAZ_ADI", sql.VarChar(200), toNullableString(data.cihazAdi, 200));
      request.input("BAGLANTI_NOKTASI", sql.VarChar(200), toNullableString(data.baglantiNoktasi, 200));
      request.input("BELGE_YAZICI_MODU", sql.TinyInt, data.belgeYaziciModu ?? 0);
      request.input("BELGE_YAZICI_DIZINI", sql.VarChar(100), toNullableString(data.belgeYaziciDizini, 100));
      request.input("KOPYA_SAYISI", sql.Int, Math.max(1, toInt(data.kopyaSayisi, 1)));

      const updateQuery = `
        UPDATE [dbo].[TODVZ_YAZICI]
        SET
          [SIRA_NO] = @SIRA_NO,
          [AD] = @AD,
          [CIHAZ_ADI] = @CIHAZ_ADI,
          [BAGLANTI_NOKTASI] = @BAGLANTI_NOKTASI,
          [BELGE_YAZICI_MODU] = @BELGE_YAZICI_MODU,
          [BELGE_YAZICI_DIZINI] = @BELGE_YAZICI_DIZINI,
          [KOPYA_SAYISI] = @KOPYA_SAYISI
        WHERE [YAZICI_ID] = @YAZICI_ID;
      `;

      await request.query(updateQuery);
      return YaziciSqlRepository.findById(id, dbContext);
    } catch (error) {
      logger.error(`YaziciSqlRepository.update(${id}) error:`, error);
      throw error;
    }
  }

  public static async delete(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const parsedId = parseInt(String(id), 10);

      // Check if printer is assigned to any Cash Desk (TODVZ_VEZNE)
      const vezneCheck = await pool.request()
        .input("yaziciId", sql.Int, parsedId)
        .query<{ COUNT: number }>(`
          SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_VEZNE]
          WHERE [ALIS_FISI_YAZICI_ID] = @yaziciId 
             OR [SATIS_FISI_YAZICI_ID] = @yaziciId
             OR [ALTIN_ALIS_FISI_YAZICI_ID] = @yaziciId
             OR [ALTIN_SATIS_FISI_YAZICI_ID] = @yaziciId
             OR [MUSTERI_TANI_FORMU_YAZICI_ID] = @yaziciId
        `);

      if (vezneCheck.recordset[0]?.COUNT > 0) {
        throw ApiError.badRequest("Bu yazıcıya bağlı vezne tanımları bulunmaktadır. Önce ilgili veznelerdeki yazıcı seçimini değiştiriniz.");
      }

      // Check if assigned to any user
      const userCheck = await pool.request()
        .input("yaziciId", sql.Int, parsedId)
        .query<{ COUNT: number }>("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_KULLANICI] WHERE [YAZICI_ID] = @yaziciId");

      if (userCheck.recordset[0]?.COUNT > 0) {
        throw ApiError.badRequest("Bu yazıcıya atanmış kullanıcılar bulunmaktadır. Önce kullanıcıların yazıcı atamasını değiştiriniz.");
      }

      const request = pool.request();
      request.input("YAZICI_ID", sql.Int, parsedId);
      const result = await request.query("DELETE FROM [dbo].[TODVZ_YAZICI] WHERE [YAZICI_ID] = @YAZICI_ID");
      return (result.rowsAffected[0] || 0) > 0;
    } catch (error) {
      logger.error(`YaziciSqlRepository.delete(${id}) error:`, error);
      throw error;
    }
  }
}
