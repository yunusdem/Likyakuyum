// POS cihazı entegrasyonu (Inpos + Beko + Hugin) — docs/POS_ENTEGRASYON_YOL_HARITASI.md
export const ENTEGRASYONLAR = ["yok", "beko", "inpos", "hugin"];
export const MODELLER = { yok: [], beko: ["300TR", "X30TR", "400TR"], inpos: ["M530"], hugin: ["S1"] };
/** Fiş başına tek belge gönderen sürücüler: fişin bütün POS satırları + peşin kısmı birlikte gider (K35, Hugin K36) */
export const TOPLU_ENTEGRASYONLAR = ["inpos", "hugin"];
/** Cevapsız kalan işlem bu süreden sonra Belirsiz'e düşer; cihaz o zamana kadar meşgul sayılır. */
export const ZAMAN_ASIMI_SN = { test: 30, canli: 180 };
export const kurus = (tutar) => Math.round(tutar * 100);
