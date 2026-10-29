import sql from "mssql";
import { gocDosyalari } from "../semaGoc.service.js";
import { PerakendeSqlRepository } from "../../models/perakendeSql.repository.js";
import { logger } from "../../utils/logger.js";

/**
 * Ticari İşlemler şeması (docs/TICARI_ISLEMLER_YOL_HARITASI.md, Faz 1). Asıl yol göç 006'dır; göçü henüz almamış
 * veritabanında (ör. elle kurulan eski sunucu) ilk kullanımda aynı dosyanın batch'leri çalıştırılır — dosya tekrar
 * çalıştırılabilir. Perakende fiş tabloları yoksa önce Perakende deposu kurar (Ticari satış fişi onları kullanır).
 */
const hazir = new WeakSet<sql.ConnectionPool>();

const EKSIK_SORGUSU = `SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_STOK_KART','U') IS NULL OR OBJECT_ID('dbo.TODVZ_STOK_YETKI','U') IS NULL
  OR OBJECT_ID('dbo.TODVZ_STOK_GIRIS_SATIRI','U') IS NULL OR COL_LENGTH('dbo.TODVZ_FATURA','FIS_KAYNAGI') IS NULL
  OR COL_LENGTH('dbo.TODVZ_FATURA_SATIRI','SATIR_ISKONTO_TUTARI') IS NULL THEN 1 ELSE 0 END AS EKSIK`;

export async function ticariSemaHazirla(pool: sql.ConnectionPool): Promise<void> {
  if (hazir.has(pool)) return;
  await PerakendeSqlRepository.ensureTablesAndProcedures(pool);
  const eksik = Number((await pool.request().query(EKSIK_SORGUSU)).recordset[0]?.EKSIK);
  if (eksik) {
    const dosya = gocDosyalari().find((d) => d.no === 6);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/006_ticari_stok.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Stok tabloları kuruldu (göç 006 ilk kullanımda uygulandı).");
  }
  // Göç 017: kartta stok kontrol seçeneği (İş 9, G22)
  const kontrolYok = Number((await pool.request().query(`SELECT CASE WHEN COL_LENGTH('dbo.TODVZ_STOK_KART','STOK_KONTROL') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (kontrolYok) {
    const dosya = gocDosyalari().find((d) => d.no === 17);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/017_stok_kontrol.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] STOK_KONTROL kolonu eklendi (göç 017 ilk kullanımda uygulandı).");
  }
  // Göç 018: fiyat listeleri, tedarikçi, kampanya, fiyat geçmişi (İş 11)
  const fiyatYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_STOK_KAMPANYA_HEDEF','U') IS NULL OR COL_LENGTH('dbo.TODVZ_FATURA_SATIRI','KAMPANYA_ID') IS NULL OR COL_LENGTH('dbo.TODVZ_STOK_KART','TEDARIKCI_CARI_ID') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (fiyatYok) {
    const dosya = gocDosyalari().find((d) => d.no === 18);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/018_fiyat_listesi_kampanya.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Fiyat listesi / kampanya tabloları kuruldu (göç 018 ilk kullanımda uygulandı).");
  }
  hazir.add(pool);
}
