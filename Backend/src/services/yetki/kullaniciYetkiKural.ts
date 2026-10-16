/**
 * Kullanıcı kartı yetkileri (TODVZ_KULLANICI, eski programla ortak) — saf kurallar; ön yüz de içe aktarır.
 * docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4. Sistem yöneticisi her yetkiye sahiptir.
 */

export type KurYetkisiTuru = "Var" | "Yok" | "Limitli";

/** Menü yetkisi kolonu (kullanıcı DTO'sundaki menuPerms alanı) */
export type MenuYetkiAlani =
  | "mainMenu"
  | "cashier"
  | "safe"
  | "exchange"
  | "accounts"
  | "admin"
  | "accounting"
  | "reports"
  | "consolidatedReports"
  | "techOps";

export interface KullaniciYetkisi {
  yonetici: boolean;
  /** Ham menü yetkisi değerleri (harf listesi / NULL / eski ekranın metni) */
  menu: Partial<Record<MenuYetkiAlani, string | null>>;
  /** İşlem gösterme gün sayısı; 0 sınırsız */
  gosterimGunu: number;
  tarihDegistirme: boolean;
  fisNoDegistirme: boolean;
  tutarDegistirme: boolean;
  bankaHesabiSecme: boolean;
  komisyonAlma: boolean;
  /** Kullanıcı kartındaki komisyon oranı (yüzde); 0 = istatistik oranı */
  komisyonOrani: number;
  cariBakiye: boolean;
  acikVadeli: boolean;
  supheliIslem: boolean;
  caprazKurKontroluYok: boolean;
  kurYetkisi: KurYetkisiTuru;
  /** Limitli kur yetkisinde gişe kurundan en çok sapma (yüzde) */
  kurTolerans: number;
  giseKuruDisinda: boolean;
  sapmaUyarisiYok: boolean;
  masakUyarisi: boolean;
  calismaAlani: boolean;
}

/** Sistem yöneticisi ya da kısıtsız kullanıcı */
export const TAM_YETKI: KullaniciYetkisi = {
  yonetici: true,
  menu: {},
  gosterimGunu: 0,
  tarihDegistirme: true,
  fisNoDegistirme: true,
  tutarDegistirme: true,
  bankaHesabiSecme: true,
  komisyonAlma: true,
  komisyonOrani: 0,
  cariBakiye: true,
  acikVadeli: true,
  supheliIslem: true,
  caprazKurKontroluYok: true,
  kurYetkisi: "Var",
  kurTolerans: 0,
  giseKuruDisinda: true,
  sapmaUyarisiYok: true,
  masakUyarisi: true,
  calismaAlani: true,
};

const evet = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true";
const sayi = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** KUR_YETKISI kodu (eski program: ekran sırası Var, Yok, Limitli → 0, 1, 2; K8) */
export const kurYetkisiKoddan = (v: unknown): KurYetkisiTuru => {
  const s = String(v ?? "").trim();
  if (s === "Var" || s === "Yok" || s === "Limitli") return s;
  if (s === "1") return "Yok";
  if (s === "2") return "Limitli";
  return "Var";
};
export const kurYetkisiKoda = (v: unknown): number => {
  const t = kurYetkisiKoddan(v);
  return t === "Yok" ? 1 : t === "Limitli" ? 2 : 0;
};

/** Oturum profilindeki kullanıcı (UserProfileDto) → yetki */
export const yetkiProfilden = (u: any): KullaniciYetkisi => {
  if (!u) return { ...TAM_YETKI, yonetici: false };
  if (u.isSysAdmin || u.role === "admin") return TAM_YETKI;
  return {
    yonetici: false,
    menu: { ...(u.menuPerms || {}) },
    gosterimGunu: Math.max(0, Math.trunc(sayi(u.displayDays))),
    tarihDegistirme: evet(u.hasDateChangePerm),
    fisNoDegistirme: evet(u.hasSlipNoChangePerm),
    tutarDegistirme: evet(u.hasSlipAmountChangePerm),
    bankaHesabiSecme: evet(u.hasSlipBankAccountPerm),
    komisyonAlma: evet(u.hasCommissionPerm),
    komisyonOrani: Math.max(0, sayi(u.commissionRate)),
    cariBakiye: evet(u.canViewAccountBalance),
    acikVadeli: evet(u.canViewOpenTermTrans),
    supheliIslem: evet(u.isSuspiciousTransAuth),
    caprazKurKontroluYok: evet(u.noCrossRateCheck),
    kurYetkisi: kurYetkisiKoddan(u.ratePermType),
    kurTolerans: Math.max(0, sayi(u.ratePermValue)),
    giseKuruDisinda: evet(u.canBeOutsideCounterRate),
    sapmaUyarisiYok: evet(u.noDeviationWarning),
    masakUyarisi: evet(u.hasMasakWarning),
    calismaAlani: evet(u.hasWorkspacePerm),
  };
};

/** TODVZ_KULLANICI satırı → yetki (sunucu) */
export const yetkiSatirdan = (r: any): KullaniciYetkisi => {
  if (!r) return { ...TAM_YETKI, yonetici: false };
  if (evet(r.SISTEM_YONETICISI)) return TAM_YETKI;
  return {
    yonetici: false,
    menu: {
      mainMenu: r.ANA_MENU_YETKISI ?? null,
      cashier: r.VEZNE_ISLEMLERI_YETKISI ?? null,
      safe: r.KASA_ISLEMLERI_YETKISI ?? null,
      exchange: r.KUR_ISLEMLERI_YETKISI ?? null,
      accounts: r.CARI_ISLEMLER_YETKISI ?? null,
      admin: r.YONETICI_ISLEMLERI_YETKISI ?? null,
      accounting: r.MUHASEBE_YETKISI ?? null,
      reports: r.RAPORLAR_YETKISI ?? null,
      consolidatedReports: r.KONSOLIDE_RAPORLAR_YETKISI ?? null,
      techOps: r.TEKNIK_ISLEMLER_YETKISI ?? null,
    },
    gosterimGunu: Math.max(0, Math.trunc(sayi(r.FIS_GOSTERME_GUN_SAYISI))),
    tarihDegistirme: evet(r.TARIH_DEGISTIRME_YETKISI),
    fisNoDegistirme: evet(r.FIS_NO_DEGISTIRME_YETKISI),
    tutarDegistirme: evet(r.FIS_TUTAR_DEGISTIRME_YETKISI),
    bankaHesabiSecme: evet(r.FIS_BANKA_HESABI_SECME_YETKISI),
    komisyonAlma: evet(r.KOMISYON_ALMA_YETKISI),
    komisyonOrani: Math.max(0, sayi(r.KOMISYON_ORANI)),
    cariBakiye: evet(r.CARI_BAKIYE_GOREBILIR),
    acikVadeli: evet(r.ACIK_VADELI_ISLEM_GOREBILIR),
    supheliIslem: evet(r.SUPHELI_ISLEMLER_YETKILISI),
    caprazKurKontroluYok: evet(r.CAPRAZ_KUR_KONTROLU_YOK),
    kurYetkisi: kurYetkisiKoddan(r.KUR_YETKISI),
    kurTolerans: Math.max(0, sayi(r.KUR_TOLERANS_ORANI)),
    giseKuruDisinda: evet(r.GISE_KURU_DISINDA_OLABILIR),
    sapmaUyarisiYok: evet(r.SAPMA_UYARISI_VERILMESIN),
    masakUyarisi: evet(r.MASAK_UYARISI_VERSIN),
    calismaAlani: evet(r.ALAN_ISLEMLERI_YETKISI),
  };
};

// ───────────────────────────── Menü yetkileri (harf listesi) ─────────────────────────────

/** Bir menü kolonunun yazabildiği en çok harf (varchar(16)) */
export const MENU_HARF_SINIRI = 16;
export const MENU_HARFLERI = "ABCDEFGHIJKLMNOP";
/** Eski programın "hepsi" listesi: bu harflerin hepsi varsa menüde tam yetki (K6) */
const ESKI_HEPSI = "ABCDEFGHIJKLMN";
/** Hiçbir madde açık değil */
export const HIC_YETKI = "-";

/** Yeni ekranın yazdığı kısıtlı listenin sonundaki işaret: katı okunur (K6 kuralı uygulanmaz); eski program harf saymaz */
export const KATI_ISARET = "*";

/**
 * Harf listesi çözümü: null = tam yetki, boş küme = hiçbiri. İşaretsiz liste eski programındır: A–N'nin hepsi varsa
 * tam sayılır (K6, N sonrası maddeler lisansta açıksa açık). "*" ile biten liste yeni ekranındır, yalnız harfleri açar.
 */
export const harfListesi = (deger: unknown): Set<string> | null => {
  if (deger === null || deger === undefined) return null;
  const s = String(deger).trim();
  if (!s) return null;
  if (s === HIC_YETKI || s.toLocaleLowerCase("tr-TR") === "yetki yok") return new Set();
  // Harf listesi değilse (yeni ekranın eskiden yazdığı "Tam Yetki", "Kısıtlı"…) kısıtsız sayılır
  const m = /^([A-Z]+)(\*?)$/.exec(s);
  if (!m) return null;
  const kume = new Set(m[1].split(""));
  if (!m[2] && [...ESKI_HEPSI].every((h) => kume.has(h))) return null;
  return kume;
};

/**
 * Kullanıcı kartına yazılacak menü yetkisi değeri (eski programın okuyabileceği biçim): harf listesi olduğu gibi;
 * boş (kartta NULL'dı) → NULL kalır; "Yetki Yok" → "-"; harf dışı metin ("Tam Yetki", "Kısıtlı"…) → A–P. Yeni ekran
 * eskiden bu metinleri yazıyordu, eski program onları harf sanıp kullanıcıyı yetkisiz bırakıyordu.
 */
export const menuDegeriYaz = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (s === HIC_YETKI || /^[A-Z]+\*?$/.test(s)) return s.slice(0, MENU_HARF_SINIRI);
  if (s.toLocaleLowerCase("tr-TR") === "yetki yok") return HIC_YETKI;
  return MENU_HARFLERI;
};

export const harfAcik = (deger: unknown, harf: string): boolean => {
  const l = harfListesi(deger);
  return l === null || l.has(harf);
};

/** Ana menü (DashboardRoute key) → özgün harfi ve madde kolonu (null: yalnız ana menü harfiyle) */
export const ANA_MENULER: Record<string, { harf: string; alan: MenuYetkiAlani | null }> = {
  vezne: { harf: "A", alan: "cashier" },
  kasa: { harf: "B", alan: "safe" },
  kur: { harf: "C", alan: "exchange" },
  cari: { harf: "D", alan: "accounts" },
  yonetici: { harf: "E", alan: "admin" },
  banka: { harf: "F", alan: null },
  raporlar: { harf: "G", alan: "reports" },
  ebelge: { harf: "H", alan: null },
  etiket: { harf: "I", alan: null },
  perakende: { harf: "J", alan: null },
  ticari: { harf: "K", alan: null },
  ayarlar: { harf: "L", alan: "techOps" },
};

/** Kolonun sığmadığı maddeler (16 harf sonrası) bağlı oldukları maddenin yetkisini alır */
export const BAGLI_MADDELER: Record<string, Record<string, string>> = {
  vezne: { Q: "A", R: "E" },
};

/** Ana menü açık mı (ANA_MENU_YETKISI) */
export const anaMenuAcik = (y: KullaniciYetkisi, anaKey: string): boolean => {
  if (y.yonetici) return true;
  const a = ANA_MENULER[anaKey];
  return !a || harfAcik(y.menu.mainMenu, a.harf);
};

/** Ana menünün maddesi açık mı. harf: maddenin özgün harfi (gruplarda grubun harfi). */
export const menuMaddesiAcik = (y: KullaniciYetkisi, anaKey: string, harf: string | null | undefined): boolean => {
  if (y.yonetici) return true;
  if (!anaMenuAcik(y, anaKey)) return false;
  const a = ANA_MENULER[anaKey];
  if (!a?.alan || !harf) return true;
  const h = BAGLI_MADDELER[anaKey]?.[harf] ?? harf;
  if (MENU_HARFLERI.indexOf(h) < 0) return true;
  return harfAcik(y.menu[a.alan], h);
};

/** Menü adındaki harf: "A- Sarraf Fişi Kayıt" → "A" */
export const maddeHarfi = (ad: string | null | undefined): string | null => {
  const m = /^\s*([A-Z])\s*-/.exec(String(ad ?? ""));
  return m ? m[1] : null;
};

/**
 * Ekrandaki madde kutularından kolon değeri: işaretli harfler; menüde olmayan harfler (eski programın bizde bulunmayan
 * maddeleri) eski değerden korunur. Hepsi işaretliyse A–P (eski program da tam okur). Hiçbiri: "-" (eski program da
 * hiçbir harf bulmaz).
 */
export const harfListesiYaz = (eski: unknown, menuHarfleri: string[], secili: string[]): string => {
  const bizim = new Set(menuHarfleri.filter((h) => MENU_HARFLERI.includes(h)));
  const sec = new Set(secili.filter((h) => bizim.has(h)));
  const eskiL = harfListesi(eski);
  const harfler = [...MENU_HARFLERI].filter((h) => (bizim.has(h) ? sec.has(h) : eskiL === null || eskiL.has(h)));
  if (harfler.length === MENU_HARFLERI.length) return MENU_HARFLERI;
  return harfler.length ? harfler.join("") + KATI_ISARET : HIC_YETKI;
};

// ───────────────────────────── Gün sınırı, tarih ─────────────────────────────

/** "YYYY-MM-DD" (Türkiye saatiyle bugün ya da verilen an) */
export const trGunu = (an: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(an);

/** Herhangi bir tarih değerinin gün kısmı ("2026-10-15", "2026-10-15T17:09", Date) */
export const gunKismi = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : trGunu(v);
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s.slice(10))) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : trGunu(d);
};

/** Gösterim sınırının ilk günü ("YYYY-MM-DD"); sınır yoksa null. N gün = bugün dahil son N gün. */
export const gosterimBaslangici = (y: KullaniciYetkisi, bugun: string = trGunu()): string | null => {
  if (y.yonetici || !y.gosterimGunu) return null;
  const [Y, M, D] = bugun.split("-").map(Number);
  const t = new Date(Date.UTC(Y, M - 1, D - (y.gosterimGunu - 1)));
  return t.toISOString().slice(0, 10);
};

/** Kayıt tarihi gösterim sınırının içinde mi */
export const gosterimIcinde = (y: KullaniciYetkisi, kayitTarihi: unknown, bugun?: string): boolean => {
  const bas = gosterimBaslangici(y, bugun);
  if (!bas) return true;
  const g = gunKismi(kayitTarihi);
  return !g || g >= bas;
};

// ───────────────────────────── Kur yetkisi ─────────────────────────────

export interface GiseKuru {
  /** Fiş tipine göre esas kur (satışta satış, alışta alış kuru) */
  kur: number;
  alis?: number | null;
  satis?: number | null;
}

export interface KurDenetimi {
  /** Kayıt engeli (kur yetkisi / gişe aralığı) */
  hata: string | null;
  /** Gişe kurundan sapma (yüzde, işaretli) */
  sapma: number;
  /** Sapma uyarısı gösterilmeli mi (engel yoksa) */
  uyari: string | null;
}

const yuzde = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/**
 * Girilen kur, kullanıcının kur yetkisine ve gişe kuruna göre geçerli mi. Gişe kuru bilinmiyorsa denetlenmez.
 * pay: sunucuda, ekranın yüklediği kur ile kayıt anındaki kur arasındaki canlı güncelleme farkı için yüzde pay.
 */
export const kurDenetle = (y: KullaniciYetkisi, gise: GiseKuru | null | undefined, girilen: number, etiket = "Kur", pay = 0): KurDenetimi => {
  const ref = Number(gise?.kur) || 0;
  const k = Number(girilen) || 0;
  if (!(ref > 0) || !(k > 0)) return { hata: null, sapma: 0, uyari: null };
  const sapma = ((k - ref) / ref) * 100;
  const fark = Math.abs(sapma) > 1e-9;
  if (y.yonetici || !fark) return { hata: null, sapma, uyari: null };
  if (y.kurYetkisi === "Yok" && Math.abs(sapma) > pay + 1e-9) return { hata: `${etiket} değiştirme yetkiniz yok (gişe kuru ${ref}).`, sapma, uyari: null };
  if (y.kurYetkisi === "Limitli" && Math.abs(sapma) > y.kurTolerans + pay + 1e-9) {
    return { hata: `${etiket} gişe kurundan en çok %${yuzde(y.kurTolerans)} farklı olabilir (gişe ${ref}, sapma %${yuzde(sapma)}).`, sapma, uyari: null };
  }
  const alis = Number(gise?.alis) || 0;
  const satis = Number(gise?.satis) || 0;
  if (!y.giseKuruDisinda && alis > 0 && satis > 0) {
    const alt = Math.min(alis, satis) * (1 - pay / 100);
    const ust = Math.max(alis, satis) * (1 + pay / 100);
    if (k < alt - 1e-9 || k > ust + 1e-9) return { hata: `${etiket} gişe alış–satış aralığının (${alt} – ${ust}) dışında olamaz.`, sapma, uyari: null };
  }
  return { hata: null, sapma, uyari: y.sapmaUyarisiYok ? null : `${etiket} gişe kurundan %${yuzde(sapma)} farklı (gişe ${ref}).` };
};

/** Kur alanı ekranda değiştirilebilir mi */
export const kurDegistirilebilir = (y: KullaniciYetkisi): boolean => y.yonetici || y.kurYetkisi !== "Yok";

// ───────────────────────────── Yetki kutusuna bağlı sayfalar / raporlar ─────────────────────────────

type YetkiKutusu = "cariBakiye" | "acikVadeli" | "supheliIslem" | "calismaAlani";

/** Menü harfine ek olarak bir yetki kutusu isteyen sayfalar (adres, baştaki "/" olmadan) */
export const SAYFA_YETKI_KUTULARI: Record<string, YetkiKutusu> = {
  "raporlar/cari-ekstre": "cariBakiye",
  "raporlar/cari-bakiye": "cariBakiye",
  "raporlar/pos-ekstre": "cariBakiye",
  "raporlar/cari-hareket-listesi": "cariBakiye",
  "raporlar/vadeli-islem-listesi": "acikVadeli",
  "raporlar/masak-supheli": "supheliIslem",
  "raporlar/masak-fis-kontrol": "supheliIslem",
  "ayarlar/devir-islemi": "calismaAlani",
  "ayarlar/servis-islemleri": "calismaAlani",
};

/** Aynı kural rapor koduyla (sunucu) */
export const RAPOR_YETKI_KUTULARI: Record<string, YetkiKutusu> = {
  CAREKS1: "cariBakiye",
  CARBAK1: "cariBakiye",
  POSEKS1: "cariBakiye",
  CARHAR1: "cariBakiye",
  VADISL1: "acikVadeli",
  MSKSUP1: "supheliIslem",
  MSKKON1: "supheliIslem",
};

export const YETKI_KUTUSU_ADI: Record<YetkiKutusu, string> = {
  cariBakiye: "Cari bakiye görebilir",
  acikVadeli: "Açık vadeli işlemleri görebilir",
  supheliIslem: "Şüpheli işlemler yetkilisi",
  calismaAlani: "Çalışma alanı işlemleri yetkisi",
};

/** Sayfa (adres) yetki kutusunun izin verdiği bir sayfa mı */
export const sayfaKutusuAcik = (y: KullaniciYetkisi, yol: string): boolean => {
  const k = SAYFA_YETKI_KUTULARI[String(yol).replace(/^\/+|\/+$/g, "").toLowerCase()];
  return !k || y.yonetici || !!y[k];
};

// ───────────────────────────── Gişe kuru (kur tablosu) ─────────────────────────────

/** Anlık Fiyat Listesi satırı (kur tablosu TUR 0; boş alanlar günlük listeden dolar) */
export interface KurSatiri {
  paraId?: number;
  kod?: string | null;
  ad?: string | null;
  urunTipi?: number | null;
  efektifAlis?: number | null;
  efektifSatis?: number | null;
  dovizAlis?: number | null;
  dovizSatis?: number | null;
}

const pozitifKur = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Döviz fişi gişe kuru (DovizFisiPage resolveCurrencyRate ile aynı): kurTuru 0 efektif, 1 döviz; tip 0 alış, 1 satış.
 * Seçilen türde değer yoksa öbür tür. Aralık (alış–satış) aynı türden.
 */
export const dovizGiseKuru = (k: KurSatiri | null | undefined, tip: number, kurTuru: number): GiseKuru | null => {
  if (!k) return null;
  const ea = pozitifKur(k.efektifAlis), es = pozitifKur(k.efektifSatis), da = pozitifKur(k.dovizAlis), ds = pozitifKur(k.dovizSatis);
  const efektif = Number(kurTuru) === 0;
  const alis = efektif ? ea || da : da || ea;
  const satis = efektif ? es || ds : ds || es;
  const kur = Number(tip) === 0 ? alis : satis;
  return kur > 0 ? { kur, alis: alis || null, satis: satis || null } : null;
};

const buyuk = (s: unknown) => String(s ?? "").toLocaleUpperCase("tr-TR").trim();
const HAS_KODLARI = ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"];
// GMS: Hızlı Satış'ın gümüş kodu (hizliSatisHesap) — Hızlı Satış Sarraf satırları da bu uçtan kaydedilir
const GUMUS_KODLARI = ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS", "GMS"];

/**
 * Sarraf satırı gişe kuru (SarrafFisiPage getKurForProduct ile aynı): ürünün kendi kur satırı (efektif, yoksa döviz);
 * yoksa ziynette bilinmez, gümüşte gümüş has kuru, diğerlerinde altın has kuru.
 */
export const sarrafGiseKuru = (kurlar: KurSatiri[], urun: KurSatiri | null | undefined, tip: number): GiseKuru | null => {
  if (!urun) return null;
  const kod = buyuk(urun.kod);
  if (kod === "TL" || kod === "TRY" || kod === "TRL") return null;
  const satir = (k: KurSatiri | undefined): GiseKuru | null => {
    if (!k) return null;
    const alis = pozitifKur(k.efektifAlis) || pozitifKur(k.dovizAlis);
    const satis = pozitifKur(k.efektifSatis) || pozitifKur(k.dovizSatis);
    const kur = Number(tip) === 0 ? alis : satis;
    return kur > 0 ? { kur, alis: alis || null, satis: satis || null } : null;
  };
  const kendi = satir(kurlar.find((k) => (urun.paraId && k.paraId === urun.paraId) || (kod && buyuk(k.kod) === kod)));
  if (kendi) return kendi;
  if (Number(urun.urunTipi) === 3) return null;
  const gumus = Number(urun.urunTipi) === 2 || kod.includes("GUMUS") || kod.includes("GÜMÜŞ") || buyuk(urun.ad).includes("GÜMÜŞ");
  const liste = gumus ? GUMUS_KODLARI : HAS_KODLARI;
  return satir(kurlar.find((k) => liste.includes(buyuk(k.kod))));
};

// ───────────────────────────── Cari dekont çapraz kur kontrolü ─────────────────────────────

export interface DekontSatiri {
  /** 1 sol taraf, 0 sağ taraf (CariEmanetDekontPage) */
  tip?: number | null;
  paraId?: number | null;
  meblag?: number | string | null;
  kur?: number | string | null;
}

/**
 * Farklı dövizli (çapraz) emanet dekontta iki tarafın karşılığı (miktar × satır kuru) firma toleransı içinde eşit olmalı;
 * "Cari dekontta çapraz kur kontrolü yok" işaretli kullanıcıda ve has mutabakatında (kurCinsi 1) denetlenmez.
 * Hata metni ya da null döner.
 */
export const caprazKurDenetle = (y: KullaniciYetkisi, satirlar: DekontSatiri[], kurCinsi: unknown, tolerans: number): string | null => {
  if (y.yonetici || y.caprazKurKontroluYok || Number(kurCinsi) === 1) return null;
  const say = (v: unknown) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const dolu = (satirlar || []).filter((s) => say(s.meblag) > 0);
  const sol = dolu.filter((s) => Number(s.tip) === 1);
  const sag = dolu.filter((s) => Number(s.tip) !== 1);
  if (!sol.length || !sag.length) return null;
  const paralar = (l: DekontSatiri[]) => [...new Set(l.map((s) => Number(s.paraId)))].sort().join(",");
  if (paralar(sol) === paralar(sag)) return null;
  const toplam = (l: DekontSatiri[]) => l.reduce((a, s) => a + say(s.meblag) * (say(s.kur) || 1), 0);
  const fark = Math.abs(toplam(sol) - toplam(sag));
  const sinir = Math.max(Number(tolerans) || 0, 0.01);
  if (fark <= sinir + 1e-9) return null;
  return `Çapraz kur kontrolü: iki tarafın karşılığı eşit değil (fark ${fark.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}, tolerans ${sinir.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}).`;
};
