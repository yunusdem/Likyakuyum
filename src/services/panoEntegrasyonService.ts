import { apiClient } from "./apiClient";

/** Kur › Pano Entegrasyonu (docs/PANO_API_YOL_HARITASI.md): pano başına açık veri anahtarı. */

export interface PanoAdresleri {
  json: string;
  xml: string;
  txt: string;
  html: string;
}

export interface PanoEntegrasyonSatiri {
  panoId: number;
  panoNo: string;
  firmaAdi: string;
  satirSayisi: number;
  anahtar: string | null;
  adresler: PanoAdresleri | null;
  onbellekSn: number;
  olusturan: string | null;
  olusturmaTarihi: string | null;
  sonErisim: string | null;
  istekSayisi: number;
}

export class PanoEntegrasyonService {
  public static async liste(): Promise<PanoEntegrasyonSatiri[]> {
    const res = await apiClient.request<PanoEntegrasyonSatiri[]>("/pano-entegrasyonu", { method: "GET" });
    return res.data || [];
  }

  /** Üret ya da yenile (eski adres anında kapanır) */
  public static async uret(panoId: number): Promise<PanoEntegrasyonSatiri> {
    const res = await apiClient.request<PanoEntegrasyonSatiri>(`/pano-entegrasyonu/${panoId}/anahtar`, { method: "POST" });
    return res.data;
  }

  public static async iptal(panoId: number): Promise<PanoEntegrasyonSatiri> {
    const res = await apiClient.request<PanoEntegrasyonSatiri>(`/pano-entegrasyonu/${panoId}/anahtar`, { method: "DELETE" });
    return res.data;
  }

  public static async onbellek(panoId: number, sn: number): Promise<PanoEntegrasyonSatiri> {
    const res = await apiClient.put<PanoEntegrasyonSatiri>(`/pano-entegrasyonu/${panoId}/onbellek`, { sn });
    return res.data;
  }
}
