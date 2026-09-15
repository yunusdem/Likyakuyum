import { apiClient } from "./apiClient";

// ─── Altın Ürün (TODVZ_ALTIN_URUN) ───────────────────────────────────────────
export interface AltinUrunItem {
  altinUrunId: number;
  tarih: string;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  ayar?: string | null;
  ureticiFirma?: string | null;
  orjinalKod?: string | null;
  model?: string | null;
  banko?: string | null;
  miktar: number;
  hasGram: number;
  maliyetIscilik: number;
  maliyetIscilikParaKodu: string;
  maliyetIscilikBirim: string;
  maliyetIscilikTutari: number;
  satisIscilik: number;
  satisIscilikTutari: number;
  iscilikKari: number;
  maliyet: number;
  maliyetParaKodu: string;
  satisFiyati: number;
  satisParaKodu: string;
  satisKariYuzde: number;
  hasKuru1?: number | null;
  hasKuru2?: number | null;
  altinKuru?: number | null;
  resim?: string | null;
  satildi: boolean;
  yazdirildi: boolean;
  yazdirildiZamani?: string | null;
  eklemeZamani?: string | null;
  guncellemeZamani?: string | null;
}

export interface SaveAltinUrunPayload {
  altinUrunId?: number | null;
  tarih?: string | null;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  ayar?: string | null;
  ureticiFirma?: string | null;
  orjinalKod?: string | null;
  model?: string | null;
  banko?: string | null;
  miktar?: number;
  hasGram?: number;
  maliyetIscilik?: number;
  maliyetIscilikParaKodu?: string;
  maliyetIscilikBirim?: string;
  maliyetIscilikTutari?: number;
  satisIscilik?: number;
  satisIscilikTutari?: number;
  iscilikKari?: number;
  maliyet?: number;
  maliyetParaKodu?: string;
  satisFiyati?: number;
  satisParaKodu?: string;
  satisKariYuzde?: number;
  hasKuru1?: number | null;
  hasKuru2?: number | null;
  altinKuru?: number | null;
  resim?: string | null;
  satildi?: boolean;
}

// ─── Özel Ürün (TODVZ_OZEL_URUN) ─────────────────────────────────────────────
export interface OzelUrunItem {
  ozelUrunId: number;
  tarih: string;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  mamulTipi?: string | null;
  ureticiFirma?: string | null;
  miktar: number;
  miktarBirimi: string;
  orjinalKod?: string | null;
  ayar?: string | null;
  modelOzellik1?: string | null;
  modelOzellik2?: string | null;
  banko?: string | null;
  maliyet: number;
  maliyetParaKodu: string;
  karYuzdesi: number;
  sabitle: boolean;
  satisFiyati: number;
  satisParaKodu: string;
  hizliGiris: boolean;
  tasCinsi?: string | null;
  tasMiktar?: number | null;
  tasBirim: string;
  tasRenk?: string | null;
  tasSaflik?: string | null;
  tasAdet?: number | null;
  tasTutar?: number | null;
  tasTutarBirimi: string;
  resim?: string | null;
  satildi: boolean;
  yazdirildi: boolean;
  yazdirildiZamani?: string | null;
  eklemeZamani?: string | null;
  guncellemeZamani?: string | null;
}

export interface SaveOzelUrunPayload {
  ozelUrunId?: number | null;
  tarih?: string | null;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  mamulTipi?: string | null;
  ureticiFirma?: string | null;
  miktar?: number;
  miktarBirimi?: string;
  orjinalKod?: string | null;
  ayar?: string | null;
  modelOzellik1?: string | null;
  modelOzellik2?: string | null;
  banko?: string | null;
  maliyet?: number;
  maliyetParaKodu?: string;
  karYuzdesi?: number;
  sabitle?: boolean;
  satisFiyati?: number;
  satisParaKodu?: string;
  hizliGiris?: boolean;
  tasCinsi?: string | null;
  tasMiktar?: number | null;
  tasBirim?: string;
  tasRenk?: string | null;
  tasSaflik?: string | null;
  tasAdet?: number | null;
  tasTutar?: number | null;
  tasTutarBirimi?: string;
  resim?: string | null;
  satildi?: boolean;
}

// ─── Etiket Şablonları ────────────────────────────────────────────────────────
export interface EtiketSablonAlan {
  key: string;
  ad: string;
  aktif: boolean;
  sira: number;
}

export interface EtiketSablonItem {
  etiketSablonId: number;
  ad: string;
  etiketTipi: number; // 0: Altın/Sarrafiye, 1: Özel/Pırlanta, 2: Yüzük-Bilezik, 3: Fiyat-Ayar
  genislikMm: number;
  yukseklikMm: number;
  kuyrukPayiMm: number;
  logoKonumu: string;
  barkodTipi: string; // CODE128 | QR
  alanlar: EtiketSablonAlan[];
  varsayilan: boolean;
}

export interface SaveEtiketSablonPayload {
  etiketSablonId?: number | null;
  ad: string;
  etiketTipi: number;
  genislikMm?: number;
  yukseklikMm?: number;
  kuyrukPayiMm?: number;
  logoKonumu?: string;
  barkodTipi?: string;
  alanlar?: EtiketSablonAlan[];
  varsayilan?: boolean;
}

export interface EtiketGrupNoResult {
  grupKodu: string;
  sonNo: number;
  barkod: string;
  yeniGrup: boolean;
}

export const EtiketService = {
  // ─── Altın Ürün ────────────────────────────────────────────────────────────
  async getAltinUrunler(filter?: Record<string, any>): Promise<AltinUrunItem[]> {
    const res = await apiClient.get<AltinUrunItem[]>("/etiket/altin-urun", filter);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async getAltinUrunById(id: number): Promise<AltinUrunItem> {
    const res = await apiClient.get<AltinUrunItem>(`/etiket/altin-urun/${id}`);
    return (res.data as any)?.data ?? res.data;
  },
  async getAltinUrunByBarkod(barkod: string): Promise<AltinUrunItem> {
    const res = await apiClient.get<AltinUrunItem>(`/etiket/altin-urun/barkod/${encodeURIComponent(barkod)}`);
    return (res.data as any)?.data ?? res.data;
  },
  async saveAltinUrun(payload: SaveAltinUrunPayload): Promise<AltinUrunItem> {
    const res = await apiClient.post<AltinUrunItem>("/etiket/altin-urun", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async deleteAltinUrun(id: number): Promise<void> {
    await apiClient.delete(`/etiket/altin-urun/${id}`);
  },
  async markAltinUrunYazdirildi(ids: number[], yazdirildi: boolean): Promise<void> {
    await apiClient.post("/etiket/altin-urun/yazdirildi-isaretle", { ids, yazdirildi });
  },
  async getNextAltinUrunNo(grupKodu: string, uzunluk = 5): Promise<EtiketGrupNoResult> {
    const res = await apiClient.get<EtiketGrupNoResult>("/etiket/altin-urun/next-no", { grupKodu, uzunluk });
    return (res.data as any)?.data ?? res.data;
  },

  // ─── Özel Ürün ─────────────────────────────────────────────────────────────
  async getOzelUrunler(filter?: Record<string, any>): Promise<OzelUrunItem[]> {
    const res = await apiClient.get<OzelUrunItem[]>("/etiket/ozel-urun", filter);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async getOzelUrunById(id: number): Promise<OzelUrunItem> {
    const res = await apiClient.get<OzelUrunItem>(`/etiket/ozel-urun/${id}`);
    return (res.data as any)?.data ?? res.data;
  },
  async getOzelUrunByBarkod(barkod: string): Promise<OzelUrunItem> {
    const res = await apiClient.get<OzelUrunItem>(`/etiket/ozel-urun/barkod/${encodeURIComponent(barkod)}`);
    return (res.data as any)?.data ?? res.data;
  },
  async saveOzelUrun(payload: SaveOzelUrunPayload): Promise<OzelUrunItem> {
    const res = await apiClient.post<OzelUrunItem>("/etiket/ozel-urun", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async deleteOzelUrun(id: number): Promise<void> {
    await apiClient.delete(`/etiket/ozel-urun/${id}`);
  },
  async markOzelUrunYazdirildi(ids: number[], yazdirildi: boolean): Promise<void> {
    await apiClient.post("/etiket/ozel-urun/yazdirildi-isaretle", { ids, yazdirildi });
  },
  async getNextOzelUrunNo(grupKodu: string, uzunluk = 5): Promise<EtiketGrupNoResult> {
    const res = await apiClient.get<EtiketGrupNoResult>("/etiket/ozel-urun/next-no", { grupKodu, uzunluk });
    return (res.data as any)?.data ?? res.data;
  },

  // ─── Ortak Lookup'lar ──────────────────────────────────────────────────────
  async getGrupKodlari(): Promise<string[]> {
    const res = await apiClient.get<string[]>("/etiket/grup-kodlari");
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async getUreticiFirmalar(): Promise<string[]> {
    const res = await apiClient.get<string[]>("/etiket/uretici-firmalar");
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  // ─── Etiket Şablonları ─────────────────────────────────────────────────────
  async getSablonlar(etiketTipi?: number): Promise<EtiketSablonItem[]> {
    const res = await apiClient.get<EtiketSablonItem[]>("/etiket/sablon", etiketTipi !== undefined ? { etiketTipi } : undefined);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async getSablonById(id: number): Promise<EtiketSablonItem> {
    const res = await apiClient.get<EtiketSablonItem>(`/etiket/sablon/${id}`);
    return (res.data as any)?.data ?? res.data;
  },
  async saveSablon(payload: SaveEtiketSablonPayload): Promise<EtiketSablonItem> {
    const res = await apiClient.post<EtiketSablonItem>("/etiket/sablon", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async deleteSablon(id: number): Promise<void> {
    await apiClient.delete(`/etiket/sablon/${id}`);
  },
};

export default EtiketService;
