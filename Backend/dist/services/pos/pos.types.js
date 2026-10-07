// POS cihazı entegrasyonu (Inpos + Beko) — docs/POS_ENTEGRASYON_YOL_HARITASI.md
export const ENTEGRASYONLAR = ["yok", "beko", "inpos"];
export const MODELLER = { yok: [], beko: ["300TR", "X30TR", "400TR"], inpos: ["M530"] };
/** Cevapsız kalan işlem bu süreden sonra Belirsiz'e düşer; cihaz o zamana kadar meşgul sayılır. */
export const ZAMAN_ASIMI_SN = { test: 30, canli: 180 };
export const kurus = (tutar) => Math.round(tutar * 100);
