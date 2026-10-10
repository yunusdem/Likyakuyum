import { DashboardMenu } from "routes/DashboardRoute";
import { MenuItemType } from "types/menuTypes";

/**
 * Sol menü birleşimi (docs/SOL_MENU_BIRLESTIRME.md). Menü tanımı (DashboardRoute) ve modül kodları DEĞİŞMEZ; birleştirme
 * yalnız çizimde, firma süzmesinden (menuyuSuz) SONRA yapılır. Böylece yönetim panelindeki modül ayarları ve sunucunun
 * API izinleri eskisi gibi çalışır.
 *  - "gelen" menünün maddeleri "ev" menünün sonuna eklenir; harfleri ev menünün son harfinden devam eder (S2).
 *  - Aynı sayfayı açan madde ev menüde ya da Yönetici dışındaki başka bir menüde zaten varsa eklenmez (S3).
 *  - Ana başlık harfleri baştan dizilir (S4).
 */
const BIRLESIMLER: { ev: string; gelen: string; baslik?: string }[] = [
  { ev: "vezne", gelen: "kur", baslik: "Vezne / Kur İşlemleri" },
  { ev: "kasa", gelen: "banka", baslik: "Kasa / Banka İşlemleri" },
  { ev: "yonetici", gelen: "ebelge" },
  { ev: "etiket", gelen: "perakende", baslik: "Etiket / Perakende İşlemleri" },
];

const HARFLER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ON_EK = /^\s*([A-Za-zÇĞİÖŞÜçğıöşü])\s*[-–—]\s*/;

const harfSirasi = (metin?: string): number => {
  const m = (metin || "").match(ON_EK);
  if (!m) return -1;
  const h = m[1].toLocaleUpperCase("tr-TR");
  return HARFLER.indexOf(h === "İ" ? "I" : h);
};
const harfsiz = (metin?: string): string => (metin || "").replace(ON_EK, "");
const harfle = (sira: number, metin?: string): string => `${HARFLER[sira] ?? "?"}- ${harfsiz(metin)}`;

const yol = (link: string): string => link.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
const yollar = (oge: MenuItemType): string[] => [
  ...(oge.link ? [yol(oge.link)] : []),
  ...(oge.children || []).flatMap(yollar),
];
const anaYollari = (ana: MenuItemType): string[] => (ana.children?.length ? ana.children.flatMap(yollar) : yollar(ana));

/** Gelen menünün maddeleri; alt öğesi olmayan bağlantılı menü (H- e-Belge) tek madde sayılır. */
const maddeler = (ana: MenuItemType): MenuItemType[] =>
  ana.children?.length ? ana.children : ana.link ? [{ id: ana.id, name: ana.title, link: ana.link }] : [];

/** Madde, kümede zaten bulunan sayfaları açıyorsa (alt grupta: tüm sayfaları kümedeyse) eşi var demektir. */
const esiVar = (oge: MenuItemType, kume: Set<string>): boolean => {
  const y = yollar(oge);
  return y.length > 0 && y.every((p) => kume.has(p));
};

const sonHarf = (ogeler: MenuItemType[]): number => Math.max(-1, ...ogeler.map((o) => harfSirasi(o.name || o.title)));

/** Eş denetimi kümesi: ev menünün sayfaları + Yönetici ve gelen menüler dışındaki tüm menülerin sayfaları. */
const esKumesi = (menu: MenuItemType[], evKey: string): Set<string> => {
  const gelenler = new Set(BIRLESIMLER.map((b) => b.gelen));
  const kume = new Set<string>();
  for (const ana of menu) {
    if (!ana.key || gelenler.has(ana.key)) continue;
    if (ana.key === "yonetici" && evKey !== "yonetici") continue;
    anaYollari(ana).forEach((p) => kume.add(p));
  }
  return kume;
};

const oge = (menu: MenuItemType[], key: string) => menu.find((m) => m.key === key);

/** Süzmesiz tam menüye göre gelen maddelerin harfleri: firma süzmesi harfleri kaydırmasın (madde id → harf sırası). */
let tamHarflerOnbellek: Map<string, number> | null = null;
const tamHarfler = (): Map<string, number> => {
  if (tamHarflerOnbellek) return tamHarflerOnbellek;
  const harf = new Map<string, number>();
  for (const b of BIRLESIMLER) {
    const ev = oge(DashboardMenu, b.ev);
    const gelen = oge(DashboardMenu, b.gelen);
    if (!ev || !gelen) continue;
    const kume = esKumesi(DashboardMenu, b.ev);
    let sira = sonHarf(ev.children || []);
    for (const m of maddeler(gelen)) if (!esiVar(m, kume)) harf.set(m.id, ++sira);
  }
  tamHarflerOnbellek = harf;
  return harf;
};

/** Firmaya göre süzülmüş sol menüyü (menuyuSuz sonucu) birleşik hale getirir. */
export const solMenuyuBirlestir = (suzulmus: MenuItemType[]): MenuItemType[] => {
  const harf = tamHarfler();
  const gelenler = new Set(BIRLESIMLER.map((b) => b.gelen));
  const birlesik = new Map<string, MenuItemType>();

  for (const b of BIRLESIMLER) {
    const gelen = oge(suzulmus, b.gelen);
    const ev = oge(suzulmus, b.ev);
    if (!gelen) continue;
    // Ev menü firmaya kapalıysa başlık yalnız gelen maddelerle çizilir; madde kaybolmaz
    const kabuk = ev || oge(DashboardMenu, b.ev);
    if (!kabuk) continue;

    const kume = esKumesi(suzulmus, b.ev);
    const mevcut = ev?.children || [];
    // Tam menüde eşi olduğu için harf almamış madde (firmada eşi kapalı) en sona, son harften sonra gelir
    let sira = Math.max(
      sonHarf([...mevcut, ...(oge(DashboardMenu, b.ev)?.children || [])]),
      ...maddeler(oge(DashboardMenu, b.gelen) || gelen).map((m) => harf.get(m.id) ?? -1)
    );
    const planli: MenuItemType[] = [];
    const sonaKalan: MenuItemType[] = [];
    for (const m of maddeler(gelen)) {
      if (esiVar(m, kume)) continue;
      const s = harf.get(m.id);
      (s === undefined ? sonaKalan : planli).push(m);
      yollar(m).forEach((p) => kume.add(p));
    }
    const eklenen = [...planli, ...sonaKalan].map((m) => {
      const s = harf.get(m.id) ?? ++sira;
      return m.name ? { ...m, name: harfle(s, m.name) } : { ...m, title: harfle(s, m.title) };
    });
    if (!eklenen.length) continue;

    birlesik.set(b.ev, {
      ...kabuk,
      title: b.baslik ? harfle(0, b.baslik) : kabuk.title,
      link: undefined,
      children: [...mevcut, ...eklenen],
    });
  }

  // Tam menü sırasıyla diz: gelen menüler kalkar, ev menüler birleşik haliyle yerinde durur
  const sonuc: MenuItemType[] = [];
  for (const tam of DashboardMenu) {
    if (tam.key && gelenler.has(tam.key)) continue;
    const yeni = (tam.key && birlesik.get(tam.key)) || suzulmus.find((m) => m.id === tam.id);
    if (yeni) sonuc.push(yeni);
  }

  // Ana başlık harfleri baştan
  let ana = 0;
  return sonuc.map((m) => (m.grouptitle || harfSirasi(m.title) < 0 ? m : { ...m, title: harfle(ana++, m.title) }));
};
