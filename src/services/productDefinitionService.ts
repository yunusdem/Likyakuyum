import { apiClient } from "./apiClient";

export interface ProductItem {
  id: number;
  kod: string;
  ad: string;
  pariteIslemi: number;
  siraNo: number;
  bagliParaKodu: string | null;
  gramaj: number;
  hasOrani: number;
  iscilik: number;
  dovizAlisHucreOrani: number;
  dovizSatisHucreOrani: number;
  efektifAlisHucreOrani: number;
  efektifSatisHucreOrani: number;
  efektifAlimHesabi: string | null;
  efektifSatimHesabi: string | null;
  efektifDepoHesabi: string | null;
  efektifVaziyetHesabi: string | null;
  dovizAlimHesabi: string | null;
  dovizSatimHesabi: string | null;
  dovizDepoHesabi: string | null;
  dovizVaziyetHesabi: string | null;
  alimSatimKurFarki: number;
  xmlParaKodu: string | null;
  muhasebeSiraNo: number | null;
  hasAlisKatsayisi: number;
  hasSatisKatsayisi: number;
  birim: number;
  urunTipi: number;
}

export interface ProductFormData {
  kod: string;
  ad: string;
  pariteIslemi: number;
  siraNo: number;
  bagliParaKodu: string | null;
  gramaj: number;
  hasOrani: number;
  iscilik: number;
  dovizAlisHucreOrani: number;
  dovizSatisHucreOrani: number;
  efektifAlisHucreOrani: number;
  efektifSatisHucreOrani: number;
  efektifAlimHesabi: string | null;
  efektifSatimHesabi: string | null;
  efektifDepoHesabi: string | null;
  efektifVaziyetHesabi: string | null;
  dovizAlimHesabi: string | null;
  dovizSatimHesabi: string | null;
  dovizDepoHesabi: string | null;
  dovizVaziyetHesabi: string | null;
  alimSatimKurFarki: number;
  xmlParaKodu: string | null;
  muhasebeSiraNo: number | null;
  hasAlisKatsayisi: number;
  hasSatisKatsayisi: number;
  birim: number;
  urunTipi: number;
}

export class ProductDefinitionService {
  public static async getProducts(): Promise<ProductItem[]> {
    const res = await apiClient.get<ProductItem[]>("/para");
    return res.data || [];
  }

  public static async getProductById(id: number | string): Promise<ProductItem> {
    const res = await apiClient.get<ProductItem>(`/para/${id}`);
    return res.data;
  }

  public static async createProduct(data: ProductFormData): Promise<ProductItem> {
    const res = await apiClient.post<ProductItem>("/para", data);
    return res.data;
  }

  public static async updateProduct(id: number | string, data: ProductFormData): Promise<ProductItem> {
    const res = await apiClient.put<ProductItem>(`/para/${id}`, data);
    return res.data;
  }

  public static async deleteProduct(id: number | string): Promise<boolean> {
    const res = await apiClient.delete<{ id: string }>(`/para/${id}`);
    return res.success;
  }
}
