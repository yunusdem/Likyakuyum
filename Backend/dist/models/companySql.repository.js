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
    /**
     * Updates or inserts company definitions into [dbo].[TODVZ_TANIM] in the target database
     */
    static async updateDefinitions(data, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            // Check if row exists in TODVZ_TANIM
            const existing = await pool.request().query(`
        SELECT TOP 1 * FROM [dbo].[TODVZ_TANIM]
      `);
            const request = pool.request();
            // List of all column definitions with their SQL types
            const columnMapping = [
                { name: "SURUM", type: sql.Char, len: 20 },
                { name: "FIRMA_ADI", type: sql.VarChar, len: 200 },
                { name: "SUBE_KODU", type: sql.Char, len: 20 },
                { name: "SUBE_ADI", type: sql.VarChar, len: 200 },
                { name: "VERGI_DAIRESI_ID", type: sql.Int },
                { name: "VERGI_KIMLIK_NO", type: sql.VarChar, len: 50 },
                { name: "ADRES", type: sql.VarChar, len: 200 },
                { name: "POSTA_KODU_ID", type: sql.Int },
                { name: "ILCE_ID", type: sql.Int },
                { name: "IL_ID", type: sql.Int },
                { name: "ULKE_ID", type: sql.Int },
                { name: "TELEFON", type: sql.Char, len: 20 },
                { name: "USD_PARA_ID", type: sql.Int },
                { name: "EUR_PARA_ID", type: sql.Int },
                { name: "RAPOR_PARA_ID", type: sql.Int },
                { name: "TL_KURUS_SAYISI", type: sql.Int },
                { name: "DOVIZ_KURUS_SAYISI", type: sql.Int },
                { name: "KUR_KURUS_SAYISI", type: sql.Int },
                { name: "CARI_TL_TOLERANSI", type: sql.Float },
                { name: "CARI_USD_TOLERANSI", type: sql.Float },
                { name: "DOVIZ_VERGI_SINIRI", type: sql.Float },
                { name: "DOVIZ_VERGI_SINIRI_PARA_ID", type: sql.Int },
                { name: "SERMAYE_HESABI_ID", type: sql.Int },
                { name: "BELGE_DIZINI", type: sql.VarChar, len: 200 },
                { name: "CARI_KOD_SIRA_NO", type: sql.Int },
                { name: "CARI_KOD_BASINA_SIFIR", type: sql.Bit },
                { name: "FIS_NO_BASINA_SIFIR", type: sql.Bit },
                { name: "DOVIZ_ALIS_DVZ_SATIS_ORANI", type: sql.Float },
                { name: "EFEKTIF_ALIS_DVZ_SATIS_ORANI", type: sql.Float },
                { name: "EFEKTIF_SATIS_DVZ_SATIS_ORANI", type: sql.Float },
                { name: "ALIS_ISTATISTIK_ID", type: sql.Int },
                { name: "SATIS_ISTATISTIK_ID", type: sql.Int },
                { name: "ARBITRAJ_ALIS_ISTATISTIK_ID", type: sql.Int },
                { name: "ARBITRAJ_SATIS_ISTATISTIK_ID", type: sql.Int },
                { name: "SATISIN_DAYANAGI", type: sql.VarChar, len: 100 },
                { name: "FISTE_COKLU_SATIR", type: sql.Bit },
                { name: "TL_YUVARLAMA_ARALIGI", type: sql.Float },
                { name: "TL_YUVARLAMA_ESIGI", type: sql.Float },
                { name: "TAZELEME_SURESI", type: sql.Int },
                { name: "EKRANDAKI_VEZNE_SAYISI", type: sql.TinyInt },
                { name: "KASA_HESABI", type: sql.Char, len: 20 },
                { name: "KOMISYON_HESABI", type: sql.Char, len: 20 },
                { name: "BMV_HESABI", type: sql.Char, len: 20 },
                { name: "KAMBIYO_KAR_HESABI", type: sql.Char, len: 20 },
                { name: "KAMBIYO_ZARAR_HESABI", type: sql.Char, len: 20 },
                { name: "BELGE_YAZICI_MODU", type: sql.TinyInt },
                { name: "KUR_TEXT_DOSYASI", type: sql.VarChar, len: 200 },
                { name: "HESAP_YILI", type: sql.Int },
                { name: "GRAM_ONDALIK_SAYISI", type: sql.Int },
                { name: "ALTIN_VERGI_SINIRI", type: sql.Float },
                { name: "ALTIN_VERGI_SINIRI_PARA_ID", type: sql.Int },
                { name: "CARI_DEKONT_ISLEM_CINSI", type: sql.TinyInt },
                { name: "DIGER_VERITABANI_ADI", type: sql.VarChar, len: 200 },
                { name: "ORTAK_ALAN", type: sql.Bit },
                { name: "FISLERI_AKTARILACAK_ALAN", type: sql.Bit },
                { name: "CARI_KAYIT_BILGI_SILME", type: sql.Bit },
                { name: "FAVORI_PARA_ID", type: sql.Int },
                { name: "TOPLAMDA_PARA_KODU", type: sql.Bit },
                { name: "DEVIR_ALANI", type: sql.VarChar, len: 200 },
                { name: "FISTE_SAAT_CIKMASIN", type: sql.Bit },
                { name: "DEVIR_ALANI2", type: sql.VarChar, len: 200 },
                { name: "IKINCI_PANO_DZG", type: sql.VarChar, len: 200 },
                { name: "DONEM_ONAY_TARIHI", type: sql.DateTime },
                { name: "DONEM_ONAY_GUN_SAYISI", type: sql.Int },
                { name: "ISCILIK_GIRIS_SEKLI", type: sql.TinyInt },
                { name: "YEDEK_KLASORU", type: sql.VarChar, len: 200 },
                { name: "E_DEFTER_MUKELLEFI", type: sql.Bit },
                { name: "DIG_CSV_DIZINI", type: sql.VarChar, len: 100 },
                { name: "DEGISIKLIK_TAKIP_SIFRESI", type: sql.VarChar, len: 30 },
                { name: "DEFAULT_KUR_KAYNAGI", type: sql.TinyInt },
                { name: "VERGI_SINIRI_ASILINCA_YASAKLA", type: sql.Bit },
                { name: "VADELI_ISLEM_CINSI", type: sql.TinyInt },
                { name: "KMV_HESABI", type: sql.Char, len: 20 },
                { name: "KMV_GIDER_HESABI", type: sql.Char, len: 20 },
                { name: "HAS_ALTIN_PARA_ID", type: sql.Int },
                { name: "ISCILIK_FIYATA_DAHIL", type: sql.Bit },
                { name: "ISCILIK_HESABI", type: sql.Char, len: 20 },
                { name: "KDV_GELIR_HESABI", type: sql.Char, len: 20 },
                { name: "KDV_GIDER_HESABI", type: sql.Char, len: 20 },
                { name: "TL_VERGI_SINIRI", type: sql.Float },
                { name: "MERKEZ_BANKASI_KURUNU_AL", type: sql.Bit },
                { name: "FISDE_KUR_TURU_DEGISEBILIR", type: sql.Bit },
                { name: "FOREKS_KUR_DOSYA_ADI", type: sql.VarChar, len: 200 },
                { name: "FOREKS_KUR_VEZNE_ID", type: sql.Int },
                { name: "FOREKS_KUR_YENILEME_SURESI", type: sql.Int },
                { name: "FOREKS_KUR_BASAMAK_SAYISI", type: sql.Int },
                { name: "ENTEGRATOR_YANIT_VERME_SURESI", type: sql.Int },
                { name: "E_BELGE_SERVER_IP", type: sql.Char, len: 20 },
                { name: "E_BELGE_SERVER_PORTU", type: sql.Int },
                { name: "XSLT_DOSYALARI_KOPYALANSIN", type: sql.Bit },
                { name: "RPT_DOSYALARI_KOPYALANSIN", type: sql.Bit },
                { name: "E_DOVIZ_FIS_BASILSIN", type: sql.Bit },
                { name: "WEB_ADRESI", type: sql.VarChar, len: 100 },
                { name: "EPOSTA", type: sql.VarChar, len: 100 },
                { name: "CARI_DEKONT_KUR_CINSI", type: sql.TinyInt },
                { name: "DOSYA_NO", type: sql.Char, len: 20 },
                { name: "XSLT_DIZINI", type: sql.VarChar, len: 200 },
                { name: "E_DOVIZ_FIS_BASLANGIC_TARIHI_1", type: sql.DateTime },
                { name: "E_DOVIZ_FIS_BASLANGIC_TARIHI_2", type: sql.DateTime },
                { name: "E_DOVIZ_FIS_BASLANGIC_TARIHI_3", type: sql.DateTime },
                { name: "E_DOVIZ_FIS_BASLANGIC_TARIHI_4", type: sql.DateTime },
                { name: "MERSIS_NO", type: sql.Char, len: 20 },
                { name: "YETKILI_MUESSESE_TIPI", type: sql.TinyInt },
                { name: "ALIS_FIS_BELGESI", type: sql.TinyInt },
                { name: "SATIS_FIS_BELGESI", type: sql.TinyInt },
                { name: "TICARET_SICIL_NO", type: sql.Char, len: 20 },
                { name: "FIS_MASAK_KONTROLU_VAR", type: sql.Bit },
                { name: "ENTEGRATORE_ANLIK_GONDERILSIN", type: sql.Bit },
                { name: "CARI_EKSTRA_BILGI_KONTROLU", type: sql.Bit },
                { name: "FIS_CARI_ISLEME_SORULSUN", type: sql.Bit },
                { name: "E_FATURA_PORTAL_ADRESI", type: sql.VarChar, len: 200 },
                { name: "IKINCI_YEDEK_KLASORU", type: sql.VarChar, len: 200 },
                { name: "FIRMA_DURUMU_RAPORU", type: sql.Bit },
                { name: "DIG_BORC_BAKIYE_RENGI", type: sql.Int },
                { name: "DIG_ALACAK_BAKIYE_RENGI", type: sql.Int },
                { name: "E_FATURA_POSTA_KUTUSU", type: sql.VarChar, len: 200 },
                { name: "E_IRSALIYE_POSTA_KUTUSU", type: sql.VarChar, len: 200 },
                { name: "E_FATURA_KDV_MUAFIYET_KODU", type: sql.Char, len: 20 },
                { name: "E_FATURA_KDV_MUAFIYET_ADI", type: sql.VarChar, len: 200 },
                { name: "SAR_KIMLIK_KONTROL_SINIRI", type: sql.Float },
                { name: "VERGI_NO_SORGULAMA_YONTEMI", type: sql.TinyInt },
                { name: "VERGI_SORGULAYAN_TC_NO", type: sql.Char, len: 20 },
                { name: "MUSAVIR_TURMOB_SIFRESI", type: sql.VarChar, len: 200 },
                { name: "E_BELGE_BASLANGIC_TARIHI", type: sql.DateTime },
                { name: "SARRAFIYE_FAVORI_BELGE_TURU", type: sql.TinyInt },
                { name: "KMV_UYGULAMA_SEKLI", type: sql.TinyInt },
                { name: "HAS_GUMUS_PARA_ID", type: sql.Int },
            ];
            // Ensure at least one row exists in TODVZ_TANIM
            if (existing.recordset.length === 0) {
                await pool.request().query(`
          INSERT INTO [dbo].[TODVZ_TANIM] (SURUM, SUBE_KODU, FIRMA_ADI) 
          VALUES ('2016', '1', 'Firma Tanımı');
        `);
            }
            // Re-fetch existing row
            const currentRes = await pool.request().query(`
        SELECT TOP 1 * FROM [dbo].[TODVZ_TANIM]
      `);
            const existingRow = currentRes.recordset[0] || {};
            // 1. Check if SODVZ_FIRMA_TANIMI_KAYDET procedure exists; if not, create it
            try {
                const procCheck = await pool.request().query(`
          SELECT OBJECT_ID(N'[dbo].[SODVZ_FIRMA_TANIMI_KAYDET]') AS procId
        `);
                if (!procCheck.recordset[0]?.procId) {
                    await pool.request().query(`
            CREATE PROCEDURE [dbo].[SODVZ_FIRMA_TANIMI_KAYDET]
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
              @E_DEFTER_MUKELLEFI BIT = 0
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
                [E_DEFTER_MUKELLEFI] = @E_DEFTER_MUKELLEFI;
            END;
          `);
                }
            }
            catch (procCreateErr) {
                logger.warn("Could not check/create SODVZ_FIRMA_TANIMI_KAYDET procedure:", procCreateErr.message);
            }
            // 2. Execute SODVZ_FIRMA_TANIMI_KAYDET stored procedure
            const parseNum = (v) => (v !== undefined && v !== null && v !== "" && !isNaN(Number(v))) ? Number(v) : null;
            try {
                const procReq = pool.request();
                const fAdi = (data.FIRMA_ADI !== undefined ? data.FIRMA_ADI : existingRow.FIRMA_ADI) || null;
                const dosyaNo = (data.DOSYA_NO !== undefined ? data.DOSYA_NO : existingRow.DOSYA_NO) || null;
                const subeKodu = (data.SUBE_KODU !== undefined ? data.SUBE_KODU : existingRow.SUBE_KODU) || "1";
                const subeAdi = (data.SUBE_ADI !== undefined ? data.SUBE_ADI : existingRow.SUBE_ADI) || null;
                const vdId = parseNum(data.VERGI_DAIRESI_ID) ?? parseNum(existingRow.VERGI_DAIRESI_ID);
                const vkn = (data.VERGI_KIMLIK_NO !== undefined ? data.VERGI_KIMLIK_NO : existingRow.VERGI_KIMLIK_NO) || null;
                const adres = (data.ADRES !== undefined ? data.ADRES : existingRow.ADRES) || null;
                const pkId = parseNum(data.POSTA_KODU_ID) ?? parseNum(existingRow.POSTA_KODU_ID);
                const ilceId = parseNum(data.ILCE_ID) ?? parseNum(existingRow.ILCE_ID);
                const ilId = parseNum(data.IL_ID) ?? parseNum(existingRow.IL_ID);
                const ulkeId = parseNum(data.ULKE_ID) ?? parseNum(existingRow.ULKE_ID);
                const telefon = (data.TELEFON !== undefined ? data.TELEFON : existingRow.TELEFON) || null;
                const webAdresi = (data.WEB_ADRESI !== undefined ? data.WEB_ADRESI : existingRow.WEB_ADRESI) || null;
                const eposta = (data.EPOSTA !== undefined ? data.EPOSTA : existingRow.EPOSTA) || null;
                const mersisNo = (data.MERSIS_NO !== undefined ? data.MERSIS_NO : existingRow.MERSIS_NO) || null;
                const tSicilNo = (data.TICARET_SICIL_NO !== undefined ? data.TICARET_SICIL_NO : existingRow.TICARET_SICIL_NO) || null;
                const muesseseTipi = Number(data.YETKILI_MUESSESE_TIPI ?? existingRow.YETKILI_MUESSESE_TIPI ?? 0);
                const eDefter = data.E_DEFTER_MUKELLEFI !== undefined ? (data.E_DEFTER_MUKELLEFI ? 1 : 0) : (existingRow.E_DEFTER_MUKELLEFI ? 1 : 0);
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
                await procReq.execute("SODVZ_FIRMA_TANIMI_KAYDET");
            }
            catch (procErr) {
                logger.warn("SODVZ_FIRMA_TANIMI_KAYDET execution error, continuing with full update:", procErr.message);
            }
            // 3. Update all table columns to ensure other tabs (Para, Muhasebe, Limitler, E-Belge, Fiş vb.) are saved
            const updateReq = pool.request();
            for (const col of columnMapping) {
                let val = data[col.name];
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
