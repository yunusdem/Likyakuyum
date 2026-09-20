import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { LisansDto } from "../../types/admin.types.js";
import { gunYaz } from "./firmaSql.repository.js";

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
});

export class LisansSqlRepository {
  public static async firmaLisanslari(firmaId: number): Promise<LisansDto[]> {
    const pool = await getAdminPool();
    const res = await pool.request().input("firmaId", sql.Int, firmaId).query(`
      SELECT LISANS_ID, FIRMA_ID, LISANS_ANAHTARI, BASLANGIC, BITIS, KULLANICI_LIMITI, PAKET_ADI, NOTLAR, AKTIF,
             OLUSTURAN_ADMIN_ID, OLUSTURMA_TARIHI
      FROM dbo.ADM_LISANS WHERE FIRMA_ID = @firmaId ORDER BY LISANS_ID DESC
    `);
    return res.recordset.map(satirdan);
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
