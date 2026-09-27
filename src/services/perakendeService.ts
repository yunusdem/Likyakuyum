import { apiClient } from "./apiClient";

export interface PerakendeUrunItem {
  altinUrunId: number;
  barkod: string;
  urunAdi: string;
  ayar?: string;
  hasGram: number;
  gram: number;
  miktar: number;
  satisFiyati: number;
  birim?: string;
  kdvOrani?: number;
  satildi?: boolean;
}

export interface PerakendeFaturaSatiriItem {
  faturaSatirId?: number | null;
  faturaId?: number;
  satirNo: number;
  altinUrunId?: number | null;
  barkod?: string | null;
  urunAdi: string;
  ayar?: string | null;
  miktar: number;
  birim: string;
  gram: number;
  hasGram: number;
  birimFiyat: number;
  tutar: number;
  kdvOrani: number;
  kdvTutari: number;
  toplamTutar: number;
}

export interface PerakendeFaturaOdemeItem {
  faturaOdemeId?: number;
  faturaId?: number;
  satirNo: number;
  paraId?: number | null;
  paraKodu: string;
  paraAdi?: string | null;
  adet?: number | null;
  miktar?: number | null;
  milyem?: number | null;
  hasGram?: number | null;
  kur: number;
  tutar: number;
}

export interface PerakendeFaturaModel {
  faturaId: number;
  vezneId: number;
  vezneKod?: string | null;
  vezneAd?: string | null;
  faturaNo: string;
  ettn: string;
  tarih: string;
  faturaTipi: number; // 1: Satış, 2: İade
  senaryo: string; // EARSIVFATURA, TEMELFATURA, TICARIFATURA
  cariKartId?: number | null;
  cariKod?: string | null;
  cariUnvan?: string | null;
  aliciVknTckn: string;
  aliciUnvan: string;
  adres?: string | null;
  ilce?: string | null;
  il?: string | null;
  vergiDairesi?: string | null;
  eposta?: string | null;
  telefon?: string | null;
  paraId: number;
  paraKodu?: string | null;
  kur: number;
  araToplam: number;
  toplamKdv: number;
  iskontoId?: number | null;
  iskontoKodu?: string | null;
  iskontoOrani?: number;
  iskontoTutari?: number;
  genelToplam: number;
  eBelgeDurumu: number; // 0: Taslak, 1: İletildi, 2: Onaylandı, 3: Hata, 4: İptal
  gibStatuKodu?: string | null;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  satirlar?: PerakendeFaturaSatiriItem[];
  odemeler?: PerakendeFaturaOdemeItem[];
}

export interface SavePerakendeFaturaSatiriPayload {
  altinUrunId?: number | null;
  barkod?: string | null;
  urunAdi: string;
  ayar?: string | null;
  miktar: number;
  birim?: string;
  gram?: number;
  hasGram?: number;
  birimFiyat: number;
  kdvOrani?: number;
}

export interface SavePerakendeFaturaOdemePayload {
  satirNo?: number;
  paraId?: number | null;
  paraKodu: string;
  paraAdi?: string | null;
  adet?: number | null;
  miktar?: number | null;
  milyem?: number | null;
  hasGram?: number | null;
  kur?: number;
  tutar: number;
}

export interface SavePerakendeFaturaPayload {
  faturaId?: number | null;
  vezneId?: number;
  faturaNo?: string;
  ettn?: string;
  tarih?: string;
  faturaTipi?: number; // 1: Satış, 2: İade
  senaryo?: string;
  cariKartId?: number | null;
  aliciVknTckn?: string;
  aliciUnvan?: string;
  adres?: string | null;
  ilce?: string | null;
  il?: string | null;
  vergiDairesi?: string | null;
  eposta?: string | null;
  telefon?: string | null;
  paraId?: number;
  kur?: number;
  iskontoId?: number | null;
  iskontoKodu?: string | null;
  iskontoOrani?: number | null;
  iskontoTutari?: number | null;
  satirlar: SavePerakendeFaturaSatiriPayload[];
  odemeler?: SavePerakendeFaturaOdemePayload[];
}

export interface PerakendeFaturaListItem {
  faturaId: number;
  vezneId: number;
  vezneKod?: string | null;
  vezneAd?: string | null;
  faturaNo: string;
  ettn: string;
  tarih: string;
  faturaTipi: number;
  senaryo: string;
  cariKartId?: number | null;
  cariKod?: string | null;
  cariUnvan?: string | null;
  aliciVknTckn: string;
  aliciUnvan: string;
  adres?: string | null;
  ilce?: string | null;
  il?: string | null;
  vergiDairesi?: string | null;
  eposta?: string | null;
  telefon?: string | null;
  paraId: number;
  paraKodu?: string | null;
  kur: number;
  araToplam: number;
  toplamKdv: number;
  iskontoId?: number | null;
  iskontoKodu?: string | null;
  iskontoOrani?: number;
  iskontoTutari?: number;
  genelToplam: number;
  eBelgeDurumu: number;
  gibStatuKodu?: string | null;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
}

export interface PerakendeFaturaFilter {
  baslangicTarihi?: string;
  bitisTarihi?: string;
  aliciVknTckn?: string;
  eBelgeDurumu?: number;
  search?: string;
  limit?: number;
}

export class PerakendeService {
  /**
   * Barkod okutulduğunda stoktaki altın ürünü getirir
   */
  static async getProductByBarcode(barcode: string): Promise<PerakendeUrunItem> {
    const cleanBarcode = encodeURIComponent(barcode.trim());
    const res = await apiClient.get<PerakendeUrunItem>(`/perakende/urun/barkod/${cleanBarcode}`);
    return res.data!;
  }

  /**
   * Bir sonraki fatura numarasını getirir
   */
  static async getNextFaturaNo(prefix: string = "GIB"): Promise<string> {
    try {
      const res = await apiClient.get<{ faturaNo: string }>(`/perakende/fatura-no/next?prefix=${prefix}`);
      return res.data?.faturaNo || `${prefix}${new Date().getFullYear()}000000001`;
    } catch {
      return `${prefix}${new Date().getFullYear()}000000001`;
    }
  }

  /**
   * Perakende fatura oluşturur ve altın ürünleri satıldı olarak günceller
   */
  static async createInvoice(payload: SavePerakendeFaturaPayload): Promise<PerakendeFaturaModel> {
    const res = await apiClient.post<PerakendeFaturaModel>("/perakende/fatura", payload);
    return res.data!;
  }

  /**
   * Faturaları listeler
   */
  static async listInvoices(filters?: PerakendeFaturaFilter): Promise<PerakendeFaturaListItem[]> {
    const res = await apiClient.get<PerakendeFaturaListItem[]>("/perakende/fatura", filters as any);
    return res.data || [];
  }

  /**
   * Fatura detayını satırlarıyla getirir
   */
  static async getInvoiceById(id: number): Promise<PerakendeFaturaModel | null> {
    const res = await apiClient.get<PerakendeFaturaModel>(`/perakende/fatura/${id}`);
    return res.data || null;
  }

  /**
   * Faturayı siler ve satılan altın ürünlerini stoğa iade eder
   */
  static async deleteInvoice(id: number): Promise<void> {
    await apiClient.delete(`/perakende/fatura/${id}`);
  }
}
