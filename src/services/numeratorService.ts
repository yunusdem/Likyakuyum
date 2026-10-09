import { apiClient } from "./apiClient";
import { FastLookupCache } from "./fastLookupCache";

export interface NumeratorItem {
  id: string; // `${tur}_${yaziciId ?? "null"}`
  tur: number;
  yaziciId: number | null;
  yaziciAdi?: string | null;
  onek: string;
  baslangic: number;
  bitis: number;
  uzunluk: number;
  onuneSifirKoy: boolean;
  ornekNumara: string;
}

export interface NumeratorFormData {
  tur: number;
  yaziciId: number | null;
  yaziciOrtakAlan?: boolean;
  onek: string;
  baslangic: number;
  bitis: number;
  uzunluk: number;
  onuneSifirKoy: boolean;
}

export class NumeratorService {
  public static async getNumerators(forceRefresh: boolean = false): Promise<NumeratorItem[]> {
    if (forceRefresh) {
      FastLookupCache.invalidate("numerators");
    }
    return FastLookupCache.get("numerators", async () => {
      const res = await apiClient.get<NumeratorItem[]>("/numerator");
      return res.data || [];
    });
  }

  public static async getNumeratorById(id: string): Promise<NumeratorItem> {
    const res = await apiClient.get<NumeratorItem>(`/numerator/${id}`);
    return res.data;
  }

  public static async createNumerator(data: NumeratorFormData): Promise<NumeratorItem> {
    const res = await apiClient.post<NumeratorItem>("/numerator", data);
    FastLookupCache.invalidate("numerators");
    return res.data;
  }

  public static async saveNumerator(data: NumeratorFormData): Promise<NumeratorItem> {
    const res = await apiClient.post<NumeratorItem>("/numerator/save", data);
    FastLookupCache.invalidate("numerators");
    return res.data;
  }

  public static async updateNumerator(id: string, data: NumeratorFormData): Promise<NumeratorItem> {
    const res = await apiClient.put<NumeratorItem>(`/numerator/${id}`, data);
    FastLookupCache.invalidate("numerators");
    return res.data;
  }

  public static async deleteNumerator(id: string): Promise<boolean> {
    const res = await apiClient.delete<{ id: string }>(`/numerator/${id}`);
    FastLookupCache.invalidate("numerators");
    return res.success;
  }
}
