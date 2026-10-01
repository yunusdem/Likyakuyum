import sql from "mssql";
import { logger } from "../utils/logger.js";
import { VEZNE_HAREKET_KOLONLARI, belgeTablolari, vezneHareketleriSql } from "../services/rapor/kaynak.js";

/**
 * Vezne bakiye düzeltmeleri — anlık vezne bakiyesine belgesiz yapılan değişikliklerin kaydı (rapor denetimi 01.10.2026, canlı test):
 *  - KAYNAK 1: Vezne İzleme ekranından elle değiştirilen bakiye (yeni − eski fark; vezneIzlemeSql.repository.ts yazar).
 *  - KAYNAK 0: tablo ilk kurulurken anlık bakiye (TODVZ_VEZNE_BAKIYE) ile belgelerden hesaplanan bakiye arasındaki açılış farkı. Tarihi kurulduğu
 *    ayın bir önceki ayının son günüdür; içinde bulunulan ayın raporları devirden itibaren anlık bakiyeyle tutarlı başlar.
 * Raporlar bu kayıtları "Bakiye düzeltme" vezne hareketi olarak okur (kaynak.ts, belge 8): anlık bakiye = belgelerden hesaplanan bakiye.
 * MIKTAR işaretlidir: artı vezneye giriş, eksi çıkış. TARIH iş günüdür (saat yok).
 */
const kurulanlar = new Set<string>();

export class VezneBakiyeDuzeltmeSqlRepository {
  /** Tablo yoksa kurar ve açılış farkını bir kez yazar. Aynı veritabanı için süreç boyunca bir kez çalışır. */
  public static async ensure(pool: sql.ConnectionPool, anahtar = ""): Promise<void> {
    if (kurulanlar.has(anahtar)) return;
    const kurulu = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_VEZNE_BAKIYE_DUZELTME','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
    if (kurulu) { kurulanlar.add(anahtar); return; }
    if (!(await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_VEZNE_BAKIYE','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v) return;

    // Açılış farkı belgelerden hesaplanan bakiyeyle bulunur (düzeltmeler henüz yok)
    const d = { ...(await belgeTablolari(pool)), duzeltme: false };
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const yeni = (await new sql.Request(tx).query(`
        IF OBJECT_ID('dbo.TODVZ_VEZNE_BAKIYE_DUZELTME','U') IS NULL
        BEGIN
          CREATE TABLE dbo.TODVZ_VEZNE_BAKIYE_DUZELTME (
            VEZNE_BAKIYE_DUZELTME_ID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            VEZNE_ID INT NOT NULL,
            PARA_ID INT NOT NULL,
            MIKTAR FLOAT NOT NULL,
            ESKI_MIKTAR FLOAT NULL,
            YENI_MIKTAR FLOAT NULL,
            TARIH DATETIME NOT NULL,
            KAYNAK TINYINT NOT NULL,
            ACIKLAMA VARCHAR(200) NULL,
            EKLEYEN_ID INT NULL,
            EKLEME_ZAMANI DATETIME NOT NULL DEFAULT GETDATE()
          );
          SELECT 1 yeni;
        END
        ELSE SELECT 0 yeni;`)).recordset[0]?.yeni;
      if (yeni) {
        const r = await new sql.Request(tx).query(`
          ;WITH H (${VEZNE_HAREKET_KOLONLARI}) AS (${vezneHareketleriSql(d)}),
          BELGE AS (SELECT vezneId, paraId, SUM(giris - cikis) net FROM H WHERE vezneId IS NOT NULL AND paraId IS NOT NULL GROUP BY vezneId, paraId),
          ANLIK AS (SELECT VEZNE_ID vezneId, PARA_ID paraId, SUM(MIKTAR) miktar FROM dbo.TODVZ_VEZNE_BAKIYE GROUP BY VEZNE_ID, PARA_ID)
          INSERT INTO dbo.TODVZ_VEZNE_BAKIYE_DUZELTME (VEZNE_ID, PARA_ID, MIKTAR, ESKI_MIKTAR, YENI_MIKTAR, TARIH, KAYNAK, ACIKLAMA)
          SELECT COALESCE(A.vezneId, B.vezneId), COALESCE(A.paraId, B.paraId), ISNULL(A.miktar,0) - ISNULL(B.net,0), B.net, A.miktar,
            EOMONTH(CAST(DATEADD(hour, 3, GETUTCDATE()) AS date), -1), 0, 'Açılış farkı (belgesiz bakiye)'
          FROM ANLIK A FULL OUTER JOIN BELGE B ON B.vezneId = A.vezneId AND B.paraId = A.paraId
          WHERE ABS(ISNULL(A.miktar,0) - ISNULL(B.net,0)) >= 0.00005;
          SELECT @@ROWCOUNT n;`);
        logger.info(`Vezne bakiye düzeltme tablosu kuruldu; açılış farkı ${r.recordset?.[0]?.n ?? 0} vezne × para.`);
      }
      await tx.commit();
      kurulanlar.add(anahtar);
    } catch (e) {
      try { await tx.rollback(); } catch { /* yok */ }
      throw e;
    }
  }
}
