import { apiClient } from "./apiClient";

export interface CariHareketSatirItem {
  satirNo: number;
  paraId: number;
  paraKodu: string;
  paraAdi?: string;
  meblag: number;
  hasOrani?: number;
}

export interface CariHareketItem {
  id: number;
  cariKartId: number;
  cariKod: string;
  cariAd: string;
  tarih: string;
  hareketTipi: number;
  hareketTipiLabel: string;
  aciklama: string;
  tip: number; // 0: Borç, 1: Alacak
  tipLabel: string;
  ekleyenId: number;
  eklemeZamani: string;
  guncelleyenId: number;
  guncellemeZamani: string;
  vezneId: number;
  vezneKod: string;
  vezneAd: string;
  posCihaziId: number | null;
  satirlar: CariHareketSatirItem[];
  toplamSatirSayisi?: number;
  satirlarOzet?: string;
}

export interface CariHareketFormData {
  cariKartId: number;
  tarih: string;
  hareketTipi: number;
  aciklama: string;
  tip: number; // 0: Borç, 1: Alacak
  vezneId: number;
  posCihaziId?: number | null;
  satirlar: {
    paraId: number;
    meblag: number;
    paraKodu?: string;
  }[];
}

export interface CariBakiyeRow {
  paraId: number;
  kod: string;
  ad: string;
  borcBakiye: number;
  alacakBakiye: number;
  netBakiye: number;
  yon: "B" | "A" | "-";
  hasOrani?: number;
}

export interface CariBakiyeSummary {
  cariKartId: number;
  kod: string;
  ad: string;
  satirlar: CariBakiyeRow[];
  netHasBakiye: number;
  netHasYon: "B" | "A" | "-";
  headerLabel: string;
}

export interface NavigationResult {
  firstId: number | null;
  prevId: number | null;
  nextId: number | null;
  lastId: number | null;
  currentIndex: number;
  total: number;
}

export class CariHareketService {
  public static async list(filters?: {
    startDate?: string;
    endDate?: string;
    cariKartId?: number;
    vezneId?: number;
    tip?: number;
    hareketTipi?: number;
    search?: string;
  }): Promise<CariHareketItem[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.cariKartId) params.append("cariKartId", String(filters.cariKartId));
    if (filters?.vezneId) params.append("vezneId", String(filters.vezneId));
    if (filters?.tip !== undefined && filters?.tip !== null && String(filters?.tip) !== "-1") {
      params.append("tip", String(filters.tip));
    }
    if (filters?.hareketTipi !== undefined && filters?.hareketTipi !== null && String(filters?.hareketTipi) !== "-1") {
      params.append("hareketTipi", String(filters.hareketTipi));
    }
    if (filters?.search) params.append("search", filters.search);

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const res = await apiClient.get<CariHareketItem[]>(`/cari-hareket${queryStr}`);
    return res.data || [];
  }

  public static async getById(id: number | string): Promise<CariHareketItem> {
    const res = await apiClient.get<CariHareketItem>(`/cari-hareket/${id}`);
    return res.data;
  }

  public static async create(data: CariHareketFormData): Promise<CariHareketItem> {
    const res = await apiClient.post<CariHareketItem>("/cari-hareket", data);
    return res.data;
  }

  public static async update(id: number | string, data: CariHareketFormData): Promise<CariHareketItem> {
    const res = await apiClient.put<CariHareketItem>(`/cari-hareket/${id}`, data);
    return res.data;
  }

  public static async delete(id: number | string): Promise<boolean> {
    const res = await apiClient.delete<{ id: string }>(`/cari-hareket/${id}`);
    return res.success;
  }

  public static async getNavigation(currentId?: number | string): Promise<NavigationResult> {
    const path = currentId ? `/cari-hareket/navigation/${currentId}` : "/cari-hareket/navigation";
    const res = await apiClient.get<NavigationResult>(path);
    return (
      res.data || {
        firstId: null,
        prevId: null,
        nextId: null,
        lastId: null,
        currentIndex: -1,
        total: 0,
      }
    );
  }

  public static async getCariBakiye(cariKartId: number | string): Promise<CariBakiyeSummary> {
    const res = await apiClient.get<CariBakiyeSummary>(`/cari-hareket/bakiye/${cariKartId}`);
    return (
      res.data || {
        cariKartId: Number(cariKartId),
        kod: "",
        ad: "",
        satirlar: [],
        netHasBakiye: 0,
        netHasYon: "-",
        headerLabel: "HAS 0.00",
      }
    );
  }
}
