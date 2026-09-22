import { apiClient } from "./apiClient";

export interface IskontoItem {
  iskontoId: number;
  tanim: string;
  kod?: string | null;
  iskontoTipi?: number | null; // 1: Yüzde (%), 2: Sabit Tutar (TL), 3: Altın/Has Gram, null: Serbest
  oran?: number | null;
  tutar?: number | null;
  hasTutar?: number | null;
  minTutar?: number | null;
  maxIskontoTutari?: number | null;
  aktif: boolean;
  aciklama?: string | null;
  eklemeZamani?: string | null;
  guncellemeZamani?: string | null;
}

export interface SaveIskontoPayload {
  iskontoId?: number | null;
  tanim: string;
  kod?: string | null;
  iskontoTipi?: number | null;
  oran?: number | null;
  tutar?: number | null;
  hasTutar?: number | null;
  minTutar?: number | null;
  maxIskontoTutari?: number | null;
  aktif?: boolean;
  aciklama?: string | null;
}

export class IskontoService {
  public static async getIskontolar(filter?: { search?: string; aktif?: boolean }): Promise<IskontoItem[]> {
    const params: any = {};
    if (filter?.search) params.search = filter.search;
    if (filter?.aktif !== undefined) params.aktif = filter.aktif;

    const res = await apiClient.get<IskontoItem[]>("/iskonto", params);
    return Array.isArray(res.data) ? res.data : [];
  }

  public static async getIskontoById(iskontoId: number): Promise<IskontoItem | null> {
    const res = await apiClient.get<IskontoItem>(`/iskonto/${iskontoId}`);
    return res.data || null;
  }

  public static async saveIskonto(payload: SaveIskontoPayload): Promise<IskontoItem> {
    const res = await apiClient.post<IskontoItem>("/iskonto", payload);
    return res.data;
  }

  public static async deleteIskonto(iskontoId: number, kaliciSil: boolean = true): Promise<boolean> {
    await apiClient.delete(`/iskonto/${iskontoId}`, { params: { kalici: kaliciSil } });
    return true;
  }
}
