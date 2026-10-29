import { DashboardMenu } from "routes/DashboardRoute";
import { MenuItemType } from "types/menuTypes";
import { KullaniciYetkisi, anaMenuAcik, maddeHarfi, menuMaddesiAcik, sayfaKutusuAcik } from "../../Backend/src/services/yetki/kullaniciYetkiKural";

/**
 * Modül kataloğu: yönetim panelinden firma bazında açılıp kapatılan her şey (docs/ADMIN_PANEL_YOL_HARITASI.md, Faz 4).
 * TEK KAYNAK sol menü tanımıdır (routes/DashboardRoute.tsx) + aşağıdaki üst kısayol listesi. Yönetim paneli bu kataloğu
 * sunucuya gönderir (ADM_MODUL); kullanıcı uygulaması aynı kodlarla menüyü, üst çubuğu ve sayfaları filtreler.
 *
 * Kodlar kalıcıdır — DEĞİŞTİRMEYİN: firmaların ayarı bu kodlara bağlıdır. Başlık serbestçe değişebilir.
 *   ana menü : DashboardRoute'taki `key`           → "vezne"
 *   alt öğe  : <ana>:<link>                        → "vezne:vezne/sarraf-fisi-kayit"
 *   alt grup : <ana>:#<başlıktan türetilen ad>     → "raporlar:#vezne-raporlari"
 *   üst çubuk: ust:<ad>                            → "ust:masak"
 */

export type ModulTuru = "ANA" | "ALT" | "UST_KISAYOL";

export interface ModulKaydi {
  modulKodu: string;
  ustKodu: string | null;
  baslik: string;
  tur: ModulTuru;
  sira: number;
}

/** Üst kısayol çubuğu. `to`, Header'daki quickActions ile eşleşir; MASAK bir açılır menüdür, adresi yoktur. */
export const UST_KISAYOLLAR: { key: string; baslik: string; to?: string }[] = [
  { key: "ust:kur", baslik: "Kur", to: "/kur/anlik-fiyat-listesi" },
  { key: "ust:vezne-izleme", baslik: "Vezne İzleme", to: "/vezne/izleme" },
  { key: "ust:fiyat", baslik: "Fiyat", to: "/etiket/barkod-basimi" },
  { key: "ust:sarraf", baslik: "Sarraf", to: "/vezne/genel-sarraf-fisi" },
  { key: "ust:doviz", baslik: "Döviz", to: "/vezne/doviz-fisi" },
  { key: "ust:perakende", baslik: "Perakende", to: "/vezne/perakende-fisi-kayit" },
  // Ticari satış fişi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T18)
  { key: "ust:ticari", baslik: "Satış Fişi", to: "/ticari/satis-fisi" },
  // Ticari Fiyat Gör (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 2, G4): Kuyum'un "Fiyat" düğmesinden ayrı
  { key: "ust:ticari-fiyat", baslik: "T. Fiyat", to: "/ticari/fiyat-gor" },
  { key: "ust:banka", baslik: "Banka", to: "/banka/hareketler" },
  { key: "ust:vezne-transfer", baslik: "V. Transfer", to: "/vezne/transfer-kayit" },
  { key: "ust:c-hareket", baslik: "C. Hareket", to: "/cari/hareket-kayit" },
  { key: "ust:e-belge", baslik: "e-Belge", to: "/e-belge" },
  { key: "ust:masak", baslik: "MASAK" },
  { key: "ust:piyasa", baslik: "Piyasa", to: "/piyasa" },
  // Hızlı Satış (docs/HIZLI_SATIS_YOL_HARITASI.md, H2–H3): firmada açık modüllerin hızlı satışına götürür
  { key: "ust:hizli-satis", baslik: "Hızlı Satış", to: "/hizli-satis" },
];

export const UST_KISAYOL_GRUBU = "ust";

/**
 * Menüde maddesi olmayan ama lisansa ayrıca bağlanan sayfalar. Panelde ana menüsünün altında seçenek olarak görünür;
 * sayfa ancak ana sayfası (anaYol) AÇIK ve kendi kodu açıksa açılır. Menüye madde eklenmediği için kullanıcı menü
 * harflerine dokunulmaz, kullanıcı yetkisi ana sayfanınkiyle denetlenir.
 * e-Gider Pusulası (docs/E_GIDER_YOL_HARITASI.md K15, K18, K21): Kuyum paketinde ve ERP'de açık.
 */
export const SANAL_SAYFALAR: { kod: string; ustKodu: string; baslik: string; yol: string; anaYol: string }[] = [
  { kod: "ebelge:e-belge/gider", ustKodu: "ebelge", baslik: "e-Gider Pusulası", yol: "e-belge/gider", anaYol: "e-belge" },
];
const SANAL_KODLAR = new Set(SANAL_SAYFALAR.map((s) => s.kod));

const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u" };
const adaCevir = (metin: string): string =>
  metin
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (h) => TR[h])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const yolTemizle = (link: string): string => link.replace(/^\/+/, "");

/** Menü öğesinin modül kodu. anaKey: ait olduğu ana menünün `key`'i. */
export const menuOgesiKodu = (anaKey: string, oge: MenuItemType): string =>
  oge.link ? `${anaKey}:${yolTemizle(oge.link)}` : `${anaKey}:#${adaCevir(oge.name || oge.title || "")}`;

let onbellek: ModulKaydi[] | null = null;

export const modulKatalogu = (): ModulKaydi[] => {
  if (onbellek) return onbellek;
  const liste: ModulKaydi[] = [];
  let sira = 0;

  const altlariEkle = (anaKey: string, ustKodu: string, ogeler: MenuItemType[]) => {
    for (const oge of ogeler) {
      const kod = menuOgesiKodu(anaKey, oge);
      // Aynı sayfa bir ana menüde iki kez geçiyorsa ilk geçtiği yer katalogdaki yeridir
      if (!liste.some((m) => m.modulKodu === kod)) {
        liste.push({ modulKodu: kod, ustKodu, baslik: oge.name || oge.title || kod, tur: "ALT", sira: sira++ });
      }
      if (oge.children?.length) altlariEkle(anaKey, kod, oge.children);
    }
  };

  for (const ana of DashboardMenu) {
    if (!ana.key || ana.grouptitle) continue;
    liste.push({ modulKodu: ana.key, ustKodu: null, baslik: ana.title || ana.key, tur: "ANA", sira: sira++ });
    if (ana.children?.length) altlariEkle(ana.key, ana.key, ana.children);
  }

  // Menü dışı sanal sayfalar: ana menüsünün altında seçenek
  for (const s of SANAL_SAYFALAR) {
    if (!liste.some((m) => m.modulKodu === s.kod)) {
      liste.push({ modulKodu: s.kod, ustKodu: s.ustKodu, baslik: s.baslik, tur: "ALT", sira: sira++ });
    }
  }

  // Üst kısayollar panelde tek başlık altında görünsün diye sanal bir grup altında tutulur
  liste.push({ modulKodu: UST_KISAYOL_GRUBU, ustKodu: null, baslik: "Üst Kısayol Çubuğu", tur: "ANA", sira: sira++ });
  for (const k of UST_KISAYOLLAR) {
    liste.push({ modulKodu: k.key, ustKodu: UST_KISAYOL_GRUBU, baslik: k.baslik, tur: "UST_KISAYOL", sira: sira++ });
  }

  onbellek = liste;
  return liste;
};

/** acik === null/undefined → kısıt yok (yönetim paneli kapalı ya da firmaya modül ayarı yapılmamış). */
export const modulAcikMi = (acik: string[] | null | undefined, kod: string): boolean => !acik || acik.includes(kod);

/** Sol menüyü firmaya açık modüllere göre süzer. Alt öğesi kalmayan grup ve ana menü gizlenir. */
export const menuyuSuz = (menu: MenuItemType[], acik: string[] | null | undefined): MenuItemType[] => {
  if (!acik) return menu;
  const kume = new Set(acik);

  const altlariSuz = (anaKey: string, ogeler: MenuItemType[]): MenuItemType[] =>
    ogeler.flatMap((oge) => {
      if (!kume.has(menuOgesiKodu(anaKey, oge))) return [];
      if (!oge.children?.length) return [oge];
      const cocuklar = altlariSuz(anaKey, oge.children);
      return cocuklar.length ? [{ ...oge, children: cocuklar }] : [];
    });

  return menu.flatMap((ana) => {
    if (!ana.key || ana.grouptitle) return [ana];
    if (!kume.has(ana.key)) return [];
    if (!ana.children?.length) return [ana];
    const cocuklar = altlariSuz(ana.key, ana.children);
    return cocuklar.length ? [{ ...ana, children: cocuklar }] : [];
  });
};

/**
 * Sol menüyü kullanıcının kart yetkilerine göre süzer (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.1): ana menü harfi
 * (ANA_MENU_YETKISI) ve ana menünün madde harfleri (VEZNE_ISLEMLERI_YETKISI …). Harfler menü adlarındaki özgün harflerdir;
 * birleşik sol menü (solMenuBirlesimi) bu süzmeden SONRA çizilir. Gruplar (e-Banka, MASAK) tek madde sayılır.
 */
export const menuyuKullaniciyaSuz = (menu: MenuItemType[], y: KullaniciYetkisi): MenuItemType[] => {
  if (y.yonetici) return menu;
  // Yetki kutusuna bağlı sayfalar (cari bakiye raporları, şüpheli işlem listeleri …) gruplarının içinde de süzülür
  const kutular = (ogeler: MenuItemType[]): MenuItemType[] =>
    ogeler.flatMap((oge) => {
      if (oge.link && !sayfaKutusuAcik(y, oge.link)) return [];
      if (!oge.children?.length) return [oge];
      const c = kutular(oge.children);
      return c.length ? [{ ...oge, children: c }] : [];
    });
  return menu.flatMap((ana) => {
    if (!ana.key || ana.grouptitle) return [ana];
    if (!anaMenuAcik(y, ana.key)) return [];
    if (!ana.children?.length) return [ana];
    const cocuklar = kutular(ana.children.filter((oge) => menuMaddesiAcik(y, ana.key!, maddeHarfi(oge.name || oge.title))));
    return cocuklar.length ? [{ ...ana, children: cocuklar }] : [];
  });
};

/** Modül kodu → ana menüsü ve ana menüdeki özgün harfi (gruptaki madde grubun harfini alır; ana menünün kendisi: null) */
let kodHarfOnbellegi: Map<string, { anaKey: string; harf: string | null }> | null = null;
const kodHarfleri = () => {
  if (kodHarfOnbellegi) return kodHarfOnbellegi;
  const m = new Map<string, { anaKey: string; harf: string | null }>();
  const tara = (anaKey: string, ogeler: MenuItemType[], harf: string | null) => {
    for (const oge of ogeler) {
      const h = harf ?? maddeHarfi(oge.name || oge.title);
      m.set(menuOgesiKodu(anaKey, oge), { anaKey, harf: h });
      if (oge.children?.length) tara(anaKey, oge.children, h);
    }
  };
  for (const ana of DashboardMenu) {
    if (!ana.key) continue;
    m.set(ana.key, { anaKey: ana.key, harf: null });
    if (ana.children?.length) tara(ana.key, ana.children, null);
  }
  kodHarfOnbellegi = m;
  return m;
};

/**
 * Takma ad adresler (App.tsx'te menüdeki bir ekranı açan, menüde geçmeyen yollar) → asıl menü adresi. Sayfa koruması
 * takma adı asıl adresiyle denetler; yoksa kapalı bir ekran takma adla açılabiliyordu (ör. Kuyum lisansında Döviz Fişi).
 * Anahtar ve değer yolAnahtari biçiminde (baş/son "/" yok, küçük harf).
 */
const SAYFA_TAKMA_ADLARI: Record<string, string> = {
  // Ayarlar / tanımlar
  "tanimlar/kullanici-tanimlari": "ayarlar/kullanici-tanimlari",
  "tanimlar/firma-tanimlari": "ayarlar/firma-tanimlari",
  "tanimlar/vezne-tanimlari": "ayarlar/vezne-tanimlari",
  "tanimlar/yazici-tanimlari": "ayarlar/yazici-tanimlari",
  "tanimlar/urun-tanimlari": "ayarlar/urun-tanimlari",
  "tanimlar/istatistik-tanimlari": "ayarlar/istatistik-tanimlari",
  "tanimlar/numeratorler": "ayarlar/numeratorler",
  "ayarlar/numaratorler": "ayarlar/numeratorler",
  "ayarlar/numarator-tanimlari": "ayarlar/numeratorler",
  "tanimlar/numarator-tanimlari": "ayarlar/numeratorler",
  "ayarlar/numerator-tanimlari": "ayarlar/numeratorler",
  "tanimlar/numerator-tanimlari": "ayarlar/numeratorler",
  "tanimlar/iskonto-tanimlari": "ayarlar/iskonto-tanimlari",
  "ayarlar/iskonto": "ayarlar/iskonto-tanimlari",
  "tanimlar/iskonto": "ayarlar/iskonto-tanimlari",
  "tanimlar/banknot-tanimlari": "ayarlar/banknot-tanimlari",
  "masak": "ayarlar/masak-dondurulanlar",
  // Cari
  "cari/kayit": "cari/kart-kayit",
  "cari/cari-kart-kayit": "cari/kart-kayit",
  "cari/listesi": "cari/kart-listesi",
  "cari/cari-kart-listesi": "cari/kart-listesi",
  "cari/hareketler": "cari/hareket-listesi",
  "cari/emanet-dekont-duzeltme": "cari/emanet-duzeltme",
  "cari/emanet-dekont-kayit": "cari/emanet-dekont",
  "cari/emanet-kayit": "cari/emanet-dekont",
  "cari/cari-emanet-dekont": "cari/emanet-dekont",
  "cari/emanet": "cari/emanet-dekont",
  // Vezne
  "vezne/doviz-fis": "vezne/doviz-fisi-kayit",
  "vezne/doviz-fis-duzeltme": "vezne/doviz-fisi-duzeltme",
  "vezne/vezne-transferi-kayit": "vezne/transfer-kayit",
  "vezne/vezne-transferi": "vezne/transfer-kayit",
  "vezne/transfer": "vezne/transfer-kayit",
  "vezne/vezne-transferi-duzeltme": "vezne/transfer-duzeltme",
  "vezne/vezne-izleme": "vezne/izleme",
  "vezne/para-sayma": "vezne/para-say",
  "vezne/vezne-para-say": "vezne/para-say",
  "vezne/sarraf-fisi": "vezne/sarraf-fisi-kayit",
  // Perakende
  "vezne/perakende-fisi": "vezne/perakende-fisi-kayit",
  "vezne/perakende-fis": "vezne/perakende-fisi-kayit",
  "vezne/perakende": "vezne/perakende-fisi-kayit",
  "perakende/perakende-fisi-kayit": "vezne/perakende-fisi-kayit",
  "perakende/satis": "vezne/perakende-fisi-kayit",
  "vezne/perakende-duzeltme": "vezne/perakende-fisi-duzeltme",
  "perakende/perakende-fisi-duzeltme": "vezne/perakende-fisi-duzeltme",
  "perakende/vitrin-stok-takibi": "perakende/vitrin-stok",
  "perakende/altin-listesi": "perakende/barkodlu-altin-listesi",
  "perakende/ozel-urun-listesi": "perakende/barkodlu-ozel-urun-listesi",
  "perakende/liste": "perakende/satis-listesi",
  // Kur
  "kur/gunluk-fiyat-listesi": "kur/anlik-fiyat-listesi",
  "tanimlar/pano-tanimi": "kur/pano-tanimi",
  // Banka
  "banka/hesap-karti": "banka/hesap-kartlari",
  "banka/pos-cihazi-tanimlari": "banka/pos-tanimlari",
  "banka/hesap-hareketleri": "banka/hareketler",
  // Kasa
  "kasa/kasa-hareket-kayit": "kasa/hareket-kayit",
  "kasa/hareket": "kasa/hareket-kayit",
  "kasa/kasa-hareket": "kasa/hareket-kayit",
  "kasa/kasa-hareket-duzeltme": "kasa/hareket-duzeltme",
  // Etiket
  "etiket/altin-urun-tanimlama": "etiket/altin-urun-barkodlama",
  "etiket/ozel-urun-tanimlama": "etiket/ozel-urun-barkodlama",
  "etiket/konsinye-altin-urun": "etiket/consinye-altin-urun",
  "etiket/konsinye-ozel-urun": "etiket/consinye-ozel-urun",
  "etiket/tasarim": "etiket/altin-etiket-tasarimi",
  "etiket/barkodlu-sayim-fisi": "etiket/sayim-fisi",
  // Menü dışı alt sayfalar: ait oldukları menü maddesiyle açılıp kapanır
  "e-belge/gelen": "e-belge",
  "e-belge/dogrula": "e-belge",
  "e-belge/giden": "e-belge",
  "e-belge/irsaliye": "e-belge",
  // e-belge/gider takma ad değil: kendi sanal kodu var (SANAL_SAYFALAR)
  "e-belge/kaynak": "e-belge",
  "e-belge/mustahsil": "e-belge",
  "ayarlar/e-belge": "e-belge",
  "tanimlar/e-belge": "e-belge",
  "etiket/fiyat-etiketi": "etiket/barkod-fiyat",
  "etiket/rfid": "etiket/rfid-sayim",
  "etiket/rfid-etiket-uretim": "etiket/rfid-sayim",
  "raporlar/cari-hareket-listesi": "cari/hareket-listesi",
  "raporlar/cari-kart-listesi": "cari/kart-listesi",
};

/** Adresin karşılaştırma biçimi: baştaki/sondaki "/" atılır, küçük harf (yönlendirici adresleri büyük/küçük harf ayırmaz) */
const yolAnahtari = (yol: string): string => yolTemizle(yol).replace(/\/+$/, "").toLowerCase();

/**
 * Adresi açan menü maddelerinin kod zincirleri (ana menü → grup → madde) ve üst kısayol kodları. Takma ad adresler
 * (App.tsx'te aynı ekranı açan menü dışı yollar) asıl adresine çevrilir.
 */
const adresZincirleri = (pathname: string): string[][] => {
  const ham = yolAnahtari(pathname);
  // Sanal sayfa: ana sayfasının zincirlerine kendi kodu eklenir (ikisi de açık olmalı)
  const sanal = SANAL_SAYFALAR.find((s) => s.yol === ham);
  if (sanal) return adresZincirleri(sanal.anaYol).map((z) => [...z, sanal.kod]);
  const yol = SAYFA_TAKMA_ADLARI[ham] ?? ham;
  if (!yol) return [];
  const zincirler: string[][] = [];
  const tara = (anaKey: string, ogeler: MenuItemType[], ustler: string[]) => {
    for (const oge of ogeler) {
      const kod = menuOgesiKodu(anaKey, oge);
      if (oge.link && yolAnahtari(oge.link) === yol) zincirler.push([...ustler, kod]);
      if (oge.children?.length) tara(anaKey, oge.children, [...ustler, kod]);
    }
  };
  for (const ana of DashboardMenu) {
    if (!ana.key) continue;
    if (ana.link && yolAnahtari(ana.link) === yol) zincirler.push([ana.key]);
    if (ana.children?.length) tara(ana.key, ana.children, [ana.key]);
  }
  for (const k of UST_KISAYOLLAR) if (k.to && yolAnahtari(k.to) === yol) zincirler.push([k.key]);
  return zincirler;
};

/**
 * Adres çubuğundan doğrudan gidilen sayfa firmaya kapalı mı? Bir adres menüde/üst çubukta birden fazla yerde
 * geçebilir; herhangi biri açıksa sayfa açıktır. Menü maddesi, sol menüdeki gibi ancak üst menüsü (ve grubu) da açıksa
 * açık sayılır. Menüde hiç geçmeyen adresler (ara sayfalar) kısıtlanmaz; takma adlar asıl adresiyle denetlenir.
 */
export const sayfaKapaliMi = (acik: string[] | null | undefined, pathname: string): boolean => {
  if (!acik) return false;
  const zincirler = adresZincirleri(pathname);
  return zincirler.length > 0 && !zincirler.some((z) => z.every((k) => acik.includes(k)));
};

/** Kod zinciri (ana menü → madde …) kullanıcının menü yetkisinde açık mı */
const zincirKullaniciyaAcik = (y: KullaniciYetkisi, zincir: string[]): boolean => {
  // Sanal sayfa kodunun menü harfi yok: kullanıcı yetkisi ana sayfasının menü maddesiyle denetlenir
  const gercek = zincir.filter((k) => !SANAL_KODLAR.has(k));
  const madde = gercek[1] ?? gercek[0];
  const bilgi = kodHarfleri().get(madde);
  return !bilgi || menuMaddesiAcik(y, bilgi.anaKey, bilgi.harf);
};

/**
 * Sayfaya gidilebilir mi: firmanın lisansında açık (sayfaKapaliMi) VE kullanıcının menü yetkisinde açık. Kullanıcı için
 * sayfanın menüdeki maddelerinden biri yetkide olmalı; yalnız üst kısayolda bulunan sayfalar (Piyasa, Hızlı Satış
 * yönlendirmesi) menü yetkisine bağlı değildir. Menüde hiç geçmeyen adresler kısıtlanmaz.
 */
export const sayfaErisimi = (acik: string[] | null | undefined, y: KullaniciYetkisi | null | undefined, pathname: string): boolean => {
  if (sayfaKapaliMi(acik, pathname)) return false;
  if (!y || y.yonetici) return true;
  const ham = yolAnahtari(pathname);
  if (!sayfaKutusuAcik(y, ham) || !sayfaKutusuAcik(y, SAYFA_TAKMA_ADLARI[ham] ?? ham)) return false;
  const menuZincirleri = adresZincirleri(pathname).filter((z) => !z[0].startsWith(`${UST_KISAYOL_GRUBU}:`));
  return menuZincirleri.length === 0 || menuZincirleri.some((z) => zincirKullaniciyaAcik(y, z));
};

/**
 * Sayfa içindeki ürüne özel seçenekler (süzgeç, sekme, düğme) için: ilgili fiş sayfalarından biri firmaya açıksa özellik
 * açıktır. Sayfa yoluna göre bakılır; böylece aynı sayfanın Vezne / Yönetici / üst çubuk kodlarından biri açıksa yeter
 * ve lisans paketi + elle yapılan istisnalar kendiliğinden geçerli olur. acik null → kısıt yok, hepsi açık.
 */
const OZELLIK_SAYFALARI = {
  sarraf: ["vezne/sarraf-fisi-kayit", "vezne/sarraf-fisi-duzeltme", "vezne/genel-sarraf-fisi"],
  perakende: ["vezne/perakende-fisi-kayit", "vezne/perakende-fisi-duzeltme"],
  doviz: ["vezne/doviz-fisi-kayit", "vezne/doviz-fisi-duzeltme", "vezne/doviz-fisi"],
  emanet: ["cari/emanet-dekont", "cari/emanet-duzeltme"],
  etiket: ["etiket/barkod-fiyat", "etiket/altin-urun-barkodlama", "etiket/ozel-urun-barkodlama", "etiket/barkod-basimi"],
  ticari: ["ticari/satis-fisi", "ticari/satis-fisi-duzeltme", "ticari/satis-listesi"],
} as const;

export type UrunOzellikleri = Record<keyof typeof OZELLIK_SAYFALARI | "kuyum" | "egider", boolean>;

export const urunOzellikleri = (acik: string[] | null | undefined): UrunOzellikleri => {
  const bak = (yollar: readonly string[]) => !acik || yollar.some((y) => !sayfaKapaliMi(acik, y));
  const sarraf = bak(OZELLIK_SAYFALARI.sarraf);
  const perakende = bak(OZELLIK_SAYFALARI.perakende);
  const etiket = bak(OZELLIK_SAYFALARI.etiket);
  return {
    sarraf,
    perakende,
    doviz: bak(OZELLIK_SAYFALARI.doviz),
    emanet: bak(OZELLIK_SAYFALARI.emanet),
    etiket,
    ticari: bak(OZELLIK_SAYFALARI.ticari),
    // Kuyumcu ayarları (işçilik, has altın, sarrafiye sınırı…): kuyum fişlerinden biri açıksa
    kuyum: sarraf || perakende || etiket,
    // e-Gider Pusulası (docs/E_GIDER_YOL_HARITASI.md K15): kendi lisans seçeneği
    egider: !acik || !sayfaKapaliMi(acik, "e-belge/gider"),
  };
};
