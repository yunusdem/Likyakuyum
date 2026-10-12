import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ApiError } from "../../utils/ApiError.js";
import { BELGE_DIZINI } from "./belgeMotor.js";
import type { FisTuru } from "./belgeTurleri.js";
import type { BelgeSablon } from "./sablonCekirdek.js";

/**
 * Hazır örnek şablonlar (docs/FIS_TASARIM_YOL_HARITASI.md, K11 / Faz 7): `Backend/belge/ornek/{TUR}__{KOD}.json`.
 * Örnekteki logo / imza öğeleri görsel adı yerine `{LOGO}` / `{KASE}` taşır; uygulanırken firmanın ilk logo / imza
 * görseliyle değiştirilir, firmada o türde görsel yoksa öğe çıkarılır (şablon her firmada denetimden geçer).
 */
export const ORNEK_DIZINI = path.join(BELGE_DIZINI, "ornek");
const DOSYA = /^([A-Z0-9_]+)__([A-Z0-9_]+)\.json$/;

export interface OrnekSablon { kod: string; ad: string; aciklama: string }

export function ornekler(tur: FisTuru): OrnekSablon[] {
  if (!existsSync(ORNEK_DIZINI)) return [];
  return readdirSync(ORNEK_DIZINI).flatMap((f) => {
    const m = DOSYA.exec(f);
    if (!m || m[1] !== tur) return [];
    try {
      const j = JSON.parse(readFileSync(path.join(ORNEK_DIZINI, f), "utf8"));
      return [{ kod: m[2], ad: String(j.ad || m[2]), aciklama: String(j.aciklama || "") }];
    } catch { return []; }
  });
}

/** Örneği firmanın görselleriyle doldurur (denetlenmemiş; çağıran sablonDenetle'den geçirir). */
export function ornekUygula(tur: FisTuru, kod: string, gorseller: { ad: string; tur: "LOGO" | "IMZA" }[]): BelgeSablon {
  if (!/^[A-Z0-9_]{1,40}$/.test(kod)) throw ApiError.badRequest("Örnek kodu geçersiz.");
  const yol = path.join(ORNEK_DIZINI, `${tur}__${kod}.json`);
  if (!existsSync(yol)) throw ApiError.notFound("Örnek şablon bulunamadı.");
  const s: any = JSON.parse(readFileSync(yol, "utf8"));
  const logo = gorseller.find((g) => g.tur === "LOGO")?.ad;
  const kase = gorseller.find((g) => g.tur === "IMZA")?.ad;
  s.ogeler = (s.ogeler || []).flatMap((o: any) => {
    if (o.gorsel === "{LOGO}") return logo ? [{ ...o, gorsel: logo }] : [];
    if (o.gorsel === "{KASE}") return kase ? [{ ...o, gorsel: kase }] : [];
    return [o];
  });
  delete s.aciklama;
  return s as BelgeSablon;
}
