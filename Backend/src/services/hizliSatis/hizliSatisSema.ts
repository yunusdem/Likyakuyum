import sql from "mssql";
import { gocDosyalari } from "../semaGoc.service.js";
import { UrunResimSqlRepository } from "../../models/urunResimSql.repository.js";
import { logger } from "../../utils/logger.js";

/**
 * Hızlı Satış şeması (docs/HIZLI_SATIS_YOL_HARITASI.md, Faz 1). Asıl yol göç 008'dir; göçü henüz almamış veritabanında
 * ilk kullanımda aynı dosyanın batch'leri çalıştırılır (dosya tekrar çalıştırılabilir). Buton resimleri TODVZ_URUN_RESIM'de.
 */
const hazir = new WeakSet<sql.ConnectionPool>();

const EKSIK_SORGUSU = `SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_HIZLI_SATIS_SEKME','U') IS NULL OR OBJECT_ID('dbo.TODVZ_HIZLI_SATIS_BUTON','U') IS NULL
  OR OBJECT_ID('dbo.TODVZ_HIZLI_SATIS_AYAR','U') IS NULL OR OBJECT_ID('dbo.TODVZ_HIZLI_SATIS_YETKI','U') IS NULL
  OR OBJECT_ID('dbo.TODVZ_HIZLI_SATIS_FIS','U') IS NULL THEN 1 ELSE 0 END AS EKSIK`;

export async function hizliSatisSemaHazirla(pool: sql.ConnectionPool): Promise<void> {
  if (hazir.has(pool)) return;
  await UrunResimSqlRepository.ensureTables(pool);
  const eksik = Number((await pool.request().query(EKSIK_SORGUSU)).recordset[0]?.EKSIK);
  if (eksik) {
    const dosya = gocDosyalari().find((d) => d.no === 8);
    if (!dosya) throw new Error("Hızlı Satış şema dosyası (migrations/008_hizli_satis.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[HizliSatis] Tablolar kuruldu (göç 008 ilk kullanımda uygulandı).");
  }
  hazir.add(pool);
}
