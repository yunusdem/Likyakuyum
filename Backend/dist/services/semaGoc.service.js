import fs from "fs";
import path from "path";
import sql from "mssql";
import { fileURLToPath } from "url";
export const gocKlasoru = () => {
    const burasi = path.dirname(fileURLToPath(import.meta.url));
    // src/services ya da dist/services → Backend/migrations
    return path.resolve(burasi, "../../migrations");
};
/** "GO" satırlarına göre böler (SSMS'teki gibi; satırda yalnız GO). */
export const batchlereBol = (metin) => metin
    .replace(/^\uFEFF/, "")
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.replace(/--[^\n]*/g, "").trim() !== "");
export const gocDosyalari = (klasor = gocKlasoru()) => {
    let adlar = [];
    try {
        adlar = fs.readdirSync(klasor);
    }
    catch {
        return [];
    }
    const dosyalar = adlar
        .map((ad) => ({ ad, m: ad.match(/^(\d{3,})_[A-Za-z0-9_]+\.sql$/) }))
        .filter((x) => !!x.m)
        .map((x) => ({ no: Number(x.m[1]), ad: x.ad, batchler: batchlereBol(fs.readFileSync(path.join(klasor, x.ad), "utf8")) }))
        .sort((a, b) => a.no - b.no);
    const nolar = new Set();
    for (const d of dosyalar) {
        if (nolar.has(d.no))
            throw new Error(`Aynı numaralı iki göç dosyası var: ${d.no}`);
        nolar.add(d.no);
    }
    return dosyalar;
};
export const enYuksekGoc = (dosyalar = gocDosyalari()) => dosyalar.reduce((m, d) => Math.max(m, d.no), 0);
export const semaSurumu = async (pool) => {
    const res = await pool
        .request()
        .query(`SELECT CASE WHEN OBJECT_ID('dbo.LKY_SEMA_SURUMU') IS NULL THEN 0 ELSE (SELECT ISNULL(MAX(SURUM), 0) FROM dbo.LKY_SEMA_SURUMU) END AS S`);
    return Number(res.recordset[0].S);
};
/** Bir göç dosyası uygulanamadı (bağlantı hatasından ayrı: açılışta yeniden denenmez, bkz. kurulum/gocDurumu.ts) */
export class GocDosyasiHatasi extends Error {
}
/** Göç komutları büyük tabloda (ör. NOT NULL kolon ekleme) havuzun 30 sn'lik zaman aşımını aşabilir */
const GOC_ZAMAN_ASIMI_MS = 10 * 60 * 1000;
const gocIstegi = (tx) => new sql.Request(tx, { requestTimeout: GOC_ZAMAN_ASIMI_MS });
export const semaGocUygula = async (pool, dosyalar = gocDosyalari()) => {
    await pool.request().batch(`
    IF OBJECT_ID('dbo.LKY_SEMA_SURUMU') IS NULL
      CREATE TABLE dbo.LKY_SEMA_SURUMU (SURUM int NOT NULL PRIMARY KEY, AD nvarchar(200) NOT NULL, TARIH datetime NOT NULL DEFAULT GETDATE());`);
    const onceki = await semaSurumu(pool);
    const kayitli = new Map((await pool.request().query(`SELECT SURUM, AD FROM dbo.LKY_SEMA_SURUMU`)).recordset.map((r) => [Number(r.SURUM), String(r.AD ?? "").trim()]));
    const uygulanan = [];
    for (const d of dosyalar.filter((x) => kayitli.get(x.no) !== x.ad)) {
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            for (const b of d.batchler)
                await gocIstegi(tx).batch(b);
            await new sql.Request(tx)
                .input("no", sql.Int, d.no)
                .input("ad", sql.NVarChar(200), d.ad)
                .query(`
          IF EXISTS (SELECT 1 FROM dbo.LKY_SEMA_SURUMU WHERE SURUM = @no)
            UPDATE dbo.LKY_SEMA_SURUMU SET AD = @ad, TARIH = GETDATE() WHERE SURUM = @no
          ELSE
            INSERT INTO dbo.LKY_SEMA_SURUMU (SURUM, AD) VALUES (@no, @ad)`);
            await tx.commit();
            uygulanan.push(d.ad);
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw new GocDosyasiHatasi(`Şema göçü ${d.ad} uygulanamadı: ${err?.message || err}`);
        }
    }
    return { onceki, sonraki: await semaSurumu(pool), uygulanan };
};
