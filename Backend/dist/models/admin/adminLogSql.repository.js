import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { logger } from "../../utils/logger.js";
/** ADM_GIRIS_LOG ve ADM_ISLEM_LOG yazıcıları. Log yazılamaması asıl işlemi bozmaz. */
export class AdminLogSqlRepository {
    static async girisLogu(kayit) {
        try {
            const pool = await getAdminPool();
            await pool
                .request()
                .input("tur", sql.VarChar(10), kayit.tur)
                .input("firmaId", sql.Int, kayit.firmaId ?? null)
                .input("ad", sql.NVarChar(100), (kayit.kullaniciAdi || "").slice(0, 100))
                .input("basarili", sql.Bit, kayit.basarili)
                .input("neden", sql.NVarChar(200), kayit.redNedeni ?? null)
                .input("ip", sql.VarChar(64), kayit.ip)
                .input("tarayici", sql.NVarChar(400), kayit.tarayici).query(`
          INSERT INTO dbo.ADM_GIRIS_LOG (TUR, FIRMA_ID, KULLANICI_ADI, BASARILI, RED_NEDENI, IP, TARAYICI)
          VALUES (@tur, @firmaId, @ad, @basarili, @neden, @ip, @tarayici)
        `);
        }
        catch (err) {
            logger.error(`[ADMIN] Giriş logu yazılamadı: ${err?.message}`);
        }
    }
    /** Denetim izi. eski/yeni değerler JSON'a çevrilir; çağıran buraya şifre/hash KOYMAMALIDIR. */
    static async islemLogu(kayit) {
        try {
            const pool = await getAdminPool();
            await pool
                .request()
                .input("adminId", sql.Int, kayit.adminId)
                .input("islem", sql.VarChar(40), kayit.islem)
                .input("hedefTur", sql.VarChar(20), kayit.hedefTur ?? null)
                .input("hedefId", sql.VarChar(50), kayit.hedefId !== undefined ? String(kayit.hedefId) : null)
                .input("eski", sql.NVarChar(sql.MAX), kayit.eski !== undefined ? JSON.stringify(kayit.eski) : null)
                .input("yeni", sql.NVarChar(sql.MAX), kayit.yeni !== undefined ? JSON.stringify(kayit.yeni) : null).query(`
          INSERT INTO dbo.ADM_ISLEM_LOG (ADMIN_ID, ISLEM, HEDEF_TUR, HEDEF_ID, ESKI_DEGER, YENI_DEGER)
          VALUES (@adminId, @islem, @hedefTur, @hedefId, @eski, @yeni)
        `);
        }
        catch (err) {
            logger.error(`[ADMIN] İşlem logu yazılamadı (${kayit.islem}): ${err?.message}`);
        }
    }
}
