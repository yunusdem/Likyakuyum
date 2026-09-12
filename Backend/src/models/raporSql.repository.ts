import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { BelgeSqlRepository, type DbContext } from "./belgeSql.repository.js";

/**
 * Rapor modülü veri erişimi. Şablon meta'sı `TODVZ_BELGE_SABLON` (TUR='RAPOR') tablosunda;
 * yoksa 9 rapor kaydı eklenir. Rapor verisi `services/rapor/raporVeri.ts` sorgularından (yalnızca SELECT).
 */
export const RAPOR_SEED: { kod: string; ad: string; kagit: string }[] = [
  { kod: "CARBAK1", ad: "Cari Bakiye Raporu", kagit: "A4" },
  { kod: "CAREKS1", ad: "Cari Ekstre", kagit: "A4" },
  { kod: "CARHAR1", ad: "Cari Hareket Listesi", kagit: "A4-yatay" },
  { kod: "CARKRT1", ad: "Cari Kart Listesi", kagit: "A4-yatay" },
  { kod: "VEZBAK1", ad: "Vezne Bakiye Raporu (Tarih Bazlı)", kagit: "A4" },
  { kod: "VEZHAR1", ad: "Vezne Hareket Listesi", kagit: "A4-yatay" },
  { kod: "VERKOM1", ad: "Vergiler ve Komisyon", kagit: "A4-yatay" },
  { kod: "KARZAR1", ad: "Kâr / Zarar Faaliyet Analizi", kagit: "A4-yatay" },
  { kod: "FIRVAR1", ad: "Firma Varlıkları Raporu", kagit: "A4" },
];

export class RaporSqlRepository {
  private static hazirlanan = new Set<string>();

  static async pool(ctx?: DbContext): Promise<sql.ConnectionPool> {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    const anahtar = `${ctx?.dbServer || ""}|${ctx?.dbName || ""}`;
    if (!this.hazirlanan.has(anahtar)) {
      await BelgeSqlRepository.ensureTablesExist(pool);
      await this.seed(pool);
      this.hazirlanan.add(anahtar);
    }
    return pool;
  }

  private static async seed(pool: sql.ConnectionPool) {
    try {
      const degerler = RAPOR_SEED.map(r => `('${r.kod}', N'${r.ad.replace(/'/g, "''")}', 'RAPOR', NULL, 'rapor/${r.kod}.json', '${r.kagit}', 1, 1)`).join(",\n");
      await pool.request().query(`
        ;WITH S(KOD, AD, TUR, FIS_TIPI, DUZEN_DOSYASI, KAGIT, VARSAYILAN, AKTIF) AS (SELECT * FROM (VALUES ${degerler}) V(KOD, AD, TUR, FIS_TIPI, DUZEN_DOSYASI, KAGIT, VARSAYILAN, AKTIF))
        INSERT INTO dbo.TODVZ_BELGE_SABLON (KOD, AD, TUR, FIS_TIPI, DUZEN_DOSYASI, KAGIT, VARSAYILAN, AKTIF)
        SELECT S.KOD, S.AD, S.TUR, S.FIS_TIPI, S.DUZEN_DOSYASI, S.KAGIT, S.VARSAYILAN, S.AKTIF FROM S
        WHERE NOT EXISTS (SELECT 1 FROM dbo.TODVZ_BELGE_SABLON B WHERE B.KOD=S.KOD);`);
    } catch (e) { logger.error("RaporSqlRepository.seed hatası:", e); throw e; }
  }

  static async sablonlar(ctx?: DbContext) {
    const pool = await this.pool(ctx);
    const res = await pool.request().query(`SELECT KOD kod, AD ad, KAGIT kagit, DUZEN_DOSYASI duzenDosyasi FROM dbo.TODVZ_BELGE_SABLON WHERE TUR='RAPOR' AND AKTIF=1 ORDER BY SABLON_ID`);
    return res.recordset.map((r: any) => ({ kod: String(r.kod).trim(), ad: String(r.ad).trim(), kagit: String(r.kagit).trim(), duzenDosyasi: String(r.duzenDosyasi).trim() }));
  }
}
