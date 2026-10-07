/** Destek (talep), bildirim ve sistem olayı tipleri — docs/DESTEK_VE_BILDIRIM_YOL_HARITASI.md */

export type KonuTuru = "TALEP" | "BILDIRIM" | "SISTEM";
export type TalepTuru = "HATA" | "ONERI" | "SORU" | "DIGER";
export type Oncelik = "NORMAL" | "ACIL";
export type TalepDurumu = "ACIK" | "CEVAPLANDI" | "KULLANICI_YANITLADI" | "KAPALI";
export type BildirimDurumu = "TASLAK" | "GONDERILDI" | "GERI_CEKILDI";
export type KonuDurumu = TalepDurumu | BildirimDurumu;
export type BildirimTuru = "DUYURU" | "BAKIM" | "SURUM" | "UYARI";
export type BildirimHedefi = "TUMU" | "FIRMA" | "KULLANICI";
export type Taraf = "ADMIN" | "KULLANICI" | "SISTEM";
export type SistemOlay =
  | "LISANS_30"
  | "LISANS_7"
  | "LISANS_BITTI"
  | "FIRMA_DURUM"
  | "OTURUM_KAPATILDI"
  | "GUNCELLEME_KURULDU"
  | "EBELGE_HATA";
export type KullaniciSekmesi = "tumu" | "talepler" | "bildirimler" | "arsiv";

export const TALEP_TURLERI: TalepTuru[] = ["HATA", "ONERI", "SORU", "DIGER"];
export const BILDIRIM_TURLERI: BildirimTuru[] = ["DUYURU", "BAKIM", "SURUM", "UYARI"];
export const EK_MIME: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const EK_AZAMI_BAYT = 3 * 1024 * 1024;
export const EK_AZAMI_ADET = 3;
export const METIN_AZAMI = 4000;

/** İstek yapan kullanıcının merkezdeki karşılığı (bulut: sid → ADM_OTURUM; exe: başlıklardan). */
export interface DestekKimlik {
  firmaId: number;
  firmaKodu: string;
  firmaUnvan: string;
  /** ADM_KULLANICI; exe kullanıcılarında null (okuma durumu exe'de yerel tutulur) */
  kullaniciId: number | null;
  kullaniciAdi: string;
  adSoyad: string | null;
  yonetici: boolean;
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
  adminId: number | null;
  kullaniciId: number | null;
  metin: string;
  icNot: boolean;
  tarih: Date;
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
  sistemOlay: SistemOlay | null;
  kaynakKonuId: number | null;
  firmaId: number | null;
  firmaKodu: string | null;
  firmaUnvan: string | null;
  kullaniciId: number | null;
  kullaniciAdi: string | null;
  atananAdminId: number | null;
  atananAdmin: string | null;
  olusturmaTarihi: Date;
  sonMesajTarihi: Date;
  sonMesajTaraf: Taraf;
  gonderimTarihi: Date | null;
  kapanisTarihi: Date | null;
  sonMesaj: string | null;
  mesajSayisi: number;
  /** Karşı tarafın son mesajı okunmadı (okuma kaydı olan taraflar için) */
  okunmamis: boolean;
  arsiv: boolean;
  onemliOkundu: boolean;
  /** Karşı tarafın son (iç not olmayan) mesaj numarası; okuma kaydı için */
  karsiSonMesajId: number | null;
  /** Bildirim: kaç firmaya / kullanıcıya gitti (TUMU ise null) */
  hedefSayisi: number | null;
}

export interface KonuDetay {
  konu: KonuOzet;
  mesajlar: MesajDto[];
}

export interface EkGirdi {
  dosyaAdi: string;
  mime: string;
  /** base64 (data: öneki olmadan) */
  veri: string;
}

export interface TalepGirdi {
  baslik: string;
  metin: string;
  talepTuru?: TalepTuru;
  oncelik?: Oncelik;
  ekran?: string | null;
  ekler?: EkGirdi[];
  /** exe'den gelen tekil anahtar (çevrimdışı kuyruk tekrarı önlenir) */
  yerelAnahtar?: string | null;
}

export interface MesajGirdi {
  metin: string;
  ekler?: EkGirdi[];
  yerelAnahtar?: string | null;
}

export interface BildirimGirdi {
  baslik: string;
  metin: string;
  bildirimTuru: BildirimTuru;
  onemli: boolean;
  cevapAlir: boolean;
  hedef: BildirimHedefi;
  firmaIds?: number[];
  /** hedef=KULLANICI: ADM_KULLANICI id'leri */
  kullaniciIds?: number[];
  /** true: hemen gönder; false: taslak kaydet */
  gonder: boolean;
}

export interface KullaniciOzet {
  okunmamis: number;
  /** Okunmamış önemli bildirimler (girişte pencere) */
  onemli: KonuOzet[];
  kurulu: boolean;
}

export interface AdminOzet {
  /** Bu admin için okunmamış talep + sistem konusu */
  okunmamis: number;
  acikTalep: number;
  taslakBildirim: number;
  kurulu: boolean;
}

export interface AdminKonuFiltresi {
  tur?: KonuTuru | "TALEP_SISTEM";
  durum?: string;
  firmaId?: number;
  arama?: string;
  atananAdminId?: number;
  /** Bir bildirime verilen yanıt talepleri */
  kaynakKonuId?: number;
  sayfa?: number;
  sayfaBoyu?: number;
}

export interface SistemOlayGirdi {
  firmaId: number;
  olay: SistemOlay;
  baslik: string;
  metin: string;
  /** Doluysa aynı anahtarla ikinci konu açılmaz, mesaj mevcut konuya eklenir */
  anahtar?: string | null;
  onemli?: boolean;
}
