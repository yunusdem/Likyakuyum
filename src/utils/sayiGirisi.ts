/**
 * Elle yazılan sayıların tek ortak okuması (26.11.2026 denetimi: aynı yazım ekrana göre farklı sayı oluyordu;
 * "1.250" para kutusunda 1,25 TL okunuyordu).
 *
 * PARA: ekranlar tutarı "1.250,50" biçiminde gösterir; kullanıcı da öyle yazar.
 *   - virgül varsa: noktalar binlik ayracı, virgül ondalık ("1.250,50" = 1250,5)
 *   - virgül yoksa: "1.250" / "12.500.000" (üçer haneli gruplar) binliktir = 1250; "12.5" / "12.50" ondalıktır = 12,5
 *   - başka her şey (ör. "1.2.3", "1,2,3", "abc") geçersizdir (NaN): tahmin edilmez
 *
 * MİKTAR: tartı / adet. Nokta da virgül de ondalık ayracıdır ("1.5" = "1,5" = 1,5; "0.347" = 0,347); terazi ekranları nokta
 * gösterdiği için kasiyer öyle yazar. İkisi birlikteyse virgül ondalık, nokta binliktir ("1.250,5" = 1250,5).
 */
const duz = (v: unknown) => String(v ?? "").replace(/\s/g, "").replace(/₺|TL$/i, "");

export function paraOku(v: unknown): number {
  const s = duz(v);
  if (!s) return NaN;
  if (!/^-?[\d.,]+$/.test(s)) return NaN;
  const eksi = s.startsWith("-") ? -1 : 1;
  const t = s.replace(/^-/, "");
  if (t.includes(",")) {
    const [tam, ond, ...fazla] = t.split(",");
    if (fazla.length || !/^\d*$/.test(ond)) return NaN;
    if (tam.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(tam)) return NaN;
    if (!/^[\d.]*$/.test(tam) || (!tam && !ond)) return NaN;
    return eksi * Number(`${tam.replace(/\./g, "") || "0"}.${ond || "0"}`);
  }
  if (!t.includes(".")) return /^\d+$/.test(t) ? eksi * Number(t) : NaN;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return eksi * Number(t.replace(/\./g, "")); // 1.250 → 1250
  if (/^\d*\.\d{1,2}$/.test(t)) return eksi * Number(t.startsWith(".") ? `0${t}` : t); // 12.5 → 12,5
  return NaN;
}

export function miktarOku(v: unknown): number {
  const s = duz(v);
  if (!s || !/^-?[\d.,]+$/.test(s)) return NaN;
  const eksi = s.startsWith("-") ? -1 : 1;
  const t = s.replace(/^-/, "");
  if (t.includes(",")) {
    const [tam, ond, ...fazla] = t.split(",");
    if (fazla.length || !/^\d*$/.test(ond) || !/^[\d.]*$/.test(tam) || (!tam && !ond)) return NaN;
    if (tam.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(tam)) return NaN;
    return eksi * Number(`${tam.replace(/\./g, "") || "0"}.${ond || "0"}`);
  }
  if ((t.match(/\./g) || []).length > 1) return NaN;
  const n = Number(t.startsWith(".") ? `0${t}` : t.endsWith(".") ? t.slice(0, -1) : t);
  return Number.isFinite(n) ? eksi * n : NaN;
}

/** Boş kutu null, geçersiz yazım NaN (çağıran "geçersiz" ile "boş"u ayırabilsin) */
export const paraOkuBos = (v: unknown): number | null => (duz(v) ? paraOku(v) : null);
export const miktarOkuBos = (v: unknown): number | null => (duz(v) ? miktarOku(v) : null);
