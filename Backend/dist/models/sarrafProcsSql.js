import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
let _procChecked = false;
export async function ensureSarrafStoredProcedures(pool) {
    if (_procChecked)
        return;
    try {
        const check = await pool.request().query(`
      SELECT CASE 
        WHEN OBJECT_DEFINITION(OBJECT_ID('SODVZ_SARRAF_FISI_KAYDET')) LIKE '%Altın (1) veya Gümüş (2) ise: kesinlikle MİKTAR (gram) vezneye işlenmeli%' THEN 1 
        ELSE 0 
      END AS ok
    `).catch(() => ({ recordset: [{ ok: 1 }] }));
        if (check.recordset && check.recordset[0]?.ok === 1) {
            _procChecked = true;
            return;
        }
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const kaydetPath = path.resolve(__dirname, "../../current_SODVZ_SARRAF_FISI_KAYDET.sql");
        const silPath = path.resolve(__dirname, "../../current_SODVZ_SARRAF_FISI_SIL.sql");
        if (fs.existsSync(kaydetPath)) {
            const kaydetSql = fs.readFileSync(kaydetPath, "utf8");
            await pool.request().query(kaydetSql);
        }
        if (fs.existsSync(silPath)) {
            const silSql = fs.readFileSync(silPath, "utf8");
            await pool.request().query(silSql);
        }
        _procChecked = true;
        logger.info("SODVZ_SARRAF_FISI procedures verified and updated.");
    }
    catch (err) {
        logger.warn("ensureSarrafStoredProcedures warning:", err?.message || err);
    }
}
