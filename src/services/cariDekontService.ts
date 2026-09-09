import { apiClient } from "./apiClient";

export interface CariDekontSatiriModel {
  satirNo: number;
  tip: number;
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  hasOrani: number;
  meblag: number;
  hasMiktar: number;
  kur: number;
  giseKuru: number;
  tutar: number;
  aciklama?: string;
}

export interface CariDekontModel {
  cariDekontId: number;
  dekontNo: string;
  tip: number; // 0: Emanet Alma (Giriş), 1: Emanet Verme (Çıkış)
  tipLabel: string;
  tarih: string;
  aciklama: string;
  kurCinsi: number;
  borcluId: number;
  borcluKod: string;
  borcluAd: string;
  borcluTelefon?: string;
  alacakliId: number;
  alacakliKod: string;
  alacakliAd: string;
  alacakliTelefon?: string;
  telefon?: string;
  kullaniciId: number;
  ekleyenAd: string;
  vezneId: number;
  vezneKod: string;
  vezneAd: string;
  satirDurumu: number;
  evrakTuru: number;
  vade: string | null;
  iptalTarihi: string | null;
  oncekiId: number | null;
  eklemeZamani: string;
  guncellemeZamani: string;
  toplamMiktar: number;
  toplamHas: number;
  toplamTutar: number;
  satirlar: CariDekontSatiriModel[];
}

export interface CariDekontListItem {
  cariDekontId: number;
  dekontNo: string;
  tip: number;
  tipLabel: string;
  tarih: string;
  cariKod: string;
  cariAd: string;
  vezneKod: string;
  vezneAd: string;
  aciklama: string;
  kalemSayisi: number;
  toplamMiktar: number;
}

export interface SaveCariDekontPayload {
  cariDekontId?: number | null;
  tip: number; // 0: Emanet Alma, 1: Emanet Verme
  tarih: string;
  aciklama?: string;
  kurCinsi?: number;
  borcluId: number;
  alacakliId: number;
  telefon?: string;
  vezneId: number;
  kullaniciId?: number;
  degisiklikTakipVar?: boolean;
  satirDurumu?: number;
  evrakTuru?: number;
  vade?: string | null;
  iptalTarihi?: string | null;
  oncekiId?: number | null;
  satirlar: {
    satirNo?: number;
    tip?: number;
    paraId: number;
    meblag: number;
    kur?: number;
    giseKuru?: number;
    aciklama?: string;
  }[];
}

export class CariDekontService {
  /**
   * Get dekont list for search modal (Dürbün)
   */
  public static async getDekontList(params?: {
    search?: string;
    tip?: number;
    vezneId?: number;
    limit?: number;
  }): Promise<CariDekontListItem[]> {
    const res = await apiClient.get<CariDekontListItem[]>("/cari-dekont", params);
    return res.data || [];
  }

  /**
   * Get single dekont by ID
   */
  public static async getDekontById(id: number): Promise<CariDekontModel> {
    const res = await apiClient.get<CariDekontModel>(`/cari-dekont/${id}`);
    return res.data;
  }

  /**
   * Save or Update Cari Dekont via Stored Procedure SODVZ_CARI_DEKONT_KAYDET
   */
  public static async saveDekont(payload: SaveCariDekontPayload): Promise<CariDekontModel> {
    const res = await apiClient.post<CariDekontModel>("/cari-dekont/kaydet", payload);
    return res.data;
  }

  /**
   * Delete Cari Dekont via Stored Procedure SODVZ_CARI_DEKONT_SIL
   */
  public static async deleteDekont(id: number, kullaniciId?: number): Promise<boolean> {
    await apiClient.delete(`/cari-dekont/${id}`, { params: { kullaniciId } });
    return true;
  }
}
