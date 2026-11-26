import sql from "mssql";
import { ApiError } from "../../utils/ApiError.js";

/**
 * Tek kullanımlık istek kimliği (TA39; 26.11.2026 denetimiyle yeniden düzenlendi). İstemci her işlem denemesine bir kimlik verir;
 * cevap kaybolup aynı kimlik yeniden gelirse işlem ikinci kez uygulanmaz.
 *
 * Kilit: eskiden olmayan anahtar `UPDLOCK, HOLDLOCK` ile okunuyordu. Bu, anahtar aralığını işlem sonuna kadar kilitler; kimlikler
 * zamanla artan biçimde üretildiğinde (güvenli olmayan bağlamdaki telefonlar) bütün yeni kimlikler aynı aralığa düşer ve uzun süren
 * tek bir tahsilat restorandaki ilgisiz bütün sipariş / ödeme isteklerini bekletir. Şimdi yalnız o kimliğe özel uygulama kilidi
 * alınır (işlem sahipli): aynı kimliğin iki isteği sıraya girer, farklı kimlikler birbirini beklemez.
 *
 * Kapsam: kayıt, işlemin türünü ve adisyonunu taşır; kimlik başka bir işlem / adisyon için yeniden kullanılırsa çağıran 409 verir
 * (sessizce "oldu" dönmez).
 */
export interface IstekKaydi { adisyonId?: number | null; tur?: string | null; [k: string]: unknown }

export const istekKimligiGecerli = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);

/** Kimliği kilitler ve varsa önceki kaydı döner (yoksa null). Geçersiz kimlik 400. */
export async function istekOku(tx: sql.Transaction, istekId: unknown): Promise<IstekKaydi | null> {
  if (!istekKimligiGecerli(istekId)) throw ApiError.badRequest("Geçersiz istek kimliği.");
  const k = await new sql.Request(tx).input("K", sql.NVarChar(255), `LIKYA_ADISYON_ISTEK_${istekId}`).query(`DECLARE @r INT;
    EXEC @r = sp_getapplock @Resource = @K, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 30000; SELECT @r AS R;`);
  if (Number(k.recordset[0]?.R) < 0) throw ApiError.conflict("Aynı istek hâlâ işleniyor; biraz sonra tekrar deneyin.");
  const r = await new sql.Request(tx).input("I", sql.VarChar(64), istekId).query(`SELECT SONUC FROM dbo.TODVZ_ADISYON_ISTEK WHERE ISTEK_KIMLIGI = @I`);
  if (!r.recordset.length) return null;
  try { const s = JSON.parse(String(r.recordset[0].SONUC || "{}")); return s && typeof s === "object" ? s : {}; } catch { return {}; }
}

export async function istekYaz(tx: sql.Transaction, istekId: string, kayit: IstekKaydi): Promise<void> {
  await new sql.Request(tx).input("I", sql.VarChar(64), istekId).input("S", sql.NVarChar(sql.MAX), JSON.stringify(kayit))
    .query(`INSERT INTO dbo.TODVZ_ADISYON_ISTEK (ISTEK_KIMLIGI, SONUC) VALUES (@I, @S)`);
}

/**
 * Masa işlemleri (ikram / iptal / ürün taşıma): kimlik verildiyse ve daha önce işlendiyse true (işlem atlanır); ilk kezse kayıt
 * yazılır ve false döner (işlem geri alınırsa kayıt da gider). Kimlik verilmediyse false (eski istemci: korumasız).
 */
export async function islemDahaOnceYapildiMi(tx: sql.Transaction, istekId: unknown, adisyonId: number, tur: string): Promise<boolean> {
  if (istekId === undefined || istekId === null || istekId === "") return false;
  const once = await istekOku(tx, istekId);
  if (once) {
    if (Number(once.adisyonId) !== Number(adisyonId) || once.tur !== tur) throw ApiError.conflict("Bu istek kimliği başka bir işlemde kullanılmış; ekranı yenileyip yeniden deneyin.");
    return true;
  }
  await istekYaz(tx, istekId as string, { adisyonId, tur });
  return false;
}
