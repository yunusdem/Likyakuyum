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
  | "cariAralik"     // cariBaslangic + cariBitis (cari KODU aralığı: Ahmet -> Mehmet)
  | "vezneAralik"    // vezneBaslangic + vezneBitis (vezne KODU aralığı)
  | "paraCoklu"      // paraIdler: virgülle ayrılmış PARA_ID listesi (boş = tümü)
  | "cariCoklu"      // cariIdler: seçilen CARI_KART_ID listesi (boş = tümü) — aralık yerine seçim (yönetici kararı 14.09.2026)
  | "vezneCoklu"     // vezneIdler: seçilen VEZNE_ID listesi (boş = tümü)
  | "hareketTipi"    // cari hareket tipi (0 nakit … 5 devir / tümü)
  | "secim"          // tek seçim; seçenekler tanımdaki `secenekler` listesinden (sıralama, durum …) — .rpt'lerdeki "Ad / Para adı" sıralama parametresi
  | "sayi"           // sayısal değer (eşik, sapma %, adet)
  | "listeCoklu"     // dürbünden çoklu seçim; liste `kaynak` ile /rapor/secim/:kaynak ucundan gelir (hesap, istatistik, meslek, sektor, kullanici, banka)
  | "metin";         // serbest arama

export type RaporSecimKaynagi = "hesap" | "istatistik" | "meslek" | "sektor" | "kullanici" | "banka";

export interface RaporParametre {
  ad: string;                 // sorgu parametresi adı (ör. "vezneId")
  etiket: string;             // ekranda görünen ad
  tip: RaporParametreTipi;
  zorunlu?: boolean;
  /** Varsayılan: "bugun", "-30g" (30 gün önce), sabit değer */
  varsayilan?: string | number | null;
  /** tip "secim": seçenek listesi (ilk seçenek boş değerliyse "tümü" anlamına gelir) */
  secenekler?: { deger: string; ad: string }[];
  /** tip "listeCoklu": liste kaynağı ve dürbün başlığında kullanılan tekil ad ("hesap", "istatistik") */
  kaynak?: RaporSecimKaynagi;
  /** Alan altındaki kısa açıklama */
  not?: string;
}

export type RaporBicim = "metin" | "sayi" | "sayi4" | "kur" | "tarih" | "tarihSaat" | "tam";

export interface RaporKolon {
  anahtar: string;            // satır nesnesindeki alan
  baslik: string;
  g: number;                  // göreli genişlik (toplam üzerinden oranlanır)
  hiza?: "left" | "right" | "center";
  bicim?: RaporBicim;
  toplam?: boolean;           // genel toplam ve grup alt toplamında toplanır
  /** false → PDF'te basılmaz (ekran grid'i ve Excel'de kalır). PDF kısa ve öz tutulur (yönetici isteği 12.09.2026). */
  pdf?: boolean;
  /** KMT gösterimi (kâr-zarar): K = kur, M = miktar, T = TL kolonu. `kmt` parametresi seçilince yalnızca o gruptaki ve etiketsiz kolonlar kalır. */
  kmt?: "K" | "M" | "T";
  /** "kurIkisi": kolon yalnızca Kur alanı = Alış + Satış seçilince listelenir (satış kuru / TL kolonları).
   *  "kip:<değer>": kolon yalnızca `birlestir` parametresi (boşsa tanımdaki varsayılanı) bu değerdeyken listelenir — eski raporlardaki Detaylı / Toplam rapor tipleri. */
  kosul?: "kurIkisi" | `kip:${string}`;
}

export interface RaporTanim {
  kod: string;
  ad: string;
  aciklama?: string;
  kagit: "A4" | "A4-yatay";
  parametreler: RaporParametre[];
  kolonlar: RaporKolon[];
  /** Grup anahtarı (satır alanı) ve grup başlığı biçimi: "{{vezneAd}} ({{vezneKod}})" */
  grup?: { anahtar: string; baslik: string; altToplam?: boolean;
    /** Grup başlığının altında ikinci satır (Cari Ekstre: adres · telefon · VKN) — {{alan}} yer tutucuları */
    altBaslik?: string;
    /** false → genel toplam basılmaz (gruplar farklı para birimlerindeyse toplamın anlamı yoktur: kasa defteri, hesap ekstresi) */
    genelToplam?: boolean;
    /** "kip:<değer>": gruplama yalnızca `birlestir` bu değerdeyken uygulanır (kolonlardaki `kosul` ile aynı kural) */
    kosul?: `kip:${string}` };
  /** Rapor sonunda ikinci küçük tablo (Crystal alt raporlarının karşılığı: "GENEL TOPLAM — para bazında", meslek özeti). Satırlar veriyle (`ozetSatirlar`) gelir. */
  ozet?: { baslik: string; kolonlar: RaporKolon[] };
  /** PDF altına basılan yöntem/uyarı notu (kâr-zarar: ağırlıklı ortalama açıklaması) */
  dipnot?: string;
  /** Satır üst sınırı (varsayılan 5000) */
  ustSinir?: number;
}

export interface RaporFirma { ad: string; vkn: string }

export interface RaporSonucVeri {
  satirlar: Record<string, any>[];
  /** `tanim.ozet` bölümünün satırları (yoksa bölüm basılmaz) */
  ozetSatirlar?: Record<string, any>[];
  /** Filtre özeti (PDF başlığı altına): "01.09.2026 – 12.09.2026 · Vezne: 01 · Para: USD" */
  filtreOzeti: string;
  /** Sorguya göre eklenen ek dipnot (ör. kullanılan kur tablosu) */
  ekDipnot?: string;
  /** Üst sınır aşıldıysa true → PDF/Excel üretilmez, ekrana uyarı */
  sinirAsildi?: boolean;
  toplamKayit: number;
}

export const RAPOR_UST_SINIR = 5000;
