import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { DbContext } from "./ebelgeSql.repository.js";

/**
 * Fatura serileri — E-Belge Ayarları'nda belge türüne göre tanımlanır (docs/GIRIS_VE_EBELGE_DUZENLEME.md R3).
 * Fatura formundaki numara listesi yalnızca bu serilerden gelir; numara ICE'deki son sıra + 1 ile hesaplanır.
 * Tür başına en fazla bir varsayılan seri.
 */
export type SeriBelgeTuru = "EFatura" | "EArsiv";
export interface SeriKaydi {
  belgeTuru: SeriBelgeTuru;
  seri: string;
  varsayilan: boolean;
}

const hazirlanan = new Set<string>();

export class EbelgeSeriRepository {
  private static async pool(ctx?: DbContext) {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    const anahtar = `${ctx?.dbServer || ""}|${ctx?.dbName || ""}`;
    if (hazirlanan.has(anahtar)) return pool;
    await pool.request().query(`
      IF OBJECT_ID('dbo.TODVZ_EBELGE_SERI','U') IS NULL
      BEGIN TRY
        CREATE TABLE dbo.TODVZ_EBELGE_SERI (
          ID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
          BELGE_TURU varchar(20) NOT NULL,
          SERI char(3) NOT NULL,
          VARSAYILAN bit NOT NULL DEFAULT 0,
          SIRA int NOT NULL DEFAULT 0,
          GUNCELLEYEN nvarchar(50) NULL,
          GUNCELLEME_TARIHI datetime2 NOT NULL DEFAULT SYSDATETIME(),
          CONSTRAINT UQ_TODVZ_EBELGE_SERI UNIQUE (BELGE_TURU, SERI)
        );
      END TRY BEGIN CATCH IF ERROR_NUMBER() <> 2714 THROW; END CATCH;
    `);
    hazirlanan.add(anahtar);
    return pool;
  }

  static async listele(belgeTuru: SeriBelgeTuru | undefined, ctx?: DbContext): Promise<SeriKaydi[]> {
    const pool = await this.pool(ctx);
    const r = await pool
      .request()
      .input("tur", sql.VarChar(20), belgeTuru || null)
      .query(`SELECT RTRIM(BELGE_TURU) AS belgeTuru, RTRIM(SERI) AS seri, VARSAYILAN AS varsayilan
              FROM dbo.TODVZ_EBELGE_SERI WHERE @tur IS NULL OR BELGE_TURU = @tur ORDER BY BELGE_TURU, SIRA, ID`);
    return r.recordset.map((x: any) => ({ belgeTuru: x.belgeTuru, seri: x.seri, varsayilan: !!x.varsayilan }));
  }

  /** Listenin tamamını değiştirir (tek işlem içinde). */
  static async kaydet(liste: SeriKaydi[], kullanici: string, ctx?: DbContext): Promise<void> {
    const pool = await this.pool(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_EBELGE_SERI`);
      for (const [i, s] of liste.entries()) {
        await new sql.Request(tx)
          .input("tur", sql.VarChar(20), s.belgeTuru)
          .input("seri", sql.Char(3), s.seri)
          .input("varsayilan", sql.Bit, s.varsayilan)
          .input("sira", sql.Int, i)
          .input("kullanici", sql.NVarChar(50), kullanici.slice(0, 50))
          .query(`INSERT INTO dbo.TODVZ_EBELGE_SERI (BELGE_TURU, SERI, VARSAYILAN, SIRA, GUNCELLEYEN)
                  VALUES (@tur, @seri, @varsayilan, @sira, @kullanici)`);
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }
}
