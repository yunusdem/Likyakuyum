/**
 * Hızlı Satış hesapları (docs/HIZLI_SATIS_YOL_HARITASI.md, U4–U7). Saf işlevler; ön yüz de içe aktarır. Her modülün hesabı o
 * modülün kendi fiş ekranındaki/sunucusundaki hesapla AYNI tutulur ki ekranda görünen toplam kaydedilen toplamla eşleşsin.
 */
import { ticariFisHesapla, yuvarla2 } from "../ticari/ticariHesap.js";
import type { HizliSatisModul } from "./hizliSatisKural.js";

export { yuvarla2 };
export const yuvarla4 = (n: number): number => Math.round((n + Number.EPSILON) * 10000) / 10000;

/** Sepet satırı. Fiyatlar KDV dahil gösterilir; modüle özel alanlar `ek`'te. */
export interface SepetSatiri {
  anahtar: string;
  ad: string;
  kod?: string | null;
  /** para: Ürün Tanımı / döviz, stok: stok kartı, serbest: elle ad+fiyat, barkod: barkodlu tekil ürün (Perakende) */
  tur: "para" | "stok" | "serbest" | "barkod";
  urunId?: number | null;
  /** TODVZ_PARA.URUN_TIPI: 0 döviz, 1 altın, 2 gümüş, 3 ziynet */
  urunTipi?: number | null;
  /** Adet, gram ya da döviz miktarı */
  miktar: number;
  birim: string;
  /** KDV dahil birim fiyat (Perakende/Ticari), birim kur (Sarraf/Döviz) */
  birimFiyat: number;
  kdvOrani: number;
  /** Fiyat elle değiştirildi (yetkili) */
  fiyatElle?: boolean;
  ek?: SatirEk;
}

export interface SatirEk {
  altinUrunId?: number | null;
  barkod?: string | null;
  ayar?: string | null;
  gram?: number;
  hasGram?: number;
  /** Sarraf: milyem (0,916 ya da 916 ya da 91,6 olabilir) */
  milyem?: number;
  /** Sarraf: gram başı işçilik (has gram) */
  iscilik?: number;
  stokKartId?: number | null;
  /** Döviz: istatistikten oranlar */
  bmvOrani?: number;
  kmvOrani?: number;
  komisyonOrani?: number;
}

/** Ziynet / döviz adetle, diğerleri gramla satılır */
export const adetliMi = (urunTipi: number | null | undefined): boolean => Number(urunTipi) === 0 || Number(urunTipi) === 3;

/** Milyem 0,916 / 916 / 91,6 biçimlerinden orana (Sarraf fişindeki gibi) */
export const milyemOrani = (m: number | null | undefined): number => {
  const v = Number(m) || 0;
  const r = v > 1 ? (v <= 100 ? v / 100 : v / 1000) : v;
  return Math.round(r * 1e6) / 1e6;
};

// ───────────── Perakende (PerakendeSqlRepository.createInvoice ile aynı) ─────────────

export interface PerakendeSatirSonuc {
  /** KDV hariç birim fiyat (sunucuya giden birimFiyat) */
  haricFiyat: number;
  tutar: number;
  kdvTutari: number;
  toplam: number;
}

export const perakendeSatir = (s: Pick<SepetSatiri, "miktar" | "birimFiyat" | "kdvOrani">): PerakendeSatirSonuc => {
  const k = Number(s.kdvOrani) || 0;
  const haricFiyat = k > 0 ? yuvarla4(s.birimFiyat / (1 + k / 100)) : s.birimFiyat;
  const tutar = yuvarla2((Number(s.miktar) || 0) * haricFiyat);
  const kdvTutari = yuvarla2(tutar * (k / 100));
  return { haricFiyat, tutar, kdvTutari, toplam: yuvarla2(tutar + kdvTutari) };
};

// ───────────── Sarraf (SarrafFisiPage recomputeRow ile aynı) ─────────────

export interface SarrafSatirSonuc {
  hasGram: number;
  iscilikHasGram: number;
  tutar: number;
}

export const sarrafSatir = (s: Pick<SepetSatiri, "miktar" | "birimFiyat" | "urunTipi" | "ek">): SarrafSatirSonuc => {
  const kur = Number(s.birimFiyat) || 0;
  const m = Number(s.miktar) || 0;
  if (adetliMi(s.urunTipi)) return { hasGram: 0, iscilikHasGram: 0, tutar: yuvarla2(m * kur) };
  const oran = milyemOrani(s.ek?.milyem);
  const hasGram = oran > 0 ? yuvarla4(m * oran) : m;
  const iscilikHasGram = (Number(s.ek?.iscilik) || 0) > 0 ? yuvarla4(m * Number(s.ek?.iscilik)) : 0;
  return { hasGram, iscilikHasGram, tutar: yuvarla2((hasGram + iscilikHasGram) * kur) };
};

// ───────────── Döviz (DovizFisiPage calculateRowValues ile aynı) ─────────────

/** TODVZ_TANIM.KMV_UYGULAMA_SEKLI: 1 uygulanmasın, 2 kura dahil, 3 kurdan hariç (varsayılan) */
export type KmvSekli = 1 | 2 | 3;

export interface DovizSatirSonuc {
  tutar: number;
  bmv: number;
  kmv: number;
  komisyon: number;
}

export const dovizSatir = (s: Pick<SepetSatiri, "miktar" | "birimFiyat" | "ek">, tip: 0 | 1, kmvSekli: KmvSekli): DovizSatirSonuc => {
  const brut = (Number(s.miktar) || 0) > 0 ? yuvarla2(Number(s.miktar) * (Number(s.birimFiyat) || 0)) : 0;
  const kom = Number(s.ek?.komisyonOrani) || 0;
  const komisyon = kom > 0 && brut > 0 ? yuvarla2(brut * (kom / 100)) : 0;
  if (tip === 0) return { tutar: brut, bmv: 0, kmv: 0, komisyon };
  const bmvO = Number(s.ek?.bmvOrani) || 0;
  const kmvO = Number(s.ek?.kmvOrani) || 0;
  const bmv = bmvO > 0 && brut > 0 ? yuvarla2(brut * (bmvO / 100)) : 0;
  const carpan = kmvO >= 1 && kmvO <= 10 ? kmvO / 1000 : kmvO / 100;
  const kmv = kmvSekli !== 1 && kmvO > 0 && brut > 0 ? yuvarla2(brut * carpan) : 0;
  return { tutar: brut, bmv, kmv, komisyon };
};

/**
 * Döviz satırına istatistikten oran (DovizFisiPage handleSelectCurrency ile aynı): satışta KMV istatistikte 0 ise BMV oranı,
 * o da yoksa binde 2; bu durumda BMV temizlenir. Alışta yalnız komisyon.
 */
export const dovizOranlari = (ist: { bmvOrani?: number | null; kmvOrani?: number | null; komisyonOrani?: number | null } | null | undefined, tip: 0 | 1, kmvSekli: KmvSekli) => {
  let bmv = Number(ist?.bmvOrani) > 0 ? Number(ist?.bmvOrani) : 0;
  const hamKmv = Number(ist?.kmvOrani) > 0 ? Number(ist?.kmvOrani) : 0;
  let kmv = kmvSekli !== 1 ? (hamKmv > 0 ? hamKmv : tip === 1 ? (bmv > 0 ? bmv : 0.2) : 0) : 0;
  if (tip === 1 && kmvSekli !== 1 && hamKmv === 0 && bmv > 0) bmv = 0;
  if (tip === 0) { bmv = 0; kmv = 0; }
  const komisyon = Number(ist?.komisyonOrani) > 0 ? Number(ist?.komisyonOrani) : 0;
  return { bmvOrani: bmv, kmvOrani: kmv, komisyonOrani: komisyon };
};

// ───────────── Ortak toplam ─────────────

export interface IndirimGirdisi {
  /** 1 yüzde, 2 tutar */
  turu: 1 | 2;
  deger: number;
}

export interface SepetToplami {
  /** Satırların gösterilen tutarları (KDV dahil / kur × miktar) */
  satirTutarlari: number[];
  araToplam: number;
  kdv: number;
  indirim: number;
  /** Döviz: BMV + KMV(kurdan hariç) + komisyon */
  masraf: number;
  /** Müşteriden alınacak (satış) ya da müşteriye ödenecek (alış) */
  genelToplam: number;
  /** Sarraf: has toplamı (has + işçilik has) */
  hasToplam: number;
}

export function sepetHesapla(
  modul: HizliSatisModul,
  satirlar: SepetSatiri[],
  secenek: { tip?: 0 | 1; indirim?: IndirimGirdisi | null; kmvSekli?: KmvSekli } = {}
): SepetToplami {
  const tip = secenek.tip ?? 1;
  const bos: SepetToplami = { satirTutarlari: [], araToplam: 0, kdv: 0, indirim: 0, masraf: 0, genelToplam: 0, hasToplam: 0 };
  if (!satirlar.length) return bos;

  if (modul === "perakende") {
    const r = satirlar.map(perakendeSatir);
    const ara = yuvarla2(r.reduce((a, x) => a + x.tutar, 0));
    const kdv = yuvarla2(r.reduce((a, x) => a + x.kdvTutari, 0));
    const brut = yuvarla2(ara + kdv);
    const ind = secenek.indirim;
    const indirim = !ind || !(ind.deger > 0) ? 0 : ind.turu === 1 ? yuvarla2(brut * (Math.min(ind.deger, 100) / 100)) : Math.min(yuvarla2(ind.deger), brut);
    return { ...bos, satirTutarlari: r.map((x) => x.toplam), araToplam: ara, kdv, indirim, genelToplam: Math.max(0, yuvarla2(brut - indirim)) };
  }

  if (modul === "ticari") {
    const h = ticariFisHesapla(
      satirlar.map((s) => ({ miktar: s.miktar, kdvDahilFiyat: s.birimFiyat, kdvOrani: s.kdvOrani })),
      secenek.indirim ? { turu: secenek.indirim.turu, deger: secenek.indirim.deger } : null
    );
    return {
      ...bos,
      satirTutarlari: h.satirlar.map((x) => x.brutDahil),
      araToplam: h.araToplam,
      kdv: h.toplamKdv,
      indirim: h.baslikIskontoDahil,
      genelToplam: h.genelToplam,
    };
  }

  if (modul === "sarraf") {
    const r = satirlar.map(sarrafSatir);
    const toplam = yuvarla2(r.reduce((a, x) => a + x.tutar, 0));
    return { ...bos, satirTutarlari: r.map((x) => x.tutar), araToplam: toplam, genelToplam: toplam, hasToplam: yuvarla4(r.reduce((a, x) => a + x.hasGram + x.iscilikHasGram, 0)) };
  }

  // döviz
  const sekil = secenek.kmvSekli ?? 3;
  const r = satirlar.map((s) => dovizSatir(s, tip, sekil));
  const toplam = yuvarla2(r.reduce((a, x) => a + x.tutar, 0));
  const masraf = tip === 0
    ? yuvarla2(r.reduce((a, x) => a + x.komisyon, 0))
    : yuvarla2(r.reduce((a, x) => a + x.bmv + (sekil === 3 ? x.kmv : 0) + x.komisyon, 0));
  return { ...bos, satirTutarlari: r.map((x) => x.tutar), araToplam: toplam, masraf, genelToplam: tip === 0 ? yuvarla2(toplam - masraf) : yuvarla2(toplam + masraf) };
}

// ───────────── Ödemeler (parçalı, H16) ─────────────

/** 0 nakit (vezne), 1 cari, 2 POS, 3 banka hesabı — modüllerin odemeAraciTuru değerleriyle aynı */
export type OdemeTuru = 0 | 1 | 2 | 3;
export const ODEME_ADI: Record<OdemeTuru, string> = { 0: "Nakit", 1: "Cari", 2: "POS", 3: "Banka" };

export interface SepetOdemesi {
  anahtar: string;
  tur: OdemeTuru;
  tutar: number;
  posCihaziId?: number | null;
  posAdi?: string | null;
  posKod?: string | null;
  bankaId?: number | null;
  bankaHesapNo?: string | null;
  bankaAdi?: string | null;
}

/** Döviz fişinde ödeme modeli yok: yalnız nakit ya da banka (U7) */
export const MODUL_ODEMELERI: Record<HizliSatisModul, OdemeTuru[]> = {
  perakende: [0, 2, 1, 3],
  ticari: [0, 2, 1, 3],
  sarraf: [0, 2, 1, 3],
  doviz: [0, 3],
};

export interface OdemeDurumu {
  odenen: number;
  kalan: number;
  /** Nakit fazlası (para üstü) */
  paraUstu: number;
  /** Nakit dışı ödeme toplamı toplamı aşıyor: kayıt yapılmaz */
  fazlaOdeme: boolean;
}

/**
 * Para üstü yalnız nakitten verilir: nakit dışı ödemeler toplamı aşamaz. Kalan ≤ 0,01 ise satış tamamlanabilir.
 */
export function odemeDurumu(genelToplam: number, odemeler: Pick<SepetOdemesi, "tur" | "tutar">[]): OdemeDurumu {
  const odenen = yuvarla2(odemeler.reduce((a, o) => a + (Number(o.tutar) || 0), 0));
  const nakitDisi = yuvarla2(odemeler.filter((o) => o.tur !== 0).reduce((a, o) => a + (Number(o.tutar) || 0), 0));
  const fark = yuvarla2(genelToplam - odenen);
  return {
    odenen,
    kalan: fark > 0 ? fark : 0,
    paraUstu: fark < 0 ? yuvarla2(-fark) : 0,
    fazlaOdeme: nakitDisi - genelToplam > 0.01,
  };
}

/**
 * Kayda giden ödemeler: para üstü nakitten düşülür (nakit satırları sondan kısılır), sıfırlananlar atılır.
 * Böylece kaydedilen ödeme toplamı fiş toplamına eşit olur.
 */
export function kayitOdemeleri<T extends Pick<SepetOdemesi, "tur" | "tutar">>(genelToplam: number, odemeler: T[]): T[] {
  let fazla = yuvarla2(odemeler.reduce((a, o) => a + (Number(o.tutar) || 0), 0) - genelToplam);
  const sonuc = odemeler.map((o) => ({ ...o, tutar: yuvarla2(Number(o.tutar) || 0) }));
  for (let i = sonuc.length - 1; i >= 0 && fazla > 0.004; i--) {
    if (sonuc[i].tur !== 0) continue;
    const d = Math.min(sonuc[i].tutar, fazla);
    sonuc[i].tutar = yuvarla2(sonuc[i].tutar - d);
    fazla = yuvarla2(fazla - d);
  }
  return sonuc.filter((o) => o.tutar > 0);
}

// ───────────── Kur (fiş ekranlarındaki getKurForProduct ile aynı sıra) ─────────────

export interface KurSatiri {
  paraId: number;
  kod: string;
  ad?: string;
  dovizAlis: number | null;
  dovizSatis: number | null;
  efektifAlis: number | null;
  efektifSatis: number | null;
}

/** Günlük tablo üstüne anlık tablo: anlıkta pozitif değer varsa o geçerli (fiş ekranları gibi) */
export function kurlariBirlestir(gunluk: KurSatiri[], anlik: KurSatiri[]): KurSatiri[] {
  const anahtar = (k: KurSatiri) => (k.kod || "").trim().toLocaleUpperCase("tr-TR") || `ID_${k.paraId}`;
  const m = new Map<string, KurSatiri>();
  for (const k of gunluk) m.set(anahtar(k), { ...k });
  for (const k of anlik) {
    const o = m.get(anahtar(k));
    if (!o) { m.set(anahtar(k), { ...k }); continue; }
    const sec = (a: number | null, b: number | null) => (Number(a) > 0 ? a : b);
    m.set(anahtar(k), { ...o, dovizAlis: sec(k.dovizAlis, o.dovizAlis), dovizSatis: sec(k.dovizSatis, o.dovizSatis), efektifAlis: sec(k.efektifAlis, o.efektifAlis), efektifSatis: sec(k.efektifSatis, o.efektifSatis) });
  }
  return [...m.values()];
}

const oran = (k: KurSatiri | undefined, tip: 0 | 1): number => {
  if (!k) return 0;
  const v = tip === 1
    ? (Number(k.efektifSatis) > 0 ? k.efektifSatis : Number(k.dovizSatis) > 0 ? k.dovizSatis : 0)
    : (Number(k.efektifAlis) > 0 ? k.efektifAlis : Number(k.dovizAlis) > 0 ? k.dovizAlis : 0);
  return Number(v) || 0;
};

const HAS_KODLARI = ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"];
const GUMUS_KODLARI = ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS", "GMS"];

/**
 * Ürünün birim kuru. tip 1 satış (efektif satış → döviz satış), 0 alış. Kendi kur satırı yoksa: altın → HAS kuru,
 * gümüş → gümüş kuru, ziynet / döviz → 0 (fiyat bilinmiyor; ekran sorar).
 */
export function urunKuru(kurlar: KurSatiri[], urun: { paraId?: number | null; kod?: string | null; urunTipi?: number | null }, tip: 0 | 1): number {
  const kod = String(urun.kod ?? "").trim().toLocaleUpperCase("tr-TR");
  if (["TL", "TRY", "TRL"].includes(kod)) return 1;
  const kendi = kurlar.find((k) => (urun.paraId && k.paraId === urun.paraId) || (kod && (k.kod || "").trim().toLocaleUpperCase("tr-TR") === kod));
  const r = oran(kendi, tip);
  if (r > 0) return r;
  const t = Number(urun.urunTipi);
  const bul = (liste: string[]) => kurlar.find((k) => liste.includes((k.kod || "").trim().toLocaleUpperCase("tr-TR")));
  if (t === 1) return oran(bul(HAS_KODLARI), tip);
  if (t === 2) return oran(bul(GUMUS_KODLARI), tip);
  return 0;
}

// ───────────── MASAK sınırı (fiş ekranlarındaki isMasakLimitExceeded ile aynı, H14) ─────────────

export const MASAK_TL_SINIRI = 185000;
export const MASAK_USD_SINIRI = 5000;

/**
 * Perakende: genel toplam ≥ 185.000 TL. Sarraf: toplam ya da has × has kuru ≥ 185.000 TL ya da tek USD satırı ≥ 5.000.
 * Döviz: tek USD satırı ≥ 5.000, USD karşılığı toplamı ≥ 5.000 ya da TL toplamı ≥ 185.000. Ticari: yok.
 * Gayri resmi istatistikte (fisDizaynTipi 1) hiç uygulanmaz.
 */
export function masakGerekli(
  modul: HizliSatisModul,
  sepet: Pick<SepetSatiri, "kod" | "miktar">[],
  toplam: Pick<SepetToplami, "genelToplam" | "araToplam" | "hasToplam">,
  o: { hasKuru?: number; usdKuru?: number; gayriResmi?: boolean } = {}
): boolean {
  if (o.gayriResmi || modul === "ticari") return false;
  const tlAsti = toplam.genelToplam >= MASAK_TL_SINIRI || toplam.araToplam >= MASAK_TL_SINIRI;
  if (modul === "perakende") return toplam.genelToplam >= MASAK_TL_SINIRI;
  const usdSatir = sepet.some((s) => ["USD", "$"].includes(String(s.kod ?? "").trim().toUpperCase()) && Number(s.miktar) >= MASAK_USD_SINIRI);
  if (modul === "sarraf") return tlAsti || usdSatir || (toplam.hasToplam > 0 && (Number(o.hasKuru) || 0) * toplam.hasToplam >= MASAK_TL_SINIRI);
  const usdKuru = Number(o.usdKuru) || 0;
  const usdKarsiligi = usdKuru > 0 ? toplam.araToplam / usdKuru : 0;
  return tlAsti || usdSatir || usdKarsiligi >= MASAK_USD_SINIRI;
}
