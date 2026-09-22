import sql from "mssql";
import crypto from "crypto";
import { getAdminPool } from "../../config/adminDb.config.js";
/** ADM_OTURUM tablosunun admin (TUR='ADMIN') tarafı. Kullanıcı oturumları Faz 5'te eklenecek. */
export class AdminOturumSqlRepository {
    /** Adminin açık oturumlarını kapatıp yenisini açar (admin başına tek oturum). Yeni sid döner. */
    static async ac(adminId, ip, tarayici) {
        const pool = await getAdminPool();
        const sid = crypto.randomUUID();
        await pool
            .request()
            .input("sid", sql.UniqueIdentifier, sid)
            .input("adminId", sql.Int, adminId)
            .input("ip", sql.VarChar(64), ip)
            .input("tarayici", sql.NVarChar(400), tarayici).query(`
        SET XACT_ABORT ON;
        BEGIN TRAN;
        UPDATE dbo.ADM_OTURUM SET BITIS = GETDATE()
        WHERE TUR = 'ADMIN' AND ADMIN_ID = @adminId AND BITIS IS NULL;
        INSERT INTO dbo.ADM_OTURUM (OTURUM_ID, TUR, ADMIN_ID, IP, TARAYICI) VALUES (@sid, 'ADMIN', @adminId, @ip, @tarayici);
        COMMIT;
      `);
        return sid;
    }
    /**
     * Geçerli (kapanmamış, iptal edilmemiş, admini hâlâ AKTIF) oturumu getirir ve
     * SON_ISLEM'i en fazla dakikada bir günceller.
     */
    static async gecerliOturum(sid, adminId) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("sid", sql.UniqueIdentifier, sid)
            .input("adminId", sql.Int, adminId).query(`
        UPDATE dbo.ADM_OTURUM SET SON_ISLEM = GETDATE()
        WHERE OTURUM_ID = @sid AND BITIS IS NULL AND SON_ISLEM < DATEADD(SECOND, -60, GETDATE());

        SELECT a.ADMIN_ID, a.KULLANICI_ADI, a.AD_SOYAD, a.SIFRE_DEGISMELI
        FROM dbo.ADM_OTURUM o
        INNER JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = o.ADMIN_ID
        WHERE o.OTURUM_ID = @sid AND o.TUR = 'ADMIN' AND o.ADMIN_ID = @adminId
          AND o.BITIS IS NULL AND o.IPTAL_EDILDI = 0 AND a.DURUM = 'AKTIF';
      `);
        const r = res.recordset[0];
        if (!r)
            return null;
        return {
            sid,
            adminId: r.ADMIN_ID,
            kullaniciAdi: r.KULLANICI_ADI,
            adSoyad: r.AD_SOYAD,
            sifreDegismeli: !!r.SIFRE_DEGISMELI,
        };
    }
    static async kapat(sid) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("sid", sql.UniqueIdentifier, sid)
            .query(`UPDATE dbo.ADM_OTURUM SET BITIS = GETDATE() WHERE OTURUM_ID = @sid AND BITIS IS NULL`);
    }
    /** Yönetim panelindeki Çevrimiçi listesinden başka bir adminin oturumunu kapatma */
    static async sidIleIptalEt(sid, iptalEdenAdminId) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("sid", sql.UniqueIdentifier, sid)
            .input("iptalEden", sql.Int, iptalEdenAdminId).query(`
        UPDATE dbo.ADM_OTURUM SET BITIS = GETDATE(), IPTAL_EDILDI = 1, IPTAL_EDEN_ADMIN_ID = @iptalEden
        WHERE OTURUM_ID = @sid AND TUR = 'ADMIN' AND BITIS IS NULL
      `);
        return res.rowsAffected?.[0] || 0;
    }
    /** Bir adminin tüm açık oturumlarını iptal eder (pasife alma, şifre sıfırlama). haricSid verilirse o oturum korunur. */
    static async adminOturumlariniIptalEt(adminId, iptalEdenAdminId, haricSid) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("adminId", sql.Int, adminId)
            .input("iptalEden", sql.Int, iptalEdenAdminId)
            .input("haric", sql.UniqueIdentifier, haricSid ?? null).query(`
        UPDATE dbo.ADM_OTURUM
        SET BITIS = GETDATE(), IPTAL_EDILDI = 1, IPTAL_EDEN_ADMIN_ID = @iptalEden
        WHERE TUR = 'ADMIN' AND ADMIN_ID = @adminId AND BITIS IS NULL
          AND (@haric IS NULL OR OTURUM_ID <> @haric);
      `);
    }
}
