import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
const hazirlanan = new Set();
export class EbelgeNaceRepository {
    static async pool(ctx) {
        const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
        const anahtar = `${ctx?.dbServer || ""}|${ctx?.dbName || ""}`;
        if (hazirlanan.has(anahtar))
            return pool;
        await pool.request().query(`
      IF OBJECT_ID('dbo.TODVZ_EBELGE_NACE','U') IS NULL
      BEGIN TRY
        CREATE TABLE dbo.TODVZ_EBELGE_NACE (
          ID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
          SIRA int NOT NULL DEFAULT 0,
          NACE_KODU varchar(10) NOT NULL,
          ACIKLAMA nvarchar(200) NOT NULL DEFAULT '',
          KDV_ORANLARI varchar(50) NOT NULL DEFAULT '',
          GUNCELLEYEN nvarchar(50) NULL,
          GUNCELLEME_TARIHI datetime2 NOT NULL DEFAULT SYSDATETIME()
        );
      END TRY BEGIN CATCH IF ERROR_NUMBER() <> 2714 THROW; END CATCH;
    `);
        hazirlanan.add(anahtar);
        return pool;
    }
    static async listele(ctx) {
        const pool = await this.pool(ctx);
        const r = await pool.request().query(`SELECT NACE_KODU, ACIKLAMA, KDV_ORANLARI FROM dbo.TODVZ_EBELGE_NACE ORDER BY SIRA, ID`);
        return r.recordset.map((x) => ({
            kod: String(x.NACE_KODU).trim(),
            aciklama: String(x.ACIKLAMA || ""),
            oranlar: String(x.KDV_ORANLARI || "")
                .split(",")
                .map((o) => o.trim())
                .filter((o) => o !== "")
                .map(Number)
                .filter((o) => Number.isFinite(o)),
        }));
    }
    /** Listenin tamamını değiştirir (tek işlem içinde). */
    static async kaydet(liste, kullanici, ctx) {
        const pool = await this.pool(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_EBELGE_NACE`);
            for (const [i, n] of liste.entries()) {
                await new sql.Request(tx)
                    .input("sira", sql.Int, i)
                    .input("kod", sql.VarChar(10), n.kod)
                    .input("aciklama", sql.NVarChar(200), n.aciklama)
                    .input("oranlar", sql.VarChar(50), n.oranlar.join(","))
                    .input("kullanici", sql.NVarChar(50), kullanici.slice(0, 50))
                    .query(`INSERT INTO dbo.TODVZ_EBELGE_NACE (SIRA, NACE_KODU, ACIKLAMA, KDV_ORANLARI, GUNCELLEYEN)
                  VALUES (@sira, @kod, @aciklama, @oranlar, @kullanici)`);
            }
            await tx.commit();
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw err;
        }
    }
}
