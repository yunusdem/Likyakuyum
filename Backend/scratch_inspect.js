import "./dist/config/env.config.js";
import fs from "fs";
import { getDbPool } from "./dist/config/mssql.config.js";

async function main() {
  const pool = await getDbPool();
  const paralar = await pool.request().query("SELECT PARA_ID, KOD, AD, HAS_ORANI, GRAMAJ, URUN_TIPI FROM TODVZ_PARA");
  const ayarlar = await pool.request().query("SELECT * FROM TODVZ_AYAR");
  const vezneler = await pool.request().query("SELECT VEZNE_ID, KOD, AD FROM TODVZ_VEZNE");
  const bakiyeler = await pool.request().query(`
    SELECT b.VEZNE_ID, v.KOD AS VEZNE_KOD, b.PARA_ID, p.KOD AS PARA_KOD, p.AD AS PARA_AD, b.MIKTAR 
    FROM TODVZ_VEZNE_BAKIYE b
    LEFT JOIN TODVZ_PARA p ON p.PARA_ID = b.PARA_ID
    LEFT JOIN TODVZ_VEZNE v ON v.VEZNE_ID = b.VEZNE_ID
    WHERE b.MIKTAR <> 0
  `);

  const data = {
    paralar: paralar.recordset,
    ayarlar: ayarlar.recordset,
    vezneler: vezneler.recordset,
    bakiyeler: bakiyeler.recordset
  };

  fs.writeFileSync("/Users/aliunnab/Documents/GitHub/Likyakuyum/Backend/scratch_output.json", JSON.stringify(data, null, 2), "utf-8");
  console.log("DONE");
  process.exit(0);
}

main().catch(err => {
  console.error("ERROR IN MAIN:", err);
  process.exit(1);
});
