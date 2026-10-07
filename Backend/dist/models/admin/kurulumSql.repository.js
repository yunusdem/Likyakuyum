import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
export class KurulumSqlRepository {
    static async firmaKoduIleBul(firmaKodu) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("kod", sql.VarChar(20), firmaKodu)
            .query(`SELECT FIRMA_ID, FIRMA_KODU, DURUM, BAGLANTI_MODU, MAKINE_KIMLIGI, HEDEF_SURUM FROM dbo.ADM_FIRMA WHERE FIRMA_KODU = @kod`);
        const r = res.recordset[0];
        return r
            ? {
                firmaId: r.FIRMA_ID,
                firmaKodu: r.FIRMA_KODU,
                durum: r.DURUM,
                baglantiModu: r.BAGLANTI_MODU,
                makineKimligi: r.MAKINE_KIMLIGI ?? null,
                hedefSurum: r.HEDEF_SURUM ?? null,
            }
            : null;
    }
    /** Bildirimi yazar: firmanın son durumu güncellenir, geçmişe satır eklenir, 30 günden eski satırlar silinir. */
    static async heartbeatYaz(k) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, k.firmaId)
            .input("surum", sql.VarChar(30), k.surum)
            .input("makine", sql.VarChar(40), k.makineKimligi)
            .input("lisans", sql.VarChar(20), k.lisansDurumu)
            .input("kilit", sql.VarChar(30), k.kilitNedeni)
            .input("kullanici", sql.Int, k.kullaniciSayisi)
            .input("sema", sql.Int, k.semaSurumu)
            .input("ip", sql.VarChar(45), k.ip)
            .query(`
        UPDATE dbo.ADM_FIRMA SET SON_GORULME = GETDATE(), SURUM = @surum, BILDIRILEN_LISANS_DURUMU = @lisans,
               BILDIRILEN_KILIT_NEDENI = @kilit, BILDIRILEN_KULLANICI_SAYISI = @kullanici, SEMA_SURUMU = @sema
               -- Lisanslı makine (MAKINE_KIMLIGI) yalnız panelde kod üretilirken yazılır; bildirilen makine geçmiş kaydında durur
        WHERE FIRMA_ID = @id;
        INSERT INTO dbo.ADM_HEARTBEAT_LOG (FIRMA_ID, SURUM, MAKINE_KIMLIGI, LISANS_DURUMU, KILIT_NEDENI, KULLANICI_SAYISI, SEMA_SURUMU, IP)
        VALUES (@id, @surum, @makine, @lisans, @kilit, @kullanici, @sema, @ip);
        DELETE FROM dbo.ADM_HEARTBEAT_LOG WHERE FIRMA_ID = @id AND TARIH < DATEADD(DAY, -30, GETDATE());`);
    }
    /** Son bildirimdeki makine kimliği (panelde kod üretirken önerilir). */
    static async sonBildirilenMakine(firmaId) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("id", sql.Int, firmaId)
            .query(`SELECT TOP 1 MAKINE_KIMLIGI FROM dbo.ADM_HEARTBEAT_LOG WHERE FIRMA_ID = @id AND MAKINE_KIMLIGI IS NOT NULL ORDER BY LOG_ID DESC`);
        return res.recordset[0]?.MAKINE_KIMLIGI ?? null;
    }
    static async heartbeatGecmisi(firmaId, adet = 50) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("id", sql.Int, firmaId)
            .input("adet", sql.Int, adet)
            .query(`SELECT TOP (@adet) TARIH, SURUM, MAKINE_KIMLIGI, LISANS_DURUMU, KILIT_NEDENI, KULLANICI_SAYISI, SEMA_SURUMU, IP
              FROM dbo.ADM_HEARTBEAT_LOG WHERE FIRMA_ID = @id ORDER BY LOG_ID DESC`);
        return res.recordset.map((r) => ({
            tarih: r.TARIH,
            surum: r.SURUM ?? null,
            makineKimligi: r.MAKINE_KIMLIGI ?? null,
            lisansDurumu: r.LISANS_DURUMU ?? null,
            kilitNedeni: r.KILIT_NEDENI ?? null,
            kullaniciSayisi: r.KULLANICI_SAYISI ?? null,
            semaSurumu: r.SEMA_SURUMU ?? null,
            ip: r.IP ?? null,
        }));
    }
}
