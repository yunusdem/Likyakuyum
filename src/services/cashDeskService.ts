import { apiClient } from "./apiClient";

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
  public static async getVezneler(): Promise<VezneItem[]> {
    const res = await apiClient.get<VezneItem[]>("/vezne");
    return res.data || [];
  }

  public static async getVezneById(id: number | string): Promise<VezneItem> {
    const res = await apiClient.get<VezneItem>(`/vezne/${id}`);
    return res.data;
  }

  public static async createVezne(data: VezneFormData): Promise<VezneItem> {
    const res = await apiClient.post<VezneItem>("/vezne", data);
    return res.data;
  }

  public static async updateVezne(id: number | string, data: VezneFormData): Promise<VezneItem> {
    const res = await apiClient.put<VezneItem>(`/vezne/${id}`, data);
    return res.data;
  }

  public static async deleteVezne(id: number | string): Promise<boolean> {
    const res = await apiClient.delete<{ id: string }>(`/vezne/${id}`);
    return res.success;
  }

  public static async getPrinters(): Promise<LookupPrinter[]> {
    const res = await apiClient.get<LookupPrinter[]>("/vezne/printers");
    return res.data || [];
  }

  public static async getCurrencies(): Promise<LookupCurrency[]> {
    const res = await apiClient.get<LookupCurrency[]>("/vezne/currencies");
    return res.data || [];
  }
}
