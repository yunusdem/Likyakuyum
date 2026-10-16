import { apiClient, getEffectiveApiUrl } from "./apiClient";
import { trSayiBicimi, trTarihBicimi, trTarihSaatBicimi } from "../utils/intlOnbellek";
import { RAPOR_MENU, type RaporGrubu } from "../../Backend/src/services/rapor/raporMenu";

/**
 * Rapor servisleri — Backend: /api/v1/rapor. Bkz. docs/raporlar.md.
 * Rapor tanımı (parametreler + kolonlar) sunucudan gelir; ekran filtre şeridini ve grid'i buna göre kurar.
 */

export type RaporParametreTipi = "tarih" | "tarihAralik" | "saatAralik" | "vezne" | "para" | "cari" | "fisTipi" | "kurSecimi" | "kmt" | "cariAralik" | "vezneAralik" | "paraCoklu" | "cariCoklu" | "vezneCoklu" | "hareketTipi" | "secim" | "sayi" | "listeCoklu" | "metin";
export type RaporSecimKaynagi = "hesap" | "istatistik" | "meslek" | "sektor" | "kullanici" | "banka";
export interface RaporSecimKaydi { id: number; kod: string; ad: string }
export interface RaporParametre { ad: string; etiket: string; tip: RaporParametreTipi; zorunlu?: boolean; varsayilan?: string | number | null;
  secenekler?: { deger: string; ad: string }[]; kaynak?: RaporSecimKaynagi; not?: string }
export type RaporBicim = "metin" | "sayi" | "sayi4" | "kur" | "tarih" | "tarihSaat" | "tam";
export interface RaporKolon { anahtar: string; baslik: string; g: number; hiza?: "left" | "right" | "center"; bicim?: RaporBicim; toplam?: boolean; pdf?: boolean; kmt?: "K" | "M" | "T" }
export interface RaporTanim {
  kod: string; ad: string; aciklama?: string; kagit: "A4" | "A4-yatay";
  parametreler: RaporParametre[]; kolonlar: RaporKolon[];
  grup?: { anahtar: string; baslik: string; altToplam?: boolean; altBaslik?: string; genelToplam?: boolean }; dipnot?: string; ustSinir?: number;
  /** Rapor sonundaki ikinci tablo (alt rapor karşılığı); satırları RaporVeri.ozetSatirlar */
  ozet?: { baslik: string; kolonlar: RaporKolon[] };
}
/** Kayıtlı arama (sunucuda, kullanıcı × rapor; yönetici kararı 14.09.2026) */
export interface RaporArama { aramaId: number; raporKod: string; ozet: string; parametreler: Record<string, string | number | null>; zaman: string }
export interface RaporSablon { kod: string; ad: string; kagit: string; aciklama: string; parametreler: RaporParametre[] }
export interface RaporVeri { satirlar: Record<string, any>[]; filtreOzeti: string; ekDipnot?: string; sinirAsildi: boolean; toplamKayit: number; tanim: RaporTanim; ozetSatirlar?: Record<string, any>[] }

export type RaporParametreDegerleri = Record<string, string | number | undefined | "">;

const sorgu = (p: RaporParametreDegerleri) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  return q.toString();
};

export async function dosyaGetir(yol: string, kabul: string): Promise<Blob> {
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

export const indirBlob = (blob: Blob, ad: string) => {
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
  async secimListesi(kaynak: RaporSecimKaynagi): Promise<RaporSecimKaydi[]> { return (await apiClient.get<RaporSecimKaydi[]>(`/rapor/secim/${kaynak}`)).data || []; },
  async aramalar(kod: string): Promise<RaporArama[]> { return (await apiClient.get<RaporArama[]>(`/rapor/${encodeURIComponent(kod)}/aramalar`)).data || []; },
  async aramaKaydet(kod: string, p: RaporParametreDegerleri, ozet: string): Promise<RaporArama> {
    const parametreler: Record<string, string | number> = {}; for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") parametreler[k] = v;
    return (await apiClient.post<RaporArama>(`/rapor/${encodeURIComponent(kod)}/aramalar`, { parametreler, ozet })).data;
  },
  async aramaSil(kod: string, aramaId?: number): Promise<void> {
    await apiClient.delete(`/rapor/${encodeURIComponent(kod)}/aramalar${aramaId ? "/" + aramaId : ""}`);
  },
  async excelIndir(kod: string, p: RaporParametreDegerleri, ad: string) {
    indirBlob(await dosyaGetir(`/rapor/${encodeURIComponent(kod)}/excel?${sorgu(p)}`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), `${ad}.xlsx`);
  },
};

export const raporBicimle = (v: any, bicim?: RaporBicim): string => {
  if (v === null || v === undefined || v === "") return "";
  const tr = (n: number, b: number, maxB = b) => trSayiBicimi(b, maxB).format(Number(n || 0));
  switch (bicim) {
    case "sayi": return tr(Number(v), 2);
    case "sayi4": return tr(Number(v), 4);
    case "kur": return tr(Number(v), 2, 5);
    case "tam": return trSayiBicimi(undefined, 0).format(Number(v || 0));
    case "tarih": { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : trTarihBicimi().format(d); }
    case "tarihSaat": { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : trTarihSaatBicimi().format(d).replace(",", ""); }
    default: return String(v);
  }
};
export const raporSayisalMi = (b?: RaporBicim) => b === "sayi" || b === "sayi4" || b === "kur" || b === "tam";

/**
 * Rapor kodu ↔ URL parçası eşlemesi ve menüdeki yeri: Backend/src/services/rapor/raporMenu.ts (sunucu raporun lisans
 * kodunu da oradan üretir; iki yerde ayrı liste tutulmasın diye tek kaynak).
 */
export { RAPOR_MENU };
export type { RaporGrubu };
const HARF = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Bir rapor kodunun menü linki ("raporlar/<yol>") */
export const raporLinki = (kod: string) => `raporlar/${RAPOR_MENU.find(m => m.kod === kod)?.yol ?? ""}`;
/** G- Raporlar menüsü: "raporlar" klasöründekiler ada göre harflenir, sonda açılır MASAK grubu */
export const raporlarMenusu = () => {
  const sirala = (grup: RaporGrubu) => RAPOR_MENU.filter(m => m.grup === grup).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  const duz = sirala("raporlar").map((m, i) => ({ ad: `${HARF[i]}- ${m.ad}`, link: `raporlar/${m.yol}` }));
  const masak = sirala("masak").map((m, i) => ({ ad: `${HARF[i]}- ${m.ad}`, link: `raporlar/${m.yol}` }));
  return { raporlar: duz, masakBaslik: `${HARF[duz.length]}- MASAK`, masak };
};
