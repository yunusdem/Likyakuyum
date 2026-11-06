import { apiClient } from "./apiClient";

/** Firma tarafı mobil tanımları — /api/v1/mobil-yonetim (docs/MOBIL_CARI_YOL_HARITASI.md, Faz 2) */

export interface MobilYetkiler {
  fiyat: boolean;
  bakiye: boolean;
  dokum: boolean;
  alis: boolean;
  satis: boolean;
}

export const YETKI_ADLARI: { key: keyof MobilYetkiler; ad: string; aciklama: string }[] = [
  { key: "fiyat", ad: "Fiyat görür", aciklama: "Firmanın seçtiği ürünlerin son fiyatı" },
  { key: "bakiye", ad: "Bakiye görür", aciklama: "Kendi bakiyesi ve limiti" },
  { key: "dokum", ad: "Hesap dökümü", aciklama: "Fişleri, hareketleri, dekontları, emanetleri" },
  { key: "alis", ad: "Alış emri", aciklama: "Cari alır (firma satar)" },
  { key: "satis", ad: "Satış emri", aciklama: "Cari satar (firma alır)" },
];

export interface MobilDurum {
  firmaId: number;
  unvan: string;
  musteriNo: string;
  kisaAd: string;
  kullaniciLimiti: number;
  kullanilan: number;
  girisAdresi: string;
  yonetici: boolean;
}

export interface MobilErisim {
  erisimId: number;
  mobilKullaniciId: number;
  musteriNo: string;
  kullaniciAdi: string;
  adSoyad: string | null;
  eposta: string | null;
  kullaniciDurum: "AKTIF" | "PASIF";
  sifreDegismeli: boolean;
  kilitBitis: string | null;
  kilitli: boolean;
  sonGiris: string | null;
  firmaId: number;
  firmaUnvan: string;
  dbName: string;
  cariKartId: number;
  cariKod: string | null;
  cariAd: string | null;
  yetkiler: MobilYetkiler;
  durum: "AKTIF" | "PASIF";
  olusturan: string | null;
  olusturmaTarihi: string;
  buFirma: boolean;
}

export interface MobilVeritabani {
  firmaId: number;
  unvan: string;
  dbName: string;
  buFirma: boolean;
  modulAcik: boolean;
  kullanilabilir: boolean;
}

export interface MobilCariKullanici {
  mobilKullaniciId: number;
  kullaniciAdi: string;
  adSoyad: string | null;
  eposta: string | null;
  durum: "AKTIF" | "PASIF";
  sifreDegismeli: boolean;
  kilitli: boolean;
  sonGiris: string | null;
  girisAdresi: string;
  erisimler: MobilErisim[];
}

export interface MobilCariOzet {
  cariKartId: number;
  kod: string;
  ad: string;
  eposta: string | null;
  telefon: string | null;
  vergiKimlikNo: string | null;
  bakiyeSiniri: number | null;
}

export interface MobilCariAyar {
  emirAcik: boolean | null;
  islemEnAzTl: number | null;
  islemEnCokTl: number | null;
  gunlukLimitTl: number | null;
  bakiyeSiniriUygula: boolean | null;
  calismaBaslangic: string | null;
  calismaBitis: string | null;
  fiyatGecerlilikSn: number | null;
}

export interface MobilCariBilgisi {
  cari: MobilCariOzet;
  durum: MobilDurum;
  kullanicilar: MobilCariKullanici[];
  onerilenKullaniciAdi: string;
  ayar: MobilCariAyar;
  veritabanlari: MobilVeritabani[];
}

export type OdemeTercihi = "BAKIYE" | "TESLIM" | "HAVALE" | "POS";
export const TERCIH_ADLARI: Record<OdemeTercihi, string> = {
  BAKIYE: "Cari hesabımdan",
  TESLIM: "Mağazada öderim / teslim alırım",
  HAVALE: "Havale / EFT",
  POS: "Kartla (POS)",
};

export interface MobilAyar {
  emirAcik: boolean;
  vezneId: number | null;
  kullaniciId: number | null;
  bildirimEposta: string[];
  fiyatGecerlilikSn: number;
  calismaBaslangic: string | null;
  calismaBitis: string | null;
  calismaGunleri: string;
  islemEnAzTl: number | null;
  islemEnCokTl: number | null;
  gunlukLimitTl: number | null;
  bakiyeSiniriUygula: boolean;
  tercihler: OdemeTercihi[];
}

export interface YeniKullaniciSonucu {
  mobilKullaniciId: number;
  erisimId: number;
  kullaniciAdi: string;
  geciciSifre: string;
  girisAdresi: string;
  paylasim: string;
}

export interface MobilParaUrunu {
  urunId: number;
  kod: string;
  ad: string;
  urunTipi: number | null;
  birim: number | null;
  secili: boolean;
  sira: number | null;
}

/** Mobil katalogdaki / aramada bulunan stok kartı (firma tarafı: bakiye görünür) */
export interface MobilKatalogKarti {
  stokKartId: number;
  kod: string;
  ad: string;
  grup: string | null;
  birim: string;
  /** KDV dahil (kartın ana fiyatı); fiyatsız kart mobilde satılamaz */
  fiyat: number | null;
  bakiye: number;
  aktif?: boolean;
}

export interface Makas {
  alisTip: "Y" | "T";
  alisDeger: number;
  satisTip: "Y" | "T";
  satisDeger: number;
}

export interface MakasSatiri {
  urunId: number;
  kod: string;
  ad: string;
  birim: string;
  liste: { alis: number | null; satis: number | null };
  makas: Makas;
  sonuc: { alis: number | null; satis: number | null };
}

export interface MakasTablosu {
  zaman: string | null;
  ondalik: number;
  satirlar: MakasSatiri[];
}

const veri = async <T,>(p: Promise<{ data: T }>): Promise<T> => (await p).data;

export const MobilYonetimService = {
  durum: () => veri(apiClient.get<MobilDurum>("/mobil-yonetim/durum")),
  kullanicilar: () =>
    veri(apiClient.get<{ durum: MobilDurum; erisimler: MobilErisim[]; veritabanlari: MobilVeritabani[] }>("/mobil-yonetim/kullanicilar")),
  cari: (cariKartId: number) => veri(apiClient.get<MobilCariBilgisi>(`/mobil-yonetim/cari/${cariKartId}`)),
  cariAyarYaz: (cariKartId: number, ayar: MobilCariAyar) => veri(apiClient.put<MobilCariAyar>(`/mobil-yonetim/cari/${cariKartId}/ayar`, ayar)),
  kullaniciEkle: (g: { cariKartId: number; kullaniciAdi: string; adSoyad?: string; eposta?: string; yetkiler: MobilYetkiler }) =>
    veri(apiClient.post<YeniKullaniciSonucu>("/mobil-yonetim/kullanicilar", g)),
  kullaniciGuncelle: (id: number, g: { adSoyad?: string | null; eposta?: string | null; durum?: "AKTIF" | "PASIF" }) =>
    veri(apiClient.put(`/mobil-yonetim/kullanicilar/${id}`, g)),
  sifreSifirla: (id: number) =>
    veri(apiClient.post<{ geciciSifre: string; girisAdresi: string; paylasim: string }>(`/mobil-yonetim/kullanicilar/${id}/sifre-sifirla`)),
  erisimEkle: (id: number, g: { firmaId: number; cariKartId: number; yetkiler: MobilYetkiler }) =>
    veri(apiClient.post<MobilErisim>(`/mobil-yonetim/kullanicilar/${id}/erisim`, g)),
  erisimGuncelle: (erisimId: number, g: { yetkiler?: MobilYetkiler; durum?: "AKTIF" | "PASIF" }) =>
    veri(apiClient.put<MobilErisim>(`/mobil-yonetim/erisim/${erisimId}`, g)),
  erisimSil: (erisimId: number) => veri(apiClient.delete(`/mobil-yonetim/erisim/${erisimId}`)),
  veritabaniCariAra: (firmaId: number, q: string) =>
    veri(apiClient.get<MobilCariOzet[]>(`/mobil-yonetim/veritabanlari/${firmaId}/cariler`, { q })),
  ayar: () => veri(apiClient.get<MobilAyar>("/mobil-yonetim/ayarlar")),
  ayarYaz: (a: MobilAyar) => veri(apiClient.put<MobilAyar>("/mobil-yonetim/ayarlar", a)),
  urunler: () => veri(apiClient.get<MobilParaUrunu[]>("/mobil-yonetim/urunler")),
  urunSecimiYaz: (urunIdleri: number[]) => veri(apiClient.put<MobilParaUrunu[]>("/mobil-yonetim/urunler", { urunIdleri })),
  katalog: () => veri(apiClient.get<MobilKatalogKarti[]>("/mobil-yonetim/katalog")),
  katalogAra: (q: string) => veri(apiClient.get<MobilKatalogKarti[]>("/mobil-yonetim/katalog/ara", { q })),
  katalogYaz: (stokKartIdleri: number[]) => veri(apiClient.put<MobilKatalogKarti[]>("/mobil-yonetim/katalog", { stokKartIdleri })),
  cariMakas: (cariKartId: number) => veri(apiClient.get<MakasTablosu>(`/mobil-yonetim/cari/${cariKartId}/makas`)),
  cariMakasYaz: (cariKartId: number, satirlar: ({ urunId: number } & Makas)[]) =>
    veri(apiClient.put<MakasTablosu>(`/mobil-yonetim/cari/${cariKartId}/makas`, { satirlar })),
};

// Veritabanı saatleri sürücüde UTC sayılır (duvar saati): UTC olarak yazılır (uygulamanın geri kalanı gibi)
export const tarihSaat = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("tr-TR", { timeZone: "UTC" }) : "-");

export const panoyaKopyala = async (metin: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(metin);
    return true;
  } catch {
    try {
      const t = document.createElement("textarea");
      t.value = metin;
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
};
