import { ILETISIM } from "../../pages/landing/iletisimBilgileri";

/**
 * likyaerp.com şirket ve iletişim bilgileri — tek yer (docs/LIKYAERP_TANITIM_SITESI.md K9, K10).
 * Telefon / mail likyakuyum.com ile ortak dosyadan gelir; değişince yalnız iletisimBilgileri.ts güncellenir.
 */
export const SIRKET = {
  marka: "Likya ERP",
  /** Resmi unvan netleşince yazılır; KVKK ve gizlilik metinleri bunu kullanır */
  unvan: "",
  adres: "Kuyumcukent Plaza & Kapalıçarşı / İstanbul",
  telefon: ILETISIM.telefon,
  telefonHam: ILETISIM.telefonHam,
  whatsapp: ILETISIM.whatsapp,
  eposta: ILETISIM.eposta,
  site: "https://www.likyaerp.com",
  /** Likya.Kuyum'un kendi tanıtım sitesi */
  kuyumSitesi: "https://likyakuyum.com",
} as const;

export const TEL_LINK = `tel:${SIRKET.telefonHam}`;
export const MAIL_LINK = `mailto:${SIRKET.eposta}`;

/** Veri sorumlusu adı: unvan girilmemişse marka */
export const VERI_SORUMLUSU = SIRKET.unvan || SIRKET.marka;

/** K9: likyakuyum.com ile aynı rakamlar ve kullanıcı yorumları */
export const RAKAMLAR = [
  { deger: "15+ Yıl", etiket: "Sektörel tecrübe" },
  { deger: "%99,9", etiket: "Hizmet sürekliliği" },
  { deger: "6 Ürün", etiket: "Tek altyapı" },
  { deger: "%100", etiket: "GİB e-Belge uyumu" },
];

export const YORUMLAR = [
  {
    ad: "Ahmet Yıldırım",
    rol: "Mağaza Sahibi",
    firma: "Yıldırım Mücevherat · Kapalıçarşı",
    urun: "Likya.Kuyum",
    yorum:
      "Likya Kuyum'a geçtikten sonra vezne satış hızımız 3 katına çıktı. Hassas teraziden anında gram çekmesi ve F10 ile tek tuşla sessiz etiket basması sayesinde yoğun günlerde hata yapma riskimiz sıfıra indi.",
  },
  {
    ad: "Mehmet Demir",
    rol: "Genel Müdür",
    firma: "Demir Sarrafiye & Döviz · Kuyumcukent",
    urun: "Likya.Kuyum + Likya.Döviz",
    yorum:
      "Cari has altın emanet takibi ve 3065 sayılı özel matrah KDV faturası bizim için en kritik konuydu. Likya sayesinde e-faturalarımız saniyeler içinde GİB portalında onaylanıyor.",
  },
  {
    ad: "Serkan Aktaş",
    rol: "Şube Müdürü",
    firma: "Aktaş Gold & Diamond · İzmir Kemeraltı",
    urun: "Likya.Kuyum",
    yorum:
      "4K TV Canlı Vitrin Panosu mağazamıza inanılmaz prestij kattı. Müşteriler vitrindeki canlı Kapalıçarşı fiyatlarını izleyip güvenle alışveriş yapıyor, fiyatları kasadan değiştirdiğim an ekrana yansıyor.",
  },
];
