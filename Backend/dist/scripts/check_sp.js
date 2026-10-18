import "dotenv/config";
import { getDbPool } from "../config/mssql.config.js";
import { ensureSarrafStoredProcedures } from "../models/sarrafProcsSql.js";
async function main() {
    const pool = await getDbPool();
    console.log("Ensuring SPs...");
    await ensureSarrafStoredProcedures(pool);
    console.log("SPs ensured!");
    const res = await pool.request().query("SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('dbo.SODVZ_SARRAF_FISI_KAYDET')");
    const def = res.recordset[0]?.definition || "";
    console.log("Definition length:", def.length);
    const idx = def.indexOf("TODVZ_VEZNE_BAKIYE");
    console.log("Snippet at TODVZ_VEZNE_BAKIYE:\n", def.slice(idx, idx + 450));
    process.exit(0);
}
main().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
