import { apiClient } from "./apiClient";
import { FastLookupCache } from "./fastLookupCache";
import { notifyVezneBakiyeChanged } from "./vezneSyncService";

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
  ettn?: string;
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
  isArbitraj?: boolean;
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
  /** GİB'e gönderilmiş fiş: silinemez */
  gibeGonderildi?: boolean;
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
  isArbitraj?: boolean;
  arbitrajId?: number | null;
  gelisNedeni?: string;
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
  isArbitraj?: boolean;
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
  masakListesindeVar?: boolean;
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
    seriNo?: string;
    belgeNo?: string;
    ettn?: string;
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
    isArbitraj?: boolean;
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
    notifyVezneBakiyeChanged({ type: "doviz" });
    return res.data;
  }

  /**
   * Delete Doviz Fis
   */
  public static async deleteFis(id: number): Promise<boolean> {
    await apiClient.delete(`/doviz-fis/${id}`);
    notifyVezneBakiyeChanged({ type: "doviz_delete", id });
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
    const cacheKey = `istatistikler_${tip !== undefined ? tip : "all"}`;
    return FastLookupCache.get(cacheKey, async () => {
      const params = tip !== undefined ? { tip } : undefined;
      const res = await apiClient.get<IstatistikSecimItem[]>("/doviz-fis/istatistikler", params);
      return res.data || [];
    });
  }

  /**
   * Get TODVZ_KAYITSIZ_MUSTERI list
   */
  public static async getKayitsizMusteriler(forceRefresh: boolean = false): Promise<KayitsizMusteriItem[]> {
    if (forceRefresh) {
      FastLookupCache.invalidate("kayitsizMusteriler");
    }
    return FastLookupCache.get("kayitsizMusteriler", async () => {
      try {
        const res = await apiClient.get<KayitsizMusteriItem[]>("/doviz-fis/kayitsiz-musteriler");
        return res.data || [];
      } catch {
        return [];
      }
    });
  }

  public static async getAktarmaOnizleme(params: {
    ilkTarih: string;
    sonTarih: string;
    dizaynKodu?: string | number;
    hedefVeritabani?: string;
    kaynakHesapId?: number | null;
    kaynakHesapUnvan?: string;
  }): Promise<DovizFisAktarmaOnizlemeResult> {
    const res = await apiClient.get<DovizFisAktarmaOnizlemeResult>("/doviz-fis/aktarma/onizleme", {
      params,
    });
    return res.data;
  }

  public static async calistirAktarma(payload: {
    fisIdler?: number[];
    ilkTarih?: string;
    sonTarih?: string;
    dizaynKodu?: string | number;
    hedefVeritabani?: string;
    hedefHesapId?: number;
    hedefHesapUnvan?: string;
    kaynakHesapId?: number | null;
    kaynakHesapUnvan?: string;
  }): Promise<DovizFisAktarmaCalistirResult> {
    const res = await apiClient.post<DovizFisAktarmaCalistirResult>("/doviz-fis/aktarma/calistir", payload);
    return res.data;
  }
}

export interface DovizFisAktarmaItem {
  fisId: number;
  seriNo: string;
  belgeNo: string;
  tarih: string;
  zaman?: string;
  tip: number; // 0: Alış, 1: Satış
  tipLabel: string;
  istatistikId?: number | null;
  dizaynKodu?: string;
  istatistikKodu?: string;
  cariKartId?: number | null;
  unvan: string;
  tutar: number;
  dahaOnceAktarildi: boolean;
  hedefteMevcut: boolean;
  hedefDurumu: "YENI" | "GUNCELLEME";
  hedefFisId?: number | null;
}

export interface DovizFisAktarmaOnizlemeResult {
  hedefVeritabani: string;
  hedefHesap: {
    id: number;
    kod?: string;
    unvan: string;
  } | null;
  ozet: {
    toplamFisSayisi: number;
    yeniEklenecekSayisi: number;
    guncellenecekSayisi: number;
    zatenAktarilmisSayisi: number;
    toplamTutarTl: number;
  };
  fisler: DovizFisAktarmaItem[];
}

export interface DovizFisAktarmaDetay {
  fisId: number;
  seriNo?: string;
  belgeNo?: string;
  tarih?: string;
  tip?: number;
  unvan?: string;
  durum: "eklendi" | "guncellendi";
}

export interface DovizFisAktarmaCalistirResult {
  toplamIstek?: number;
  aktarilanSayisi?: number;
  yeniEklenenSayisi?: number;
  guncellenenSayisi?: number;
  aktarilanToplam?: number;
  yeniKayit?: number;
  guncellenen?: number;
  hatalar: Array<{ fisId: number; hata: string }>;
  message?: string;
  aktarilanDetaylar?: DovizFisAktarmaDetay[];
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
  bmvOrani?: number;
  kmvOrani?: number;
  komisyonOrani?: number;
  komisyonYetkisi?: boolean;
  odemeSekliVar?: boolean;
  odemeSekli?: number | null;
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


