/**
 * Firmanın düzenleyebildiği belge türleri (docs/FIS_TASARIM_YOL_HARITASI.md, K1).
 * Her tür için bizim varsayılan şablonumuz `Backend/belge/` altındadır; firma şablonu (Faz 3) yoksa bu kullanılır.
 * `grup`: aynı fişin kâğıt seçenekleri (önizlemede 80 mm / A4 düğmesi).
 */
export const FIS_TURLERI = {
  DOVIZ_FIS: { ad: "e-Döviz Fişi (80 mm termal)", grup: "DOVIZ", bicim: "80", varsayilan: "belge/DVZFIS_80.json" },
  SARRAF_FIS_80: { ad: "Sarraf Fişi (80 mm termal)", grup: "SARRAF", bicim: "80", varsayilan: "belge/SRFFIS_80.json" },
  SARRAF_FIS_A4: { ad: "Sarraf Fişi (A4)", grup: "SARRAF", bicim: "A4", varsayilan: "belge/SRFFIS_A4.json" },
  PERAKENDE_FIS_80: { ad: "Perakende Bilgi Fişi (80 mm termal)", grup: "PERAKENDE", bicim: "80", varsayilan: "belge/PRKFIS_80.json" },
  PERAKENDE_FIS_A4: { ad: "Perakende Fatura (A4)", grup: "PERAKENDE", bicim: "A4", varsayilan: "belge/PRKFIS_A4.json" },
  // e-Döviz belgesinin PDF'i (önizleme / indirme / arşiv; docs/belgeverapor.md) — Faz 6
  EDOVIZ_PDF_ALIS_A4: { ad: "e-Döviz Belgesi PDF — Alım (A4)", grup: "EDOVIZ_PDF", bicim: "A4", varsayilan: "belge/ALFIS1.json" },
  EDOVIZ_PDF_SATIS_A4: { ad: "e-Döviz Belgesi PDF — Satım (A4)", grup: "EDOVIZ_PDF", bicim: "A4", varsayilan: "belge/STFIS1.json" },
  EDOVIZ_PDF_ALIS_80: { ad: "e-Döviz Belgesi PDF — Alım (80 mm)", grup: "EDOVIZ_PDF", bicim: "80", varsayilan: "belge/ALFIS1_80.json" },
  EDOVIZ_PDF_SATIS_80: { ad: "e-Döviz Belgesi PDF — Satım (80 mm)", grup: "EDOVIZ_PDF", bicim: "80", varsayilan: "belge/STFIS1_80.json" },
} as const;

export type FisTuru = keyof typeof FIS_TURLERI;
export type FisBicimi = "80" | "A4";
export const FIS_TURU_KODLARI = Object.keys(FIS_TURLERI) as FisTuru[];

/** e-Döviz PDF şablon kodu (TODVZ_BELGE_SABLON.KOD) + biçim → firmanın düzenleyebildiği tür; başka kod → null. */
export function pdfTuru(kod: string, bicim: "a4" | "80" | undefined): FisTuru | null {
  const k = String(kod || "").toUpperCase();
  const seksen = bicim === "80";
  if (k === "ALFIS1") return seksen ? "EDOVIZ_PDF_ALIS_80" : "EDOVIZ_PDF_ALIS_A4";
  if (k === "STFIS1") return seksen ? "EDOVIZ_PDF_SATIS_80" : "EDOVIZ_PDF_SATIS_A4";
  return null;
}

/** Grup + kâğıt → tür (ör. SARRAF + A4 → SARRAF_FIS_A4). */
export function turBul(grup: "DOVIZ" | "SARRAF" | "PERAKENDE", bicim: FisBicimi): FisTuru {
  const tur = FIS_TURU_KODLARI.find(k => FIS_TURLERI[k].grup === grup && FIS_TURLERI[k].bicim === bicim)
    ?? FIS_TURU_KODLARI.find(k => FIS_TURLERI[k].grup === grup);
  return tur as FisTuru;
}
