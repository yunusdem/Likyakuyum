import { apiClient } from "./apiClient";

/** Kullanıcı görünümü uçları (docs/KULLANICI_GORUNUM_YOL_HARITASI.md, Faz 1); yalnız yönetici */
export interface KullaniciGorunumDto {
  kullaniciId: number;
  kapali: string[];
}

export const KullaniciGorunumService = {
  async oku(kullaniciId: number | string): Promise<KullaniciGorunumDto> {
    const res = await apiClient.get<KullaniciGorunumDto>(`/kullanici-gorunum/${kullaniciId}`);
    return res.data;
  },
  async kaydet(kullaniciId: number | string, kapali: string[]): Promise<KullaniciGorunumDto> {
    const res = await apiClient.put<KullaniciGorunumDto>(`/kullanici-gorunum/${kullaniciId}`, { kapali });
    return res.data;
  },
};
