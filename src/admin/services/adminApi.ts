// Ana admin paneli API istemcisi. Kullanıcı uygulamasının authService / localStorage'ından bağımsızdır:
// token yalnızca sessionStorage'da durur (sekme kapanınca biter) ve yalnızca Authorization başlığıyla gider.

// Bilinçli olarak göreli: admin paneli API'ye yalnızca kendi adresi üzerinden (aynı origin) gider.
const API_KOK = "/api/v1/admin";
const TOKEN_ANAHTARI = "likya_admin_token";

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

export type FirmaDurum = "AKTIF" | "DONDURULMUS" | "PASIF";
export type BaglantiModu = "cloud" | "local";
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

export interface LisansGirdi {
  lisansAnahtari: string;
  baslangic: string;
  bitis: string;
  kullaniciLimiti: number;
  paketAdi: string;
  notlar: string;
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
  lisansEkle: (firmaId: number, veri: LisansGirdi) =>
    istek<{ firma: FirmaDto; lisanslar: LisansDto[] }>("POST", `/firmalar/${firmaId}/lisanslar`, veri),

  modulKatalogEsitle: (moduller: ModulKaydi[]) => istek<ModulKaydi[]>("PUT", "/moduller/katalog", { moduller }),
  firmaModulleri: (firmaId: number) => istek<FirmaModulAyari>("GET", `/firmalar/${firmaId}/moduller`),
  firmaModulleriniYaz: (firmaId: number, veri: { kisitsiz?: boolean; acik?: string[] }) =>
    istek<FirmaModulAyari>("PUT", `/firmalar/${firmaId}/moduller`, veri),

  cevrimici: () => istek<{ dakika: number; oturumlar: CevrimiciOturum[] }>("GET", "/izleme/cevrimici"),
  girisLoglari: (p: { sayfa: number; boyut?: number; arama?: string; tur?: string; basarili?: string; firmaId?: number }) =>
    istek<Sayfali<GirisLogu>>("GET", `/izleme/giris-log${sorgu(p)}`),
  islemLoglari: (p: { sayfa: number; boyut?: number; arama?: string }) =>
    istek<Sayfali<IslemLogu>>("GET", `/izleme/islem-log${sorgu(p)}`),
  oturumuKapat: (sid: string) => istek<void>("POST", `/izleme/oturumlar/${sid}/kapat`),
  firmaOturumlariniKapat: (firmaId: number) => istek<{ kapanan: number }>("POST", `/firmalar/${firmaId}/oturumlari-kapat`),

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
};
