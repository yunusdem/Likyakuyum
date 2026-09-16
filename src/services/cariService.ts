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
  ilceAdi?: string | null;
  ilId: number | null;
  ilAdi?: string | null;
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
  il?: string;
  ilce?: string;
  ilAdi?: string;
  ustId?: number;
  unvan?: string;
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

export const DEFAULT_POSTA_KODLARI: LookupItem[] = [
  // İstanbul
  { id: 34110, kod: "34110", ad: "Kapalıçarşı / Fatih", il: "İstanbul", ilce: "Fatih" },
  { id: 34000, kod: "34000", ad: "Merkez / Eminönü", il: "İstanbul", ilce: "Fatih" },
  { id: 34380, kod: "34380", ad: "Mecidiyeköy / Şişli", il: "İstanbul", ilce: "Şişli" },
  { id: 34710, kod: "34710", ad: "Moda / Kadıköy", il: "İstanbul", ilce: "Kadıköy" },
  { id: 34149, kod: "34149", ad: "Yeşilköy / Bakırköy", il: "İstanbul", ilce: "Bakırköy" },
  { id: 34330, kod: "34330", ad: "Levent / Beşiktaş", il: "İstanbul", ilce: "Beşiktaş" },
  { id: 34430, kod: "34430", ad: "Beyoğlu / Taksim", il: "İstanbul", ilce: "Beyoğlu" },
  { id: 34660, kod: "34660", ad: "Üsküdar Merkez", il: "İstanbul", ilce: "Üsküdar" },
  { id: 34758, kod: "34758", ad: "Ataşehir Merkez", il: "İstanbul", ilce: "Ataşehir" },
  { id: 34844, kod: "34844", ad: "Maltepe Merkez", il: "İstanbul", ilce: "Maltepe" },
  { id: 34870, kod: "34870", ad: "Kartal Merkez", il: "İstanbul", ilce: "Kartal" },
  { id: 34920, kod: "34920", ad: "Pendik Merkez", il: "İstanbul", ilce: "Pendik" },
  { id: 34200, kod: "34200", ad: "Bağcılar Merkez", il: "İstanbul", ilce: "Bağcılar" },
  { id: 34520, kod: "34520", ad: "Beylikdüzü Merkez", il: "İstanbul", ilce: "Beylikdüzü" },

  // Ankara
  { id: 6000, kod: "06000", ad: "Ulus / Altındağ", il: "Ankara", ilce: "Altındağ" },
  { id: 6680, kod: "06680", ad: "Kızılay / Çankaya", il: "Ankara", ilce: "Çankaya" },
  { id: 6370, kod: "06370", ad: "Ostim / Yenimahalle", il: "Ankara", ilce: "Yenimahalle" },
  { id: 6280, kod: "06280", ad: "Keçiören Merkez", il: "Ankara", ilce: "Keçiören" },
  { id: 6790, kod: "06790", ad: "Etimesgut Merkez", il: "Ankara", ilce: "Etimesgut" },
  { id: 6930, kod: "06930", ad: "Sincan Merkez", il: "Ankara", ilce: "Sincan" },

  // İzmir
  { id: 35000, kod: "35000", ad: "Alsancak / Konak", il: "İzmir", ilce: "Konak" },
  { id: 35100, kod: "35100", ad: "Bornova Merkez", il: "İzmir", ilce: "Bornova" },
  { id: 35530, kod: "35530", ad: "Karşıyaka Çarşı", il: "İzmir", ilce: "Karşıyaka" },
  { id: 35390, kod: "35390", ad: "Buca Merkez", il: "İzmir", ilce: "Buca" },
  { id: 35030, kod: "35030", ad: "Bayraklı Merkez", il: "İzmir", ilce: "Bayraklı" },
  { id: 35620, kod: "35620", ad: "Çiğli Merkez", il: "İzmir", ilce: "Çiğli" },
  { id: 35920, kod: "35920", ad: "Çeşme Merkez", il: "İzmir", ilce: "Çeşme" },

  // Bursa
  { id: 16010, kod: "16010", ad: "Heykel / Osmangazi", il: "Bursa", ilce: "Osmangazi" },
  { id: 16130, kod: "16130", ad: "Nilüfer Merkez", il: "Bursa", ilce: "Nilüfer" },
  { id: 16320, kod: "16320", ad: "Yıldırım Merkez", il: "Bursa", ilce: "Yıldırım" },
  { id: 16400, kod: "16400", ad: "İnegöl Merkez", il: "Bursa", ilce: "İnegöl" },

  // Antalya
  { id: 7000, kod: "07000", ad: "Kaleiçi / Muratpaşa", il: "Antalya", ilce: "Muratpaşa" },
  { id: 7100, kod: "07100", ad: "Konyaaltı Sahil", il: "Antalya", ilce: "Konyaaltı" },
  { id: 7060, kod: "07060", ad: "Kepez Merkez", il: "Antalya", ilce: "Kepez" },
  { id: 7400, kod: "07400", ad: "Alanya Merkez", il: "Antalya", ilce: "Alanya" },
  { id: 7600, kod: "07600", ad: "Manavgat Merkez", il: "Antalya", ilce: "Manavgat" },

  // Adana
  { id: 1000, kod: "01000", ad: "Seyhan Merkez", il: "Adana", ilce: "Seyhan" },
  { id: 1170, kod: "01170", ad: "Çukurova Merkez", il: "Adana", ilce: "Çukurova" },
  { id: 1220, kod: "01220", ad: "Yüreğir Merkez", il: "Adana", ilce: "Yüreğir" },

  // Gaziantep
  { id: 27000, kod: "27000", ad: "Şahinbey Merkez", il: "Gaziantep", ilce: "Şahinbey" },
  { id: 27500, kod: "27500", ad: "Şehitkamil Merkez", il: "Gaziantep", ilce: "Şehitkamil" },

  // Konya
  { id: 42000, kod: "42000", ad: "Selçuklu Merkez", il: "Konya", ilce: "Selçuklu" },
  { id: 42010, kod: "42010", ad: "Meram Merkez", il: "Konya", ilce: "Meram" },
  { id: 42020, kod: "42020", ad: "Karatay Merkez", il: "Konya", ilce: "Karatay" },

  // Muğla
  { id: 48000, kod: "48000", ad: "Menteşe / Muğla", il: "Muğla", ilce: "Menteşe" },
  { id: 48400, kod: "48400", ad: "Bodrum Merkez", il: "Muğla", ilce: "Bodrum" },
  { id: 48300, kod: "48300", ad: "Fethiye Merkez", il: "Muğla", ilce: "Fethiye" },
  { id: 48700, kod: "48700", ad: "Marmaris Merkez", il: "Muğla", ilce: "Marmaris" },

  // Trabzon
  { id: 61000, kod: "61000", ad: "Ortahisar Merkez", il: "Trabzon", ilce: "Ortahisar" },
  { id: 61300, kod: "61300", ad: "Akçaabat Merkez", il: "Trabzon", ilce: "Akçaabat" },

  // Kocaeli
  { id: 41000, kod: "41000", ad: "İzmit Merkez", il: "Kocaeli", ilce: "İzmit" },
  { id: 41400, kod: "41400", ad: "Gebze Merkez", il: "Kocaeli", ilce: "Gebze" },

  // Diğer İller
  { id: 38010, kod: "38010", ad: "Melikgazi Merkez", il: "Kayseri", ilce: "Melikgazi" },
  { id: 55000, kod: "55000", ad: "İlkadım Merkez", il: "Samsun", ilce: "İlkadım" },
  { id: 33000, kod: "33000", ad: "Akdeniz Merkez", il: "Mersin", ilce: "Akdeniz" },
  { id: 26010, kod: "26010", ad: "Tepebaşı Merkez", il: "Eskişehir", ilce: "Tepebaşı" },
  { id: 20000, kod: "20000", ad: "Pamukkale Merkez", il: "Denizli", ilce: "Pamukkale" },
  { id: 54100, kod: "54100", ad: "Adapazarı Merkez", il: "Sakarya", ilce: "Adapazarı" },
  { id: 59030, kod: "59030", ad: "Süleymanpaşa Merkez", il: "Tekirdağ", ilce: "Süleymanpaşa" },
];

export class CariService {
  public static async getLookups(): Promise<CariLookups> {
    const res = await apiClient.get<CariLookups>("/cari/lookups");
    const data = res.data;
    if (data) {
      if (!data.postaKoduList || data.postaKoduList.length === 0) {
        data.postaKoduList = DEFAULT_POSTA_KODLARI;
      }
      return data;
    }
    return {
      vergiDairesiList: [],
      ilList: [],
      ilceList: [],
      postaKoduList: DEFAULT_POSTA_KODLARI,
      hukukiYapiList: [],
      sektorList: [],
      meslekList: [],
      ulkeList: [],
      paraList: [],
      istatistikList: [],
    };
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
