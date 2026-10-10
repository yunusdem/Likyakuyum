/**
 * Tanıtım sitesindeki iletişim bilgileri — tek yer (docs/ILETISIM_FORMU_YOL_HARITASI.md İ1, İ2).
 * Numara ya da adres değişince yalnız burası güncellenir.
 */
export const ILETISIM = {
  /** Ekranda gösterilen biçim (cep — WhatsApp da bu numara) */
  telefon: "+90 532 673 26 22",
  /** tel: bağlantısı için boşluksuz */
  telefonHam: "+905326732622",
  /** WhatsApp sohbet bağlantısı */
  whatsapp: "https://wa.me/905326732622",
  /** Sabit hat (yalnız arama; WhatsApp cep numarasında) */
  telefon2: "0252 635 82 05",
  telefon2Ham: "+902526358205",
  eposta: "info@likyakuyum.com",
  adres: "Hal Caddesi No: 101, Fethiye / Muğla",
} as const;

export const TEL_LINK = `tel:${ILETISIM.telefonHam}`;
export const TEL2_LINK = `tel:${ILETISIM.telefon2Ham}`;
export const MAIL_LINK = `mailto:${ILETISIM.eposta}`;
