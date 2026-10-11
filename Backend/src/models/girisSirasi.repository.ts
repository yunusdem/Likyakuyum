import sql from "mssql";
import { getDbPool, getPoolKey } from "../config/mssql.config.js";

/**
 * Kullanıcıya özel giriş sırası (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K3–K4): ekran başına alanların
 * Enter sırası ve "atla" işareti. Tablo göçle (005_giris_sirasi.sql) gelir; göç uygulanmamış veritabanında
 * ilk kullanımda da oluşturulur.
 */

export type DbContext = { dbServer?: string; dbName?: string };
export interface GirisSirasiAlani {
  alan: string;
  atla: boolean;
}
export type GirisSiralari = Record<string, GirisSirasiAlani[]>;

const TABLO_SQL = `
IF OBJECT_ID('dbo.TODVZ_GIRIS_SIRASI', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TODVZ_GIRIS_SIRASI (
    KULLANICI_ID INT NOT NULL,
    EKRAN VARCHAR(80) NOT NULL,
    ALAN VARCHAR(80) NOT NULL,
    SIRA INT NOT NULL,
    ATLA BIT NOT NULL CONSTRAINT DF_TODVZ_GIRIS_SIRASI_ATLA DEFAULT 0,
    GUNCELLEME_ZAMANI DATETIME NOT NULL CONSTRAINT DF_TODVZ_GIRIS_SIRASI_ZAMAN DEFAULT GETDATE(),
    CONSTRAINT PK_TODVZ_GIRIS_SIRASI PRIMARY KEY CLUSTERED (KULLANICI_ID, EKRAN, ALAN)
  );
END;`;

const hazirHavuzlar = new Set<string>();

export class GirisSirasiRepository {
  private static async pool(ctx?: DbContext): Promise<sql.ConnectionPool> {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    const anahtar = getPoolKey(ctx?.dbServer, ctx?.dbName);
    if (!hazirHavuzlar.has(anahtar)) {
      await pool.request().batch(TABLO_SQL);
      hazirHavuzlar.add(anahtar);
    }
    return pool;
  }

  /** Kullanıcının bütün ekranlardaki sıraları */
  static async hepsi(kullaniciId: number, ctx?: DbContext): Promise<GirisSiralari> {
    const pool = await this.pool(ctx);
    const r = await pool
      .request()
      .input("k", sql.Int, kullaniciId)
      .query(`SELECT EKRAN, ALAN, ATLA FROM dbo.TODVZ_GIRIS_SIRASI WHERE KULLANICI_ID = @k ORDER BY EKRAN, SIRA, ALAN`);
    const sonuc: GirisSiralari = {};
    for (const s of r.recordset) (sonuc[s.EKRAN] ||= []).push({ alan: s.ALAN, atla: !!s.ATLA });
    return sonuc;
  }

  /** Ekranın sırasını baştan yazar (liste sırası = SIRA). Boş liste = kayıt silinir. */
  static async kaydet(kullaniciId: number, ekran: string, alanlar: GirisSirasiAlani[], ctx?: DbContext): Promise<void> {
    const pool = await this.pool(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx)
        .input("k", sql.Int, kullaniciId)
        .input("e", sql.VarChar(80), ekran)
        .query(`DELETE FROM dbo.TODVZ_GIRIS_SIRASI WHERE KULLANICI_ID = @k AND EKRAN = @e`);
      for (let i = 0; i < alanlar.length; i++) {
        await new sql.Request(tx)
          .input("k", sql.Int, kullaniciId)
          .input("e", sql.VarChar(80), ekran)
          .input("a", sql.VarChar(80), alanlar[i].alan)
          .input("s", sql.Int, i + 1)
          .input("t", sql.Bit, alanlar[i].atla ? 1 : 0)
          .query(`INSERT INTO dbo.TODVZ_GIRIS_SIRASI (KULLANICI_ID, EKRAN, ALAN, SIRA, ATLA) VALUES (@k, @e, @a, @s, @t)`);
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }
}
