/**
 * Kur komisyonu formülü (docs/KUR_KAYNAGI_YOL_HARITASI.md, K6–K15, K19). Saf; veritabanı ve ağ yok.
 * Kullanıcı hep pozitif yazar: komisyon alıştan düşülür, satışa eklenir. Y = yüzde, T = TL tutar.
 * Döviz kolonlarına döviz komisyonu, efektif kolonlara efektif komisyonu uygulanır.
 */

export type KomisyonTuru = "Y" | "T";

export interface Komisyon {
  /** Efektif alış/satış komisyonu */
  alisTur: KomisyonTuru;
  alisDeger: number;
  satisTur: KomisyonTuru;
  satisDeger: number;
  /** Döviz alış/satış komisyonu */
  dovizAlisTur: KomisyonTuru;
  dovizAlisDeger: number;
  dovizSatisTur: KomisyonTuru;
  dovizSatisDeger: number;
}

export interface HamKur {
  dovizAlis: number | null;
  dovizSatis: number | null;
  /** Efektif komisyonunun uygulanacağı fiyat (TCMB'de efektif, yoksa döviz; sitelerde ham alış/satış) */
  bazAlis: number | null;
  bazSatis: number | null;
}

export interface KomisyonluKur {
  dovizAlis: number;
  dovizSatis: number;
  efektifAlis: number;
  efektifSatis: number;
}

export const SIFIR_KOMISYON: Komisyon = {
  alisTur: "T",
  alisDeger: 0,
  satisTur: "T",
  satisDeger: 0,
  dovizAlisTur: "T",
  dovizAlisDeger: 0,
  dovizSatisTur: "T",
  dovizSatisDeger: 0,
};

export const yuvarla = (v: number, ondalik: number): number => {
  const c = 10 ** Math.max(0, Math.min(10, ondalik));
  return Math.round((v + Number.EPSILON) * c) / c;
};

const uygula = (baz: number, tur: KomisyonTuru, deger: number, yon: -1 | 1): number => {
  const d = Math.abs(Number(deger) || 0);
  return tur === "Y" ? baz * (1 + (yon * d) / 100) : baz + yon * d;
};

const pozitif = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Ham fiyattan liste satırı. Alış ya da satıştan biri yoksa null (listede yarım satır kaydedilemez).
 */
export const komisyonUygula = (ham: HamKur, k: Partial<Komisyon> | undefined, ondalik: number): KomisyonluKur | null => {
  const bazAlis = pozitif(ham.bazAlis) ? ham.bazAlis : null;
  const bazSatis = pozitif(ham.bazSatis) ? ham.bazSatis : null;
  if (bazAlis === null || bazSatis === null) return null;
  const hamDovizAlis = pozitif(ham.dovizAlis) ? ham.dovizAlis : bazAlis;
  const hamDovizSatis = pozitif(ham.dovizSatis) ? ham.dovizSatis : bazSatis;
  const kom = { ...SIFIR_KOMISYON, ...(k ?? {}) };
  const sonuc = {
    dovizAlis: yuvarla(uygula(hamDovizAlis, kom.dovizAlisTur, kom.dovizAlisDeger, -1), ondalik),
    dovizSatis: yuvarla(uygula(hamDovizSatis, kom.dovizSatisTur, kom.dovizSatisDeger, 1), ondalik),
    efektifAlis: yuvarla(uygula(bazAlis, kom.alisTur, kom.alisDeger, -1), ondalik),
    efektifSatis: yuvarla(uygula(bazSatis, kom.satisTur, kom.satisDeger, 1), ondalik),
  };
  if (sonuc.dovizAlis <= 0 || sonuc.dovizSatis <= 0 || sonuc.efektifAlis <= 0 || sonuc.efektifSatis <= 0) return null;
  return sonuc;
};
