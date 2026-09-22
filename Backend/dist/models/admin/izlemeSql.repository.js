import sql from "mssql";
import crypto from "crypto";
import { getAdminPool } from "../../config/adminDb.config.js";
const sayfala = (s) => ({ atla: (Math.max(1, s.sayfa) - 1) * s.boyut, al: s.boyut });
/** ADM_OTURUM'un kullanıcı (TUR='KULLANICI') tarafı ve yönetim panelinin izleme listeleri. */
export class IzlemeSqlRepository {
    static async kullaniciOturumuAc(kullaniciId, firmaId, ip, tarayici) {
        const pool = await getAdminPool();
        const sid = crypto.randomUUID();
        await pool
            .request()
            .input("sid", sql.UniqueIdentifier, sid)
            .input("kullaniciId", sql.Int, kullaniciId)
            .input("firmaId", sql.Int, firmaId)
            .input("ip", sql.VarChar(64), ip)
            .input("tarayici", sql.NVarChar(400), tarayici)
            .query(`INSERT INTO dbo.ADM_OTURUM (OTURUM_ID, TUR, KULLANICI_ID, FIRMA_ID, IP, TARAYICI) VALUES (@sid, 'KULLANICI', @kullaniciId, @firmaId, @ip, @tarayici)`);
        return sid;
    }
    /**
     * Oturum hâlâ geçerli mi: kapatılmamış/iptal edilmemiş, kullanıcı aktif, firma aktif, lisans bitmemiş.
     * SON_ISLEM en fazla dakikada bir güncellenir ("çevrimiçi" listesi bunu kullanır).
     */
    static async oturumDurumu(sid) {
        const pool = await getAdminPool();
        const res = await pool.request().input("sid", sql.UniqueIdentifier, sid).query(`
      UPDATE dbo.ADM_OTURUM SET SON_ISLEM = GETDATE()
      WHERE OTURUM_ID = @sid AND BITIS IS NULL AND SON_ISLEM < DATEADD(SECOND, -60, GETDATE());

      SELECT o.BITIS, o.IPTAL_EDILDI, k.DURUM AS KULLANICI_DURUM, k.SIFRE_DEGISMELI, f.DURUM AS FIRMA_DURUM,
             CASE WHEN l.LISANS_ID IS NOT NULL AND l.BITIS < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS LISANS_BITTI
      FROM dbo.ADM_OTURUM o
      INNER JOIN dbo.ADM_KULLANICI k ON k.KULLANICI_ID = o.KULLANICI_ID
      INNER JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = o.FIRMA_ID
      LEFT JOIN dbo.ADM_LISANS l ON l.FIRMA_ID = f.FIRMA_ID AND l.AKTIF = 1
      WHERE o.OTURUM_ID = @sid AND o.TUR = 'KULLANICI';
    `);
        const r = res.recordset[0];
        const sonuc = (neden) => ({
            gecerli: neden === null,
            neden,
            sifreDegismeli: !!r?.SIFRE_DEGISMELI,
        });
        if (!r || r.BITIS !== null || r.IPTAL_EDILDI)
            return sonuc("OTURUM_KAPALI");
        if (r.FIRMA_DURUM === "PASIF")
            return sonuc("FIRMA_PASIF");
        if (r.FIRMA_DURUM === "DONDURULMUS")
            return sonuc("FIRMA_DONDURULDU");
        if (r.LISANS_BITTI)
            return sonuc("LISANS_BITTI");
        if (r.KULLANICI_DURUM !== "AKTIF")
            return sonuc("KULLANICI_PASIF");
        return sonuc(null);
    }
    /** Kullanıcının kendi çıkışı */
    static async oturumuBitir(sid) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("sid", sql.UniqueIdentifier, sid)
            .query(`UPDATE dbo.ADM_OTURUM SET BITIS = GETDATE() WHERE OTURUM_ID = @sid AND BITIS IS NULL`);
    }
    /** Açık oturumları iptal eder. Ölçütlerden biri verilir: tek oturum, bir kullanıcının ya da bir firmanın tümü. */
    static async oturumlariIptalEt(olcut, adminId) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("sid", sql.UniqueIdentifier, olcut.sid ?? null)
            .input("kullaniciId", sql.Int, olcut.kullaniciId ?? null)
            .input("firmaId", sql.Int, olcut.firmaId ?? null)
            .input("adminId", sql.Int, adminId).query(`
        UPDATE dbo.ADM_OTURUM
        SET BITIS = GETDATE(), IPTAL_EDILDI = 1, IPTAL_EDEN_ADMIN_ID = @adminId
        WHERE TUR = 'KULLANICI' AND BITIS IS NULL
          AND (@sid IS NOT NULL OR @kullaniciId IS NOT NULL OR @firmaId IS NOT NULL)
          AND (@sid IS NULL OR OTURUM_ID = @sid)
          AND (@kullaniciId IS NULL OR KULLANICI_ID = @kullaniciId)
          AND (@firmaId IS NULL OR FIRMA_ID = @firmaId);
      `);
        return res.rowsAffected?.[0] || 0;
    }
    /** Son `dakika` içinde işlem yapmış açık oturumlar (adminler dahil). */
    static async cevrimici(dakika) {
        const pool = await getAdminPool();
        const res = await pool.request().input("dakika", sql.Int, dakika).query(`
      SELECT CAST(o.OTURUM_ID AS VARCHAR(36)) AS sid, o.TUR AS tur, o.IP AS ip, o.TARAYICI AS tarayici,
             o.BASLANGIC AS baslangic, o.SON_ISLEM AS sonIslem,
             o.FIRMA_ID AS firmaId, f.FIRMA_KODU AS firmaKodu, f.UNVAN AS firmaUnvan,
             -- ADM_ADMIN.KULLANICI_ADI özel sıralamalıdır (Latin1_General_CI_AS); birleştirirken çakışmasın
             COALESCE(k.KULLANICI_ADI, a.KULLANICI_ADI COLLATE DATABASE_DEFAULT) AS kullaniciAdi,
             COALESCE(k.AD_SOYAD, a.AD_SOYAD) AS adSoyad
      FROM dbo.ADM_OTURUM o
      LEFT JOIN dbo.ADM_KULLANICI k ON k.KULLANICI_ID = o.KULLANICI_ID
      LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = o.ADMIN_ID
      LEFT JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = o.FIRMA_ID
      WHERE o.BITIS IS NULL AND o.SON_ISLEM >= DATEADD(MINUTE, -@dakika, GETDATE())
      ORDER BY o.SON_ISLEM DESC
    `);
        return res.recordset;
    }
    static async girisLoglari(filtre) {
        const pool = await getAdminPool();
        const { atla, al } = sayfala(filtre);
        const res = await pool
            .request()
            .input("firmaId", sql.Int, filtre.firmaId ?? null)
            .input("tur", sql.VarChar(10), filtre.tur ?? null)
            .input("basarili", sql.Bit, filtre.basarili ?? null)
            .input("arama", sql.NVarChar(100), filtre.arama ? `%${filtre.arama}%` : null)
            .input("atla", sql.Int, atla)
            .input("al", sql.Int, al).query(`
        SELECT COUNT(*) AS TOPLAM FROM dbo.ADM_GIRIS_LOG g
        WHERE (@firmaId IS NULL OR g.FIRMA_ID = @firmaId) AND (@tur IS NULL OR g.TUR = @tur)
          AND (@basarili IS NULL OR g.BASARILI = @basarili)
          AND (@arama IS NULL OR g.KULLANICI_ADI LIKE @arama OR g.IP LIKE @arama);

        SELECT g.LOG_ID AS logId, g.TARIH AS tarih, g.TUR AS tur, g.FIRMA_ID AS firmaId, f.FIRMA_KODU AS firmaKodu,
               f.UNVAN AS firmaUnvan, g.KULLANICI_ADI AS kullaniciAdi, g.BASARILI AS basarili, g.RED_NEDENI AS redNedeni,
               g.IP AS ip, g.TARAYICI AS tarayici
        FROM dbo.ADM_GIRIS_LOG g
        LEFT JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = g.FIRMA_ID
        WHERE (@firmaId IS NULL OR g.FIRMA_ID = @firmaId) AND (@tur IS NULL OR g.TUR = @tur)
          AND (@basarili IS NULL OR g.BASARILI = @basarili)
          AND (@arama IS NULL OR g.KULLANICI_ADI LIKE @arama OR g.IP LIKE @arama)
        ORDER BY g.LOG_ID DESC
        OFFSET @atla ROWS FETCH NEXT @al ROWS ONLY;
      `);
        const kumeler = res.recordsets;
        return { toplam: kumeler[0][0].TOPLAM, satirlar: kumeler[1] };
    }
    static async islemLoglari(filtre) {
        const pool = await getAdminPool();
        const { atla, al } = sayfala(filtre);
        const res = await pool
            .request()
            .input("arama", sql.NVarChar(100), filtre.arama ? `%${filtre.arama}%` : null)
            .input("atla", sql.Int, atla)
            .input("al", sql.Int, al).query(`
        SELECT COUNT(*) AS TOPLAM FROM dbo.ADM_ISLEM_LOG i LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = i.ADMIN_ID
        WHERE (@arama IS NULL OR i.ISLEM LIKE @arama OR a.KULLANICI_ADI LIKE @arama OR i.YENI_DEGER LIKE @arama);

        SELECT i.LOG_ID AS logId, i.TARIH AS tarih, a.KULLANICI_ADI AS admin, i.ISLEM AS islem, i.HEDEF_TUR AS hedefTur,
               i.HEDEF_ID AS hedefId, i.ESKI_DEGER AS eskiDeger, i.YENI_DEGER AS yeniDeger
        FROM dbo.ADM_ISLEM_LOG i
        LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = i.ADMIN_ID
        WHERE (@arama IS NULL OR i.ISLEM LIKE @arama OR a.KULLANICI_ADI LIKE @arama OR i.YENI_DEGER LIKE @arama)
        ORDER BY i.LOG_ID DESC
        OFFSET @atla ROWS FETCH NEXT @al ROWS ONLY;
      `);
        const kumeler = res.recordsets;
        return { toplam: kumeler[0][0].TOPLAM, satirlar: kumeler[1] };
    }
}
