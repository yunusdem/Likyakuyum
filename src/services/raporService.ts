import { apiClient, getEffectiveApiUrl } from "./apiClient";

/**
 * Rapor servisleri — Backend: /api/v1/rapor. Bkz. docs/raporlar.md.
 * Rapor tanımı (parametreler + kolonlar) sunucudan gelir; ekran filtre şeridini ve grid'i buna göre kurar.
 */

export type RaporParametreTipi = "tarih" | "tarihAralik" | "saatAralik" | "vezne" | "para" | "cari" | "fisTipi" | "kurSecimi" | "kmt" | "metin";
export interface RaporParametre { ad: string; etiket: string; tip: RaporParametreTipi; zorunlu?: boolean; varsayilan?: string | number | null }
export type RaporBicim = "metin" | "sayi" | "sayi4" | "kur" | "tarih" | "tarihSaat" | "tam";
export interface RaporKolon { anahtar: string; baslik: string; g: number; hiza?: "left" | "right" | "center"; bicim?: RaporBicim; toplam?: boolean; pdf?: boolean }
export interface RaporTanim {
  kod: string; ad: string; aciklama?: string; kagit: "A4" | "A4-yatay";
  parametreler: RaporParametre[]; kolonlar: RaporKolon[];
  grup?: { anahtar: string; baslik: string; altToplam?: boolean }; dipnot?: string; ustSinir?: number;
}
export interface RaporSablon { kod: string; ad: string; kagit: string; aciklama: string; parametreler: RaporParametre[] }
export interface RaporVeri { satirlar: Record<string, any>[]; filtreOzeti: string; ekDipnot?: string; sinirAsildi: boolean; toplamKayit: number; tanim: RaporTanim }

export type RaporParametreDegerleri = Record<string, string | number | undefined | "">;

const sorgu = (p: RaporParametreDegerleri) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  return q.toString();
};

async function dosyaGetir(yol: string, kabul: string): Promise<Blob> {
  const token = localStorage.getItem("kuyumcu_erp_access_token");
  const dbServer = localStorage.getItem("kuyumcu_erp_last_server") || localStorage.getItem("kuyumcu_erp_active_server");
  const dbName = localStorage.getItem("kuyumcu_erp_last_db") || localStorage.getItem("kuyumcu_erp_active_db");
  const dbUser = localStorage.getItem("kuyumcu_erp_db_user");
  const dbPassword = localStorage.getItem("kuyumcu_erp_db_password");
  const res = await fetch(`${getEffectiveApiUrl()}${yol}`, {
    headers: {
      Accept: kabul,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(dbServer ? { "x-db-server": dbServer } : {}),
      ...(dbName ? { "x-db-name": dbName } : {}),
      ...(dbUser ? { "x-db-user": dbUser } : {}),
      ...(dbPassword !== null && dbPassword !== undefined ? { "x-db-password": dbPassword } : {}),
    },
  });
  if (!res.ok) {
    let mesaj = `Dosya alınamadı (HTTP ${res.status}).`;
    try { const g = await res.json(); if (g?.message) mesaj = g.message; } catch { /* JSON değil */ }
    throw new Error(mesaj);
  }
  return res.blob();
}

const indirBlob = (blob: Blob, ad: string) => {
  const url = URL.createObjectURL(blob);
  try { const a = document.createElement("a"); a.href = url; a.download = ad; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1500); }
};

export const RaporService = {
  async sablonlar(): Promise<RaporSablon[]> { return (await apiClient.get<RaporSablon[]>("/rapor/sablonlar")).data || []; },
  async tanim(kod: string): Promise<RaporTanim> { return (await apiClient.get<RaporTanim>(`/rapor/${encodeURIComponent(kod)}/tanim`)).data; },
  async veri(kod: string, p: RaporParametreDegerleri): Promise<RaporVeri> {
    const temiz: Record<string, any> = {}; for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") temiz[k] = v;
    return (await apiClient.get<RaporVeri>(`/rapor/${encodeURIComponent(kod)}/veri`, temiz)).data;
  },
  async pdfBlobUrl(kod: string, p: RaporParametreDegerleri): Promise<string> {
    return URL.createObjectURL(await dosyaGetir(`/rapor/${encodeURIComponent(kod)}/pdf?${sorgu(p)}`, "application/pdf"));
  },
  async pdfIndir(kod: string, p: RaporParametreDegerleri, ad: string) { indirBlob(await dosyaGetir(`/rapor/${encodeURIComponent(kod)}/pdf?${sorgu({ ...p, indir: "1" })}`, "application/pdf"), `${ad}.pdf`); },
  async excelIndir(kod: string, p: RaporParametreDegerleri, ad: string) {
    indirBlob(await dosyaGetir(`/rapor/${encodeURIComponent(kod)}/excel?${sorgu(p)}`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), `${ad}.xlsx`);
  },
};

export const raporBicimle = (v: any, bicim?: RaporBicim): string => {
  if (v === null || v === undefined || v === "") return "";
  const tr = (n: number, b: number, maxB = b) => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: b, maximumFractionDigits: maxB });
  switch (bicim) {
    case "sayi": return tr(Number(v), 2);
    case "sayi4": return tr(Number(v), 4);
    case "kur": return tr(Number(v), 2, 5);
    case "tam": return Number(v || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
    case "tarih": { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }); }
    case "tarihSaat": { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false }).replace(",", ""); }
    default: return String(v);
  }
};
export const raporSayisalMi = (b?: RaporBicim) => b === "sayi" || b === "sayi4" || b === "kur" || b === "tam";

/** Menü ve route için rapor kodu ↔ URL parçası eşlemesi */
export const RAPOR_MENU: { kod: string; yol: string; ad: string }[] = [
  { kod: "CARBAK1", yol: "cari-bakiye", ad: "Cari Bakiye Raporu" },
  { kod: "CAREKS1", yol: "cari-ekstre", ad: "Cari Ekstre" },
  { kod: "CARHAR1", yol: "cari-hareket-listesi", ad: "Cari Hareket Listesi" },
  { kod: "CARKRT1", yol: "cari-kart-listesi", ad: "Cari Kart Listesi" },
  { kod: "VEZBAK1", yol: "vezne-bakiye", ad: "Vezne Bakiye Raporu (Tarih Bazlı)" },
  { kod: "VEZHAR1", yol: "vezne-hareket-listesi", ad: "Vezne Hareket Listesi" },
  { kod: "VERKOM1", yol: "vergiler-komisyon", ad: "Vergiler ve Komisyon" },
  { kod: "KARZAR1", yol: "kar-zarar", ad: "Kâr / Zarar Faaliyet Analizi" },
  { kod: "FIRVAR1", yol: "firma-varliklari", ad: "Firma Varlıkları Raporu" },
];
