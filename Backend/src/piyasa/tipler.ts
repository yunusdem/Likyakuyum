/** Piyasa panosu ortak tipleri. Kaynak = fiyat çekilen bir site (Harem, Kapalıçarşı …). */

export type GrupKodu = "doviz" | "parite" | "altin" | "sarrafiye" | "gumus" | "kulce" | "iscilik" | "merkez";

/** "alis-satis": iki kolon. "yeni-eski": işçilik tablosu gibi yeni alış/satış + eski alış/satış. */
export type GrupTuru = "alis-satis" | "yeni-eski";

export type Yon = "yukari" | "asagi" | null;

export interface FiyatSatiri {
  /** Kaynak içinde tekil kod (sitenin kendi kodu) */
  kod: string;
  /** Sitede göründüğü ad */
  ad: string;
  altAd?: string;
  alis: number | null;
  satis: number | null;
  /** Yalnız "yeni-eski" gruplarda */
  eskiAlis?: number | null;
  eskiSatis?: number | null;
  /** Günlük % değişim (kaynak veriyorsa) */
  degisim?: number | null;
  ondalik: number;
  /** Kaynaktaki son güncelleme saati (SS:DD) */
  zaman?: string | null;
  /** Kaynaklar arası karşılaştırma için ortak kod (HAS, USDTRY, CEYREK_YENI …) */
  ortakKod?: string;
  /** Son değişimin yönü — servis doldurur */
  yon?: Yon;
}

export interface FiyatGrubu {
  kod: GrupKodu;
  baslik: string;
  tur: GrupTuru;
  satirlar: FiyatSatiri[];
}

export type KaynakDurumKodu = "canli" | "bekliyor" | "kopuk";

export interface KaynakAnlik {
  kod: string;
  ad: string;
  site: string;
  durum: KaynakDurumKodu;
  /** ISO; en son başarılı veri */
  sonGuncelleme: string | null;
  hata: string | null;
  gruplar: FiyatGrubu[];
}

export interface PiyasaKaynagi {
  readonly kod: string;
  readonly ad: string;
  readonly site: string;
  baslat(): void;
  durdur(): void;
  anlik(): KaynakAnlik;
}
