import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface TodvzParaEntity {
  PARA_ID: number;
  KOD: string;
  AD: string;
  PARITE_ISLEMI: number;
  SIRA_NO: number;
  BAGLI_PARA_KODU: string | null;
  GRAMAJ: number | null;
  HAS_ORANI: number | null;
  ISCILIK: number | null;
  DOVIZ_ALIS_HUCRE_ORANI: number;
  DOVIZ_SATIS_HUCRE_ORANI: number;
  EFEKTIF_ALIS_HUCRE_ORANI: number;
  EFEKTIF_SATIS_HUCRE_ORANI: number;
  EFEKTIF_ALIM_HESABI: string | null;
  EFEKTIF_SATIM_HESABI: string | null;
  EFEKTIF_DEPO_HESABI: string | null;
  EFEKTIF_VAZIYET_HESABI: string | null;
  DOVIZ_ALIM_HESABI: string | null;
  DOVIZ_SATIM_HESABI: string | null;
  DOVIZ_DEPO_HESABI: string | null;
  DOVIZ_VAZIYET_HESABI: string | null;
  ALIM_SATIM_KUR_FARKI: number | null;
  XML_PARA_KODU: string | null;
  MUHASEBE_SIRA_NO: number | null;
  HAS_ALIS_KATSAYISI: number | null;
  HAS_SATIS_KATSAYISI: number | null;
  BIRIM: number | null;
  URUN_TIPI: number;
}

export interface ParaModel {
  id: number;
  kod: string;
  ad: string;
  pariteIslemi: number;
  siraNo: number;
  bagliParaKodu: string | null;
  gramaj: number;
  hasOrani: number;
  iscilik: number;
  dovizAlisHucreOrani: number;
  dovizSatisHucreOrani: number;
  efektifAlisHucreOrani: number;
  efektifSatisHucreOrani: number;
  efektifAlimHesabi: string | null;
  efektifSatimHesabi: string | null;
  efektifDepoHesabi: string | null;
  efektifVaziyetHesabi: string | null;
  dovizAlimHesabi: string | null;
  dovizSatimHesabi: string | null;
  dovizDepoHesabi: string | null;
  dovizVaziyetHesabi: string | null;
  alimSatimKurFarki: number;
  xmlParaKodu: string | null;
  muhasebeSiraNo: number | null;
  hasAlisKatsayisi: number;
  hasSatisKatsayisi: number;
  birim: number;
  urunTipi: number;
}

export interface ParaInputDto {
  kod: string;
  ad: string;
  pariteIslemi?: number;
  siraNo?: number;
  bagliParaKodu?: string | null;
  gramaj?: number;
  hasOrani?: number;
  iscilik?: number;
  dovizAlisHucreOrani?: number;
  dovizSatisHucreOrani?: number;
  efektifAlisHucreOrani?: number;
  efektifSatisHucreOrani?: number;
  efektifAlimHesabi?: string | null;
  efektifSatimHesabi?: string | null;
  efektifDepoHesabi?: string | null;
  efektifVaziyetHesabi?: string | null;
  dovizAlimHesabi?: string | null;
  dovizSatimHesabi?: string | null;
  dovizDepoHesabi?: string | null;
  dovizVaziyetHesabi?: string | null;
  alimSatimKurFarki?: number;
  xmlParaKodu?: string | null;
  muhasebeSiraNo?: number | null;
  hasAlisKatsayisi?: number;
  hasSatisKatsayisi?: number;
  birim?: number;
  urunTipi?: number;
}

const toNullableString = (val?: string | null, maxLen?: number): string | null => {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return maxLen ? trimmed.slice(0, maxLen) : trimmed;
};

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

const normalizeBirim = (urunTipi?: any, birim?: any): number | null => {
  const type = toInt(urunTipi, 0);
  if (type === 0) return null; // CKODVZ_PARA constraint requirement: URUN_TIPI=0 => BIRIM IS NULL
  if (type === 3) return 0;    // CKODVZ_PARA constraint requirement: URUN_TIPI=3 => BIRIM=0
  // URUN_TIPI=1 or 2 => BIRIM IS NOT NULL
  if (birim === undefined || birim === null || birim === "") return 0;
  const parsed = parseInt(String(birim), 10);
  return isNaN(parsed) ? 0 : parsed;
};


export class ParaSqlRepository {
  private static mapEntityToModel(entity: TodvzParaEntity): ParaModel {
    return {
      id: entity.PARA_ID,
      kod: (entity.KOD || "").trim(),
      ad: (entity.AD || "").trim(),
      pariteIslemi: entity.PARITE_ISLEMI ?? 0,
      siraNo: entity.SIRA_NO ?? 0,
      bagliParaKodu: entity.BAGLI_PARA_KODU ? entity.BAGLI_PARA_KODU.trim() : null,
      gramaj: entity.GRAMAJ ?? 0,
      hasOrani: entity.HAS_ORANI ?? 0,
      iscilik: entity.ISCILIK ?? 0,
      dovizAlisHucreOrani: entity.DOVIZ_ALIS_HUCRE_ORANI ?? 1,
      dovizSatisHucreOrani: entity.DOVIZ_SATIS_HUCRE_ORANI ?? 1,
      efektifAlisHucreOrani: entity.EFEKTIF_ALIS_HUCRE_ORANI ?? 1,
      efektifSatisHucreOrani: entity.EFEKTIF_SATIS_HUCRE_ORANI ?? 1,
      efektifAlimHesabi: entity.EFEKTIF_ALIM_HESABI ? entity.EFEKTIF_ALIM_HESABI.trim() : null,
      efektifSatimHesabi: entity.EFEKTIF_SATIM_HESABI ? entity.EFEKTIF_SATIM_HESABI.trim() : null,
      efektifDepoHesabi: entity.EFEKTIF_DEPO_HESABI ? entity.EFEKTIF_DEPO_HESABI.trim() : null,
      efektifVaziyetHesabi: entity.EFEKTIF_VAZIYET_HESABI ? entity.EFEKTIF_VAZIYET_HESABI.trim() : null,
      dovizAlimHesabi: entity.DOVIZ_ALIM_HESABI ? entity.DOVIZ_ALIM_HESABI.trim() : null,
      dovizSatimHesabi: entity.DOVIZ_SATIM_HESABI ? entity.DOVIZ_SATIM_HESABI.trim() : null,
      dovizDepoHesabi: entity.DOVIZ_DEPO_HESABI ? entity.DOVIZ_DEPO_HESABI.trim() : null,
      dovizVaziyetHesabi: entity.DOVIZ_VAZIYET_HESABI ? entity.DOVIZ_VAZIYET_HESABI.trim() : null,
      alimSatimKurFarki: entity.ALIM_SATIM_KUR_FARKI ?? 0,
      xmlParaKodu: entity.XML_PARA_KODU ? entity.XML_PARA_KODU.trim() : null,
      muhasebeSiraNo: entity.MUHASEBE_SIRA_NO ?? null,
      hasAlisKatsayisi: entity.HAS_ALIS_KATSAYISI ?? 0,
      hasSatisKatsayisi: entity.HAS_SATIS_KATSAYISI ?? 0,
      birim: entity.BIRIM ?? 0,
      urunTipi: entity.URUN_TIPI ?? 0,
    };
  }

  public static async findAll(dbContext?: { dbServer?: string; dbName?: string }): Promise<ParaModel[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const query = `
        SELECT 
          [PARA_ID],
          [KOD],
          [AD],
          [PARITE_ISLEMI],
          [SIRA_NO],
          [BAGLI_PARA_KODU],
          [GRAMAJ],
          [HAS_ORANI],
          [ISCILIK],
          [DOVIZ_ALIS_HUCRE_ORANI],
          [DOVIZ_SATIS_HUCRE_ORANI],
          [EFEKTIF_ALIS_HUCRE_ORANI],
          [EFEKTIF_SATIS_HUCRE_ORANI],
          [EFEKTIF_ALIM_HESABI],
          [EFEKTIF_SATIM_HESABI],
          [EFEKTIF_DEPO_HESABI],
          [EFEKTIF_VAZIYET_HESABI],
          [DOVIZ_ALIM_HESABI],
          [DOVIZ_SATIM_HESABI],
          [DOVIZ_DEPO_HESABI],
          [DOVIZ_VAZIYET_HESABI],
          [ALIM_SATIM_KUR_FARKI],
          [XML_PARA_KODU],
          [MUHASEBE_SIRA_NO],
          [HAS_ALIS_KATSAYISI],
          [HAS_SATIS_KATSAYISI],
          [BIRIM],
          [URUN_TIPI]
        FROM [dbo].[TODVZ_PARA]
        ORDER BY [PARA_ID] ASC;
      `;
      const result = await pool.request().query<TodvzParaEntity>(query);
      return result.recordset.map(ParaSqlRepository.mapEntityToModel);
    } catch (error) {
      logger.error("ParaSqlRepository.findAll error:", error);
      throw error;
    }
  }

  public static async findById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<ParaModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();
      request.input("id", sql.Int, parseInt(String(id), 10));

      const query = `
        SELECT TOP 1
          [PARA_ID],
          [KOD],
          [AD],
          [PARITE_ISLEMI],
          [SIRA_NO],
          [BAGLI_PARA_KODU],
          [GRAMAJ],
          [HAS_ORANI],
          [ISCILIK],
          [DOVIZ_ALIS_HUCRE_ORANI],
          [DOVIZ_SATIS_HUCRE_ORANI],
          [EFEKTIF_ALIS_HUCRE_ORANI],
          [EFEKTIF_SATIS_HUCRE_ORANI],
          [EFEKTIF_ALIM_HESABI],
          [EFEKTIF_SATIM_HESABI],
          [EFEKTIF_DEPO_HESABI],
          [EFEKTIF_VAZIYET_HESABI],
          [DOVIZ_ALIM_HESABI],
          [DOVIZ_SATIM_HESABI],
          [DOVIZ_DEPO_HESABI],
          [DOVIZ_VAZIYET_HESABI],
          [ALIM_SATIM_KUR_FARKI],
          [XML_PARA_KODU],
          [MUHASEBE_SIRA_NO],
          [HAS_ALIS_KATSAYISI],
          [HAS_SATIS_KATSAYISI],
          [BIRIM],
          [URUN_TIPI]
        FROM [dbo].[TODVZ_PARA]
        WHERE [PARA_ID] = @id;
      `;
      const result = await request.query<TodvzParaEntity>(query);
      if (!result.recordset || result.recordset.length === 0) return null;
      return ParaSqlRepository.mapEntityToModel(result.recordset[0]);
    } catch (error) {
      logger.error(`ParaSqlRepository.findById(${id}) error:`, error);
      throw error;
    }
  }

  public static async findByCode(
    kod: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<ParaModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();
      request.input("kod", sql.VarChar(5), (kod || "").trim());

      const query = `
        SELECT TOP 1
          [PARA_ID],
          [KOD],
          [AD],
          [PARITE_ISLEMI],
          [SIRA_NO],
          [BAGLI_PARA_KODU],
          [GRAMAJ],
          [HAS_ORANI],
          [ISCILIK],
          [DOVIZ_ALIS_HUCRE_ORANI],
          [DOVIZ_SATIS_HUCRE_ORANI],
          [EFEKTIF_ALIS_HUCRE_ORANI],
          [EFEKTIF_SATIS_HUCRE_ORANI],
          [EFEKTIF_ALIM_HESABI],
          [EFEKTIF_SATIM_HESABI],
          [EFEKTIF_DEPO_HESABI],
          [EFEKTIF_VAZIYET_HESABI],
          [DOVIZ_ALIM_HESABI],
          [DOVIZ_SATIM_HESABI],
          [DOVIZ_DEPO_HESABI],
          [DOVIZ_VAZIYET_HESABI],
          [ALIM_SATIM_KUR_FARKI],
          [XML_PARA_KODU],
          [MUHASEBE_SIRA_NO],
          [HAS_ALIS_KATSAYISI],
          [HAS_SATIS_KATSAYISI],
          [BIRIM],
          [URUN_TIPI]
        FROM [dbo].[TODVZ_PARA]
        WHERE UPPER(LTRIM(RTRIM([KOD]))) = UPPER(@kod);
      `;
      const result = await request.query<TodvzParaEntity>(query);
      if (!result.recordset || result.recordset.length === 0) return null;
      return ParaSqlRepository.mapEntityToModel(result.recordset[0]);
    } catch (error) {
      logger.error(`ParaSqlRepository.findByCode(${kod}) error:`, error);
      throw error;
    }
  }

  public static async create(
    data: ParaInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<ParaModel> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();

      let calculatedSiraNo = toInt(data.siraNo, 0);
      if (calculatedSiraNo <= 0) {
        const maxResult = await pool.request().query<{ maxSira: number }>(
          `SELECT ISNULL(MAX([SIRA_NO]), 0) AS maxSira FROM [dbo].[TODVZ_PARA];`
        );
        calculatedSiraNo = (maxResult.recordset[0]?.maxSira || 0) + 1;
      }

      request.input("KOD", sql.VarChar(5), (data.kod || "").trim().slice(0, 5));
      request.input("AD", sql.VarChar(200), (data.ad || "").trim().slice(0, 200));
      request.input("PARITE_ISLEMI", sql.TinyInt, toInt(data.pariteIslemi, 0));
      request.input("SIRA_NO", sql.Int, calculatedSiraNo);
      request.input("BAGLI_PARA_KODU", sql.VarChar(5), toNullableString(data.bagliParaKodu, 5));
      request.input("GRAMAJ", sql.Float, toFloat(data.gramaj, 0));
      request.input("HAS_ORANI", sql.Float, toFloat(data.hasOrani, 0));
      request.input("ISCILIK", sql.Float, toFloat(data.iscilik, 0));
      request.input("DOVIZ_ALIS_HUCRE_ORANI", sql.Float, toFloat(data.dovizAlisHucreOrani, 1));
      request.input("DOVIZ_SATIS_HUCRE_ORANI", sql.Float, toFloat(data.dovizSatisHucreOrani, 1));
      request.input("EFEKTIF_ALIS_HUCRE_ORANI", sql.Float, toFloat(data.efektifAlisHucreOrani, 1));
      request.input("EFEKTIF_SATIS_HUCRE_ORANI", sql.Float, toFloat(data.efektifSatisHucreOrani, 1));
      request.input("EFEKTIF_ALIM_HESABI", sql.Char(20), toNullableString(data.efektifAlimHesabi, 20));
      request.input("EFEKTIF_SATIM_HESABI", sql.Char(20), toNullableString(data.efektifSatimHesabi, 20));
      request.input("EFEKTIF_DEPO_HESABI", sql.Char(20), toNullableString(data.efektifDepoHesabi, 20));
      request.input("EFEKTIF_VAZIYET_HESABI", sql.Char(20), toNullableString(data.efektifVaziyetHesabi, 20));
      request.input("DOVIZ_ALIM_HESABI", sql.Char(20), toNullableString(data.dovizAlimHesabi, 20));
      request.input("DOVIZ_SATIM_HESABI", sql.Char(20), toNullableString(data.dovizSatimHesabi, 20));
      request.input("DOVIZ_DEPO_HESABI", sql.Char(20), toNullableString(data.dovizDepoHesabi, 20));
      request.input("DOVIZ_VAZIYET_HESABI", sql.Char(20), toNullableString(data.dovizVaziyetHesabi, 20));
      request.input("ALIM_SATIM_KUR_FARKI", sql.Float, toFloat(data.alimSatimKurFarki, 0));
      request.input("XML_PARA_KODU", sql.Char(20), toNullableString(data.xmlParaKodu, 20));
      request.input("MUHASEBE_SIRA_NO", sql.Int, data.muhasebeSiraNo !== undefined && data.muhasebeSiraNo !== null ? toInt(data.muhasebeSiraNo) : null);
      request.input("HAS_ALIS_KATSAYISI", sql.Float, toFloat(data.hasAlisKatsayisi, 0));
      request.input("HAS_SATIS_KATSAYISI", sql.Float, toFloat(data.hasSatisKatsayisi, 0));
      request.input("BIRIM", sql.TinyInt, normalizeBirim(data.urunTipi, data.birim));
      request.input("URUN_TIPI", sql.TinyInt, toInt(data.urunTipi, 0));

      const insertQuery = `
        INSERT INTO [dbo].[TODVZ_PARA] (
          [KOD],
          [AD],
          [PARITE_ISLEMI],
          [SIRA_NO],
          [BAGLI_PARA_KODU],
          [GRAMAJ],
          [HAS_ORANI],
          [ISCILIK],
          [DOVIZ_ALIS_HUCRE_ORANI],
          [DOVIZ_SATIS_HUCRE_ORANI],
          [EFEKTIF_ALIS_HUCRE_ORANI],
          [EFEKTIF_SATIS_HUCRE_ORANI],
          [EFEKTIF_ALIM_HESABI],
          [EFEKTIF_SATIM_HESABI],
          [EFEKTIF_DEPO_HESABI],
          [EFEKTIF_VAZIYET_HESABI],
          [DOVIZ_ALIM_HESABI],
          [DOVIZ_SATIM_HESABI],
          [DOVIZ_DEPO_HESABI],
          [DOVIZ_VAZIYET_HESABI],
          [ALIM_SATIM_KUR_FARKI],
          [XML_PARA_KODU],
          [MUHASEBE_SIRA_NO],
          [HAS_ALIS_KATSAYISI],
          [HAS_SATIS_KATSAYISI],
          [BIRIM],
          [URUN_TIPI]
        )
        VALUES (
          @KOD,
          @AD,
          @PARITE_ISLEMI,
          @SIRA_NO,
          @BAGLI_PARA_KODU,
          @GRAMAJ,
          @HAS_ORANI,
          @ISCILIK,
          @DOVIZ_ALIS_HUCRE_ORANI,
          @DOVIZ_SATIS_HUCRE_ORANI,
          @EFEKTIF_ALIS_HUCRE_ORANI,
          @EFEKTIF_SATIS_HUCRE_ORANI,
          @EFEKTIF_ALIM_HESABI,
          @EFEKTIF_SATIM_HESABI,
          @EFEKTIF_DEPO_HESABI,
          @EFEKTIF_VAZIYET_HESABI,
          @DOVIZ_ALIM_HESABI,
          @DOVIZ_SATIM_HESABI,
          @DOVIZ_DEPO_HESABI,
          @DOVIZ_VAZIYET_HESABI,
          @ALIM_SATIM_KUR_FARKI,
          @XML_PARA_KODU,
          @MUHASEBE_SIRA_NO,
          @HAS_ALIS_KATSAYISI,
          @HAS_SATIS_KATSAYISI,
          @BIRIM,
          @URUN_TIPI
        );
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS [PARA_ID];
      `;

      const result = await request.query<{ PARA_ID: number }>(insertQuery);
      const newId = result.recordset[0]?.PARA_ID;

      const created = await ParaSqlRepository.findById(newId, dbContext);
      if (!created) {
        throw ApiError.internal("Ürün / Para birimi tanımlandı fakat kayıt bilgisi okunamadı.");
      }
      return created;
    } catch (error) {
      logger.error("ParaSqlRepository.create error:", error);
      throw error;
    }
  }

  public static async update(
    id: number | string,
    data: ParaInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<ParaModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const request = pool.request();

      request.input("PARA_ID", sql.Int, parseInt(String(id), 10));
      request.input("KOD", sql.VarChar(5), (data.kod || "").trim().slice(0, 5));
      request.input("AD", sql.VarChar(200), (data.ad || "").trim().slice(0, 200));
      request.input("PARITE_ISLEMI", sql.TinyInt, toInt(data.pariteIslemi, 0));
      request.input("SIRA_NO", sql.Int, toInt(data.siraNo, 0));
      request.input("BAGLI_PARA_KODU", sql.VarChar(5), toNullableString(data.bagliParaKodu, 5));
      request.input("GRAMAJ", sql.Float, toFloat(data.gramaj, 0));
      request.input("HAS_ORANI", sql.Float, toFloat(data.hasOrani, 0));
      request.input("ISCILIK", sql.Float, toFloat(data.iscilik, 0));
      request.input("DOVIZ_ALIS_HUCRE_ORANI", sql.Float, toFloat(data.dovizAlisHucreOrani, 1));
      request.input("DOVIZ_SATIS_HUCRE_ORANI", sql.Float, toFloat(data.dovizSatisHucreOrani, 1));
      request.input("EFEKTIF_ALIS_HUCRE_ORANI", sql.Float, toFloat(data.efektifAlisHucreOrani, 1));
      request.input("EFEKTIF_SATIS_HUCRE_ORANI", sql.Float, toFloat(data.efektifSatisHucreOrani, 1));
      request.input("EFEKTIF_ALIM_HESABI", sql.Char(20), toNullableString(data.efektifAlimHesabi, 20));
      request.input("EFEKTIF_SATIM_HESABI", sql.Char(20), toNullableString(data.efektifSatimHesabi, 20));
      request.input("EFEKTIF_DEPO_HESABI", sql.Char(20), toNullableString(data.efektifDepoHesabi, 20));
      request.input("EFEKTIF_VAZIYET_HESABI", sql.Char(20), toNullableString(data.efektifVaziyetHesabi, 20));
      request.input("DOVIZ_ALIM_HESABI", sql.Char(20), toNullableString(data.dovizAlimHesabi, 20));
      request.input("DOVIZ_SATIM_HESABI", sql.Char(20), toNullableString(data.dovizSatimHesabi, 20));
      request.input("DOVIZ_DEPO_HESABI", sql.Char(20), toNullableString(data.dovizDepoHesabi, 20));
      request.input("DOVIZ_VAZIYET_HESABI", sql.Char(20), toNullableString(data.dovizVaziyetHesabi, 20));
      request.input("ALIM_SATIM_KUR_FARKI", sql.Float, toFloat(data.alimSatimKurFarki, 0));
      request.input("XML_PARA_KODU", sql.Char(20), toNullableString(data.xmlParaKodu, 20));
      request.input("MUHASEBE_SIRA_NO", sql.Int, data.muhasebeSiraNo !== undefined && data.muhasebeSiraNo !== null ? toInt(data.muhasebeSiraNo) : null);
      request.input("HAS_ALIS_KATSAYISI", sql.Float, toFloat(data.hasAlisKatsayisi, 0));
      request.input("HAS_SATIS_KATSAYISI", sql.Float, toFloat(data.hasSatisKatsayisi, 0));
      request.input("BIRIM", sql.TinyInt, normalizeBirim(data.urunTipi, data.birim));
      request.input("URUN_TIPI", sql.TinyInt, toInt(data.urunTipi, 0));


      const updateQuery = `
        UPDATE [dbo].[TODVZ_PARA]
        SET
          [KOD] = @KOD,
          [AD] = @AD,
          [PARITE_ISLEMI] = @PARITE_ISLEMI,
          [SIRA_NO] = @SIRA_NO,
          [BAGLI_PARA_KODU] = @BAGLI_PARA_KODU,
          [GRAMAJ] = @GRAMAJ,
          [HAS_ORANI] = @HAS_ORANI,
          [ISCILIK] = @ISCILIK,
          [DOVIZ_ALIS_HUCRE_ORANI] = @DOVIZ_ALIS_HUCRE_ORANI,
          [DOVIZ_SATIS_HUCRE_ORANI] = @DOVIZ_SATIS_HUCRE_ORANI,
          [EFEKTIF_ALIS_HUCRE_ORANI] = @EFEKTIF_ALIS_HUCRE_ORANI,
          [EFEKTIF_SATIS_HUCRE_ORANI] = @EFEKTIF_SATIS_HUCRE_ORANI,
          [EFEKTIF_ALIM_HESABI] = @EFEKTIF_ALIM_HESABI,
          [EFEKTIF_SATIM_HESABI] = @EFEKTIF_SATIM_HESABI,
          [EFEKTIF_DEPO_HESABI] = @EFEKTIF_DEPO_HESABI,
          [EFEKTIF_VAZIYET_HESABI] = @EFEKTIF_VAZIYET_HESABI,
          [DOVIZ_ALIM_HESABI] = @DOVIZ_ALIM_HESABI,
          [DOVIZ_SATIM_HESABI] = @DOVIZ_SATIM_HESABI,
          [DOVIZ_DEPO_HESABI] = @DOVIZ_DEPO_HESABI,
          [DOVIZ_VAZIYET_HESABI] = @DOVIZ_VAZIYET_HESABI,
          [ALIM_SATIM_KUR_FARKI] = @ALIM_SATIM_KUR_FARKI,
          [XML_PARA_KODU] = @XML_PARA_KODU,
          [MUHASEBE_SIRA_NO] = @MUHASEBE_SIRA_NO,
          [HAS_ALIS_KATSAYISI] = @HAS_ALIS_KATSAYISI,
          [HAS_SATIS_KATSAYISI] = @HAS_SATIS_KATSAYISI,
          [BIRIM] = @BIRIM,
          [URUN_TIPI] = @URUN_TIPI
        WHERE [PARA_ID] = @PARA_ID;
      `;

      await request.query(updateQuery);
      return ParaSqlRepository.findById(id, dbContext);
    } catch (error) {
      logger.error(`ParaSqlRepository.update(${id}) error:`, error);
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

      // 1. Check if movement records exist in TODVZ_HESAP_HAREKETI
      try {
        const hareketCheck = await pool
          .request()
          .input("paraId", sql.Int, parsedId)
          .query<{ COUNT: number }>("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_HESAP_HAREKETI] WHERE [PARA_ID] = @paraId");
        if (hareketCheck.recordset[0]?.COUNT > 0) {
          throw ApiError.badRequest("Bu ürüne / para birimine ait hesap veya kasa hareketleri bulunmaktadır. Geçmiş hareketleri olan tanımlar sistem bütünlüğü açısından silinemez.");
        }
      } catch (checkErr: any) {
        if (checkErr instanceof ApiError) throw checkErr;
      }

      // 2. Check if product / currency is assigned to any Vezne (TODVZ_VEZNE)
      try {
        const vezneCheck = await pool
          .request()
          .input("paraId", sql.Int, parsedId)
          .query<{ COUNT: number }>("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_VEZNE] WHERE [PARA_ID] = @paraId");
        if (vezneCheck.recordset[0]?.COUNT > 0) {
          throw ApiError.badRequest("Bu ürüne / para birimine bağlı vezne tanımları bulunmaktadır. Önce ilgili veznelerdeki para birimini değiştiriniz.");
        }
      } catch (checkErr: any) {
        if (checkErr instanceof ApiError) throw checkErr;
      }

      // 3. Check if banknot records exist
      try {
        const banknotCheck = await pool
          .request()
          .input("paraId", sql.Int, parsedId)
          .query<{ COUNT: number }>("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_BANKNOT] WHERE [PARA_ID] = @paraId");
        if (banknotCheck.recordset[0]?.COUNT > 0) {
          throw ApiError.badRequest("Bu ürüne ait tanımlı banknotlar bulunmaktadır. Önce banknot tanımlarını siliniz.");
        }
      } catch (checkErr: any) {
        if (checkErr instanceof ApiError) throw checkErr;
      }

      // 4. Clean up auxiliary tables like TODVZ_KUR and delete from TODVZ_PARA
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        const req1 = new sql.Request(transaction);
        req1.input("paraId", sql.Int, parsedId);
        await req1.query("DELETE FROM [dbo].[TODVZ_KUR] WHERE [PARA_ID] = @paraId");

        const req2 = new sql.Request(transaction);
        req2.input("paraId", sql.Int, parsedId);
        const result = await req2.query("DELETE FROM [dbo].[TODVZ_PARA] WHERE [PARA_ID] = @paraId");

        await transaction.commit();
        return (result.rowsAffected[0] || 0) > 0;
      } catch (txErr: any) {
        await transaction.rollback();
        throw txErr;
      }
    } catch (error: any) {
      logger.error(`ParaSqlRepository.delete(${id}) error:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      const msg = error?.message || "";
      if (error?.number === 547 || msg.includes("REFERENCE constraint") || msg.includes("FOREIGN KEY")) {
        if (msg.includes("TODVZ_HESAP_HAREKETI")) {
          throw ApiError.badRequest("Bu ürüne / para birimine ait hesap veya kasa hareketleri bulunmaktadır. Geçmiş hareketleri olan ürünler silinemez.");
        }
        if (msg.includes("TODVZ_ALTIN_URUN") || msg.includes("TODVZ_OZEL_URUN")) {
          throw ApiError.badRequest("Bu ürün tanımına bağlı barkodlu altın veya özel ürünler bulunmaktadır. Önce ilgili ürünleri siliniz.");
        }
        if (msg.includes("TODVZ_VEZNE")) {
          throw ApiError.badRequest("Bu ürün tanımına bağlı vezneler bulunmaktadır. Önce vezne tanımlarını düzenleyiniz.");
        }
        throw ApiError.badRequest("Bu ürün tanımına bağlı ilişkili hareket veya belge kayıtları bulunduğu için silinemez.");
      }
      throw error;
    }
  }
}
