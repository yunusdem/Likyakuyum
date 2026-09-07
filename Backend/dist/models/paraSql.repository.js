import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
const toNullableString = (val, maxLen) => {
    if (val === undefined || val === null)
        return null;
    const trimmed = val.trim();
    if (!trimmed)
        return null;
    return maxLen ? trimmed.slice(0, maxLen) : trimmed;
};
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
const normalizeBirim = (urunTipi, birim) => {
    const type = toInt(urunTipi, 0);
    if (type === 0)
        return null; // CKODVZ_PARA constraint requirement: URUN_TIPI=0 => BIRIM IS NULL
    if (type === 3)
        return 0; // CKODVZ_PARA constraint requirement: URUN_TIPI=3 => BIRIM=0
    // URUN_TIPI=1 or 2 => BIRIM IS NOT NULL
    if (birim === undefined || birim === null || birim === "")
        return 0;
    const parsed = parseInt(String(birim), 10);
    return isNaN(parsed) ? 0 : parsed;
};
export class ParaSqlRepository {
    static mapEntityToModel(entity) {
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
    static async findAll(dbContext) {
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
        ORDER BY [SIRA_NO] ASC, [PARA_ID] ASC;
      `;
            const result = await pool.request().query(query);
            return result.recordset.map(ParaSqlRepository.mapEntityToModel);
        }
        catch (error) {
            logger.error("ParaSqlRepository.findAll error:", error);
            throw error;
        }
    }
    static async findById(id, dbContext) {
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
            const result = await request.query(query);
            if (!result.recordset || result.recordset.length === 0)
                return null;
            return ParaSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            logger.error(`ParaSqlRepository.findById(${id}) error:`, error);
            throw error;
        }
    }
    static async findByCode(kod, dbContext) {
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
            const result = await request.query(query);
            if (!result.recordset || result.recordset.length === 0)
                return null;
            return ParaSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            logger.error(`ParaSqlRepository.findByCode(${kod}) error:`, error);
            throw error;
        }
    }
    static async create(data, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
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
            const result = await request.query(insertQuery);
            const newId = result.recordset[0]?.PARA_ID;
            const created = await ParaSqlRepository.findById(newId, dbContext);
            if (!created) {
                throw ApiError.internal("Ürün / Para birimi tanımlandı fakat kayıt bilgisi okunamadı.");
            }
            return created;
        }
        catch (error) {
            logger.error("ParaSqlRepository.create error:", error);
            throw error;
        }
    }
    static async update(id, data, dbContext) {
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
        }
        catch (error) {
            logger.error(`ParaSqlRepository.update(${id}) error:`, error);
            throw error;
        }
    }
    static async delete(id, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const parsedId = parseInt(String(id), 10);
            // Check if product / currency is assigned to any Vezne (TODVZ_VEZNE)
            const vezneCheck = await pool.request()
                .input("paraId", sql.Int, parsedId)
                .query("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_VEZNE] WHERE [PARA_ID] = @paraId");
            if (vezneCheck.recordset[0]?.COUNT > 0) {
                throw ApiError.badRequest("Bu ürüne / para birimine bağlı vezne tanımları bulunmaktadır. Önce ilgili veznelerdeki para birimini değiştiriniz.");
            }
            // Check if banknot records exist
            const banknotCheck = await pool.request()
                .input("paraId", sql.Int, parsedId)
                .query("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_BANKNOT] WHERE [PARA_ID] = @paraId");
            if (banknotCheck.recordset[0]?.COUNT > 0) {
                throw ApiError.badRequest("Bu ürüne ait tanımlı banknotlar bulunmaktadır. Önce banknot tanımlarını siliniz.");
            }
            const request = pool.request();
            request.input("PARA_ID", sql.Int, parsedId);
            const result = await request.query("DELETE FROM [dbo].[TODVZ_PARA] WHERE [PARA_ID] = @PARA_ID");
            return (result.rowsAffected[0] || 0) > 0;
        }
        catch (error) {
            logger.error(`ParaSqlRepository.delete(${id}) error:`, error);
            throw error;
        }
    }
}
