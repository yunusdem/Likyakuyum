import { apiClient } from "./apiClient";

export interface HesapItem {
  hesapId: number;
  kod: string;
  ad: string;
  kdvOrani: number;
  aktif: boolean;
  iskontoId?: number | null;
  iskontoKodu?: string | null;
  iskontoTanim?: string | null;
  iskontoOrani?: number | null;
  toplamGiris?: number;
  toplamCikis?: number;
  bakiye?: number;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveHesapPayload {
  hesapId?: number | null;
  kod: string;
  ad: string;
  kdvOrani?: number;
  iskontoId?: number | null;
}

export interface HesapHareketiItem {
  hesapHareketiId: number;
  hesapId: number;
  hesapKod?: string;
  hesapAd?: string;
  tarih: string;
  aciklama?: string | null;
  paraId: number;
  paraKodu?: string;
  paraAdi?: string;
  meblag: number;
  kdvOrani: number;
  kdv: number;
  tip: number; // 0: Giriş, 1: Çıkış
  vezneId: number;
  vezneKod?: string;
  vezneAd?: string;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveHesapHareketiPayload {
  hesapHareketiId?: number | null;
  hesapId: number;
  tarih: string;
  aciklama?: string | null;
  paraId: number;
  meblag: number;
  kdvOrani?: number;
  kdv?: number;
  tip?: number;
  vezneId: number;
  degisiklikTakipVar?: boolean;
}

export interface KasaLookups {
  vezneler: { id: number; kod: string; ad: string }[];
  paralar: { id: number; kod: string; ad: string }[];
}

export const KasaService = {
  // ─── Hesap Kartları ────────────────────────────────────────────────────────
  async getHesaplar(filter?: { search?: string; aktif?: boolean }): Promise<HesapItem[]> {
    const res = await apiClient.get<HesapItem[]>("/kasa/hesaplar", filter);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  async getHesapById(id: number): Promise<HesapItem> {
    const res = await apiClient.get<HesapItem>(`/kasa/hesaplar/${id}`);
    return (res.data as any)?.data ?? res.data;
  },

  async saveHesap(payload: SaveHesapPayload): Promise<HesapItem> {
    const res = await apiClient.post<HesapItem>("/kasa/hesaplar", payload);
    return (res.data as any)?.data ?? res.data;
  },

  async deleteHesap(id: number): Promise<void> {
    await apiClient.delete(`/kasa/hesaplar/${id}`);
  },

  // ─── Hesap Hareketleri ─────────────────────────────────────────────────────
  async getHareketler(filter?: { hesapId?: number; vezneId?: number; search?: string; limit?: number }): Promise<HesapHareketiItem[]> {
    const res = await apiClient.get<HesapHareketiItem[]>("/kasa/hareketler", filter);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  async getHareketById(id: number): Promise<HesapHareketiItem> {
    const res = await apiClient.get<HesapHareketiItem>(`/kasa/hareketler/${id}`);
    return (res.data as any)?.data ?? res.data;
  },

  async saveHareket(payload: SaveHesapHareketiPayload): Promise<HesapHareketiItem> {
    const res = await apiClient.post<HesapHareketiItem>("/kasa/hareketler", payload);
    return (res.data as any)?.data ?? res.data;
  },

  async deleteHareket(id: number, degisiklikTakipVar?: boolean): Promise<void> {
    await apiClient.delete(`/kasa/hareketler/${id}`, {
      body: JSON.stringify({ degisiklikTakipVar: Boolean(degisiklikTakipVar) }),
    });
  },

  // ─── Lookups ───────────────────────────────────────────────────────────────
  async getLookups(): Promise<KasaLookups> {
    const res = await apiClient.get<KasaLookups>("/kasa/lookups");
    const data = (res.data as any)?.data ?? res.data;
    return data || { vezneler: [], paralar: [] };
  },

  async getUserVezne(): Promise<number | null> {
    const res = await apiClient.get<{ vezneId: number | null }>("/kasa/user-vezne");
    const data = (res.data as any)?.data ?? res.data;
    return data?.vezneId ?? null;
  },
};

export default KasaService;
