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
  /** Instagram hesabı (likyakuyum.com ve likyaerp.com ortak) */
  instagram: "https://www.instagram.com/likyaerp/",
} as const;

export const TEL_LINK = `tel:${ILETISIM.telefonHam}`;
export const TEL2_LINK = `tel:${ILETISIM.telefon2Ham}`;
export const MAIL_LINK = `mailto:${ILETISIM.eposta}`;

export interface DestekUyesi {
  ad: string;
  telefon: string;
  telefonHam: string;
  whatsapp: string;
}

/** Destek ekibi iletişim numaraları — likyakuyum.com ve likyaerp.com ortak */
export const DESTEK_EKIBI: DestekUyesi[] = [
  {
    ad: "Kubilay Biçici",
    telefon: "0534 384 43 90",
    telefonHam: "+905343844390",
    whatsapp: "https://wa.me/905343844390",
  },
  {
    ad: "Murat Kılıç",
    telefon: "0505 005 42 38",
    telefonHam: "+905050054238",
    whatsapp: "https://wa.me/905050054238",
  },
  {
    ad: "Serdar Çoban",
    telefon: "0533 615 07 87",
    telefonHam: "+905336150787",
    whatsapp: "https://wa.me/905336150787",
  },
  {
    ad: "Hazar Deniz Türkaslan",
    telefon: "0536 606 83 40",
    telefonHam: "+905366068340",
    whatsapp: "https://wa.me/905366068340",
  },
];

/** Referans işletmeler — likyakuyum.com ve likyaerp.com ortak */
export const REFERANSLAR: string[] = [
  "Vizyon Altın",
  "Demirtaş Kuyum",
  "Güray Sarrafiye",
  "Yaşar Kuyumculuk",
  "Barakat Kuyum",
  "Sebat Kuyum ve Mücevherat",
  "BSR Kuyumculuk",
];
