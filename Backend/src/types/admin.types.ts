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
  | "PAKET_ILK_ICERIK"
  | "PAKET_DEGISTI"
  | "OTURUM_KAPATILDI"
  | "EPOSTA_DOGRULAMA_GONDERILDI"
  | "EPOSTA_DOGRULANDI"
  | "EPOSTA_DOGRULAMA_KALDIRILDI"
  | "POS_AYAR_DEGISTI"
  | "POS_MOD_DEGISTI"
  | "POS_DOGRULAMA"
  | "POS_DENEME"
  | "FIRMA_DB_OLUSTURULDU"
  | "FIRMA_DB_OLUSTURMA_GERI_ALINDI"
  | "YEDEK_ALINDI"
  | "YEDEK_ALINAMADI"
  | "YEDEK_INDIRME_BAGLANTISI"
  | "FIRMA_SILME_PLANLANDI"
  | "FIRMA_SILME_GERI_ALINDI"
  | "FIRMA_DB_SILINDI"
  | "FIRMA_DB_SILINEMEDI"
  | "SILINEN_YEDEK_TEMIZLENDI"
  | "AYAR_DEGISTI"
  | "LISANS_KODU_URETILDI"
  | "LISANS_IPTAL"
  | "MAKINE_KIMLIGI_DEGISTI"
  | "KURULUM_BAGLANTISI"
  | "SURUM_YAYINLANDI"
  | "SURUM_GUNCELLENDI"
  | "HEDEF_SURUM_DEGISTI"
  | "DESTEK_ATAMA"
  | "DESTEK_DURUM"
  | "BILDIRIM_TASLAK"
  | "BILDIRIM_GONDERILDI"
  | "BILDIRIM_GERI_CEKILDI";

/** SILINECEK: panelden silme istendi, 30 gün geri alınabilir · SILINDI: veritabanı kaldırıldı (kayıt arşivde) */
export type FirmaDurum = "AKTIF" | "DONDURULMUS" | "PASIF" | "SILINECEK" | "SILINDI";
/** cloud: sunucumuzda · local: web köprü (müşterinin SQL'ine site bağlanır) · setup: kurulum (lisanslı exe) */
export type BaglantiModu = "cloud" | "local" | "setup";

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
  /** Kurulum (exe): imzalı lisans kodu ve bağlı olduğu makine */
  lisansKodu: string | null;
  makineKimligi: string | null;
  seriNo: number | null;
  iptal: boolean;
  teslim: "KOD" | "HEARTBEAT" | null;
  teslimTarihi: Date | null;
  /** Ürün paketleri (docs/LISANS_URUN_PAKETLERI.md); boş = ürünsüz */
  urunler: string[];
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
  /** Bulut: silme istendiyse kalıcı silinme zamanı */
  silinmePlani: Date | null;
  silindiTarihi: Date | null;
  /** Son yedek (firma başına tek dosya; silinen firmada son yedek) */
  yedekTarihi: Date | null;
  yedekBoyut: number | null;
  yedekVar: boolean;
  yedekSilinmePlani: Date | null;
  /** Kurulum (exe) bilgileri */
  makineKimligi: string | null;
  surum: string | null;
  hedefSurum: string | null;
  sonGorulme: Date | null;
  bildirilenLisansDurumu: string | null;
  bildirilenKilitNedeni: string | null;
  bildirilenKullaniciSayisi: number | null;
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

/** Panelden sunucumuzda şablondan yeni veritabanıyla açılan firma (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 6.1) */
export interface BulutFirmaGirdi extends Omit<FirmaGirdi, "baglantiModu" | "dbServer" | "dbUser" | "dbSifre"> {
  dbUser: string;
  dbSifre: string;
  ilkKullaniciAdi: string;
  ilkKullaniciAdSoyad?: string | null;
  lisansBitis: string;
  kullaniciLimiti: number;
  /** İlk lisansın ürün paketleri (docs/LISANS_URUN_PAKETLERI.md) */
  urunler?: string[];
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
  paketAdi?: string | null;
  /** Lisanstaki ürün paketleri ("kuyum", "connector" …); boş = ürünsüz */
  urunler?: string[];
  /** Firmaya açık modül kodları; null = modül ayarı yapılmamış, kısıt yok (her şey açık) */
  moduller: string[] | null;
  /** Lisans uyarı bandı ve kilit penceresindeki iletişim bilgisi */
  iletisim?: { telefon: string; eposta: string; metin: string };
}

/** Giriş reddinde istemciye dönen kod (yanıtta errors.kod). Giriş ekranı pencereyi buna göre açar. */
export type GirisRedKodu =
  | "FIRMA_KAYITSIZ"
  | "FIRMA_DONDURULDU"
  | "FIRMA_PASIF"
  | "LISANS_BITTI"
  | "KULLANICI_PASIF"
  | "MUSTERI_NO_BULUNAMADI"
  | "BAGLANTI_EKSIK";

export type ModulTuru = "ANA" | "ALT" | "UST_KISAYOL";

/** ADM_MODUL satırı. Katalog, kullanıcı uygulamasının menü tanımından üretilir ve yönetim panelinden eşitlenir. */
export interface ModulKaydi {
  modulKodu: string;
  ustKodu: string | null;
  baslik: string;
  tur: ModulTuru;
  sira: number;
}
