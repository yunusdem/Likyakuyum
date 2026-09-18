import { getDbPool } from "../config/mssql.config.js";
async function main() {
    try {
        const pool = await getDbPool();
        console.log('Connected to DB');
        const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'TODVZ_NUMERATOR'
    `);
        console.log('TODVZ_NUMERATOR columns:', cols.recordset);
        const rows = await pool.request().query('SELECT * FROM TODVZ_NUMERATOR ORDER BY TUR ASC');
        console.log('TODVZ_NUMERATOR rows count:', rows.recordset?.length);
        console.log('TODVZ_NUMERATOR rows:', rows.recordset);
        const spDef = await pool.request().query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID('SODVZ_NUMERATOR_URET')) as def
    `);
        console.log('SODVZ_NUMERATOR_URET def:\n', spDef.recordset[0]?.def);
        const spFisDef = await pool.request().query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID('SODVZ_FIS_KAYDET')) as def
    `);
        console.log('SODVZ_FIS_KAYDET def exists:', !!spFisDef.recordset[0]?.def);
        const tanimRows = await pool.request().query('SELECT E_DOVIZ_FIS_BASLANGIC_TARIHI, E_BELGE_BASLANGIC_TARIHI, OFIS_SARRAFIYE_PROGRAMI FROM TODVZ_TANIM');
        console.log('TODVZ_TANIM config:', tanimRows.recordset);
        const fisLast = await pool.request().query('SELECT TOP 5 FIS_ID, TARIH, TIP, SERI_NO, BELGE_NO FROM TODVZ_FIS ORDER BY FIS_ID DESC');
        console.log('Last 5 TODVZ_FIS:', fisLast.recordset);
    }
    catch (err) {
        console.error('Error in script:', err);
    }
    finally {
        process.exit(0);
    }
}
main();
