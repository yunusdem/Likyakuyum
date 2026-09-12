import { apiClient } from "./apiClient";

export interface DovizFisSatiriModel {
  satirNo: number;
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  miktar: number;
  kur: number;
  iscilik?: number;
  giseKuru?: number;
  tutar: number;
  komisyonOrani?: number;
  komisyon?: number;
  bmvOrani?: number;
  bmv?: number;
  kmvOrani?: number;
  kmv?: number;
  kdvOrani?: number;
  kdv?: number;
  bankaHesabiId?: number | null;
  seriNo?: string;
  belgeNo?: string;
}

export interface DovizFisModel {
  fisId: number;
  vezneId: number;
  vezneKod?: string;
  vezneAd?: string;
  tip: number; // 0: Alış, 1: Satış
  tipLabel: string;
  tarih: string;
  zaman: string;
  seriNo: string;
  belgeNo: string;
  gelisNedeni: string;
  kurTuru: number;
  kurTuruLabel: string;
  istatistikId: number | null;
  istatistikKodu?: string;
  cariKartId: number | null;
  cariKod?: string;
  unvan: string;
  kisilikTipi: number;
  uyrukId: number | null;
  ulkeId: number | null;
  pasaportNo?: string;
  vergiDairesiId: number | null;
  vergiKimlikNo?: string;
  babaAdi?: string;
  adres?: string;
  ilceId?: number | null;
  ilce?: string;
  postaKoduId?: number | null;
  postaKodu?: string;
  ilId?: number | null;
  il?: string;
  vekilTuru?: number;
  vekilKisilikTipi?: number;
  vekilAdi?: string;
  vekilKimlikNo?: string;
  bankaHesabiId?: number | null;
  kmvUygulamaSekli?: number;
  eposta?: string;
  merkezUsdKuru?: number;
  giseUsdKuru?: number;
  gmBeyannameTarih?: string | null;
  gmBeyannameNo?: string;
  gmDovizTarih?: string | null;
  gmDovizSayi?: string;
  gmTeyitTarih?: string | null;
  gmTeyitSayi?: string;
  gmFaturaNo?: string;
  arbitrajId?: number | null;
  telefonNo?: string;
  meslekId?: number | null;
  dogumTarihi?: string | null;
  dogumYeri?: string;
  kimlikSeriNo?: string;
  anneAdi?: string;
  sirketTuru?: number | null;
  dernekAmaci?: string;
  yetkiliKisi?: string;
  yetkiliKisiId?: number | null;
  kimlikKaynagi?: string;
  kimlikGecerlilikTarihi?: string | null;
  kimlikBelgeTuru?: number;
  toplamTutar: number;
  yuvarlama: number;
  odemeTutari: number;
  bsmvTutar: number;
  iptal: boolean;
  iptalTarihi?: string | null;
  ekleyenId: number;
  eklemeZamani: string;
  guncelleyenId: number;
  guncellemeZamani: string;
  satirlar: DovizFisSatiriModel[];
}

export interface DovizFisListItem {
  fisId: number;
  seriNo: string;
  belgeNo: string;
  tip: number;
  tipLabel: string;
  tarih: string;
  zaman: string;
  unvan: string;
  vergiKimlikNo: string;
  toplamTutar: number;
  odemeTutari: number;
  vezneKod?: string;
  vezneAd?: string;
  iptal: boolean;
}

export interface SaveDovizFisPayload {
  fisId?: number | null;
  vezneId?: number;
  tip: number; // 0: Alış, 1: Satış
  tarih: string;
  zaman?: string;
  seriNo?: string;
  belgeNo?: string;
  gelisNedeni?: string;
  kurTuru?: number;
  istatistikId?: number | null;
  cariKartId?: number | null;
  unvan?: string;
  kisilikTipi?: number;
  uyrukId?: number | null;
  ulkeId?: number | null;
  pasaportNo?: string;
  hukukiYapiId?: number | null;
  vergiDairesiId?: number | null;
  vergiKimlikNo?: string;
  babaAdi?: string;
  adres?: string;
  ilceId?: number | null;
  ilce?: string;
  postaKoduId?: number | null;
  postaKodu?: string;
  ilId?: number | null;
  il?: string;
  vekilTuru?: number;
  vekilKisilikTipi?: number;
  vekilAdi?: string;
  vekilKimlikNo?: string;
  toplamTutar?: number;
  yuvarlama?: number;
  odemeTutari?: number;
  bankaHesabiId?: number | null;
  kmvUygulamaSekli?: number;
  eposta?: string;
  merkezUsdKuru?: number;
  giseUsdKuru?: number;
  gmBeyannameTarih?: string | null;
  gmBeyannameNo?: string;
  gmDovizTarih?: string | null;
  gmDovizSayi?: string;
  gmTeyitTarih?: string | null;
  gmTeyitSayi?: string;
  gmFaturaNo?: string;
  arbitrajId?: number | null;
  telefonNo?: string;
  meslekId?: number | null;
  dogumTarihi?: string | null;
  dogumYeri?: string;
  anneAdi?: string;
  kimlikSeriNo?: string;
  kimlikGecerlilikTarihi?: string | null;
  sirketTuru?: number | null;
  dernekAmaci?: string;
  yetkiliKisi?: string;
  yetkiliKisiId?: number | null;
  kimlikKaynagi?: string;
  kullaniciId?: number;
  satirlar: {
    satirNo?: number;
    paraId: number;
    paraKodu?: string;
    paraAdi?: string;
    miktar: number;
    kur: number;
    iscilik?: number;
    giseKuru?: number;
    tutar?: number;
    komisyonOrani?: number;
    komisyon?: number;
    bmvOrani?: number;
    bmv?: number;
    kmvOrani?: number;
    kmv?: number;
    kdvOrani?: number;
    kdv?: number;
    bankaHesabiId?: number | null;
  }[];
}

export class DovizFisService {
  /**
   * Get döviz fişleri list for search modal (Dürbün)
   */
  public static async getFisList(params?: {
    search?: string;
    tip?: number;
    vezneId?: number;
    limit?: number;
  }): Promise<DovizFisListItem[]> {
    const res = await apiClient.get<DovizFisListItem[]>("/doviz-fis", params);
    return res.data || [];
  }

  /**
   * Get single döviz fişi by ID
   */
  public static async getFisById(id: number): Promise<DovizFisModel> {
    const res = await apiClient.get<DovizFisModel>(`/doviz-fis/${id}`);
    return res.data;
  }

  /**
   * Save or Update Doviz Fis via Stored Procedure SODVZ_FIS_KAYDET
   */
  public static async saveFis(payload: SaveDovizFisPayload): Promise<DovizFisModel> {
    const res = await apiClient.post<DovizFisModel>("/doviz-fis/kaydet", payload);
    return res.data;
  }

  /**
   * Delete Doviz Fis
   */
  public static async deleteFis(id: number): Promise<boolean> {
    await apiClient.delete(`/doviz-fis/${id}`);
    return true;
  }

  /**
   * Get dynamic Vezne balances for TL, USD, EUR and all currencies
   */
  public static async getVezneBakiye(vezneId: number): Promise<VezneBakiyeResponse> {
    const res = await apiClient.get<VezneBakiyeResponse>(`/doviz-fis/vezne-bakiye/${vezneId}`);
    return res.data || { tl: 0, usd: 0, eur: 0, bakiyeler: [] };
  }

  /**
   * Get TODVZ_ISTATISTIK list filtered by tip (0: Alış, 1: Satış)
   */
  public static async getIstatistikler(tip?: number): Promise<IstatistikSecimItem[]> {
    const params = tip !== undefined ? { tip } : undefined;
    const res = await apiClient.get<IstatistikSecimItem[]>("/doviz-fis/istatistikler", params);
    return res.data || [];
  }

  /**
   * Get TODVZ_KAYITSIZ_MUSTERI list
   */
  public static async getKayitsizMusteriler(): Promise<KayitsizMusteriItem[]> {
    try {
      const res = await apiClient.get<KayitsizMusteriItem[]>("/doviz-fis/kayitsiz-musteriler");
      return res.data || [];
    } catch {
      return [];
    }
  }
}

export interface KayitsizMusteriItem {
  id: number;
  ad: string;
  unvan?: string;
  vergiKimlikNo?: string;
  adres?: string;
  telefon?: string;
}

export interface IstatistikSecimItem {
  id: number;
  kod: string;
  ad: string;
  tip: number;
  fisDizaynTipi?: number;
  ciktiSatirSayisi?: number;
  aciklama?: string;
  fisTipi?: number;
}

export interface VezneBakiyeDetailItem {
  paraId: number;
  kod: string;
  ad: string;
  miktar: number;
}

export interface VezneBakiyeResponse {
  tl: number;
  usd: number;
  eur: number;
  bakiyeler?: VezneBakiyeDetailItem[];
}


