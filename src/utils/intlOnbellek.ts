/**
 * Intl biçimleyici önbelleği: toLocaleString her çağrıda yeni biçimleyici kurar, binlerce satırlık tabloda pahalıdır.
 * Seçenekler toLocaleString / toLocaleDateString'in varsayılanlarıyla birebir aynıdır (çıktı metni değişmez).
 */
const sayiBicimleri = new Map<string, Intl.NumberFormat>();

/** tr-TR sayı biçimleyicisi; `min` verilmezse yalnız en çok hane sınırı uygulanır. */
export const trSayiBicimi = (min: number | undefined, max: number): Intl.NumberFormat => {
  const a = `${min}|${max}`;
  let f = sayiBicimleri.get(a);
  if (!f) { f = new Intl.NumberFormat("tr-TR", min === undefined ? { maximumFractionDigits: max } : { minimumFractionDigits: min, maximumFractionDigits: max }); sayiBicimleri.set(a, f); }
  return f;
};

let tarih: Intl.DateTimeFormat | undefined, tarihSaat: Intl.DateTimeFormat | undefined;
/** `d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })` karşılığı. */
export const trTarihBicimi = () => (tarih ??= new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul" }));
/** `d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false })` karşılığı. */
export const trTarihSaatBicimi = () => (tarihSaat ??= new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour12: false, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }));
