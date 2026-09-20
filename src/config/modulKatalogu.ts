import { DashboardMenu } from "routes/DashboardRoute";
import { MenuItemType } from "types/menuTypes";

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
  { key: "ust:banka", baslik: "Banka", to: "/banka/hareketler" },
  { key: "ust:c-hareket", baslik: "C. Hareket", to: "/cari/hareket-kayit" },
  { key: "ust:e-belge", baslik: "e-Belge", to: "/e-belge" },
  { key: "ust:masak", baslik: "MASAK" },
];

export const UST_KISAYOL_GRUBU = "ust";

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
 * Adres çubuğundan doğrudan gidilen sayfa firmaya kapalı mı? Bir adres menüde/üst çubukta birden fazla yerde
 * geçebilir; herhangi biri açıksa sayfa açıktır. Menüde hiç geçmeyen adresler (ara sayfalar, takma adlar) kısıtlanmaz.
 */
export const sayfaKapaliMi = (acik: string[] | null | undefined, pathname: string): boolean => {
  if (!acik) return false;
  const yol = yolTemizle(pathname).replace(/\/+$/, "");
  if (!yol) return false;

  const kodlar: string[] = [];
  const tara = (anaKey: string, ogeler: MenuItemType[]) => {
    for (const oge of ogeler) {
      if (oge.link && yolTemizle(oge.link) === yol) kodlar.push(menuOgesiKodu(anaKey, oge));
      if (oge.children?.length) tara(anaKey, oge.children);
    }
  };
  for (const ana of DashboardMenu) {
    if (!ana.key) continue;
    if (ana.link && yolTemizle(ana.link) === yol) kodlar.push(ana.key);
    if (ana.children?.length) tara(ana.key, ana.children);
  }
  for (const k of UST_KISAYOLLAR) if (k.to && yolTemizle(k.to) === yol) kodlar.push(k.key);

  return kodlar.length > 0 && !kodlar.some((k) => acik.includes(k));
};
