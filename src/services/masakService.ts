import { apiClient } from "./apiClient";

/**
 * MASAK 'Malvarlıkları Dondurulanlar' servisleri
 * Backend: /api/v1/masak — veriler TODVZ_MASAK_LISTE tablosundan okunur.
 */

export type MasakListeKod = "A" | "B" | "C" | "3AB";

export interface MasakListeDurumu {
  listeKod: MasakListeKod;
  listeAdi: string | null;
  kayitSayisi: number;
  sonGuncelleme: string | null;
  kaynakUrl: string | null;
  kaynakHash: string | null;
}

export interface MasakDurumSonucu {
  toplamKayit: number;
  sonGuncelleme: string | null;
  listeler: MasakListeDurumu[];
}

export interface MasakKaynakGirdi {
  listeKod: MasakListeKod;
  url?: string | null;
}

export interface MasakListeSonucu {
  listeKod: MasakListeKod;
  listeAdi: string;
  durum: "basarili" | "hata";
  kayitSayisi: number;
  oncekiKayitSayisi: number;
  sureMs: number;
  kaynakUrl: string;
  hata?: string;
}

export interface MasakGuncellemeRaporu {
  guncellemeZamani: string;
  toplamKayit: number;
  sonuclar: MasakListeSonucu[];
  durum: MasakListeDurumu[];
}

export interface MasakKayit {
  masakId: number;
  listeKod: string;
  listeAdi: string | null;
  siraNo: number | null;
  adUnvan: string;
  adUnvanNorm: string | null;
  kayitTipi: string | null;
  kimlikNo: string | null;
  tckn: string | null;
  vkn: string | null;
  digerIsimler: string | null;
  orijinalAd: string | null;
  eskiAdi: string | null;
  gorevi: string | null;
  adres: string | null;
  uyruk: string | null;
  digerUyruk: string | null;
  yaptirimTuru: string | null;
  anneAdi: string | null;
  babaAdi: string | null;
  dogumTarihi: string | null;
  dogumTarihiDt: string | null;
  dogumYeri: string | null;
  orgut: string | null;
  kurulusYapisi: string | null;
  listeyeAlinma: string | null;
  kararBilgi: string | null;
  resmiGazete: string | null;
  digerBilgiler: string | null;
  ekBilgi: Record<string, string> | null;
  kaynakUrl: string | null;
  guncellemeZamani: string | null;
}

export interface MasakEslesme extends MasakKayit {
  skor: number;
  eslesmeTipi: "KIMLIK_TAM" | "AD_TAM" | "ALIAS_TAM" | "AD_KELIME";
  dogumUyumlu: boolean | null;
}

export interface MasakListeSayfasi {
  kayitlar: MasakKayit[];
  toplam: number;
  page: number;
  pageSize: number;
}

export interface MasakSorguSonucu {
  eslesmeVar: boolean;
  enYuksekSkor: number;
  kayitlar: MasakEslesme[];
}

export interface MasakGecmisKaydi {
  guncellemeId: number;
  listeKod: string;
  baslamaZamani: string;
  bitisZamani: string | null;
  sureMs: number | null;
  durum: "BASARILI" | "HATA";
  kayitSayisi: number | null;
  oncekiKayitSayisi: number | null;
  kaynakUrl: string | null;
  kaynakHash: string | null;
  dosyaBoyutu: number | null;
  kullaniciAdi: string | null;
  kullaniciId: string | null;
  hataMesaji: string | null;
}

/** Güncelleme 4 dosya indirip ~2.300 satır yazdığı için varsayılan 15 sn yetmez */
const GUNCELLEME_TIMEOUT_MS = 180000;

export class MasakService {
  /** Liste bazında kayıt sayısı, son güncelleme ve son kullanılan adres */
  public static async getDurum(): Promise<MasakDurumSonucu> {
    const res = await apiClient.get<MasakDurumSonucu>("/masak/durum");
    return res.data;
  }

  /** Seçilen listeleri indirip tabloya yazar */
  public static async guncelle(kaynaklar?: MasakKaynakGirdi[]): Promise<MasakGuncellemeRaporu> {
    const res = await apiClient.post<MasakGuncellemeRaporu>(
      "/masak/guncelle",
      { kaynaklar },
      { timeoutMs: GUNCELLEME_TIMEOUT_MS }
    );
    return res.data;
  }

  /** Sayfalı listeleme + arama */
  public static async getListe(params: {
    listeKod?: string;
    q?: string;
    kimlikNo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<MasakListeSayfasi> {
    const res = await apiClient.get<MasakListeSayfasi>("/masak/liste", params);
    return res.data;
  }

  /** Tek kaydın tüm alanları */
  public static async getKayit(id: number): Promise<MasakKayit> {
    const res = await apiClient.get<MasakKayit>(`/masak/kayit/${id}`);
    return res.data;
  }

  /** Eşleşme sorgusu (fiş / fatura / cari kontrolü) */
  public static async sorgula(params: {
    ad?: string;
    kimlikNo?: string;
    dogumTarihi?: string;
    limit?: number;
  }): Promise<MasakSorguSonucu> {
    const res = await apiClient.get<MasakSorguSonucu>("/masak/sorgu", params);
    return res.data;
  }

  /** Güncelleme geçmişi */
  public static async getGecmis(params: { listeKod?: string; limit?: number } = {}): Promise<
    MasakGecmisKaydi[]
  > {
    const res = await apiClient.get<MasakGecmisKaydi[]>("/masak/gecmis", params);
    return res.data;
  }
}

/* ============================================================================
   Ekranlarda ortak kullanılan yardımcılar
   ========================================================================== */

/** "08.09.2026 15:12" biçimi */
export const masakTarihSaat = (iso?: string | null): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** 2307 → "2.307" */
export const masakSayi = (n?: number | null): string =>
  typeof n === "number" ? n.toLocaleString("tr-TR") : "0";

/** Son güncellemenin üzerinden geçen gün sayısı (bayat veri uyarısı için) */
export const masakGunFarki = (iso?: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

/** Son güncelleme 7 günden eskiyse (veya hiç yapılmadıysa) uyarı gösterilir */
export const masakBayatMi = (iso?: string | null, gunEsigi: number = 7): boolean => {
  const fark = masakGunFarki(iso);
  return fark === null || fark >= gunEsigi;
};

/** Adres, MASAK sitesine ait geçerli bir Excel bağlantısı mı? */
export const masakAdresGecerliMi = (url?: string | null): boolean => {
  if (!url) return false;
  const u = url.trim().toLowerCase();
  return u.startsWith("https://ms.hmb.gov.tr/") && (u.endsWith(".xlsx") || u.endsWith(".xls"));
};
