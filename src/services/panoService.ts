import { apiClient } from "./apiClient";

export interface PanoSatiriModel {
  paraId: number;
  kod: string;
  ad: string;
  gorunecekAd: string;
  siraNo: number;
  gorunur: boolean;
  carpan: number;
  dovizAlis?: number | null;
  dovizSatis?: number | null;
}

export interface PanoModel {
  panoId: number;
  panoNo: string;
  yenilemeAraligi: number;
  firmaAdi: string;
  paraBasligi: string;
  alisKuruBasligi: string;
  satisKuruBasligi: string;
  firmaAdiOzellikleri: string;
  tarihSaatOzellikleri: string;
  baslikOzellikleri: string;
  satirOzellikleri: string;
  zeminRengi: string;
  boslukSayisi: number;
  htmlDosyaAdi: string;
  kodAlaniGenisligi: number;
  kurAlaniGenisligi: number;
  satirlar: PanoSatiriModel[];
}

export interface SavePanoPayload {
  panoId?: number | null;
  panoNo: string;
  yenilemeAraligi?: number;
  firmaAdi?: string;
  paraBasligi?: string;
  alisKuruBasligi?: string;
  satisKuruBasligi?: string;
  firmaAdiOzellikleri?: string;
  tarihSaatOzellikleri?: string;
  baslikOzellikleri?: string;
  satirOzellikleri?: string;
  zeminRengi?: string;
  boslukSayisi?: number;
  htmlDosyaAdi?: string;
  kodAlaniGenisligi?: number;
  kurAlaniGenisligi?: number;
  satirlar?: {
    paraId: number;
    gorunecekAd?: string;
    siraNo?: number;
    gorunur?: boolean;
    carpan?: number;
  }[];
}

export class PanoService {
  public static async getAllPanos(): Promise<PanoModel[]> {
    const res = await apiClient.request<PanoModel[]>("/pano", {
      method: "GET",
    });
    return res.data || [];
  }

  public static async getPanoById(id: number): Promise<PanoModel> {
    const res = await apiClient.request<PanoModel>(`/pano/${id}`, {
      method: "GET",
    });
    return res.data;
  }

  public static async savePano(payload: SavePanoPayload): Promise<PanoModel> {
    const res = await apiClient.request<PanoModel>("/pano/kaydet", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public static async deletePano(id: number): Promise<void> {
    await apiClient.request(`/pano/${id}`, {
      method: "DELETE",
    });
  }

  public static async getLiveBoardData(id: number): Promise<PanoModel> {
    const res = await apiClient.request<PanoModel>(`/pano/live/${id}`, {
      method: "GET",
    });
    return res.data;
  }
}
