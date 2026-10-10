import { DashboardMenu } from "routes/DashboardRoute";
import { MenuItemType } from "types/menuTypes";

/**
 * Sol menü birleşimi (docs/SOL_MENU_BIRLESTIRME.md). Menü tanımı (DashboardRoute) ve modül kodları DEĞİŞMEZ; birleştirme
 * yalnız çizimde, firma süzmesinden (menuyuSuz) SONRA yapılır. Böylece yönetim panelindeki modül ayarları ve sunucunun
 * API izinleri eskisi gibi çalışır.
 *  - "gelen" menünün maddeleri (ya da `yalniz` ile seçilenleri) "ev" menünün sonuna eklenir; harfleri ev menünün son
 *    harfinden devam eder (S2).
 *  - Aynı sayfayı açan madde ev menüde ya da Yönetici dışındaki başka bir menüde zaten varsa eklenmez (S3).
 *  - Menüden kaldırılan maddeler (S8) çizilmez; sayfaları adresle açılmaya devam eder. Kaldırılan/taşınan maddenin
 *    ardındakilerin harfi kayar.
 *  - Ana başlık harfleri baştan dizilir (S4).
 */
const BIRLESIMLER: { ev: string; gelen: string; baslik?: string; yalniz?: (m: MenuItemType) => boolean }[] = [
  { ev: "vezne", gelen: "kur", baslik: "Vezne / Kur İşlemleri" },
  { ev: "kasa", gelen: "banka", baslik: "Kasa / Banka İşlemleri" },
  { ev: "yonetici", gelen: "ebelge" },
  // S9: Raporlar altındaki açılır MASAK grubu Yönetici İşlemleri'ne
  { ev: "yonetici", gelen: "raporlar", yalniz: (m) => !!m.children?.length && harfsiz(m.title || m.name) === "MASAK" },
  { ev: "etiket", gelen: "perakende", baslik: "Etiket / Perakende İşlemleri" },
];

/** S8: menüden kaldırılan sayfalar */
const KALDIRILANLAR = new Set(["ayarlar/devir-islemi", "ayarlar/servis-islemleri"]);

const HARFLER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ON_EK = /^\s*([A-Za-zÇĞİÖŞÜçğıöşü])\s*[-–—]\s*/;

const harfSirasi = (metin?: string): number => {
  const m = (metin || "").match(ON_EK);
  if (!m) return -1;
  const h = m[1].toLocaleUpperCase("tr-TR");
  return HARFLER.indexOf(h === "İ" ? "I" : h);
};
function harfsiz(metin?: string): string {
  return (metin || "").replace(ON_EK, "");
}
const harfle = (sira: number, metin?: string): string => `${HARFLER[sira] ?? "?"}- ${harfsiz(metin)}`;
const yeniHarf = (m: MenuItemType, sira: number): MenuItemType =>
  m.name ? { ...m, name: harfle(sira, m.name) } : { ...m, title: harfle(sira, m.title) };

const yol = (link: string): string => link.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
const yollar = (oge: MenuItemType): string[] => [
  ...(oge.link ? [yol(oge.link)] : []),
  ...(oge.children || []).flatMap(yollar),
];

const oge = (menu: MenuItemType[], key: string) => menu.find((m) => m.key === key);
const tumuGelen = new Set(BIRLESIMLER.filter((b) => !b.yalniz).map((b) => b.gelen));

/** Gelen menünün taşınacak maddeleri; alt öğesi olmayan bağlantılı menü (H- e-Belge) tek madde sayılır. */
const maddeler = (ana: MenuItemType, b: (typeof BIRLESIMLER)[number]): MenuItemType[] => {
  const hepsi = ana.children?.length ? ana.children : ana.link ? [{ id: ana.id, name: ana.title, link: ana.link }] : [];
  return b.yalniz ? hepsi.filter(b.yalniz) : hepsi;
};

/** Madde, başka bir menüye taşınıyor mu (kaynak menüsünde çizilmez) */
const tasiniyor = (anaKey: string | undefined, m: MenuItemType): boolean =>
  BIRLESIMLER.some((b) => b.yalniz && b.gelen === anaKey && b.yalniz(m));

const kaldirildi = (m: MenuItemType): boolean => !!m.link && KALDIRILANLAR.has(yol(m.link));

/** Madde, kümede zaten bulunan sayfaları açıyorsa (alt grupta: tüm sayfaları kümedeyse) eşi var demektir. */
const esiVar = (m: MenuItemType, kume: Set<string>): boolean => {
  const y = yollar(m);
  return y.length > 0 && y.every((p) => kume.has(p));
};

const sonHarf = (ogeler: MenuItemType[]): number => Math.max(-1, ...ogeler.map((o) => harfSirasi(o.name || o.title)));

/** Eş denetimi kümesi: ev menünün sayfaları + Yönetici ve gelen menüler dışındaki tüm menülerin sayfaları. */
const esKumesi = (menu: MenuItemType[], evKey: string): Set<string> => {
  const kume = new Set<string>();
  for (const ana of menu) {
    if (!ana.key || tumuGelen.has(ana.key)) continue;
    if (ana.key === "yonetici" && evKey !== "yonetici") continue;
    const ogeler = ana.children?.length ? ana.children.filter((m) => !tasiniyor(ana.key, m)) : [ana];
    ogeler.flatMap(yollar).forEach((p) => kume.add(p));
  }
  return kume;
};

/**
 * Süzmesiz tam menüye göre harfler (firma süzmesi harfleri kaydırmasın):
 *  - gelen maddelerin ev menüdeki harfi (madde id → sıra) ve ev menüsü (madde id → ev key)
 *  - kaldırılan/taşınan maddenin ardından gelenlerin kayık harfi (madde id → sıra)
 */
let tamHarflerOnbellek: { gelen: Map<string, number>; ev: Map<string, string>; kayik: Map<string, number> } | null = null;
const tamHarfler = () => {
  if (tamHarflerOnbellek) return tamHarflerOnbellek;
  const gelenHarf = new Map<string, number>();
  const gelenEv = new Map<string, string>();
  const kayik = new Map<string, number>();

  for (const ana of DashboardMenu) {
    let eksik = 0;
    for (const m of ana.children || []) {
      if (kaldirildi(m) || tasiniyor(ana.key, m)) eksik++;
      else if (eksik) kayik.set(m.id, harfSirasi(m.name || m.title) - eksik);
    }
  }

  const evSon = new Map<string, number>();
  for (const b of BIRLESIMLER) {
    const ev = oge(DashboardMenu, b.ev);
    const gelen = oge(DashboardMenu, b.gelen);
    if (!ev || !gelen) continue;
    const kume = esKumesi(DashboardMenu, b.ev);
    let sira = evSon.get(b.ev) ?? sonHarf(ev.children || []);
    for (const m of maddeler(gelen, b)) {
      if (esiVar(m, kume)) continue;
      gelenHarf.set(m.id, ++sira);
      gelenEv.set(m.id, b.ev);
    }
    evSon.set(b.ev, sira);
  }
  tamHarflerOnbellek = { gelen: gelenHarf, ev: gelenEv, kayik };
  return tamHarflerOnbellek;
};

/** Firmaya göre süzülmüş sol menüyü (menuyuSuz sonucu) birleşik hale getirir. */
export const solMenuyuBirlestir = (suzulmus: MenuItemType[]): MenuItemType[] => {
  const { gelen: harf, ev: planEvi, kayik } = tamHarfler();

  // Kaldırılan ve başka menüye taşınan maddeler kaynak menüden çıkar; ardındakilerin harfi kayar
  const temiz = suzulmus.flatMap((ana) => {
    if (!ana.children?.length) return [ana];
    const kalan = ana.children
      .filter((m) => !kaldirildi(m) && !tasiniyor(ana.key, m))
      .map((m) => (kayik.has(m.id) ? yeniHarf(m, kayik.get(m.id)!) : m));
    return kalan.length ? [{ ...ana, children: kalan }] : [];
  });

  // Ev menü başına: planlı harfli gelenler sırayla; tam menüde eşi olduğu için harf almamış (firmada eşi kapalı)
  // maddeler tüm gelenlerden sonra, son harften devam ederek en sona
  const evler = new Map<string, { kume: Set<string>; planli: MenuItemType[]; sonaKalan: MenuItemType[]; baslik?: string }>();
  for (const b of BIRLESIMLER) {
    const gelen = oge(suzulmus, b.gelen);
    if (!gelen) continue;
    const e = evler.get(b.ev) || { kume: esKumesi(temiz, b.ev), planli: [], sonaKalan: [] };
    evler.set(b.ev, e);
    for (const m of maddeler(gelen, b)) {
      if (esiVar(m, e.kume)) continue;
      (harf.has(m.id) ? e.planli : e.sonaKalan).push(m);
      yollar(m).forEach((p) => e.kume.add(p));
      if (b.baslik) e.baslik = b.baslik;
    }
  }

  const birlesik = new Map<string, MenuItemType>();
  for (const [evKey, e] of evler) {
    if (!e.planli.length && !e.sonaKalan.length) continue;
    // Ev menü firmaya kapalıysa başlık yalnız gelen maddelerle çizilir; madde kaybolmaz
    const ev = oge(temiz, evKey);
    const kabuk = ev || oge(DashboardMenu, evKey);
    if (!kabuk) continue;
    const mevcut = ev?.children || [];
    let sira = Math.max(
      sonHarf([...mevcut, ...(oge(DashboardMenu, evKey)?.children || [])]),
      ...[...harf.entries()].filter(([id]) => planEvi.get(id) === evKey).map(([, s]) => s)
    );
    birlesik.set(evKey, {
      ...kabuk,
      title: e.baslik ? harfle(0, e.baslik) : kabuk.title,
      link: undefined,
      children: [
        ...mevcut,
        ...e.planli.map((m) => yeniHarf(m, harf.get(m.id)!)),
        ...e.sonaKalan.map((m) => yeniHarf(m, ++sira)),
      ],
    });
  }

  // Tam menü sırasıyla diz: tümü taşınan menüler kalkar, ev menüler birleşik haliyle yerinde durur
  const sonuc: MenuItemType[] = [];
  for (const tam of DashboardMenu) {
    if (tam.key && tumuGelen.has(tam.key)) continue;
    const yeni = (tam.key && birlesik.get(tam.key)) || temiz.find((m) => m.id === tam.id);
    if (yeni) sonuc.push(yeni);
  }

  // Ana başlık harfleri baştan
  let ana = 0;
  return sonuc.map((m) => (m.grouptitle || harfSirasi(m.title) < 0 ? m : { ...m, title: harfle(ana++, m.title) }));
};
