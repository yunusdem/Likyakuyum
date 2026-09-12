import { apiClient } from "./apiClient";

export interface VezneIzlemeSettings {
  tazelemeSuresi: number;
  ekrandakiVezneSayisi: number;
  toplamdaParaKodu: boolean;
  firmaDurumuRaporu: boolean;
}

export interface VezneIzlemeColumn {
  vezneId: number;
  kod: string;
  ad: string;
  isAnaKasa: boolean;
}

export interface VezneIzlemeRow {
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  siraNo: number;
  bakiyeler: Record<number, number>; // vezneId -> miktar
  toplam: number;
}

export interface VezneIzlemeDataResponse {
  settings: VezneIzlemeSettings;
  columns: VezneIzlemeColumn[];
  rows: VezneIzlemeRow[];
}

export class VezneIzlemeService {
  public static async getIzlemeData(): Promise<VezneIzlemeDataResponse> {
    const res = await apiClient.request<VezneIzlemeDataResponse>("/vezne/izleme", {
      method: "GET",
    });
    return res.data;
  }

  public static async saveSettings(
    settings: VezneIzlemeSettings
  ): Promise<VezneIzlemeSettings> {
    const res = await apiClient.request<VezneIzlemeSettings>("/vezne/izleme/tanim", {
      method: "POST",
      body: JSON.stringify(settings),
    });
    return res.data;
  }

  public static async updateBakiye(
    vezneId: number,
    paraId: number,
    miktar: number
  ): Promise<void> {
    await apiClient.request("/vezne/izleme/bakiye", {
      method: "POST",
      body: JSON.stringify({ vezneId, paraId, miktar }),
    });
  }

  public static async saveAllBakiyeler(
    items: { vezneId: number; paraId: number; miktar: number }[]
  ): Promise<void> {
    await apiClient.request("/vezne/izleme/toplu-bakiye", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  }
}

