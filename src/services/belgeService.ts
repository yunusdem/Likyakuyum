import { apiClient, getEffectiveApiUrl } from "./apiClient";

/**
 * Belge (fiş PDF) servisleri — Backend: /api/v1/belge
 * Bkz. docs/belgeverapor.md. Alış/satış fişinin GİB e-Döviz düzenindeki A4 PDF'i:
 * ICE'ye gönderilmiş fişte resmî ICE PDF'i, diğerlerinde "ÖNİZLEME" filigranlı şablon çıktısı.
 */

export interface BelgeSablon {
  sablonId: number; kod: string; ad: string; tur: "BELGE" | "RAPOR"; fisTipi: number | null;
  duzenDosyasi: string; kagit: string; varsayilan: boolean; aktif: boolean; arsivDizini: string | null;
}

export interface BelgeFis {
  fisId: number; fisTipi: number; tipAdi: string; belgeNo: string; tarih: string; unvan: string;
  miktar: number; paraKodu: string; tutar: number; vezne: string; ettn: string; iptal: boolean;
  gonderimDurumu: string | null;
}

export interface BelgeFisListesi { toplam: number; sayfa: number; boyut: number; kayitlar: BelgeFis[] }

export interface BelgeIstek { fisId?: number | null; belgeNo?: string | null; kod?: string | null }

export interface BelgeArsivSonucu { belgeNo: string; sablon: string; kaynak: "ICE" | "SABLON"; onizleme: boolean; yol: string; boyut: number }

export const BELGE_NO_DESENI = /^[A-Z]{3}\d{13}$/;
export const belgeNoMu = (v: string) => BELGE_NO_DESENI.test(v.trim().toUpperCase());

const sorgu = (i: BelgeIstek, ek: Record<string, string> = {}) => {
  const p = new URLSearchParams(ek);
  if (i.fisId) p.set("fisId", String(i.fisId));
  if (i.belgeNo) p.set("belgeNo", i.belgeNo.trim().toUpperCase());
  if (i.kod) p.set("kod", i.kod);
  return p.toString();
};

/**
 * Korumalı PDF ucunu kimlik başlıklarıyla indirir (bkz. ebelgeService.ebelgePdfBlobUrl:
 * düz bağlantıda Bearer token gitmediği için 401 alınır). Dönen adres kullanıldıktan sonra
 * URL.revokeObjectURL ile bırakılmalıdır.
 */
async function pdfGetir(yol: string): Promise<{ blob: Blob; kaynak: string; onizleme: boolean }> {
  const token = localStorage.getItem("kuyumcu_erp_access_token");
  const dbServer = localStorage.getItem("kuyumcu_erp_last_server") || localStorage.getItem("kuyumcu_erp_active_server");
  const dbName = localStorage.getItem("kuyumcu_erp_last_db") || localStorage.getItem("kuyumcu_erp_active_db");
  const dbUser = localStorage.getItem("kuyumcu_erp_db_user");
  const dbPassword = localStorage.getItem("kuyumcu_erp_db_password");
  const res = await fetch(`${getEffectiveApiUrl()}${yol}`, {
    method: "GET",
    headers: {
      Accept: "application/pdf",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(dbServer ? { "x-db-server": dbServer } : {}),
      ...(dbName ? { "x-db-name": dbName } : {}),
      ...(dbUser ? { "x-db-user": dbUser } : {}),
      ...(dbPassword !== null && dbPassword !== undefined ? { "x-db-password": dbPassword } : {}),
    },
  });
  if (!res.ok) {
    let mesaj = `PDF alınamadı (HTTP ${res.status}).`;
    try { const g = await res.json(); if (g?.message) mesaj = g.message; } catch { /* gövde JSON değil */ }
    throw new Error(mesaj);
  }
  return { blob: await res.blob(), kaynak: res.headers.get("X-Belge-Kaynak") || "", onizleme: res.headers.get("X-Belge-Onizleme") === "1" };
}

export const BelgeService = {
  async sablonlar(tur: "BELGE" | "RAPOR" = "BELGE"): Promise<BelgeSablon[]> {
    const r = await apiClient.get<BelgeSablon[]>("/belge/sablonlar", { tur });
    return r.data || [];
  },

  async fisler(f: { tip?: number | ""; baslangic?: string; bitis?: string; arama?: string; sayfa?: number; boyut?: number }): Promise<BelgeFisListesi> {
    const params: Record<string, any> = { sayfa: f.sayfa || 1, boyut: f.boyut || 50 };
    if (f.tip !== undefined && f.tip !== "") params.tip = f.tip;
    if (f.baslangic) params.baslangic = f.baslangic;
    if (f.bitis) params.bitis = f.bitis;
    if (f.arama?.trim()) params.arama = f.arama.trim();
    const r = await apiClient.get<BelgeFisListesi>("/belge/fisler", params);
    return r.data;
  },

  /** Önizleme için tarayıcı içi blob adresi. */
  async pdfBlobUrl(i: BelgeIstek): Promise<{ url: string; kaynak: string; onizleme: boolean }> {
    const p = await pdfGetir(`/belge/pdf?${sorgu(i)}`);
    return { url: URL.createObjectURL(p.blob), kaynak: p.kaynak, onizleme: p.onizleme };
  },

  /** PDF'i kullanıcının bilgisayarına indirir (yönetici kararı 4). */
  async indir(i: BelgeIstek, dosyaAdi: string): Promise<void> {
    const p = await pdfGetir(`/belge/pdf?${sorgu(i, { indir: "1" })}`);
    const url = URL.createObjectURL(p.blob);
    try {
      const a = document.createElement("a");
      a.href = url; a.download = `${dosyaAdi || "belge"}.pdf`; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1500); }
  },

  /** PDF'i sunucu arşivine yazar (aynı belge yeniden yazılırsa üzerine yazılır). */
  async arsivle(i: BelgeIstek): Promise<BelgeArsivSonucu> {
    const govde: Record<string, any> = {};
    if (i.fisId) govde.fisId = i.fisId;
    if (i.belgeNo) govde.belgeNo = i.belgeNo.trim().toUpperCase();
    if (i.kod) govde.kod = i.kod;
    const r = await apiClient.post<BelgeArsivSonucu>("/belge/arsivle", govde);
    return r.data;
  },
};

export const belgeTarih = (iso: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
};
export const belgeSayi = (n: number, basamak = 2) =>
  Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

export const belgeDurumRozet = (f: BelgeFis): { bg: string; text?: string; etiket: string } => {
  if (f.iptal) return { bg: "danger", etiket: "İptal" };
  switch (f.gonderimDurumu) {
    case "GONDERILDI": return { bg: "success", etiket: "GİB'e gönderildi" };
    case "HATA": return { bg: "danger", etiket: "Hatalı" };
    case "GONDERILIYOR": return { bg: "info", text: "dark", etiket: "Gönderiliyor" };
    case null: case undefined: case "": return { bg: "secondary", etiket: "Gönderilmedi" };
    default: return { bg: "warning", text: "dark", etiket: f.gonderimDurumu };
  }
};
