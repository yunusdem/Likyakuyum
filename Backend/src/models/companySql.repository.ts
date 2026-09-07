import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { TodvzTanimEntity } from "../types/company.types.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export class CompanySqlRepository {
  /**
   * Fetches company definitions from [dbo].[TODVZ_TANIM] in the target database
   */
  public static async getDefinitions(dbContext?: {
    dbServer?: string;
    dbName?: string;
  }): Promise<TodvzTanimEntity | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const result = await pool.request().query<TodvzTanimEntity>(`
        SELECT TOP 1 *
        FROM [dbo].[TODVZ_TANIM]
      `);

      return result.recordset[0] || null;
    } catch (error: any) {
      logger.error("Error fetching TODVZ_TANIM:", error);
      throw ApiError.internal("Firma tanımları veritabanından yüklenirken bir hata oluştu.");
    }
  }

  /**
   * Updates or inserts company definitions into [dbo].[TODVZ_TANIM] in the target database
   */
  public static async updateDefinitions(
    data: Partial<TodvzTanimEntity>,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<TodvzTanimEntity> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

      // Check if row exists in TODVZ_TANIM
      const existing = await pool.request().query<TodvzTanimEntity>(`
        SELECT TOP 1 * FROM [dbo].[TODVZ_TANIM]
      `);

      const request = pool.request();

      // List of all column definitions with their SQL types
      const columnMapping: Array<{
        name: keyof TodvzTanimEntity;
        type: sql.ISqlTypeFactoryWithNoParams | sql.ISqlTypeFactoryWithLength | sql.ISqlTypeFactoryWithPrecisionScale;
        len?: number;
      }> = [
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

      // Bind all parameters
      for (const col of columnMapping) {
        const val = data[col.name];
        if (col.len && (col.type === sql.VarChar || col.type === sql.Char)) {
          request.input(col.name as string, (col.type as any)(col.len), val !== undefined ? val : null);
        } else {
          request.input(col.name as string, col.type as any, val !== undefined ? val : null);
        }
      }

      if (existing.recordset.length > 0) {
        // UPDATE existing row
        const setClauses = columnMapping.map((col) => `[${col.name as string}] = @${col.name as string}`).join(",\n");
        const updateQuery = `
          UPDATE [dbo].[TODVZ_TANIM]
          SET ${setClauses};

          SELECT TOP 1 * FROM [dbo].[TODVZ_TANIM];
        `;

        const result = await request.query<TodvzTanimEntity>(updateQuery);
        return result.recordset[0];
      } else {
        // INSERT row
        const colNames = columnMapping.map((col) => `[${col.name as string}]`).join(", ");
        const paramNames = columnMapping.map((col) => `@${col.name as string}`).join(", ");
        const insertQuery = `
          INSERT INTO [dbo].[TODVZ_TANIM] (${colNames})
          VALUES (${paramNames});

          SELECT TOP 1 * FROM [dbo].[TODVZ_TANIM];
        `;

        const result = await request.query<TodvzTanimEntity>(insertQuery);
        return result.recordset[0];
      }
    } catch (error: any) {
      logger.error("Error updating TODVZ_TANIM:", error);
      throw ApiError.internal(`Firma tanımları güncellenirken hata oluştu: ${error.message}`);
    }
  }
}
