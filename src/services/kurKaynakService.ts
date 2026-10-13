import { apiClient } from "./apiClient";

/** Anlık Fiyat Listesi kur kaynağı + komisyon (docs/KUR_KAYNAGI_YOL_HARITASI.md) */

export type KomisyonTuru = "Y" | "T";
export type KurKaynakDurum = "canli" | "bekliyor" | "kopuk";

export interface KurKaynakBilgi {
  kod: string;
  ad: string;
  durum: KurKaynakDurum;
  sonGuncelleme: string | null;
}

export interface KurKaynakSatiri {
  paraId: number;
  kod: string;
  dovizAlis: number;
  dovizSatis: number;
  efektifAlis: number;
  efektifSatis: number;
}

export interface KurKaynakSonucu {
  kaynak: string;
  kaynakAd: string;
  sonGuncelleme: string | null;
  satirlar: KurKaynakSatiri[];
  eksikBirimler: string[];
  hasGeldi: boolean;
}

export interface KurKomisyonSatiri {
  paraId: number;
  kod: string;
  ad: string;
  urunTipi: number | null;
  alisTur: KomisyonTuru;
  alisDeger: number;
  satisTur: KomisyonTuru;
  satisDeger: number;
}

export const KurKaynakService = {
  async kaynaklar(): Promise<{ secili: string; kaynaklar: KurKaynakBilgi[] }> {
    const res = await apiClient.request<{ secili: string; kaynaklar: KurKaynakBilgi[] }>("/kur/kaynaklar", { method: "GET" });
    return res.data ?? { secili: "tcmb", kaynaklar: [] };
  },

  async seciliKaydet(kaynak: string): Promise<void> {
    await apiClient.request("/kur/kaynak-secili", { method: "PUT", body: JSON.stringify({ kaynak }) });
  },

  async cek(kaynak: string): Promise<KurKaynakSonucu> {
    const res = await apiClient.request<KurKaynakSonucu>(`/kur/kaynak/${encodeURIComponent(kaynak)}`, { method: "GET" });
    return res.data!;
  },

  async komisyonlar(): Promise<KurKomisyonSatiri[]> {
    const res = await apiClient.request<KurKomisyonSatiri[]>("/kur/komisyon", { method: "GET" });
    return res.data ?? [];
  },

  async komisyonKaydet(satirlar: KurKomisyonSatiri[]): Promise<KurKomisyonSatiri[]> {
    const res = await apiClient.request<KurKomisyonSatiri[]>("/kur/komisyon", { method: "PUT", body: JSON.stringify({ satirlar }) });
    return res.data ?? [];
  },
};
