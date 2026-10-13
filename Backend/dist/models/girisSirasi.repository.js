import sql from "mssql";
import { getDbPool, getPoolKey } from "../config/mssql.config.js";
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
const hazirHavuzlar = new Set();
export class GirisSirasiRepository {
    static async pool(ctx) {
        const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
        const anahtar = getPoolKey(ctx?.dbServer, ctx?.dbName);
        if (!hazirHavuzlar.has(anahtar)) {
            await pool.request().batch(TABLO_SQL);
            hazirHavuzlar.add(anahtar);
        }
        return pool;
    }
    /** Kullanıcının bütün ekranlardaki sıraları */
    static async hepsi(kullaniciId, ctx) {
        const pool = await this.pool(ctx);
        const r = await pool
            .request()
            .input("k", sql.Int, kullaniciId)
            .query(`SELECT EKRAN, ALAN, ATLA FROM dbo.TODVZ_GIRIS_SIRASI WHERE KULLANICI_ID = @k ORDER BY EKRAN, SIRA, ALAN`);
        const sonuc = {};
        for (const s of r.recordset)
            (sonuc[s.EKRAN] ||= []).push({ alan: s.ALAN, atla: !!s.ATLA });
        return sonuc;
    }
    /** Ekranın sırasını baştan yazar (liste sırası = SIRA). Boş liste = kayıt silinir. */
    static async kaydet(kullaniciId, ekran, alanlar, ctx) {
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
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
    }
}
