import { apiClient } from "./apiClient";

export interface CariKartItem {
  id: number;
  kod: string;
  ad: string;
  kisilikTipi: number;
  yetkiliKisi: string | null;
  vergiDairesiId: number | null;
  vergiKimlikNo: string | null;
  babaAdi: string | null;
  adres: string | null;
  postaKoduId: number | null;
  ilceId: number | null;
  ilId: number | null;
  telefon: string | null;
  uyrukId: number | null;
  ulkeId: number | null;
  hukukiYapiId: number | null;
  vekilTuru: number | null;
  vekilKisilikTipi: number | null;
  vekilAdi: string | null;
  vekilKimlikNo: string | null;
  pasaportNo: string | null;
  alisIstatistikId: number | null;
  satisIstatistikId: number | null;
  arbitrajAlisIstatistikId: number | null;
  arbitrajSatisIstatistikId: number | null;
  eposta: string | null;
  bankaHesabiId: number | null;
  anneAdi: string | null;
  kimlikSeriNo: string | null;
  dogumTarihi: string | null;
  dogumYeri: string | null;
  karaListede: boolean;
  sektorId: number | null;
  meslekId: number | null;
  kimlikGecerlilikTarihi: string | null;
  faaliyetBelgesiAlindi: boolean;
  vergiLevhasiAlindi: boolean;
  imzaSirkuleriAlindi: boolean;
  imzaSirkuGecerlilikTarihi: string | null;
  yetkiliKimlikNo: string | null;
  yetkiliKmlkGecerlikTarih: string | null;
  filtre: string | null;
  cariBakiyeSiniri: number | null;
  sirketTuru: number | null;
  kimlikBelgeTuru: number | null;
  dernekAmaci: string | null;
  yetkiliKisiId: number | null;
  favoriParaId: number | null;
  whatsappAdi: string | null;
  eFaturaPostaKutusu: string | null;
  eIrsaliyePostaKutusu: string | null;
}

export interface CariKartFormData {
  kod: string;
  ad: string;
  kisilikTipi: number;
  yetkiliKisi: string | null;
  vergiDairesiId: number | null;
  vergiKimlikNo: string | null;
  babaAdi: string | null;
  adres: string | null;
  postaKoduId: number | null;
  ilceId: number | null;
  ilId: number | null;
  telefon: string | null;
  uyrukId: number | null;
  ulkeId: number | null;
  hukukiYapiId: number | null;
  vekilTuru: number | null;
  vekilKisilikTipi: number | null;
  vekilAdi: string | null;
  vekilKimlikNo: string | null;
  pasaportNo: string | null;
  alisIstatistikId: number | null;
  satisIstatistikId: number | null;
  arbitrajAlisIstatistikId: number | null;
  arbitrajSatisIstatistikId: number | null;
  eposta: string | null;
  bankaHesabiId: number | null;
  anneAdi: string | null;
  kimlikSeriNo: string | null;
  dogumTarihi: string | null;
  dogumYeri: string | null;
  karaListede: boolean;
  sektorId: number | null;
  meslekId: number | null;
  kimlikGecerlilikTarihi: string | null;
  faaliyetBelgesiAlindi: boolean;
  vergiLevhasiAlindi: boolean;
  imzaSirkuleriAlindi: boolean;
  imzaSirkuGecerlilikTarihi: string | null;
  yetkiliKimlikNo: string | null;
  yetkiliKmlkGecerlikTarih: string | null;
  filtre: string | null;
  cariBakiyeSiniri: number | null;
  sirketTuru: number | null;
  kimlikBelgeTuru: number | null;
  dernekAmaci: string | null;
  yetkiliKisiId: number | null;
  favoriParaId: number | null;
  whatsappAdi: string | null;
  eFaturaPostaKutusu: string | null;
  eIrsaliyePostaKutusu: string | null;
}

export interface LookupItem {
  id: number;
  ad: string;
  kod?: string | null;
  tur?: number;
  fisTipi?: number;
}

export interface CariLookups {
  vergiDairesiList: LookupItem[];
  ilList: LookupItem[];
  ilceList: LookupItem[];
  postaKoduList: LookupItem[];
  hukukiYapiList: LookupItem[];
  sektorList: LookupItem[];
  meslekList: LookupItem[];
  bankaList?: any[];
  ulkeList: LookupItem[];
  paraList: LookupItem[];
  istatistikList: LookupItem[];
}

export class CariService {
  public static async getLookups(): Promise<CariLookups> {
    const res = await apiClient.get<CariLookups>("/cari/lookups");
    return (
      res.data || {
        vergiDairesiList: [],
        ilList: [],
        ilceList: [],
        postaKoduList: [],
        hukukiYapiList: [],
        sektorList: [],
        meslekList: [],
        ulkeList: [],
        paraList: [],
        istatistikList: [],
      }
    );
  }

  public static async getCariKartlar(): Promise<CariKartItem[]> {
    const res = await apiClient.get<CariKartItem[]>("/cari");
    return res.data || [];
  }

  public static async getCariKartById(id: number | string): Promise<CariKartItem> {
    const res = await apiClient.get<CariKartItem>(`/cari/${id}`);
    return res.data;
  }

  public static async createCariKart(data: CariKartFormData): Promise<CariKartItem> {
    const res = await apiClient.post<CariKartItem>("/cari", data);
    return res.data;
  }

  public static async updateCariKart(id: number | string, data: CariKartFormData): Promise<CariKartItem> {
    const res = await apiClient.put<CariKartItem>(`/cari/${id}`, data);
    return res.data;
  }

  public static async deleteCariKart(id: number | string): Promise<boolean> {
    const res = await apiClient.delete<{ id: string }>(`/cari/${id}`);
    return res.success;
  }
}
