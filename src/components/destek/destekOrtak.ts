/** Kullanıcı ve admin tarafının ortak, servis bağımsız destek yardımcıları (tipler, etiketler, zaman yazımı). */

export type KonuTuru = "TALEP" | "BILDIRIM" | "SISTEM";
export type TalepTuru = "HATA" | "ONERI" | "SORU" | "DIGER";
export type Oncelik = "NORMAL" | "ACIL";
export type KonuDurumu = "ACIK" | "CEVAPLANDI" | "KULLANICI_YANITLADI" | "KAPALI" | "TASLAK" | "GONDERILDI" | "GERI_CEKILDI";
export type BildirimTuru = "DUYURU" | "BAKIM" | "SURUM" | "UYARI";
export type BildirimHedefi = "TUMU" | "FIRMA" | "KULLANICI";
export type Taraf = "ADMIN" | "KULLANICI" | "SISTEM";
export type KullaniciSekmesi = "tumu" | "talepler" | "bildirimler" | "arsiv";

export interface EkGirdi {
  dosyaAdi: string;
  mime: string;
  /** base64 (data: öneki olmadan) */
  veri: string;
}

export interface EkDto {
  ekId: number;
  dosyaAdi: string;
  mime: string;
  boyut: number;
  silindi: boolean;
}

export interface MesajDto {
  mesajId: number;
  gonderenTur: Taraf;
  gonderenAd: string | null;
  adminId?: number | null;
  kullaniciId?: number | null;
  metin: string;
  icNot: boolean;
  tarih: string;
  ekler: EkDto[];
}

export interface KonuOzet {
  konuId: number;
  tur: KonuTuru;
  baslik: string;
  durum: KonuDurumu;
  talepTuru: TalepTuru | null;
  oncelik: Oncelik;
  ekran: string | null;
  bildirimTuru: BildirimTuru | null;
  onemli: boolean;
  cevapAlir: boolean;
  hedef: BildirimHedefi | null;
  surum: string | null;
  sistemOlay: string | null;
  kaynakKonuId: number | null;
  firmaId: number | null;
  firmaKodu: string | null;
  firmaUnvan: string | null;
  kullaniciId: number | null;
  kullaniciAdi: string | null;
  atananAdminId: number | null;
  atananAdmin: string | null;
  olusturmaTarihi: string;
  sonMesajTarihi: string;
  sonMesajTaraf: Taraf;
  gonderimTarihi: string | null;
  kapanisTarihi: string | null;
  sonMesaj: string | null;
  mesajSayisi: number;
  okunmamis: boolean;
  arsiv: boolean;
  onemliOkundu: boolean;
  hedefSayisi: number | null;
  /** exe: çevrimdışı kuyrukta, merkeze henüz gitmedi */
  bekliyor?: boolean;
}

export const TALEP_TURU_ADI: Record<TalepTuru, string> = { HATA: "Hata", ONERI: "Öneri", SORU: "Soru", DIGER: "Diğer" };
export const BILDIRIM_TURU_ADI: Record<BildirimTuru, string> = { DUYURU: "Duyuru", BAKIM: "Bakım", SURUM: "Sürüm", UYARI: "Uyarı" };
export const HEDEF_ADI: Record<BildirimHedefi, string> = { TUMU: "Tüm firmalar", FIRMA: "Seçili firmalar", KULLANICI: "Seçili kullanıcılar" };
export const DURUM_ADI: Record<KonuDurumu, string> = {
  ACIK: "Açık",
  CEVAPLANDI: "Cevaplandı",
  KULLANICI_YANITLADI: "Yanıtlandı",
  KAPALI: "Kapalı",
  TASLAK: "Taslak",
  GONDERILDI: "Gönderildi",
  GERI_CEKILDI: "Geri çekildi",
};
export const DURUM_RENGI: Record<KonuDurumu, string> = {
  ACIK: "primary",
  CEVAPLANDI: "success",
  KULLANICI_YANITLADI: "warning",
  KAPALI: "secondary",
  TASLAK: "secondary",
  GONDERILDI: "success",
  GERI_CEKILDI: "dark",
};
export const SISTEM_OLAY_ADI: Record<string, string> = {
  LISANS_30: "Lisans uyarısı",
  LISANS_7: "Lisans uyarısı",
  LISANS_BITTI: "Lisans bitti",
  FIRMA_DURUM: "Hesap durumu",
  OTURUM_KAPATILDI: "Oturum kapatıldı",
  GUNCELLEME_KURULDU: "Güncelleme",
  EBELGE_HATA: "e-Belge hatası",
};

export const EK_AZAMI_BAYT = 3 * 1024 * 1024;
export const EK_AZAMI_ADET = 3;
export const EK_TURLERI = ["image/png", "image/jpeg", "image/webp"];

const iki = (n: number) => String(n).padStart(2, "0");

export const zamanYaz = (z: string | null | undefined): string => {
  if (!z) return "-";
  const d = new Date(z);
  if (isNaN(d.getTime())) return z;
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()} ${iki(d.getHours())}:${iki(d.getMinutes())}`;
};

/** "az önce", "5 dk önce", "3 saat önce", "dün", "12.03.2026" */
export const zamanOnce = (z: string | null | undefined): string => {
  if (!z) return "";
  const d = new Date(z);
  if (isNaN(d.getTime())) return z;
  const fark = Math.max(0, Date.now() - d.getTime());
  const dk = Math.floor(fark / 60_000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} saat önce`;
  const gun = Math.floor(saat / 24);
  if (gun === 1) return "dün";
  if (gun < 7) return `${gun} gün önce`;
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/** Konunun liste etiketi: talepte tür, bildirimde bildirim türü, sistemde olay adı */
export const konuEtiketi = (k: KonuOzet): string => {
  if (k.tur === "TALEP") return k.talepTuru ? TALEP_TURU_ADI[k.talepTuru] : "Talep";
  if (k.tur === "BILDIRIM") return k.bildirimTuru ? BILDIRIM_TURU_ADI[k.bildirimTuru] : "Bildirim";
  return SISTEM_OLAY_ADI[k.sistemOlay || ""] || "Sistem";
};

export const ekDenetle = (dosyalar: File[], mevcut: number): string | null => {
  if (mevcut + dosyalar.length > EK_AZAMI_ADET) return `Bir mesaja en çok ${EK_AZAMI_ADET} görsel eklenebilir.`;
  for (const d of dosyalar) {
    if (!EK_TURLERI.includes(d.type)) return "Yalnız PNG, JPG ve WEBP görselleri eklenebilir.";
    if (d.size > EK_AZAMI_BAYT) return `${d.name}: görsel en çok 3 MB olabilir.`;
  }
  return null;
};
