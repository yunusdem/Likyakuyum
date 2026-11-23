import sql from "mssql";
import { n, q } from "./aktarimSema.js";

/**
 * Aktarım kilidini açma (docs/VERITABANI_TASIMA_YOL_HARITASI.md §13, K25–K28 — 23.11.2026).
 *
 * Kilit açıkken canlı firma kilitleri (K22 gönderilmiş e-belge, K24 aktarımdan sonra kullanım) aktarımı durdurmaz ve aktarım firmayı
 * sıfırlar: yedekten kopyalanmayan her tablo şablondaki (ilk açılış) hâline döner. Durum firma veritabanında veritabanı düzeyi
 * genişletilmiş özellik olarak durur ("her veritabanına özel"); merkezde şema değişikliği gerekmez. Elle kapatılana kadar açık kalır.
 */

export const KILIT_OZELLIGI = "LKY_AKTARIM_KILIT";

export interface KilitBilgisi {
  /** Açan yönetici (kullanıcı adı) */
  acan: string;
  /** Açılış zamanı (ISO) */
  zaman: string;
  neden: string;
}

/** sp_addextendedproperty değeri en çok 7.500 bayt (nvarchar: 3.750 karakter); neden kısaltılır */
const NEDEN_SINIRI = 500;

/** Firmanın kilit bilgisi; kapalıysa null. Özellik var ama okunamıyorsa da açık sayılır (biri açmış). */
export const kilitOku = async (pool: sql.ConnectionPool | sql.Transaction, db: string): Promise<KilitBilgisi | null> => {
  const r = (await new sql.Request(pool as any).query(
    `SELECT CAST(value AS nvarchar(4000)) AS V FROM ${q(db)}.sys.extended_properties WHERE class = 0 AND name = ${n(KILIT_OZELLIGI)}`
  )).recordset as { V: string | null }[];
  if (!r.length) return null;
  try {
    const b = JSON.parse(String(r[0].V ?? ""));
    return { acan: String(b?.acan ?? ""), zaman: String(b?.zaman ?? ""), neden: String(b?.neden ?? "") };
  } catch {
    return { acan: "", zaman: "", neden: "(kilit bilgisi okunamadı)" };
  }
};

/** Kilidi açar (bilgiyi yazar / günceller). */
export const kilitYaz = async (pool: sql.ConnectionPool, db: string, bilgi: KilitBilgisi): Promise<void> => {
  const deger = JSON.stringify({ acan: bilgi.acan.slice(0, 100), zaman: bilgi.zaman, neden: bilgi.neden.slice(0, NEDEN_SINIRI) });
  await new sql.Request(pool)
    .input("ad", sql.NVarChar(128), KILIT_OZELLIGI)
    .input("deger", sql.NVarChar(3700), deger).query(`
      EXEC ${q(db)}.sys.sp_executesql N'
        IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE class = 0 AND name = @ad)
          EXEC sys.sp_updateextendedproperty @name = @ad, @value = @deger;
        ELSE
          EXEC sys.sp_addextendedproperty @name = @ad, @value = @deger;',
        N'@ad sysname, @deger nvarchar(3700)', @ad = @ad, @deger = @deger;`);
};

/** Kilidi kapatır (özellik yoksa bir şey yapmaz). */
export const kilitKaldir = async (pool: sql.ConnectionPool, db: string): Promise<void> => {
  await new sql.Request(pool).input("ad", sql.NVarChar(128), KILIT_OZELLIGI).query(`
    EXEC ${q(db)}.sys.sp_executesql N'
      IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE class = 0 AND name = @ad)
        EXEC sys.sp_dropextendedproperty @name = @ad;',
      N'@ad sysname', @ad = @ad;`);
};

/** Sıfırlamaya girmeyen (firma verisi sayılmayan) tablolar: bizim destek kanalının kuyruk / önbelleği */
export const sifirlanmazMi = (tablo: string): boolean => /^LKY_DESTEK_/i.test(tablo);
