/**
 * Gelen e-Fatura kalemi için saf yardımcılar (ön yüz de kullanır; XML ayrıştırıcıya bağlı değil). docs/TICARI_ADISYON_YOL_HARITASI.md, TA14.
 */

/** Ad eşleştirme anahtarı: küçük harf (tr), noktalama yok, tek boşluk */
export const adNormal = (ad: unknown): string =>
  String(ad ?? "").toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();

/** UBL birim kodu → kartın ana birimine çarpan (1 UBL birimi = çarpan × kart birimi); bilinmiyorsa null (kullanıcı yazar) */
export function birimCarpani(ublBirimKodu: string, kartBirimi: string): number | null {
  const u = String(ublBirimKodu || "").toUpperCase();
  const b = String(kartBirimi || "").toLocaleLowerCase("tr-TR");
  const adet = ["C62", "NIU", "EA", "H87", "PCE"];
  if (adet.includes(u)) return ["adet", "ad", "tane"].includes(b) ? 1 : null;
  if (u === "KGM") return b === "kg" ? 1 : b === "gr" ? 1000 : null;
  if (u === "GRM") return b === "gr" ? 1 : b === "kg" ? 0.001 : null;
  if (u === "LTR") return b === "lt" || b === "litre" ? 1 : b === "ml" ? 1000 : null;
  if (u === "MLT") return b === "ml" ? 1 : b === "lt" || b === "litre" ? 0.001 : null;
  if (u === "MTR") return b === "mt" || b === "metre" ? 1 : null;
  if (u === "MTK") return b === "m2" || b === "m²" ? 1 : null;
  return null;
}

