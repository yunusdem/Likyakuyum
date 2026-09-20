import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { ModulKaydi } from "../../types/admin.types.js";

const satirdan = (r: any): ModulKaydi => ({
  modulKodu: r.MODUL_KODU,
  ustKodu: r.UST_KODU ?? null,
  baslik: r.BASLIK,
  tur: r.TUR,
  sira: r.SIRA,
});

/** ADM_MODUL (menü ağacı kataloğu) ve ADM_FIRMA_MODUL (firma bazında açık/kapalı). */
export class ModulSqlRepository {
  public static async katalog(): Promise<ModulKaydi[]> {
    const pool = await getAdminPool();
    const res = await pool.request().query(`SELECT MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA FROM dbo.ADM_MODUL ORDER BY SIRA, MODUL_KODU`);
    return res.recordset.map(satirdan);
  }

  /**
   * Kataloğu verilen listeyle birebir eşitler (ekle / güncelle / listede olmayanı sil). Firma ayarlarındaki
   * satırlar silinmez: menüden kalkan bir kod geri gelirse firmanın eski tercihi korunur.
   */
  public static async katalogEsitle(moduller: ModulKaydi[]): Promise<{ eklenen: number; silinen: number }> {
    const pool = await getAdminPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const mevcut = new Set(
        (await new sql.Request(tx).query(`SELECT MODUL_KODU FROM dbo.ADM_MODUL WITH (UPDLOCK, HOLDLOCK)`)).recordset.map(
          (r: any) => r.MODUL_KODU as string
        )
      );
      let eklenen = 0;
      for (const m of moduller) {
        const req = new sql.Request(tx)
          .input("kod", sql.VarChar(100), m.modulKodu)
          .input("ust", sql.VarChar(100), m.ustKodu)
          .input("baslik", sql.NVarChar(200), m.baslik)
          .input("tur", sql.VarChar(15), m.tur)
          .input("sira", sql.Int, m.sira);
        if (mevcut.has(m.modulKodu)) {
          await req.query(`UPDATE dbo.ADM_MODUL SET UST_KODU = @ust, BASLIK = @baslik, TUR = @tur, SIRA = @sira WHERE MODUL_KODU = @kod`);
        } else {
          await req.query(`INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA) VALUES (@kod, @ust, @baslik, @tur, @sira)`);
          eklenen++;
        }
        mevcut.delete(m.modulKodu);
      }
      for (const kod of mevcut) {
        await new sql.Request(tx).input("kod", sql.VarChar(100), kod).query(`DELETE FROM dbo.ADM_MODUL WHERE MODUL_KODU = @kod`);
      }
      await tx.commit();
      return { eklenen, silinen: mevcut.size };
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  /**
   * Firmanın açık modül kodları. Firma için hiç satır yoksa null döner: modül ayarı hiç yapılmamış firma
   * kısıtsızdır (her şey açık). Ayar yapıldıktan sonra satırı olmayan (sonradan eklenen) modül kapalı sayılır.
   */
  public static async firmaAcikModulleri(firmaId: number): Promise<string[] | null> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("firmaId", sql.Int, firmaId)
      .query(`SELECT MODUL_KODU, ACIK FROM dbo.ADM_FIRMA_MODUL WHERE FIRMA_ID = @firmaId`);
    if (res.recordset.length === 0) return null;
    return res.recordset.filter((r: any) => !!r.ACIK).map((r: any) => r.MODUL_KODU as string);
  }

  /** Firmanın modül ayarını katalogdaki tüm kodlar için yazar: acikKodlar içindekiler açık, diğerleri kapalı. */
  public static async firmaModulleriniYaz(firmaId: number, acikKodlar: string[], adminId: number): Promise<void> {
    const pool = await getAdminPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // Açık kodlar geçici tabloya parametreyle yazılır (OPENJSON/STRING_SPLIT eski SQL Server sürümlerinde yok)
      await new sql.Request(tx).query(`CREATE TABLE #acik (MODUL_KODU VARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY)`);
      const kodlar = [...new Set(acikKodlar)];
      for (let i = 0; i < kodlar.length; i += 500) {
        const dilim = kodlar.slice(i, i + 500);
        const req = new sql.Request(tx);
        dilim.forEach((kod, j) => req.input(`k${j}`, sql.VarChar(100), kod));
        await req.query(`INSERT INTO #acik (MODUL_KODU) VALUES ${dilim.map((_, j) => `(@k${j})`).join(", ")}`);
      }
      await new sql.Request(tx).input("firmaId", sql.Int, firmaId).input("adminId", sql.Int, adminId).query(`
        MERGE dbo.ADM_FIRMA_MODUL WITH (HOLDLOCK) AS hedef
        USING (
          SELECT m.MODUL_KODU, CAST(CASE WHEN a.MODUL_KODU IS NULL THEN 0 ELSE 1 END AS BIT) AS ACIK
          FROM dbo.ADM_MODUL m
          LEFT JOIN #acik a ON a.MODUL_KODU = m.MODUL_KODU
        ) AS kaynak ON hedef.FIRMA_ID = @firmaId AND hedef.MODUL_KODU = kaynak.MODUL_KODU
        WHEN MATCHED AND hedef.ACIK <> kaynak.ACIK THEN
          UPDATE SET ACIK = kaynak.ACIK, DEGISTIREN_ADMIN_ID = @adminId, DEGISTIRME_TARIHI = GETDATE()
        WHEN NOT MATCHED BY TARGET THEN
          INSERT (FIRMA_ID, MODUL_KODU, ACIK, DEGISTIREN_ADMIN_ID) VALUES (@firmaId, kaynak.MODUL_KODU, kaynak.ACIK, @adminId);
        DROP TABLE #acik;
      `);
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  /** Modül ayarını tümüyle kaldırır: firma yeniden kısıtsız (her şey açık) olur. */
  public static async firmaModulleriniSifirla(firmaId: number): Promise<void> {
    const pool = await getAdminPool();
    await pool.request().input("firmaId", sql.Int, firmaId).query(`DELETE FROM dbo.ADM_FIRMA_MODUL WHERE FIRMA_ID = @firmaId`);
  }
}
