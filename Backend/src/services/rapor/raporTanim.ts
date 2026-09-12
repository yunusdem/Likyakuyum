/**
 * Rapor tanımı (Backend/rapor/<KOD>.json) — Crystal'daki "rpt + parametre" mantığının web karşılığı.
 * Düzen (kolonlar, gruplama, toplamlar) JSON'da; veri `raporVeri.ts`'deki sorgudan gelir.
 * Bkz. docs/raporlar.md.
 */

export type RaporParametreTipi =
  | "tarih"          // tek tarih (bakiye raporları: "şu tarihe kadar")
  | "tarihAralik"    // baslangic + bitis
  | "saatAralik"     // baslangicSaat + bitisSaat (vezne hareket)
  | "vezne"          // vezneId (opsiyonel: tümü)
  | "para"           // paraId (opsiyonel: tümü)
  | "cari"           // cariKartId
  | "fisTipi"        // 0 alış / 1 satış / tümü
  | "kurSecimi"      // kurTuru (0 anlık gişe | 2 saklanan) + kurTarihi + kurAlani (alis|satis)
  | "kmt"            // Kur / Miktar / TL gösterimi (kâr-zarar)
  | "metin";         // serbest arama

export interface RaporParametre {
  ad: string;                 // sorgu parametresi adı (ör. "vezneId")
  etiket: string;             // ekranda görünen ad
  tip: RaporParametreTipi;
  zorunlu?: boolean;
  /** Varsayılan: "bugun", "-30g" (30 gün önce), sabit değer */
  varsayilan?: string | number | null;
}

export type RaporBicim = "metin" | "sayi" | "sayi4" | "kur" | "tarih" | "tarihSaat" | "tam";

export interface RaporKolon {
  anahtar: string;            // satır nesnesindeki alan
  baslik: string;
  g: number;                  // göreli genişlik (toplam üzerinden oranlanır)
  hiza?: "left" | "right" | "center";
  bicim?: RaporBicim;
  toplam?: boolean;           // genel toplam ve grup alt toplamında toplanır
}

export interface RaporTanim {
  kod: string;
  ad: string;
  aciklama?: string;
  kagit: "A4" | "A4-yatay";
  parametreler: RaporParametre[];
  kolonlar: RaporKolon[];
  /** Grup anahtarı (satır alanı) ve grup başlığı biçimi: "{{vezneAd}} ({{vezneKod}})" */
  grup?: { anahtar: string; baslik: string; altToplam?: boolean };
  /** PDF altına basılan yöntem/uyarı notu (kâr-zarar: ağırlıklı ortalama açıklaması) */
  dipnot?: string;
  /** Satır üst sınırı (varsayılan 5000) */
  ustSinir?: number;
}

export interface RaporFirma { ad: string; vkn: string }

export interface RaporSonucVeri {
  satirlar: Record<string, any>[];
  /** Filtre özeti (PDF başlığı altına): "01.09.2026 – 12.09.2026 · Vezne: 01 · Para: USD" */
  filtreOzeti: string;
  /** Sorguya göre eklenen ek dipnot (ör. kullanılan kur tablosu) */
  ekDipnot?: string;
  /** Üst sınır aşıldıysa true → PDF/Excel üretilmez, ekrana uyarı */
  sinirAsildi?: boolean;
  toplamKayit: number;
}

export const RAPOR_UST_SINIR = 5000;
