import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface VezneIzlemeSettings {
  tazelemeSuresi: number;
  ekrandakiVezneSayisi: number;
  toplamdaParaKodu: boolean;
  firmaDurumuRaporu: boolean;
}

export interface VezneIzlemeColumn {
  vezneId: number;
  kod: string;
  ad: string;
  isAnaKasa: boolean;
}

export interface VezneIzlemeRow {
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  siraNo: number;
  bakiyeler: Record<number, number>; // vezneId -> miktar
  toplam: number;
}

export interface VezneIzlemeDataResponse {
  settings: VezneIzlemeSettings;
  columns: VezneIzlemeColumn[];
  rows: VezneIzlemeRow[];
}

export class VezneIzlemeSqlRepository {
  private static spEnsured = false;

  /**
   * Ensures the stored procedure SODVZ_VEZNE_IZLEME_TANIMI_KAYDET exists in the database
   */
  public static async ensureStoredProcedure(pool: sql.ConnectionPool): Promise<void> {
    if (this.spEnsured) return;

    try {
      const checkQuery = `
        SELECT 1 FROM sys.objects 
        WHERE object_id = OBJECT_ID(N'[dbo].[SODVZ_VEZNE_IZLEME_TANIMI_KAYDET]') 
          AND type in (N'P', N'PC')
      `;
      const res = await pool.request().query(checkQuery);

      if (!res.recordset || res.recordset.length === 0) {
        logger.info("SODVZ_VEZNE_IZLEME_TANIMI_KAYDET prosedürü bulunamadı, oluşturuluyor...");
        await pool.request().batch(`
          CREATE PROCEDURE [dbo].[SODVZ_VEZNE_IZLEME_TANIMI_KAYDET]
            @TAZELEME_SURESI INT,
            @EKRANDAKI_VEZNE_SAYISI TINYINT,
            @TOPLAMDA_PARA_KODU BIT,
            @FIRMA_DURUMU_RAPORU BIT
          AS
          BEGIN
            SET NOCOUNT ON;
            UPDATE [dbo].[TODVZ_TANIM] SET
              TAZELEME_SURESI = @TAZELEME_SURESI,
              EKRANDAKI_VEZNE_SAYISI = @EKRANDAKI_VEZNE_SAYISI,
              TOPLAMDA_PARA_KODU = @TOPLAMDA_PARA_KODU,
              FIRMA_DURUMU_RAPORU = @FIRMA_DURUMU_RAPORU;
          END
        `);
        logger.info("SODVZ_VEZNE_IZLEME_TANIMI_KAYDET prosedürü başarıyla oluşturuldu.");
      }
      this.spEnsured = true;
    } catch (err) {
      logger.warn("ensureStoredProcedure(SODVZ_VEZNE_IZLEME_TANIMI_KAYDET) uyarısı:", err);
    }
  }

  /**
   * Executes SODVZ_VEZNE_IZLEME_TANIMI_KAYDET to update TODVZ_TANIM
   */
  public static async saveSettings(
    settings: VezneIzlemeSettings,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneIzlemeSettings> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureStoredProcedure(pool);

    try {
      const req = pool.request();
      req.input("TAZELEME_SURESI", sql.Int, settings.tazelemeSuresi ?? 5);
      req.input("EKRANDAKI_VEZNE_SAYISI", sql.TinyInt, settings.ekrandakiVezneSayisi ?? 8);
      req.input("TOPLAMDA_PARA_KODU", sql.Bit, settings.toplamdaParaKodu ? 1 : 0);
      req.input("FIRMA_DURUMU_RAPORU", sql.Bit, settings.firmaDurumuRaporu ? 1 : 0);

      try {
        await req.execute("[dbo].[SODVZ_VEZNE_IZLEME_TANIMI_KAYDET]");
      } catch (spError) {
        logger.warn("SP execution failed, attempting direct UPDATE on TODVZ_TANIM:", spError);
        const directReq = pool.request();
        directReq.input("TAZELEME_SURESI", sql.Int, settings.tazelemeSuresi ?? 5);
        directReq.input("EKRANDAKI_VEZNE_SAYISI", sql.TinyInt, settings.ekrandakiVezneSayisi ?? 8);
        directReq.input("TOPLAMDA_PARA_KODU", sql.Bit, settings.toplamdaParaKodu ? 1 : 0);
        directReq.input("FIRMA_DURUMU_RAPORU", sql.Bit, settings.firmaDurumuRaporu ? 1 : 0);
        await directReq.query(`
          UPDATE [dbo].[TODVZ_TANIM] SET
            TAZELEME_SURESI = @TAZELEME_SURESI,
            EKRANDAKI_VEZNE_SAYISI = @EKRANDAKI_VEZNE_SAYISI,
            TOPLAMDA_PARA_KODU = @TOPLAMDA_PARA_KODU,
            FIRMA_DURUMU_RAPORU = @FIRMA_DURUMU_RAPORU;
        `);
      }

      return settings;
    } catch (error: any) {
      logger.error("VezneIzlemeSqlRepository.saveSettings error:", error);
      throw ApiError.internal("Vezne izleme tanımı kaydedilemedi: " + (error?.message || ""));
    }
  }

  /**
   * Retrieves complete data matrix for Vezne İzleme page
   */
  public static async getIzlemeData(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneIzlemeDataResponse> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    try {
      // 1. Settings from TODVZ_TANIM
      const tanimResult = await pool.request().query(`
        SELECT TOP 1
          ISNULL(TAZELEME_SURESI, 5) AS tazelemeSuresi,
          ISNULL(EKRANDAKI_VEZNE_SAYISI, 8) AS ekrandakiVezneSayisi,
          ISNULL(TOPLAMDA_PARA_KODU, 1) AS toplamdaParaKodu,
          ISNULL(FIRMA_DURUMU_RAPORU, 0) AS firmaDurumuRaporu
        FROM [dbo].[TODVZ_TANIM] WITH (NOLOCK)
      `);

      const tanimRow = tanimResult.recordset[0] || {};
      const settings: VezneIzlemeSettings = {
        tazelemeSuresi: tanimRow.tazelemeSuresi !== undefined ? Number(tanimRow.tazelemeSuresi) : 5,
        ekrandakiVezneSayisi: tanimRow.ekrandakiVezneSayisi !== undefined ? Number(tanimRow.ekrandakiVezneSayisi) : 8,
        toplamdaParaKodu: tanimRow.toplamdaParaKodu === true || tanimRow.toplamdaParaKodu === 1,
        firmaDurumuRaporu: tanimRow.firmaDurumuRaporu === true || tanimRow.firmaDurumuRaporu === 1,
      };

      // 2. Vezneler from TODVZ_VEZNE
      // Sort priority: "Ana kasa" first, then KOD ascending
      const veznelerResult = await pool.request().query(`
        SELECT
          VEZNE_ID AS vezneId,
          LTRIM(RTRIM(ISNULL(KOD, ''))) AS kod,
          LTRIM(RTRIM(ISNULL(AD, ''))) AS ad
        FROM [dbo].[TODVZ_VEZNE] WITH (NOLOCK)
        ORDER BY
          CASE 
            WHEN LOWER(LTRIM(RTRIM(AD))) LIKE '%ana%' OR LOWER(LTRIM(RTRIM(KOD))) = 'ana' OR LTRIM(RTRIM(KOD)) = '00' THEN 0 
            ELSE 1 
          END ASC,
          KOD ASC,
          VEZNE_ID ASC
      `);

      const columns: VezneIzlemeColumn[] = (veznelerResult.recordset || []).map((v: any) => {
        const ad = (v.ad || "").trim();
        const kod = (v.kod || "").trim();
        const isAna =
          ad.toLowerCase().includes("ana") ||
          kod.toLowerCase() === "ana" ||
          kod === "00";
        return {
          vezneId: Number(v.vezneId),
          kod,
          ad: ad || kod,
          isAnaKasa: isAna,
        };
      });

      // 3. Paralar from TODVZ_PARA
      const paralarResult = await pool.request().query(`
        SELECT
          PARA_ID AS paraId,
          LTRIM(RTRIM(ISNULL(KOD, ''))) AS paraKodu,
          LTRIM(RTRIM(ISNULL(AD, ''))) AS paraAdi,
          ISNULL(SIRA_NO, 999) AS siraNo
        FROM [dbo].[TODVZ_PARA] WITH (NOLOCK)
        ORDER BY SIRA_NO ASC, KOD ASC
      `);

      const paralar = (paralarResult.recordset || []).map((p: any) => ({
        paraId: Number(p.paraId),
        paraKodu: (p.paraKodu || "").trim(),
        paraAdi: (p.paraAdi || "").trim(),
        siraNo: Number(p.siraNo),
      }));

      // 4. Bakiyeler from TODVZ_VEZNE_BAKIYE
      let bakiyeMap = new Map<string, number>(); // `${paraId}_${vezneId}` -> miktar

      try {
        const bakiyeResult = await pool.request().query(`
          SELECT
            VEZNE_ID AS vezneId,
            PARA_ID AS paraId,
            ISNULL(MIKTAR, 0) AS miktar
          FROM [dbo].[TODVZ_VEZNE_BAKIYE] WITH (NOLOCK)
        `);

        if (bakiyeResult.recordset && bakiyeResult.recordset.length > 0) {
          for (const row of bakiyeResult.recordset) {
            const key = `${row.paraId}_${row.vezneId}`;
            bakiyeMap.set(key, Number(row.miktar) || 0);
          }
        }
      } catch (bErr) {
        logger.warn("TODVZ_VEZNE_BAKIYE okunamadı:", bErr);
      }

      const rows: VezneIzlemeRow[] = paralar.map((p) => {
        const rowBakiyeler: Record<number, number> = {};
        let rowToplam = 0;

        for (const col of columns) {
          const key = `${p.paraId}_${col.vezneId}`;
          const miktar = bakiyeMap.get(key) || 0;
          rowBakiyeler[col.vezneId] = miktar;
          rowToplam += miktar;
        }

        return {
          paraId: p.paraId,
          paraKodu: p.paraKodu,
          paraAdi: p.paraAdi,
          siraNo: p.siraNo,
          bakiyeler: rowBakiyeler,
          toplam: rowToplam,
        };
      });

      return {
        settings,
        columns,
        rows,
      };
    } catch (error: any) {
      logger.error("VezneIzlemeSqlRepository.getIzlemeData error:", error);
      throw ApiError.internal("Vezne izleme verileri yüklenemedi: " + (error?.message || ""));
    }
  }

  /**
   * Updates balance for a specific vezne and para in TODVZ_VEZNE_BAKIYE
   */
  public static async updateBakiye(
    vezneId: number,
    paraId: number,
    miktar: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<void> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    try {
      const req = pool.request();
      req.input("vezneId", sql.Int, vezneId);
      req.input("paraId", sql.Int, paraId);
      req.input("miktar", sql.Decimal(18, 4), miktar);

      await req.query(`
        IF EXISTS (SELECT 1 FROM [dbo].[TODVZ_VEZNE_BAKIYE] WHERE VEZNE_ID = @vezneId AND PARA_ID = @paraId)
          UPDATE [dbo].[TODVZ_VEZNE_BAKIYE] SET MIKTAR = @miktar WHERE VEZNE_ID = @vezneId AND PARA_ID = @paraId
        ELSE
          INSERT INTO [dbo].[TODVZ_VEZNE_BAKIYE] (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@vezneId, @paraId, @miktar)
      `);
    } catch (error: any) {
      logger.error(`VezneIzlemeSqlRepository.updateBakiye(${vezneId}, ${paraId}, ${miktar}) error:`, error);
      throw ApiError.internal("Vezne bakiyesi güncellenemedi: " + (error?.message || ""));
    }
  }

  /**
   * Batch updates balances for all provided vezne-para pairs in TODVZ_VEZNE_BAKIYE
   */
  public static async updateAllBakiyeler(
    items: { vezneId: number; paraId: number; miktar: number }[],
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<void> {
    if (!items || items.length === 0) return;

    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      for (const item of items) {
        const req = new sql.Request(transaction);
        req.input("vezneId", sql.Int, item.vezneId);
        req.input("paraId", sql.Int, item.paraId);
        req.input("miktar", sql.Decimal(18, 4), item.miktar || 0);

        await req.query(`
          IF EXISTS (SELECT 1 FROM [dbo].[TODVZ_VEZNE_BAKIYE] WHERE VEZNE_ID = @vezneId AND PARA_ID = @paraId)
            UPDATE [dbo].[TODVZ_VEZNE_BAKIYE] SET MIKTAR = @miktar WHERE VEZNE_ID = @vezneId AND PARA_ID = @paraId
          ELSE
            INSERT INTO [dbo].[TODVZ_VEZNE_BAKIYE] (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@vezneId, @paraId, @miktar)
        `);
      }

      await transaction.commit();
    } catch (error: any) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        // ignore
      }
      logger.error("VezneIzlemeSqlRepository.updateAllBakiyeler error:", error);
      throw ApiError.internal("Toplu vezne bakiyeleri kaydedilemedi: " + (error?.message || ""));
    }
  }
}
