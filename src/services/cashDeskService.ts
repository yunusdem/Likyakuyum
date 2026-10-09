import { apiClient } from "./apiClient";
import { FastLookupCache } from "./fastLookupCache";

export interface VezneItem {
  id: number;
  kod: string;
  ad: string;
  fisTipi: number;
  paraId: number | null;
  alisFisiYaziciId: number | null;
  satisFisiYaziciId: number | null;
  altinAlisFisiYaziciId: number | null;
  altinSatisFisiYaziciId: number | null;
  alisSatisIzniVar: boolean;
  musteriTaniFormuYaziciId: number | null;
  musteriTaniFormuYaziciVar: boolean;
  paraKodu?: string;
  alisFisiYaziciAdi?: string;
  satisFisiYaziciAdi?: string;
}

export interface VezneFormData {
  kod: string;
  ad: string;
  fisTipi: number;
  paraId: number | null;
  alisFisiYaziciId: number | null;
  satisFisiYaziciId: number | null;
  altinAlisFisiYaziciId: number | null;
  altinSatisFisiYaziciId: number | null;
  alisSatisIzniVar: boolean;
  musteriTaniFormuYaziciId: number | null;
  musteriTaniFormuYaziciVar: boolean;
}

export interface LookupPrinter {
  id: number;
  name: string;
  deviceName?: string;
}

export interface LookupCurrency {
  id: number;
  code: string;
  name: string;
}

export class CashDeskService {
  public static async getVezneler(forceRefresh: boolean = false): Promise<VezneItem[]> {
    if (forceRefresh) {
      FastLookupCache.invalidate("vezneler");
    }
    return FastLookupCache.get("vezneler", async () => {
      const res = await apiClient.get<VezneItem[]>("/vezne");
      return res.data || [];
    });
  }

  public static async getVezneById(id: number | string): Promise<VezneItem> {
    const res = await apiClient.get<VezneItem>(`/vezne/${id}`);
    return res.data;
  }

  public static async createVezne(data: VezneFormData): Promise<VezneItem> {
    const res = await apiClient.post<VezneItem>("/vezne", data);
    FastLookupCache.invalidate("vezneler");
    return res.data;
  }

  public static async updateVezne(id: number | string, data: VezneFormData): Promise<VezneItem> {
    const res = await apiClient.put<VezneItem>(`/vezne/${id}`, data);
    FastLookupCache.invalidate("vezneler");
    return res.data;
  }

  public static async deleteVezne(id: number | string): Promise<boolean> {
    const res = await apiClient.delete<{ id: string }>(`/vezne/${id}`);
    FastLookupCache.invalidate("vezneler");
    return res.success;
  }

  public static async getPrinters(): Promise<LookupPrinter[]> {
    return FastLookupCache.get("printers", async () => {
      const res = await apiClient.get<LookupPrinter[]>("/vezne/printers");
      return res.data || [];
    });
  }

  public static async getCurrencies(): Promise<LookupCurrency[]> {
    return FastLookupCache.get("currencies", async () => {
      const res = await apiClient.get<LookupCurrency[]>("/vezne/currencies");
      return res.data || [];
    });
  }
}
