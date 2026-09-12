import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BACKEND_KOK } from "./belgeMotor.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";

/**
 * Üretilen PDF'i sunucu arşivine yazar (yönetici kararı 4: sunucuda saklanır,
 * aynı fiş yeniden üretilirse eskinin üzerine yazılır).
 *
 * Dizin önceliği: şablon `ARSIV_DIZINI` → firma tanımı `BELGE_DIZINI` → `Backend/belge-arsiv`.
 * Alt yol: `{dbName}/{yıl}/{ay}/{BELGE_NO}.pdf`
 */
export const VARSAYILAN_ARSIV = path.join(BACKEND_KOK, "belge-arsiv");

export function arsivYolu(p: { kokDizin?: string | null; dbName?: string | null; tarih: string | Date | null | undefined; belgeNo: string }): string {
  const kok = (p.kokDizin || "").trim() || VARSAYILAN_ARSIV;
  const d = p.tarih ? new Date(p.tarih) : new Date();
  const g = Number.isNaN(d.getTime()) ? new Date() : d;
  const yil = String(g.getFullYear()), ay = String(g.getMonth() + 1).padStart(2, "0");
  const guvenliNo = p.belgeNo.replace(/[^A-Za-z0-9_-]/g, "_") || "belge";
  const db = (p.dbName || "varsayilan").replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(kok, db, yil, ay, `${guvenliNo}.pdf`);
}

export function arsivle(pdf: Buffer, yol: string): { yol: string; boyut: number } {
  try {
    mkdirSync(path.dirname(yol), { recursive: true });
    writeFileSync(yol, pdf); // varsa üzerine yazar
    return { yol, boyut: pdf.length };
  } catch (e: any) {
    logger.error("Belge arşivi yazılamadı:", { yol, hata: e?.message });
    throw ApiError.badRequest(`Belge arşive yazılamadı (${yol}): ${e?.code || e?.message || e}. Klasör yazma iznini kontrol edin.`);
  }
}
