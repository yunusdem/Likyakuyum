import { apiClient } from "./apiClient";
import { notifyVezneBakiyeChanged } from "./vezneSyncService";

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

export interface VezneSonIslemItem {
  id: string;
  belgeTipi: number;
  belgeTipiAdi: string;
  belgeId: number;
  satirNo: number;
  ayak: number;
  vezneId: number;
  vezneKod: string;
  vezneAd: string;
  tarih: string;
  saat: string;
  paraId: number;
  paraKod: string;
  paraAdi: string;
  giris: number;
  cikis: number;
  miktar: number;
  yon: "GIRIS" | "CIKIS";
  kur: number;
  tutar: number;
  belgeNo: string;
  unvan: string;
  aciklama: string;
  fisTip: number | null;
}

export class VezneIzlemeService {
  public static async getIzlemeData(): Promise<VezneIzlemeDataResponse> {
    const res = await apiClient.request<VezneIzlemeDataResponse>("/vezne/izleme", {
      method: "GET",
    });
    return res.data;
  }

  public static async getSonIslemler(limit = 100, vezneId?: number): Promise<VezneSonIslemItem[]> {
    const query = new URLSearchParams();
    if (limit) query.set("limit", String(limit));
    if (vezneId) query.set("vezneId", String(vezneId));
    const res = await apiClient.request<VezneSonIslemItem[]>(`/vezne/izleme/son-islemler?${query.toString()}`, {
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
    notifyVezneBakiyeChanged({ type: "bakiye_update", vezneId, paraId });
  }

  public static async saveAllBakiyeler(
    items: { vezneId: number; paraId: number; miktar: number }[]
  ): Promise<void> {
    await apiClient.request("/vezne/izleme/toplu-bakiye", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    notifyVezneBakiyeChanged({ type: "toplu_bakiye" });
  }
}

