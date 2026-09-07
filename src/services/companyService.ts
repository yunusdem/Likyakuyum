import { apiClient, ApiResponse } from "./apiClient";

export interface TodvzTanimDto {
  SURUM?: string;
  FIRMA_ADI?: string | null;
  SUBE_KODU?: string | null;
  SUBE_ADI?: string | null;
  VERGI_DAIRESI_ID?: number | null;
  VERGI_KIMLIK_NO?: string | null;
  ADRES?: string | null;
  POSTA_KODU_ID?: number | null;
  ILCE_ID?: number | null;
  IL_ID?: number | null;
  ULKE_ID?: number | null;
  TELEFON?: string | null;
  USD_PARA_ID?: number;
  EUR_PARA_ID?: number;
  RAPOR_PARA_ID?: number;
  TL_KURUS_SAYISI?: number;
  DOVIZ_KURUS_SAYISI?: number;
  KUR_KURUS_SAYISI?: number;
  CARI_TL_TOLERANSI?: number | null;
  CARI_USD_TOLERANSI?: number | null;
  DOVIZ_VERGI_SINIRI?: number | null;
  DOVIZ_VERGI_SINIRI_PARA_ID?: number | null;
  SERMAYE_HESABI_ID?: number | null;
  BELGE_DIZINI?: string | null;
  CARI_KOD_SIRA_NO?: number | null;
  CARI_KOD_BASINA_SIFIR?: boolean | null;
  FIS_NO_BASINA_SIFIR?: boolean | null;
  DOVIZ_ALIS_DVZ_SATIS_ORANI?: number;
  EFEKTIF_ALIS_DVZ_SATIS_ORANI?: number;
  EFEKTIF_SATIS_DVZ_SATIS_ORANI?: number;
  ALIS_ISTATISTIK_ID?: number | null;
  SATIS_ISTATISTIK_ID?: number | null;
  ARBITRAJ_ALIS_ISTATISTIK_ID?: number | null;
  ARBITRAJ_SATIS_ISTATISTIK_ID?: number | null;
  SATISIN_DAYANAGI?: string | null;
  FISTE_COKLU_SATIR?: boolean | null;
  TL_YUVARLAMA_ARALIGI?: number | null;
  TL_YUVARLAMA_ESIGI?: number | null;
  TAZELEME_SURESI?: number;
  EKRANDAKI_VEZNE_SAYISI?: number;
  KASA_HESABI?: string | null;
  KOMISYON_HESABI?: string | null;
  BMV_HESABI?: string | null;
  KAMBIYO_KAR_HESABI?: string | null;
  KAMBIYO_ZARAR_HESABI?: string | null;
  BELGE_YAZICI_MODU?: number | null;
  KUR_TEXT_DOSYASI?: string | null;
  HESAP_YILI?: number;
  GRAM_ONDALIK_SAYISI?: number;
  ALTIN_VERGI_SINIRI?: number | null;
  ALTIN_VERGI_SINIRI_PARA_ID?: number | null;
  CARI_DEKONT_ISLEM_CINSI?: number | null;
  DIGER_VERITABANI_ADI?: string | null;
  ORTAK_ALAN?: boolean | null;
  FISLERI_AKTARILACAK_ALAN?: boolean | null;
  CARI_KAYIT_BILGI_SILME?: boolean | null;
  FAVORI_PARA_ID?: number | null;
  TOPLAMDA_PARA_KODU?: boolean | null;
  DEVIR_ALANI?: string | null;
  FISTE_SAAT_CIKMASIN?: boolean | null;
  DEVIR_ALANI2?: string | null;
  IKINCI_PANO_DZG?: string | null;
  DONEM_ONAY_TARIHI?: string | Date | null;
  DONEM_ONAY_GUN_SAYISI?: number | null;
  ISCILIK_GIRIS_SEKLI?: number | null;
  YEDEK_KLASORU?: string | null;
  E_DEFTER_MUKELLEFI?: boolean | null;
  DIG_CSV_DIZINI?: string | null;
  DEGISIKLIK_TAKIP_SIFRESI?: string | null;
  DEFAULT_KUR_KAYNAGI?: number | null;
  VERGI_SINIRI_ASILINCA_YASAKLA?: boolean | null;
  VADELI_ISLEM_CINSI?: number | null;
  KMV_HESABI?: string | null;
  KMV_GIDER_HESABI?: string | null;
  HAS_ALTIN_PARA_ID?: number | null;
  ISCILIK_FIYATA_DAHIL?: boolean | null;
  ISCILIK_HESABI?: string | null;
  KDV_GELIR_HESABI?: string | null;
  KDV_GIDER_HESABI?: string | null;
  TL_VERGI_SINIRI?: number | null;
  MERKEZ_BANKASI_KURUNU_AL?: boolean | null;
  FISDE_KUR_TURU_DEGISEBILIR?: boolean | null;
  FOREKS_KUR_DOSYA_ADI?: string | null;
  FOREKS_KUR_VEZNE_ID?: number | null;
  FOREKS_KUR_YENILEME_SURESI?: number | null;
  FOREKS_KUR_BASAMAK_SAYISI?: number | null;
  ENTEGRATOR_YANIT_VERME_SURESI?: number | null;
  E_BELGE_SERVER_IP?: string | null;
  E_BELGE_SERVER_PORTU?: number | null;
  XSLT_DOSYALARI_KOPYALANSIN?: boolean | null;
  RPT_DOSYALARI_KOPYALANSIN?: boolean | null;
  E_DOVIZ_FIS_BASILSIN?: boolean | null;
  WEB_ADRESI?: string | null;
  EPOSTA?: string | null;
  CARI_DEKONT_KUR_CINSI?: number | null;
  DOSYA_NO?: string | null;
  XSLT_DIZINI?: string | null;
  E_DOVIZ_FIS_BASLANGIC_TARIHI_1?: string | Date | null;
  E_DOVIZ_FIS_BASLANGIC_TARIHI_2?: string | Date | null;
  E_DOVIZ_FIS_BASLANGIC_TARIHI_3?: string | Date | null;
  E_DOVIZ_FIS_BASLANGIC_TARIHI_4?: string | Date | null;
  MERSIS_NO?: string | null;
  YETKILI_MUESSESE_TIPI?: number;
  ALIS_FIS_BELGESI?: number;
  SATIS_FIS_BELGESI?: number;
  TICARET_SICIL_NO?: string | null;
  FIS_MASAK_KONTROLU_VAR?: boolean | null;
  ENTEGRATORE_ANLIK_GONDERILSIN?: boolean | null;
  CARI_EKSTRA_BILGI_KONTROLU?: boolean | null;
  FIS_CARI_ISLEME_SORULSUN?: boolean | null;
  E_FATURA_PORTAL_ADRESI?: string | null;
  IKINCI_YEDEK_KLASORU?: string | null;
  FIRMA_DURUMU_RAPORU?: boolean | null;
  DIG_BORC_BAKIYE_RENGI?: number | null;
  DIG_ALACAK_BAKIYE_RENGI?: number | null;
  E_FATURA_POSTA_KUTUSU?: string | null;
  E_IRSALIYE_POSTA_KUTUSU?: string | null;
  E_FATURA_KDV_MUAFIYET_KODU?: string | null;
  E_FATURA_KDV_MUAFIYET_ADI?: string | null;
  SAR_KIMLIK_KONTROL_SINIRI?: number | null;
  VERGI_NO_SORGULAMA_YONTEMI?: number | null;
  VERGI_SORGULAYAN_TC_NO?: string | null;
  MUSAVIR_TURMOB_SIFRESI?: string | null;
  E_BELGE_BASLANGIC_TARIHI?: string | Date | null;
  SARRAFIYE_FAVORI_BELGE_TURU?: number | null;
  KMV_UYGULAMA_SEKLI?: number | null;
  HAS_GUMUS_PARA_ID?: number | null;
}

export const defaultCompanyTanim: TodvzTanimDto = {
  SURUM: "2025.12.16",
  FIRMA_ADI: "",
  SUBE_KODU: "1",
  SUBE_ADI: "",
  VERGI_DAIRESI_ID: null,
  VERGI_KIMLIK_NO: "",
  ADRES: "",
  POSTA_KODU_ID: null,
  ILCE_ID: null,
  IL_ID: null,
  ULKE_ID: null,
  TELEFON: "",
  USD_PARA_ID: 2,
  EUR_PARA_ID: 3,
  RAPOR_PARA_ID: 2,
  TL_KURUS_SAYISI: 2,
  DOVIZ_KURUS_SAYISI: 0,
  KUR_KURUS_SAYISI: 6,
  CARI_TL_TOLERANSI: 0,
  CARI_USD_TOLERANSI: 0,
  DOVIZ_VERGI_SINIRI: 5000,
  DOVIZ_VERGI_SINIRI_PARA_ID: 2,
  SERMAYE_HESABI_ID: 1,
  BELGE_DIZINI: "",
  CARI_KOD_SIRA_NO: null,
  CARI_KOD_BASINA_SIFIR: false,
  FIS_NO_BASINA_SIFIR: false,
  DOVIZ_ALIS_DVZ_SATIS_ORANI: 1,
  EFEKTIF_ALIS_DVZ_SATIS_ORANI: 1,
  EFEKTIF_SATIS_DVZ_SATIS_ORANI: 1,
  ALIS_ISTATISTIK_ID: 2,
  SATIS_ISTATISTIK_ID: 3,
  ARBITRAJ_ALIS_ISTATISTIK_ID: 2,
  ARBITRAJ_SATIS_ISTATISTIK_ID: 3,
  SATISIN_DAYANAGI: "32 SAYILI KARAR",
  FISTE_COKLU_SATIR: false,
  TL_YUVARLAMA_ARALIGI: 0,
  TL_YUVARLAMA_ESIGI: 0,
  TAZELEME_SURESI: 5,
  EKRANDAKI_VEZNE_SAYISI: 0,
  KASA_HESABI: "100.01",
  KOMISYON_HESABI: "643.01",
  BMV_HESABI: "360.01",
  KAMBIYO_KAR_HESABI: "646.01",
  KAMBIYO_ZARAR_HESABI: "656.01",
  BELGE_YAZICI_MODU: 2,
  KUR_TEXT_DOSYASI: "",
  HESAP_YILI: new Date().getFullYear(),
  GRAM_ONDALIK_SAYISI: 2,
  ALTIN_VERGI_SINIRI: 5000,
  ALTIN_VERGI_SINIRI_PARA_ID: 2,
  CARI_DEKONT_ISLEM_CINSI: null,
  DIGER_VERITABANI_ADI: "",
  ORTAK_ALAN: true,
  FISLERI_AKTARILACAK_ALAN: false,
  CARI_KAYIT_BILGI_SILME: false,
  FAVORI_PARA_ID: 2,
  TOPLAMDA_PARA_KODU: true,
  DEVIR_ALANI: "",
  FISTE_SAAT_CIKMASIN: false,
  DEVIR_ALANI2: "",
  IKINCI_PANO_DZG: "",
  DONEM_ONAY_TARIHI: null,
  DONEM_ONAY_GUN_SAYISI: 0,
  ISCILIK_GIRIS_SEKLI: null,
  YEDEK_KLASORU: "C:\\YEDEK",
  E_DEFTER_MUKELLEFI: false,
  DIG_CSV_DIZINI: "",
  DEGISIKLIK_TAKIP_SIFRESI: "1234",
  DEFAULT_KUR_KAYNAGI: 0,
  VERGI_SINIRI_ASILINCA_YASAKLA: false,
  VADELI_ISLEM_CINSI: null,
  KMV_HESABI: "646.01",
  KMV_GIDER_HESABI: "646.01",
  HAS_ALTIN_PARA_ID: null,
  ISCILIK_FIYATA_DAHIL: false,
  ISCILIK_HESABI: "",
  KDV_GELIR_HESABI: "",
  KDV_GIDER_HESABI: "",
  TL_VERGI_SINIRI: 185000,
  MERKEZ_BANKASI_KURUNU_AL: false,
  FISDE_KUR_TURU_DEGISEBILIR: false,
  FOREKS_KUR_DOSYA_ADI: "",
  FOREKS_KUR_VEZNE_ID: null,
  FOREKS_KUR_YENILEME_SURESI: null,
  FOREKS_KUR_BASAMAK_SAYISI: null,
  ENTEGRATOR_YANIT_VERME_SURESI: 30,
  E_BELGE_SERVER_IP: "127.0.0.1",
  E_BELGE_SERVER_PORTU: 53462,
  XSLT_DOSYALARI_KOPYALANSIN: false,
  RPT_DOSYALARI_KOPYALANSIN: false,
  E_DOVIZ_FIS_BASILSIN: true,
  WEB_ADRESI: "",
  EPOSTA: "",
  CARI_DEKONT_KUR_CINSI: null,
  DOSYA_NO: "1",
  XSLT_DIZINI: "",
  E_DOVIZ_FIS_BASLANGIC_TARIHI_1: null,
  E_DOVIZ_FIS_BASLANGIC_TARIHI_2: null,
  E_DOVIZ_FIS_BASLANGIC_TARIHI_3: null,
  E_DOVIZ_FIS_BASLANGIC_TARIHI_4: null,
  MERSIS_NO: "",
  YETKILI_MUESSESE_TIPI: 0,
  ALIS_FIS_BELGESI: 0,
  SATIS_FIS_BELGESI: 0,
  TICARET_SICIL_NO: "",
  FIS_MASAK_KONTROLU_VAR: true,
  ENTEGRATORE_ANLIK_GONDERILSIN: false,
  CARI_EKSTRA_BILGI_KONTROLU: false,
  FIS_CARI_ISLEME_SORULSUN: false,
  E_FATURA_PORTAL_ADRESI: "",
  IKINCI_YEDEK_KLASORU: "",
  FIRMA_DURUMU_RAPORU: false,
  DIG_BORC_BAKIYE_RENGI: 0,
  DIG_ALACAK_BAKIYE_RENGI: 0,
  E_FATURA_POSTA_KUTUSU: "",
  E_IRSALIYE_POSTA_KUTUSU: "",
  E_FATURA_KDV_MUAFIYET_KODU: "",
  E_FATURA_KDV_MUAFIYET_ADI: "",
  SAR_KIMLIK_KONTROL_SINIRI: 0,
  VERGI_NO_SORGULAMA_YONTEMI: null,
  VERGI_SORGULAYAN_TC_NO: "",
  MUSAVIR_TURMOB_SIFRESI: "",
  E_BELGE_BASLANGIC_TARIHI: null,
  SARRAFIYE_FAVORI_BELGE_TURU: 0,
  KMV_UYGULAMA_SEKLI: 1,
  HAS_GUMUS_PARA_ID: null,
};

export class CompanyService {
  /**
   * Fetches company definitions from active DB via backend API
   */
  public static async getDefinitions(): Promise<TodvzTanimDto> {
    const response = await apiClient.get<TodvzTanimDto>("/company/definitions");
    return response.data || defaultCompanyTanim;
  }

  /**
   * Updates company definitions in active DB via backend API
   */
  public static async updateDefinitions(data: Partial<TodvzTanimDto>): Promise<TodvzTanimDto> {
    const response = await apiClient.put<TodvzTanimDto>("/company/definitions", data);
    return response.data;
  }
}
