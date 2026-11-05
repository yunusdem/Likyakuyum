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
  | "metin"          // serbest arama
  | "onay"           // işaret kutusu ("1" = işaretli); değer `p.ek[ad]` ile gelir (docs/RAPOR_ESITLEME_UYGULAMA.md 1.1)
  | "metinAralik"    // ilk – son metin (ad aralığı, seri no / belge no aralığı): `<ad>Ilk`, `<ad>Son`
  | "sayiAralik";    // alt – üst sayı (limit aralığı): `<ad>Alt`, `<ad>Ust`

export type RaporSecimKaynagi = "hesap" | "istatistik" | "meslek" | "sektor" | "kullanici" | "banka";
/** Barkodlu altın ürün kartındaki farklı değerler (docs/BARKODLU_ALTIN_RAPORLARI.md) */
export type RaporSecenekKaynagi = "altinAyar" | "altinGrup" | "altinUretici" | "altinBanko";

export interface RaporParametre {
  ad: string;                 // sorgu parametresi adı (ör. "vezneId")
  etiket: string;             // ekranda görünen ad
  tip: RaporParametreTipi;
  zorunlu?: boolean;
  /** Varsayılan: "bugun", "-30g" (30 gün önce), sabit değer */
  varsayilan?: string | number | null;
  /** tip "secim": seçenek listesi (ilk seçenek boş değerliyse "tümü" anlamına gelir) */
  /** `modul`: seçenek yalnız bu modül firmaya açıksa listelenir (lisansa göre seçenek; "ticari" = ticari modüllerinden herhangi biri) */
  secenekler?: { deger: string; ad: string; modul?: string }[];
  /** tip "listeCoklu": liste kaynağı ve dürbün başlığında kullanılan tekil ad ("hesap", "istatistik") */
  kaynak?: RaporSecimKaynagi;
  /** tip "secim": seçenekler tanım isteğinde veritabanından doldurulur (ilk seçenek "Tümü"); değer metin olarak saklanır */
  secenekKaynagi?: RaporSecenekKaynagi;
  /** Alan altındaki kısa açıklama */
  not?: string;
}

export type RaporBicim = "metin" | "sayi" | "sayi4" | "kur" | "tarih" | "tarihSaat" | "tam" | "saat";

/** Koşul: "kurIkisi" · "kip:<değer>" (= `birlestir` parametresi) · "p:<ad>=<d1>|<d2>" · "p:<ad>!=<d>" (herhangi bir parametre; değer p.ek → p → tanım varsayılanı) */
export type RaporKosul = "kurIkisi" | `kip:${string}` | `p:${string}`;

/** Grup altı / rapor altı net satırı: "Bakiye : |Σartı − Σeksi| B/A" */
export interface RaporNet { arti: string; eksi: string; etiket?: string; artiHarf?: string; eksiHarf?: string }

/** Grup tanımı (bir seviye) */
export interface RaporGrup {
  /** Grup anahtarı (satır alanı) ve grup başlığı biçimi: "{{vezneAd}} ({{vezneKod}})" */
  anahtar: string; baslik: string; altToplam?: boolean;
  /** Grup başlığının altında ikinci satır (Cari Ekstre: adres · telefon · VKN) — {{alan}} yer tutucuları */
  altBaslik?: string;
  /** false → genel toplam basılmaz (gruplar farklı para birimlerindeyse toplamın anlamı yoktur: kasa defteri, hesap ekstresi) */
  genelToplam?: boolean;
  /** Ara toplam satırının etiketi ({{alan}} yer tutuculu); varsayılan "Ara toplam" */
  toplamEtiketi?: string;
  /** Ara toplamın altına net satırı (|Σartı − Σeksi| + B/A) */
  net?: RaporNet;
  /** Gruplama yalnızca koşul sağlanırken uygulanır */
  kosul?: RaporKosul;
}

/** Alt tablo (Crystal alt raporu): satırın ya da grubun altında girintili iç tablo */
export interface RaporAltTablo { baslik?: string; kolonlar: RaporKolon[]; toplamEtiketi?: string; kosul?: RaporKosul }

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
  kosul?: RaporKosul;
}

export interface RaporTanim {
  kod: string;
  ad: string;
  aciklama?: string;
  kagit: "A4" | "A4-yatay";
  parametreler: RaporParametre[];
  kolonlar: RaporKolon[];
  /**
   * Bölüm: grubun üstünde ikinci seviye (sektörlü raporlar, docs/SEKTORLU_RAPORLAR_YOL_HARITASI.md K1/K10). Satırlar bölüm anahtarına göre
   * sıralı gelir; her bölümün başında başlık, sonunda `toplam:true` kolonların bölüm toplamı basılır. Veride tek bölüm varsa başlık ve bölüm
   * toplamı çizilmez (rapor bölümsüz görünür). Tanımda `grup` varsa gruplar bölümün içinde çalışır.
   */
  bolum?: { anahtar: string; baslik: string; altToplam?: boolean;
    /** true → tek bölüm olsa da başlık basılır (para grubu başlıkları: Döviz / Kuyum / Ticari) */
    herZaman?: boolean };
  /** Tek seviyeli grup (eski biçim; `gruplar` yoksa geçerli) */
  grup?: RaporGrup;
  /** Çok seviyeli gruplar, dıştan içe (eski raporlardaki iki / üç seviyeli gruplar). Sorgu çalışma anında `sonuc.gruplar` ile değiştirebilir. */
  gruplar?: RaporGrup[];
  /** false → genel toplam basılmaz */
  genelToplam?: boolean;
  /** Rapor sonu net satırı (genel toplamın altında) */
  net?: RaporNet;
  /** Satır altı iç tablo: satır `_alt` (dizi) taşıyorsa altında basılır (MASAK müşteri → fişler) */
  altTablo?: RaporAltTablo;
  /** Grup altı iç tablo: `sonuc.grupAltSatirlar[<grup anahtar değeri>]` satırları grubun sonunda basılır (gün toplamı para özeti, cari para toplamı) */
  grupAltTablo?: RaporAltTablo & { seviye?: number };
  /** true → PDF'te her sayfa sonunda "Sayfa toplamı", sonraki sayfa başında "Nakli yekün" (yalnız ana tablo) */
  sayfaToplami?: boolean;
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
  /** `tanim.ozet` bölümünün satırları (yoksa bölüm basılmaz). Satır `_stil: "baslik"` taşıyorsa grup başlığı olarak kalın basılır. */
  ozetSatirlar?: Record<string, any>[];
  /** Filtre özeti (PDF başlığı altına): "01.09.2026 – 12.09.2026 · Vezne: 01 · Para: USD" */
  filtreOzeti: string;
  /** Sorguya göre eklenen ek dipnot (ör. kullanılan kur tablosu) */
  ekDipnot?: string;
  /** Üst sınır aşıldıysa true → PDF/Excel üretilmez, ekrana uyarı */
  sinirAsildi?: boolean;
  toplamKayit: number;
  /** Sorgunun seçime göre değiştirdiği kolon başlıkları (anahtar → başlık; ana ve özet kolonları): "Net kâr (USD)" gibi */
  kolonBasliklari?: Record<string, string>;
  /** Sorgunun bu çalıştırmada kaldırdığı kolonlar (anahtar; ana ve özet): karşılık parası seçilmemişken karşılık kolonları gibi */
  kolonCikar?: string[];
  /** Sorgunun seçtiği gruplama (sıralamaya / liste şekline bağlı gruplar); verilirse tanımdaki `grup` / `gruplar` yerine geçer (boş dizi = grupsuz) */
  gruplar?: RaporGrup[];
  /** `tanim.grupAltTablo` satırları: anahtar = o seviyedeki grup anahtar değeri (String) */
  grupAltSatirlar?: Record<string, Record<string, any>[]>;
}

export const RAPOR_UST_SINIR = 5000;
