import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { ApiError } from "../../utils/ApiError.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
let semaVar = false;
let semaDenetim = 0;
export class MobilSqlRepository {
    /** Mobil tabloları kurulu mu (var olduğu bir kez görülünce yeniden sorulmaz; yoksa dakikada bir sorulur) */
    static async semaVarMi() {
        if (semaVar)
            return true;
        if (Date.now() - semaDenetim < 60_000)
            return false;
        semaDenetim = Date.now();
        const pool = await getAdminPool();
        const r = await pool.request().query(`
      SELECT CAST(CASE WHEN OBJECT_ID('dbo.ADM_MOBIL_FIRMA') IS NOT NULL AND OBJECT_ID('dbo.ADM_MOBIL_KULLANICI') IS NOT NULL
                        AND OBJECT_ID('dbo.ADM_MOBIL_ERISIM') IS NOT NULL AND OBJECT_ID('dbo.ADM_MOBIL_OTURUM') IS NOT NULL
                       THEN 1 ELSE 0 END AS BIT) AS V`);
        semaVar = !!r.recordset[0].V;
        return semaVar;
    }
    /** Testler için: şema denetimini sıfırlar */
    static semaOnbellekSifirla() {
        semaVar = false;
        semaDenetim = 0;
    }
    static async semaGerekli() {
        if (!(await this.semaVarMi()))
            throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Mobil erişim tabloları kurulmamış (docs/sql/LIKYA_ADMIN_MOBIL.sql).", {
                kod: "MOBIL_SEMA_YOK",
            });
    }
    static async firmaAyari(firmaId) {
        await this.semaGerekli();
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("firmaId", sql.Int, firmaId)
            .query(`SELECT KULLANICI_LIMITI, KISA_AD FROM dbo.ADM_MOBIL_FIRMA WHERE FIRMA_ID = @firmaId`);
        const x = r.recordset[0];
        return { firmaId, kullaniciLimiti: Number(x?.KULLANICI_LIMITI ?? 0), kisaAd: x?.KISA_AD ?? null };
    }
    static async firmaAyariYaz(firmaId, veri, adminId) {
        await this.semaGerekli();
        const pool = await getAdminPool();
        await pool
            .request()
            .input("firmaId", sql.Int, firmaId)
            .input("limit", sql.Int, veri.kullaniciLimiti)
            .input("kisaAd", sql.NVarChar(40), veri.kisaAd)
            .input("adminId", sql.Int, adminId).query(`
        MERGE dbo.ADM_MOBIL_FIRMA WITH (HOLDLOCK) AS h
        USING (SELECT @firmaId AS FIRMA_ID) AS k ON h.FIRMA_ID = k.FIRMA_ID
        WHEN MATCHED THEN UPDATE SET KULLANICI_LIMITI = @limit, KISA_AD = @kisaAd, GUNCELLEYEN_ADMIN_ID = @adminId, GUNCELLEME_TARIHI = GETDATE()
        WHEN NOT MATCHED THEN INSERT (FIRMA_ID, KULLANICI_LIMITI, KISA_AD, GUNCELLEYEN_ADMIN_ID) VALUES (@firmaId, @limit, @kisaAd, @adminId);`);
    }
    /** Firmada sınırdan düşen (aktif erişimi olan) mobil kullanıcı sayısı (K26) */
    /**
     * Firmanın mobil kullanıcıları (erişim satırı başına): sınıra sayılan = erişim ve kullanıcı ikisi de AKTIF. Kilit ve son
     * giriş merkez kaydından; SQL saatiyle (KILITLI) karşılaştırılır.
     */
    static async firmaKullanicilari(firmaId) {
        await this.semaGerekli();
        const pool = await getAdminPool();
        const r = await pool.request().input("firmaId", sql.Int, firmaId).query(`
      SELECT e.ERISIM_ID, k.MOBIL_KULLANICI_ID, k.MUSTERI_NO, k.KULLANICI_ADI, k.AD_SOYAD, e.CARI_KART_ID, e.CARI_KOD, e.CARI_AD,
             e.YETKI_FIYAT, e.YETKI_BAKIYE, e.YETKI_DOKUM, e.YETKI_ALIS, e.YETKI_SATIS, e.DURUM AS ERISIM_DURUM, k.DURUM AS KULLANICI_DURUM,
             k.SON_GIRIS, k.SIFRE_DEGISMELI, e.OLUSTURMA_TARIHI,
             CAST(CASE WHEN k.KILIT_BITIS > GETDATE() THEN 1 ELSE 0 END AS bit) AS KILITLI
      FROM dbo.ADM_MOBIL_ERISIM e JOIN dbo.ADM_MOBIL_KULLANICI k ON k.MOBIL_KULLANICI_ID = e.MOBIL_KULLANICI_ID
      WHERE e.FIRMA_ID = @firmaId
      ORDER BY CASE WHEN e.DURUM = 'AKTIF' AND k.DURUM = 'AKTIF' THEN 0 ELSE 1 END, k.KULLANICI_ADI`);
        return r.recordset.map((x) => ({
            erisimId: x.ERISIM_ID,
            mobilKullaniciId: x.MOBIL_KULLANICI_ID,
            musteriNo: x.MUSTERI_NO,
            kullaniciAdi: x.KULLANICI_ADI,
            adSoyad: x.AD_SOYAD ?? null,
            cariKartId: x.CARI_KART_ID,
            cariKod: x.CARI_KOD ?? null,
            cariAd: x.CARI_AD ?? null,
            yetkiler: { fiyat: !!x.YETKI_FIYAT, bakiye: !!x.YETKI_BAKIYE, dokum: !!x.YETKI_DOKUM, alis: !!x.YETKI_ALIS, satis: !!x.YETKI_SATIS },
            aktif: x.ERISIM_DURUM === "AKTIF" && x.KULLANICI_DURUM === "AKTIF",
            erisimDurumu: x.ERISIM_DURUM,
            kullaniciDurumu: x.KULLANICI_DURUM,
            kilitli: !!x.KILITLI,
            sifreDegismeli: !!x.SIFRE_DEGISMELI,
            sonGiris: x.SON_GIRIS ?? null,
            olusturma: x.OLUSTURMA_TARIHI ?? null,
        }));
    }
    /**
     * Mobil giriş geçmişi (ADM_GIRIS_LOG, TUR = MOBIL): başarılı girişte firma yazılır; reddedilen girişte firma belli
     * olmayabilir, kayıt adı "müşteri no/kullanıcı adı" olduğu için müşteri no önekiyle de eşlenir. Yeniden eskiye, en çok 200.
     */
    static async firmaGirisleri(firmaId, musteriNo, adet = 100) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("firmaId", sql.Int, firmaId)
            .input("onek", sql.NVarChar(40), musteriNo ? `${musteriNo}/%` : null)
            .input("adet", sql.Int, Math.min(Math.max(adet, 1), 200)).query(`
        SELECT TOP (@adet) g.LOG_ID, g.TARIH, g.KULLANICI_ADI, g.BASARILI, g.RED_NEDENI, g.IP, g.FIRMA_ID
        FROM dbo.ADM_GIRIS_LOG g
        WHERE g.TUR = 'MOBIL' AND (g.FIRMA_ID = @firmaId OR (g.FIRMA_ID IS NULL AND @onek IS NOT NULL AND g.KULLANICI_ADI LIKE @onek))
        ORDER BY g.LOG_ID DESC`);
        return r.recordset.map((x) => ({
            logId: x.LOG_ID,
            tarih: x.TARIH,
            kullaniciAdi: x.KULLANICI_ADI ?? "",
            basarili: !!x.BASARILI,
            redNedeni: x.RED_NEDENI ?? null,
            ip: x.IP ?? null,
            firmaBelli: x.FIRMA_ID !== null,
        }));
    }
    static async firmaErisimSayisi(firmaId) {
        await this.semaGerekli();
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("firmaId", sql.Int, firmaId)
            .query(`SELECT COUNT(*) AS N FROM dbo.ADM_MOBIL_ERISIM e
              JOIN dbo.ADM_MOBIL_KULLANICI k ON k.MOBIL_KULLANICI_ID = e.MOBIL_KULLANICI_ID
              WHERE e.FIRMA_ID = @firmaId AND e.DURUM = 'AKTIF' AND k.DURUM = 'AKTIF'`);
        return Number(r.recordset[0].N);
    }
}
