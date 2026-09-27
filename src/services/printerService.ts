import { apiClient } from "./apiClient";

export interface YaziciItem {
  id: number;
  siraNo: number;
  ad: string;
  cihazAdi: string | null;
  baglantiNoktasi: string | null;
  belgeYaziciModu: number;
  belgeYaziciDizini: string | null;
  kopyaSayisi: number;
}

export interface YaziciFormData {
  siraNo: number;
  ad: string;
  cihazAdi: string | null;
  baglantiNoktasi: string | null;
  belgeYaziciModu: number;
  belgeYaziciDizini: string | null;
  kopyaSayisi: number;
}

export interface DirectPrintPayload {
  printerId?: number | string | null;
  printerName?: string | null;
  documentTitle?: string | null;
  htmlContent?: string | null;
  textContent?: string | null;
  isPos?: boolean;
  copies?: number;
}

export class PrinterService {
  public static async getYazicilar(): Promise<YaziciItem[]> {
    const res = await apiClient.get<YaziciItem[]>("/yazici");
    return res.data || [];
  }

  public static async getYaziciById(id: number | string): Promise<YaziciItem> {
    const res = await apiClient.get<YaziciItem>(`/yazici/${id}`);
    return res.data;
  }

  public static async createYazici(data: YaziciFormData): Promise<YaziciItem> {
    const res = await apiClient.post<YaziciItem>("/yazici", data);
    return res.data;
  }

  public static async updateYazici(id: number | string, data: YaziciFormData): Promise<YaziciItem> {
    const res = await apiClient.put<YaziciItem>(`/yazici/${id}`, data);
    return res.data;
  }

  public static async deleteYazici(id: number | string): Promise<boolean> {
    const res = await apiClient.delete<{ id: string }>(`/yazici/${id}`);
    return res.success;
  }

  public static async directPrint(
    payload: DirectPrintPayload
  ): Promise<{ success: boolean; message: string; fallbackToBrowser?: boolean }> {
    try {
      const res = await apiClient.post<{ success: boolean; message: string; fallbackToBrowser?: boolean }>(
        "/yazici/direct-print",
        payload
      );
      return res.data || { success: false, message: "Yazıcı yanıt vermedi.", fallbackToBrowser: true };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Yazıcıya doğrudan gönderilemedi.",
        fallbackToBrowser: true,
      };
    }
  }
}
