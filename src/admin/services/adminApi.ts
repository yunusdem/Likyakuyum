// Ana admin paneli API istemcisi. Kullanıcı uygulamasının authService / localStorage'ından bağımsızdır:
// token yalnızca sessionStorage'da durur (sekme kapanınca biter) ve yalnızca Authorization başlığıyla gider.

// Bilinçli olarak göreli: admin paneli API'ye yalnızca kendi adresi üzerinden (aynı origin) gider.
const API_KOK = "/api/v1/admin";
const TOKEN_ANAHTARI = "likya_admin_token";

import type { BildirimHedefi, BildirimTuru, KonuOzet, KonuTuru, MesajDto } from "../../components/destek/destekOrtak";

export const OTURUM_BITTI_OLAYI = "likya-admin-oturum-bitti";

export type AdminDurum = "AKTIF" | "PASIF";

export interface AdminDto {
  adminId: number;
  kullaniciAdi: string;
  adSoyad: string;
  sifreDegismeli: boolean;
  durum: AdminDurum;
  sonGiris: string | null;
  olusturanAdminId: number | null;
  olusturmaTarihi: string;
}

export type FirmaDurum = "AKTIF" | "DONDURULMUS" | "PASIF" | "SILINECEK" | "SILINDI";
/** cloud: sunucumuzda · local: web köprü · setup: kurulum (lisanslı exe) */
export type BaglantiModu = "cloud" | "local" | "setup";
export type LisansDurumu = "YOK" | "GECERLI" | "YAKINDA" | "BITMIS";

export interface LisansDto {
  lisansId: number;
  firmaId: number;
  lisansAnahtari: string | null;
  baslangic: string;
  bitis: string;
  kullaniciLimiti: number;
  paketAdi: string | null;
  notlar: string | null;
  aktif: boolean;
  olusturmaTarihi: string;
  /** Kurulum (exe): imzalı lisans kodu ve bağlı olduğu makine */
  lisansKodu: string | null;
  makineKimligi: string | null;
  seriNo: number | null;
  iptal: boolean;
  teslim: "KOD" | "HEARTBEAT" | null;
  teslimTarihi: string | null;
  /** Ürün paketleri (docs/LISANS_URUN_PAKETLERI.md); boş = ürünsüz */
  urunler: string[];
}

export type AyarAnahtari =
  | "LISANS_ILETISIM_TELEFON"
  | "LISANS_ILETISIM_EPOSTA"
  | "LISANS_ILETISIM_METIN"
  | "YEDEK_KLASORU"
  | "SURUM_KLASORU"
  | "SABLON_YEDEK_DOSYASI";

export interface AyarlarDto {
  ayarlar: Record<AyarAnahtari, string>;
  durum: { lisansImzaAcik: boolean; klonAcik: boolean };
}

export interface SurumDto {
  surum: string;
  yayinTarihi: string;
  boyut: number;
  semaSurumu: number | null;
  notlar: string | null;
  aktif: boolean;
  kurulumSayisi: number;
  sabitFirmaSayisi: number;
}

export interface HeartbeatDto {
  tarih: string;
  surum: string | null;
  makineKimligi: string | null;
  lisansDurumu: string | null;
  kilitNedeni: string | null;
  kullaniciSayisi: number | null;
  semaSurumu: number | null;
  ip: string | null;
}

export interface FirmaDto {
  firmaId: number;
  firmaKodu: string;
  musteriNo: string | null;
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
  durumTarihi: string | null;
  baglantiModu: BaglantiModu;
  dbServer: string;
  dbPort: number;
  dbName: string;
  dbUser: string | null;
  dbSifreTanimli: boolean;
  dogrulandi: boolean;
  dogrulayanAdmin: string | null;
  dogrulamaTarihi: string | null;
  dogrulamaNotu: string | null;
  /** E-posta adresi doğrulandı mı (firma kimlik onayından ayrı) */
  epostaDogrulandi: boolean;
  epostaDogrulamaTarihi: string | null;
  epostaDogrulamaKaynak: "MAIL" | "ADMIN" | null;
  epostaSonGonderim: string | null;
  /** Gönderilmiş ve henüz kullanılmamış bağlantının son geçerlilik zamanı */
  epostaBaglantiBitis: string | null;
  dbSonTestTarihi: string | null;
  dbSonTestSonucu: string | null;
  masakDurumu: string | null;
  masakSonKontrol: string | null;
  olusturmaTarihi: string;
  kullaniciSayisi: number;
  lisansDurumu: LisansDurumu;
  lisansKalanGun: number | null;
  aktifLisans: { lisansId: number; baslangic: string; bitis: string; kullaniciLimiti: number; paketAdi: string | null } | null;
  /** Bulut: silme istendiyse kalıcı silinme zamanı */
  silinmePlani: string | null;
  silindiTarihi: string | null;
  yedekTarihi: string | null;
  yedekBoyut: number | null;
  yedekVar: boolean;
  yedekSilinmePlani: string | null;
  /** Kurulum (exe) */
  makineKimligi: string | null;
  surum: string | null;
  hedefSurum: string | null;
  sonGorulme: string | null;
  bildirilenLisansDurumu: string | null;
  bildirilenKilitNedeni: string | null;
  bildirilenKullaniciSayisi: number | null;
}

export interface FirmaGirdi {
  firmaKodu: string;
  /** Firmanın müşteri numarası (ör. D20AC0001); benzersiz */
  musteriNo: string;
  prgTur: number;
  unvan: string;
  vknTckn: string;
  vergiDairesi: string;
  yetkiliKisi: string;
  telefon: string;
  eposta: string;
  adres: string;
  baglantiModu: BaglantiModu;
  dbServer: string;
  dbName: string;
  dbUser: string;
  /** gönderilmezse kayıtlı şifreye dokunulmaz */
  dbSifre?: string;
}

/** Sunucumuzda şablondan yeni veritabanıyla açılan firma */
export interface BulutFirmaGirdi extends Omit<FirmaGirdi, "baglantiModu" | "dbServer" | "dbSifre"> {
  dbSifre: string;
  ilkKullaniciAdi: string;
  ilkKullaniciAdSoyad: string;
  lisansBitis: string;
  kullaniciLimiti: number;
  urunler?: string[];
}

export interface BulutDurum {
  /** false: sunucuda KLON_DB_USER / KLON_DB_PASSWORD tanımlı değil */
  klonAcik: boolean;
  sunucu: string;
}

export interface LisansGirdi {
  lisansAnahtari: string;
  baslangic: string;
  bitis: string;
  kullaniciLimiti: number;
  paketAdi: string;
  notlar: string;
  /** Gönderilirse lisansın ürünleri bu olur (paket tabloları kurulu değilse gönderilmez) */
  urunler?: string[];
}

export interface KullaniciDto {
  kullaniciId: number;
  firmaId: number;
  firmaKodu: string;
  firmaUnvan: string;
  kullaniciAdi: string;
  adSoyad: string | null;
  sifreDegismeli: boolean;
  /** false: içe aktarılmış, henüz eski şifresiyle duruyor (ilk girişinde merkeze taşınır) */
  sifreTasindi: boolean;
  durum: "AKTIF" | "PASIF";
  firmaYoneticisi: boolean;
  sonGiris: string | null;
  olusturan: string | null;
  olusturmaTarihi: string;
}

export interface ModulKaydi {
  modulKodu: string;
  ustKodu: string | null;
  baslik: string;
  tur: "ANA" | "ALT" | "UST_KISAYOL";
  sira: number;
}

/** kisitsiz=true: firmaya modül ayarı yapılmamış, her şey açık */
export interface FirmaModulAyari {
  kisitsiz: boolean;
  acik: string[];
  /** Aktif lisanstaki ürünler; boş = ürünsüz (eski usul elle ayar) */
  urunler: string[];
  /** Ürünlü firmada paketlerin verdiği liste ve elle istisnalar */
  taban: string[];
  ek: string[];
  cikar: string[];
  paketKurulu: boolean;
}

/** Lisans ürün paketi (docs/LISANS_URUN_PAKETLERI.md) */
export interface PaketDto {
  paketKodu: string;
  ad: string;
  sira: number;
  /** Her ürünle birlikte açılan ortak sayfalar */
  cekirdek: boolean;
  /** Tüm sayfalar (ERP); içeriği düzenlenmez */
  hepsi: boolean;
  ilkIcerik: boolean;
  guncellemeTarihi: string | null;
  guncelleyen: string | null;
  moduller: string[];
  firmaSayisi: number;
  kurulumFirmaSayisi: number;
}

export interface PaketListesi {
  kurulu: boolean;
  paketler: PaketDto[];
}

export interface PaketOnizleme {
  degisiyor: boolean;
  kisitsizdi: boolean;
  acilacak: { modulKodu: string; baslik: string; ustKodu: string | null }[];
  kapanacak: { modulKodu: string; baslik: string; ustKodu: string | null }[];
}

export interface CevrimiciOturum {
  sid: string;
  tur: "ADMIN" | "KULLANICI";
  ip: string | null;
  tarayici: string | null;
  baslangic: string;
  sonIslem: string;
  firmaId: number | null;
  firmaKodu: string | null;
  firmaUnvan: string | null;
  kullaniciAdi: string | null;
  adSoyad: string | null;
}

export interface GirisLogu {
  logId: number;
  tarih: string;
  tur: "ADMIN" | "KULLANICI";
  firmaId: number | null;
  firmaKodu: string | null;
  firmaUnvan: string | null;
  kullaniciAdi: string | null;
  basarili: boolean;
  redNedeni: string | null;
  ip: string | null;
  tarayici: string | null;
}

export interface IslemLogu {
  logId: number;
  tarih: string;
  admin: string | null;
  islem: string;
  hedefTur: string | null;
  hedefId: string | null;
  eskiDeger: string | null;
  yeniDeger: string | null;
}

export interface Sayfali<T> {
  satirlar: T[];
  toplam: number;
}

// POS cihazı entegrasyonu (docs/POS_ENTEGRASYON_YOL_HARITASI.md, 3.5)
export type PosMod = "kapali" | "test" | "canli";
export type PosDogrulamaSonucu = "GECTI" | "KALDI";

/** Şifre sunucudan hiçbir zaman geri dönmez; yalnızca tanımlı olup olmadığı bilinir. */
export interface PosMerkezAyar {
  /** false: merkez veritabanında POS tabloları kurulmamış (docs/sql/LIKYA_ADMIN_POS.sql) */
  tablolarKurulu: boolean;
  tokenClientId: string;
  tokenClientSecretTanimli: boolean;
  tokenAuthUrl: string;
  tokenApiUrl: string;
  donusKok: string;
  inposUygulamaNo: string;
  inposApiUrl: string;
  inposKullanici: string;
  inposSifreTanimli: boolean;
  inposWebhookKullanici: string;
  inposWebhookSifreTanimli: boolean;
  /** Inpos portalına (Webhook Konfigürasyonu › Sipariş Durum Güncelleme) yazılacak adres */
  inposWebhookAdresi: string;
  guncellemeTarihi: string | null;
}

export interface PosMerkezAyarGirdi {
  tokenClientId: string;
  /** Boş → kayıtlı şifre korunur */
  tokenClientSecret?: string;
  tokenAuthUrl: string;
  tokenApiUrl: string;
  donusKok: string;
  inposUygulamaNo: string;
  inposApiUrl: string;
  inposKullanici: string;
  /** Boş → kayıtlı şifre korunur */
  inposSifre?: string;
  inposWebhookKullanici: string;
  /** Boş → kayıtlı şifre korunur */
  inposWebhookSifre?: string;
}

export interface PosSenaryo {
  no: number;
  ad: string;
  gecmeSarti: string;
  /** Test konsolundaki denemenin bu senaryoda vermesi gereken sonuç; elle değerlendirilen senaryoda null */
  beklenen: string | null;
  sonuc: PosDogrulamaSonucu | null;
  notu: string | null;
  admin: string | null;
  tarih: string | null;
}

export interface PosDogrulamaModeli {
  model: string;
  entegrasyon: "beko" | "inpos";
  ad: string;
  senaryolar: PosSenaryo[];
  gecenAdet: number;
  dogrulandi: boolean;
  dogrulamaTarihi: string | null;
}

export interface PosKonsolFirma {
  firmaId: number;
  firmaKodu: string;
  unvan: string;
  mod: PosMod;
}

export interface PosKonsolTerminal {
  posTerminalId: number;
  ad: string;
  entegrasyon: "yok" | "beko" | "inpos";
  model: string | null;
  terminalKimlik: string | null;
  aktif: boolean;
}

export interface PosDenemeIslemi {
  posIslemId: number;
  terminalAd: string | null;
  mod: "test" | "canli";
  tutar: number;
  durum: "BEKLIYOR" | "ONAY" | "RET" | "IPTAL" | "BELIRSIZ";
  elle: boolean;
  bankaAdi: string | null;
  taksit: number | null;
  onayKodu: string | null;
  kartNo: string | null;
  cihazFisNo: string | null;
  zNo: string | null;
  hata: string | null;
  gecenSaniye: number | null;
}

export interface PosDenemeGirdi {
  istekKimlik: string;
  posTerminalId: number;
  tutar: number;
  belgeTipi: "earsiv" | "efatura";
  belgeNo?: string;
  /** true: gerçek cihaz servisi (kart okutulursa PARA ÇEKİLİR) · false: örnek cihaz */
  gercek: boolean;
}

export interface PosLogu {
  logId: number;
  tarih: string;
  tur: "ISTEK" | "DONUS";
  firmaId: number | null;
  firmaKodu: string | null;
  ozet: string;
  istek: string | null;
  yanit: string | null;
  basarili: boolean;
}

const sorgu = (p: Record<string, string | number | boolean | undefined>): string => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "") q.set(k, String(v));
  const metin = q.toString();
  return metin ? `?${metin}` : "";
};

export interface MailDurumu {
  yapilandirildi: boolean;
  gonderen: string | null;
  gecerlilikSaat: number;
}

export interface LisansUyarisi {
  firmaId: number;
  firmaKodu: string;
  unvan: string;
  bitis: string;
  kalanGun: number;
}

export interface OzetDto {
  firmaToplam: number;
  firmaAktif: number;
  firmaDondurulmus: number;
  firmaPasif: number;
  dogrulanmamis: number;
  kullaniciAktif: number;
  lisanssizFirma: number;
  lisansUyariGun: number;
  suresiBitenLisanslar: LisansUyarisi[];
  yaklasanLisanslar: LisansUyarisi[];
}

/** 'YYYY-AA-GG' → 'GG.AA.YYYY' */
export const gunYaz = (deger: string | null | undefined): string =>
  deger ? deger.slice(0, 10).split("-").reverse().join(".") : "-";

export class AdminApiHatasi extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * Veritabanındaki tarihler sunucu yerel saatiyle (GETDATE) yazılır ve sürücü bunları UTC etiketiyle döndürür;
 * saat kaymasın diye yazıldığı gibi (UTC olarak) gösterilir.
 */
export const tarihYaz = (deger: string | null | undefined): string =>
  deger ? new Date(deger).toLocaleString("tr-TR", { timeZone: "UTC" }) : "-";

export const tokenOku =(): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_ANAHTARI);
  } catch {
    return null;
  }
};

export const tokenYaz = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_ANAHTARI, token);
    else sessionStorage.removeItem(TOKEN_ANAHTARI);
  } catch {
    // sessionStorage kapalıysa oturum yalnızca bu sayfa yüklemesi boyunca sürer
  }
};


// ---------------------------------------------------------------- Destek ---
export interface DestekOzet {
  okunmamis: number;
  acikTalep: number;
  taslakBildirim: number;
  kurulu: boolean;
}
export interface DestekHedef {
  firmaId: number;
  firmaKodu: string;
  unvan: string;
  kullaniciId: number | null;
  kullaniciAdi: string | null;
}
export interface DestekKonuDetay {
  konu: KonuOzet;
  mesajlar: MesajDto[];
  hedefler?: DestekHedef[];
  yanitSayisi?: number;
}
export interface DestekKonuFiltresi {
  tur?: KonuTuru | "TALEP_SISTEM";
  durum?: string;
  firmaId?: number;
  atananAdminId?: number;
  kaynakKonuId?: number;
  arama?: string;
  sayfa?: number;
  sayfaBoyu?: number;
}
export interface BildirimGirdi {
  baslik: string;
  metin: string;
  bildirimTuru: BildirimTuru;
  onemli: boolean;
  cevapAlir: boolean;
  hedef: BildirimHedefi;
  firmaIds?: number[];
  kullaniciIds?: number[];
  gonder: boolean;
}
export interface DestekHedefSecenekleri {
  firmalar: { firmaId: number; firmaKodu: string; unvan: string; durum: string }[];
  kullanicilar: { kullaniciId: number; firmaId: number; kullaniciAdi: string; adSoyad: string | null }[];
}

async function istek<T>(yontem: string, yol: string, govde?: unknown): Promise<T> {
  const token = tokenOku();
  let yanit: Response;
  try {
    yanit = await fetch(`${API_KOK}${yol}`, {
      method: yontem,
      headers: {
        ...(govde !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: govde !== undefined ? JSON.stringify(govde) : undefined,
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    throw new AdminApiHatasi(0, "Sunucuya ulaşılamadı.");
  }

  const json = await yanit.json().catch(() => null);
  if (!yanit.ok) {
    // Giriş denemesindeki 401 "şifre hatalı" demektir; diğer 401'ler oturumun bittiğini gösterir.
    if (yanit.status === 401 && yol !== "/auth/login" && yol !== "/eposta-dogrulama/onayla") {
      tokenYaz(null);
      window.dispatchEvent(new Event(OTURUM_BITTI_OLAYI));
    }
    throw new AdminApiHatasi(yanit.status, json?.message || `İstek başarısız (${yanit.status}).`);
  }
  return json?.data as T;
}

export const adminApi = {
  giris: (kullaniciAdi: string, sifre: string) =>
    istek<{ token: string; admin: AdminDto }>("POST", "/auth/login", { kullaniciAdi, sifre }),
  cikis: () => istek<void>("POST", "/auth/logout"),
  ben: () => istek<AdminDto>("GET", "/auth/me"),
  sifreDegistir: (mevcutSifre: string, yeniSifre: string) =>
    istek<void>("POST", "/auth/sifre-degistir", { mevcutSifre, yeniSifre }),

  adminler: () => istek<{ adminler: AdminDto[]; azamiAktif: number }>("GET", "/adminler"),
  adminEkle: (kullaniciAdi: string, adSoyad: string) =>
    istek<{ admin: AdminDto; geciciSifre: string }>("POST", "/adminler", { kullaniciAdi, adSoyad }),
  adminGuncelle: (adminId: number, veri: { adSoyad?: string; durum?: AdminDurum }) =>
    istek<AdminDto>("PUT", `/adminler/${adminId}`, veri),
  adminSifreSifirla: (adminId: number) =>
    istek<{ geciciSifre: string }>("POST", `/adminler/${adminId}/sifre-sifirla`),

  ozet: () => istek<OzetDto>("GET", "/ozet"),
  firmalar: () => istek<FirmaDto[]>("GET", "/firmalar"),
  firma: (firmaId: number) => istek<FirmaDto>("GET", `/firmalar/${firmaId}`),
  firmaEkle: (veri: FirmaGirdi) => istek<FirmaDto>("POST", "/firmalar", veri),
  bulutDurum: () => istek<BulutDurum>("GET", "/bulut-durum"),
  firmaYedekle: (firmaId: number) => istek<FirmaDto>("POST", `/firmalar/${firmaId}/yedekle`),
  /** Dönen adres tarayıcıda açılınca dosya doğrudan iner (15 dk geçerli) */
  firmaYedekIndirmeAdresi: async (firmaId: number) => {
    const b = await istek<{ yol: string; sonGecerlilik: string }>("POST", `/firmalar/${firmaId}/yedek/baglanti`);
    return `${API_KOK}${b.yol}`;
  },
  firmaSilmeDurumu: (firmaId: number) => istek<{ silinemezNedeni: string | null }>("GET", `/firmalar/${firmaId}/silme-durumu`),
  firmaSil: (firmaId: number, onay: string) => istek<FirmaDto>("POST", `/firmalar/${firmaId}/sil`, { onay }),
  firmaSilmeyiGeriAl: (firmaId: number) => istek<FirmaDto>("POST", `/firmalar/${firmaId}/sil/geri-al`),
  firmaBulutEkle: (veri: BulutFirmaGirdi) =>
    istek<{ firma: FirmaDto; ilkKullanici: { kullaniciAdi: string; geciciSifre: string } }>("POST", "/firmalar/bulut", veri),
  firmaGuncelle: (firmaId: number, veri: FirmaGirdi) => istek<FirmaDto>("PUT", `/firmalar/${firmaId}`, veri),
  firmaDurum: (firmaId: number, durum: FirmaDurum, not: string) =>
    istek<FirmaDto>("PUT", `/firmalar/${firmaId}/durum`, { durum, not }),
  firmaDogrulama: (firmaId: number, dogrulandi: boolean, not: string) =>
    istek<FirmaDto>("PUT", `/firmalar/${firmaId}/dogrulama`, { dogrulandi, not }),
  firmaDbTest: (firmaId: number) =>
    istek<{ basarili: boolean; sonuc: string; firma: FirmaDto }>("POST", `/firmalar/${firmaId}/db-test`),
  firmaMasakKontrol: (firmaId: number) =>
    istek<{ sonuc: string; firma: FirmaDto }>("POST", `/firmalar/${firmaId}/masak-kontrol`),
  mailDurumu: () => istek<MailDurumu>("GET", "/mail-durumu"),
  epostaDogrulamaGonder: (firmaId: number) => istek<FirmaDto>("POST", `/firmalar/${firmaId}/eposta-dogrulama/gonder`),
  epostaDogrulamaElle: (firmaId: number, dogrulandi: boolean) =>
    istek<FirmaDto>("PUT", `/firmalar/${firmaId}/eposta-dogrulama`, { dogrulandi }),
  /** Herkese açık: maildeki bağlantıyı açan firma düğmeye basınca */
  epostaOnayla: (anahtar: string) => istek<{ unvan: string; eposta: string }>("POST", "/eposta-dogrulama/onayla", { anahtar }),
  lisanslar: (firmaId: number) => istek<LisansDto[]>("GET", `/firmalar/${firmaId}/lisanslar`),
  lisansKoduUret: (firmaId: number, lisansId: number, makineKimligi: string) =>
    istek<{ kod: string; lisans: LisansDto }>("POST", `/firmalar/${firmaId}/lisanslar/${lisansId}/kod`, { makineKimligi }),
  lisansIptal: (firmaId: number, lisansId: number) => istek<LisansDto>("POST", `/firmalar/${firmaId}/lisanslar/${lisansId}/iptal`),
  ayarlar: () => istek<AyarlarDto>("GET", "/ayarlar"),
  surumler: () => istek<SurumDto[]>("GET", "/surumler"),
  surumGuncelle: (surum: string, veri: { aktif?: boolean; notlar?: string | null }) =>
    istek<SurumDto[]>("PUT", `/surumler/${encodeURIComponent(surum)}`, veri),
  hedefSurum: (firmaId: number, surum: string | null) => istek<FirmaDto>("PUT", `/firmalar/${firmaId}/hedef-surum`, { surum }),
  kurulumDurumu: (firmaId: number) =>
    istek<{ sonBildirilenMakine: string | null; gecmis: HeartbeatDto[] }>("GET", `/firmalar/${firmaId}/kurulum`),
  kurulumBaglantisi: (firmaId: number) =>
    istek<{ adres: string; sonGecerlilik: string }>("POST", `/firmalar/${firmaId}/kurulum/baglanti`),
  /** firma.lky dosyasını oturum anahtarıyla indirir ve tarayıcıya kaydettirir */
  firmaDosyasiIndir: async (firmaId: number) => {
    const token = tokenOku();
    const r = await fetch(`${API_KOK}/firmalar/${firmaId}/kurulum/firma-dosyasi`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      throw new AdminApiHatasi(r.status, j?.message || `İndirilemedi (${r.status}).`);
    }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "firma.lky";
    a.click();
    URL.revokeObjectURL(url);
  },
  ayarKaydet: (veri: Partial<Record<AyarAnahtari, string>>) => istek<AyarlarDto>("PUT", "/ayarlar", veri),
  lisansEkle: (firmaId: number, veri: LisansGirdi) =>
    istek<{ firma: FirmaDto; lisanslar: LisansDto[] }>("POST", `/firmalar/${firmaId}/lisanslar`, veri),

  modulKatalogEsitle: (moduller: ModulKaydi[]) => istek<ModulKaydi[]>("PUT", "/moduller/katalog", { moduller }),
  firmaModulleri: (firmaId: number) => istek<FirmaModulAyari>("GET", `/firmalar/${firmaId}/moduller`),
  firmaModulleriniYaz: (firmaId: number, veri: { kisitsiz?: boolean; acik?: string[]; paketeDon?: boolean }) =>
    istek<FirmaModulAyari>("PUT", `/firmalar/${firmaId}/moduller`, veri),

  paketler: () => istek<PaketListesi>("GET", "/paketler"),
  paketIlkIcerik: (icerik: Record<string, string[]>) => istek<PaketListesi>("PUT", "/paketler/ilk-icerik", { icerik }),
  paketYaz: (kod: string, veri: { moduller: string[]; uygula: boolean }) =>
    istek<{ paket: PaketDto; etkilenenFirma: number; kurulumFirmalari: string[] }>("PUT", `/paketler/${kod}`, veri),
  firmaUrunleri: () => istek<Record<number, string[]>>("GET", "/paketler/firma-urunleri"),
  paketOnizleme: (firmaId: number, urunler: string[]) => istek<PaketOnizleme>("POST", `/firmalar/${firmaId}/paket-onizleme`, { urunler }),

  cevrimici: () => istek<{ dakika: number; oturumlar: CevrimiciOturum[] }>("GET", "/izleme/cevrimici"),
  girisLoglari: (p: { sayfa: number; boyut?: number; arama?: string; tur?: string; basarili?: string; firmaId?: number }) =>
    istek<Sayfali<GirisLogu>>("GET", `/izleme/giris-log${sorgu(p)}`),
  islemLoglari: (p: { sayfa: number; boyut?: number; arama?: string }) =>
    istek<Sayfali<IslemLogu>>("GET", `/izleme/islem-log${sorgu(p)}`),
  oturumuKapat: (sid: string) => istek<void>("POST", `/izleme/oturumlar/${sid}/kapat`),
  firmaOturumlariniKapat: (firmaId: number) => istek<{ kapanan: number }>("POST", `/firmalar/${firmaId}/oturumlari-kapat`),

  posAyar: () => istek<PosMerkezAyar>("GET", "/pos/ayar"),
  posAyarKaydet: (veri: PosMerkezAyarGirdi) => istek<PosMerkezAyar>("PUT", "/pos/ayar", veri),
  posDogrulama: () => istek<{ modeller: PosDogrulamaModeli[] }>("GET", "/pos/dogrulama"),
  posDogrulamaYaz: (veri: { model: string; senaryoNo: number; sonuc: PosDogrulamaSonucu | null; notu?: string }) =>
    istek<{ modeller: PosDogrulamaModeli[] }>("PUT", "/pos/dogrulama", veri),
  posLog: (limit = 100) => istek<PosLogu[]>("GET", `/pos/log${sorgu({ limit })}`),
  posKimlikTesti: (saglayici: "token" | "inpos" = "token") => istek<{ ayrinti: string }>("POST", "/pos/kimlik-testi", { saglayici }),
  posFirmalar: () => istek<PosKonsolFirma[]>("GET", "/pos/firmalar"),
  firmaPosModu: (firmaId: number) => istek<{ mod: PosMod; tablolarKurulu: boolean }>("GET", `/firmalar/${firmaId}/pos`),
  firmaPosModuYaz: (firmaId: number, mod: PosMod) => istek<{ mod: PosMod; tablolarKurulu: boolean }>("PUT", `/firmalar/${firmaId}/pos`, { mod }),
  posTerminaller: (firmaId: number) => istek<PosKonsolTerminal[]>("GET", `/firmalar/${firmaId}/pos/terminaller`),
  posBaglantiTesti: (firmaId: number, posTerminalId: number, gercek: boolean) =>
    istek<{ mod: PosMod; ayrinti: string }>("POST", `/firmalar/${firmaId}/pos/baglanti-testi`, { posTerminalId, gercek }),
  posDeneme: (firmaId: number, veri: PosDenemeGirdi) => istek<PosDenemeIslemi>("POST", `/firmalar/${firmaId}/pos/deneme`, veri),
  posDenemeIslemi: (firmaId: number, posIslemId: number) => istek<PosDenemeIslemi>("GET", `/firmalar/${firmaId}/pos/deneme/${posIslemId}`),
  posDenemeIptal: (firmaId: number, posIslemId: number) => istek<PosDenemeIslemi>("POST", `/firmalar/${firmaId}/pos/deneme/${posIslemId}/iptal`),
  posDenemeElle: (firmaId: number, posIslemId: number, alindi: boolean) =>
    istek<PosDenemeIslemi>("POST", `/firmalar/${firmaId}/pos/deneme/${posIslemId}/elle`, { alindi }),

  kullanicilar: () => istek<KullaniciDto[]>("GET", "/kullanicilar"),
  firmaKullanicilari: (firmaId: number) => istek<KullaniciDto[]>("GET", `/firmalar/${firmaId}/kullanicilar`),
  kullaniciEkle: (firmaId: number, veri: { kullaniciAdi: string; adSoyad: string; firmaYoneticisi: boolean }) =>
    istek<{ kullanici: KullaniciDto; geciciSifre: string }>("POST", `/firmalar/${firmaId}/kullanicilar`, veri),
  kullaniciGuncelle: (
    kullaniciId: number,
    veri: { adSoyad?: string; firmaYoneticisi?: boolean; durum?: "AKTIF" | "PASIF" }
  ) => istek<KullaniciDto>("PUT", `/kullanicilar/${kullaniciId}`, veri),
  kullaniciSifreSifirla: (kullaniciId: number) =>
    istek<{ geciciSifre: string; firmaDbEsitlendi: boolean }>("POST", `/kullanicilar/${kullaniciId}/sifre-sifirla`),
  kullanicilariIceAktar: (firmaId: number) =>
    istek<{ eklenen: string[]; zatenVar: number; atlanan: number }>("POST", `/firmalar/${firmaId}/kullanicilar/ice-aktar`),
  // Destek (docs/DESTEK_VE_BILDIRIM_YOL_HARITASI.md, Faz 3)
  destekOzet: () => istek<DestekOzet>("GET", "/destek/ozet"),
  destekKonular: (f: DestekKonuFiltresi) => istek<{ satirlar: KonuOzet[]; toplam: number; kurulu: boolean }>("GET", `/destek/konular${sorgu({ ...f })}`),
  destekKonu: (konuId: number) => istek<DestekKonuDetay>("GET", `/destek/konular/${konuId}`),
  destekMesajYaz: (konuId: number, metin: string, icNot: boolean) => istek<DestekKonuDetay>("POST", `/destek/konular/${konuId}/mesajlar`, { metin, icNot }),
  destekKonuGuncelle: (konuId: number, veri: { durum?: "KAPALI" | "ACIK"; atananAdminId?: number | null }) =>
    istek<DestekKonuDetay>("PUT", `/destek/konular/${konuId}`, veri),
  bildirimler: () => istek<{ satirlar: KonuOzet[]; toplam: number; kurulu: boolean }>("GET", "/destek/bildirimler"),
  bildirimHedefleri: () => istek<DestekHedefSecenekleri>("GET", "/destek/hedefler"),
  bildirimOlustur: (veri: BildirimGirdi) => istek<DestekKonuDetay>("POST", "/destek/bildirimler", veri),
  bildirimGuncelle: (konuId: number, veri: BildirimGirdi) => istek<DestekKonuDetay>("PUT", `/destek/bildirimler/${konuId}`, veri),
  bildirimGeriCek: (konuId: number) => istek<DestekKonuDetay>("POST", `/destek/bildirimler/${konuId}/geri-cek`),
  /** Ek görsel (Authorization ile); nesne adresi döner */
  destekEkAdresi: async (ekId: number) => {
    const token = tokenOku();
    const r = await fetch(`${API_KOK}/destek/ek/${ekId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
    if (!r.ok) throw new AdminApiHatasi(r.status, "Görsel alınamadı.");
    return URL.createObjectURL(await r.blob());
  },
};
