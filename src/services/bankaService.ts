import { apiClient } from "./apiClient";

export interface BankaHesapItem {
  bankaId: number;
  hesapNo: string;
  hesapAdi: string;
  iban?: string | null;
  subeAdi?: string | null;
  bankaAdiId?: number | null;
  bankaAdi?: string | null;
  eFaturadaGozuksun: boolean;
  muhHesapKodlari?: string | null;
  devir: number;
  aktif: boolean;
  toplamGiris?: number;
  toplamCikis?: number;
  bakiye?: number;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
}

export interface SaveBankaHesapPayload {
  bankaId?: number | null;
  hesapNo: string;
  hesapAdi: string;
  iban?: string | null;
  subeAdi?: string | null;
  bankaAdiId?: number | null;
  eFaturadaGozuksun?: boolean;
  muhHesapKodlari?: string | null;
  devir?: number;
  aktif?: boolean;
}

export interface BankaHareketSatiriItem {
  bankaHareketId?: number;
  satirNo: number;
  paraId: number;
  paraKodu?: string;
  paraAdi?: string;
  meblag: number;
  kur: number;
  giseKuru: number;
  tutarTl: number;
  aciklama?: string | null;
}

export interface BankaHareketItem {
  bankaHareketId: number;
  islemTipi: number; // 0: Gelen Havale, 1: Giden Havale, 2: Kasadan Bankaya, 3: Bankadan Kasaya, 4: Virman
  bankaId: number;
  bankaHesapNo?: string;
  bankaHesapAdi?: string;
  bankaIban?: string;
  cariKartId?: number | null;
  cariKod?: string | null;
  cariUnvan?: string | null;
  vezneId?: number | null;
  vezneKod?: string | null;
  vezneAd?: string | null;
  tarih: string;
  belgeNo?: string | null;
  aciklama?: string | null;
  iptal: boolean;
  iptalTarihi?: string | null;
  toplamTutarTl?: number;
  toplamMeblag?: number;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  guncelleyenId?: number | null;
  guncellemeZamani?: string | null;
  satirlar: BankaHareketSatiriItem[];
}

export interface SaveBankaHareketPayload {
  bankaHareketId?: number | null;
  islemTipi: number;
  bankaId: number;
  bankaHesapNo?: string;
  bankaHesapAdi?: string;
  cariKartId?: number | null;
  vezneId?: number | null;
  tarih: string;
  belgeNo?: string | null;
  aciklama?: string | null;
  meblag?: number;
  paraId?: number;
  satirlar?: {
    satirNo?: number;
    paraId: number;
    meblag: number;
    kur?: number;
    giseKuru?: number;
    tutarTl?: number;
    aciklama?: string | null;
  }[];
}

export interface BankaLookups {
  bankaAdlari: {
    id: number;
    kod?: string;
    ad: string;
    unvan?: string;
    bankaAdi?: string;
    iban?: string;
    hesapNo?: string;
    subeAdi?: string;
    telefon?: string;
    vergiNo?: string;
  }[];
  paralar: { id: number; kod: string; ad: string; alisKuru?: number; satisKuru?: number }[];
  vezneler: { id: number; kod: string; ad: string }[];
  cariler: { id: number; kod: string; unvan: string; telefon?: string; vergiNo?: string }[];
  muhHesaplar: { kod: string; ad: string }[];
}

export const BankaService = {
  // ─── Banka Hesap Kartları ──────────────────────────────────────────────────
  async getBankalar(filter?: { search?: string; aktif?: boolean }): Promise<BankaHesapItem[]> {
    const res = await apiClient.get<BankaHesapItem[]>("/banka/hesaplar", filter);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  async getBankaById(id: number): Promise<BankaHesapItem> {
    const res = await apiClient.get<BankaHesapItem>(`/banka/hesaplar/${id}`);
    return (res.data as any)?.data ?? res.data;
  },

  async getNextHesapNo(): Promise<string> {
    const res = await apiClient.get<{ nextNo: string }>("/banka/hesaplar/next-no");
    const data = (res.data as any)?.data ?? res.data;
    return data?.nextNo || "102.01.001";
  },

  async saveBanka(payload: SaveBankaHesapPayload): Promise<BankaHesapItem> {
    const res = await apiClient.post<BankaHesapItem>("/banka/hesaplar", payload);
    return (res.data as any)?.data ?? res.data;
  },

  async deleteBanka(id: number): Promise<void> {
    await apiClient.delete(`/banka/hesaplar/${id}`);
  },

  // ─── Banka Hesap Hareketleri ───────────────────────────────────────────────
  async getHareketler(filter?: {
    bankaId?: number;
    cariKartId?: number;
    vezneId?: number;
    islemTipi?: number;
    baslangicTarihi?: string;
    bitisTarihi?: string;
    search?: string;
    limit?: number;
  }): Promise<BankaHareketItem[]> {
    const res = await apiClient.get<BankaHareketItem[]>("/banka/hareketler", filter);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  async getHareketById(id: number): Promise<BankaHareketItem> {
    const res = await apiClient.get<BankaHareketItem>(`/banka/hareketler/${id}`);
    return (res.data as any)?.data ?? res.data;
  },

  async saveHareket(payload: SaveBankaHareketPayload): Promise<BankaHareketItem> {
    const res = await apiClient.post<BankaHareketItem>("/banka/hareketler", payload);
    return (res.data as any)?.data ?? res.data;
  },

  async deleteHareket(id: number): Promise<void> {
    await apiClient.delete(`/banka/hareketler/${id}`);
  },

  async toggleIptal(id: number, iptal: boolean): Promise<void> {
    await apiClient.post(`/banka/hareketler/${id}/iptal`, { iptal });
  },

  // ─── Lookups ───────────────────────────────────────────────────────────────
  async getLookups(): Promise<BankaLookups> {
    const res = await apiClient.get<BankaLookups>("/banka/lookups");
    const data = (res.data as any)?.data ?? res.data;
    return (
      data || {
        bankaAdlari: [],
        paralar: [],
        vezneler: [],
        cariler: [],
        muhHesaplar: [],
      }
    );
  },
};

export default BankaService;
