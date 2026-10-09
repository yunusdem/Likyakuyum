import { apiClient } from "./apiClient";
import { FastLookupCache } from "./fastLookupCache";

export interface StatisticItem {
  id: number;
  kod: string;
  aciklama: string;
  fisTipi: number;
  komisyonOrani: number;
  bmvOrani: number;
  fisDizaynTipi: number;
  belgeNoUretmeSekli: number;
  ciktiSatirSayisi: number;
  f1Tusu: number;
  odemeSekliVar: boolean;
  odemeSekli: number | null;
  muhHesapId: number | null;
  efektifDepoHesapId: number | null;
  efektifVaziyetHesapId: number | null;
  kmvOrani: number;
  komisyonYetkisi: boolean;
}

export interface StatisticFormData {
  kod: string;
  aciklama: string;
  fisTipi: number;
  komisyonOrani: number;
  bmvOrani: number;
  fisDizaynTipi: number;
  belgeNoUretmeSekli: number;
  ciktiSatirSayisi: number;
  f1Tusu: number;
  odemeSekliVar: boolean;
  odemeSekli: number | null;
  muhHesapId: number | null;
  efektifDepoHesapId: number | null;
  efektifVaziyetHesapId: number | null;
  kmvOrani: number;
  komisyonYetkisi: boolean;
}

export class StatisticService {
  public static async getStatistics(forceRefresh: boolean = false): Promise<StatisticItem[]> {
    if (forceRefresh) {
      FastLookupCache.invalidate("statistics");
    }
    return FastLookupCache.get("statistics", async () => {
      const res = await apiClient.get<StatisticItem[]>("/istatistik");
      return res.data || [];
    });
  }

  public static async getStatisticById(id: number | string): Promise<StatisticItem> {
    const res = await apiClient.get<StatisticItem>(`/istatistik/${id}`);
    return res.data;
  }

  public static async createStatistic(data: StatisticFormData): Promise<StatisticItem> {
    const res = await apiClient.post<StatisticItem>("/istatistik", data);
    FastLookupCache.invalidate("statistics");
    return res.data;
  }

  public static async updateStatistic(id: number | string, data: StatisticFormData): Promise<StatisticItem> {
    const res = await apiClient.put<StatisticItem>(`/istatistik/${id}`, data);
    FastLookupCache.invalidate("statistics");
    return res.data;
  }

  public static async deleteStatistic(id: number | string): Promise<boolean> {
    const res = await apiClient.delete<{ id: string }>(`/istatistik/${id}`);
    FastLookupCache.invalidate("statistics");
    return res.success;
  }
}
