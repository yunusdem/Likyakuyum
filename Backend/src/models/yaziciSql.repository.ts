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

  /**
   * Checks where a printer is currently assigned/used (Vezneler, Kullanıcılar, Numaratörler)
   */
  public static async getYaziciUsage(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{
    hasVezne: boolean;
    vezneCount: number;
    vezneDetails: { vezneKod: string; vezneAd: string; roles: string[] }[];
    hasKullanici: boolean;
    kullaniciCount: number;
    kullaniciNames: string[];
    hasNumerator: boolean;
    numeratorCount: number;
    numeratorDetails: { tur: number; onek: string }[];
  }> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    const parsedId = parseInt(String(id), 10);

    // 1. Vezne kullanımı
    let vezneDetails: { vezneKod: string; vezneAd: string; roles: string[] }[] = [];
    try {
      const vRes = await pool.request()
        .input("yaziciId", sql.Int, parsedId)
        .query<{
          VEZNE_KOD: string;
          VEZNE_AD: string;
          ALIS_FISI_YAZICI_ID: number | null;
          SATIS_FISI_YAZICI_ID: number | null;
          ALTIN_ALIS_FISI_YAZICI_ID: number | null;
          ALTIN_SATIS_FISI_YAZICI_ID: number | null;
          MUSTERI_TANI_FORMU_YAZICI_ID: number | null;
        }>(`
          SELECT 
            LTRIM(RTRIM(ISNULL(KOD, ''))) as VEZNE_KOD,
            LTRIM(RTRIM(ISNULL(AD, ''))) as VEZNE_AD,
            ALIS_FISI_YAZICI_ID,
            SATIS_FISI_YAZICI_ID,
            ALTIN_ALIS_FISI_YAZICI_ID,
            ALTIN_SATIS_FISI_YAZICI_ID,
            MUSTERI_TANI_FORMU_YAZICI_ID
          FROM [dbo].[TODVZ_VEZNE]
          WHERE [ALIS_FISI_YAZICI_ID] = @yaziciId 
             OR [SATIS_FISI_YAZICI_ID] = @yaziciId
             OR [ALTIN_ALIS_FISI_YAZICI_ID] = @yaziciId
             OR [ALTIN_SATIS_FISI_YAZICI_ID] = @yaziciId
             OR [MUSTERI_TANI_FORMU_YAZICI_ID] = @yaziciId
        `);

      vezneDetails = vRes.recordset.map((r) => {
        const roles: string[] = [];
        if (r.ALIS_FISI_YAZICI_ID === parsedId) roles.push("Döviz Alış Fişi");
        if (r.SATIS_FISI_YAZICI_ID === parsedId) roles.push("Döviz Satış Fişi");
        if (r.ALTIN_ALIS_FISI_YAZICI_ID === parsedId) roles.push("Altın Alış Fişi");
        if (r.ALTIN_SATIS_FISI_YAZICI_ID === parsedId) roles.push("Altın Satış Fişi");
        if (r.MUSTERI_TANI_FORMU_YAZICI_ID === parsedId) roles.push("Müşteri Tanıma Formu");
        return {
          vezneKod: r.VEZNE_KOD,
          vezneAd: r.VEZNE_AD,
          roles,
        };
      });
    } catch (err) {
      logger.warn("YaziciSqlRepository.getYaziciUsage vezne check warning:", err);
    }

    // 2. Kullanıcı kullanımı
    let kullaniciNames: string[] = [];
    try {
      const uRes = await pool.request()
        .input("yaziciId", sql.Int, parsedId)
        .query<{ AD: string }>(`
          SELECT LTRIM(RTRIM(ISNULL(AD, ''))) as AD
          FROM [dbo].[TODVZ_KULLANICI]
          WHERE [YAZICI_ID] = @yaziciId
        `);
      kullaniciNames = uRes.recordset.map((r) => r.AD || "Kullanıcı");
    } catch (err) {
      logger.warn("YaziciSqlRepository.getYaziciUsage user check warning:", err);
    }

    // 3. Numaratör kullanımı
    let numeratorDetails: { tur: number; onek: string }[] = [];
    try {
      const nRes = await pool.request()
        .input("yaziciId", sql.Int, parsedId)
        .query<{ TUR: number; ONEK: string }>(`
          SELECT TUR, LTRIM(RTRIM(ISNULL(ONEK, ''))) as ONEK
          FROM [dbo].[TODVZ_NUMERATOR]
          WHERE [YAZICI_ID] = @yaziciId
        `);
      numeratorDetails = nRes.recordset.map((r) => ({
        tur: r.TUR,
        onek: r.ONEK || "-",
      }));
    } catch (err) {
      logger.warn("YaziciSqlRepository.getYaziciUsage numerator check warning:", err);
    }

    return {
      hasVezne: vezneDetails.length > 0,
      vezneCount: vezneDetails.length,
      vezneDetails,
      hasKullanici: kullaniciNames.length > 0,
      kullaniciCount: kullaniciNames.length,
      kullaniciNames,
      hasNumerator: numeratorDetails.length > 0,
      numeratorCount: numeratorDetails.length,
      numeratorDetails,
    };
  }

  public static async delete(
    id: number | string,
    options?: { force?: boolean },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const parsedId = parseInt(String(id), 10);

      // Force delete: Veznelerdeki, kullanıcılardaki ve numaratörlerdeki bağlantıları temizle
      if (options?.force) {
        // 1. Veznelerdeki fiş ve form yazıcı atamalarını sıfırla (NULL yap)
        try {
          await pool.request()
            .input("yaziciId", sql.Int, parsedId)
            .query(`
              UPDATE [dbo].[TODVZ_VEZNE]
              SET 
                [ALIS_FISI_YAZICI_ID] = CASE WHEN [ALIS_FISI_YAZICI_ID] = @yaziciId THEN NULL ELSE [ALIS_FISI_YAZICI_ID] END,
                [SATIS_FISI_YAZICI_ID] = CASE WHEN [SATIS_FISI_YAZICI_ID] = @yaziciId THEN NULL ELSE [SATIS_FISI_YAZICI_ID] END,
                [ALTIN_ALIS_FISI_YAZICI_ID] = CASE WHEN [ALTIN_ALIS_FISI_YAZICI_ID] = @yaziciId THEN NULL ELSE [ALTIN_ALIS_FISI_YAZICI_ID] END,
                [ALTIN_SATIS_FISI_YAZICI_ID] = CASE WHEN [ALTIN_SATIS_FISI_YAZICI_ID] = @yaziciId THEN NULL ELSE [ALTIN_SATIS_FISI_YAZICI_ID] END,
                [MUSTERI_TANI_FORMU_YAZICI_ID] = CASE WHEN [MUSTERI_TANI_FORMU_YAZICI_ID] = @yaziciId THEN NULL ELSE [MUSTERI_TANI_FORMU_YAZICI_ID] END
              WHERE [ALIS_FISI_YAZICI_ID] = @yaziciId 
                 OR [SATIS_FISI_YAZICI_ID] = @yaziciId
                 OR [ALTIN_ALIS_FISI_YAZICI_ID] = @yaziciId
                 OR [ALTIN_SATIS_FISI_YAZICI_ID] = @yaziciId
                 OR [MUSTERI_TANI_FORMU_YAZICI_ID] = @yaziciId;
            `);
        } catch (vErr) {
          logger.warn("YaziciSqlRepository.delete cleanup vezne warning:", vErr);
        }

        // 2. Kullanıcılardaki yazıcı atamasını sıfırla (NULL yap)
        try {
          await pool.request()
            .input("yaziciId", sql.Int, parsedId)
            .query(`
              UPDATE [dbo].[TODVZ_KULLANICI]
              SET [YAZICI_ID] = NULL
              WHERE [YAZICI_ID] = @yaziciId;
            `);
        } catch (uErr) {
          logger.warn("YaziciSqlRepository.delete cleanup user warning:", uErr);
        }

        // 3. Yazıcıya bağlı numaratör satırlarını sil
        try {
          await pool.request()
            .input("yaziciId", sql.Int, parsedId)
            .query(`
              DELETE FROM [dbo].[TODVZ_NUMERATOR]
              WHERE [YAZICI_ID] = @yaziciId;
            `);
        } catch (nErr) {
          logger.warn("YaziciSqlRepository.delete cleanup numerator warning:", nErr);
        }
      } else {
        // Normal delete: Kontrolleri çalıştır
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

        const userCheck = await pool.request()
          .input("yaziciId", sql.Int, parsedId)
          .query<{ COUNT: number }>("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_KULLANICI] WHERE [YAZICI_ID] = @yaziciId");

        if (userCheck.recordset[0]?.COUNT > 0) {
          throw ApiError.badRequest("Bu yazıcıya atanmış kullanıcılar bulunmaktadır. Önce kullanıcıların yazıcı atamasını değiştiriniz.");
        }

        const numCheck = await pool.request()
          .input("yaziciId", sql.Int, parsedId)
          .query<{ COUNT: number }>("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_NUMERATOR] WHERE [YAZICI_ID] = @yaziciId");

        if (numCheck.recordset[0]?.COUNT > 0) {
          throw ApiError.badRequest("Bu yazıcıya ait numaratör tanımları bulunmaktadır.");
        }
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
