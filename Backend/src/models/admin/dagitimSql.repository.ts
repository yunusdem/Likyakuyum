import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";

/**
 * ADM_DAGITIM: panelden başlatılan test / canlı dağıtımlarının kaydı (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md).
 * Tablo Backend/migrations-admin/001_dagitim.sql ile (ya da docs/sql/LIKYA_ADMIN_DAGITIM.sql ile elle) kurulur.
 */
export type DagitimHedef = "canli" | "test";
export type DagitimDurum = "CALISIYOR" | "BASARILI" | "HATA" | "GERI_DONDU" | "GERI_DONUS_HATASI";

export interface DagitimKaydi {
  dagitimId: number;
  hedef: DagitimHedef;
  oncekiCommit: string | null;
  hedefCommit: string | null;
  baslatanAdminId: number | null;
  baslatan: string | null;
  baslangic: Date;
  bitis: Date | null;
  durum: DagitimDurum;
  adim: string | null;
  mesaj: string | null;
  logDosyasi: string | null;
  goruldu: boolean;
}

const satir = (r: any): DagitimKaydi => ({
  dagitimId: Number(r.DAGITIM_ID),
  hedef: r.HEDEF,
  oncekiCommit: r.ONCEKI_COMMIT ?? null,
  hedefCommit: r.HEDEF_COMMIT ?? null,
  baslatanAdminId: r.BASLATAN_ADMIN_ID ?? null,
  baslatan: r.BASLATAN ?? null,
  baslangic: r.BASLANGIC,
  bitis: r.BITIS ?? null,
  durum: r.DURUM,
  adim: r.ADIM ?? null,
  mesaj: r.MESAJ ?? null,
  logDosyasi: r.LOG_DOSYASI ?? null,
  goruldu: !!r.GORULDU,
});

export class DagitimSqlRepository {
  public static async kuruluMu(): Promise<boolean> {
    const pool = await getAdminPool();
    const r = await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.ADM_DAGITIM') IS NULL THEN 0 ELSE 1 END AS V`);
    return r.recordset[0]?.V === 1;
  }

  public static async ekle(k: {
    hedef: DagitimHedef;
    hedefCommit: string | null;
    oncekiCommit: string | null;
    baslatanAdminId: number | null;
    baslatan: string | null;
    logDosyasi: string;
  }): Promise<number> {
    const pool = await getAdminPool();
    const r = await pool
      .request()
      .input("hedef", sql.VarChar(10), k.hedef)
      .input("hc", sql.VarChar(60), k.hedefCommit)
      .input("oc", sql.VarChar(60), k.oncekiCommit)
      .input("aid", sql.Int, k.baslatanAdminId)
      .input("ad", sql.NVarChar(120), k.baslatan)
      .input("log", sql.NVarChar(400), k.logDosyasi)
      .query(`INSERT INTO dbo.ADM_DAGITIM (HEDEF, ONCEKI_COMMIT, HEDEF_COMMIT, BASLATAN_ADMIN_ID, BASLATAN, DURUM, ADIM, LOG_DOSYASI)
              OUTPUT INSERTED.DAGITIM_ID VALUES (@hedef, @oc, @hc, @aid, @ad, 'CALISIYOR', N'Başlatılıyor', @log)`);
    return Number(r.recordset[0].DAGITIM_ID);
  }

  public static async ilerle(id: number, adim: string | null, mesaj: string | null): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("adim", sql.NVarChar(200), adim)
      .input("mesaj", sql.NVarChar(1000), mesaj)
      .query(`UPDATE dbo.ADM_DAGITIM SET ADIM = @adim, MESAJ = @mesaj WHERE DAGITIM_ID = @id AND DURUM = 'CALISIYOR'`);
  }

  public static async bitir(id: number, durum: DagitimDurum, mesaj: string | null, oncekiCommit: string | null, hedefCommit: string | null): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("durum", sql.VarChar(20), durum)
      .input("mesaj", sql.NVarChar(1000), mesaj)
      .input("oc", sql.VarChar(60), oncekiCommit)
      .input("hc", sql.VarChar(60), hedefCommit)
      .query(`UPDATE dbo.ADM_DAGITIM SET DURUM = @durum, MESAJ = @mesaj, BITIS = GETDATE(), ADIM = NULL,
                ONCEKI_COMMIT = ISNULL(@oc, ONCEKI_COMMIT), HEDEF_COMMIT = ISNULL(@hc, HEDEF_COMMIT)
              WHERE DAGITIM_ID = @id`);
  }

  public static async getir(id: number): Promise<DagitimKaydi | null> {
    const pool = await getAdminPool();
    const r = await pool.request().input("id", sql.Int, id).query(`SELECT * FROM dbo.ADM_DAGITIM WHERE DAGITIM_ID = @id`);
    return r.recordset[0] ? satir(r.recordset[0]) : null;
  }

  public static async calisan(): Promise<DagitimKaydi | null> {
    const pool = await getAdminPool();
    const r = await pool.request().query(`SELECT TOP 1 * FROM dbo.ADM_DAGITIM WHERE DURUM = 'CALISIYOR' ORDER BY DAGITIM_ID DESC`);
    return r.recordset[0] ? satir(r.recordset[0]) : null;
  }

  public static async gecmis(adet = 30): Promise<DagitimKaydi[]> {
    const pool = await getAdminPool();
    const r = await pool.request().input("n", sql.Int, adet).query(`SELECT TOP (@n) * FROM dbo.ADM_DAGITIM ORDER BY DAGITIM_ID DESC`);
    return r.recordset.map(satir);
  }

  /** Son hatalı ve henüz görülmemiş dağıtım (menüdeki kırmızı sayaç) */
  public static async gorulmemisHata(): Promise<number> {
    const pool = await getAdminPool();
    const r = await pool.request().query(`SELECT COUNT(*) AS N FROM dbo.ADM_DAGITIM WHERE GORULDU = 0 AND DURUM IN ('HATA','GERI_DONDU','GERI_DONUS_HATASI')`);
    return Number(r.recordset[0]?.N || 0);
  }

  public static async goruldu(): Promise<void> {
    const pool = await getAdminPool();
    await pool.request().query(`UPDATE dbo.ADM_DAGITIM SET GORULDU = 1 WHERE GORULDU = 0 AND DURUM <> 'CALISIYOR'`);
  }

  /** Son başarılı/geri dönmüş dağıtımın bıraktığı commit (hedef başına) */
  public static async sonBiten(hedef: DagitimHedef): Promise<DagitimKaydi | null> {
    const pool = await getAdminPool();
    const r = await pool
      .request()
      .input("hedef", sql.VarChar(10), hedef)
      .query(`SELECT TOP 1 * FROM dbo.ADM_DAGITIM WHERE HEDEF = @hedef AND DURUM <> 'CALISIYOR' ORDER BY DAGITIM_ID DESC`);
    return r.recordset[0] ? satir(r.recordset[0]) : null;
  }
}
