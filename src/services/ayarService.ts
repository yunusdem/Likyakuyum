import { apiClient } from "./apiClient";

export interface AyarItem {
  ayarId: number;
  ayarKodu: string;
  ayarAdi: string;
  milyem: number;
  standartAyar: number;
  siraNo: number;
  varsayilan: boolean;
  aktif: boolean;
  aciklama?: string | null;
}

export interface SaveAyarDto {
  ayarId?: number | null;
  ayarKodu: string;
  ayarAdi: string;
  milyem: number;
  standartAyar?: number | null;
  siraNo?: number;
  varsayilan?: boolean;
  aktif?: boolean;
  aciklama?: string | null;
}

export class AyarService {
  /**
   * Ayar listesini veritabanından (SODVZ_AYAR_LISTELE) getirir
   */
  public static async getAyarlar(sadeceAktif: boolean = false): Promise<AyarItem[]> {
    try {
      const response = await apiClient.get<AyarItem[]>("/ayar", {
        params: { sadeceAktif },
      });
      return response.data || [];
    } catch (error) {
      console.error("Ayar listesi alınamadı:", error);
      return [];
    }
  }

  /**
   * Yeni ayar ekler veya günceller (SODVZ_AYAR_KAYDET)
   */
  public static async saveAyar(data: SaveAyarDto): Promise<{ ayarId: number; yeniKayit: boolean }> {
    const response = await apiClient.post<{ ayarId: number; yeniKayit: boolean }>("/ayar", data);
    return response.data;
  }

  /**
   * Ayar kaydını siler (SODVZ_AYAR_SIL)
   */
  public static async deleteAyar(ayarId: number): Promise<boolean> {
    await apiClient.delete(`/ayar/${ayarId}`);
    return true;
  }
}
