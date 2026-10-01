import { apiClient } from "./apiClient";

export type PiyasaGrupKodu = "doviz" | "parite" | "altin" | "sarrafiye" | "gumus" | "kulce" | "iscilik" | "merkez";
export type PiyasaYon = "yukari" | "asagi" | null;

export interface PiyasaSatiri {
  kod: string;
  ad: string;
  altAd?: string;
  alis: number | null;
  satis: number | null;
  eskiAlis?: number | null;
  eskiSatis?: number | null;
  degisim?: number | null;
  ondalik: number;
  zaman?: string | null;
  ortakKod?: string;
  yon?: PiyasaYon;
}

export interface PiyasaGrubu {
  kod: PiyasaGrupKodu;
  baslik: string;
  tur: "alis-satis" | "yeni-eski";
  satirlar: PiyasaSatiri[];
}

export interface PiyasaKaynak {
  kod: string;
  ad: string;
  site: string;
  durum: "canli" | "bekliyor" | "kopuk";
  sonGuncelleme: string | null;
  hata: string | null;
  gruplar: PiyasaGrubu[];
}

export interface PiyasaYaniti {
  sunucuSaati: string;
  kaynaklar: PiyasaKaynak[];
}

export class PiyasaService {
  public static async anlik(): Promise<PiyasaYaniti> {
    const res = await apiClient.get<PiyasaYaniti>("/piyasa");
    return res.data;
  }
}
