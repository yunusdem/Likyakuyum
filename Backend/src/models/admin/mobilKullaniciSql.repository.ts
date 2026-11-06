import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { MobilSqlRepository } from "./mobilSql.repository.js";

/**
 * Mobil kullanıcılar ve erişimleri — merkez (LIKYA_ADMIN) tabloları (docs/MOBIL_CARI_YOL_HARITASI.md §4, K5–K10, K25–K26).
 * Sınır (firma başına toplam aktif erişim) her eklemede aynı işlem içinde kilitlenerek sayılır.
 */

export interface MobilYetkiler {
  fiyat: boolean;
  bakiye: boolean;
  dokum: boolean;
  alis: boolean;
  satis: boolean;
}

export type MobilDurum = "AKTIF" | "PASIF";

export interface MobilErisimSatiri {
  erisimId: number;
  mobilKullaniciId: number;
  musteriNo: string;
  kullaniciAdi: string;
  adSoyad: string | null;
  eposta: string | null;
  kullaniciDurum: MobilDurum;
  sifreDegismeli: boolean;
  kilitBitis: Date | null;
  /** Kilit sürüyor mu (SQL'de GETDATE ile; sürücü DATETIME'ı UTC saydığı için JS'te karşılaştırılmaz) */
  kilitli: boolean;
  sonGiris: Date | null;
  firmaId: number;
  firmaUnvan: string;
  dbName: string;
  cariKartId: number;
  cariKod: string | null;
  cariAd: string | null;
  yetkiler: MobilYetkiler;
  durum: MobilDurum;
  olusturan: string | null;
  olusturmaTarihi: Date;
}

export interface MobilKullaniciKaydi {
  mobilKullaniciId: number;
  musteriNo: string;
  kullaniciAdi: string;
  adSoyad: string | null;
  eposta: string | null;
  sifreOzet: string;
  sifreDegismeli: boolean;
  durum: MobilDurum;
  hataliDeneme: number;
  kilitBitis: Date | null;
  kilitli: boolean;
  sonGiris: Date | null;
}

export type EklemeSonucu =
  | { sonuc: "TAMAM"; id: number; erisimId: number }
  | { sonuc: "LIMIT"; limit: number; kullanilan: number }
  | { sonuc: "AD_VAR" }
  | { sonuc: "ERISIM_VAR" };

const erisimSatiri = (r: any): MobilErisimSatiri => ({
  erisimId: r.ERISIM_ID,
  mobilKullaniciId: r.MOBIL_KULLANICI_ID,
  musteriNo: r.MUSTERI_NO,
  kullaniciAdi: r.KULLANICI_ADI,
  adSoyad: r.AD_SOYAD ?? null,
  eposta: r.EPOSTA ?? null,
  kullaniciDurum: r.K_DURUM,
  sifreDegismeli: !!r.SIFRE_DEGISMELI,
  kilitBitis: r.KILIT_BITIS ?? null,
  kilitli: !!r.KILITLI,
  sonGiris: r.SON_GIRIS ?? null,
  firmaId: r.FIRMA_ID,
  firmaUnvan: r.UNVAN,
  dbName: r.DB_NAME,
  cariKartId: r.CARI_KART_ID,
  cariKod: r.CARI_KOD ? String(r.CARI_KOD).trim() : null,
  cariAd: r.CARI_AD ?? null,
  yetkiler: { fiyat: !!r.YETKI_FIYAT, bakiye: !!r.YETKI_BAKIYE, dokum: !!r.YETKI_DOKUM, alis: !!r.YETKI_ALIS, satis: !!r.YETKI_SATIS },
  durum: r.DURUM,
  olusturan: r.OLUSTURAN ?? null,
  olusturmaTarihi: r.OLUSTURMA_TARIHI,
});

export const kullaniciKaydi = (r: any): MobilKullaniciKaydi => ({
  mobilKullaniciId: r.MOBIL_KULLANICI_ID,
  musteriNo: r.MUSTERI_NO,
  kullaniciAdi: r.KULLANICI_ADI,
  adSoyad: r.AD_SOYAD ?? null,
  eposta: r.EPOSTA ?? null,
  sifreOzet: r.SIFRE_OZET,
  sifreDegismeli: !!r.SIFRE_DEGISMELI,
  durum: r.DURUM,
  hataliDeneme: Number(r.HATALI_DENEME) || 0,
  kilitBitis: r.KILIT_BITIS ?? null,
  kilitli: !!r.KILITLI,
  sonGiris: r.SON_GIRIS ?? null,
});

const ERISIM_SECIM = `
  SELECT e.ERISIM_ID, e.MOBIL_KULLANICI_ID, k.MUSTERI_NO, k.KULLANICI_ADI, k.AD_SOYAD, k.EPOSTA, k.DURUM AS K_DURUM, k.SIFRE_DEGISMELI,
         k.KILIT_BITIS, CAST(CASE WHEN k.KILIT_BITIS > GETDATE() THEN 1 ELSE 0 END AS BIT) AS KILITLI, k.SON_GIRIS, e.FIRMA_ID, f.UNVAN, f.DB_NAME, e.CARI_KART_ID, e.CARI_KOD, e.CARI_AD,
         e.YETKI_FIYAT, e.YETKI_BAKIYE, e.YETKI_DOKUM, e.YETKI_ALIS, e.YETKI_SATIS, e.DURUM, e.OLUSTURAN, e.OLUSTURMA_TARIHI
  FROM dbo.ADM_MOBIL_ERISIM e
  JOIN dbo.ADM_MOBIL_KULLANICI k ON k.MOBIL_KULLANICI_ID = e.MOBIL_KULLANICI_ID
  JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = e.FIRMA_ID`;

// Sınır sayımı (K26): aktif kullanıcının aktif erişimi. Kilitli sayılır ki iki eşzamanlı ekleme sınırı aşmasın.
const SINIR_DENETIMI = `
  DECLARE @limit int = ISNULL((SELECT KULLANICI_LIMITI FROM dbo.ADM_MOBIL_FIRMA WITH (UPDLOCK, HOLDLOCK) WHERE FIRMA_ID = @firmaId), 0);
  DECLARE @n int = (SELECT COUNT(*) FROM dbo.ADM_MOBIL_ERISIM e WITH (UPDLOCK, HOLDLOCK)
                    JOIN dbo.ADM_MOBIL_KULLANICI k ON k.MOBIL_KULLANICI_ID = e.MOBIL_KULLANICI_ID
                    WHERE e.FIRMA_ID = @firmaId AND e.DURUM = 'AKTIF' AND k.DURUM = 'AKTIF');`;

const yetkiGirdileri = (r: sql.Request, y: MobilYetkiler) =>
  r.input("yf", sql.Bit, y.fiyat).input("yb", sql.Bit, y.bakiye).input("yd", sql.Bit, y.dokum).input("ya", sql.Bit, y.alis).input("ys", sql.Bit, y.satis);

const eklemeSonucu = (x: any): EklemeSonucu => {
  if (x.SONUC === "TAMAM") return { sonuc: "TAMAM", id: x.ID, erisimId: x.EID };
  if (x.SONUC === "LIMIT") return { sonuc: "LIMIT", limit: x.L, kullanilan: x.N };
  return { sonuc: x.SONUC };
};

const havuz = async () => {
  await MobilSqlRepository.semaGerekli();
  return getAdminPool();
};

export class MobilKullaniciSqlRepository {
  /** Müşteri nonun bütün erişimleri (K5) */
  public static async musteriErisimleri(musteriNo: string): Promise<MobilErisimSatiri[]> {
    const r = await (await havuz()).request().input("no", sql.VarChar(20), musteriNo).query(`${ERISIM_SECIM}
      WHERE k.MUSTERI_NO = @no ORDER BY k.KULLANICI_ADI, f.UNVAN`);
    return r.recordset.map(erisimSatiri);
  }

  public static async kullaniciErisimleri(mobilKullaniciId: number): Promise<MobilErisimSatiri[]> {
    const r = await (await havuz()).request().input("id", sql.Int, mobilKullaniciId).query(`${ERISIM_SECIM}
      WHERE e.MOBIL_KULLANICI_ID = @id ORDER BY f.UNVAN`);
    return r.recordset.map(erisimSatiri);
  }

  public static async erisim(erisimId: number): Promise<MobilErisimSatiri | null> {
    const r = await (await havuz()).request().input("id", sql.Int, erisimId).query(`${ERISIM_SECIM} WHERE e.ERISIM_ID = @id`);
    return r.recordset[0] ? erisimSatiri(r.recordset[0]) : null;
  }

  public static async kullanici(mobilKullaniciId: number): Promise<MobilKullaniciKaydi | null> {
    const r = await (await havuz()).request().input("id", sql.Int, mobilKullaniciId).query(`SELECT k.*, CAST(CASE WHEN k.KILIT_BITIS > GETDATE() THEN 1 ELSE 0 END AS BIT) AS KILITLI FROM dbo.ADM_MOBIL_KULLANICI k WHERE k.MOBIL_KULLANICI_ID = @id`);
    return r.recordset[0] ? kullaniciKaydi(r.recordset[0]) : null;
  }

  public static async kullaniciAdiIleBul(musteriNo: string, kullaniciAdi: string): Promise<MobilKullaniciKaydi | null> {
    const r = await (await havuz())
      .request()
      .input("no", sql.VarChar(20), musteriNo)
      .input("ad", sql.VarChar(50), kullaniciAdi)
      .query(`SELECT k.*, CAST(CASE WHEN k.KILIT_BITIS > GETDATE() THEN 1 ELSE 0 END AS BIT) AS KILITLI FROM dbo.ADM_MOBIL_KULLANICI k WHERE k.MUSTERI_NO = @no AND k.KULLANICI_ADI = @ad`);
    return r.recordset[0] ? kullaniciKaydi(r.recordset[0]) : null;
  }

  /** Yeni mobil kullanıcı + bu firmadaki erişimi; sınır ve ad benzersizliği aynı işlemde denetlenir */
  public static async kullaniciEkle(v: {
    musteriNo: string;
    kullaniciAdi: string;
    adSoyad: string | null;
    eposta: string | null;
    sifreOzet: string;
    firmaId: number;
    cariKartId: number;
    cariKod: string | null;
    cariAd: string | null;
    yetkiler: MobilYetkiler;
    olusturan: string;
  }): Promise<EklemeSonucu> {
    const res = await yetkiGirdileri((await havuz()).request(), v.yetkiler)
      .input("no", sql.VarChar(20), v.musteriNo)
      .input("ad", sql.VarChar(50), v.kullaniciAdi)
      .input("adSoyad", sql.NVarChar(100), v.adSoyad)
      .input("eposta", sql.NVarChar(200), v.eposta)
      .input("ozet", sql.VarChar(100), v.sifreOzet)
      .input("firmaId", sql.Int, v.firmaId)
      .input("cariId", sql.Int, v.cariKartId)
      .input("cariKod", sql.NVarChar(30), v.cariKod)
      .input("cariAd", sql.NVarChar(200), v.cariAd)
      .input("kim", sql.NVarChar(100), v.olusturan).query(`
      SET XACT_ABORT ON;
      BEGIN TRAN;
      ${SINIR_DENETIMI}
      IF EXISTS (SELECT 1 FROM dbo.ADM_MOBIL_KULLANICI WITH (UPDLOCK, HOLDLOCK) WHERE MUSTERI_NO = @no AND KULLANICI_ADI = @ad)
      BEGIN ROLLBACK; SELECT 'AD_VAR' AS SONUC; RETURN; END
      IF @n + 1 > @limit
      BEGIN ROLLBACK; SELECT 'LIMIT' AS SONUC, @limit AS L, @n AS N; RETURN; END
      INSERT INTO dbo.ADM_MOBIL_KULLANICI (MUSTERI_NO, KULLANICI_ADI, AD_SOYAD, EPOSTA, SIFRE_OZET, SIFRE_DEGISMELI, OLUSTURAN)
      VALUES (@no, @ad, @adSoyad, @eposta, @ozet, 1, @kim);
      DECLARE @id int = CAST(SCOPE_IDENTITY() AS int);
      INSERT INTO dbo.ADM_MOBIL_ERISIM (MOBIL_KULLANICI_ID, FIRMA_ID, CARI_KART_ID, CARI_KOD, CARI_AD,
        YETKI_FIYAT, YETKI_BAKIYE, YETKI_DOKUM, YETKI_ALIS, YETKI_SATIS, OLUSTURAN)
      VALUES (@id, @firmaId, @cariId, @cariKod, @cariAd, @yf, @yb, @yd, @ya, @ys, @kim);
      DECLARE @eid int = CAST(SCOPE_IDENTITY() AS int);
      COMMIT;
      SELECT 'TAMAM' AS SONUC, @id AS ID, @eid AS EID;`);
    return eklemeSonucu(res.recordset[0]);
  }

  /** Var olan mobil kullanıcıya başka veritabanında erişim (K25); o firmanın sınırına sayılır */
  public static async erisimEkle(v: {
    mobilKullaniciId: number;
    firmaId: number;
    cariKartId: number;
    cariKod: string | null;
    cariAd: string | null;
    yetkiler: MobilYetkiler;
    olusturan: string;
  }): Promise<EklemeSonucu> {
    const res = await yetkiGirdileri((await havuz()).request(), v.yetkiler)
      .input("kid", sql.Int, v.mobilKullaniciId)
      .input("firmaId", sql.Int, v.firmaId)
      .input("cariId", sql.Int, v.cariKartId)
      .input("cariKod", sql.NVarChar(30), v.cariKod)
      .input("cariAd", sql.NVarChar(200), v.cariAd)
      .input("kim", sql.NVarChar(100), v.olusturan).query(`
      SET XACT_ABORT ON;
      BEGIN TRAN;
      ${SINIR_DENETIMI}
      IF EXISTS (SELECT 1 FROM dbo.ADM_MOBIL_ERISIM WITH (UPDLOCK, HOLDLOCK) WHERE MOBIL_KULLANICI_ID = @kid AND FIRMA_ID = @firmaId)
      BEGIN ROLLBACK; SELECT 'ERISIM_VAR' AS SONUC; RETURN; END
      IF @n + 1 > @limit
      BEGIN ROLLBACK; SELECT 'LIMIT' AS SONUC, @limit AS L, @n AS N; RETURN; END
      INSERT INTO dbo.ADM_MOBIL_ERISIM (MOBIL_KULLANICI_ID, FIRMA_ID, CARI_KART_ID, CARI_KOD, CARI_AD,
        YETKI_FIYAT, YETKI_BAKIYE, YETKI_DOKUM, YETKI_ALIS, YETKI_SATIS, OLUSTURAN)
      VALUES (@kid, @firmaId, @cariId, @cariKod, @cariAd, @yf, @yb, @yd, @ya, @ys, @kim);
      DECLARE @eid int = CAST(SCOPE_IDENTITY() AS int);
      COMMIT;
      SELECT 'TAMAM' AS SONUC, @kid AS ID, @eid AS EID;`);
    return eklemeSonucu(res.recordset[0]);
  }

  /** Erişimin yetkileri / durumu. Pasiften aktife dönüş sınıra sayılır. */
  public static async erisimGuncelle(
    erisimId: number,
    v: { yetkiler: MobilYetkiler; durum: MobilDurum; guncelleyen: string }
  ): Promise<{ sonuc: "TAMAM" } | { sonuc: "LIMIT"; limit: number; kullanilan: number }> {
    const res = await yetkiGirdileri((await havuz()).request(), v.yetkiler)
      .input("id", sql.Int, erisimId)
      .input("durum", sql.VarChar(10), v.durum)
      .input("kim", sql.NVarChar(100), v.guncelleyen).query(`
      SET XACT_ABORT ON;
      BEGIN TRAN;
      DECLARE @firmaId int, @eski varchar(10), @kDurum varchar(10);
      SELECT @firmaId = e.FIRMA_ID, @eski = e.DURUM, @kDurum = k.DURUM FROM dbo.ADM_MOBIL_ERISIM e WITH (UPDLOCK)
        JOIN dbo.ADM_MOBIL_KULLANICI k ON k.MOBIL_KULLANICI_ID = e.MOBIL_KULLANICI_ID WHERE e.ERISIM_ID = @id;
      ${SINIR_DENETIMI}
      IF @durum = 'AKTIF' AND @eski = 'PASIF' AND @kDurum = 'AKTIF' AND @n + 1 > @limit
      BEGIN ROLLBACK; SELECT 'LIMIT' AS SONUC, @limit AS L, @n AS N; RETURN; END
      UPDATE dbo.ADM_MOBIL_ERISIM SET YETKI_FIYAT = @yf, YETKI_BAKIYE = @yb, YETKI_DOKUM = @yd, YETKI_ALIS = @ya, YETKI_SATIS = @ys,
        DURUM = @durum, GUNCELLEYEN = @kim, GUNCELLEME_TARIHI = GETDATE() WHERE ERISIM_ID = @id;
      COMMIT;
      SELECT 'TAMAM' AS SONUC;`);
    const x = res.recordset[0];
    return x.SONUC === "LIMIT" ? { sonuc: "LIMIT", limit: x.L, kullanilan: x.N } : { sonuc: "TAMAM" };
  }

  public static async erisimSil(erisimId: number): Promise<void> {
    await (await havuz()).request().input("id", sql.Int, erisimId).query(`DELETE FROM dbo.ADM_MOBIL_ERISIM WHERE ERISIM_ID = @id`);
  }

  /** Cari kartta kod / ad değişince listeler güncel görünsün */
  public static async cariBilgisiYenile(firmaId: number, cariKartId: number, kod: string | null, ad: string | null): Promise<void> {
    await (await havuz())
      .request()
      .input("firmaId", sql.Int, firmaId)
      .input("cariId", sql.Int, cariKartId)
      .input("kod", sql.NVarChar(30), kod)
      .input("ad", sql.NVarChar(200), ad)
      .query(`UPDATE dbo.ADM_MOBIL_ERISIM SET CARI_KOD = @kod, CARI_AD = @ad
              WHERE FIRMA_ID = @firmaId AND CARI_KART_ID = @cariId AND (ISNULL(CARI_KOD, N'') <> ISNULL(@kod, N'') OR ISNULL(CARI_AD, N'') <> ISNULL(@ad, N''))`);
  }

  /**
   * Kullanıcının adı / e-postası / durumu. Pasiften aktife dönüşte aktif erişimlerinin her firması için sınır denetlenir;
   * biri doluysa hiçbir şey değişmez. Pasife alınınca açık oturumlar düşer.
   */
  public static async kullaniciGuncelle(
    mobilKullaniciId: number,
    v: { adSoyad: string | null; eposta: string | null; durum: MobilDurum }
  ): Promise<{ sonuc: "TAMAM" } | { sonuc: "LIMIT"; firmaId: number; limit: number; kullanilan: number }> {
    const res = await (await havuz())
      .request()
      .input("id", sql.Int, mobilKullaniciId)
      .input("adSoyad", sql.NVarChar(100), v.adSoyad)
      .input("eposta", sql.NVarChar(200), v.eposta)
      .input("durum", sql.VarChar(10), v.durum).query(`
      SET XACT_ABORT ON;
      BEGIN TRAN;
      DECLARE @eski varchar(10) = (SELECT DURUM FROM dbo.ADM_MOBIL_KULLANICI WITH (UPDLOCK) WHERE MOBIL_KULLANICI_ID = @id);
      IF @durum = 'AKTIF' AND @eski = 'PASIF'
      BEGIN
        DECLARE @dolu TABLE (FIRMA_ID int, L int, N int);
        INSERT INTO @dolu
        SELECT e.FIRMA_ID, ISNULL(mf.KULLANICI_LIMITI, 0),
               (SELECT COUNT(*) FROM dbo.ADM_MOBIL_ERISIM e2 WITH (UPDLOCK, HOLDLOCK)
                JOIN dbo.ADM_MOBIL_KULLANICI k2 ON k2.MOBIL_KULLANICI_ID = e2.MOBIL_KULLANICI_ID
                WHERE e2.FIRMA_ID = e.FIRMA_ID AND e2.DURUM = 'AKTIF' AND k2.DURUM = 'AKTIF')
        FROM dbo.ADM_MOBIL_ERISIM e LEFT JOIN dbo.ADM_MOBIL_FIRMA mf WITH (UPDLOCK, HOLDLOCK) ON mf.FIRMA_ID = e.FIRMA_ID
        WHERE e.MOBIL_KULLANICI_ID = @id AND e.DURUM = 'AKTIF';
        IF EXISTS (SELECT 1 FROM @dolu WHERE N + 1 > L)
        BEGIN
          ROLLBACK;
          SELECT TOP 1 'LIMIT' AS SONUC, FIRMA_ID, L, N FROM @dolu WHERE N + 1 > L;
          RETURN;
        END
      END
      UPDATE dbo.ADM_MOBIL_KULLANICI SET AD_SOYAD = @adSoyad, EPOSTA = @eposta, DURUM = @durum, GUNCELLEME_TARIHI = GETDATE()
      WHERE MOBIL_KULLANICI_ID = @id;
      IF @durum = 'PASIF'
        UPDATE dbo.ADM_MOBIL_OTURUM SET BITIS = GETDATE(), KAPANMA_NEDENI = 'PASIF' WHERE MOBIL_KULLANICI_ID = @id AND BITIS IS NULL;
      COMMIT;
      SELECT 'TAMAM' AS SONUC;`);
    const x = res.recordset[0];
    return x.SONUC === "LIMIT" ? { sonuc: "LIMIT", firmaId: x.FIRMA_ID, limit: x.L, kullanilan: x.N } : { sonuc: "TAMAM" };
  }

  /** Şifre sıfırlama (K9): yeni geçici şifre, ilk girişte değişmeli, kilit kalkar, açık oturumlar düşer */
  public static async sifreSifirla(mobilKullaniciId: number, sifreOzet: string): Promise<void> {
    await (await havuz()).request().input("id", sql.Int, mobilKullaniciId).input("ozet", sql.VarChar(100), sifreOzet).query(`
      UPDATE dbo.ADM_MOBIL_KULLANICI SET SIFRE_OZET = @ozet, SIFRE_DEGISMELI = 1, HATALI_DENEME = 0, KILIT_BITIS = NULL, GUNCELLEME_TARIHI = GETDATE()
      WHERE MOBIL_KULLANICI_ID = @id;
      UPDATE dbo.ADM_MOBIL_OTURUM SET BITIS = GETDATE(), KAPANMA_NEDENI = 'SIFRE_SIFIRLANDI' WHERE MOBIL_KULLANICI_ID = @id AND BITIS IS NULL;`);
  }

  public static async oturumlariKapat(mobilKullaniciId: number, neden: string): Promise<void> {
    await (await havuz())
      .request()
      .input("id", sql.Int, mobilKullaniciId)
      .input("neden", sql.VarChar(30), neden)
      .query(`UPDATE dbo.ADM_MOBIL_OTURUM SET BITIS = GETDATE(), KAPANMA_NEDENI = @neden WHERE MOBIL_KULLANICI_ID = @id AND BITIS IS NULL`);
  }

  // ------------------------------------------------------------------ Mobil giriş (Faz 3) ---

  /** Hatalı şifre: sayaç artar; esik'e ulaşınca hesap dakika kadar kilitlenir ve sayaç sıfırlanır. Kilitlendiyse true. */
  public static async hataliGiris(mobilKullaniciId: number, esik: number, dakika: number): Promise<boolean> {
    const r = await (await havuz())
      .request()
      .input("id", sql.Int, mobilKullaniciId)
      .input("esik", sql.Int, esik)
      .input("dk", sql.Int, dakika).query(`
        UPDATE dbo.ADM_MOBIL_KULLANICI
        SET HATALI_DENEME = CASE WHEN HATALI_DENEME + 1 >= @esik THEN 0 ELSE HATALI_DENEME + 1 END,
            KILIT_BITIS = CASE WHEN HATALI_DENEME + 1 >= @esik THEN DATEADD(MINUTE, @dk, GETDATE()) ELSE KILIT_BITIS END
        OUTPUT CAST(CASE WHEN inserted.KILIT_BITIS > GETDATE() THEN 1 ELSE 0 END AS BIT) AS KILITLI
        WHERE MOBIL_KULLANICI_ID = @id;`);
    return !!r.recordset[0]?.KILITLI;
  }

  public static async basariliGiris(mobilKullaniciId: number): Promise<void> {
    await (await havuz())
      .request()
      .input("id", sql.Int, mobilKullaniciId)
      .query(`UPDATE dbo.ADM_MOBIL_KULLANICI SET HATALI_DENEME = 0, KILIT_BITIS = NULL, SON_GIRIS = GETDATE() WHERE MOBIL_KULLANICI_ID = @id`);
  }

  public static async oturumAc(mobilKullaniciId: number, ip: string, tarayici: string): Promise<string> {
    const r = await (await havuz())
      .request()
      .input("id", sql.Int, mobilKullaniciId)
      .input("ip", sql.VarChar(64), ip)
      .input("tarayici", sql.NVarChar(400), tarayici).query(`
        DECLARE @sid uniqueidentifier = NEWID();
        INSERT INTO dbo.ADM_MOBIL_OTURUM (OTURUM_ID, MOBIL_KULLANICI_ID, IP, TARAYICI) VALUES (@sid, @id, @ip, @tarayici);
        SELECT CAST(@sid AS varchar(36)) AS SID;`);
    return String(r.recordset[0].SID).toLowerCase();
  }

  /**
   * Oturum açık ve kullanıcı aktif mi; açıksa son işlem zamanı (dakikada bir) yenilenir ve kullanıcı döner.
   */
  public static async gecerliOturum(sid: string, mobilKullaniciId: number): Promise<MobilKullaniciKaydi | null> {
    if (!/^[0-9a-f-]{36}$/i.test(sid)) return null;
    const r = await (await havuz())
      .request()
      .input("sid", sql.VarChar(36), sid)
      .input("id", sql.Int, mobilKullaniciId).query(`
        UPDATE dbo.ADM_MOBIL_OTURUM SET SON_ISLEM = GETDATE()
        WHERE OTURUM_ID = @sid AND MOBIL_KULLANICI_ID = @id AND BITIS IS NULL AND SON_ISLEM < DATEADD(MINUTE, -1, GETDATE());
        SELECT k.*, CAST(CASE WHEN k.KILIT_BITIS > GETDATE() THEN 1 ELSE 0 END AS BIT) AS KILITLI FROM dbo.ADM_MOBIL_OTURUM o
        JOIN dbo.ADM_MOBIL_KULLANICI k ON k.MOBIL_KULLANICI_ID = o.MOBIL_KULLANICI_ID
        WHERE o.OTURUM_ID = @sid AND o.MOBIL_KULLANICI_ID = @id AND o.BITIS IS NULL AND k.DURUM = 'AKTIF';`);
    const x = r.recordset[0];
    return x ? kullaniciKaydi(x) : null;
  }

  public static async oturumKapat(sid: string, neden: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(sid)) return;
    await (await havuz())
      .request()
      .input("sid", sql.VarChar(36), sid)
      .input("neden", sql.VarChar(30), neden)
      .query(`UPDATE dbo.ADM_MOBIL_OTURUM SET BITIS = GETDATE(), KAPANMA_NEDENI = @neden WHERE OTURUM_ID = @sid AND BITIS IS NULL`);
  }

  /** Kullanıcının kendi şifre değişimi: değişmeli işareti kalkar, bu oturum dışındakiler kapanır */
  public static async sifreDegistir(mobilKullaniciId: number, sifreOzet: string, koruSid: string): Promise<void> {
    await (await havuz())
      .request()
      .input("id", sql.Int, mobilKullaniciId)
      .input("ozet", sql.VarChar(100), sifreOzet)
      .input("sid", sql.VarChar(36), koruSid).query(`
        UPDATE dbo.ADM_MOBIL_KULLANICI SET SIFRE_OZET = @ozet, SIFRE_DEGISMELI = 0, GUNCELLEME_TARIHI = GETDATE() WHERE MOBIL_KULLANICI_ID = @id;
        UPDATE dbo.ADM_MOBIL_OTURUM SET BITIS = GETDATE(), KAPANMA_NEDENI = 'SIFRE_DEGISTI'
        WHERE MOBIL_KULLANICI_ID = @id AND BITIS IS NULL AND OTURUM_ID <> @sid;`);
  }
}
