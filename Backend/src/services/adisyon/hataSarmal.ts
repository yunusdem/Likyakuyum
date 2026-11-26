import { NextFunction } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";

/**
 * Adisyon / garson / mutfak uçlarında beklenmeyen hata (Y15, 26.11.2026 denetimi): bozuk girdi (dizi yerine metin, Infinity …) TypeError
 * ile 500 dönüyor, SQL hatasının ham iletisi (tablo / kolon adlarıyla) garson telefonuna kadar gidiyordu.
 *   - ApiError olduğu gibi iletilir.
 *   - Benzersizlik / bağlı kayıt SQL hataları (2627, 2601, 547) ortak hata katmanına bırakılır (Türkçe iletiye çevirir).
 *   - TypeError / RangeError / SyntaxError: girdi biçimi hatası → 400.
 *   - Öteki (SQL zaman aşımı, kilitlenme kurbanı …): ayrıntı günlüğe, kullanıcıya düz ileti → 500 (1205 kilitlenmede "yeniden deneyin").
 */
export function adisyonHatasi(e: any, next: NextFunction, yer: string) {
  if (e instanceof ApiError || (e && typeof e.statusCode === "number")) return next(e);
  const no = Number(e?.number ?? e?.originalError?.info?.number);
  if ([2627, 2601, 547].includes(no)) return next(e);
  if (e instanceof TypeError || e instanceof RangeError || e instanceof SyntaxError) {
    logger.warn(`[Adisyon] ${yer}: girdi biçimi hatası: ${e?.message}`);
    return next(ApiError.badRequest("İstek biçimi hatalı (eksik ya da yanlış türde alan). Ekranı yenileyip yeniden deneyin."));
  }
  logger.error(`[Adisyon] ${yer}: beklenmeyen hata`, e);
  if (no === 1205) return next(ApiError.conflict("Aynı anda başka bir işlem yapıldı; işlem geri alındı. Yeniden deneyin."));
  return next(new ApiError(500, "İşlem yapılamadı; kayıt değişmedi. Yeniden deneyin, sürerse destekle görüşün."));
}
