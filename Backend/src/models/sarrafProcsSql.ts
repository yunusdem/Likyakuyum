import sql from "mssql";
import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Denetim her firma veritabanında (havuzda) bir kez yapılır; tek genel bayrak ilk firmadan sonrakileri hiç denetletmiyordu
// (ortak alan denetimi 19.11.2026, #3)
const _procChecked = new WeakSet<sql.ConnectionPool>();

export async function ensureSarrafStoredProcedures(pool: sql.ConnectionPool): Promise<void> {
  if (_procChecked.has(pool)) return;
  try {
    // Kaydet ve sil yordamı ayrı ayrı denetlenir (ortak alan denetimi 19.11.2026, #3): göç 021 kaydet yordamını kurduğu için
    // yalnız ona bakan denetim geçiyor, depodaki sil yordamı hiç kurulmuyordu. Eski şifreli sil yordamı (tanımı NULL döner)
    // altın/gümüşte gram yerine adet geri alıyor, vezne bakiyesi bozuk kalıyordu; doğrusu URUN_TIPI kuralını içerir.
    const check = await pool.request().query(`
      SELECT
        CASE WHEN OBJECT_DEFINITION(OBJECT_ID('SODVZ_SARRAF_FISI_KAYDET')) LIKE '%ISCILIK_TUTARI%' THEN 1 ELSE 0 END AS kaydetOk,
        CASE WHEN OBJECT_DEFINITION(OBJECT_ID('SODVZ_SARRAF_FISI_SIL')) LIKE '%URUN_TIPI%' THEN 1 ELSE 0 END AS silOk
    `).catch(() => ({ recordset: [{ kaydetOk: 1, silOk: 1 }] }));

    const kaydetOk = check.recordset?.[0]?.kaydetOk === 1;
    const silOk = check.recordset?.[0]?.silOk === 1;
    if (kaydetOk && silOk) {
      _procChecked.add(pool);
      return;
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const kaydetPath = path.resolve(__dirname, "../../current_SODVZ_SARRAF_FISI_KAYDET.sql");
    const silPath = path.resolve(__dirname, "../../current_SODVZ_SARRAF_FISI_SIL.sql");

    if (!kaydetOk && fs.existsSync(kaydetPath)) {
      const kaydetSql = fs.readFileSync(kaydetPath, "utf8");
      await pool.request().query(kaydetSql);
    }
    if (!silOk && fs.existsSync(silPath)) {
      const silSql = fs.readFileSync(silPath, "utf8");
      await pool.request().query(silSql);
    }
    _procChecked.add(pool);
    logger.info("SODVZ_SARRAF_FISI procedures verified and updated.");
  } catch (err: any) {
    logger.warn("ensureSarrafStoredProcedures warning:", err?.message || err);
  }
}
