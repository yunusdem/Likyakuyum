import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
/**
 * LIKYA_ADMIN'deki destek tabloları (docs/DESTEK_VE_BILDIRIM_YOL_HARITASI.md, 3).
 * Tablolar kurulmamışsa (LIKYA_ADMIN_DESTEK.sql çalıştırılmamış) kuruluMu() false döner; çağıran buna göre davranır.
 */
const KURULU_ONBELLEK_MS = 60_000;
let kuruluOnbellek = null;
const KONU_SECIM = `
  SELECT k.KONU_ID, k.TUR, k.BASLIK, k.DURUM, k.TALEP_TURU, k.ONCELIK, k.EKRAN, k.BILDIRIM_TURU, k.ONEMLI, k.CEVAP_ALIR,
         k.HEDEF, k.SURUM, k.SISTEM_OLAY, k.KAYNAK_KONU_ID, k.FIRMA_ID, f.FIRMA_KODU, f.UNVAN AS FIRMA_UNVAN,
         k.KULLANICI_ID, ISNULL(k.KULLANICI_ADI, ku.AD_SOYAD) AS KULLANICI_ADI, k.ATANAN_ADMIN_ID, a.AD_SOYAD AS ATANAN_ADMIN,
         k.OLUSTURMA_TARIHI, k.SON_MESAJ_TARIHI, k.SON_MESAJ_TARAF, k.GONDERIM_TARIHI, k.KAPANIS_TARIHI,
         (SELECT TOP 1 LEFT(m.METIN, 160) FROM dbo.ADM_KONU_MESAJ m WHERE m.KONU_ID = k.KONU_ID AND m.IC_NOT = 0 ORDER BY m.MESAJ_ID DESC) AS SON_MESAJ,
         (SELECT COUNT(*) FROM dbo.ADM_KONU_MESAJ m WHERE m.KONU_ID = k.KONU_ID AND m.IC_NOT = 0) AS MESAJ_SAYISI,
         (SELECT MAX(m.MESAJ_ID) FROM dbo.ADM_KONU_MESAJ m WHERE m.KONU_ID = k.KONU_ID AND m.IC_NOT = 0 AND m.GONDEREN_TUR IN (@karsi1, @karsi2)) AS KARSI_SON,
         CASE WHEN k.HEDEF = 'TUMU' THEN NULL ELSE (SELECT COUNT(*) FROM dbo.ADM_KONU_HEDEF h WHERE h.KONU_ID = k.KONU_ID) END AS HEDEF_SAYISI,
         o.SON_OKUNAN_MESAJ_ID, o.ARSIV, o.ONEMLI_OKUNDU
  FROM dbo.ADM_KONU k
  LEFT JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = k.FIRMA_ID
  LEFT JOIN dbo.ADM_KULLANICI ku ON ku.KULLANICI_ID = k.KULLANICI_ID
  LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = k.ATANAN_ADMIN_ID
  LEFT JOIN dbo.ADM_KONU_OKUMA o ON o.KONU_ID = k.KONU_ID AND o.TARAF = @taraf AND o.KISI_ID = @kisiId
`;
/** Kullanıcının görebildiği konular (K15): kendi/yönetici talepleri, firmanın sistem kayıtları, hedefindeki bildirimler. */
const KULLANICI_GORUNURLUK = `
  (
    (k.TUR = 'TALEP' AND k.FIRMA_ID = @firmaId AND (@yonetici = 1 OR k.KULLANICI_ID = @kullaniciId OR (k.KULLANICI_ID IS NULL AND k.KULLANICI_ADI = @kullaniciAdi)))
    OR (k.TUR = 'SISTEM' AND k.FIRMA_ID = @firmaId)
    OR (k.TUR = 'BILDIRIM' AND k.DURUM = 'GONDERILDI' AND (
          k.HEDEF = 'TUMU'
          OR EXISTS (SELECT 1 FROM dbo.ADM_KONU_HEDEF h WHERE h.KONU_ID = k.KONU_ID AND h.FIRMA_ID = @firmaId
                     AND ((h.KULLANICI_ID IS NULL AND h.KULLANICI_ADI IS NULL) OR h.KULLANICI_ID = @kullaniciId OR h.KULLANICI_ADI = @kullaniciAdi))
        ))
  )
`;
const satirdanKonu = (r) => {
    const karsiSon = r.KARSI_SON ?? null;
    const okunan = r.SON_OKUNAN_MESAJ_ID ?? null;
    return {
        konuId: r.KONU_ID,
        tur: r.TUR,
        baslik: r.BASLIK,
        durum: r.DURUM,
        talepTuru: r.TALEP_TURU ?? null,
        oncelik: r.ONCELIK,
        ekran: r.EKRAN ?? null,
        bildirimTuru: r.BILDIRIM_TURU ?? null,
        onemli: !!r.ONEMLI,
        cevapAlir: !!r.CEVAP_ALIR,
        hedef: r.HEDEF ?? null,
        surum: r.SURUM ?? null,
        sistemOlay: r.SISTEM_OLAY ?? null,
        kaynakKonuId: r.KAYNAK_KONU_ID ?? null,
        firmaId: r.FIRMA_ID ?? null,
        firmaKodu: r.FIRMA_KODU ?? null,
        firmaUnvan: r.FIRMA_UNVAN ?? null,
        kullaniciId: r.KULLANICI_ID ?? null,
        kullaniciAdi: r.KULLANICI_ADI ?? null,
        atananAdminId: r.ATANAN_ADMIN_ID ?? null,
        atananAdmin: r.ATANAN_ADMIN ?? null,
        olusturmaTarihi: r.OLUSTURMA_TARIHI,
        sonMesajTarihi: r.SON_MESAJ_TARIHI,
        sonMesajTaraf: r.SON_MESAJ_TARAF,
        gonderimTarihi: r.GONDERIM_TARIHI ?? null,
        kapanisTarihi: r.KAPANIS_TARIHI ?? null,
        sonMesaj: r.SON_MESAJ ?? null,
        mesajSayisi: Number(r.MESAJ_SAYISI ?? 0),
        okunmamis: karsiSon !== null && (okunan === null || okunan < karsiSon),
        arsiv: !!r.ARSIV,
        onemliOkundu: !!r.ONEMLI_OKUNDU,
        karsiSonMesajId: karsiSon,
        hedefSayisi: r.HEDEF_SAYISI === null || r.HEDEF_SAYISI === undefined ? null : Number(r.HEDEF_SAYISI),
    };
};
/** Karşı taraf: kullanıcı için ADMIN+SISTEM, admin için KULLANICI+SISTEM. */
const karsiTaraf = (taraf) => (taraf === "KULLANICI" ? ["ADMIN", "SISTEM"] : ["KULLANICI", "SISTEM"]);
const kimlikGirdileri = (req, kimlik) => req
    .input("firmaId", sql.Int, kimlik.firmaId)
    .input("kullaniciId", sql.Int, kimlik.kullaniciId ?? -1)
    .input("kullaniciAdi", sql.NVarChar(100), kimlik.kullaniciAdi)
    .input("yonetici", sql.Bit, kimlik.yonetici);
const okumaGirdileri = (req, taraf, kisiId) => {
    const [k1, k2] = karsiTaraf(taraf);
    return req.input("taraf", sql.VarChar(10), taraf).input("kisiId", sql.Int, kisiId ?? -1).input("karsi1", sql.VarChar(10), k1).input("karsi2", sql.VarChar(10), k2);
};
export class DestekSqlRepository {
    static async kuruluMu() {
        if (kuruluOnbellek && Date.now() - kuruluOnbellek.zaman < KURULU_ONBELLEK_MS)
            return kuruluOnbellek.deger;
        let deger = false;
        try {
            const pool = await getAdminPool();
            const r = await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.ADM_KONU_OKUMA') IS NULL THEN 0 ELSE 1 END AS VAR_MI`);
            deger = r.recordset[0]?.VAR_MI === 1;
        }
        catch {
            deger = false;
        }
        kuruluOnbellek = { deger, zaman: Date.now() };
        return deger;
    }
    // ------------------------------------------------------------------ Yazma ---
    static async konuEkle(k) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("tur", sql.VarChar(10), k.tur)
            .input("firmaId", sql.Int, k.firmaId)
            .input("kullaniciId", sql.Int, k.kullaniciId)
            .input("kullaniciAdi", sql.NVarChar(100), k.kullaniciAdi)
            .input("baslik", sql.NVarChar(200), k.baslik.slice(0, 200))
            .input("talepTuru", sql.VarChar(10), k.talepTuru ?? null)
            .input("oncelik", sql.VarChar(10), k.oncelik ?? "NORMAL")
            .input("ekran", sql.NVarChar(200), k.ekran ? k.ekran.slice(0, 200) : null)
            .input("durum", sql.VarChar(20), k.durum)
            .input("bildirimTuru", sql.VarChar(10), k.bildirimTuru ?? null)
            .input("onemli", sql.Bit, !!k.onemli)
            .input("cevapAlir", sql.Bit, k.cevapAlir ?? true)
            .input("hedef", sql.VarChar(10), k.hedef ?? null)
            .input("surum", sql.VarChar(30), k.surum ?? null)
            .input("sistemOlay", sql.VarChar(40), k.sistemOlay ?? null)
            .input("olayAnahtari", sql.VarChar(100), k.olayAnahtari ?? null)
            .input("kaynak", sql.Int, k.kaynakKonuId ?? null)
            .input("olusturan", sql.Int, k.olusturanAdminId ?? null)
            .input("yerel", sql.VarChar(60), k.yerelAnahtar ?? null)
            .input("taraf", sql.VarChar(10), k.sonMesajTaraf)
            .input("gonderildi", sql.Bit, !!k.gonderildi).query(`
        INSERT INTO dbo.ADM_KONU (TUR, FIRMA_ID, KULLANICI_ID, KULLANICI_ADI, BASLIK, TALEP_TURU, ONCELIK, EKRAN, DURUM, BILDIRIM_TURU, ONEMLI,
                                  CEVAP_ALIR, HEDEF, SURUM, SISTEM_OLAY, OLAY_ANAHTARI, KAYNAK_KONU_ID, OLUSTURAN_ADMIN_ID, YEREL_ANAHTAR,
                                  SON_MESAJ_TARAF, GONDERIM_TARIHI)
        OUTPUT INSERTED.KONU_ID
        VALUES (@tur, @firmaId, @kullaniciId, @kullaniciAdi, @baslik, @talepTuru, @oncelik, @ekran, @durum, @bildirimTuru, @onemli,
                @cevapAlir, @hedef, @surum, @sistemOlay, @olayAnahtari, @kaynak, @olusturan, @yerel,
                @taraf, CASE WHEN @gonderildi = 1 THEN GETDATE() ELSE NULL END)`);
        return r.recordset[0].KONU_ID;
    }
    static async mesajEkle(m) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("konuId", sql.Int, m.konuId)
            .input("tur", sql.VarChar(10), m.gonderenTur)
            .input("adminId", sql.Int, m.adminId ?? null)
            .input("kullaniciId", sql.Int, m.kullaniciId ?? null)
            .input("ad", sql.NVarChar(100), m.gonderenAd ? m.gonderenAd.slice(0, 100) : null)
            .input("metin", sql.NVarChar(4000), m.metin.slice(0, 4000))
            .input("icNot", sql.Bit, !!m.icNot)
            .input("yerel", sql.VarChar(60), m.yerelAnahtar ?? null).query(`
        INSERT INTO dbo.ADM_KONU_MESAJ (KONU_ID, GONDEREN_TUR, ADMIN_ID, KULLANICI_ID, GONDEREN_AD, METIN, IC_NOT, YEREL_ANAHTAR)
        OUTPUT INSERTED.MESAJ_ID
        VALUES (@konuId, @tur, @adminId, @kullaniciId, @ad, @metin, @icNot, @yerel);
        -- İç not karşı tarafa görünmez; konunun "son mesaj" bilgisini değiştirmez
        UPDATE dbo.ADM_KONU SET SON_MESAJ_TARIHI = GETDATE(), SON_MESAJ_TARAF = @tur WHERE KONU_ID = @konuId AND @icNot = 0;`);
        return r.recordset[0].MESAJ_ID;
    }
    static async durumYaz(konuId, durum, adminId) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, konuId)
            .input("durum", sql.VarChar(20), durum)
            .input("adminId", sql.Int, adminId ?? null).query(`
        UPDATE dbo.ADM_KONU
        SET DURUM = @durum,
            KAPANIS_TARIHI = CASE WHEN @durum = 'KAPALI' THEN GETDATE() ELSE NULL END,
            KAPATAN_ADMIN_ID = CASE WHEN @durum = 'KAPALI' THEN @adminId ELSE NULL END,
            GONDERIM_TARIHI = CASE WHEN @durum = 'GONDERILDI' AND GONDERIM_TARIHI IS NULL THEN GETDATE() ELSE GONDERIM_TARIHI END
        WHERE KONU_ID = @id`);
    }
    static async atamaYaz(konuId, atananAdminId) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, konuId)
            .input("admin", sql.Int, atananAdminId)
            .query(`UPDATE dbo.ADM_KONU SET ATANAN_ADMIN_ID = @admin WHERE KONU_ID = @id`);
    }
    /** Taslak bildirimin başlığı, türü vb. (gövde ilk mesajda ayrıca güncellenir). */
    static async bildirimGuncelle(konuId, g) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, konuId)
            .input("baslik", sql.NVarChar(200), g.baslik.slice(0, 200))
            .input("tur", sql.VarChar(10), g.bildirimTuru)
            .input("onemli", sql.Bit, g.onemli)
            .input("cevapAlir", sql.Bit, g.cevapAlir)
            .input("hedef", sql.VarChar(10), g.hedef)
            .input("metin", sql.NVarChar(4000), g.metin.slice(0, 4000)).query(`
        UPDATE dbo.ADM_KONU SET BASLIK = @baslik, BILDIRIM_TURU = @tur, ONEMLI = @onemli, CEVAP_ALIR = @cevapAlir, HEDEF = @hedef WHERE KONU_ID = @id;
        UPDATE dbo.ADM_KONU_MESAJ SET METIN = @metin WHERE MESAJ_ID = (SELECT MIN(MESAJ_ID) FROM dbo.ADM_KONU_MESAJ WHERE KONU_ID = @id);
        DELETE FROM dbo.ADM_KONU_HEDEF WHERE KONU_ID = @id;`);
    }
    static async hedefEkle(konuId, hedefler) {
        if (hedefler.length === 0)
            return;
        const pool = await getAdminPool();
        const tablo = new sql.Table("dbo.ADM_KONU_HEDEF");
        tablo.create = false;
        tablo.columns.add("KONU_ID", sql.Int, { nullable: false });
        tablo.columns.add("FIRMA_ID", sql.Int, { nullable: false });
        tablo.columns.add("KULLANICI_ID", sql.Int, { nullable: true });
        tablo.columns.add("KULLANICI_ADI", sql.NVarChar(100), { nullable: true });
        for (const h of hedefler)
            tablo.rows.add(konuId, h.firmaId, h.kullaniciId ?? null, h.kullaniciAdi ?? null);
        await pool.request().bulk(tablo);
    }
    static async hedefler(konuId) {
        const pool = await getAdminPool();
        const r = await pool.request().input("id", sql.Int, konuId).query(`
      SELECT h.FIRMA_ID, f.FIRMA_KODU, f.UNVAN, h.KULLANICI_ID, ISNULL(h.KULLANICI_ADI, k.KULLANICI_ADI) AS KULLANICI_ADI
      FROM dbo.ADM_KONU_HEDEF h
      INNER JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = h.FIRMA_ID
      LEFT JOIN dbo.ADM_KULLANICI k ON k.KULLANICI_ID = h.KULLANICI_ID
      WHERE h.KONU_ID = @id ORDER BY f.UNVAN`);
        return r.recordset.map((x) => ({ firmaId: x.FIRMA_ID, firmaKodu: x.FIRMA_KODU, unvan: x.UNVAN, kullaniciId: x.KULLANICI_ID ?? null, kullaniciAdi: x.KULLANICI_ADI ?? null }));
    }
    static async ekEkle(e) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("konuId", sql.Int, e.konuId)
            .input("mesajId", sql.Int, e.mesajId)
            .input("ad", sql.NVarChar(200), e.dosyaAdi.slice(0, 200))
            .input("mime", sql.VarChar(50), e.mime)
            .input("boyut", sql.Int, e.boyut).query(`
        INSERT INTO dbo.ADM_KONU_EK (KONU_ID, MESAJ_ID, DOSYA_ADI, MIME, BOYUT) OUTPUT INSERTED.EK_ID VALUES (@konuId, @mesajId, @ad, @mime, @boyut)`);
        return r.recordset[0].EK_ID;
    }
    static async ekYoluYaz(ekId, yol) {
        const pool = await getAdminPool();
        await pool.request().input("id", sql.Int, ekId).input("yol", sql.NVarChar(400), yol).query(`UPDATE dbo.ADM_KONU_EK SET YOL = @yol WHERE EK_ID = @id`);
    }
    static async ekGetir(ekId) {
        const pool = await getAdminPool();
        const r = await pool.request().input("id", sql.Int, ekId).query(`SELECT EK_ID, KONU_ID, DOSYA_ADI, MIME, BOYUT, YOL, SILINDI FROM dbo.ADM_KONU_EK WHERE EK_ID = @id`);
        const x = r.recordset[0];
        return x ? { ekId: x.EK_ID, konuId: x.KONU_ID, dosyaAdi: x.DOSYA_ADI, mime: x.MIME, boyut: x.BOYUT, silindi: !!x.SILINDI, yol: x.YOL ?? null } : null;
    }
    /** Konunun ek dosya yollarını döner ve satırları silindi işaretler (dosyaları çağıran siler). */
    static async ekleriSilindiYap(konuId) {
        const pool = await getAdminPool();
        const r = await pool.request().input("id", sql.Int, konuId).query(`
      SELECT YOL FROM dbo.ADM_KONU_EK WHERE KONU_ID = @id AND SILINDI = 0 AND YOL IS NOT NULL;
      UPDATE dbo.ADM_KONU_EK SET SILINDI = 1, YOL = NULL WHERE KONU_ID = @id AND SILINDI = 0;`);
        return r.recordsets[0].map((x) => x.YOL);
    }
    static async okunduYaz(konuId, taraf, kisiId, sonMesajId) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, konuId)
            .input("taraf", sql.VarChar(10), taraf)
            .input("kisi", sql.Int, kisiId)
            .input("son", sql.Int, sonMesajId ?? 0).query(`
        MERGE dbo.ADM_KONU_OKUMA AS h
        USING (SELECT @id AS KONU_ID, @taraf AS TARAF, @kisi AS KISI_ID) AS y ON h.KONU_ID = y.KONU_ID AND h.TARAF = y.TARAF AND h.KISI_ID = y.KISI_ID
        WHEN MATCHED THEN UPDATE SET SON_OKUNAN_MESAJ_ID = CASE WHEN @son > h.SON_OKUNAN_MESAJ_ID THEN @son ELSE h.SON_OKUNAN_MESAJ_ID END, OKUNDU_TARIHI = GETDATE()
        WHEN NOT MATCHED THEN INSERT (KONU_ID, TARAF, KISI_ID, SON_OKUNAN_MESAJ_ID, OKUNDU_TARIHI) VALUES (@id, @taraf, @kisi, @son, GETDATE());`);
    }
    /** Kullanıcının görebildiği tüm konular okundu sayılır. */
    static async tumunuOkunduYaz(kimlik) {
        if (kimlik.kullaniciId === null)
            return;
        const pool = await getAdminPool();
        await kimlikGirdileri(pool.request(), kimlik).query(`
      MERGE dbo.ADM_KONU_OKUMA AS h
      USING (
        SELECT k.KONU_ID, ISNULL((SELECT MAX(m.MESAJ_ID) FROM dbo.ADM_KONU_MESAJ m WHERE m.KONU_ID = k.KONU_ID AND m.IC_NOT = 0), 0) AS SON
        FROM dbo.ADM_KONU k WHERE ${KULLANICI_GORUNURLUK}
      ) AS y ON h.KONU_ID = y.KONU_ID AND h.TARAF = 'KULLANICI' AND h.KISI_ID = @kullaniciId
      WHEN MATCHED THEN UPDATE SET SON_OKUNAN_MESAJ_ID = CASE WHEN y.SON > h.SON_OKUNAN_MESAJ_ID THEN y.SON ELSE h.SON_OKUNAN_MESAJ_ID END, OKUNDU_TARIHI = GETDATE()
      WHEN NOT MATCHED THEN INSERT (KONU_ID, TARAF, KISI_ID, SON_OKUNAN_MESAJ_ID, OKUNDU_TARIHI) VALUES (y.KONU_ID, 'KULLANICI', @kullaniciId, y.SON, GETDATE());`);
    }
    static async bayrakYaz(konuId, taraf, kisiId, alan, deger) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("id", sql.Int, konuId)
            .input("taraf", sql.VarChar(10), taraf)
            .input("kisi", sql.Int, kisiId)
            .input("deger", sql.Bit, deger).query(`
        MERGE dbo.ADM_KONU_OKUMA AS h
        USING (SELECT @id AS KONU_ID, @taraf AS TARAF, @kisi AS KISI_ID) AS y ON h.KONU_ID = y.KONU_ID AND h.TARAF = y.TARAF AND h.KISI_ID = y.KISI_ID
        WHEN MATCHED THEN UPDATE SET ${alan} = @deger
        WHEN NOT MATCHED THEN INSERT (KONU_ID, TARAF, KISI_ID, ${alan}) VALUES (@id, @taraf, @kisi, @deger);`);
    }
    // ------------------------------------------------------------------ Okuma ---
    static async konuGetir(konuId, taraf, kisiId) {
        const pool = await getAdminPool();
        const r = await okumaGirdileri(pool.request(), taraf, kisiId).input("id", sql.Int, konuId).query(`${KONU_SECIM} WHERE k.KONU_ID = @id`);
        return r.recordset[0] ? satirdanKonu(r.recordset[0]) : null;
    }
    static async olayAnahtariIleBul(anahtar) {
        const pool = await getAdminPool();
        const r = await pool.request().input("a", sql.VarChar(100), anahtar).query(`SELECT KONU_ID, DURUM FROM dbo.ADM_KONU WHERE OLAY_ANAHTARI = @a`);
        return r.recordset[0] ? { konuId: r.recordset[0].KONU_ID, durum: r.recordset[0].DURUM } : null;
    }
    static async yerelAnahtarIleBul(firmaId, yerelAnahtar) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("f", sql.Int, firmaId)
            .input("y", sql.VarChar(60), yerelAnahtar)
            .query(`SELECT KONU_ID FROM dbo.ADM_KONU WHERE FIRMA_ID = @f AND YEREL_ANAHTAR = @y`);
        return r.recordset[0]?.KONU_ID ?? null;
    }
    static async mesajYerelAnahtarVarMi(konuId, yerelAnahtar) {
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("k", sql.Int, konuId)
            .input("y", sql.VarChar(60), yerelAnahtar)
            .query(`SELECT 1 AS V FROM dbo.ADM_KONU_MESAJ WHERE KONU_ID = @k AND YEREL_ANAHTAR = @y`);
        return r.recordset.length > 0;
    }
    /** Bildirime verilmiş yanıt talebi (K9): aynı kullanıcı aynı bildirime ikinci kez yanıt verince aynı talep sürer. */
    static async yanitTalebiBul(kaynakKonuId, kimlik) {
        const pool = await getAdminPool();
        const r = await kimlikGirdileri(pool.request(), kimlik).input("kaynak", sql.Int, kaynakKonuId).query(`
      SELECT TOP 1 KONU_ID FROM dbo.ADM_KONU
      WHERE TUR = 'TALEP' AND KAYNAK_KONU_ID = @kaynak AND FIRMA_ID = @firmaId
        AND (KULLANICI_ID = @kullaniciId OR (KULLANICI_ID IS NULL AND KULLANICI_ADI = @kullaniciAdi))
      ORDER BY KONU_ID DESC`);
        return r.recordset[0]?.KONU_ID ?? null;
    }
    static async kullaniciGorebilirMi(konuId, kimlik) {
        const pool = await getAdminPool();
        const r = await kimlikGirdileri(pool.request(), kimlik).input("id", sql.Int, konuId).query(`SELECT 1 AS V FROM dbo.ADM_KONU k WHERE k.KONU_ID = @id AND ${KULLANICI_GORUNURLUK}`);
        return r.recordset.length > 0;
    }
    static async kullaniciKonulari(kimlik, sekme, adet = 200) {
        const pool = await getAdminPool();
        const kosul = sekme === "arsiv"
            ? "AND ISNULL(o.ARSIV, 0) = 1"
            : sekme === "talepler"
                ? "AND ISNULL(o.ARSIV, 0) = 0 AND k.TUR = 'TALEP'"
                : sekme === "bildirimler"
                    ? "AND ISNULL(o.ARSIV, 0) = 0 AND k.TUR IN ('BILDIRIM', 'SISTEM')"
                    : "AND ISNULL(o.ARSIV, 0) = 0";
        const r = await okumaGirdileri(kimlikGirdileri(pool.request(), kimlik), "KULLANICI", kimlik.kullaniciId)
            .input("adet", sql.Int, adet)
            .query(`${KONU_SECIM} WHERE ${KULLANICI_GORUNURLUK} ${kosul} ORDER BY k.SON_MESAJ_TARIHI DESC OFFSET 0 ROWS FETCH NEXT @adet ROWS ONLY`);
        return r.recordset.map(satirdanKonu);
    }
    static async kullaniciOzet(kimlik) {
        const pool = await getAdminPool();
        const r = await okumaGirdileri(kimlikGirdileri(pool.request(), kimlik), "KULLANICI", kimlik.kullaniciId).query(`
      SELECT COUNT(*) AS N FROM (
        SELECT k.KONU_ID,
               (SELECT MAX(m.MESAJ_ID) FROM dbo.ADM_KONU_MESAJ m WHERE m.KONU_ID = k.KONU_ID AND m.IC_NOT = 0 AND m.GONDEREN_TUR IN (@karsi1, @karsi2)) AS KARSI_SON,
               o.SON_OKUNAN_MESAJ_ID, o.ARSIV
        FROM dbo.ADM_KONU k
        LEFT JOIN dbo.ADM_KONU_OKUMA o ON o.KONU_ID = k.KONU_ID AND o.TARAF = @taraf AND o.KISI_ID = @kisiId
        WHERE ${KULLANICI_GORUNURLUK}
      ) x WHERE x.KARSI_SON IS NOT NULL AND ISNULL(x.ARSIV, 0) = 0 AND (x.SON_OKUNAN_MESAJ_ID IS NULL OR x.SON_OKUNAN_MESAJ_ID < x.KARSI_SON);
      ${KONU_SECIM} WHERE ${KULLANICI_GORUNURLUK} AND k.TUR = 'BILDIRIM' AND k.ONEMLI = 1 AND ISNULL(o.ONEMLI_OKUNDU, 0) = 0
      ORDER BY k.GONDERIM_TARIHI DESC;`);
        return { okunmamis: Number(r.recordsets[0][0]?.N ?? 0), onemli: r.recordsets[1].map(satirdanKonu) };
    }
    static async mesajlar(konuId, icNotDahil) {
        const pool = await getAdminPool();
        const r = await pool.request().input("id", sql.Int, konuId).input("icNot", sql.Bit, icNotDahil).query(`
      SELECT MESAJ_ID, GONDEREN_TUR, ADMIN_ID, KULLANICI_ID, GONDEREN_AD, METIN, IC_NOT, TARIH
      FROM dbo.ADM_KONU_MESAJ WHERE KONU_ID = @id AND (IC_NOT = 0 OR @icNot = 1) ORDER BY MESAJ_ID;
      SELECT EK_ID, MESAJ_ID, DOSYA_ADI, MIME, BOYUT, SILINDI FROM dbo.ADM_KONU_EK WHERE KONU_ID = @id ORDER BY EK_ID;`);
        const ekler = new Map();
        for (const e of r.recordsets[1]) {
            const liste = ekler.get(e.MESAJ_ID) ?? [];
            liste.push({ ekId: e.EK_ID, dosyaAdi: e.DOSYA_ADI, mime: e.MIME, boyut: e.BOYUT, silindi: !!e.SILINDI });
            ekler.set(e.MESAJ_ID, liste);
        }
        return r.recordsets[0].map((m) => ({
            mesajId: m.MESAJ_ID,
            gonderenTur: m.GONDEREN_TUR,
            gonderenAd: m.GONDEREN_AD ?? null,
            adminId: m.ADMIN_ID ?? null,
            kullaniciId: m.KULLANICI_ID ?? null,
            metin: m.METIN,
            icNot: !!m.IC_NOT,
            tarih: m.TARIH,
            ekler: ekler.get(m.MESAJ_ID) ?? [],
        }));
    }
    static async adminKonulari(adminId, f) {
        const pool = await getAdminPool();
        const sayfaBoyu = Math.min(Math.max(f.sayfaBoyu ?? 50, 1), 200);
        const sayfa = Math.max(f.sayfa ?? 1, 1);
        const kosullar = [];
        const req = okumaGirdileri(pool.request(), "ADMIN", adminId);
        if (f.tur === "TALEP_SISTEM")
            kosullar.push("k.TUR IN ('TALEP','SISTEM')");
        else if (f.tur)
            kosullar.push("k.TUR = @tur"), req.input("tur", sql.VarChar(10), f.tur);
        if (f.durum && f.durum !== "HEPSI") {
            if (f.durum === "ACIK_HEPSI")
                kosullar.push("k.DURUM <> 'KAPALI'");
            else
                kosullar.push("k.DURUM = @durum"), req.input("durum", sql.VarChar(20), f.durum);
        }
        if (f.firmaId)
            kosullar.push("k.FIRMA_ID = @firmaId"), req.input("firmaId", sql.Int, f.firmaId);
        if (f.atananAdminId)
            kosullar.push("k.ATANAN_ADMIN_ID = @atanan"), req.input("atanan", sql.Int, f.atananAdminId);
        if (f.kaynakKonuId)
            kosullar.push("k.KAYNAK_KONU_ID = @kaynak"), req.input("kaynak", sql.Int, f.kaynakKonuId);
        if (f.arama) {
            kosullar.push("(k.BASLIK LIKE @arama OR f.UNVAN LIKE @arama OR f.FIRMA_KODU LIKE @arama OR k.KULLANICI_ADI LIKE @arama)");
            req.input("arama", sql.NVarChar(120), `%${f.arama.trim().slice(0, 100)}%`);
        }
        const where = kosullar.length ? `WHERE ${kosullar.join(" AND ")}` : "";
        const r = await req
            .input("atla", sql.Int, (sayfa - 1) * sayfaBoyu)
            .input("adet", sql.Int, sayfaBoyu)
            .query(`
        SELECT COUNT(*) AS N FROM dbo.ADM_KONU k LEFT JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = k.FIRMA_ID ${where};
        ${KONU_SECIM} ${where} ORDER BY k.SON_MESAJ_TARIHI DESC OFFSET @atla ROWS FETCH NEXT @adet ROWS ONLY;`);
        return { toplam: Number(r.recordsets[0][0]?.N ?? 0), satirlar: r.recordsets[1].map(satirdanKonu) };
    }
    static async adminOzet(adminId) {
        const pool = await getAdminPool();
        const r = await okumaGirdileri(pool.request(), "ADMIN", adminId).query(`
      SELECT
        (SELECT COUNT(*) FROM (
            SELECT k.KONU_ID,
                   (SELECT MAX(m.MESAJ_ID) FROM dbo.ADM_KONU_MESAJ m WHERE m.KONU_ID = k.KONU_ID AND m.IC_NOT = 0 AND m.GONDEREN_TUR IN (@karsi1, @karsi2)) AS KARSI_SON,
                   o.SON_OKUNAN_MESAJ_ID
            FROM dbo.ADM_KONU k
            LEFT JOIN dbo.ADM_KONU_OKUMA o ON o.KONU_ID = k.KONU_ID AND o.TARAF = @taraf AND o.KISI_ID = @kisiId
            WHERE k.TUR IN ('TALEP','SISTEM')
          ) x WHERE x.KARSI_SON IS NOT NULL AND (x.SON_OKUNAN_MESAJ_ID IS NULL OR x.SON_OKUNAN_MESAJ_ID < x.KARSI_SON)) AS OKUNMAMIS,
        (SELECT COUNT(*) FROM dbo.ADM_KONU WHERE TUR = 'TALEP' AND DURUM <> 'KAPALI') AS ACIK,
        (SELECT COUNT(*) FROM dbo.ADM_KONU WHERE TUR = 'BILDIRIM' AND DURUM = 'TASLAK') AS TASLAK`);
        const x = r.recordset[0] ?? {};
        return { okunmamis: Number(x.OKUNMAMIS ?? 0), acikTalep: Number(x.ACIK ?? 0), taslakBildirim: Number(x.TASLAK ?? 0) };
    }
    /** Yanıt verilebilen bildirime bağlı talep sayısı vb. için: bir bildirime gelen yanıt talepleri */
    static async bildirimYanitlari(kaynakKonuId) {
        const pool = await getAdminPool();
        const r = await pool.request().input("k", sql.Int, kaynakKonuId).query(`SELECT COUNT(*) AS N FROM dbo.ADM_KONU WHERE KAYNAK_KONU_ID = @k`);
        return Number(r.recordset[0]?.N ?? 0);
    }
    static async surumTaslagiVarMi(surum) {
        const pool = await getAdminPool();
        const r = await pool.request().input("s", sql.VarChar(30), surum).query(`SELECT 1 AS V FROM dbo.ADM_KONU WHERE TUR = 'BILDIRIM' AND SURUM = @s`);
        return r.recordset.length > 0;
    }
    /** Lisans taraması için: aktif lisansı olan firmaların kalan günleri. */
    static async lisansKalanGunler() {
        const pool = await getAdminPool();
        const r = await pool.request().query(`
      SELECT f.FIRMA_ID, f.UNVAN, l.LISANS_ID, l.BITIS, DATEDIFF(DAY, CAST(GETDATE() AS DATE), l.BITIS) AS KALAN
      FROM dbo.ADM_FIRMA f INNER JOIN dbo.ADM_LISANS l ON l.FIRMA_ID = f.FIRMA_ID AND l.AKTIF = 1
      WHERE f.DURUM IN ('AKTIF','DONDURULMUS')`);
        return r.recordset.map((x) => ({ firmaId: x.FIRMA_ID, lisansId: x.LISANS_ID, kalanGun: Number(x.KALAN), unvan: x.UNVAN, bitis: x.BITIS }));
    }
    /** Bildirim hedef seçimi için firmalar ve kullanıcılar (admin ekranı). */
    static async hedefSecenekleri() {
        const pool = await getAdminPool();
        const r = await pool.request().query(`
      SELECT FIRMA_ID, FIRMA_KODU, UNVAN, DURUM FROM dbo.ADM_FIRMA WHERE DURUM NOT IN ('SILINDI') ORDER BY UNVAN;
      SELECT KULLANICI_ID, FIRMA_ID, KULLANICI_ADI, AD_SOYAD FROM dbo.ADM_KULLANICI WHERE DURUM = 'AKTIF' ORDER BY FIRMA_ID, KULLANICI_ADI;`);
        return {
            firmalar: r.recordsets[0].map((x) => ({ firmaId: x.FIRMA_ID, firmaKodu: x.FIRMA_KODU, unvan: x.UNVAN, durum: x.DURUM })),
            kullanicilar: r.recordsets[1].map((x) => ({ kullaniciId: x.KULLANICI_ID, firmaId: x.FIRMA_ID, kullaniciAdi: x.KULLANICI_ADI, adSoyad: x.AD_SOYAD ?? null })),
        };
    }
}
