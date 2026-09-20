import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { AdminDurum, AdminKayit, AZAMI_AKTIF_ADMIN } from "../../types/admin.types.js";

const KOLONLAR = `ADMIN_ID, KULLANICI_ADI, AD_SOYAD, SIFRE_HASH, SIFRE_DEGISMELI, DURUM,
                  SON_GIRIS, OLUSTURAN_ADMIN_ID, OLUSTURMA_TARIHI`;

const satirdan = (r: any): AdminKayit => ({
  adminId: r.ADMIN_ID,
  kullaniciAdi: r.KULLANICI_ADI,
  adSoyad: r.AD_SOYAD,
  sifreHash: r.SIFRE_HASH,
  sifreDegismeli: !!r.SIFRE_DEGISMELI,
  durum: r.DURUM,
  sonGiris: r.SON_GIRIS ?? null,
  olusturanAdminId: r.OLUSTURAN_ADMIN_ID ?? null,
  olusturmaTarihi: r.OLUSTURMA_TARIHI,
});

/** SQL Server benzersiz anahtar ihlali (2627 / 2601) */
export const benzersizIhlalMi = (err: any): boolean => err?.number === 2627 || err?.number === 2601;

export type DurumSonucu = "OK" | "YOK" | "LIMIT" | "SON_AKTIF";

export class AdminSqlRepository {
  public static async listele(): Promise<AdminKayit[]> {
    const pool = await getAdminPool();
    const res = await pool.request().query(`SELECT ${KOLONLAR} FROM dbo.ADM_ADMIN ORDER BY ADMIN_ID`);
    return res.recordset.map(satirdan);
  }

  public static async idIleBul(adminId: number): Promise<AdminKayit | null> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("id", sql.Int, adminId)
      .query(`SELECT ${KOLONLAR} FROM dbo.ADM_ADMIN WHERE ADMIN_ID = @id`);
    return res.recordset[0] ? satirdan(res.recordset[0]) : null;
  }

  public static async kullaniciAdiIleBul(kullaniciAdi: string): Promise<AdminKayit | null> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("ad", sql.NVarChar(50), kullaniciAdi)
      .query(`SELECT ${KOLONLAR} FROM dbo.ADM_ADMIN WHERE KULLANICI_ADI = @ad`);
    return res.recordset[0] ? satirdan(res.recordset[0]) : null;
  }

  public static async sayilar(): Promise<{ toplam: number; aktif: number }> {
    const pool = await getAdminPool();
    const res = await pool.request().query(`
      SELECT COUNT(*) AS TOPLAM, SUM(CASE WHEN DURUM = 'AKTIF' THEN 1 ELSE 0 END) AS AKTIF FROM dbo.ADM_ADMIN
    `);
    return { toplam: res.recordset[0].TOPLAM || 0, aktif: res.recordset[0].AKTIF || 0 };
  }

  /**
   * Yeni aktif admin ekler. Aktif admin sayısı sınırdaysa ekleme yapmaz ve null döner;
   * sayım ile ekleme aynı ifadede ve kilit altında olduğundan eşzamanlı isteklerle sınır aşılamaz.
   */
  public static async ekle(veri: {
    kullaniciAdi: string;
    adSoyad: string;
    sifreHash: string;
    olusturanAdminId: number | null;
  }): Promise<number | null> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("ad", sql.NVarChar(50), veri.kullaniciAdi)
      .input("adSoyad", sql.NVarChar(100), veri.adSoyad)
      .input("hash", sql.VarChar(100), veri.sifreHash)
      .input("olusturan", sql.Int, veri.olusturanAdminId)
      .input("limit", sql.Int, AZAMI_AKTIF_ADMIN).query(`
        SET XACT_ABORT ON;
        BEGIN TRAN;
        INSERT INTO dbo.ADM_ADMIN (KULLANICI_ADI, AD_SOYAD, SIFRE_HASH, SIFRE_DEGISMELI, DURUM, OLUSTURAN_ADMIN_ID)
        SELECT @ad, @adSoyad, @hash, 1, 'AKTIF', @olusturan
        WHERE (SELECT COUNT(*) FROM dbo.ADM_ADMIN WITH (UPDLOCK, HOLDLOCK) WHERE DURUM = 'AKTIF') < @limit;
        SELECT CAST(CASE WHEN @@ROWCOUNT = 1 THEN SCOPE_IDENTITY() ELSE NULL END AS INT) AS ADMIN_ID;
        COMMIT;
      `);
    return res.recordset[0]?.ADMIN_ID ?? null;
  }

  public static async adSoyadGuncelle(adminId: number, adSoyad: string): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, adminId)
      .input("adSoyad", sql.NVarChar(100), adSoyad)
      .query(`UPDATE dbo.ADM_ADMIN SET AD_SOYAD = @adSoyad WHERE ADMIN_ID = @id`);
  }

  /** Durum değişimi: aktife alırken üst sınır, pasife alırken "son aktif admin" kuralı kilit altında denetlenir. */
  public static async durumDegistir(adminId: number, durum: AdminDurum): Promise<DurumSonucu> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("id", sql.Int, adminId)
      .input("durum", sql.VarChar(10), durum)
      .input("limit", sql.Int, AZAMI_AKTIF_ADMIN).query(`
        SET XACT_ABORT ON;
        BEGIN TRAN;
        DECLARE @mevcut VARCHAR(10), @aktif INT, @sonuc VARCHAR(10) = 'OK';
        SELECT @aktif = COUNT(*) FROM dbo.ADM_ADMIN WITH (UPDLOCK, HOLDLOCK) WHERE DURUM = 'AKTIF';
        SELECT @mevcut = DURUM FROM dbo.ADM_ADMIN WHERE ADMIN_ID = @id;

        IF @mevcut IS NULL SET @sonuc = 'YOK';
        ELSE IF @mevcut <> @durum
        BEGIN
          IF @durum = 'AKTIF' AND @aktif >= @limit SET @sonuc = 'LIMIT';
          ELSE IF @durum = 'PASIF' AND @aktif <= 1 SET @sonuc = 'SON_AKTIF';
          ELSE UPDATE dbo.ADM_ADMIN SET DURUM = @durum WHERE ADMIN_ID = @id;
        END
        COMMIT;
        SELECT @sonuc AS SONUC;
      `);
    return res.recordset[0].SONUC as DurumSonucu;
  }

  public static async sifreGuncelle(adminId: number, sifreHash: string, sifreDegismeli: boolean): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, adminId)
      .input("hash", sql.VarChar(100), sifreHash)
      .input("degismeli", sql.Bit, sifreDegismeli)
      .query(`UPDATE dbo.ADM_ADMIN SET SIFRE_HASH = @hash, SIFRE_DEGISMELI = @degismeli WHERE ADMIN_ID = @id`);
  }

  public static async sonGirisYaz(adminId: number): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, adminId)
      .query(`UPDATE dbo.ADM_ADMIN SET SON_GIRIS = GETDATE() WHERE ADMIN_ID = @id`);
  }
}
