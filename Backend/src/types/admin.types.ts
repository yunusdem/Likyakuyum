export type AdminDurum = "AKTIF" | "PASIF";

export const AZAMI_AKTIF_ADMIN = 3;

/** ADM_ADMIN satırı (SIFRE_HASH dahil — yalnızca servis katmanında kullanılır). */
export interface AdminKayit {
  adminId: number;
  kullaniciAdi: string;
  adSoyad: string;
  sifreHash: string;
  sifreDegismeli: boolean;
  durum: AdminDurum;
  sonGiris: Date | null;
  olusturanAdminId: number | null;
  olusturmaTarihi: Date;
}

/** İstemciye dönen admin bilgisi (hash yok). */
export type AdminDto = Omit<AdminKayit, "sifreHash">;

export interface AdminJwtPayload {
  tur: "ADMIN";
  adminId: number;
  kullaniciAdi: string;
  sid: string;
  iat?: number;
  exp?: number;
}

/** adminAuthenticate sonrası req.admin */
export interface AdminBaglam {
  adminId: number;
  kullaniciAdi: string;
  adSoyad: string;
  sid: string;
  sifreDegismeli: boolean;
}

export type AdminIslem =
  | "ADMIN_EKLENDI"
  | "ADMIN_GUNCELLENDI"
  | "ADMIN_DURUM"
  | "ADMIN_SIFRE_SIFIRLANDI"
  | "ADMIN_SIFRE_DEGISTI"
  | "FIRMA_EKLENDI"
  | "FIRMA_GUNCELLENDI"
  | "FIRMA_DURUM"
  | "FIRMA_DOGRULAMA"
  | "FIRMA_DB_SIFRE_DEGISTI"
  | "LISANS_EKLENDI"
  | "KULLANICI_ACILDI"
  | "KULLANICI_GUNCELLENDI"
  | "KULLANICI_DURUM"
  | "KULLANICI_SIFRE_SIFIRLANDI"
  | "KULLANICI_ICE_AKTARILDI"
  | "MODUL_DEGISTI"
  | "MODUL_KATALOG_ESITLENDI"
  | "OTURUM_KAPATILDI"
  | "EPOSTA_DOGRULAMA_GONDERILDI"
  | "EPOSTA_DOGRULANDI"
  | "EPOSTA_DOGRULAMA_KALDIRILDI";

export type FirmaDurum = "AKTIF" | "DONDURULMUS" | "PASIF";
export type BaglantiModu = "cloud" | "local";

/** Aktif lisansın bugüne göre durumu. YAKINDA = bitişe 30 gün veya daha az kaldı. */
export type LisansDurumu = "YOK" | "GECERLI" | "YAKINDA" | "BITMIS";
export const LISANS_UYARI_GUN = 30;

export interface LisansDto {
  lisansId: number;
  firmaId: number;
  lisansAnahtari: string | null;
  baslangic: string; // YYYY-MM-DD
  bitis: string; // YYYY-MM-DD
  kullaniciLimiti: number;
  paketAdi: string | null;
  notlar: string | null;
  aktif: boolean;
  olusturanAdminId: number | null;
  olusturmaTarihi: Date;
}

/** İstemciye dönen firma. Veritabanı şifresi hiçbir zaman dönmez; yalnızca tanımlı olup olmadığı bildirilir. */
export interface FirmaDto {
  firmaId: number;
  firmaKodu: string;
  /** Firmanın müşteri numarası (ör. D20AC0001); admin yazar, benzersizdir. Eski kayıtlarda boş olabilir. */
  musteriNo: string | null;
  /** Program türü; şimdilik yalnızca 0. Yalnızca panelde saklanır ve gösterilir. */
  prgTur: number;
  unvan: string;
  vknTckn: string | null;
  vergiDairesi: string | null;
  yetkiliKisi: string | null;
  telefon: string | null;
  eposta: string | null;
  adres: string | null;
  durum: FirmaDurum;
  durumNotu: string | null;
  durumTarihi: Date | null;
  baglantiModu: BaglantiModu;
  dbServer: string;
  dbPort: number;
  dbName: string;
  dbUser: string | null;
  dbSifreTanimli: boolean;
  dogrulandi: boolean;
  dogrulayanAdminId: number | null;
  dogrulayanAdmin: string | null;
  dogrulamaTarihi: Date | null;
  dogrulamaNotu: string | null;
  /** E-posta adresi doğrulandı mı (firma kimlik onayından AYRI). Adres değişince kendiliğinden sıfırlanır. */
  epostaDogrulandi: boolean;
  epostaDogrulamaTarihi: Date | null;
  /** 'MAIL': firma maildeki bağlantıyla doğruladı · 'ADMIN': admin elle işaretledi */
  epostaDogrulamaKaynak: "MAIL" | "ADMIN" | null;
  epostaSonGonderim: Date | null;
  /** Gönderilmiş ve henüz kullanılmamış bağlantının son geçerlilik zamanı; yoksa / süresi dolduysa null */
  epostaBaglantiBitis: Date | null;
  dbSonTestTarihi: Date | null;
  dbSonTestSonucu: string | null;
  masakDurumu: string | null;
  masakSonKontrol: Date | null;
  olusturmaTarihi: Date;
  kullaniciSayisi: number;
  lisansDurumu: LisansDurumu;
  lisansKalanGun: number | null;
  aktifLisans: Pick<LisansDto, "lisansId" | "baslangic" | "bitis" | "kullaniciLimiti" | "paketAdi"> | null;
}

/** Firma kaydında yazılabilen alanlar. */
export interface FirmaGirdi {
  firmaKodu: string;
  musteriNo: string;
  prgTur?: number;
  unvan: string;
  vknTckn?: string | null;
  vergiDairesi?: string | null;
  yetkiliKisi?: string | null;
  telefon?: string | null;
  eposta?: string | null;
  adres?: string | null;
  baglantiModu: BaglantiModu;
  dbServer: string;
  dbName: string;
  dbUser?: string | null;
  /** undefined: dokunma · "": kayıtlı şifreyi sil · dolu: yeni şifre */
  dbSifre?: string;
}

export type KullaniciDurum = "AKTIF" | "PASIF";

/**
 * İçe aktarılmış ve şifresi henüz merkeze taşınmamış kullanıcıların SIFRE_HASH değeri. Bu kullanıcılar ilk girişte
 * firma veritabanındaki eski şifreleriyle doğrulanır; başarılı olursa şifre bcrypt ile merkeze yazılır.
 */
export const ESKI_SIFRE_ISARETI = "ESKI";

/** ADM_KULLANICI satırı (SIFRE_HASH dahil — yalnızca servis katmanında kullanılır). */
export interface MerkezKullanici {
  kullaniciId: number;
  firmaId: number;
  firmaKodu: string;
  firmaUnvan: string;
  kullaniciAdi: string;
  adSoyad: string | null;
  sifreHash: string;
  sifreDegismeli: boolean;
  durum: KullaniciDurum;
  firmaYoneticisi: boolean;
  firmaDbKullaniciId: number | null;
  sonGiris: Date | null;
  olusturan: string | null;
  olusturmaTarihi: Date;
}

/** İstemciye dönen kullanıcı (hash yok). sifreTasindi=false: henüz eski şifresiyle duruyor. */
export type MerkezKullaniciDto = Omit<MerkezKullanici, "sifreHash"> & { sifreTasindi: boolean };

/** Kullanıcı uygulamasına (likyakuyum.com) giriş ve /auth/me yanıtında user.merkez olarak dönen bilgi. */
export interface MerkezOturumBilgisi {
  firmaKodu: string;
  firmaUnvan: string;
  firmaYoneticisi: boolean;
  sifreDegismeli: boolean;
  lisansBitis: string | null;
  lisansKalanGun: number | null;
  kullaniciLimiti: number | null;
  kullaniciSayisi: number;
  /** Firmaya açık modül kodları; null = modül ayarı yapılmamış, kısıt yok (her şey açık) */
  moduller: string[] | null;
}

/** Giriş reddinde istemciye dönen kod (yanıtta errors.kod). Giriş ekranı pencereyi buna göre açar. */
export type GirisRedKodu = "FIRMA_KAYITSIZ" | "FIRMA_DONDURULDU" | "FIRMA_PASIF" | "LISANS_BITTI" | "KULLANICI_PASIF";

export type ModulTuru = "ANA" | "ALT" | "UST_KISAYOL";

/** ADM_MODUL satırı. Katalog, kullanıcı uygulamasının menü tanımından üretilir ve yönetim panelinden eşitlenir. */
export interface ModulKaydi {
  modulKodu: string;
  ustKodu: string | null;
  baslik: string;
  tur: ModulTuru;
  sira: number;
}
