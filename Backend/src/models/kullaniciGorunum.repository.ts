import sql from "mssql";
import { getDbPool, getPoolKey } from "../config/mssql.config.js";

/**
 * Kullanıcı görünümü (docs/KULLANICI_GORUNUM_YOL_HARITASI.md, G7): yöneticinin çalışana kapattığı modül kodları.
 * Yalnız KAPALI kodlar saklanır; satır yoksa kullanıcı firmanın lisansındaki her şeyi görür. Tablo göçle
 * (012_kullanici_gorunum.sql) gelir; göç uygulanmamış veritabanında ilk kullanımda da oluşturulur.
 */

export type DbContext = { dbServer?: string; dbName?: string };

export const MODUL_KODU_SINIRI = 160;

const TABLO_SQL = `
IF OBJECT_ID('dbo.TODVZ_KULLANICI_GORUNUM', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TODVZ_KULLANICI_GORUNUM (
    KULLANICI_ID INT NOT NULL,
    MODUL_KODU VARCHAR(${MODUL_KODU_SINIRI}) NOT NULL,
    GUNCELLEME_ZAMANI DATETIME NOT NULL CONSTRAINT DF_TODVZ_KULLANICI_GORUNUM_ZAMAN DEFAULT GETDATE(),
    CONSTRAINT PK_TODVZ_KULLANICI_GORUNUM PRIMARY KEY CLUSTERED (KULLANICI_ID, MODUL_KODU)
  );
END;`;

const hazirHavuzlar = new Set<string>();

export class KullaniciGorunumRepository {
  private static async pool(ctx?: DbContext): Promise<sql.ConnectionPool> {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    const anahtar = getPoolKey(ctx?.dbServer, ctx?.dbName);
    if (!hazirHavuzlar.has(anahtar)) {
      await pool.request().batch(TABLO_SQL);
      hazirHavuzlar.add(anahtar);
    }
    return pool;
  }

  /** Kullanıcıya kapatılmış modül kodları (boş = her şey açık) */
  static async kapalilar(kullaniciId: number, ctx?: DbContext): Promise<string[]> {
    const pool = await this.pool(ctx);
    const r = await pool
      .request()
      .input("k", sql.Int, kullaniciId)
      .query(`SELECT MODUL_KODU FROM dbo.TODVZ_KULLANICI_GORUNUM WHERE KULLANICI_ID = @k ORDER BY MODUL_KODU`);
    return r.recordset.map((s: any) => String(s.MODUL_KODU));
  }

  /** Kapalı listeyi baştan yazar; boş liste = kayıt silinir (her şey açık) */
  static async kaydet(kullaniciId: number, kodlar: string[], ctx?: DbContext): Promise<void> {
    const pool = await this.pool(ctx);
    const tekil = [...new Set(kodlar)];
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).input("k", sql.Int, kullaniciId).query(`DELETE FROM dbo.TODVZ_KULLANICI_GORUNUM WHERE KULLANICI_ID = @k`);
      for (const kod of tekil) {
        await new sql.Request(tx)
          .input("k", sql.Int, kullaniciId)
          .input("m", sql.VarChar(MODUL_KODU_SINIRI), kod)
          .query(`INSERT INTO dbo.TODVZ_KULLANICI_GORUNUM (KULLANICI_ID, MODUL_KODU) VALUES (@k, @m)`);
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }
}
