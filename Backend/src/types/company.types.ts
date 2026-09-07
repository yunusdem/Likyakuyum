/**
 * Exact representation of MSSQL [dbo].[TODVZ_TANIM] table (127 columns)
 */
export interface TodvzTanimEntity {
  SURUM: string; // char(20)
  FIRMA_ADI: string | null; // varchar(200)
  SUBE_KODU: string | null; // char(20)
  SUBE_ADI: string | null; // varchar(200)
  VERGI_DAIRESI_ID: number | null; // int
  VERGI_KIMLIK_NO: string | null; // varchar(50)
  ADRES: string | null; // varchar(200)
  POSTA_KODU_ID: number | null; // int
  ILCE_ID: number | null; // int
  IL_ID: number | null; // int
  ULKE_ID: number | null; // int
  TELEFON: string | null; // char(20)
  USD_PARA_ID: number; // int
  EUR_PARA_ID: number; // int
  RAPOR_PARA_ID: number; // int
  TL_KURUS_SAYISI: number; // int
  DOVIZ_KURUS_SAYISI: number; // int
  KUR_KURUS_SAYISI: number; // int
  CARI_TL_TOLERANSI: number | null; // float
  CARI_USD_TOLERANSI: number | null; // float
  DOVIZ_VERGI_SINIRI: number | null; // float
  DOVIZ_VERGI_SINIRI_PARA_ID: number | null; // int
  SERMAYE_HESABI_ID: number | null; // int
  BELGE_DIZINI: string | null; // varchar(200)
  CARI_KOD_SIRA_NO: number | null; // int
  CARI_KOD_BASINA_SIFIR: boolean | null; // bit
  FIS_NO_BASINA_SIFIR: boolean | null; // bit
  DOVIZ_ALIS_DVZ_SATIS_ORANI: number; // float
  EFEKTIF_ALIS_DVZ_SATIS_ORANI: number; // float
  EFEKTIF_SATIS_DVZ_SATIS_ORANI: number; // float
  ALIS_ISTATISTIK_ID: number | null; // int
  SATIS_ISTATISTIK_ID: number | null; // int
  ARBITRAJ_ALIS_ISTATISTIK_ID: number | null; // int
  ARBITRAJ_SATIS_ISTATISTIK_ID: number | null; // int
  SATISIN_DAYANAGI: string | null; // varchar(100)
  FISTE_COKLU_SATIR: boolean | null; // bit
  TL_YUVARLAMA_ARALIGI: number | null; // float
  TL_YUVARLAMA_ESIGI: number | null; // float
  TAZELEME_SURESI: number; // int
  EKRANDAKI_VEZNE_SAYISI: number; // tinyint
  KASA_HESABI: string | null; // char(20)
  KOMISYON_HESABI: string | null; // char(20)
  BMV_HESABI: string | null; // char(20)
  KAMBIYO_KAR_HESABI: string | null; // char(20)
  KAMBIYO_ZARAR_HESABI: string | null; // char(20)
  BELGE_YAZICI_MODU: number | null; // tinyint
  KUR_TEXT_DOSYASI: string | null; // varchar(200)
  HESAP_YILI: number; // int
  GRAM_ONDALIK_SAYISI: number; // int
  ALTIN_VERGI_SINIRI: number | null; // float
  ALTIN_VERGI_SINIRI_PARA_ID: number | null; // int
  CARI_DEKONT_ISLEM_CINSI: number | null; // tinyint
  DIGER_VERITABANI_ADI: string | null; // varchar(200)
  ORTAK_ALAN: boolean | null; // bit
  FISLERI_AKTARILACAK_ALAN: boolean | null; // bit
  CARI_KAYIT_BILGI_SILME: boolean | null; // bit
  FAVORI_PARA_ID: number | null; // int
  TOPLAMDA_PARA_KODU: boolean | null; // bit
  DEVIR_ALANI: string | null; // varchar(200)
  FISTE_SAAT_CIKMASIN: boolean | null; // bit
  DEVIR_ALANI2: string | null; // varchar(200)
  IKINCI_PANO_DZG: string | null; // varchar(200)
  DONEM_ONAY_TARIHI: Date | string | null; // datetime
  DONEM_ONAY_GUN_SAYISI: number | null; // int
  ISCILIK_GIRIS_SEKLI: number | null; // tinyint
  YEDEK_KLASORU: string | null; // varchar(200)
  E_DEFTER_MUKELLEFI: boolean | null; // bit
  DIG_CSV_DIZINI: string | null; // varchar(100)
  DEGISIKLIK_TAKIP_SIFRESI: string | null; // varchar(30)
  DEFAULT_KUR_KAYNAGI: number | null; // tinyint
  VERGI_SINIRI_ASILINCA_YASAKLA: boolean | null; // bit
  VADELI_ISLEM_CINSI: number | null; // tinyint
  KMV_HESABI: string | null; // char(20)
  KMV_GIDER_HESABI: string | null; // char(20)
  HAS_ALTIN_PARA_ID: number | null; // int
  ISCILIK_FIYATA_DAHIL: boolean | null; // bit
  ISCILIK_HESABI: string | null; // char(20)
  KDV_GELIR_HESABI: string | null; // char(20)
  KDV_GIDER_HESABI: string | null; // char(20)
  TL_VERGI_SINIRI: number | null; // float
  MERKEZ_BANKASI_KURUNU_AL: boolean | null; // bit
  FISDE_KUR_TURU_DEGISEBILIR: boolean | null; // bit
  FOREKS_KUR_DOSYA_ADI: string | null; // varchar(200)
  FOREKS_KUR_VEZNE_ID: number | null; // int
  FOREKS_KUR_YENILEME_SURESI: number | null; // int
  FOREKS_KUR_BASAMAK_SAYISI: number | null; // int
  ENTEGRATOR_YANIT_VERME_SURESI: number | null; // int
  E_BELGE_SERVER_IP: string | null; // char(20)
  E_BELGE_SERVER_PORTU: number | null; // int
  XSLT_DOSYALARI_KOPYALANSIN: boolean | null; // bit
  RPT_DOSYALARI_KOPYALANSIN: boolean | null; // bit
  E_DOVIZ_FIS_BASILSIN: boolean | null; // bit
  WEB_ADRESI: string | null; // varchar(100)
  EPOSTA: string | null; // varchar(100)
  CARI_DEKONT_KUR_CINSI: number | null; // tinyint
  DOSYA_NO: string | null; // char(20)
  XSLT_DIZINI: string | null; // varchar(200)
  E_DOVIZ_FIS_BASLANGIC_TARIHI_1: Date | string | null; // datetime
  E_DOVIZ_FIS_BASLANGIC_TARIHI_2: Date | string | null; // datetime
  E_DOVIZ_FIS_BASLANGIC_TARIHI_3: Date | string | null; // datetime
  E_DOVIZ_FIS_BASLANGIC_TARIHI_4: Date | string | null; // datetime
  MERSIS_NO: string | null; // char(20)
  YETKILI_MUESSESE_TIPI: number; // tinyint
  ALIS_FIS_BELGESI: number; // tinyint
  SATIS_FIS_BELGESI: number; // tinyint
  TICARET_SICIL_NO: string | null; // char(20)
  FIS_MASAK_KONTROLU_VAR: boolean | null; // bit
  ENTEGRATORE_ANLIK_GONDERILSIN: boolean | null; // bit
  CARI_EKSTRA_BILGI_KONTROLU: boolean | null; // bit
  FIS_CARI_ISLEME_SORULSUN: boolean | null; // bit
  E_FATURA_PORTAL_ADRESI: string | null; // varchar(200)
  IKINCI_YEDEK_KLASORU: string | null; // varchar(200)
  FIRMA_DURUMU_RAPORU: boolean | null; // bit
  DIG_BORC_BAKIYE_RENGI: number | null; // int
  DIG_ALACAK_BAKIYE_RENGI: number | null; // int
  E_FATURA_POSTA_KUTUSU: string | null; // varchar(200)
  E_IRSALIYE_POSTA_KUTUSU: string | null; // varchar(200)
  E_FATURA_KDV_MUAFIYET_KODU: string | null; // char(20)
  E_FATURA_KDV_MUAFIYET_ADI: string | null; // varchar(200)
  SAR_KIMLIK_KONTROL_SINIRI: number | null; // float
  VERGI_NO_SORGULAMA_YONTEMI: number | null; // tinyint
  VERGI_SORGULAYAN_TC_NO: string | null; // char(20)
  MUSAVIR_TURMOB_SIFRESI: string | null; // varchar(200)
  E_BELGE_BASLANGIC_TARIHI: Date | string | null; // datetime
  SARRAFIYE_FAVORI_BELGE_TURU: number | null; // tinyint
  KMV_UYGULAMA_SEKLI: number | null; // tinyint
  HAS_GUMUS_PARA_ID: number | null; // int
}
