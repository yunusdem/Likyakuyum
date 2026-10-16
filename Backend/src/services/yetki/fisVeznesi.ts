import sql from "mssql";
import { getDbPool } from "../../config/mssql.config.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * Fiş veznesi (docs/YETKI_VE_VEZNE_YOL_HARITASI.md, K2): fiş ekranlarında (Sarraf, Perakende, Döviz, Ticari satış / stok
 * giriş, Cari Hareket) vezne giriş yapan kullanıcının kasasıdır, istemciden seçilmez.
 * Yeni kayıtta kullanıcının kart veznesi (TODVZ_KULLANICI.VEZNE_ID), düzeltmede kaydın kendi veznesi; istekteki vezne
 * yok sayılır. Sistem yöneticisi için de aynıdır.
 */

type DbBaglam = { dbServer?: string; dbName?: string };

/** Kayıtlı fişin veznesinin okunduğu tablo ve kimlik kolonu */
export const FIS_TABLOLARI = {
  /** Perakende fişi ve Ticari satış fişi */
  fatura: ["TODVZ_FATURA", "FATURA_ID"],
  sarraf: ["TODVZ_SARRAF_FISI", "SARRAF_FISI_ID"],
  doviz: ["TODVZ_FIS", "FIS_ID"],
  stokGiris: ["TODVZ_STOK_GIRIS", "STOK_GIRIS_ID"],
  cariHareket: ["TODVZ_CARI_HAREKET", "CARI_HAREKET_ID"],
} as const;

export type FisTuru = keyof typeof FIS_TABLOLARI;

const pozitif = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Kullanıcının kart veznesi; kart yoksa ya da vezne tanımsızsa null */
export async function kullaniciKartVeznesi(kullaniciId: unknown, ctx?: DbBaglam): Promise<number | null> {
  const id = pozitif(kullaniciId);
  if (!id) return null;
  const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
  const r = await pool.request().input("K", sql.Int, id).query(`SELECT VEZNE_ID FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @K`);
  return pozitif(r.recordset[0]?.VEZNE_ID);
}

/** Kayıtlı fişin veznesi; kayıt yoksa null */
export async function kayitliFisVeznesi(tur: FisTuru, fisId: unknown, ctx?: DbBaglam): Promise<number | null> {
  const id = pozitif(fisId);
  if (!id) return null;
  const [tablo, kolon] = FIS_TABLOLARI[tur];
  const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
  const r = await pool.request().input("I", sql.Int, id).query(`SELECT VEZNE_ID FROM dbo.${tablo} WHERE ${kolon} = @I`);
  return pozitif(r.recordset[0]?.VEZNE_ID);
}

/**
 * Kaydedilecek fişin veznesi: fisId verilip kayıt bulunursa (düzeltme) kaydın veznesi, yoksa (yeni kayıt) kullanıcının
 * kart veznesi. Kartta vezne yoksa kayıt yapılmaz.
 */
export async function fisVeznesi(
  kullaniciId: unknown,
  ctx?: DbBaglam,
  duzeltilen?: { tur: FisTuru; id: unknown }
): Promise<number> {
  if (duzeltilen) {
    const kayit = await kayitliFisVeznesi(duzeltilen.tur, duzeltilen.id, ctx);
    if (kayit) return kayit;
  }
  const kart = await kullaniciKartVeznesi(kullaniciId, ctx);
  if (!kart) throw ApiError.badRequest("Kullanıcı kartınızda vezne tanımlı değil. Kullanıcı Tanımları'ndan veznenizi seçtirin.");
  return kart;
}
