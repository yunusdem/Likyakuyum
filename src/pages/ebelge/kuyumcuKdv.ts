import type { EbelgeFaturaTipi, EbelgeSatir } from "../../services/ebelgeService";

/**
 * Kuyumcu kalemlerinin KDV kuralı — resmi mevzuattan (docs/NACE_KDV_ANALIZ.md). KDV oranını NACE değil malın cinsi
 * belirler; GİB'in NACE kontrolü de bu oranların faaliyetle tutarlılığına bakar. Dayanaklar:
 *  - KDVK 17/4-g: külçe altın, külçe gümüş ve kıymetli taş (elmas, pırlanta, yakut, zümrüt, topaz, safir, zebercet,
 *    inci) teslimi istisna → UBL-TR istisna kodu 230.
 *  - KDVK 23/e + KDVGUT III/A-4.2.1: altından mamul / altın içeren ziynet eşyası ve sikke altın KDV'ye tabi; matrah
 *    = satış bedeli − has (külçe altın) bedeli (Borsa İstanbul son resmi işgünü kapanışı, ayar dikkate alınır)
 *    → özel matrah kodu 805. GİB özelgesi 05.08.2025 (995 milyem 24 ayar altın dahil).
 *  - Gümüşten mamul / gümüş içeren ziynet ve sikke gümüş → özel matrah kodu 808.
 *  - Bunlar dışındaki kuyumcu satışları (saat, imitasyon, işçilik, tamir): 2007/13033 BKK ekli (I) ve (II) sayılı
 *    listelerde yer almadığından genel oran %20.
 * Kod numaraları GİB UBL-TR Kod Listeleri V1.43 (27.07.2026) ile koordinat doğrulamalı olarak karşılaştırıldı.
 */
export interface KuyumcuKalemTuru {
  kod: "ALTIN_ZIYNET" | "GUMUS_ZIYNET" | "KULCE_KIYMETLI_TAS" | "GENEL";
  ad: string;
  aciklama: string;
  faturaTipi: EbelgeFaturaTipi;
  satir: Partial<EbelgeSatir>;
  dayanak: string;
}

export const KUYUMCU_KALEM_TURLERI: KuyumcuKalemTuru[] = [
  {
    kod: "ALTIN_ZIYNET",
    ad: "Altın ziynet / sikke altın",
    aciklama: "%20, özel matrah 805 — KDV matrahı: bedel − has altın bedeli",
    faturaTipi: "OZELMATRAH",
    satir: {
      kdvOrani: 20,
      birimKodu: "GRM",
      ozelMatrahKodu: "805",
      ozelMatrahGerekcesi: "Altından mamul veya altın içeren ziynet eşyaları ile sikke altınların teslimi",
    },
    dayanak: "KDVK 23/e, KDVGUT III/A-4.2.1",
  },
  {
    kod: "GUMUS_ZIYNET",
    ad: "Gümüş ziynet / sikke gümüş",
    aciklama: "%20, özel matrah 808 — KDV matrahı: bedel − has gümüş bedeli",
    faturaTipi: "OZELMATRAH",
    satir: {
      kdvOrani: 20,
      birimKodu: "GRM",
      ozelMatrahKodu: "808",
      ozelMatrahGerekcesi: "Gümüşten mamul veya gümüş içeren ziynet eşyaları ile sikke gümüşlerin teslimi",
    },
    dayanak: "UBL-TR Kod Listeleri, özel matrah 808",
  },
  {
    kod: "KULCE_KIYMETLI_TAS",
    ad: "Külçe altın / gümüş, kıymetli taş",
    aciklama: "%0, istisna 230 (KDVK 17/4-g)",
    faturaTipi: "ISTISNA",
    satir: {
      kdvOrani: 0,
      birimKodu: "GRM",
      istisnaKodu: "230",
      istisnaGerekcesi: "17/4-g Külçe altın, külçe gümüş ve kıymetli taşların teslimi",
    },
    dayanak: "KDVK 17/4-g, KDVGUT II/F-4.7.1",
  },
  {
    kod: "GENEL",
    ad: "Saat, imitasyon, işçilik, tamir",
    aciklama: "%20 genel oran",
    faturaTipi: "SATIS",
    satir: { kdvOrani: 20, birimKodu: "C62" },
    dayanak: "KDVK 28; I ve II sayılı listelerde yok",
  },
];

/** Kuyumculuk NACE kodlarında kullanılabilecek oranlar: yukarıdaki kalemlerin oranları (%0 yalnız istisna koduyla). */
export const KUYUMCU_IZINLI_ORANLAR = [...new Set(KUYUMCU_KALEM_TURLERI.map((k) => k.satir.kdvOrani || 0))]
  .filter((o) => o > 0)
  .sort((a, b) => a - b);

/**
 * Faturada bir arada bulunamayan kalem tipleri: özel matrahlı (OZELMATRAH) ile istisnalı (ISTISNA) satır aynı faturada
 * olamaz, fatura tipi tektir. Genel %20 satır özel matrahlı faturada olabilir (kodsuz satır), istisna faturasında olamaz.
 */
export const kalemFaturaTipiUyumlu = (mevcutTip: EbelgeFaturaTipi, kalem: KuyumcuKalemTuru): boolean => {
  if (kalem.faturaTipi === "SATIS") return mevcutTip === "SATIS" || mevcutTip === "OZELMATRAH";
  return mevcutTip === kalem.faturaTipi || mevcutTip === "SATIS";
};
