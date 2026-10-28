/** Destek ekibi paneli (destek.likyakuyum.com) tipleri — docs/DESTEK_PANELI_YOL_HARITASI.md */

export type PersonelRol = "ADMIN" | "PERSONEL";
export type PersonelGorme = "TUMU" | "ATANAN";
export type PersonelDurum = "AKTIF" | "PASIF";

/** Müşteriye giden destek mesajlarında görünen ad (D14). */
export const DESTEK_GORUNEN_AD = "Likya Destek";

/** Hatalı girişte hesap kilidi (D19): art arda bu kadar hatalı şifrede KILIT_DAKIKA boyunca giriş kapanır. */
export const KILIT_ESIGI = 5;
export const KILIT_DAKIKA = 15;

/** ADM_DESTEK_PERSONEL satırı (şifre özeti yalnız servis katmanında). */
export interface PersonelKayit {
  personelId: number;
  kullaniciAdi: string;
  adSoyad: string;
  sifreHash: string | null;
  sifreDegismeli: boolean;
  rol: PersonelRol;
  gorme: PersonelGorme;
  durum: PersonelDurum;
  adminId: number | null;
  hataliDeneme: number;
  kilitBitis: Date | null;
  sonGiris: Date | null;
  olusturmaTarihi: Date;
}

export type PersonelDto = Omit<PersonelKayit, "sifreHash" | "hataliDeneme" | "kilitBitis"> & { kilitli: boolean };

export interface PersonelJwtPayload {
  tur: "DESTEK";
  personelId: number;
  sid: string;
  iat?: number;
  exp?: number;
}

/** destekAuthenticate sonrası req.personel */
export interface PersonelBaglam {
  personelId: number;
  kullaniciAdi: string;
  adSoyad: string;
  rol: PersonelRol;
  gorme: PersonelGorme;
  adminId: number | null;
  sifreDegismeli: boolean;
  sid: string;
}

export type PanelSekme = "havuz" | "benim" | "tumu" | "sistem";

export interface PanelKonuFiltresi {
  sekme: PanelSekme;
  /** ACIK_HEPSI (kapalı olmayanlar) | HEPSI | tek durum */
  durum?: string;
  firmaId?: number;
  personelId?: number;
  /** Bir bildirime verilen yanıt talepleri */
  kaynakKonuId?: number;
  arama?: string;
  sayfa?: number;
  sayfaBoyu?: number;
}

export interface TelefonTalebiGirdi {
  firmaId: number;
  /** Firmanın merkez kullanıcısı; boşsa talebi firma yöneticileri görür */
  kullaniciId?: number | null;
  baslik: string;
  metin: string;
  talepTuru?: string;
  oncelik?: string;
}

export interface HizliCevap {
  cevapId: number;
  baslik: string;
  metin: string;
  sira: number;
  aktif: boolean;
}

export interface RaporSatiri {
  personelId: number;
  adSoyad: string;
  rol: PersonelRol;
  durum: PersonelDurum;
  /** Şu an üzerindeki kapalı olmayan talepler */
  acik: number;
  /** Tarih aralığında kapattığı talepler */
  kapanan: number;
  /** Tarih aralığında ilk cevabı verdiği talepler */
  ilkCevap: number;
  /** Bu taleplerde ortalama ilk cevap süresi (dakika) */
  ortIlkCevapDk: number | null;
  /** Tarih aralığında yazdığı (iç not olmayan) mesaj */
  mesaj: number;
}
