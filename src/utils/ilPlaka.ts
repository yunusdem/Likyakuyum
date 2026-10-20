import { State } from "country-state-city";
import { normalizeTr } from "../components/common/CountryStateCitySelect";

const TR_ILLER = State.getStatesOfCountry("TR");

/**
 * İl kaydının plaka kodunu verir. TODVZ_TABLO_MADDESI'nde (TUR=3) KOD alanı yalnız
 * birkaç ilde dolu; boşsa il adı country-state-city listesiyle eşleştirilir (isoCode = plaka).
 */
export const ilPlakaKodu = (ad?: string | null, kod?: string | null): string => {
  const k = String(kod ?? "").trim();
  if (/^\d{1,2}$/.test(k)) return k.padStart(2, "0");
  const n = normalizeTr(ad).trim();
  if (!n) return "";
  const es = TR_ILLER.find((s) => normalizeTr(s.name).trim() === n);
  return es ? es.isoCode : "";
};

/** "34 - İSTANBUL" biçiminde gösterim; plaka bulunamazsa yalnız ad. */
export const ilPlakaliAd = (ad?: string | null, kod?: string | null): string => {
  const a = String(ad ?? "").trim();
  if (!a) return "";
  const p = ilPlakaKodu(a, kod);
  return p ? `${p} - ${a}` : a;
};
