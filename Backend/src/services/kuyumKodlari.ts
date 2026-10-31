/**
 * Kuyumculukla ilgili GİB KDV kodları (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF29–EF34). Bağımlılığı yok: ön yüz
 * (Sarraf fişi, Hızlı Satış, e-Banka "Belge kes" dürbünü) ve sunucu (fatura kurulumu) aynı listeyi kullanır.
 * Adlar Backend/src/models/ebelgeKod.repository.ts'deki GİB listesiyle aynıdır.
 *
 *  - 8xx özel matrah → fatura tipi ÖZELMATRAH; 2xx/3xx istisna → fatura tipi İSTİSNA.
 *  - Satır yapısı onaylı Kütükçü faturasındaki gibi: altın satırı KDV %0 + kod, işçilik ayrı satırda KDV'li.
 */

export type KuyumKodTuru = "OZELMATRAH" | "ISTISNA";

export interface KuyumKodu {
  kod: string;
  tur: KuyumKodTuru;
  ad: string;
}

export const KUYUM_KODLARI: KuyumKodu[] = [
  { kod: "805", tur: "OZELMATRAH", ad: "Altından mamul veya altın ihtiva eden ziynet eşyaları ile sikke altınların teslimi" },
  { kod: "808", tur: "OZELMATRAH", ad: "Gümüşten mamul veya gümüş ihtiva eden ziynet eşyaları ile sikke gümüşlerin teslimi" },
  { kod: "230", tur: "ISTISNA", ad: "17/4-g Külçe altın, külçe gümüş ve kıymetli taşların teslimi" },
  { kod: "231", tur: "ISTISNA", ad: "17/4-g Metal, plastik, lastik, kauçuk, kağıt, cam hurda ve atıkların teslimi" },
  { kod: "232", tur: "ISTISNA", ad: "17/4-g Döviz, para, damga pulu, değerli kağıtlar, hisse senedi ve tahvil teslimleri" },
  { kod: "301", tur: "ISTISNA", ad: "11/1-a Mal ihracatı" },
];

export const ALTIN_KODU = "805";
export const GUMUS_KODU = "808";

export const kuyumKoduBul = (kod: string | null | undefined): KuyumKodu | undefined => KUYUM_KODLARI.find((k) => k.kod === String(kod ?? "").trim());

/** Özel matrah kodu mu (801–812) */
export const ozelMatrahMi = (kod: string | null | undefined): boolean => /^8(0[1-9]|1[0-2])$/.test(String(kod ?? "").trim());

/**
 * Fiş kodu → satırın kodu: fiş kodu boş ya da 805 (ön değer) ise altın satırı 805, gümüş satırı 808 (ikisi birlikte
 * faturaya yazılır); kullanıcı başka bir kod seçtiyse tüm satırlara o.
 */
export const satirKodu = (fisKodu: string | null | undefined, gumus: boolean): string => {
  const k = String(fisKodu ?? "").trim();
  if (!k || k === ALTIN_KODU) return gumus ? GUMUS_KODU : ALTIN_KODU;
  return k;
};

/** Faturadaki kodlardan fatura tipi; özel matrah ve istisna kodu birlikteyse null (GİB tek tip ister) */
export const kuyumFaturaTipi = (kodlar: string[]): KuyumKodTuru | null => {
  const dolu = kodlar.map((k) => String(k ?? "").trim()).filter(Boolean);
  const om = dolu.some(ozelMatrahMi);
  const ist = dolu.some((k) => !ozelMatrahMi(k));
  if (om && ist) return null;
  return ist ? "ISTISNA" : "OZELMATRAH";
};

export const kuyumKodAdi = (kod: string | null | undefined): string => kuyumKoduBul(kod)?.ad ?? "";
