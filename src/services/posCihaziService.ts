import { apiClient } from "./apiClient";

export interface PosCihaziItem {
  posCihaziId: number;
  cariKartId?: number | null;
  cariKodu?: string | null;
  cariUnvan?: string | null;
  kod: string;
  ad: string;
  devir: number;
  bakiye?: number;
  aktif?: boolean;
}

export interface SavePosCihaziPayload {
  posCihaziId?: number | null;
  cariKartId?: number | null;
  kod: string;
  ad: string;
  devir?: number;
  aktif?: boolean;
}

export class PosCihaziService {
  public static async getPosCihazlari(): Promise<PosCihaziItem[]> {
    const res = await apiClient.get<PosCihaziItem[]>("/banka/pos-cihazlari");
    return res.data || [];
  }

  public static async getPosCihaziById(id: number): Promise<PosCihaziItem> {
    const res = await apiClient.get<PosCihaziItem>(`/banka/pos-cihazlari/${id}`);
    return res.data;
  }

  public static async getPosCihaziBakiye(id: number): Promise<number> {
    const res = await apiClient.get<{ posCihaziId: number; bakiye: number }>(`/banka/pos-cihazlari/${id}/bakiye`);
    return Number(res.data?.bakiye || 0);
  }

  public static async getNextPosKod(): Promise<string> {
    const res = await apiClient.get<{ kod: string }>("/banka/pos-cihazlari/next-kod");
    return res.data?.kod || "";
  }

  public static async savePosCihazi(payload: SavePosCihaziPayload): Promise<PosCihaziItem> {
    const res = await apiClient.post<PosCihaziItem>("/banka/pos-cihazlari", payload);
    return res.data;
  }

  public static async deletePosCihazi(id: number): Promise<boolean> {
    const res = await apiClient.delete(`/banka/pos-cihazlari/${id}`);
    return res.success;
  }
}
