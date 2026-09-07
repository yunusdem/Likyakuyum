import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface TodvzVezneEntity {
  VEZNE_ID: number;
  KOD: string;
  AD: string;
  FIS_TIPI: number;
  PARA_ID: number | null;
  ALIS_FISI_YAZICI_ID: number | null;
  SATIS_FISI_YAZICI_ID: number | null;
  ALTIN_ALIS_FISI_YAZICI_ID: number | null;
  ALTIN_SATIS_FISI_YAZICI_ID: number | null;
  ALIS_SATIS_IZNI_VAR: boolean | null;
  MUSTERI_TANI_FORMU_YAZICI_ID: number | null;
  MUSTERI_TANI_FORMU_YAZICI_VAR: boolean | null;
  PARA_KODU?: string;
  ALIS_FISI_YAZICI_ADI?: string;
  SATIS_FISI_YAZICI_ADI?: string;
}

export interface VezneModel {
  id: number;
  kod: string;
  ad: string;
  fisTipi: number;
  paraId: number | null;
  alisFisiYaziciId: number | null;
  satisFisiYaziciId: number | null;
  altinAlisFisiYaziciId: number | null;
  altinSatisFisiYaziciId: number | null;
  alisSatisIzniVar: boolean;
  musteriTaniFormuYaziciId: number | null;
  musteriTaniFormuYaziciVar: boolean;
  paraKodu?: string;
  alisFisiYaziciAdi?: string;
  satisFisiYaziciAdi?: string;
}

export interface VezneInputDto {
  kod: string;
  ad: string;
  fisTipi?: number;
  paraId?: number | null;
  alisFisiYaziciId?: number | null;
  satisFisiYaziciId?: number | null;
  altinAlisFisiYaziciId?: number | null;
  altinSatisFisiYaziciId?: number | null;
  alisSatisIzniVar?: boolean;
  musteriTaniFormuYaziciId?: number | null;
  musteriTaniFormuYaziciVar?: boolean;
}

const toBool = (val: any): boolean => {
  return val === true || val === 1 || val === "1" || val === "true";
};

const toNullableInt = (val: any): number | null => {
  if (val === undefined || val === null || val === "" || val === 0 || val === "0") return null;
  const parsed = parseInt(String(val), 10);
  return isNaN(parsed) ? null : parsed;
};

export class VezneSqlRepository {
  private static mapEntityToModel(entity: TodvzVezneEntity): VezneModel {
    return {
      id: entity.VEZNE_ID,
      kod: (entity.KOD || "").trim(),
      ad: (entity.AD || "").trim(),
      fisTipi: entity.FIS_TIPI ?? 2,
      paraId: entity.PARA_ID ?? null,
      alisFisiYaziciId: entity.ALIS_FISI_YAZICI_ID ?? null,
      satisFisiYaziciId: entity.SATIS_FISI_YAZICI_ID ?? null,
      altinAlisFisiYaziciId: entity.ALTIN_ALIS_FISI_YAZICI_ID ?? null,
      altinSatisFisiYaziciId: entity.ALTIN_SATIS_FISI_YAZICI_ID ?? null,
      alisSatisIzniVar: toBool(entity.ALIS_SATIS_IZNI_VAR),
      musteriTaniFormuYaziciId: entity.MUSTERI_TANI_FORMU_YAZICI_ID ?? null,
      musteriTaniFormuYaziciVar: toBool(entity.MUSTERI_TANI_FORMU_YAZICI_VAR),
      paraKodu: entity.PARA_KODU ? entity.PARA_KODU.trim() : undefined,
      alisFisiYaziciAdi: entity.ALIS_FISI_YAZICI_ADI ? entity.ALIS_FISI_YAZICI_ADI.trim() : undefined,
      satisFisiYaziciAdi: entity.SATIS_FISI_YAZICI_ADI ? entity.SATIS_FISI_YAZICI_ADI.trim() : undefined,
    };
  }

  public static async findAll(dbContext?: { dbServer?: string; dbName?: string }): Promise<VezneModel[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const query = `
        SELECT 
          v.[VEZNE_ID],
          v.[KOD],
          v.[AD],
          v.[FIS_TIPI],
          v.[PARA_ID],
          v.[ALIS_FISI_YAZICI_ID],
          v.[SATIS_FISI_YAZICI_ID],
          v.[ALTIN_ALIS_FISI_YAZICI_ID],
          v.[ALTIN_SATIS_FISI_YAZICI_ID],
          v.[ALIS_SATIS_IZNI_VAR],
          v.[MUSTERI_TANI_FORMU_YAZICI_ID],
          v.[MUSTERI_TANI_FORMU_YAZICI_VAR],
          p.[KOD] AS PARA_KODU,
          y1.[AD] AS ALIS_FISI_YAZICI_ADI,
          y2.[AD] AS SATIS_FISI_YAZICI_ADI
        FROM [dbo].[TODVZ_VEZNE] v
        LEFT JOIN [dbo].[TODVZ_PARA] p ON v.[PARA_ID] = p.[PARA_ID]
        LEFT JOIN [dbo].[TODVZ_YAZICI] y1 ON v.[ALIS_FISI_YAZICI_ID] = y1.[YAZICI_ID]
        LEFT JOIN [dbo].[TODVZ_YAZICI] y2 ON v.[SATIS_FISI_YAZICI_ID] = y2.[YAZICI_ID]
        ORDER BY v.[KOD] ASC, v.[VEZNE_ID] ASC;
      `;
      const result = await pool.request().query<TodvzVezneEntity>(query);
      return result.recordset.map(VezneSqlRepository.mapEntityToModel);
    } catch (error) {
      logger.error("VezneSqlRepository.findAll error:", error);
      throw error;
    }
  }

  public static async findById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();
      request.input("id", sql.Int, parseInt(String(id), 10));

      const query = `
        SELECT 
          v.[VEZNE_ID],
          v.[KOD],
          v.[AD],
          v.[FIS_TIPI],
          v.[PARA_ID],
          v.[ALIS_FISI_YAZICI_ID],
          v.[SATIS_FISI_YAZICI_ID],
          v.[ALTIN_ALIS_FISI_YAZICI_ID],
          v.[ALTIN_SATIS_FISI_YAZICI_ID],
          v.[ALIS_SATIS_IZNI_VAR],
          v.[MUSTERI_TANI_FORMU_YAZICI_ID],
          v.[MUSTERI_TANI_FORMU_YAZICI_VAR],
          p.[KOD] AS PARA_KODU,
          y1.[AD] AS ALIS_FISI_YAZICI_ADI,
          y2.[AD] AS SATIS_FISI_YAZICI_ADI
        FROM [dbo].[TODVZ_VEZNE] v
        LEFT JOIN [dbo].[TODVZ_PARA] p ON v.[PARA_ID] = p.[PARA_ID]
        LEFT JOIN [dbo].[TODVZ_YAZICI] y1 ON v.[ALIS_FISI_YAZICI_ID] = y1.[YAZICI_ID]
        LEFT JOIN [dbo].[TODVZ_YAZICI] y2 ON v.[SATIS_FISI_YAZICI_ID] = y2.[YAZICI_ID]
        WHERE v.[VEZNE_ID] = @id;
      `;
      const result = await request.query<TodvzVezneEntity>(query);
      if (!result.recordset || result.recordset.length === 0) return null;
      return VezneSqlRepository.mapEntityToModel(result.recordset[0]);
    } catch (error) {
      logger.error(`VezneSqlRepository.findById(${id}) error:`, error);
      throw error;
    }
  }

  public static async findByCode(
    kod: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();
      request.input("kod", sql.VarChar(5), (kod || "").trim().slice(0, 5));

      const query = `
        SELECT TOP 1 * FROM [dbo].[TODVZ_VEZNE] WHERE [KOD] = @kod;
      `;
      const result = await request.query<TodvzVezneEntity>(query);
      if (!result.recordset || result.recordset.length === 0) return null;
      return VezneSqlRepository.mapEntityToModel(result.recordset[0]);
    } catch (error) {
      logger.error(`VezneSqlRepository.findByCode(${kod}) error:`, error);
      throw error;
    }
  }

  public static async create(
    data: VezneInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneModel> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();

      request.input("KOD", sql.VarChar(5), (data.kod || "").trim().slice(0, 5));
      request.input("AD", sql.VarChar(200), (data.ad || "").trim().slice(0, 200));
      request.input("FIS_TIPI", sql.TinyInt, data.fisTipi ?? 2);
      request.input("PARA_ID", sql.Int, toNullableInt(data.paraId));
      request.input("ALIS_FISI_YAZICI_ID", sql.Int, toNullableInt(data.alisFisiYaziciId));
      request.input("SATIS_FISI_YAZICI_ID", sql.Int, toNullableInt(data.satisFisiYaziciId));
      request.input("ALTIN_ALIS_FISI_YAZICI_ID", sql.Int, toNullableInt(data.altinAlisFisiYaziciId));
      request.input("ALTIN_SATIS_FISI_YAZICI_ID", sql.Int, toNullableInt(data.altinSatisFisiYaziciId));
      request.input("ALIS_SATIS_IZNI_VAR", sql.Bit, toBool(data.alisSatisIzniVar) ? 1 : 0);
      request.input("MUSTERI_TANI_FORMU_YAZICI_ID", sql.Int, toNullableInt(data.musteriTaniFormuYaziciId));
      request.input("MUSTERI_TANI_FORMU_YAZICI_VAR", sql.Bit, toBool(data.musteriTaniFormuYaziciVar) ? 1 : 0);

      const insertQuery = `
        INSERT INTO [dbo].[TODVZ_VEZNE] (
          [KOD],
          [AD],
          [FIS_TIPI],
          [PARA_ID],
          [ALIS_FISI_YAZICI_ID],
          [SATIS_FISI_YAZICI_ID],
          [ALTIN_ALIS_FISI_YAZICI_ID],
          [ALTIN_SATIS_FISI_YAZICI_ID],
          [ALIS_SATIS_IZNI_VAR],
          [MUSTERI_TANI_FORMU_YAZICI_ID],
          [MUSTERI_TANI_FORMU_YAZICI_VAR]
        )
        VALUES (
          @KOD,
          @AD,
          @FIS_TIPI,
          @PARA_ID,
          @ALIS_FISI_YAZICI_ID,
          @SATIS_FISI_YAZICI_ID,
          @ALTIN_ALIS_FISI_YAZICI_ID,
          @ALTIN_SATIS_FISI_YAZICI_ID,
          @ALIS_SATIS_IZNI_VAR,
          @MUSTERI_TANI_FORMU_YAZICI_ID,
          @MUSTERI_TANI_FORMU_YAZICI_VAR
        );
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS [VEZNE_ID];
      `;

      const result = await request.query<{ VEZNE_ID: number }>(insertQuery);
      const newId = result.recordset[0]?.VEZNE_ID;


      const created = await VezneSqlRepository.findById(newId, dbContext);
      if (!created) {
        throw ApiError.internal("Vezne oluşturuldu fakat kayıt bilgisine ulaşılamadı.");
      }
      return created;
    } catch (error) {
      logger.error("VezneSqlRepository.create error:", error);
      throw error;
    }
  }

  public static async update(
    id: number | string,
    data: VezneInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();

      request.input("VEZNE_ID", sql.Int, parseInt(String(id), 10));
      request.input("KOD", sql.VarChar(5), (data.kod || "").trim().slice(0, 5));
      request.input("AD", sql.VarChar(200), (data.ad || "").trim().slice(0, 200));
      request.input("FIS_TIPI", sql.TinyInt, data.fisTipi ?? 2);
      request.input("PARA_ID", sql.Int, toNullableInt(data.paraId));
      request.input("ALIS_FISI_YAZICI_ID", sql.Int, toNullableInt(data.alisFisiYaziciId));
      request.input("SATIS_FISI_YAZICI_ID", sql.Int, toNullableInt(data.satisFisiYaziciId));
      request.input("ALTIN_ALIS_FISI_YAZICI_ID", sql.Int, toNullableInt(data.altinAlisFisiYaziciId));
      request.input("ALTIN_SATIS_FISI_YAZICI_ID", sql.Int, toNullableInt(data.altinSatisFisiYaziciId));
      request.input("ALIS_SATIS_IZNI_VAR", sql.Bit, toBool(data.alisSatisIzniVar) ? 1 : 0);
      request.input("MUSTERI_TANI_FORMU_YAZICI_ID", sql.Int, toNullableInt(data.musteriTaniFormuYaziciId));
      request.input("MUSTERI_TANI_FORMU_YAZICI_VAR", sql.Bit, toBool(data.musteriTaniFormuYaziciVar) ? 1 : 0);

      const updateQuery = `
        UPDATE [dbo].[TODVZ_VEZNE]
        SET
          [KOD] = @KOD,
          [AD] = @AD,
          [FIS_TIPI] = @FIS_TIPI,
          [PARA_ID] = @PARA_ID,
          [ALIS_FISI_YAZICI_ID] = @ALIS_FISI_YAZICI_ID,
          [SATIS_FISI_YAZICI_ID] = @SATIS_FISI_YAZICI_ID,
          [ALTIN_ALIS_FISI_YAZICI_ID] = @ALTIN_ALIS_FISI_YAZICI_ID,
          [ALTIN_SATIS_FISI_YAZICI_ID] = @ALTIN_SATIS_FISI_YAZICI_ID,
          [ALIS_SATIS_IZNI_VAR] = @ALIS_SATIS_IZNI_VAR,
          [MUSTERI_TANI_FORMU_YAZICI_ID] = @MUSTERI_TANI_FORMU_YAZICI_ID,
          [MUSTERI_TANI_FORMU_YAZICI_VAR] = @MUSTERI_TANI_FORMU_YAZICI_VAR
        WHERE [VEZNE_ID] = @VEZNE_ID;
      `;

      await request.query(updateQuery);
      return VezneSqlRepository.findById(id, dbContext);
    } catch (error) {
      logger.error(`VezneSqlRepository.update(${id}) error:`, error);
      throw error;
    }
  }

  public static async delete(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();
      request.input("VEZNE_ID", sql.Int, parseInt(String(id), 10));

      // Optional integrity check: check if users are assigned to this cashier desk
      const userCheck = await pool.request()
        .input("vezneId", sql.Int, parseInt(String(id), 10))
        .query<{ COUNT: number }>("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_KULLANICI] WHERE [VEZNE_ID] = @vezneId");

      if (userCheck.recordset[0]?.COUNT > 0) {
        throw ApiError.badRequest("Bu vezneye atanmış kullanıcılar bulunmaktadır. Önce kullanıcıların vezne atamasını değiştiriniz.");
      }

      const result = await request.query("DELETE FROM [dbo].[TODVZ_VEZNE] WHERE [VEZNE_ID] = @VEZNE_ID");
      return (result.rowsAffected[0] || 0) > 0;
    } catch (error) {
      logger.error(`VezneSqlRepository.delete(${id}) error:`, error);
      throw error;
    }
  }

  public static async getPrinters(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ id: number; name: string; deviceName?: string }[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const query = "SELECT [YAZICI_ID] as id, [AD] as name, [CIHAZ_ADI] as deviceName FROM [dbo].[TODVZ_YAZICI] ORDER BY [SIRA_NO], [YAZICI_ID]";
      const result = await pool.request().query<{ id: number; name: string; deviceName?: string }>(query);
      return result.recordset.map((r) => ({
        id: r.id,
        name: (r.name || "").trim(),
        deviceName: r.deviceName ? r.deviceName.trim() : undefined,
      }));
    } catch (error) {
      logger.error("VezneSqlRepository.getPrinters error:", error);
      return [];
    }
  }

  public static async getCurrencies(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ id: number; code: string; name: string }[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const query = "SELECT [PARA_ID] as id, [KOD] as code, [AD] as name FROM [dbo].[TODVZ_PARA] ORDER BY [SIRA_NO], [PARA_ID]";
      const result = await pool.request().query<{ id: number; code: string; name: string }>(query);
      return result.recordset.map((r) => ({
        id: r.id,
        code: (r.code || "").trim(),
        name: (r.name || "").trim(),
      }));
    } catch (error) {
      logger.error("VezneSqlRepository.getCurrencies error:", error);
      return [];
    }
  }
}
