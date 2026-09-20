import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { KullaniciDurum, MerkezKullanici } from "../../types/admin.types.js";

const SECIM = `
  SELECT k.KULLANICI_ID, k.FIRMA_ID, f.FIRMA_KODU, f.UNVAN AS FIRMA_UNVAN, k.KULLANICI_ADI, k.AD_SOYAD, k.SIFRE_HASH,
         k.SIFRE_DEGISMELI, k.DURUM, k.FIRMA_YONETICISI, k.FIRMA_DB_KULLANICI_ID, k.SON_GIRIS, k.OLUSTURAN, k.OLUSTURMA_TARIHI
  FROM dbo.ADM_KULLANICI k
  INNER JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = k.FIRMA_ID
`;

const satirdan = (r: any): MerkezKullanici => ({
  kullaniciId: r.KULLANICI_ID,
  firmaId: r.FIRMA_ID,
  firmaKodu: r.FIRMA_KODU,
  firmaUnvan: r.FIRMA_UNVAN,
  kullaniciAdi: r.KULLANICI_ADI,
  adSoyad: r.AD_SOYAD ?? null,
  sifreHash: r.SIFRE_HASH,
  sifreDegismeli: !!r.SIFRE_DEGISMELI,
  durum: r.DURUM,
  firmaYoneticisi: !!r.FIRMA_YONETICISI,
  firmaDbKullaniciId: r.FIRMA_DB_KULLANICI_ID ?? null,
  sonGiris: r.SON_GIRIS ?? null,
  olusturan: r.OLUSTURAN ?? null,
  olusturmaTarihi: r.OLUSTURMA_TARIHI,
});

export type KullaniciEkleSonucu = { kullaniciId: number } | { hata: "LIMIT" | "LISANS_YOK" };

/** ADM_KULLANICI: firma kullanıcılarının merkezi hesapları. */
export class KullaniciSqlRepository {
  public static async firmaKullanicilari(firmaId: number): Promise<MerkezKullanici[]> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("firmaId", sql.Int, firmaId)
      .query(`${SECIM} WHERE k.FIRMA_ID = @firmaId ORDER BY k.KULLANICI_ADI`);
    return res.recordset.map(satirdan);
  }

  public static async tumu(): Promise<MerkezKullanici[]> {
    const pool = await getAdminPool();
    const res = await pool.request().query(`${SECIM} ORDER BY f.UNVAN, k.KULLANICI_ADI`);
    return res.recordset.map(satirdan);
  }

  public static async idIleBul(kullaniciId: number): Promise<MerkezKullanici | null> {
    const pool = await getAdminPool();
    const res = await pool.request().input("id", sql.Int, kullaniciId).query(`${SECIM} WHERE k.KULLANICI_ID = @id`);
    return res.recordset[0] ? satirdan(res.recordset[0]) : null;
  }

  public static async adIleBul(firmaId: number, kullaniciAdi: string): Promise<MerkezKullanici | null> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("firmaId", sql.Int, firmaId)
      .input("ad", sql.NVarChar(50), kullaniciAdi.trim())
      .query(`${SECIM} WHERE k.FIRMA_ID = @firmaId AND k.KULLANICI_ADI = @ad`);
    return res.recordset[0] ? satirdan(res.recordset[0]) : null;
  }

  /**
   * Yeni aktif kullanıcı ekler. limitUygula=true ise firmanın geçerli lisansındaki kullanıcı limiti,
   * sayım ile ekleme aynı kilit altında olacak şekilde denetlenir (eşzamanlı isteklerle aşılamaz).
   */
  public static async ekle(
    veri: {
      firmaId: number;
      kullaniciAdi: string;
      adSoyad: string | null;
      sifreHash: string;
      sifreDegismeli: boolean;
      firmaYoneticisi: boolean;
      firmaDbKullaniciId: number | null;
      olusturan: string;
    },
    limitUygula: boolean
  ): Promise<KullaniciEkleSonucu> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("firmaId", sql.Int, veri.firmaId)
      .input("ad", sql.NVarChar(50), veri.kullaniciAdi)
      .input("adSoyad", sql.NVarChar(100), veri.adSoyad)
      .input("hash", sql.VarChar(100), veri.sifreHash)
      .input("degismeli", sql.Bit, veri.sifreDegismeli)
      .input("yonetici", sql.Bit, veri.firmaYoneticisi)
      .input("dbId", sql.Int, veri.firmaDbKullaniciId)
      .input("olusturan", sql.NVarChar(100), veri.olusturan)
      .input("limitUygula", sql.Bit, limitUygula).query(`
        SET XACT_ABORT ON;
        BEGIN TRAN;
        DECLARE @limit INT, @aktif INT, @sonuc VARCHAR(12) = 'OK', @yeniId INT = NULL;
        SELECT @aktif = COUNT(*) FROM dbo.ADM_KULLANICI WITH (UPDLOCK, HOLDLOCK) WHERE FIRMA_ID = @firmaId AND DURUM = 'AKTIF';
        SELECT @limit = KULLANICI_LIMITI FROM dbo.ADM_LISANS WHERE FIRMA_ID = @firmaId AND AKTIF = 1;

        IF @limitUygula = 1 AND @limit IS NULL SET @sonuc = 'LISANS_YOK';
        ELSE IF @limitUygula = 1 AND @aktif >= @limit SET @sonuc = 'LIMIT';
        ELSE
        BEGIN
          INSERT INTO dbo.ADM_KULLANICI (FIRMA_ID, KULLANICI_ADI, AD_SOYAD, SIFRE_HASH, SIFRE_DEGISMELI, DURUM,
                                         FIRMA_YONETICISI, FIRMA_DB_KULLANICI_ID, OLUSTURAN)
          VALUES (@firmaId, @ad, @adSoyad, @hash, @degismeli, 'AKTIF', @yonetici, @dbId, @olusturan);
          SET @yeniId = CAST(SCOPE_IDENTITY() AS INT);
        END
        COMMIT;
        SELECT @sonuc AS SONUC, @yeniId AS KULLANICI_ID;
      `);
    const r = res.recordset[0];
    return r.SONUC === "OK" ? { kullaniciId: r.KULLANICI_ID } : { hata: r.SONUC };
  }

  /** Aktife alırken lisans limiti kilit altında denetlenir. */
  public static async durumDegistir(kullaniciId: number, durum: KullaniciDurum): Promise<"OK" | "LIMIT"> {
    const pool = await getAdminPool();
    const res = await pool.request().input("id", sql.Int, kullaniciId).input("durum", sql.VarChar(10), durum).query(`
      SET XACT_ABORT ON;
      BEGIN TRAN;
      DECLARE @firmaId INT, @mevcut VARCHAR(10), @limit INT, @aktif INT, @sonuc VARCHAR(10) = 'OK';
      SELECT @firmaId = FIRMA_ID, @mevcut = DURUM FROM dbo.ADM_KULLANICI WHERE KULLANICI_ID = @id;
      SELECT @aktif = COUNT(*) FROM dbo.ADM_KULLANICI WITH (UPDLOCK, HOLDLOCK) WHERE FIRMA_ID = @firmaId AND DURUM = 'AKTIF';
      SELECT @limit = KULLANICI_LIMITI FROM dbo.ADM_LISANS WHERE FIRMA_ID = @firmaId AND AKTIF = 1;

      IF @durum = 'AKTIF' AND @mevcut <> 'AKTIF' AND @limit IS NOT NULL AND @aktif >= @limit SET @sonuc = 'LIMIT';
      ELSE UPDATE dbo.ADM_KULLANICI SET DURUM = @durum WHERE KULLANICI_ID = @id;
      COMMIT;
      SELECT @sonuc AS SONUC;
    `);
    return res.recordset[0].SONUC;
  }

  public static async bilgiGuncelle(
    kullaniciId: number,
    veri: { adSoyad: string | null; firmaYoneticisi: boolean }
  ): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, kullaniciId)
      .input("adSoyad", sql.NVarChar(100), veri.adSoyad)
      .input("yonetici", sql.Bit, veri.firmaYoneticisi)
      .query(`UPDATE dbo.ADM_KULLANICI SET AD_SOYAD = @adSoyad, FIRMA_YONETICISI = @yonetici WHERE KULLANICI_ID = @id`);
  }

  public static async kullaniciAdiGuncelle(kullaniciId: number, kullaniciAdi: string): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, kullaniciId)
      .input("ad", sql.NVarChar(50), kullaniciAdi)
      .query(`UPDATE dbo.ADM_KULLANICI SET KULLANICI_ADI = @ad WHERE KULLANICI_ID = @id`);
  }

  public static async sifreGuncelle(kullaniciId: number, sifreHash: string, sifreDegismeli: boolean): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, kullaniciId)
      .input("hash", sql.VarChar(100), sifreHash)
      .input("degismeli", sql.Bit, sifreDegismeli)
      .query(`
        UPDATE dbo.ADM_KULLANICI SET SIFRE_HASH = @hash, SIFRE_DEGISMELI = @degismeli, HATALI_GIRIS_SAYISI = 0
        WHERE KULLANICI_ID = @id
      `);
  }

  public static async girisSonucuYaz(kullaniciId: number, basarili: boolean): Promise<void> {
    const pool = await getAdminPool();
    await pool.request().input("id", sql.Int, kullaniciId).input("basarili", sql.Bit, basarili).query(`
      UPDATE dbo.ADM_KULLANICI
      SET SON_GIRIS = CASE WHEN @basarili = 1 THEN GETDATE() ELSE SON_GIRIS END,
          HATALI_GIRIS_SAYISI = CASE WHEN @basarili = 1 THEN 0 ELSE HATALI_GIRIS_SAYISI + 1 END
      WHERE KULLANICI_ID = @id
    `);
  }
}
