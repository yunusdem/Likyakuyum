import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
const satir = (r) => ({
    anahtarId: r.ANAHTAR_ID,
    firmaId: r.FIRMA_ID,
    panoId: r.PANO_ID,
    anahtar: r.ANAHTAR,
    onbellekSn: Number(r.ONBELLEK_SN) || 1,
    durum: r.DURUM,
    olusturan: r.OLUSTURAN ?? null,
    olusturmaTarihi: r.OLUSTURMA_TARIHI,
    iptalEden: r.IPTAL_EDEN ?? null,
    iptalTarihi: r.IPTAL_TARIHI ?? null,
    sonErisim: r.SON_ERISIM ?? null,
    istekSayisi: Number(r.ISTEK_SAYISI) || 0,
});
const KOLONLAR = `ANAHTAR_ID, FIRMA_ID, PANO_ID, ANAHTAR, ONBELLEK_SN, DURUM, OLUSTURAN, OLUSTURMA_TARIHI, IPTAL_EDEN, IPTAL_TARIHI, SON_ERISIM, ISTEK_SAYISI`;
export class PanoAnahtarSqlRepository {
    static async tabloVarMi() {
        const pool = await getAdminPool();
        const res = await pool.request().query(`SELECT OBJECT_ID('dbo.ADM_PANO_ANAHTAR', 'U') AS T`);
        return !!res.recordset[0]?.T;
    }
    static async anahtarlaBul(anahtar) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("anahtar", sql.VarChar(40), anahtar)
            .query(`SELECT ${KOLONLAR} FROM dbo.ADM_PANO_ANAHTAR WHERE ANAHTAR = @anahtar`);
        return res.recordset.length ? satir(res.recordset[0]) : null;
    }
    /** Firmanın AKTIF anahtarları (pano başına en çok bir tane) */
    static async firmaninAktifleri(firmaId) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("firmaId", sql.Int, firmaId)
            .query(`SELECT ${KOLONLAR} FROM dbo.ADM_PANO_ANAHTAR WHERE FIRMA_ID = @firmaId AND DURUM = 'AKTIF' ORDER BY PANO_ID`);
        return res.recordset.map(satir);
    }
    static async aktifBul(firmaId, panoId) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("firmaId", sql.Int, firmaId)
            .input("panoId", sql.Int, panoId)
            .query(`SELECT ${KOLONLAR} FROM dbo.ADM_PANO_ANAHTAR WHERE FIRMA_ID = @firmaId AND PANO_ID = @panoId AND DURUM = 'AKTIF'`);
        return res.recordset.length ? satir(res.recordset[0]) : null;
    }
    /**
     * Yeni anahtar: aynı firma + panonun AKTIF anahtarı varsa tek işlemde IPTAL yapılır (eski adres anında kapanır),
     * önbellek süresi eskisinden devralınır. Eski kaydın adresi döner (önbellek temizliği için).
     */
    static async uret(firmaId, panoId, anahtar, olusturan) {
        const pool = await getAdminPool();
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const eski = await new sql.Request(tx)
                .input("firmaId", sql.Int, firmaId)
                .input("panoId", sql.Int, panoId)
                .input("kim", sql.NVarChar(100), olusturan)
                .query(`UPDATE dbo.ADM_PANO_ANAHTAR SET DURUM = 'IPTAL', IPTAL_EDEN = @kim, IPTAL_TARIHI = GETDATE()
           OUTPUT DELETED.ANAHTAR, DELETED.ONBELLEK_SN
           WHERE FIRMA_ID = @firmaId AND PANO_ID = @panoId AND DURUM = 'AKTIF'`);
            const onbellekSn = eski.recordset.length ? Number(eski.recordset[0].ONBELLEK_SN) || 2 : 2;
            const res = await new sql.Request(tx)
                .input("firmaId", sql.Int, firmaId)
                .input("panoId", sql.Int, panoId)
                .input("anahtar", sql.VarChar(40), anahtar)
                .input("onbellekSn", sql.Int, onbellekSn)
                .input("kim", sql.NVarChar(100), olusturan)
                .query(`INSERT INTO dbo.ADM_PANO_ANAHTAR (FIRMA_ID, PANO_ID, ANAHTAR, ONBELLEK_SN, OLUSTURAN)
           OUTPUT INSERTED.*
           VALUES (@firmaId, @panoId, @anahtar, @onbellekSn, @kim)`);
            await tx.commit();
            return { yeni: satir(res.recordset[0]), eskiAnahtar: eski.recordset.length ? eski.recordset[0].ANAHTAR : null };
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw err;
        }
    }
    /** AKTIF anahtarı iptal eder; iptal edilen adresi döner (yoksa null) */
    static async iptal(firmaId, panoId, kim) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("firmaId", sql.Int, firmaId)
            .input("panoId", sql.Int, panoId)
            .input("kim", sql.NVarChar(100), kim)
            .query(`UPDATE dbo.ADM_PANO_ANAHTAR SET DURUM = 'IPTAL', IPTAL_EDEN = @kim, IPTAL_TARIHI = GETDATE()
         OUTPUT DELETED.ANAHTAR
         WHERE FIRMA_ID = @firmaId AND PANO_ID = @panoId AND DURUM = 'AKTIF'`);
        return res.recordset.length ? res.recordset[0].ANAHTAR : null;
    }
    static async onbellekYaz(firmaId, panoId, sn) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("firmaId", sql.Int, firmaId)
            .input("panoId", sql.Int, panoId)
            .input("sn", sql.Int, sn)
            .query(`UPDATE dbo.ADM_PANO_ANAHTAR SET ONBELLEK_SN = @sn OUTPUT INSERTED.*
         WHERE FIRMA_ID = @firmaId AND PANO_ID = @panoId AND DURUM = 'AKTIF'`);
        return res.recordset.length ? satir(res.recordset[0]) : null;
    }
    /** Toplu sayaç yazımı: istek sayısı eklenir, son erişim ileri alınır */
    static async sayacYaz(sayaclar) {
        if (!sayaclar.length)
            return;
        const pool = await getAdminPool();
        for (const s of sayaclar) {
            await pool
                .request()
                .input("id", sql.Int, s.anahtarId)
                .input("adet", sql.BigInt, s.adet)
                .input("son", sql.DateTime, s.son)
                .query(`UPDATE dbo.ADM_PANO_ANAHTAR SET ISTEK_SAYISI = ISTEK_SAYISI + @adet,
             SON_ERISIM = CASE WHEN SON_ERISIM IS NULL OR SON_ERISIM < @son THEN @son ELSE SON_ERISIM END
           WHERE ANAHTAR_ID = @id`);
        }
    }
}
