import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface TodvzIstatistikEntity {
  ISTATISTIK_ID: number;
  KOD: string;
  ACIKLAMA: string;
  FIS_TIPI: number;
  KOMISYON_ORANI: number;
  BMV_ORANI: number;
  FIS_DIZAYN_TIPI: number;
  BELGE_NO_URETME_SEKLI: number;
  CIKTI_SATIR_SAYISI: number;
  F1_TUSU: number;
  ODEME_SEKLI_VAR: boolean | null;
  ODEME_SEKLI: number | null;
  MUH_HESAP_ID: number | null;
  EFEKTIF_DEPO_HESAP_ID: number | null;
  EFEKTIF_VAZIYET_HESAP_ID: number | null;
  KMV_ORANI: number;
  KOMISYON_YETKISI: boolean;
}

export interface IstatistikModel {
  id: number;
  kod: string;
  aciklama: string;
  fisTipi: number;
  komisyonOrani: number;
  bmvOrani: number;
  fisDizaynTipi: number;
  belgeNoUretmeSekli: number;
  ciktiSatirSayisi: number;
  f1Tusu: number;
  odemeSekliVar: boolean;
  odemeSekli: number | null;
  muhHesapId: number | null;
  efektifDepoHesapId: number | null;
  efektifVaziyetHesapId: number | null;
  kmvOrani: number;
  komisyonYetkisi: boolean;
}

export interface IstatistikInputDto {
  kod: string;
  aciklama: string;
  fisTipi?: number;
  komisyonOrani?: number;
  bmvOrani?: number;
  fisDizaynTipi?: number;
  belgeNoUretmeSekli?: number;
  ciktiSatirSayisi?: number;
  f1Tusu?: number;
  odemeSekliVar?: boolean;
  odemeSekli?: number | null;
  muhHesapId?: number | null;
  efektifDepoHesapId?: number | null;
  efektifVaziyetHesapId?: number | null;
  kmvOrani?: number;
  komisyonYetkisi?: boolean;
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

export class IstatistikSqlRepository {
  private static mapEntityToModel(entity: TodvzIstatistikEntity): IstatistikModel {
    return {
      id: entity.ISTATISTIK_ID,
      kod: (entity.KOD || "").trim(),
      aciklama: (entity.ACIKLAMA || "").trim(),
      fisTipi: entity.FIS_TIPI ?? 0,
      komisyonOrani: entity.KOMISYON_ORANI ?? 0,
      bmvOrani: entity.BMV_ORANI ?? 0,
      fisDizaynTipi: entity.FIS_DIZAYN_TIPI ?? 0,
      belgeNoUretmeSekli: entity.BELGE_NO_URETME_SEKLI ?? 0,
      ciktiSatirSayisi: entity.CIKTI_SATIR_SAYISI ?? 1,
      f1Tusu: entity.F1_TUSU ?? 0,
      odemeSekliVar: !!entity.ODEME_SEKLI_VAR,
      odemeSekli: entity.ODEME_SEKLI !== null && entity.ODEME_SEKLI !== undefined ? entity.ODEME_SEKLI : null,
      muhHesapId: entity.MUH_HESAP_ID ?? null,
      efektifDepoHesapId: entity.EFEKTIF_DEPO_HESAP_ID ?? null,
      efektifVaziyetHesapId: entity.EFEKTIF_VAZIYET_HESAP_ID ?? null,
      kmvOrani: entity.KMV_ORANI ?? 0,
      komisyonYetkisi: entity.KOMISYON_YETKISI !== false,
    };
  }

  public static async findAll(dbContext?: { dbServer?: string; dbName?: string }): Promise<IstatistikModel[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const query = `
        SELECT 
          [ISTATISTIK_ID],
          [KOD],
          [ACIKLAMA],
          [FIS_TIPI],
          [KOMISYON_ORANI],
          [BMV_ORANI],
          [FIS_DIZAYN_TIPI],
          [BELGE_NO_URETME_SEKLI],
          [CIKTI_SATIR_SAYISI],
          [F1_TUSU],
          [ODEME_SEKLI_VAR],
          [ODEME_SEKLI],
          [MUH_HESAP_ID],
          [EFEKTIF_DEPO_HESAP_ID],
          [EFEKTIF_VAZIYET_HESAP_ID],
          [KMV_ORANI],
          [KOMISYON_YETKISI]
        FROM [dbo].[TODVZ_ISTATISTIK]
        ORDER BY [ISTATISTIK_ID] ASC;
      `;
      const result = await pool.request().query<TodvzIstatistikEntity>(query);
      return result.recordset.map(IstatistikSqlRepository.mapEntityToModel);
    } catch (error) {
      logger.error("IstatistikSqlRepository.findAll error:", error);
      throw error;
    }
  }

  public static async findById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IstatistikModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();
      request.input("id", sql.Int, parseInt(String(id), 10));

      const query = `
        SELECT TOP 1
          [ISTATISTIK_ID],
          [KOD],
          [ACIKLAMA],
          [FIS_TIPI],
          [KOMISYON_ORANI],
          [BMV_ORANI],
          [FIS_DIZAYN_TIPI],
          [BELGE_NO_URETME_SEKLI],
          [CIKTI_SATIR_SAYISI],
          [F1_TUSU],
          [ODEME_SEKLI_VAR],
          [ODEME_SEKLI],
          [MUH_HESAP_ID],
          [EFEKTIF_DEPO_HESAP_ID],
          [EFEKTIF_VAZIYET_HESAP_ID],
          [KMV_ORANI],
          [KOMISYON_YETKISI]
        FROM [dbo].[TODVZ_ISTATISTIK]
        WHERE [ISTATISTIK_ID] = @id;
      `;
      const result = await request.query<TodvzIstatistikEntity>(query);
      if (!result.recordset || result.recordset.length === 0) return null;
      return IstatistikSqlRepository.mapEntityToModel(result.recordset[0]);
    } catch (error) {
      logger.error(`IstatistikSqlRepository.findById(${id}) error:`, error);
      throw error;
    }
  }

  public static async findByCode(
    kod: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IstatistikModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();
      request.input("kod", sql.Char(20), (kod || "").trim());

      const query = `
        SELECT TOP 1
          [ISTATISTIK_ID],
          [KOD],
          [ACIKLAMA],
          [FIS_TIPI],
          [KOMISYON_ORANI],
          [BMV_ORANI],
          [FIS_DIZAYN_TIPI],
          [BELGE_NO_URETME_SEKLI],
          [CIKTI_SATIR_SAYISI],
          [F1_TUSU],
          [ODEME_SEKLI_VAR],
          [ODEME_SEKLI],
          [MUH_HESAP_ID],
          [EFEKTIF_DEPO_HESAP_ID],
          [EFEKTIF_VAZIYET_HESAP_ID],
          [KMV_ORANI],
          [KOMISYON_YETKISI]
        FROM [dbo].[TODVZ_ISTATISTIK]
        WHERE UPPER(LTRIM(RTRIM([KOD]))) = UPPER(@kod);
      `;
      const result = await request.query<TodvzIstatistikEntity>(query);
      if (!result.recordset || result.recordset.length === 0) return null;
      return IstatistikSqlRepository.mapEntityToModel(result.recordset[0]);
    } catch (error) {
      logger.error(`IstatistikSqlRepository.findByCode(${kod}) error:`, error);
      throw error;
    }
  }

  public static async create(
    data: IstatistikInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IstatistikModel> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();

      request.input("KOD", sql.Char(20), (data.kod || "").trim().slice(0, 20));
      request.input("ACIKLAMA", sql.VarChar(100), (data.aciklama || "").trim().slice(0, 100));
      request.input("FIS_TIPI", sql.TinyInt, toInt(data.fisTipi, 0));
      request.input("KOMISYON_ORANI", sql.Float, toFloat(data.komisyonOrani, 0));
      request.input("BMV_ORANI", sql.Float, toFloat(data.bmvOrani, 0));
      request.input("FIS_DIZAYN_TIPI", sql.TinyInt, toInt(data.fisDizaynTipi, 0));
      request.input("BELGE_NO_URETME_SEKLI", sql.TinyInt, toInt(data.belgeNoUretmeSekli, 0));
      request.input("CIKTI_SATIR_SAYISI", sql.Int, Math.max(1, toInt(data.ciktiSatirSayisi, 1)));
      request.input("F1_TUSU", sql.TinyInt, toInt(data.f1Tusu, 0));
      request.input("ODEME_SEKLI_VAR", sql.Bit, data.odemeSekliVar ? 1 : 0);
      request.input("ODEME_SEKLI", sql.TinyInt, data.odemeSekli !== undefined && data.odemeSekli !== null ? toInt(data.odemeSekli) : null);
      request.input("MUH_HESAP_ID", sql.Int, data.muhHesapId !== undefined && data.muhHesapId !== null ? toInt(data.muhHesapId) : null);
      request.input("EFEKTIF_DEPO_HESAP_ID", sql.Int, data.efektifDepoHesapId !== undefined && data.efektifDepoHesapId !== null ? toInt(data.efektifDepoHesapId) : null);
      request.input("EFEKTIF_VAZIYET_HESAP_ID", sql.Int, data.efektifVaziyetHesapId !== undefined && data.efektifVaziyetHesapId !== null ? toInt(data.efektifVaziyetHesapId) : null);
      request.input("KMV_ORANI", sql.Float, toFloat(data.kmvOrani, 0));
      request.input("KOMISYON_YETKISI", sql.Bit, data.komisyonYetkisi !== false ? 1 : 0);

      const insertQuery = `
        INSERT INTO [dbo].[TODVZ_ISTATISTIK] (
          [KOD],
          [ACIKLAMA],
          [FIS_TIPI],
          [KOMISYON_ORANI],
          [BMV_ORANI],
          [FIS_DIZAYN_TIPI],
          [BELGE_NO_URETME_SEKLI],
          [CIKTI_SATIR_SAYISI],
          [F1_TUSU],
          [ODEME_SEKLI_VAR],
          [ODEME_SEKLI],
          [MUH_HESAP_ID],
          [EFEKTIF_DEPO_HESAP_ID],
          [EFEKTIF_VAZIYET_HESAP_ID],
          [KMV_ORANI],
          [KOMISYON_YETKISI]
        )
        VALUES (
          @KOD,
          @ACIKLAMA,
          @FIS_TIPI,
          @KOMISYON_ORANI,
          @BMV_ORANI,
          @FIS_DIZAYN_TIPI,
          @BELGE_NO_URETME_SEKLI,
          @CIKTI_SATIR_SAYISI,
          @F1_TUSU,
          @ODEME_SEKLI_VAR,
          @ODEME_SEKLI,
          @MUH_HESAP_ID,
          @EFEKTIF_DEPO_HESAP_ID,
          @EFEKTIF_VAZIYET_HESAP_ID,
          @KMV_ORANI,
          @KOMISYON_YETKISI
        );
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS [ISTATISTIK_ID];
      `;

      const result = await request.query<{ ISTATISTIK_ID: number }>(insertQuery);
      const newId = result.recordset[0]?.ISTATISTIK_ID;

      const created = await IstatistikSqlRepository.findById(newId, dbContext);
      if (!created) {
        throw ApiError.internal("İstatistik tanımı eklendi fakat veri okunamadı.");
      }
      return created;
    } catch (error) {
      logger.error("IstatistikSqlRepository.create error:", error);
      throw error;
    }
  }

  public static async update(
    id: number | string,
    data: IstatistikInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IstatistikModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();

      request.input("ISTATISTIK_ID", sql.Int, parseInt(String(id), 10));
      request.input("KOD", sql.Char(20), (data.kod || "").trim().slice(0, 20));
      request.input("ACIKLAMA", sql.VarChar(100), (data.aciklama || "").trim().slice(0, 100));
      request.input("FIS_TIPI", sql.TinyInt, toInt(data.fisTipi, 0));
      request.input("KOMISYON_ORANI", sql.Float, toFloat(data.komisyonOrani, 0));
      request.input("BMV_ORANI", sql.Float, toFloat(data.bmvOrani, 0));
      request.input("FIS_DIZAYN_TIPI", sql.TinyInt, toInt(data.fisDizaynTipi, 0));
      request.input("BELGE_NO_URETME_SEKLI", sql.TinyInt, toInt(data.belgeNoUretmeSekli, 0));
      request.input("CIKTI_SATIR_SAYISI", sql.Int, Math.max(1, toInt(data.ciktiSatirSayisi, 1)));
      request.input("F1_TUSU", sql.TinyInt, toInt(data.f1Tusu, 0));
      request.input("ODEME_SEKLI_VAR", sql.Bit, data.odemeSekliVar ? 1 : 0);
      request.input("ODEME_SEKLI", sql.TinyInt, data.odemeSekli !== undefined && data.odemeSekli !== null ? toInt(data.odemeSekli) : null);
      request.input("MUH_HESAP_ID", sql.Int, data.muhHesapId !== undefined && data.muhHesapId !== null ? toInt(data.muhHesapId) : null);
      request.input("EFEKTIF_DEPO_HESAP_ID", sql.Int, data.efektifDepoHesapId !== undefined && data.efektifDepoHesapId !== null ? toInt(data.efektifDepoHesapId) : null);
      request.input("EFEKTIF_VAZIYET_HESAP_ID", sql.Int, data.efektifVaziyetHesapId !== undefined && data.efektifVaziyetHesapId !== null ? toInt(data.efektifVaziyetHesapId) : null);
      request.input("KMV_ORANI", sql.Float, toFloat(data.kmvOrani, 0));
      request.input("KOMISYON_YETKISI", sql.Bit, data.komisyonYetkisi !== false ? 1 : 0);

      const updateQuery = `
        UPDATE [dbo].[TODVZ_ISTATISTIK]
        SET
          [KOD] = @KOD,
          [ACIKLAMA] = @ACIKLAMA,
          [FIS_TIPI] = @FIS_TIPI,
          [KOMISYON_ORANI] = @KOMISYON_ORANI,
          [BMV_ORANI] = @BMV_ORANI,
          [FIS_DIZAYN_TIPI] = @FIS_DIZAYN_TIPI,
          [BELGE_NO_URETME_SEKLI] = @BELGE_NO_URETME_SEKLI,
          [CIKTI_SATIR_SAYISI] = @CIKTI_SATIR_SAYISI,
          [F1_TUSU] = @F1_TUSU,
          [ODEME_SEKLI_VAR] = @ODEME_SEKLI_VAR,
          [ODEME_SEKLI] = @ODEME_SEKLI,
          [MUH_HESAP_ID] = @MUH_HESAP_ID,
          [EFEKTIF_DEPO_HESAP_ID] = @EFEKTIF_DEPO_HESAP_ID,
          [EFEKTIF_VAZIYET_HESAP_ID] = @EFEKTIF_VAZIYET_HESAP_ID,
          [KMV_ORANI] = @KMV_ORANI,
          [KOMISYON_YETKISI] = @KOMISYON_YETKISI
        WHERE [ISTATISTIK_ID] = @ISTATISTIK_ID;
      `;

      await request.query(updateQuery);
      return IstatistikSqlRepository.findById(id, dbContext);
    } catch (error) {
      logger.error(`IstatistikSqlRepository.update(${id}) error:`, error);
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

      const request = pool.request();
      request.input("ISTATISTIK_ID", sql.Int, parsedId);
      const result = await request.query("DELETE FROM [dbo].[TODVZ_ISTATISTIK] WHERE [ISTATISTIK_ID] = @ISTATISTIK_ID");
      return (result.rowsAffected[0] || 0) > 0;
    } catch (error) {
      logger.error(`IstatistikSqlRepository.delete(${id}) error:`, error);
      throw error;
    }
  }
}
