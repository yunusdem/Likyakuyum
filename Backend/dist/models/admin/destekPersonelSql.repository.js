import sql from "mssql";
import crypto from "crypto";
import { getAdminPool } from "../../config/adminDb.config.js";
import { KILIT_DAKIKA, KILIT_ESIGI, } from "../../types/destekPanel.types.js";
/**
 * Destek paneli tabloları (Backend/migrations-admin/002_destek_paneli.sql): personel, oturum, hızlı cevap,
 * ayrıca panelin salt okunur müşteri sorguları ve rapor. Talep / mesaj işlemleri DestekSqlRepository'de.
 */
const KURULU_ONBELLEK_MS = 60_000;
let kuruluOnbellek = null;
const PERSONEL_SECIM = `
  SELECT p.PERSONEL_ID, p.KULLANICI_ADI, ISNULL(a.AD_SOYAD, p.AD_SOYAD) AS AD_SOYAD, p.SIFRE_HASH,
         CASE WHEN p.ADMIN_ID IS NULL THEN p.SIFRE_DEGISMELI ELSE a.SIFRE_DEGISMELI END AS SIFRE_DEGISMELI,
         p.ROL, p.GORME,
         CASE WHEN p.ADMIN_ID IS NOT NULL AND (a.ADMIN_ID IS NULL OR a.DURUM <> 'AKTIF') THEN 'PASIF' ELSE p.DURUM END AS DURUM,
         p.ADMIN_ID, p.HATALI_DENEME, p.KILIT_BITIS, p.SON_GIRIS, p.OLUSTURMA_TARIHI
  FROM dbo.ADM_DESTEK_PERSONEL p
  LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = p.ADMIN_ID
`;
const satirdanPersonel = (r) => ({
    personelId: r.PERSONEL_ID,
    kullaniciAdi: r.KULLANICI_ADI,
    adSoyad: r.AD_SOYAD,
    sifreHash: r.SIFRE_HASH ?? null,
    sifreDegismeli: !!r.SIFRE_DEGISMELI,
    rol: r.ROL,
    gorme: r.GORME,
    durum: r.DURUM,
    adminId: r.ADMIN_ID ?? null,
    hataliDeneme: Number(r.HATALI_DENEME ?? 0),
    kilitBitis: r.KILIT_BITIS ?? null,
    sonGiris: r.SON_GIRIS ?? null,
    olusturmaTarihi: r.OLUSTURMA_TARIHI,
});
export class DestekPersonelSqlRepository {
    /** Göç 002 uygulanmış mı (personel tablosu ve ADM_KONU ek kolonları). */
    static async kuruluMu() {
        if (kuruluOnbellek && Date.now() - kuruluOnbellek.zaman < KURULU_ONBELLEK_MS)
            return kuruluOnbellek.deger;
        let deger = false;
        try {
            const pool = await getAdminPool();
            const r = await pool
                .request()
                .query(`SELECT CASE WHEN OBJECT_ID('dbo.ADM_DESTEK_PERSONEL') IS NOT NULL AND COL_LENGTH('dbo.ADM_KONU', 'ATANAN_PERSONEL_ID') IS NOT NULL THEN 1 ELSE 0 END AS VAR_MI`);
            deger = r.recordset[0]?.VAR_MI === 1;
        }
        catch {
            deger = false;
        }
        kuruluOnbellek = { deger, zaman: Date.now() };
        return deger;
    }
    /** Testler için önbelleği boşaltır. */
    static onbellekSifirla() {
        kuruluOnbellek = null;
    }
    // ------------------------------------------------------------------ Personel ---
    static async kullaniciAdiIleBul(kullaniciAdi) {
        const pool = await getAdminPool();
        const r = await pool.request().input("ad", sql.NVarChar(50), kullaniciAdi).query(`${PERSONEL_SECIM} WHERE p.KULLANICI_ADI = @ad`);
        return r.recordset[0] ? satirdanPersonel(r.recordset[0]) : null;
    }
    static async idIleBul(personelId) {
        const pool = await getAdminPool();
        const r = await pool.request().input("id", sql.Int, personelId).query(`${PERSONEL_SECIM} WHERE p.PERSONEL_ID = @id`);
        return r.recordset[0] ? satirdanPersonel(r.recordset[0]) : null;
    }
    static async adminIdIleBul(adminId) {
        const pool = await getAdminPool();
        const r = await pool.request().input("id", sql.Int, adminId).query(`${PERSONEL_SECIM} WHERE p.ADMIN_ID = @id`);
        return r.recordset[0] ? satirdanPersonel(r.recordset[0]) : null;
    }
    static async liste() {
        const pool = await getAdminPool();
        const r = await pool.request().query(`${PERSONEL_SECIM} ORDER BY CASE WHEN p.ROL = 'ADMIN' THEN 0 ELSE 1 END, ISNULL(a.AD_SOYAD, p.AD_SOYAD)`);
        return r.recordset.map(satirdanPersonel);
    }
    /**
     * Admin paneli adminlerini personel tablosuna bağlar (D4): eksik olana ROL=ADMIN satırı açılır.
     * Kullanıcı adı başka bir personelde varsa o admin atlanır (çakışma panelde personel listesinde görünür).
     */
    static async adminleriEsitle() {
        const pool = await getAdminPool();
        await pool.request().query(`
      INSERT INTO dbo.ADM_DESTEK_PERSONEL (KULLANICI_ADI, AD_SOYAD, SIFRE_HASH, SIFRE_DEGISMELI, ROL, GORME, DURUM, ADMIN_ID)
      SELECT a.KULLANICI_ADI, a.AD_SOYAD, NULL, 0, 'ADMIN', 'TUMU', 'AKTIF', a.ADMIN_ID
      FROM dbo.ADM_ADMIN a
      WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_DESTEK_PERSONEL p WHERE p.ADMIN_ID = a.ADMIN_ID)
        AND NOT EXISTS (SELECT 1 FROM dbo.ADM_DESTEK_PERSONEL p WHERE p.KULLANICI_ADI = a.KULLANICI_ADI);`);
    }
    static async ekle(p) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("ad", sql.NVarChar(50), p.kullaniciAdi)
            .input("adSoyad", sql.NVarChar(100), p.adSoyad)
            .input("hash", sql.VarChar(100), p.sifreHash)
            .input("rol", sql.VarChar(10), p.rol)
            .input("gorme", sql.VarChar(10), p.gorme)
            .input("olusturan", sql.Int, p.olusturanPersonelId).query(`
        INSERT INTO dbo.ADM_DESTEK_PERSONEL (KULLANICI_ADI, AD_SOYAD, SIFRE_HASH, SIFRE_DEGISMELI, ROL, GORME, OLUSTURAN_PERSONEL_ID)
        OUTPUT INSERTED.PERSONEL_ID VALUES (@ad, @adSoyad, @hash, 1, @rol, @gorme, @olusturan)`);
        return r.recordset[0].PERSONEL_ID;
    }
    static async guncelle(personelId, g) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, personelId)
            .input("adSoyad", sql.NVarChar(100), g.adSoyad ?? null)
            .input("rol", sql.VarChar(10), g.rol ?? null)
            .input("gorme", sql.VarChar(10), g.gorme ?? null)
            .input("durum", sql.VarChar(10), g.durum ?? null).query(`
        UPDATE dbo.ADM_DESTEK_PERSONEL
        SET AD_SOYAD = ISNULL(@adSoyad, AD_SOYAD), ROL = ISNULL(@rol, ROL), GORME = ISNULL(@gorme, GORME), DURUM = ISNULL(@durum, DURUM)
        WHERE PERSONEL_ID = @id`);
    }
    static async sifreYaz(personelId, hash, degismeli) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, personelId)
            .input("hash", sql.VarChar(100), hash)
            .input("d", sql.Bit, degismeli)
            .query(`UPDATE dbo.ADM_DESTEK_PERSONEL SET SIFRE_HASH = @hash, SIFRE_DEGISMELI = @d, HATALI_DENEME = 0, KILIT_BITIS = NULL WHERE PERSONEL_ID = @id`);
    }
    /** Hatalı şifre: sayaç artar, eşikte hesap KILIT_DAKIKA kilitlenir. */
    static async hataliDenemeYaz(personelId) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, personelId)
            .input("esik", sql.Int, KILIT_ESIGI)
            .input("dk", sql.Int, KILIT_DAKIKA).query(`
        UPDATE dbo.ADM_DESTEK_PERSONEL
        SET HATALI_DENEME = HATALI_DENEME + 1,
            KILIT_BITIS = CASE WHEN HATALI_DENEME + 1 >= @esik THEN DATEADD(MINUTE, @dk, GETDATE()) ELSE KILIT_BITIS END
        WHERE PERSONEL_ID = @id;
        UPDATE dbo.ADM_DESTEK_PERSONEL SET HATALI_DENEME = 0 WHERE PERSONEL_ID = @id AND HATALI_DENEME >= @esik;`);
    }
    static async kilitAc(personelId) {
        const pool = await getAdminPool();
        await pool.request().input("id", sql.Int, personelId).query(`UPDATE dbo.ADM_DESTEK_PERSONEL SET HATALI_DENEME = 0, KILIT_BITIS = NULL WHERE PERSONEL_ID = @id`);
    }
    static async basariliGirisYaz(personelId) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, personelId)
            .query(`UPDATE dbo.ADM_DESTEK_PERSONEL SET SON_GIRIS = GETDATE(), HATALI_DENEME = 0, KILIT_BITIS = NULL WHERE PERSONEL_ID = @id`);
    }
    // ------------------------------------------------------------------- Oturum ---
    /** Personelin açık oturumlarını kapatıp yenisini açar (kişi başına tek oturum). */
    static async oturumAc(personelId, ip, tarayici) {
        const pool = await getAdminPool();
        const sid = crypto.randomUUID();
        await pool
            .request()
            .input("sid", sql.UniqueIdentifier, sid)
            .input("id", sql.Int, personelId)
            .input("ip", sql.VarChar(64), ip)
            .input("tarayici", sql.NVarChar(400), tarayici.slice(0, 400)).query(`
        SET XACT_ABORT ON;
        BEGIN TRAN;
        UPDATE dbo.ADM_DESTEK_OTURUM SET BITIS = GETDATE() WHERE PERSONEL_ID = @id AND BITIS IS NULL;
        INSERT INTO dbo.ADM_DESTEK_OTURUM (OTURUM_ID, PERSONEL_ID, IP, TARAYICI) VALUES (@sid, @id, @ip, @tarayici);
        COMMIT;`);
        return sid;
    }
    /** Geçerli oturum + güncel personel bilgisi (pasif / admin hesabı pasif ise null). */
    static async gecerliOturum(sid, personelId) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("sid", sql.UniqueIdentifier, sid)
            .input("id", sql.Int, personelId).query(`
        UPDATE dbo.ADM_DESTEK_OTURUM SET SON_ISLEM = GETDATE()
        WHERE OTURUM_ID = @sid AND BITIS IS NULL AND SON_ISLEM < DATEADD(SECOND, -60, GETDATE());
        ${PERSONEL_SECIM}
        INNER JOIN dbo.ADM_DESTEK_OTURUM o ON o.PERSONEL_ID = p.PERSONEL_ID
        WHERE o.OTURUM_ID = @sid AND p.PERSONEL_ID = @id AND o.BITIS IS NULL AND o.IPTAL_EDILDI = 0;`);
        const x = r.recordset[0];
        if (!x)
            return null;
        const p = satirdanPersonel(x);
        if (p.durum !== "AKTIF")
            return null;
        return {
            personelId: p.personelId,
            kullaniciAdi: p.kullaniciAdi,
            adSoyad: p.adSoyad,
            rol: p.rol,
            gorme: p.rol === "ADMIN" ? "TUMU" : p.gorme,
            adminId: p.adminId,
            sifreDegismeli: p.sifreDegismeli,
            sid,
        };
    }
    static async oturumKapat(sid) {
        const pool = await getAdminPool();
        await pool.request().input("sid", sql.UniqueIdentifier, sid).query(`UPDATE dbo.ADM_DESTEK_OTURUM SET BITIS = GETDATE() WHERE OTURUM_ID = @sid AND BITIS IS NULL`);
    }
    /** Pasife alma / şifre sıfırlama: kişinin açık oturumları düşer (haricSid korunur). */
    static async oturumlariIptalEt(personelId, haricSid) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, personelId)
            .input("haric", sql.UniqueIdentifier, haricSid ?? null)
            .query(`UPDATE dbo.ADM_DESTEK_OTURUM SET BITIS = GETDATE(), IPTAL_EDILDI = 1 WHERE PERSONEL_ID = @id AND BITIS IS NULL AND (@haric IS NULL OR OTURUM_ID <> @haric)`);
    }
    /** Son 2 dakikada işlem yapmış personel (çevrimiçi göstergesi). */
    static async cevrimiciler() {
        const pool = await getAdminPool();
        const r = await pool.request().query(`SELECT DISTINCT PERSONEL_ID FROM dbo.ADM_DESTEK_OTURUM WHERE BITIS IS NULL AND IPTAL_EDILDI = 0 AND SON_ISLEM > DATEADD(MINUTE, -3, GETDATE())`);
        return r.recordset.map((x) => x.PERSONEL_ID);
    }
    // -------------------------------------------------------------- Hızlı cevap ---
    static async hizliCevaplar(yalnizAktif) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("a", sql.Bit, yalnizAktif)
            .query(`SELECT CEVAP_ID, BASLIK, METIN, SIRA, AKTIF FROM dbo.ADM_DESTEK_HIZLI_CEVAP WHERE (@a = 0 OR AKTIF = 1) ORDER BY SIRA, BASLIK`);
        return r.recordset.map((x) => ({ cevapId: x.CEVAP_ID, baslik: x.BASLIK, metin: x.METIN, sira: x.SIRA, aktif: !!x.AKTIF }));
    }
    static async hizliCevapYaz(c) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("id", sql.Int, c.cevapId ?? null)
            .input("baslik", sql.NVarChar(100), c.baslik.slice(0, 100))
            .input("metin", sql.NVarChar(4000), c.metin.slice(0, 4000))
            .input("sira", sql.Int, c.sira)
            .input("aktif", sql.Bit, c.aktif).query(`
        IF @id IS NULL
          INSERT INTO dbo.ADM_DESTEK_HIZLI_CEVAP (BASLIK, METIN, SIRA, AKTIF) OUTPUT INSERTED.CEVAP_ID AS ID VALUES (@baslik, @metin, @sira, @aktif);
        ELSE
        BEGIN
          UPDATE dbo.ADM_DESTEK_HIZLI_CEVAP SET BASLIK = @baslik, METIN = @metin, SIRA = @sira, AKTIF = @aktif WHERE CEVAP_ID = @id;
          SELECT CASE WHEN @@ROWCOUNT = 0 THEN NULL ELSE @id END AS ID;
        END`);
        return r.recordset[0]?.ID ?? 0;
    }
    // ---------------------------------------------------------------- Müşteriler ---
    static async musteriler(arama) {
        const pool = await getAdminPool();
        const req = pool.request().input("arama", sql.NVarChar(120), arama ? `%${arama.trim().slice(0, 100)}%` : null);
        const r = await req.query(`
      SELECT f.FIRMA_ID, f.FIRMA_KODU, f.MUSTERI_NO, f.UNVAN, f.YETKILI_KISI, f.TELEFON, f.EPOSTA, f.DURUM, f.BAGLANTI_MODU,
             l.PAKET_ADI, l.BITIS AS LISANS_BITIS,
             (SELECT COUNT(*) FROM dbo.ADM_KULLANICI k WHERE k.FIRMA_ID = f.FIRMA_ID AND k.DURUM = 'AKTIF') AS KULLANICI_SAYISI,
             (SELECT COUNT(*) FROM dbo.ADM_KONU t WHERE t.FIRMA_ID = f.FIRMA_ID AND t.TUR = 'TALEP' AND t.DURUM <> 'KAPALI') AS ACIK_TALEP,
             (SELECT MAX(t.SON_MESAJ_TARIHI) FROM dbo.ADM_KONU t WHERE t.FIRMA_ID = f.FIRMA_ID AND t.TUR = 'TALEP') AS SON_TALEP
      FROM dbo.ADM_FIRMA f
      LEFT JOIN dbo.ADM_LISANS l ON l.FIRMA_ID = f.FIRMA_ID AND l.AKTIF = 1
      WHERE (@arama IS NULL OR f.UNVAN LIKE @arama OR f.FIRMA_KODU LIKE @arama OR f.MUSTERI_NO LIKE @arama OR f.TELEFON LIKE @arama OR f.YETKILI_KISI LIKE @arama)
      ORDER BY f.UNVAN`);
        return r.recordset.map(firmaSatiri);
    }
    static async musteri(firmaId) {
        const pool = await getAdminPool();
        const r = await pool.request().input("id", sql.Int, firmaId).query(`
      SELECT f.FIRMA_ID, f.FIRMA_KODU, f.MUSTERI_NO, f.UNVAN, f.YETKILI_KISI, f.TELEFON, f.EPOSTA, f.ADRES, f.DURUM, f.DURUM_NOTU, f.BAGLANTI_MODU,
             l.PAKET_ADI, l.BITIS AS LISANS_BITIS, l.KULLANICI_LIMITI, f.SURUM, f.SON_GORULME,
             (SELECT COUNT(*) FROM dbo.ADM_KULLANICI k WHERE k.FIRMA_ID = f.FIRMA_ID AND k.DURUM = 'AKTIF') AS KULLANICI_SAYISI,
             (SELECT COUNT(*) FROM dbo.ADM_KONU t WHERE t.FIRMA_ID = f.FIRMA_ID AND t.TUR = 'TALEP' AND t.DURUM <> 'KAPALI') AS ACIK_TALEP,
             (SELECT MAX(t.SON_MESAJ_TARIHI) FROM dbo.ADM_KONU t WHERE t.FIRMA_ID = f.FIRMA_ID AND t.TUR = 'TALEP') AS SON_TALEP
      FROM dbo.ADM_FIRMA f
      LEFT JOIN dbo.ADM_LISANS l ON l.FIRMA_ID = f.FIRMA_ID AND l.AKTIF = 1
      WHERE f.FIRMA_ID = @id;
      SELECT KULLANICI_ID, KULLANICI_ADI, AD_SOYAD, DURUM, FIRMA_YONETICISI, SON_GIRIS
      FROM dbo.ADM_KULLANICI WHERE FIRMA_ID = @id ORDER BY DURUM, KULLANICI_ADI;`);
        const sets = r.recordsets;
        if (!sets[0][0])
            return null;
        const x = sets[0][0];
        return {
            firma: {
                ...firmaSatiri(x),
                adres: x.ADRES ?? null,
                durumNotu: x.DURUM_NOTU ?? null,
                kullaniciLimiti: x.KULLANICI_LIMITI ?? null,
                surum: x.SURUM ?? null,
                sonGorulme: x.SON_GORULME ?? null,
            },
            kullanicilar: sets[1].map((k) => ({
                kullaniciId: k.KULLANICI_ID,
                kullaniciAdi: k.KULLANICI_ADI,
                adSoyad: k.AD_SOYAD ?? null,
                durum: k.DURUM,
                yonetici: !!k.FIRMA_YONETICISI,
                sonGiris: k.SON_GIRIS ?? null,
            })),
        };
    }
    // -------------------------------------------------------------------- Rapor ---
    /** Kişi başı açık / kapanan / ilk cevap / mesaj sayıları (D17). bas dahil, bit hariç. */
    static async rapor(bas, bit) {
        const pool = await getAdminPool();
        const r = await pool.request().input("bas", sql.DateTime, bas).input("bit", sql.DateTime, bit).query(`
      SELECT p.PERSONEL_ID, ISNULL(a.AD_SOYAD, p.AD_SOYAD) AS AD_SOYAD, p.ROL,
             CASE WHEN p.ADMIN_ID IS NOT NULL AND (a.ADMIN_ID IS NULL OR a.DURUM <> 'AKTIF') THEN 'PASIF' ELSE p.DURUM END AS DURUM,
             (SELECT COUNT(*) FROM dbo.ADM_KONU k WHERE k.TUR = 'TALEP' AND k.DURUM <> 'KAPALI' AND k.ATANAN_PERSONEL_ID = p.PERSONEL_ID) AS ACIK,
             (SELECT COUNT(*) FROM dbo.ADM_KONU k WHERE k.TUR IN ('TALEP','SISTEM') AND k.KAPATAN_PERSONEL_ID = p.PERSONEL_ID
                AND k.KAPANIS_TARIHI >= @bas AND k.KAPANIS_TARIHI < @bit) AS KAPANAN,
             (SELECT COUNT(*) FROM dbo.ADM_KONU k WHERE k.TUR = 'TALEP' AND k.ILK_CEVAP_PERSONEL_ID = p.PERSONEL_ID
                AND k.ILK_CEVAP_TARIHI >= @bas AND k.ILK_CEVAP_TARIHI < @bit) AS ILK_CEVAP,
             (SELECT AVG(CAST(DATEDIFF(MINUTE, k.OLUSTURMA_TARIHI, k.ILK_CEVAP_TARIHI) AS FLOAT)) FROM dbo.ADM_KONU k
                WHERE k.TUR = 'TALEP' AND k.ILK_CEVAP_PERSONEL_ID = p.PERSONEL_ID AND k.ILK_CEVAP_TARIHI >= @bas AND k.ILK_CEVAP_TARIHI < @bit) AS ORT_DK,
             (SELECT COUNT(*) FROM dbo.ADM_KONU_MESAJ m WHERE m.PERSONEL_ID = p.PERSONEL_ID AND m.GONDEREN_TUR = 'ADMIN' AND m.IC_NOT = 0
                AND m.TARIH >= @bas AND m.TARIH < @bit) AS MESAJ
      FROM dbo.ADM_DESTEK_PERSONEL p
      LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = p.ADMIN_ID
      ORDER BY ISNULL(a.AD_SOYAD, p.AD_SOYAD);`);
        return r.recordset.map((x) => ({
            personelId: x.PERSONEL_ID,
            adSoyad: x.AD_SOYAD,
            rol: x.ROL,
            durum: x.DURUM,
            acik: Number(x.ACIK ?? 0),
            kapanan: Number(x.KAPANAN ?? 0),
            ilkCevap: Number(x.ILK_CEVAP ?? 0),
            ortIlkCevapDk: x.ORT_DK === null || x.ORT_DK === undefined ? null : Math.round(Number(x.ORT_DK)),
            mesaj: Number(x.MESAJ ?? 0),
        }));
    }
    /** Atanmamış (havuzdaki) talep sayısı ile genel toplamlar (rapor üst kartları). */
    static async genelSayilar(bas, bit) {
        const pool = await getAdminPool();
        const r = await pool.request().input("bas", sql.DateTime, bas).input("bit", sql.DateTime, bit).query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.ADM_KONU WHERE TUR = 'TALEP' AND DURUM <> 'KAPALI' AND ATANAN_PERSONEL_ID IS NULL) AS HAVUZ,
        (SELECT COUNT(*) FROM dbo.ADM_KONU WHERE TUR = 'TALEP' AND DURUM <> 'KAPALI') AS ACIK,
        (SELECT COUNT(*) FROM dbo.ADM_KONU WHERE TUR = 'TALEP' AND OLUSTURMA_TARIHI >= @bas AND OLUSTURMA_TARIHI < @bit) AS YENI,
        (SELECT COUNT(*) FROM dbo.ADM_KONU WHERE TUR = 'TALEP' AND KAPANIS_TARIHI >= @bas AND KAPANIS_TARIHI < @bit) AS KAPANAN,
        (SELECT AVG(CAST(DATEDIFF(MINUTE, OLUSTURMA_TARIHI, ILK_CEVAP_TARIHI) AS FLOAT)) FROM dbo.ADM_KONU
           WHERE TUR = 'TALEP' AND ILK_CEVAP_TARIHI >= @bas AND ILK_CEVAP_TARIHI < @bit) AS ORT_DK`);
        const x = r.recordset[0] ?? {};
        return {
            havuz: Number(x.HAVUZ ?? 0),
            acik: Number(x.ACIK ?? 0),
            yeni: Number(x.YENI ?? 0),
            kapanan: Number(x.KAPANAN ?? 0),
            ortIlkCevapDk: x.ORT_DK === null || x.ORT_DK === undefined ? null : Math.round(Number(x.ORT_DK)),
        };
    }
}
const firmaSatiri = (x) => ({
    firmaId: x.FIRMA_ID,
    firmaKodu: x.FIRMA_KODU,
    musteriNo: x.MUSTERI_NO ?? null,
    unvan: x.UNVAN,
    yetkili: x.YETKILI_KISI ?? null,
    telefon: x.TELEFON ?? null,
    eposta: x.EPOSTA ?? null,
    durum: x.DURUM,
    baglantiModu: x.BAGLANTI_MODU,
    paket: x.PAKET_ADI ?? null,
    lisansBitis: x.LISANS_BITIS ?? null,
    kullaniciSayisi: Number(x.KULLANICI_SAYISI ?? 0),
    acikTalep: Number(x.ACIK_TALEP ?? 0),
    sonTalep: x.SON_TALEP ?? null,
});
