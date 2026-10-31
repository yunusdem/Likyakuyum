import { ApiError } from "../utils/ApiError.js";
import { GiderPusulasiGirdi } from "./ice/ubl/giderPusulasiBuilder.js";
import { UblFaturaGirdi, UblFaturaSatiri, UblTaraf, hesapla } from "./ice/ubl/invoiceBuilder.js";
import { tutarYaziyla } from "./ebelgeKaynakPdf.js";
import { KuyumKodTuru, kuyumFaturaTipi, kuyumKodAdi, satirKodu } from "./kuyumKodlari.js";

/**
 * Kuyum faturası (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF7, EF8, EF13, EF16, U3–U5). Saf hesap: veritabanına ve ICE'ye
 * dokunmaz; Backend/scripts/kuyum-fatura-test.ts ile sınanır.
 *
 * Satış faturası (Kütükçü örneği): "22 ayar altın" X gram × fiyat, KDV %0 + 805 (gümüşte 808) · "işçilik" 1 adet, KDV %20 ·
 * tip ÖZELMATRAH. KDV dahil toplam hedefe (gelen para / fiş toplamı) kuruşu kuruşuna eşittir: işçilik kalandan çözülür.
 * İşçilik + KDV yuvarlaması bazı kalanları tutturamaz (f(m) = m + yuvarla(m × oran) bazı kuruşları atlar); o zaman son altın
 * satırının birim fiyatı en yakın kuruşa kaydırılır (U4).
 */

export const ISCILIK_ADI = "işçilik";

const yuvarla = (n: number): number => Math.round(n * 100) / 100;
const sayi = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const temiz = (v: unknown): string => String(v ?? "").trim();
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr-TR");
const kurus = (n: number) => Math.round(n * 100);

/* ==========================================================================
   Ayar adı (U5)
   ========================================================================== */

const AYARLAR: { ayar: number; milyem: number }[] = [
  { ayar: 24, milyem: 995 },
  { ayar: 22, milyem: 916 },
  { ayar: 21, milyem: 875 },
  { ayar: 18, milyem: 750 },
  { ayar: 14, milyem: 585 },
  { ayar: 8, milyem: 333 },
];

/** Binde milyem: 0,916 → 916; 91,6 → 916; 916 → 916 */
export const milyemBin = (v: unknown): number | null => {
  const n = sayi(v);
  if (!(n > 0)) return null;
  return Math.round(n <= 1 ? n * 1000 : n <= 100 ? n * 10 : n);
};

/** Milyeme en yakın ayar (±15 binde; 1000 de 24 ayar) */
export const milyemdenAyar = (milyem: number | null): number | null => {
  if (!milyem) return null;
  if (milyem >= 990) return 24;
  const en = AYARLAR.reduce((a, b) => (Math.abs(b.milyem - milyem) < Math.abs(a.milyem - milyem) ? b : a));
  return Math.abs(en.milyem - milyem) <= 15 ? en.ayar : null;
};

export const gumusMu = (ad: unknown, urunTipi?: unknown): boolean => Number(urunTipi) === 2 || /GÜMÜŞ|GUMUS/.test(trBuyuk(temiz(ad)));

/**
 * Faturadaki altın satırı adı: ürün adındaki "NN AYAR", yoksa ürünün has oranı, yoksa satırın milyemi → "22 ayar altın".
 * Ayar bulunamazsa ya da gümüşse ürünün kendi adı.
 */
export const kuyumSatirAdi = (s: { ad?: unknown; hasOrani?: unknown; milyem?: unknown; urunTipi?: unknown }): string => {
  const ad = temiz(s.ad);
  if (gumusMu(ad, s.urunTipi)) return ad || "Gümüş";
  const adAyari = /(\d{1,2})\s*AYAR/.exec(trBuyuk(ad));
  const ayar = adAyari ? Number(adAyari[1]) : milyemdenAyar(milyemBin(s.hasOrani)) ?? milyemdenAyar(milyemBin(s.milyem));
  return ayar ? `${ayar} ayar altın` : ad || "Altın";
};

/* ==========================================================================
   Kuruş çözücü (U4)
   ========================================================================== */

/** KDV hariç işçilik m ≥ 0: m + yuvarla(m × oran / 100) = kalan. Bu kuruş tutturulamıyorsa null. */
export const iscilikCoz = (kalan: number, oran: number): number | null => {
  const k = kurus(kalan);
  if (k < 0) return null;
  if (k === 0) return 0;
  const o = Math.max(0, sayi(oran));
  const tahmin = Math.round(k / (1 + o / 100));
  for (const d of [0, -1, 1, -2, 2, -3, 3]) {
    const m = tahmin + d;
    if (m < 0) continue;
    // KDV, faturayı kuran hesapla() ile birebir aynı ondalık hesapla (yarım kuruşta tamsayı hesabı farklı yuvarlar)
    const tl = m / 100;
    if (kurus(tl + yuvarla((tl * o) / 100)) === k) return tl;
  }
  return null;
};

export interface KuyumAltin {
  ad: string;
  /** Gram (GRM) ya da adet (C62) */
  miktar: number;
  birimKodu: "GRM" | "C62";
  /** Gram / adet fiyatı (2 hane) */
  birimFiyat: number;
  /** Gümüş satırı (ön değer kodu 808, ad ürünün kendi adı) */
  gumus?: boolean;
  /** GİB kodu (kuyumKodlari.ts): verilmezse altın 805, gümüş 808 (EF29–EF34) */
  kod?: string | null;
  /** Kuruş tutturmak için son çare satır iskontosu (1–2 kuruş, U4) */
  iskonto?: number;
  /** Ürünün milyemi (ayar adı ve gider pusulası satır adı için) */
  milyem?: number | null;
}

export interface KuyumCozum {
  altinlar: (KuyumAltin & { tutar: number })[];
  /** İşçilik KDV hariç tutarı ve KDV'si; işçilik yoksa null */
  iscilik: { matrah: number; oran: number; kdv: number } | null;
  /** KDV dahil toplam = hedef */
  toplam: number;
  /** Kuruş tutturmak için kaydırılan birim fiyat (U4); kaydırma yoksa null */
  fiyatKaydi: { eski: number; yeni: number } | null;
}

const altinTutari = (a: Pick<KuyumAltin, "miktar" | "birimFiyat">) => yuvarla(a.miktar * a.birimFiyat);

/**
 * Altın satırları + hedef (KDV dahil toplam) + işçilik KDV oranı → kalan işçilik. Altın tutarı hedefi aşarsa hata.
 * İşçilik sıfır çıkarsa işçilik satırı olmaz.
 */
export const kuyumSatisCoz = (altinlar: KuyumAltin[], hedef: number, oran: number): KuyumCozum => {
  if (!altinlar.length) throw ApiError.badRequest("En az bir altın satırı girilmeli.");
  altinlar.forEach((a, i) => {
    if (!(a.miktar > 0)) throw ApiError.badRequest(`${i + 1}. satırda ${a.birimKodu === "GRM" ? "gram" : "adet"} sıfırdan büyük olmalı.`);
    if (!(a.birimFiyat > 0)) throw ApiError.badRequest(`${i + 1}. satırda fiyat sıfırdan büyük olmalı.`);
  });
  const h = yuvarla(hedef);
  if (!(h > 0)) throw ApiError.badRequest("Belge tutarı sıfırdan büyük olmalı.");
  const o = sayi(oran);
  if (o < 0 || o > 100) throw ApiError.badRequest("İşçilik KDV oranı 0 ile 100 arasında olmalı.");

  const ilk = altinlar.map((a) => ({ ...a, birimFiyat: yuvarla(a.birimFiyat) }));
  const sonIdx = ilk.length - 1;
  const digerleri = yuvarla(ilk.slice(0, sonIdx).reduce((t, a) => t + altinTutari(a), 0));
  const son = ilk[sonIdx];
  if (yuvarla(digerleri + altinTutari(son)) > h + 0.001) {
    throw ApiError.badRequest(`Altın tutarı (${yuvarla(digerleri + altinTutari(son)).toFixed(2)}) belge tutarını (${h.toFixed(2)}) aşıyor; gramı ya da fiyatı düşürün.`);
  }
  const dene = (bf: number, iskonto: number): KuyumCozum | null => {
    if (!(bf > 0)) return null;
    const sonTutar = yuvarla(altinTutari({ miktar: son.miktar, birimFiyat: bf }) - iskonto);
    const kalan = yuvarla(h - yuvarla(digerleri + sonTutar));
    if (kalan < 0 || sonTutar <= 0) return null;
    const m = iscilikCoz(kalan, o);
    if (m === null) return null;
    const sonSatir = { ...son, birimFiyat: bf, ...(iskonto > 0 ? { iskonto } : {}) };
    return {
      altinlar: [...ilk.slice(0, sonIdx).map((a) => ({ ...a, tutar: altinTutari(a) })), { ...sonSatir, tutar: sonTutar }],
      iscilik: m > 0 ? { matrah: m, oran: o, kdv: yuvarla(kalan - m) } : null,
      toplam: h,
      fiyatKaydi: bf === son.birimFiyat ? null : { eski: son.birimFiyat, yeni: bf },
    };
  };
  // Önce verilen fiyat; tutmazsa en yakın kuruşlar (en çok 10 kuruş, önce aşağı: altın hedefi aşmasın).
  // %20'de f(m) her 6 kuruşta birini atlar; gram 6'nın katıysa fiyat kaydırmak boşluktan çıkaramaz → 1–2 kuruş satır iskontosu.
  for (let adim = 0; adim <= 10; adim++) {
    for (const d of adim === 0 ? [0] : [-adim, adim]) {
      const c = dene(yuvarla(son.birimFiyat + d / 100), 0);
      if (c) return c;
    }
  }
  for (const isk of [0.01, 0.02, 0.03, 0.04, 0.05]) {
    const c = dene(son.birimFiyat, isk);
    if (c) return c;
  }
  throw ApiError.badRequest("Tutar kuruşu kuruşuna tutturulamadı; gramı ya da fiyatı değiştirin.");
};

/** KDV'siz (işçiliksiz) tek altın satırı: miktar × fiyat tam hedef olmalı; 2 haneli fiyatla tutmazsa 1 adet, gram ada yazılır. */
export const iscilikSizSatir = (a: KuyumAltin, hedef: number): KuyumAltin & { tutar: number } => {
  const h = yuvarla(hedef);
  const tahmin = yuvarla(h / a.miktar);
  for (const d of [0, -1, 1, -2, 2]) {
    const bf = yuvarla(tahmin + d / 100);
    if (bf > 0 && altinTutari({ miktar: a.miktar, birimFiyat: bf }) === h) return { ...a, birimFiyat: bf, tutar: h };
  }
  const miktarYazi = `${a.miktar.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${a.birimKodu === "GRM" ? "gr" : "adet"}`;
  return { ...a, ad: `${a.ad} (${miktarYazi})`, miktar: 1, birimKodu: "C62", birimFiyat: h, tutar: h };
};

/* ==========================================================================
   UBL fatura satırları
   ========================================================================== */

/**
 * Fatura tipi satır kodlarından (EF31): 8xx → ÖZELMATRAH, 2xx/3xx → İSTİSNA. İkisi birlikte olamaz (GİB tek tip ister).
 */
export const faturaTipiKodlardan = (satirlar: UblFaturaSatiri[]): KuyumKodTuru => {
  const tip = kuyumFaturaTipi(satirlar.filter((s) => s.kdvOrani === 0).map((s) => s.istisnaKodu || ""));
  if (!tip) throw ApiError.badRequest("Aynı faturada özel matrah kodu (805 / 808) ile istisna kodu (230, 231 …) birlikte olamaz; satırları ayrı faturalara bölün.");
  return tip;
};

export const kuyumUblSatirlari = (c: Pick<KuyumCozum, "altinlar" | "iscilik">): UblFaturaSatiri[] => [
  ...c.altinlar.map((a): UblFaturaSatiri => {
    // Altın satırı KDV %0 + seçilen kod (Kütükçü örneği); özel matrah da istisna da TaxExemptionReasonCode'da gider
    const kod = satirKodu(a.kod, !!a.gumus);
    return {
      ad: a.ad, miktar: a.miktar, birimKodu: a.birimKodu, birimFiyat: a.birimFiyat, kdvOrani: 0, istisnaKodu: kod, istisnaGerekcesi: kuyumKodAdi(kod) || undefined,
      ...(a.iskonto ? { iskontoTutari: a.iskonto } : {}),
    };
  }),
  ...(c.iscilik ? [{ ad: ISCILIK_ADI, miktar: 1, birimKodu: "C62", birimFiyat: c.iscilik.matrah, kdvOrani: c.iscilik.oran } as UblFaturaSatiri] : []),
];

/** Kütükçü düzeninde altta görünen yazıyla tutar */
export const yalnizYazisi = (tutar: number): string => `YALNIZ ${tutarYaziyla(yuvarla(tutar), "TÜRK LİRASI", "KURUŞ")}`;

/** Kuyum faturası notları: yazıyla tutar (+ ödeme notu) — şablon (kuyumFatura.xslt) "YALNIZ" ve "Ödeme Notu:" ile başlayanı ayrı basar */
export const kuyumNotlari = (toplam: number, odemeNotu?: string | null): string[] => [
  yalnizYazisi(toplam),
  ...(temiz(odemeNotu) ? [`Ödeme Notu: ${temiz(odemeNotu)}`] : []),
];

/* ==========================================================================
   Sarraf fişi → kuyum satış faturası satırları (EF16)
   ========================================================================== */

export interface SarrafKuyumSatiri {
  URUN_ADI?: string | null;
  URUN_TIPI?: number | null;
  MIKTAR?: number | null;
  ADET?: number | null;
  TUTAR?: number | null;
  MILYEM?: number | null;
  PARA_HAS_ORANI?: number | null;
  /** Satırın İşçilik (TL) sütunu (TODVZ_SARRAF_FISI_SATIRI.ISCILIK_TUTARI, göç 021) */
  ISCILIK_TUTARI?: number | null;
}

/** Fişte oran yokken İşçilik (TL) satırına uygulanan KDV oranı (EF35) */
export const VARSAYILAN_ISCILIK_KDV = 20;

/**
 * Fiş satırları (tutar) → kuyum satırları (EF16, EF35). İşçilik (KDV hariç):
 *  - satırın İşçilik (TL) sütunu dolu ise o tutar; KDV fişteki oranla (yoksa %20) üstüne hesaplanır,
 *  - değilse (eski fişler) fiş KDV'si ÷ oran.
 * Altın = satır tutarı − işçilik − KDV; gram fişteki gram. Toplam fiş toplamına eşit. İşçilik yoksa her satır tek altın satırı.
 */
export const sarrafKuyumCoz = (satirlar: SarrafKuyumSatiri[], kdvler: number[], kdvOrani: number, fisKodu?: string | null): KuyumCozum => {
  if (!satirlar.length) throw ApiError.badRequest("Sarraf fişinin satırları bulunamadı.");
  const altinlar: KuyumAltin[] = [];
  const tutarlar: number[] = [];
  const iscilikler: number[] = [];
  const fisOrani = sayi(kdvOrani);
  const fisKdvVar = fisOrani > 0 && kdvler.some((k) => k > 0);
  const tlVar = satirlar.some((s) => sayi(s.ISCILIK_TUTARI) > 0);
  const kdvVar = tlVar || fisKdvVar;
  const oran = tlVar && !(fisOrani > 0) ? VARSAYILAN_ISCILIK_KDV : fisOrani;
  satirlar.forEach((s, i) => {
    const tutar = yuvarla(sayi(s.TUTAR));
    const tl = yuvarla(Math.max(0, sayi(s.ISCILIK_TUTARI)));
    const iscilik = tlVar ? tl : fisKdvVar && kdvler[i] > 0 ? yuvarla(((kdvler[i] || 0) * 100) / oran) : 0;
    const kdv = tlVar ? yuvarla((iscilik * oran) / 100) : fisKdvVar ? yuvarla(kdvler[i] || 0) : 0;
    const altin = yuvarla(tutar - kdv - iscilik);
    if (altin <= 0) throw ApiError.badRequest(`${i + 1}. satırda altın bedeli işçilik ve KDV'den küçük kalıyor; fişi kontrol edin.`);
    const gram = sayi(s.MIKTAR);
    const adet = sayi(s.ADET);
    const gramli = gram > 0;
    const miktar = gramli ? gram : adet > 0 ? adet : 1;
    const ad = gramli ? kuyumSatirAdi({ ad: s.URUN_ADI, hasOrani: s.PARA_HAS_ORANI, milyem: s.MILYEM, urunTipi: s.URUN_TIPI }) : temiz(s.URUN_ADI) || "Altın";
    altinlar.push({ ad, miktar, birimKodu: gramli ? "GRM" : "C62", birimFiyat: yuvarla(altin / miktar), gumus: gumusMu(s.URUN_ADI, s.URUN_TIPI), kod: fisKodu ?? null });
    tutarlar.push(tutar);
    iscilikler.push(iscilik);
  });
  const hedef = yuvarla(tutarlar.reduce((t, x) => t + x, 0));
  if (!kdvVar) {
    return { altinlar: altinlar.map((a, i) => iscilikSizSatir(a, tutarlar[i])), iscilik: null, toplam: hedef, fiyatKaydi: null };
  }
  return kuyumSatisCoz(altinlar, hedef, oran);
};

/* ==========================================================================
   e-Banka'dan satış faturası (EF7–EF12) ve gider pusulası (EF13, EF21)
   ========================================================================== */

export interface EbankaSatisIstegi {
  altinlar: KuyumAltin[];
  /** İşçilik KDV oranı (varsayılan 20) */
  iscilikKdvOrani: number;
}

/** Kuyum satış faturası girdisi; senaryo çağıranda (mükellef sorgusu) kesinleşir */
export const ebankaSatisGirdisi = (
  istek: EbankaSatisIstegi,
  hedef: number,
  ortak: { belgeNo: string; tarih: string; alici: UblTaraf; odemeNotu?: string | null }
): { girdi: Omit<UblFaturaGirdi, "gonderici">; cozum: KuyumCozum } => {
  // Gramlı satırın adı Kütükçü örneğindeki gibi "22 ayar altın"; ziynet (adet) ürünün kendi adıyla
  const altinlar = istek.altinlar.map((a) => ({ ...a, ad: a.birimKodu === "GRM" ? kuyumSatirAdi({ ad: a.ad, milyem: a.milyem, urunTipi: a.gumus ? 2 : undefined }) : a.ad }));
  const cozum = kuyumSatisCoz(altinlar, hedef, istek.iscilikKdvOrani);
  const satirlar = kuyumUblSatirlari(cozum);
  const ozet = hesapla(satirlar);
  if (Math.abs(ozet.odenecekTutar - yuvarla(hedef)) > 0.001) {
    throw ApiError.internal(`Belge toplamı (${ozet.odenecekTutar.toFixed(2)}) banka tutarıyla (${yuvarla(hedef).toFixed(2)}) aynı çıkmadı; gönderilmedi.`);
  }
  return {
    cozum,
    girdi: {
      belgeNo: ortak.belgeNo,
      tarih: ortak.tarih,
      paraBirimi: "TRY",
      senaryo: "EARSIVFATURA",
      faturaTipi: faturaTipiKodlardan(satirlar),
      alici: ortak.alici,
      satirlar,
      notlar: kuyumNotlari(hedef, ortak.odemeNotu),
      gorunum: "KUYUM",
    },
  };
};

export interface EbankaGiderIstegi {
  altin: KuyumAltin;
  /** İşçilik satırı (EF13): verilmezse altın satırı ödenen tutarın tamamı; verilirse altın = ödenen − işçilik */
  iscilik?: number | null;
}

/** Gider pusulası satırında kuyum adı: "22 AYAR ALTIN (Milyem 916, Has 0,261 gr)" */
export const giderAltinAdi = (a: { ad: string; miktar: number; birimKodu: string; milyem?: number | null }): string => {
  const ad = trBuyuk(temiz(a.ad) || "Altın");
  const m = milyemBin(a.milyem);
  if (!m || a.birimKodu !== "GRM") return ad;
  const has = Math.round((a.miktar * m) / 1000 * 1000) / 1000;
  return `${ad} (Milyem ${m}, Has ${has.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} gr)`;
};

/**
 * Giden para → kuyum e-Gider pusulası (0003 GV stopajı %0, K23). Toplam ödenen tutara tam eşit: altın satırının birim fiyatı
 * tutardan (6 hane) bulunur, sunucu satır tutarını miktar × fiyatın kuruşa yuvarlanmışı olarak hesaplar.
 */
export const ebankaGiderGirdisi = (
  istek: EbankaGiderIstegi,
  hedef: number,
  ortak: { belgeNo: string; tarih: string; alici: UblTaraf; not?: string | null }
): Omit<GiderPusulasiGirdi, "gonderici"> => {
  const h = yuvarla(hedef);
  const a = istek.altin;
  if (!(h > 0)) throw ApiError.badRequest("Belge tutarı sıfırdan büyük olmalı.");
  if (!(a.miktar > 0)) throw ApiError.badRequest(`Altının ${a.birimKodu === "GRM" ? "gramı" : "adedi"} sıfırdan büyük olmalı.`);
  if (ortak.alici.vknTckn.length === 10) throw ApiError.badRequest("Mükellef (VKN'li) kişiden alışta belgeyi karşı taraf keser; gider pusulası düzenlenmez.");
  const iscilik = istek.iscilik == null ? 0 : yuvarla(istek.iscilik);
  if (iscilik < 0) throw ApiError.badRequest("İşçilik tutarı eksi olamaz.");
  const altinTutar = yuvarla(h - iscilik);
  if (!(altinTutar > 0)) throw ApiError.badRequest("İşçilik ödenen tutarın tamamını kaplıyor; altın satırına tutar kalmıyor.");
  const birimFiyat = Math.round((altinTutar / a.miktar) * 1e6) / 1e6;
  if (yuvarla(a.miktar * birimFiyat) !== altinTutar) throw ApiError.internal("Altın satırı tutarı kuruşu kuruşuna kurulamadı; gönderilmedi.");
  const satirlar = [
    { ad: giderAltinAdi(a), miktar: a.miktar, birimKodu: a.birimKodu, birimFiyat, vergiOrani: 0 },
    ...(iscilik > 0 ? [{ ad: trBuyuk(ISCILIK_ADI), miktar: 1, birimKodu: "C62", birimFiyat: iscilik, vergiOrani: 0 }] : []),
  ];
  return {
    belgeNo: ortak.belgeNo,
    tarih: ortak.tarih,
    belgeTipi: "SATIS",
    paraBirimi: "TRY",
    alici: ortak.alici,
    satirlar,
    vergiTuruKodu: "0003",
    notlar: temiz(ortak.not) ? [temiz(ortak.not)] : undefined,
  };
};
