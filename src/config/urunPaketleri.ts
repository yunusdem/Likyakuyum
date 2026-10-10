import { DashboardMenu } from "routes/DashboardRoute";
import { MenuItemType } from "types/menuTypes";
import { ModulKaydi, UST_KISAYOLLAR, menuOgesiKodu } from "./modulKatalogu";

/**
 * Lisans ürün paketleri (docs/LISANS_URUN_PAKETLERI.md). Paketlerin ASIL içeriği merkezde (ADM_PAKET_MODUL) durur ve
 * yönetim panelinin Paket Tanımları sayfasından değiştirilir. Bu dosya yalnız İLK içeriği üretir: paket merkezde henüz
 * hiç doldurulmamışsa panel bu listeyi bir kez gönderir (§4 tablosu). Sonradan buradaki değişiklik mevcut paketlere yansımaz.
 */

export type PaketKodu = "cekirdek" | "doviz" | "gumus" | "kuyum" | "ticari" | "connector" | "erp";

/** Lisans penceresinde seçilebilen ürünler (çekirdek seçilmez, her pakette vardır) */
export const URUN_KODLARI: Exclude<PaketKodu, "cekirdek">[] = ["kuyum", "doviz", "gumus", "ticari", "connector", "erp"];

export const URUN_ADLARI: Record<PaketKodu, string> = {
  cekirdek: "Çekirdek",
  kuyum: "Likya.Kuyum",
  doviz: "Likya.Döviz",
  gumus: "Likya.Gümüş",
  ticari: "Likya.Ticari",
  connector: "Likya.Connector",
  erp: "Likya.ERP",
};

/** Firmalar listesindeki kısa rozet */
export const URUN_KISA: Record<PaketKodu, string> = {
  cekirdek: "Ç",
  kuyum: "K",
  doviz: "D",
  gumus: "G",
  ticari: "T",
  connector: "C",
  erp: "ERP",
};

/** Lisanstaki ürünlerden PAKET_ADI metni: "Likya.Kuyum + Likya.Connector" */
export const paketAdiYaz = (urunler: string[]): string =>
  URUN_KODLARI.filter((k) => urunler.includes(k))
    .map((k) => URUN_ADLARI[k])
    .join(" + ");

type Secici = string;
type IlkPaket = Exclude<PaketKodu, "erp">;

const D: IlkPaket = "doviz";
const G: IlkPaket = "gumus";
const K: IlkPaket = "kuyum";
const T: IlkPaket = "ticari";
const C: IlkPaket = "connector";

/**
 * Seçici: modül kodu ya da `*` içeren kalıp. Seçilen düğümün tüm altları ve tüm üstleri de pakete girer.
 * Rapor maddelerinin kodu "<ana>:raporlar/<yol>" biçimindedir (raporService.raporLinki).
 */
const KURALLAR: [Secici[], IlkPaket[]][] = [
  // Çekirdek: her pakette açık ayarlar
  [
    [
      "ayarlar:ayarlar/kullanici-tanimlari",
      "ayarlar:ayarlar/yazici-tanimlari",
      "ayarlar:ayarlar/numeratorler",
      "ayarlar:ayarlar/firma-tanimlari",
      "ayarlar:ayarlar/devir-islemi",
      "ayarlar:ayarlar/servis-islemleri",
    ],
    ["cekirdek" as IlkPaket],
  ],

  // A- Vezne
  [["vezne:vezne/sarraf-fisi-kayit", "vezne:vezne/sarraf-fisi-duzeltme"], [K]],
  [["vezne:vezne/perakende-fisi-kayit", "vezne:vezne/perakende-fisi-duzeltme"], [K]],
  [["vezne:vezne/doviz-fisi-kayit", "vezne:vezne/doviz-fisi-duzeltme"], [D, G]],
  [
    [
      "vezne:vezne/transfer-kayit",
      "vezne:vezne/transfer-duzeltme",
      "vezne:raporlar/vezne-hareket-listesi",
      "vezne:raporlar/vezne-bakiye-anlik",
      "vezne:raporlar/vezne-bakiye",
      "vezne:vezne/para-say",
      "vezne:vezne/izleme",
      "vezne:raporlar/kur-kontrolu",
      "vezne:raporlar/kur-sapma",
    ],
    [D, G, K],
  ],
  [["vezne:vezne/fiyat-kontrolu"], [K]],

  // B- Kasa
  [["kasa"], [D, G, K, T]],

  // C- Kur
  [["kur:kur/anlik-fiyat-listesi", "kur:kur/saklanan-fiyat-listesi"], [D, G, K]],
  [["kur:kur/pano", "kur:kur/pano-tanimi"], [D, G, K, C]],

  // D- Cari
  [
    [
      "cari:cari/kart-kayit",
      "cari:cari/kart-duzeltme",
      "cari:cari/hareket-kayit",
      "cari:cari/hareket-duzeltme",
      "cari:cari/hareket-listesi",
      "cari:cari/kart-listesi",
      "cari:cari/detayli-kart-listesi",
      "cari:raporlar/cari-ekstre",
      "cari:raporlar/cari-bakiye",
      "cari:raporlar/pos-ekstre",
      "cari:cari/hesap-ad-listesi",
      "cari:raporlar/vadeli-islem-listesi",
    ],
    [D, G, K, T],
  ],
  [["cari:cari/emanet-dekont", "cari:cari/emanet-duzeltme"], [K]],

  // E- Yönetici (kısayol maddeleri aşağıda, asıl sayfalarından türetilir)
  [["yonetici:raporlar/firma-son-durum", "yonetici:raporlar/firma-varliklari", "yonetici:raporlar/kar-zarar"], [D, G, K, T]],
  [["yonetici:raporlar/long-short-denge"], [D, G, K]],

  // F- Banka / POS
  [
    ["banka:banka/hesap-kartlari", "banka:banka/hareketler", "banka:banka/pos-tanimlari", "banka:banka/pos-cihazlari", "banka:banka/pos-islemleri"],
    [D, G, K, T, C],
  ],
  [["banka:#*e-banka"], [C]],

  // G- Raporlar
  [
    ["raporlar:raporlar/fis-listeleme", "raporlar:raporlar/gunluk-fis-detay", "raporlar:raporlar/vergiler-komisyon", "raporlar:raporlar/vergi-numarasi-raporu"],
    [D, G, K, T],
  ],
  [
    ["raporlar:raporlar/istatistik-raporu", "raporlar:raporlar/istatistik-kmv", "raporlar:raporlar/karlilik", "raporlar:raporlar/personel-degerlendirme"],
    [D, G, K],
  ],
  [["raporlar:raporlar/altin-iscilik"], [K]],
  [["raporlar:#*masak"], [D, G, K]],

  // H- e-Belge
  [["ebelge"], [D, G, K, T, C]],

  // I- Etiket, J- Perakende
  [["etiket", "perakende"], [K]],

  // K- Ayarlar
  [["ayarlar:ayarlar/urun-tanimlari"], [D, G, K, T]],
  [
    [
      "ayarlar:ayarlar/banknot-tanimlari",
      "ayarlar:ayarlar/istatistik-tanimlari",
      "ayarlar:ayarlar/vezne-tanimlari",
      "ayarlar:ayarlar/iskonto-tanimlari",
      "ayarlar:ayarlar/masak-dondurulanlar",
    ],
    [D, G, K],
  ],
  [["ayarlar:ayarlar/gib-sorgu"], [D, G, K, T, C]],

  // Üst kısayol çubuğu
  [["ust:kur", "ust:vezne-izleme"], [D, G, K]],
  [["ust:doviz"], [D, G]],
  [["ust:fiyat", "ust:sarraf", "ust:perakende"], [K]],
  [["ust:banka", "ust:e-belge"], [D, G, K, T, C]],
  [["ust:c-hareket"], [D, G, K, T]],
  [["ust:masak"], [D, G, K]],
];

const kalipla = (secici: string): RegExp =>
  new RegExp(`^${secici.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);

/** Menüdeki her modül kodunun açtığı adres (yönetici kısayollarını asıl sayfalarına bağlamak için). */
const kodAdresleri = (): Map<string, string> => {
  const m = new Map<string, string>();
  const temiz = (l: string) => l.replace(/^\/+/, "").replace(/\/+$/, "");
  const tara = (anaKey: string, ogeler: MenuItemType[]) => {
    for (const oge of ogeler) {
      if (oge.link) m.set(menuOgesiKodu(anaKey, oge), temiz(oge.link));
      if (oge.children?.length) tara(anaKey, oge.children);
    }
  };
  for (const ana of DashboardMenu) {
    if (!ana.key) continue;
    if (ana.link) m.set(ana.key, temiz(ana.link));
    if (ana.children?.length) tara(ana.key, ana.children);
  }
  for (const k of UST_KISAYOLLAR) if (k.to) m.set(k.key, temiz(k.to));
  return m;
};

/**
 * Paketlerin ilk içeriği (çekirdek dahil, ERP hariç — ERP "hepsi"dir). Her listede seçilen düğümlerin altları ve
 * üstleri de bulunur; yönetici kısayolları, aynı adresi açan asıl sayfa hangi paketteyse o pakete girer.
 */
export const ilkPaketIcerigi = (katalog: ModulKaydi[]): Record<IlkPaket, string[]> => {
  const cocuklar = new Map<string | null, string[]>();
  const ust = new Map<string, string | null>();
  for (const m of katalog) {
    ust.set(m.modulKodu, m.ustKodu);
    cocuklar.set(m.ustKodu, [...(cocuklar.get(m.ustKodu) || []), m.modulKodu]);
  }
  const altSoyu = (kod: string): string[] => (cocuklar.get(kod) || []).flatMap((k) => [k, ...altSoyu(k)]);

  const sonuc: Record<IlkPaket, Set<string>> = {
    cekirdek: new Set(),
    doviz: new Set(),
    gumus: new Set(),
    kuyum: new Set(),
    ticari: new Set(),
    connector: new Set(),
  };
  const ekle = (paket: IlkPaket, kod: string) => {
    sonuc[paket].add(kod);
    altSoyu(kod).forEach((k) => sonuc[paket].add(k));
    for (let u = ust.get(kod); u; u = ust.get(u)) sonuc[paket].add(u);
  };

  for (const [seciciler, paketler] of KURALLAR) {
    for (const secici of seciciler) {
      const kalip = kalipla(secici);
      for (const m of katalog) if (kalip.test(m.modulKodu)) paketler.forEach((p) => ekle(p, m.modulKodu));
    }
  }

  // E- Yönetici kısayolları: aynı adresi açan başka bir modül hangi paketlerdeyse
  const adres = kodAdresleri();
  for (const m of katalog) {
    if (!m.modulKodu.startsWith("yonetici:")) continue;
    if ((Object.values(sonuc) as Set<string>[]).some((s) => s.has(m.modulKodu))) continue;
    const hedef = adres.get(m.modulKodu);
    if (!hedef) continue;
    const esler = [...adres.entries()].filter(([kod, a]) => a === hedef && !kod.startsWith("yonetici:")).map(([kod]) => kod);
    for (const p of Object.keys(sonuc) as IlkPaket[]) {
      if (esler.some((k) => sonuc[p].has(k))) ekle(p, m.modulKodu);
    }
  }

  return Object.fromEntries(Object.entries(sonuc).map(([p, s]) => [p, [...s]])) as Record<IlkPaket, string[]>;
};
