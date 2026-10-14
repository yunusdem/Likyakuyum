import sql from "mssql";
import { gocDosyalari } from "../semaGoc.service.js";
import { UrunResimSqlRepository } from "../../models/urunResimSql.repository.js";
import { logger } from "../../utils/logger.js";

/**
 * Hızlı Satış şeması (docs/HIZLI_SATIS_YOL_HARITASI.md, Faz 1). Asıl yol göç 010'dur; göçü henüz almamış veritabanında
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
    const dosya = gocDosyalari().find((d) => d.no === 10);
    if (!dosya) throw new Error("Hızlı Satış şema dosyası (migrations/010_hizli_satis.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[HizliSatis] Tablolar kuruldu (göç 010 ilk kullanımda uygulandı).");
  }
  // Bekleyen sepetler (göç 011)
  const bekleyenYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_HIZLI_SATIS_BEKLEYEN','U') IS NULL THEN 1 ELSE 0 END AS E`)).recordset[0]?.E);
  if (bekleyenYok) {
    const dosya = gocDosyalari().find((d) => d.no === 11);
    if (!dosya) throw new Error("Hızlı Satış bekleyen sepet şema dosyası (migrations/011_hizli_satis_bekleyen.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[HizliSatis] Bekleyen sepet tablosu kuruldu (göç 011 ilk kullanımda uygulandı).");
  }
  hazir.add(pool);
}
