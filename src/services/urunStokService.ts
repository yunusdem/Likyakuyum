import { apiClient, getEffectiveApiUrl } from "./apiClient";

/** I- Etiket İşlemleri › Altın Ürün Stoğu / Özel Ürün Stoğu — /etiket/{altin|ozel}-urun-stogu */

export type UrunStokTipi = "altin" | "ozel";

export interface UrunStokFiltre {
  baslangic?: string;
  bitis?: string;
  tarihTuru?: "satis" | "kayit";
  durum?: "tumu" | "stokta" | "satildi";
  ayar?: string;
  grupKodu?: string;
  ureticiFirma?: string;
  banko?: string;
  search?: string;
  cariKartId?: number;
}

export interface UrunStokSatir {
  urunId: number; tarih: string | null; grupKodu: string; urunNo: number | null; grupUrun: string; barkod: string; urunAdi: string;
  ayar: string; ureticiFirma: string; orjinalKod: string; banko: string; miktar: number; miktarBirimi: string; hasGram: number | null;
  birim: string; maliyet: number; maliyetTl: number; satis: number; satisTl: number; kar: number; karTl: number; karYuzde: number | null;
  satildi: boolean; durum: "Stokta" | "Satıldı"; satisTarihi: string | null; faturaNo: string; musteri: string; cariKartId: number | null; kur: number;
}

export interface UrunStokOzet {
  durum: string; adet: number; miktar: number; hasGram: number; birim: string;
  maliyet: number; maliyetTl: number; satis: number; satisTl: number; kar: number; karTl: number; karYuzde: number | null;
}

export interface UrunStokSonuc { satirlar: UrunStokSatir[]; ozet: UrunStokOzet[]; kurAciklama: string; filtreOzeti: string; toplamKayit: number }
export interface UrunStokSecenekler { ayarlar: string[]; gruplar: string[]; ureticiler: string[]; bankolar: string[] }

const sorgu = (f: UrunStokFiltre) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
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

const yol = (tip: UrunStokTipi) => `/etiket/${tip}-urun-stogu`;

export const UrunStokService = {
  async veri(tip: UrunStokTipi, f: UrunStokFiltre): Promise<UrunStokSonuc> {
    const res = await apiClient.get<UrunStokSonuc>(yol(tip), f);
    const d = (res.data as any)?.data ?? res.data;
    return { satirlar: Array.isArray(d?.satirlar) ? d.satirlar : [], ozet: Array.isArray(d?.ozet) ? d.ozet : [], kurAciklama: d?.kurAciklama || "", filtreOzeti: d?.filtreOzeti || "", toplamKayit: Number(d?.toplamKayit || 0) };
  },
  async secenekler(tip: UrunStokTipi): Promise<UrunStokSecenekler> {
    const res = await apiClient.get<UrunStokSecenekler>(`${yol(tip)}/secenekler`);
    const d = (res.data as any)?.data ?? res.data;
    return { ayarlar: d?.ayarlar || [], gruplar: d?.gruplar || [], ureticiler: d?.ureticiler || [], bankolar: d?.bankolar || [] };
  },
  async pdfBlobUrl(tip: UrunStokTipi, f: UrunStokFiltre) {
    return URL.createObjectURL(await dosyaGetir(`${yol(tip)}/pdf?${sorgu(f)}`, "application/pdf"));
  },
  async pdfIndir(tip: UrunStokTipi, f: UrunStokFiltre, ad: string) {
    indirBlob(await dosyaGetir(`${yol(tip)}/pdf?${sorgu({ ...f, indir: "1" } as any)}`, "application/pdf"), `${ad}.pdf`);
  },
  async excelIndir(tip: UrunStokTipi, f: UrunStokFiltre, ad: string) {
    indirBlob(await dosyaGetir(`${yol(tip)}/excel?${sorgu(f)}`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), `${ad}.xlsx`);
  },
};
