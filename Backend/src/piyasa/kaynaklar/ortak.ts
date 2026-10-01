import type { FiyatGrubu, FiyatSatiri, GrupKodu, GrupTuru } from "../tipler.js";

/** Bir satır tanımı: [kaynak kodu, görünen ad, ortak kod?, alt ad?] */
export type SatirTanimi = [kod: string, ad: string, ortakKod?: string, altAd?: string];

export interface GrupTanimi {
  kod: GrupKodu;
  baslik: string;
  tur?: GrupTuru;
  satirlar: SatirTanimi[];
}

/** Tanım listesini, koda göre değer veren bir fonksiyonla gruplara çevirir (sıra tanımdaki gibi). */
export const gruplariKur = (
  tanimlar: GrupTanimi[],
  deger: (kod: string) => Omit<FiyatSatiri, "kod" | "ad" | "ortakKod" | "altAd"> | null,
): FiyatGrubu[] =>
  tanimlar.map((t) => ({
    kod: t.kod,
    baslik: t.baslik,
    tur: t.tur ?? "alis-satis",
    satirlar: t.satirlar.flatMap(([kod, ad, ortakKod, altAd]) => {
      const d = deger(kod);
      return d ? [{ kod, ad, ...(ortakKod ? { ortakKod } : {}), ...(altAd ? { altAd } : {}), ...d }] : [];
    }),
  }));

export const DOVIZ_ADLARI: Record<string, string> = {
  USD: "Amerikan Doları",
  EUR: "Euro",
  GBP: "İngiliz Sterlini",
  CHF: "İsviçre Frangı",
  AUD: "Avustralya Doları",
  CAD: "Kanada Doları",
  SAR: "Suudi Riyali",
  JPY: "Japon Yeni",
  KWD: "Kuveyt Dinarı",
  JOD: "Ürdün Dinarı",
  AED: "BAE Dirhemi",
  QAR: "Katar Riyali",
  DKK: "Danimarka Kronu",
  SEK: "İsveç Kronu",
  NOK: "Norveç Kronu",
  RUB: "Rus Rublesi",
  AZN: "Azerbaycan Manatı",
  CNY: "Çin Yuanı",
  RON: "Romanya Leyi",
  BGN: "Bulgar Levası",
  SGD: "Singapur Doları",
  SEPET: "Döviz Sepeti",
};
