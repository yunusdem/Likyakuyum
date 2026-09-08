import { apiClient } from "./apiClient";

export interface KurRowItem {
  paraId: number;
  kod: string;
  ad: string;
  siraNo: number;
  dovizAlis: number | null;
  dovizSatis: number | null;
  efektifAlis: number | null;
  efektifSatis: number | null;
  parite: number | null;
}

export interface KurTablosuItem {
  id: number;
  tur: number; // 0: Anlık, 1: Günlük, 2: Saklanan Anlık, 3: Saklanan Günlük
  tarih: string; // YYYY-MM-DD
  zaman: string; // ISO Datetime
  kapanisKurTablosuId?: number | null;
  satirlar: KurRowItem[];
}

export interface SaveKurTablosuPayload {
  id?: number | null;
  tur: number;
  zaman?: string;
  kaynakKurTablosuId?: number | null;
  satirlar?: {
    paraId: number;
    dovizAlis?: number | null;
    dovizSatis?: number | null;
    efektifAlis?: number | null;
    efektifSatis?: number | null;
    parite?: number | null;
  }[];
}

export interface StoredKurDateItem {
  id: number;
  tarih: string;
  zaman: string;
}

export class KurService {
  public static async getKurTablosu(params: {
    tur: number;
    tarih?: string;
    id?: number;
  }): Promise<KurTablosuItem> {
    const res = await apiClient.request<KurTablosuItem>("/kur/tablo", {
      method: "GET",
      params: {
        tur: params.tur,
        tarih: params.tarih,
        id: params.id,
      },
    });
    return res.data;
  }

  public static async saveKurTablosu(
    payload: SaveKurTablosuPayload
  ): Promise<KurTablosuItem> {
    const res = await apiClient.request<KurTablosuItem>("/kur/kaydet", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public static async sakla(params: {
    kaynakKurTablosuId: number;
    targetTur?: number;
    zaman?: string;
  }): Promise<KurTablosuItem> {
    const res = await apiClient.request<KurTablosuItem>("/kur/sakla", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return res.data;
  }

  public static async getStoredDates(tur: number = 2): Promise<StoredKurDateItem[]> {
    const res = await apiClient.request<StoredKurDateItem[]>("/kur/tarihler", {
      method: "GET",
      params: { tur },
    });
    return res.data || [];
  }

  public static async deleteKurTablosu(id: number): Promise<void> {
    await apiClient.request(`/kur/tablo/${id}`, {
      method: "DELETE",
    });
  }

  public static async fetchTcmb(): Promise<
    Record<
      string,
      {
        forexBuying?: number;
        forexSelling?: number;
        banknoteBuying?: number;
        banknoteSelling?: number;
      }
    >
  > {
    const res = await apiClient.request<
      Record<
        string,
        {
          forexBuying?: number;
          forexSelling?: number;
          banknoteBuying?: number;
          banknoteSelling?: number;
        }
      >
    >("/kur/tcmb", {
      method: "GET",
    });
    return res.data || {};
  }
}
