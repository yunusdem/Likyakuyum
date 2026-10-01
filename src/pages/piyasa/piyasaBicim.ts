import type { PiyasaGrupKodu, PiyasaKaynak, PiyasaSatiri } from "../../services/piyasaService";

const bicimler = new Map<number, Intl.NumberFormat>();

/** 6603.29 → "6.603,29" (ondalık hane kaynaktaki gibi) */
export const sayiYaz = (n: number | null | undefined, ondalik = 2): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const d = Math.min(Math.max(ondalik, 0), 6);
  let f = bicimler.get(d);
  if (!f) {
    f = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
    bicimler.set(d, f);
  }
  return f.format(n);
};

export const yuzdeYaz = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? "" : `%${n > 0 ? "+" : ""}${sayiYaz(n, 2)}`;

/** Sayfadaki grup süzgeci. "diger" = parite, külçe, işçilik, merkez */
export type Suzgec = "tumu" | "altin" | "sarrafiye" | "doviz" | "gumus" | "diger";

export const SUZGECLER: { kod: Suzgec; ad: string }[] = [
  { kod: "tumu", ad: "Tümü" },
  { kod: "altin", ad: "Altın" },
  { kod: "sarrafiye", ad: "Sarrafiye" },
  { kod: "doviz", ad: "Döviz" },
  { kod: "gumus", ad: "Gümüş" },
  { kod: "diger", ad: "Parite & Diğer" },
];

export const suzgeceUyar = (grup: PiyasaGrupKodu, s: Suzgec): boolean =>
  s === "tumu" || (s === "diger" ? ["parite", "kulce", "iscilik", "merkez"].includes(grup) : grup === s);

/** Her kaynağın kart rengi ve kısaltması */
export const KAYNAK_GORUNUM: Record<string, { renk: string; kisa: string }> = {
  harem: { renk: "#b91c1c", kisa: "HA" },
  kapalicarsi: { renk: "#7c3aed", kisa: "KÇ" },
  zile: { renk: "#0369a1", kisa: "ZD" },
  ahlatci: { renk: "#0f766e", kisa: "AD" },
  altinkaynak: { renk: "#b45309", kisa: "AK" },
  dovizcom: { renk: "#1d4ed8", kisa: "DC" },
  hakan: { renk: "#be185d", kisa: "HD" },
};

export const kaynakGorunum = (kod: string, ad: string) =>
  KAYNAK_GORUNUM[kod] ?? { renk: "#475569", kisa: ad.slice(0, 2).toUpperCase() };

/** Özet şeridi ve karşılaştırma tablosundaki ortak kalemler (sıra = ekrandaki sıra) */
export interface OrtakKalem {
  kod: string;
  ad: string;
  grup: PiyasaGrupKodu;
  ondalik: number;
}

export const ORTAK_KALEMLER: OrtakKalem[] = [
  { kod: "HAS", ad: "Has Altın", grup: "altin", ondalik: 2 },
  { kod: "GRAM", ad: "Gram Altın", grup: "altin", ondalik: 2 },
  { kod: "ONS", ad: "Ons ($)", grup: "altin", ondalik: 2 },
  { kod: "AYAR22", ad: "22 Ayar", grup: "altin", ondalik: 2 },
  { kod: "AYAR18", ad: "18 Ayar", grup: "altin", ondalik: 2 },
  { kod: "AYAR14", ad: "14 Ayar", grup: "altin", ondalik: 2 },
  { kod: "USDKG", ad: "USD/KG", grup: "altin", ondalik: 0 },
  { kod: "EURKG", ad: "EUR/KG", grup: "altin", ondalik: 0 },
  { kod: "CEYREK_YENI", ad: "Yeni Çeyrek", grup: "sarrafiye", ondalik: 0 },
  { kod: "CEYREK_ESKI", ad: "Eski Çeyrek", grup: "sarrafiye", ondalik: 0 },
  { kod: "YARIM_YENI", ad: "Yeni Yarım", grup: "sarrafiye", ondalik: 0 },
  { kod: "YARIM_ESKI", ad: "Eski Yarım", grup: "sarrafiye", ondalik: 0 },
  { kod: "TAM_YENI", ad: "Yeni Tam", grup: "sarrafiye", ondalik: 0 },
  { kod: "TAM_ESKI", ad: "Eski Tam", grup: "sarrafiye", ondalik: 0 },
  { kod: "ATA_YENI", ad: "Yeni Ata", grup: "sarrafiye", ondalik: 0 },
  { kod: "ATA_ESKI", ad: "Eski Ata", grup: "sarrafiye", ondalik: 0 },
  { kod: "ATA5_YENI", ad: "Yeni Ata 5'li", grup: "sarrafiye", ondalik: 0 },
  { kod: "ATA5_ESKI", ad: "Eski Ata 5'li", grup: "sarrafiye", ondalik: 0 },
  { kod: "GREMSE_YENI", ad: "Yeni Gremse", grup: "sarrafiye", ondalik: 0 },
  { kod: "GREMSE_ESKI", ad: "Eski Gremse", grup: "sarrafiye", ondalik: 0 },
  { kod: "GUMUS_TL", ad: "Gümüş (TL/gr)", grup: "gumus", ondalik: 2 },
  { kod: "GUMUS_ONS", ad: "Gümüş Ons", grup: "gumus", ondalik: 2 },
  { kod: "USDTRY", ad: "USD/TRY", grup: "doviz", ondalik: 4 },
  { kod: "EURTRY", ad: "EUR/TRY", grup: "doviz", ondalik: 4 },
  { kod: "GBPTRY", ad: "GBP/TRY", grup: "doviz", ondalik: 4 },
  { kod: "CHFTRY", ad: "CHF/TRY", grup: "doviz", ondalik: 4 },
  { kod: "AUDTRY", ad: "AUD/TRY", grup: "doviz", ondalik: 4 },
  { kod: "CADTRY", ad: "CAD/TRY", grup: "doviz", ondalik: 4 },
  { kod: "SARTRY", ad: "SAR/TRY", grup: "doviz", ondalik: 4 },
  { kod: "JPYTRY", ad: "JPY/TRY", grup: "doviz", ondalik: 4 },
  { kod: "AEDTRY", ad: "AED/TRY", grup: "doviz", ondalik: 4 },
  { kod: "EURUSD", ad: "EUR/USD", grup: "parite", ondalik: 4 },
  { kod: "GBPUSD", ad: "GBP/USD", grup: "parite", ondalik: 4 },
  { kod: "USDCHF", ad: "USD/CHF", grup: "parite", ondalik: 4 },
  { kod: "USDJPY", ad: "USD/JPY", grup: "parite", ondalik: 3 },
];

/** Üst şeritte gösterilen kalemler */
export const SERIT_KALEMLERI = ["HAS", "GRAM", "ONS", "USDTRY", "EURTRY", "CEYREK_YENI", "GUMUS_TL"];

/** kaynak → ortakKod → satır (bir kaynakta aynı ortak kod birden çok satırda olabilir, ilki alınır) */
export type OrtakDizin = Map<string, Map<string, PiyasaSatiri>>;

export const ortakDizinKur = (kaynaklar: PiyasaKaynak[]): OrtakDizin => {
  const dizin: OrtakDizin = new Map();
  for (const k of kaynaklar) {
    const m = new Map<string, PiyasaSatiri>();
    for (const g of k.gruplar) for (const s of g.satirlar) if (s.ortakKod && !m.has(s.ortakKod)) m.set(s.ortakKod, s);
    dizin.set(k.kod, m);
  }
  return dizin;
};

export interface EnIyi {
  /** En yüksek alış (müşteri satarken en çok veren) */
  alis: number | null;
  /** En düşük satış (müşteri alırken en ucuz) */
  satis: number | null;
  minSatis: number | null;
  maxSatis: number | null;
  sayi: number;
}

/** Görünen kaynaklar arasında bir ortak kalemin en iyi değerleri */
export const enIyiBul = (dizin: OrtakDizin, kaynakKodlari: string[], ortakKod: string): EnIyi => {
  let alis: number | null = null;
  let satis: number | null = null;
  let maxSatis: number | null = null;
  let sayi = 0;
  for (const kk of kaynakKodlari) {
    const s = dizin.get(kk)?.get(ortakKod);
    if (!s) continue;
    sayi++;
    if (s.alis !== null && (alis === null || s.alis > alis)) alis = s.alis;
    if (s.satis !== null) {
      if (satis === null || s.satis < satis) satis = s.satis;
      if (maxSatis === null || s.satis > maxSatis) maxSatis = s.satis;
    }
  }
  return { alis, satis, minSatis: satis, maxSatis, sayi };
};

export const tercihOku = <T,>(anahtar: string, varsayilan: T): T => {
  try {
    const v = localStorage.getItem(`piyasa.${anahtar}`);
    return v === null ? varsayilan : (JSON.parse(v) as T);
  } catch {
    return varsayilan;
  }
};

export const tercihYaz = (anahtar: string, deger: unknown): void => {
  try {
    localStorage.setItem(`piyasa.${anahtar}`, JSON.stringify(deger));
  } catch {
    /* gizli pencere vb. — tercih saklanmaz, sayfa yine çalışır */
  }
};

export const saatYaz = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};
