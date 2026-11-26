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

/**
 * T15 (26.11.2026 denetimi): ilk kullanımda aynı anda gelen istekler şema kurulumunu bir kez çalıştırır; ötekiler sürmekte olan kurulumu
 * bekler (eskiden her istek göçü ayrı çalıştırıyor, eşzamanlı CREATE "zaten var" hatasıyla ilk istekleri düşürebiliyordu).
 */
const suren_ticariSemaHazirla = new WeakMap<sql.ConnectionPool, Promise<void>>();
export async function ticariSemaHazirla(pool: sql.ConnectionPool): Promise<void> {
  if (hazir.has(pool)) return;
  let p = suren_ticariSemaHazirla.get(pool);
  if (!p) { p = ticariSemaHazirlaKur(pool).finally(() => suren_ticariSemaHazirla.delete(pool)); suren_ticariSemaHazirla.set(pool, p); }
  return p;
}
async function ticariSemaHazirlaKur(pool: sql.ConnectionPool): Promise<void> {
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
  // Göç 040: terazi etiketli barkod (docs/TICARI_ADISYON_YOL_HARITASI.md, TA3)
  const teraziYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_TERAZI_BARKOD','U') IS NULL OR COL_LENGTH('dbo.TODVZ_STOK_KART','TERAZI_KODU') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (teraziYok) {
    const dosya = gocDosyalari().find((d) => d.no === 40);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/040_terazi_barkod.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Terazi barkodu tablosu / TERAZI_KODU kuruldu (göç 040 ilk kullanımda uygulandı).");
  }
  // Göç 041: koli / çoklu birim (TA5)
  const birimYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_STOK_BIRIM','U') IS NULL OR COL_LENGTH('dbo.TODVZ_STOK_BARKOD','STOK_BIRIM_ID') IS NULL OR OBJECT_ID('dbo.FK_TODVZ_STOK_BARKOD_BIRIM','F') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (birimYok) {
    const dosya = gocDosyalari().find((d) => d.no === 41);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/041_stok_birim.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Ek birim tablosu kuruldu (göç 041 ilk kullanımda uygulandı).");
  }
  // Göç 042: satış iadesi (TA6)
  const iadeYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_TICARI_IADE','U') IS NULL OR OBJECT_ID('dbo.TODVZ_TICARI_IADE_SATIR','U') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (iadeYok) {
    const dosya = gocDosyalari().find((d) => d.no === 42);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/042_ticari_iade.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Satış iadesi tabloları kuruldu (göç 042 ilk kullanımda uygulandı).");
  }
  // Göç 043: kasiyer vardiyası (TA8)
  const vardiyaYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_TICARI_VARDIYA','U') IS NULL OR OBJECT_ID('dbo.TODVZ_TICARI_VARDIYA_DUZELTME','U') IS NULL
    OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.TODVZ_TICARI_VARDIYA') AND name = 'UX_TODVZ_TICARI_VARDIYA_ACIK') THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (vardiyaYok) {
    const dosya = gocDosyalari().find((d) => d.no === 43);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/043_ticari_vardiya.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Vardiya tablosu kuruldu (göç 043 ilk kullanımda uygulandı).");
  }
  // Göç 044: sayım + fire fişi (TA11 / TA12)
  const sayimYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_STOK_SAYIM','U') IS NULL OR OBJECT_ID('dbo.TODVZ_STOK_SAYIM_SATIR','U') IS NULL
    OR OBJECT_ID('dbo.TODVZ_STOK_FIRE','U') IS NULL OR OBJECT_ID('dbo.TODVZ_STOK_FIRE_SATIR','U') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (sayimYok) {
    const dosya = gocDosyalari().find((d) => d.no === 44);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/044_ticari_sayim_fire.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Sayım ve fire tabloları kuruldu (göç 044 ilk kullanımda uygulandı).");
  }
  // Göç 045: tedarikçiye iade (TA13)
  const tedIadeYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_STOK_TEDARIKCI_IADE','U') IS NULL OR OBJECT_ID('dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR','U') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (tedIadeYok) {
    const dosya = gocDosyalari().find((d) => d.no === 45);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/045_ticari_tedarikci_iade.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Tedarikçiye iade tabloları kuruldu (göç 045 ilk kullanımda uygulandı).");
  }
  // Göç 046: gelen e-Faturadan stok girişi (TA14)
  const efYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_STOK_EFATURA_ALIM','U') IS NULL OR OBJECT_ID('dbo.TODVZ_STOK_EFATURA_ESLESME','U') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (efYok) {
    const dosya = gocDosyalari().find((d) => d.no === 46);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/046_ticari_efatura_giris.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] e-Fatura alım tabloları kuruldu (göç 046 ilk kullanımda uygulandı).");
  }
  // Göç 047: son kullanma tarihi (TA16)
  const sktYok = Number((await pool.request().query(`SELECT CASE WHEN COL_LENGTH('dbo.TODVZ_STOK_GIRIS_SATIRI','SKT') IS NULL OR COL_LENGTH('dbo.TODVZ_STOK_GIRIS_SATIRI','PARTI_NO') IS NULL
    OR COL_LENGTH('dbo.TODVZ_STOK_KART','SKT_TAKIBI') IS NULL OR INDEXPROPERTY(OBJECT_ID('dbo.TODVZ_STOK_GIRIS_SATIRI'), 'IX_TODVZ_STOK_GIRIS_SATIRI_SKT', 'IndexID') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (sktYok) {
    const dosya = gocDosyalari().find((d) => d.no === 47);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/047_ticari_skt.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] SKT kolonları kuruldu (göç 047 ilk kullanımda uygulandı).");
  }
  // Göç 048: parçalama fişi + şablon (TA17)
  const parYok = Number((await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_STOK_PARCALAMA','U') IS NULL OR OBJECT_ID('dbo.TODVZ_STOK_PARCALAMA_SATIR','U') IS NULL
    OR OBJECT_ID('dbo.TODVZ_STOK_PARCALAMA_SABLON','U') IS NULL OR OBJECT_ID('dbo.TODVZ_STOK_PARCALAMA_SABLON_SATIR','U') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (parYok) {
    const dosya = gocDosyalari().find((d) => d.no === 48);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/048_ticari_parcalama.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Parçalama tabloları kuruldu (göç 048 ilk kullanımda uygulandı).");
  }
  // Göç 049: reçeteli ürün (TA18)
  const recYok = Number((await pool.request().query(`SELECT CASE WHEN COL_LENGTH('dbo.TODVZ_STOK_KART','RECETELI') IS NULL OR OBJECT_ID('dbo.TODVZ_STOK_RECETE','U') IS NULL THEN 1 ELSE 0 END AS EKSIK`)).recordset[0]?.EKSIK);
  if (recYok) {
    const dosya = gocDosyalari().find((d) => d.no === 49);
    if (!dosya) throw new Error("Ticari şema dosyası (migrations/049_ticari_recete.sql) bulunamadı.");
    for (const b of dosya.batchler) await pool.request().batch(b);
    logger.info("[Ticari] Reçete tablosu kuruldu (göç 049 ilk kullanımda uygulandı).");
  }
  // Göç 050'nin stok kartı kolonu (Adisyon KDV oranı, TA32): kart sorguları onu okur; Adisyon şeması kurulmamış firmada da bulunsun
  await pool.request().query(`IF COL_LENGTH('dbo.TODVZ_STOK_KART','ADISYON_KDV_ORANI') IS NULL ALTER TABLE dbo.TODVZ_STOK_KART ADD ADISYON_KDV_ORANI DECIMAL(5,2) NULL;`);
  hazir.add(pool);
}
