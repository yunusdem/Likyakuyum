import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { LisansDto } from "../../types/admin.types.js";
import { gunYaz } from "./firmaSql.repository.js";
import { PaketSqlRepository } from "./paketSql.repository.js";
import { urunleriOku } from "../../services/admin/paketHesap.js";

const satirdan = (r: any): LisansDto => ({
  lisansId: r.LISANS_ID,
  firmaId: r.FIRMA_ID,
  lisansAnahtari: r.LISANS_ANAHTARI ?? null,
  baslangic: gunYaz(r.BASLANGIC),
  bitis: gunYaz(r.BITIS),
  kullaniciLimiti: r.KULLANICI_LIMITI,
  paketAdi: r.PAKET_ADI ?? null,
  notlar: r.NOTLAR ?? null,
  aktif: !!r.AKTIF,
  olusturanAdminId: r.OLUSTURAN_ADMIN_ID ?? null,
  olusturmaTarihi: r.OLUSTURMA_TARIHI,
  lisansKodu: r.LISANS_KODU ?? null,
  makineKimligi: r.MAKINE_KIMLIGI ?? null,
  seriNo: r.SERI_NO ?? null,
  iptal: !!r.IPTAL,
  teslim: r.TESLIM ?? null,
  teslimTarihi: r.TESLIM_TARIHI ?? null,
  urunler: urunleriOku(r.URUNLER),
  aktivasyonAnahtari: r.AKTIVASYON_ANAHTARI ?? null,
  aktivasyonTarihi: r.AKTIVASYON_TARIHI ?? null,
  aktivasyonMakine: r.AKTIVASYON_MAKINE ?? null,
});

// Aktivasyon anahtarı kolonları (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md 16, A7): sunucuda SSMS betiği çalışana kadar yok;
// yoksa NULL okunur, lisans ekranları bozulmaz. Var olduğu bir kez görülünce yeniden sorulmaz, yoksa dakikada bir sorulur.
let aktivasyonVar = false;
let aktivasyonDenetim = 0;
export const aktivasyonKolonlariVarMi = async (): Promise<boolean> => {
  if (aktivasyonVar) return true;
  if (Date.now() - aktivasyonDenetim < 60_000) return false;
  aktivasyonDenetim = Date.now();
  const pool = await getAdminPool();
  const r = (await pool.request().query(`SELECT CAST(CASE WHEN COL_LENGTH('dbo.ADM_LISANS', 'AKTIVASYON_MAKINE') IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS V`))
    .recordset[0];
  aktivasyonVar = !!r.V;
  return aktivasyonVar;
};

const aktivasyonKolonlari = async () =>
  (await aktivasyonKolonlariVarMi())
    ? "AKTIVASYON_ANAHTARI, AKTIVASYON_TARIHI, AKTIVASYON_MAKINE"
    : "CAST(NULL AS VARCHAR(30)) AS AKTIVASYON_ANAHTARI, CAST(NULL AS DATETIME) AS AKTIVASYON_TARIHI, CAST(NULL AS VARCHAR(40)) AS AKTIVASYON_MAKINE";

// URUNLER kolonu ürün paketi betiği çalıştırılınca gelir (docs/sql/LIKYA_ADMIN_URUN_PAKET.sql); yoksa NULL okunur
const secim = async () => `
  SELECT LISANS_ID, FIRMA_ID, LISANS_ANAHTARI, BASLANGIC, BITIS, KULLANICI_LIMITI, PAKET_ADI, NOTLAR, AKTIF,
         OLUSTURAN_ADMIN_ID, OLUSTURMA_TARIHI, LISANS_KODU, MAKINE_KIMLIGI, SERI_NO, IPTAL, TESLIM, TESLIM_TARIHI,
         ${await PaketSqlRepository.urunKolonu()}, ${await aktivasyonKolonlari()}
  FROM dbo.ADM_LISANS`;

export class LisansSqlRepository {
  public static async firmaLisanslari(firmaId: number): Promise<LisansDto[]> {
    const pool = await getAdminPool();
    const res = await pool.request().input("firmaId", sql.Int, firmaId).query(`${await secim()} WHERE FIRMA_ID = @firmaId ORDER BY LISANS_ID DESC`);
    return res.recordset.map(satirdan);
  }

  public static async getir(lisansId: number): Promise<LisansDto | null> {
    const pool = await getAdminPool();
    const res = await pool.request().input("id", sql.Int, lisansId).query(`${await secim()} WHERE LISANS_ID = @id`);
    return res.recordset[0] ? satirdan(res.recordset[0]) : null;
  }

  /** Lisans koduna imzalanacak seri: firmanın şimdiye kadarki en büyük serisinin bir fazlası. */
  public static async sonrakiSeri(firmaId: number): Promise<number> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("firmaId", sql.Int, firmaId)
      .query(`SELECT ISNULL(MAX(SERI_NO), 0) + 1 AS S FROM dbo.ADM_LISANS WITH (UPDLOCK, HOLDLOCK) WHERE FIRMA_ID = @firmaId`);
    return res.recordset[0].S;
  }

  public static async kodYaz(lisansId: number, kod: string, makine: string, seri: number): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, lisansId)
      // Kod açık modül listesini taşır; tüm ürünlü (ERP) lisansta 4000 karakteri aşar
      .input("kod", sql.VarChar(sql.MAX), kod)
      .input("makine", sql.VarChar(40), makine)
      .input("seri", sql.Int, seri)
      .query(`UPDATE dbo.ADM_LISANS SET LISANS_KODU = @kod, MAKINE_KIMLIGI = @makine, SERI_NO = @seri,
                     TESLIM = NULL, TESLIM_TARIHI = NULL WHERE LISANS_ID = @id`);
  }

  public static async iptalEt(lisansId: number, adminId: number): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, lisansId)
      .input("adminId", sql.Int, adminId)
      .query(`UPDATE dbo.ADM_LISANS SET IPTAL = 1, IPTAL_TARIHI = GETDATE(), IPTAL_EDEN_ADMIN_ID = @adminId WHERE LISANS_ID = @id`);
  }

  /** Kurulumun bildirimine dönülecek, bu makine için en son üretilmiş ve iptal edilmemiş kod. */
  public static async makineIcinSonKod(firmaId: number, makine: string): Promise<{ lisansId: number; kod: string; seri: number } | null> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("firmaId", sql.Int, firmaId)
      .input("makine", sql.VarChar(40), makine)
      .query(`SELECT TOP 1 LISANS_ID, LISANS_KODU, SERI_NO FROM dbo.ADM_LISANS
              WHERE FIRMA_ID = @firmaId AND MAKINE_KIMLIGI = @makine AND IPTAL = 0 AND LISANS_KODU IS NOT NULL
              ORDER BY SERI_NO DESC`);
    const r = res.recordset[0];
    return r ? { lisansId: r.LISANS_ID, kod: r.LISANS_KODU, seri: r.SERI_NO } : null;
  }

  /** Lisansa yeni aktivasyon anahtarı yazar; önceki anahtar ve kullanım bilgisi silinir (A4). */
  public static async aktivasyonAnahtariYaz(lisansId: number, anahtar: string): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, lisansId)
      .input("anahtar", sql.VarChar(30), anahtar)
      .query(`UPDATE dbo.ADM_LISANS SET AKTIVASYON_ANAHTARI = @anahtar, AKTIVASYON_TARIHI = NULL, AKTIVASYON_MAKINE = NULL WHERE LISANS_ID = @id`);
  }

  /** Firmanın bu anahtarı taşıyan lisansı (başka firmanın anahtarı bulunmaz). */
  public static async aktivasyonAnahtariIleBul(firmaId: number, anahtar: string): Promise<LisansDto | null> {
    if (!(await aktivasyonKolonlariVarMi())) return null;
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("firmaId", sql.Int, firmaId)
      .input("anahtar", sql.VarChar(30), anahtar)
      .query(`${await secim()} WHERE FIRMA_ID = @firmaId AND AKTIVASYON_ANAHTARI = @anahtar`);
    return res.recordset[0] ? satirdan(res.recordset[0]) : null;
  }

  /**
   * Anahtarı makineye bağlar: yalnız henüz kullanılmamışsa ya da aynı makineyle kullanılmışsa true (aynı anda iki makine
   * yazarsa biri kazanır). rowsAffected yerine OUTPUT: yerel deneme köprüsünde rowsAffected hep 0 geliyor.
   */
  public static async aktivasyonAnahtariKullan(lisansId: number, anahtar: string, makine: string): Promise<boolean> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("id", sql.Int, lisansId)
      .input("anahtar", sql.VarChar(30), anahtar)
      .input("makine", sql.VarChar(40), makine)
      .query(`UPDATE dbo.ADM_LISANS SET AKTIVASYON_TARIHI = ISNULL(AKTIVASYON_TARIHI, GETDATE()), AKTIVASYON_MAKINE = @makine
              OUTPUT inserted.LISANS_ID
              WHERE LISANS_ID = @id AND AKTIVASYON_ANAHTARI = @anahtar AND (AKTIVASYON_MAKINE IS NULL OR AKTIVASYON_MAKINE = @makine)`);
    return res.recordset.length > 0;
  }

  public static async teslimYaz(lisansId: number): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, lisansId)
      .query(`UPDATE dbo.ADM_LISANS SET TESLIM = 'HEARTBEAT', TESLIM_TARIHI = GETDATE() WHERE LISANS_ID = @id AND TESLIM IS NULL`);
  }

  /** Yeni lisans firmanın aktif lisansı olur; önceki lisans geçmiş olarak kalır (uzatma = yeni satır). */
  public static async ekle(veri: {
    firmaId: number;
    lisansAnahtari: string | null;
    baslangic: string;
    bitis: string;
    kullaniciLimiti: number;
    paketAdi: string | null;
    notlar: string | null;
    adminId: number;
  }): Promise<number> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("firmaId", sql.Int, veri.firmaId)
      .input("anahtar", sql.NVarChar(100), veri.lisansAnahtari)
      .input("baslangic", sql.Date, new Date(`${veri.baslangic}T00:00:00Z`))
      .input("bitis", sql.Date, new Date(`${veri.bitis}T00:00:00Z`))
      .input("limit", sql.Int, veri.kullaniciLimiti)
      .input("paket", sql.NVarChar(100), veri.paketAdi)
      .input("notlar", sql.NVarChar(1000), veri.notlar)
      .input("adminId", sql.Int, veri.adminId).query(`
        SET XACT_ABORT ON;
        BEGIN TRAN;
        UPDATE dbo.ADM_LISANS WITH (UPDLOCK, HOLDLOCK) SET AKTIF = 0 WHERE FIRMA_ID = @firmaId AND AKTIF = 1;
        INSERT INTO dbo.ADM_LISANS (FIRMA_ID, LISANS_ANAHTARI, BASLANGIC, BITIS, KULLANICI_LIMITI, PAKET_ADI, NOTLAR, AKTIF, OLUSTURAN_ADMIN_ID)
        VALUES (@firmaId, @anahtar, @baslangic, @bitis, @limit, @paket, @notlar, 1, @adminId);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS LISANS_ID;
        COMMIT;
      `);
    return res.recordset[0].LISANS_ID;
  }

  /** Pano: süresi dolmuş veya `gun` gün içinde dolacak aktif lisanslar (pasif firmalar hariç). */
  public static async bitenVeYaklasanlar(gun: number): Promise<
    { firmaId: number; firmaKodu: string; unvan: string; bitis: string; kalanGun: number }[]
  > {
    const pool = await getAdminPool();
    const res = await pool.request().input("gun", sql.Int, gun).query(`
      SELECT f.FIRMA_ID, f.FIRMA_KODU, f.UNVAN, l.BITIS, DATEDIFF(DAY, CAST(GETDATE() AS DATE), l.BITIS) AS KALAN_GUN
      FROM dbo.ADM_LISANS l
      INNER JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = l.FIRMA_ID
      WHERE l.AKTIF = 1 AND f.DURUM <> 'PASIF' AND DATEDIFF(DAY, CAST(GETDATE() AS DATE), l.BITIS) <= @gun
      ORDER BY l.BITIS
    `);
    return res.recordset.map((r: any) => ({
      firmaId: r.FIRMA_ID,
      firmaKodu: r.FIRMA_KODU,
      unvan: r.UNVAN,
      bitis: gunYaz(r.BITIS),
      kalanGun: r.KALAN_GUN,
    }));
  }

  public static async lisanssizFirmaSayisi(): Promise<number> {
    const pool = await getAdminPool();
    const res = await pool.request().query(`
      SELECT COUNT(*) AS N FROM dbo.ADM_FIRMA f
      WHERE f.DURUM <> 'PASIF' AND NOT EXISTS (SELECT 1 FROM dbo.ADM_LISANS l WHERE l.FIRMA_ID = f.FIRMA_ID AND l.AKTIF = 1)
    `);
    return res.recordset[0].N;
  }
}
