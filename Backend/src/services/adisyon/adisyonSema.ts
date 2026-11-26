import sql from "mssql";
import { gocDosyalari } from "../semaGoc.service.js";
import { logger } from "../../utils/logger.js";

/**
 * Adisyon şeması (docs/TICARI_ADISYON_YOL_HARITASI.md, D1). Ticari şeması (stok kartları, satış fişi) önce kurulmuş olmalıdır
 * (AdisyonSqlRepository.havuz bunu TicariStokSqlRepository.havuz ile sağlar). Göç 050 deployda semaGoc ile uygulanır; almamış
 * veritabanında ilk kullanımda aynı dosyanın batch'leri çalıştırılır (tekrar çalıştırılabilir).
 */
const hazir = new WeakSet<sql.ConnectionPool>();

const EKSIK = `SELECT CASE WHEN COL_LENGTH('dbo.TODVZ_STOK_KART','ADISYON_KDV_ORANI') IS NULL OR COL_LENGTH('dbo.TODVZ_ADISYON_KALEM','EKLEYEN_AD') IS NULL
  OR COL_LENGTH('dbo.TODVZ_ADISYON_HAZIRLIK','EKRAN_ANAHTAR_OZET') IS NULL OR COL_LENGTH('dbo.TODVZ_ADISYON_MUTFAK_FIS','HATA') IS NULL OR COL_LENGTH('dbo.TODVZ_ADISYON_ODEME','VEZNE_ID') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_ODEME_SILINEN','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_OTURUM_IPTAL','U') IS NULL OR INDEXPROPERTY(OBJECT_ID('dbo.TODVZ_ADISYON'), 'IX_TODVZ_ADISYON_MUSTERI_TEL', 'IndexID') IS NULL OR COL_LENGTH('dbo.TODVZ_ADISYON','INDIRIM_TURU') IS NULL OR COL_LENGTH('dbo.TODVZ_ADISYON_KALEM','ILK_FIYAT') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_ODEME','U') IS NULL
  OR OBJECT_ID('dbo.TODVZ_ADISYON_AYAR','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_BOLGE','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_MASA','U') IS NULL
  OR OBJECT_ID('dbo.TODVZ_ADISYON_HAZIRLIK','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_GRUP_YER','U') IS NULL
  OR OBJECT_ID('dbo.TODVZ_ADISYON_SECENEK_GRUP','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_SECENEK','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_KART_SECENEK','U') IS NULL
  OR OBJECT_ID('dbo.TODVZ_ADISYON_PORSIYON','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_GARSON','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_CIHAZ','U') IS NOT NULL OR COL_LENGTH('dbo.TODVZ_ADISYON_GARSON','KULLANICI_ID') IS NULL
  OR COL_LENGTH('dbo.TODVZ_ADISYON_MASA','QR_ANAHTAR') IS NULL OR COL_LENGTH('dbo.TODVZ_ADISYON','MISAFIR_PIN') IS NULL OR INDEXPROPERTY(OBJECT_ID('dbo.TODVZ_ADISYON_GARSON'), 'UX_TODVZ_ADISYON_GARSON_KULLANICI', 'IndexID') IS NULL
  OR OBJECT_ID('dbo.TODVZ_ADISYON','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_KALEM','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_FIS','U') IS NULL
  OR OBJECT_ID('dbo.TODVZ_ADISYON_ISTEK','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_OLAY','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ADISYON_MUTFAK_FIS','U') IS NULL
  OR INDEXPROPERTY(OBJECT_ID('dbo.TODVZ_ADISYON'), 'UX_TODVZ_ADISYON_ACIK_MASA', 'IndexID') IS NULL THEN 1 ELSE 0 END AS EKSIK`;

/**
 * T15 (26.11.2026 denetimi): ilk kullanımda aynı anda gelen istekler şema kurulumunu bir kez çalıştırır; ötekiler sürmekte olan kurulumu
 * bekler (eskiden her istek göçü ayrı çalıştırıyor, eşzamanlı CREATE "zaten var" hatasıyla ilk istekleri düşürebiliyordu).
 */
const suren_adisyonSemaHazirla = new WeakMap<sql.ConnectionPool, Promise<void>>();
export async function adisyonSemaHazirla(pool: sql.ConnectionPool): Promise<void> {
  if (hazir.has(pool)) return;
  let p = suren_adisyonSemaHazirla.get(pool);
  if (!p) { p = adisyonSemaHazirlaKur(pool).finally(() => suren_adisyonSemaHazirla.delete(pool)); suren_adisyonSemaHazirla.set(pool, p); }
  return p;
}
async function adisyonSemaHazirlaKur(pool: sql.ConnectionPool): Promise<void> {
  if (hazir.has(pool)) return;
  const eksik = Number((await pool.request().query(EKSIK)).recordset[0]?.EKSIK);
  if (eksik) {
    const dosya = gocDosyalari().find((d) => d.no === 50);
    if (!dosya) throw new Error("Adisyon şema dosyası (migrations/050_adisyon.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Adisyon] Adisyon tabloları kuruldu (göç 050 ilk kullanımda uygulandı).");
  }
  hazir.add(pool);
}
