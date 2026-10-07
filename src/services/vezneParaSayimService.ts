import { apiClient } from "./apiClient";

export interface VezneParaSayimSatirDto {
  satirId?: number;
  sayimId?: number;
  paraId: number;
  paraKodu: string;
  paraAdi?: string;
  kasaBakiyesi: number;
  sayilanTutar: number;
  fark: number;
  toplamAdet: number;
  kupurler?: Record<number | string, number>;
}

export interface VezneParaSayimDto {
  sayimId?: number;
  tarih: string;
  saat?: string;
  vezneId: number;
  vezneKodu?: string;
  vezneAdi?: string;
  kullaniciId?: number | null;
  kullaniciAdi?: string;
  aciklama?: string;
  genelDurum?: string;
  countsMap?: Record<string, Record<number | string, number>>;
  satirlar?: VezneParaSayimSatirDto[];
  kayitTarihi?: string;
}

export class VezneParaSayimService {
  /**
   * Sayım oturumunu ve tüm satırlarını veritabanına kaydeder
   */
  public static async saveSayim(payload: VezneParaSayimDto): Promise<{ sayimId: number }> {
    const response = await apiClient.post("/vezne/para-sayim", payload);
    return response.data?.data || response.data;
  }

  /**
   * Veznenin en son kaydedilen sayımını getirir
   */
  public static async getSonSayim(vezneId: number): Promise<VezneParaSayimDto | null> {
    try {
      const response = await apiClient.get(`/vezne/para-sayim/son/${vezneId}`);
      return response.data?.data || response.data || null;
    } catch {
      return null;
    }
  }

  /**
   * Veznenin geçmiş sayımlarını listeler
   */
  public static async getGecmisSayimlar(vezneId: number, limit = 50): Promise<VezneParaSayimDto[]> {
    try {
      const response = await apiClient.get(`/vezne/para-sayim/gecmis/${vezneId}?limit=${limit}`);
      return response.data?.data || response.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Belirli bir sayım kaydının detaylarını getirir
   */
  public static async getSayimById(sayimId: number): Promise<VezneParaSayimDto | null> {
    try {
      const response = await apiClient.get(`/vezne/para-sayim/${sayimId}`);
      return response.data?.data || response.data || null;
    } catch {
      return null;
    }
  }

  /**
   * Sayım kaydını siler
   */
  public static async deleteSayim(sayimId: number): Promise<boolean> {
    const response = await apiClient.delete(`/vezne/para-sayim/${sayimId}`);
    return !!response.data?.success;
  }
}

