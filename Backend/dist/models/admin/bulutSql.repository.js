import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
export class BulutSqlRepository {
    /** Haftalık yedek sırası: yedeklenebilir durumdaki bulut firmaları, son yedeği `gun` günden eski olanlar önce. */
    static async yedeklenecekler(gun) {
        const pool = await getAdminPool();
        const res = await pool.request().input("gun", sql.Int, gun).query(`
      SELECT FIRMA_ID, FIRMA_KODU, DB_NAME, YEDEK_TARIHI FROM dbo.ADM_FIRMA
      WHERE BAGLANTI_MODU = 'cloud' AND DURUM IN ('AKTIF', 'DONDURULMUS', 'PASIF', 'SILINECEK')
        AND (YEDEK_TARIHI IS NULL OR YEDEK_TARIHI < DATEADD(DAY, -@gun, GETDATE()))
      ORDER BY CASE WHEN YEDEK_TARIHI IS NULL THEN 0 ELSE 1 END, YEDEK_TARIHI`);
        return res.recordset.map((r) => ({
            firmaId: r.FIRMA_ID,
            firmaKodu: r.FIRMA_KODU,
            dbName: r.DB_NAME,
            yedekTarihi: r.YEDEK_TARIHI ?? null,
        }));
    }
    static async yedekYaz(firmaId, dosya, boyut) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, firmaId)
            .input("dosya", sql.NVarChar(400), dosya)
            .input("boyut", sql.BigInt, boyut)
            .query(`UPDATE dbo.ADM_FIRMA SET YEDEK_DOSYA = @dosya, YEDEK_TARIHI = GETDATE(), YEDEK_BOYUT = @boyut WHERE FIRMA_ID = @id`);
    }
    static async yedekDosyasi(firmaId) {
        const pool = await getAdminPool();
        const res = await pool.request().input("id", sql.Int, firmaId).query(`SELECT YEDEK_DOSYA FROM dbo.ADM_FIRMA WHERE FIRMA_ID = @id`);
        return res.recordset[0]?.YEDEK_DOSYA ?? null;
    }
    /** "Sil": durum SILINECEK, kalıcı silinme +gun gün sonra. Yalnız AKTIF/DONDURULMUS/PASIF firmada geçerli. */
    static async silmePlanla(firmaId, gun, adminId) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("id", sql.Int, firmaId)
            .input("gun", sql.Int, gun)
            .input("adminId", sql.Int, adminId)
            .query(`
        UPDATE dbo.ADM_FIRMA SET DURUM = 'SILINECEK', DURUM_TARIHI = GETDATE(),
               DURUM_NOTU = N'Silme istendi; ' + CONVERT(nvarchar(10), DATEADD(DAY, @gun, GETDATE()), 104) + N' tarihinde kalıcı silinecek.',
               SILINME_PLANI = DATEADD(DAY, @gun, GETDATE()), SILINME_ISTEYEN_ADMIN_ID = @adminId
        WHERE FIRMA_ID = @id AND DURUM IN ('AKTIF', 'DONDURULMUS', 'PASIF')`);
        return (res.rowsAffected[0] ?? 0) > 0;
    }
    static async silmeGeriAl(firmaId) {
        const pool = await getAdminPool();
        const res = await pool.request().input("id", sql.Int, firmaId).query(`
      UPDATE dbo.ADM_FIRMA SET DURUM = 'AKTIF', DURUM_TARIHI = GETDATE(), DURUM_NOTU = N'Silme geri alındı.',
             SILINME_PLANI = NULL, SILINME_ISTEYEN_ADMIN_ID = NULL
      WHERE FIRMA_ID = @id AND DURUM = 'SILINECEK'`);
        return (res.rowsAffected[0] ?? 0) > 0;
    }
    /** Bekleme süresi dolmuş silme istekleri. */
    static async suresiDolanSilmeler() {
        const pool = await getAdminPool();
        const res = await pool.request().query(`
      SELECT FIRMA_ID, FIRMA_KODU, DB_SERVER, DB_NAME, DB_USER, SILINME_PLANI, YEDEK_DOSYA FROM dbo.ADM_FIRMA
      WHERE DURUM = 'SILINECEK' AND SILINME_PLANI IS NOT NULL AND SILINME_PLANI <= GETDATE()
      ORDER BY SILINME_PLANI`);
        return res.recordset.map((r) => ({
            firmaId: r.FIRMA_ID,
            firmaKodu: r.FIRMA_KODU,
            dbServer: r.DB_SERVER,
            dbName: r.DB_NAME,
            dbUser: r.DB_USER ?? null,
            silinmePlani: r.SILINME_PLANI,
            yedekDosya: r.YEDEK_DOSYA ?? null,
        }));
    }
    /**
     * Veritabanı kaldırıldıktan sonra: durum SILINDI, son yedek dosyası saklanır (+gun gün), şifre unutulur ve
     * eşleşme anahtarı serbest bırakılır (aynı veritabanı adı yeniden kullanılabilsin).
     */
    static async silindiIsaretle(firmaId, sonYedek, boyut, gun) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, firmaId)
            .input("dosya", sql.NVarChar(400), sonYedek)
            .input("boyut", sql.BigInt, boyut)
            .input("gun", sql.Int, gun)
            .query(`
        UPDATE dbo.ADM_FIRMA SET DURUM = 'SILINDI', DURUM_TARIHI = GETDATE(), DURUM_NOTU = N'Veritabanı kalıcı olarak silindi.',
               SILINDI_TARIHI = GETDATE(), SILINME_PLANI = NULL,
               YEDEK_DOSYA = @dosya, YEDEK_BOYUT = @boyut, YEDEK_TARIHI = CASE WHEN @dosya IS NULL THEN YEDEK_TARIHI ELSE GETDATE() END,
               YEDEK_SILINME_PLANI = CASE WHEN @dosya IS NULL THEN NULL ELSE DATEADD(DAY, @gun, GETDATE()) END,
               DB_SIFRE_ENC = NULL,
               DB_ANAHTAR = 'silindi:' + CAST(FIRMA_ID AS varchar(20)) + ':' + DB_ANAHTAR
        WHERE FIRMA_ID = @id AND DURUM = 'SILINECEK'`);
    }
    /** Saklama süresi dolmuş, silinmiş firmaların son yedekleri. */
    static async suresiDolanYedekler() {
        const pool = await getAdminPool();
        const res = await pool.request().query(`
      SELECT FIRMA_ID, FIRMA_KODU, YEDEK_DOSYA FROM dbo.ADM_FIRMA
      WHERE DURUM = 'SILINDI' AND YEDEK_DOSYA IS NOT NULL AND YEDEK_SILINME_PLANI IS NOT NULL AND YEDEK_SILINME_PLANI <= GETDATE()`);
        return res.recordset.map((r) => ({ firmaId: r.FIRMA_ID, firmaKodu: r.FIRMA_KODU, yedekDosya: r.YEDEK_DOSYA }));
    }
    static async yedekKaydiniTemizle(firmaId) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, firmaId)
            .query(`UPDATE dbo.ADM_FIRMA SET YEDEK_DOSYA = NULL, YEDEK_BOYUT = NULL, YEDEK_SILINME_PLANI = NULL WHERE FIRMA_ID = @id`);
    }
    // ------------------------------------------------------------ İndirme bağlantıları ---
    static async baglantiEkle(v) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("hash", sql.Char(64), v.tokenHash)
            .input("firmaId", sql.Int, v.firmaId)
            .input("tur", sql.VarChar(10), v.tur)
            .input("dakika", sql.Int, v.dakika)
            .input("adminId", sql.Int, v.adminId)
            .query(`
        INSERT INTO dbo.ADM_INDIRME_BAGLANTISI (TOKEN_HASH, FIRMA_ID, TUR, SON_GECERLILIK, OLUSTURAN_ADMIN_ID)
        OUTPUT INSERTED.SON_GECERLILIK
        VALUES (@hash, @firmaId, @tur, DATEADD(MINUTE, @dakika, GETDATE()), @adminId)`);
        return res.recordset[0].SON_GECERLILIK;
    }
    /** Geçerli (süresi dolmamış, iptal edilmemiş) bağlantı; kullanım sayısını artırır. */
    static async baglantiKullan(tokenHash) {
        const pool = await getAdminPool();
        const res = await pool.request().input("hash", sql.Char(64), tokenHash).query(`
      UPDATE dbo.ADM_INDIRME_BAGLANTISI SET KULLANIM_SAYISI = KULLANIM_SAYISI + 1, SON_KULLANIM = GETDATE()
      OUTPUT INSERTED.FIRMA_ID, INSERTED.TUR
      WHERE TOKEN_HASH = @hash AND IPTAL = 0 AND SON_GECERLILIK > GETDATE()`);
        const r = res.recordset[0];
        return r ? { firmaId: r.FIRMA_ID, tur: r.TUR } : null;
    }
}
