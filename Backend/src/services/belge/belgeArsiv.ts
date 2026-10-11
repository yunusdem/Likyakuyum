import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BACKEND_KOK } from "./belgeMotor.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { klasorKopyala } from "../../utils/dosya.utils.js";
import type { DbContext } from "../../models/belgeSql.repository.js";
import { altKlasorAdiDenetle, dbKlasorAdi, firmaKlasoru, guvenliDosyaAdi, yilAy } from "../firmaKlasoru.js";

/**
 * Üretilen PDF'i firmanın klasörüne yazar (yönetici kararı 4: sunucuda saklanır,
 * aynı fiş yeniden üretilirse eskinin üzerine yazılır).
 *
 * Yer (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K6–K8): `{firma klasörü}\Belgeler\[şablon ARSIV_DIZINI]\{yıl}\{ay}\{BELGE_NO}.pdf`.
 * Şablonun `ARSIV_DIZINI` değeri de yalnızca alt klasör adı olarak kullanılır.
 */

/** Eski arşiv kökü: firma klasörü gelmeden önce PDF'ler buraya yazılıyordu. */
export const ESKI_ARSIV = path.join(BACKEND_KOK, "belge-arsiv");
const TASINDI_ISARETI = ".eski-arsiv-tasindi";

export async function belgeArsivYolu(p: {
  ctx?: DbContext;
  sablonAltKlasor?: string | null;
  tarih: string | Date | null | undefined;
  belgeNo: string;
}): Promise<string> {
  await eskiArsiviTasi(p.ctx);
  const alt = altKlasorAdiDenetle(p.sablonAltKlasor).ad;
  const [yil, ay] = yilAy(p.tarih);
  const klasor = await firmaKlasoru(p.ctx, "Belgeler", ...(alt ? [alt] : []), yil, ay);
  const guvenliNo = p.belgeNo.replace(/[^A-Za-z0-9_-]/g, "_") || "belge";
  return path.join(klasor, `${guvenliDosyaAdi(guvenliNo, "belge")}.pdf`);
}

const tasinanlar = new Set<string>();

/**
 * `Backend/belge-arsiv/{db}` altındaki eski PDF'ler firmanın `Belgeler` klasörüne bir kez kopyalanır
 * (silinmez, var olan dosyanın üzerine yazılmaz). Kopyalama bitince işaret dosyası bırakılır.
 */
export async function eskiArsiviTasi(ctx?: DbContext, eskiKok = ESKI_ARSIV): Promise<number> {
  const db = dbKlasorAdi(ctx?.dbName);
  if (tasinanlar.has(db)) return 0;
  const kaynak = path.join(eskiKok, db);
  let adet = 0;
  try {
    if (existsSync(kaynak) && statSync(kaynak).isDirectory()) {
      const hedef = await firmaKlasoru(ctx, "Belgeler");
      if (!existsSync(path.join(hedef, TASINDI_ISARETI))) {
        adet = klasorKopyala(kaynak, hedef, (ky) => statSync(ky).isDirectory() || !existsSync(path.join(hedef, path.relative(kaynak, ky))));
        writeFileSync(path.join(hedef, TASINDI_ISARETI), `${new Date().toISOString()} ${kaynak} → ${hedef} (${adet} dosya)\n`);
        logger.info(`Belge arşivi: eski klasörden ${adet} dosya firma klasörüne kopyalandı (${kaynak} → ${hedef}).`);
      }
    }
    tasinanlar.add(db);
  } catch (e: any) {
    logger.warn(`Belge arşivi: eski klasör taşınamadı (${kaynak}): ${e?.message || e}`);
  }
  return adet;
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
