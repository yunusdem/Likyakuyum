import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
const satir = (r) => ({
    dagitimId: Number(r.DAGITIM_ID),
    hedef: r.HEDEF,
    oncekiCommit: r.ONCEKI_COMMIT ?? null,
    hedefCommit: r.HEDEF_COMMIT ?? null,
    baslatanAdminId: r.BASLATAN_ADMIN_ID ?? null,
    baslatan: r.BASLATAN ?? null,
    baslangic: r.BASLANGIC,
    bitis: r.BITIS ?? null,
    durum: r.DURUM,
    adim: r.ADIM ?? null,
    mesaj: r.MESAJ ?? null,
    logDosyasi: r.LOG_DOSYASI ?? null,
    goruldu: !!r.GORULDU,
});
export class DagitimSqlRepository {
    static async kuruluMu() {
        const pool = await getAdminPool();
        const r = await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.ADM_DAGITIM') IS NULL THEN 0 ELSE 1 END AS V`);
        return r.recordset[0]?.V === 1;
    }
    static async ekle(k) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("hedef", sql.VarChar(10), k.hedef)
            .input("hc", sql.VarChar(60), k.hedefCommit)
            .input("oc", sql.VarChar(60), k.oncekiCommit)
            .input("aid", sql.Int, k.baslatanAdminId)
            .input("ad", sql.NVarChar(120), k.baslatan)
            .input("log", sql.NVarChar(400), k.logDosyasi)
            .query(`INSERT INTO dbo.ADM_DAGITIM (HEDEF, ONCEKI_COMMIT, HEDEF_COMMIT, BASLATAN_ADMIN_ID, BASLATAN, DURUM, ADIM, LOG_DOSYASI)
              OUTPUT INSERTED.DAGITIM_ID VALUES (@hedef, @oc, @hc, @aid, @ad, 'CALISIYOR', N'Başlatılıyor', @log)`);
        return Number(r.recordset[0].DAGITIM_ID);
    }
    static async ilerle(id, adim, mesaj) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, id)
            .input("adim", sql.NVarChar(200), adim)
            .input("mesaj", sql.NVarChar(1000), mesaj)
            .query(`UPDATE dbo.ADM_DAGITIM SET ADIM = @adim, MESAJ = @mesaj WHERE DAGITIM_ID = @id AND DURUM = 'CALISIYOR'`);
    }
    static async bitir(id, durum, mesaj, oncekiCommit, hedefCommit) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, id)
            .input("durum", sql.VarChar(20), durum)
            .input("mesaj", sql.NVarChar(1000), mesaj)
            .input("oc", sql.VarChar(60), oncekiCommit)
            .input("hc", sql.VarChar(60), hedefCommit)
            .query(`UPDATE dbo.ADM_DAGITIM SET DURUM = @durum, MESAJ = @mesaj, BITIS = GETDATE(), ADIM = NULL,
                ONCEKI_COMMIT = ISNULL(@oc, ONCEKI_COMMIT), HEDEF_COMMIT = ISNULL(@hc, HEDEF_COMMIT)
              WHERE DAGITIM_ID = @id`);
    }
    static async getir(id) {
        const pool = await getAdminPool();
        const r = await pool.request().input("id", sql.Int, id).query(`SELECT * FROM dbo.ADM_DAGITIM WHERE DAGITIM_ID = @id`);
        return r.recordset[0] ? satir(r.recordset[0]) : null;
    }
    static async calisan() {
        const pool = await getAdminPool();
        const r = await pool.request().query(`SELECT TOP 1 * FROM dbo.ADM_DAGITIM WHERE DURUM = 'CALISIYOR' ORDER BY DAGITIM_ID DESC`);
        return r.recordset[0] ? satir(r.recordset[0]) : null;
    }
    static async gecmis(adet = 30) {
        const pool = await getAdminPool();
        const r = await pool.request().input("n", sql.Int, adet).query(`SELECT TOP (@n) * FROM dbo.ADM_DAGITIM ORDER BY DAGITIM_ID DESC`);
        return r.recordset.map(satir);
    }
    /** Son hatalı ve henüz görülmemiş dağıtım (menüdeki kırmızı sayaç) */
    static async gorulmemisHata() {
        const pool = await getAdminPool();
        const r = await pool.request().query(`SELECT COUNT(*) AS N FROM dbo.ADM_DAGITIM WHERE GORULDU = 0 AND DURUM IN ('HATA','GERI_DONDU','GERI_DONUS_HATASI')`);
        return Number(r.recordset[0]?.N || 0);
    }
    static async goruldu() {
        const pool = await getAdminPool();
        await pool.request().query(`UPDATE dbo.ADM_DAGITIM SET GORULDU = 1 WHERE GORULDU = 0 AND DURUM <> 'CALISIYOR'`);
    }
    /** Son başarılı/geri dönmüş dağıtımın bıraktığı commit (hedef başına) */
    static async sonBiten(hedef) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("hedef", sql.VarChar(10), hedef)
            .query(`SELECT TOP 1 * FROM dbo.ADM_DAGITIM WHERE HEDEF = @hedef AND DURUM <> 'CALISIYOR' ORDER BY DAGITIM_ID DESC`);
        return r.recordset[0] ? satir(r.recordset[0]) : null;
    }
}
