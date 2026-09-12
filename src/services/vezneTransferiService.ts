import { apiClient } from "./apiClient";

export interface VezneTransferiSatiriItem {
  satirNo: number;
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  miktar: number;
}

export interface VezneTransferiModel {
  id: number;
  tarih: string;
  refNo: string;
  alanVezneId: number;
  alanVezneKod: string;
  alanVezneAd: string;
  verenVezneId: number;
  verenVezneKod: string;
  verenVezneAd: string;
  aciklama: string;
  ekleyenId?: number;
  eklemeZamani?: string;
  guncelleyenId?: number;
  guncellemeZamani?: string;
  satirlar: VezneTransferiSatiriItem[];
}

export interface SaveVezneTransferiPayload {
  id?: number | null;
  tarih: string;
  refNo?: string | null;
  alanVezneId: number;
  verenVezneId: number;
  aciklama?: string | null;
  kullaniciId?: number;
  degisiklikTakipVar?: boolean;
  satirlar: {
    satirNo?: number;
    paraId: number;
    paraKodu?: string;
    paraAdi?: string;
    miktar: number | string;
  }[];
}

export interface VezneTransferiListItem {
  id: number;
  tarih: string;
  refNo: string;
  alanVezneId: number;
  alanVezneKod: string;
  alanVezneAd: string;
  verenVezneId: number;
  verenVezneKod: string;
  verenVezneAd: string;
  aciklama: string;
  satirSayisi: number;
  toplamMiktar: number;
  paraBirimleri?: string;
  eklemeZamani?: string;
}

export interface VezneTransferiNavigation {
  firstId: number | null;
  prevId: number | null;
  nextId: number | null;
  lastId: number | null;
}

export class VezneTransferiService {
  public static async getTransfers(params?: {
    search?: string;
    alanVezneId?: number;
    verenVezneId?: number;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<VezneTransferiListItem[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.alanVezneId) query.append("alanVezneId", String(params.alanVezneId));
    if (params?.verenVezneId) query.append("verenVezneId", String(params.verenVezneId));
    if (params?.startDate) query.append("startDate", params.startDate);
    if (params?.endDate) query.append("endDate", params.endDate);
    if (params?.limit) query.append("limit", String(params.limit));

    const res = await apiClient.get<VezneTransferiListItem[]>(
      `/vezne-transferi${query.toString() ? `?${query.toString()}` : ""}`
    );
    return res.data || [];
  }

  public static async getTransferById(id: number | string): Promise<VezneTransferiModel> {
    const res = await apiClient.get<VezneTransferiModel>(`/vezne-transferi/${id}`);
    return res.data;
  }

  public static async saveTransfer(payload: SaveVezneTransferiPayload): Promise<VezneTransferiModel> {
    const res = await apiClient.post<VezneTransferiModel>("/vezne-transferi", payload);
    return res.data;
  }

  public static async deleteTransfer(
    id: number | string,
    degisiklikTakipVar = false
  ): Promise<boolean> {
    const res = await apiClient.delete<{ id: number }>(`/vezne-transferi/${id}`, {
      body: JSON.stringify({ degisiklikTakipVar }),
    });
    return res.success;
  }

  public static async getNavigation(
    currentId?: number | null
  ): Promise<VezneTransferiNavigation> {
    const res = await apiClient.get<VezneTransferiNavigation>(
      `/vezne-transferi/navigation${currentId ? `?currentId=${currentId}` : ""}`
    );
    return res.data || { firstId: null, prevId: null, nextId: null, lastId: null };
  }

  public static async getNextRefNo(): Promise<string> {
    const res = await apiClient.get<{ refNo: string }>("/vezne-transferi/next-ref");
    return res.data?.refNo || "";
  }

  public static async getVezneBakiyeler(
    vezneId: number
  ): Promise<{ paraId: number; paraKodu: string; paraAdi: string; miktar: number }[]> {
    const res = await apiClient.get<{ paraId: number; paraKodu: string; paraAdi: string; miktar: number }[]>(
      `/vezne-transferi/bakiye/${vezneId}`
    );
    return res.data || [];
  }
}
