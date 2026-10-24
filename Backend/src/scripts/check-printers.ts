import { getDbPool } from "../config/mssql.config.js";

async function main() {
  const pool = await getDbPool();
  const printers = await pool.request().query("SELECT ID, SIRA_NO, TANIM_ADI, CIHAZ_ADI, KOPYA_SAYISI FROM dbo.TYAZICI_TANIM");
  console.log("PRINTERS_RESULT:" + JSON.stringify(printers.recordset, null, 2));
  const vezneler = await pool.request().query("SELECT ID, KOD, AD, YAZICI_ID FROM dbo.TVEZNE_TANIM");
  console.log("VEZNELER_RESULT:" + JSON.stringify(vezneler.recordset, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
