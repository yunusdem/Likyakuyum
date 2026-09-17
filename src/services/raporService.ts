import { apiClient, getEffectiveApiUrl } from "./apiClient";

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

/**
 * Menü ve route için rapor kodu ↔ URL parçası eşlemesi. Menü iki kademeli (yönetici kararı 17.09.2026):
 * G- Raporlar → A- Cari, B- Kasa … → A-, B-, C- raporlar. Harfler sıradan üretilir (DashboardRoute). Bkz. docs/raporlar-faz2.md.
 */
export type RaporGrubu = "cari" | "kasa" | "vezne" | "fis" | "masak" | "yonetici";
export const RAPOR_GRUPLARI: { grup: RaporGrubu; ad: string }[] = [
  { grup: "cari", ad: "Cari Raporları" }, { grup: "kasa", ad: "Kasa Raporları" }, { grup: "vezne", ad: "Vezne Raporları" },
  { grup: "fis", ad: "Fiş Raporları" }, { grup: "masak", ad: "MASAK Raporları" }, { grup: "yonetici", ad: "Yönetici Raporları" },
];
export const RAPOR_MENU: { kod: string; yol: string; ad: string; grup: RaporGrubu }[] = [
  { kod: "CARBAK1", yol: "cari-bakiye", ad: "Cari Bakiye Raporu", grup: "cari" },
  { kod: "CAREKS1", yol: "cari-ekstre", ad: "Cari Ekstre", grup: "cari" },
  { kod: "CARHAR1", yol: "cari-hareket-listesi", ad: "Cari Hareket Listesi", grup: "cari" },
  { kod: "CARKRT1", yol: "cari-kart-listesi", ad: "Cari Kart Listesi", grup: "cari" },
  { kod: "VEZBAK1", yol: "vezne-bakiye", ad: "Vezne Bakiye Raporu (Tarih Bazlı)", grup: "vezne" },
  { kod: "VEZHAR1", yol: "vezne-hareket-listesi", ad: "Vezne Hareket Listesi", grup: "vezne" },
  { kod: "VERKOM1", yol: "vergiler-komisyon", ad: "Vergiler ve Komisyon", grup: "fis" },
  { kod: "KARZAR1", yol: "kar-zarar", ad: "Kâr / Zarar Faaliyet Analizi", grup: "yonetici" },
  { kod: "FIRVAR1", yol: "firma-varliklari", ad: "Firma Varlıkları Raporu", grup: "yonetici" },
  { kod: "KASDEF1", yol: "kasa-defteri", ad: "Kasa Defteri", grup: "kasa" },
  { kod: "KASHAR1", yol: "kasa-hareket-listesi", ad: "Kasa Hareket Listesi", grup: "kasa" },
  { kod: "HESEKS1", yol: "hesap-ekstresi", ad: "Hesap Ekstresi", grup: "kasa" },
  { kod: "HESBAK1", yol: "hesap-bakiye", ad: "Hesap Bakiye Raporu", grup: "kasa" },
  { kod: "VEZANL1", yol: "vezne-bakiye-anlik", ad: "Vezne Bakiye Raporu (Anlık)", grup: "vezne" },
  { kod: "KURKON1", yol: "kur-sapma", ad: "Kur Sapma Raporu", grup: "vezne" },
  { kod: "POSEKS1", yol: "pos-ekstre", ad: "POS Ekstre", grup: "cari" },
  { kod: "VADISL1", yol: "vadeli-islem-listesi", ad: "Vadeli İşlem Listesi", grup: "cari" },
  { kod: "FISLIS1", yol: "fis-listeleme", ad: "Fiş Listeleme", grup: "fis" },
  { kod: "GUNFIS1", yol: "gunluk-fis-detay", ad: "Günlük Fiş Detay Raporu", grup: "fis" },
  { kod: "ISTRAP1", yol: "istatistik-raporu", ad: "İstatistik Raporu", grup: "fis" },
  { kod: "ISTKMV1", yol: "istatistik-kmv", ad: "İstatistik Bazında KMV Raporu", grup: "fis" },
  { kod: "VERNUM1", yol: "vergi-numarasi-raporu", ad: "Vergi Numarası Raporu", grup: "fis" },
  { kod: "KARLIL1", yol: "karlilik", ad: "Kârlılık Raporu", grup: "yonetici" },
  { kod: "ALTISC1", yol: "altin-iscilik", ad: "Altın İşçilik Raporu", grup: "fis" },
  { kod: "PERDEG1", yol: "personel-degerlendirme", ad: "Personel Değerlendirme Raporu", grup: "yonetici" },
  { kod: "MSKMES1", yol: "masak-meslek", ad: "Meslek Bazında İşlem Listesi", grup: "masak" },
  { kod: "MSKSEK1", yol: "masak-sektor", ad: "Sektör Bazında İşlem Listesi", grup: "masak" },
  { kod: "MSKYAS1", yol: "masak-yas", ad: "Yaş Bazında İşlem Listesi", grup: "masak" },
  { kod: "MSKYUK1", yol: "masak-yuksek-tutar", ad: "Yüksek Tutarda İşlem Listesi", grup: "masak" },
  { kod: "MSKSUP1", yol: "masak-supheli", ad: "Şüpheli İşlem Listesi", grup: "masak" },
  { kod: "MSKKON1", yol: "masak-fis-kontrol", ad: "Şüpheli İşlemler Fiş Kontrol Listesi", grup: "masak" },
  { kod: "FIRSON1", yol: "firma-son-durum", ad: "Firma Son Durum Raporu", grup: "yonetici" },
  { kod: "LONSHO1", yol: "long-short-denge", ad: "Long / Short Denge Analizi", grup: "yonetici" },
  { kod: "KNSKLOG1", yol: "knsk-sorgulama-listesi", ad: "KNSK Sorgulama Log Listesi", grup: "masak" },
  { kod: "KURKON2", yol: "kur-kontrolu", ad: "Kur Kontrolü", grup: "vezne" },
];
const HARF = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Sol menü için iki kademeli yapı: boş gruplar atlanır, harfler görünen sıraya göre verilir */
export const raporMenuAgaci = () => RAPOR_GRUPLARI
  .map(g => ({ ...g, raporlar: RAPOR_MENU.filter(m => m.grup === g.grup) })).filter(g => g.raporlar.length)
  .map((g, gi) => ({ baslik: `${HARF[gi]}- ${g.ad}`, raporlar: g.raporlar.map((m, mi) => ({ ad: `${HARF[mi]}- ${m.ad}`, link: `raporlar/${m.yol}` })) }));
