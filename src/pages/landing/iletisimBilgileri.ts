/**
 * Tanıtım sitesindeki iletişim bilgileri — tek yer (docs/ILETISIM_FORMU_YOL_HARITASI.md İ1, İ2).
 * Numara ya da adres değişince yalnız burası güncellenir.
 */
export const ILETISIM = {
  /** Ekranda gösterilen biçim */
  telefon: "+90 532 673 26 22",
  /** tel: bağlantısı için boşluksuz */
  telefonHam: "+905326732622",
  /** WhatsApp sohbet bağlantısı */
  whatsapp: "https://wa.me/905326732622",
  eposta: "info@likyakuyum.com",
} as const;

export const TEL_LINK = `tel:${ILETISIM.telefonHam}`;
export const MAIL_LINK = `mailto:${ILETISIM.eposta}`;
