/**
 * Kuyum e-Banka Faturalandırma — "Belge kes" penceresinin hesapları (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF7–EF13,
 * EF21–EF23, EF28). React'tan bağımsız. Ekrandaki işçilik / KDV canlı tahmindir; kesin hesap (kuruş çözümü dahil)
 * sunucudadır (Backend/src/services/kuyumFatura.ts), "Hazırla" sonucu gösterilir.
 */
import { KuyumKur, KuyumUrun, kuyumUrunleri, milyemBin, ziynetMi } from "../ebelge/giderKuyum";
import { ALTIN_KODU, GUMUS_KODU, kuyumFaturaTipi, kuyumKoduBul } from "../../../Backend/src/services/kuyumKodlari";

export type BelgeYonu = "gelen" | "giden";

export interface BelgeKur extends KuyumKur {
  efektifSatis?: number | null;
  dovizSatis?: number | null;
}

export interface BelgeUrun extends KuyumUrun {
  satisMilyem?: number;
}

export interface BelgeAltin {
  paraId?: number;
  ad: string;
  birim: "GRM" | "C62";
  miktar: number;
  birimFiyat: number;
  gumus?: boolean;
  /** Alış milyemi (binde) — gider pusulası satır adında "Milyem 916, Has … gr" */
  milyem?: number | null;
  /** Satış faturasında GİB kodu (EF29–EF34): ön değer altın 805, gümüş 808 */
  kod?: string;
}

export interface BelgeAlici {
  vknTckn: string;
  unvan: string;
  ad: string;
  soyad: string;
  vergiDairesi: string;
  il: string;
  ilce: string;
  adres: string;
  eposta: string;
  telefon: string;
}

export interface BelgeForm {
  alici: BelgeAlici;
  altinlar: BelgeAltin[];
  /** Satış: işçilik KDV oranı (EF11, varsayılan 20) */
  iscilikKdvOrani: number;
  /** Gider: "İşçilik ekle" (EF13, EF21) */
  iscilikEkle: boolean;
  /** Gider: işçilik tutarı; elle yazılmadıysa kalan (ödenen − altın) */
  iscilik: number;
  iscilikElle: boolean;
  /** Döviz hesap: TL karşılığı kuru (EF23) */
  kur: number;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const asagi2 = (n: number) => Math.floor((Number(n) || 0) * 100 + 1e-9) / 100;
const pozitif = (v: unknown) => (Number(v) > 0 ? Number(v) : 0);
const trBuyuk = (s: string) => String(s || "").toLocaleUpperCase("tr-TR").trim();

export const bosAlici = (): BelgeAlici => ({ vknTckn: "", unvan: "", ad: "", soyad: "", vergiDairesi: "", il: "", ilce: "", adres: "", eposta: "", telefon: "" });

export const tlHesapMi = (doviz: string | null | undefined) => ["TL", "TRY", ""].includes(trBuyuk(doviz || ""));

/** Belge tutarı (TL): TL hesapta banka tutarı, döviz hesapta tutar × kur */
export const hedefTl = (tutar: number, doviz: string | null | undefined, kur: number): number => (tlHesapMi(doviz) ? r2(tutar) : kur > 0 ? r2(tutar * kur) : 0);

/** Belgede seçilebilecek ürünler: para (döviz / TL) hariç altın, gümüş, ziynet */
export const belgeUrunleri = (urunler: BelgeUrun[]): BelgeUrun[] => kuyumUrunleri(urunler) as BelgeUrun[];

/** Ön seçim: 22 ayar gram altın (EF10) */
export const varsayilanUrun = (urunler: BelgeUrun[]): BelgeUrun | undefined => {
  const liste = belgeUrunleri(urunler).filter((u) => !ziynetMi(u));
  return liste.find((u) => trBuyuk(u.kod) === "22") || liste.find((u) => /\b22\s*AYAR/.test(trBuyuk(u.ad))) || liste.find((u) => milyemBin(u.alisMilyem) === 916) || liste[0];
};

const kurBul = (kurlar: BelgeKur[], u: { paraId?: number; kod?: string; ad?: string }) =>
  kurlar.find((k) => (u.paraId && k.paraId === u.paraId) || (!!k.kod && !!u.kod && trBuyuk(k.kod) === trBuyuk(u.kod)) || (!!k.ad && !!u.ad && trBuyuk(k.ad) === trBuyuk(u.ad)));

const satisKuru = (k?: BelgeKur) => (k ? pozitif(k.efektifSatis) || pozitif(k.dovizSatis) : 0);
const alisKuru = (k?: BelgeKur) => (k ? pozitif(k.efektifAlis) || pozitif(k.dovizAlis) : 0);
const hasKur = (kurlar: BelgeKur[], gumus: boolean, yon: BelgeYonu) => {
  const k = kurlar.find((x) =>
    gumus
      ? ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes(trBuyuk(x.kod || "")) || ["HAS GÜMÜŞ", "GÜMÜŞ", "GUMUS"].includes(trBuyuk(x.ad || ""))
      : ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes(trBuyuk(x.kod || "")) || ["HAS ALTIN", "HAS"].includes(trBuyuk(x.ad || ""))
  );
  return yon === "gelen" ? satisKuru(k) : alisKuru(k);
};

/**
 * Ürünün gram / adet fiyatı (Sarraf fişindeki kural): Anlık Fiyat Listesindeki kendi satırı (satışta efektif satış, alışta
 * efektif alış); yoksa has kuru × milyem (satışta satış milyemi). Ziynette satır yoksa null (elle girilir).
 */
export const urunFiyati = (u: BelgeUrun, kurlar: BelgeKur[], yon: BelgeYonu): number | null => {
  const satir = kurBul(kurlar, u);
  const f = yon === "gelen" ? satisKuru(satir) : alisKuru(satir);
  if (f > 0) return r2(f);
  if (ziynetMi(u)) return null;
  const gumus = Number(u.urunTipi) === 2 || /GÜMÜŞ|GUMUS/.test(trBuyuk(u.ad));
  const m = milyemBin(yon === "gelen" ? u.satisMilyem || u.alisMilyem : u.alisMilyem);
  const has = hasKur(kurlar, gumus, yon);
  return m && has > 0 ? r2((has * m) / 1000) : null;
};

/** Döviz hesabın TL kuru (EF23): gelen → döviz alış, giden → döviz satış */
export const dovizKuru = (kurlar: BelgeKur[], doviz: string, yon: BelgeYonu): number | null => {
  const k = kurlar.find((x) => trBuyuk(x.kod || "") === trBuyuk(doviz));
  if (!k) return null;
  const v = yon === "gelen" ? pozitif(k.dovizAlis) || pozitif(k.efektifAlis) : pozitif(k.dovizSatis) || pozitif(k.efektifSatis);
  return v > 0 ? v : null;
};

/** Ürün seçilince satır: ad, birim, milyem, fiyat; gram boşsa ön değer (EF9: kalan ÷ fiyat, 2 hane aşağı) */
export const urunSatiri = (u: BelgeUrun, kurlar: BelgeKur[], yon: BelgeYonu, kalan: number, eski?: BelgeAltin): BelgeAltin => {
  const ziynet = ziynetMi(u);
  const fiyat = urunFiyati(u, kurlar, yon) ?? (eski?.birimFiyat || 0);
  const birim: "GRM" | "C62" = ziynet ? "C62" : "GRM";
  let miktar = eski && eski.birim === birim && eski.miktar > 0 ? eski.miktar : 0;
  if (!miktar && fiyat > 0 && kalan > 0) miktar = ziynet ? Math.max(1, Math.floor(kalan / fiyat)) : asagi2(kalan / fiyat);
  return {
    paraId: u.paraId,
    ad: u.ad,
    birim,
    miktar,
    birimFiyat: fiyat,
    gumus: Number(u.urunTipi) === 2 || /GÜMÜŞ|GUMUS/.test(trBuyuk(u.ad)),
    milyem: ziynet ? null : milyemBin(u.alisMilyem),
    kod: eski?.kod && eski.kod !== ALTIN_KODU && eski.kod !== GUMUS_KODU ? eski.kod : Number(u.urunTipi) === 2 || /GÜMÜŞ|GUMUS/.test(trBuyuk(u.ad)) ? GUMUS_KODU : ALTIN_KODU,
  };
};

export const altinTutari = (a: Pick<BelgeAltin, "miktar" | "birimFiyat">) => r2(a.miktar * a.birimFiyat);
export const altinToplami = (altinlar: BelgeAltin[]) => r2(altinlar.reduce((t, a) => t + altinTutari(a), 0));

/** Satış tahmini (EF8): işçilik KDV dahil = hedef − altın; KDV hariç ≈ ÷ (1 + oran) */
export const satisTahmini = (f: Pick<BelgeForm, "altinlar" | "iscilikKdvOrani">, hedef: number) => {
  const altin = altinToplami(f.altinlar);
  const kalan = r2(hedef - altin);
  const matrah = kalan > 0 ? r2(kalan / (1 + (Number(f.iscilikKdvOrani) || 0) / 100)) : 0;
  return { altin, kalan, matrah, kdv: kalan > 0 ? r2(kalan - matrah) : 0, asim: kalan < 0 };
};

/** Gider tahmini (EF13): işçilik seçilmezse altın = ödenen; seçilirse işçilik kalan (ya da elle), altın = ödenen − işçilik */
export const giderTahmini = (f: Pick<BelgeForm, "altinlar" | "iscilikEkle" | "iscilik" | "iscilikElle">, hedef: number) => {
  if (!f.iscilikEkle) return { altin: r2(hedef), iscilik: 0 };
  const iscilik = f.iscilikElle ? r2(f.iscilik) : Math.max(0, r2(hedef - altinToplami(f.altinlar.slice(0, 1))));
  return { altin: r2(hedef - iscilik), iscilik };
};

/** Gönderimden önce ekrandaki eksikler */
export const formHatalari = (f: BelgeForm, yon: BelgeYonu, hedef: number, dovizHesap: boolean): string[] => {
  const h: string[] = [];
  const kimlik = f.alici.vknTckn.replace(/\D/g, "");
  if (!/^\d{10}$|^\d{11}$/.test(kimlik)) h.push(`${yon === "gelen" ? "Alıcının" : "Satıcının"} TC kimlik no (11 hane) ya da VKN'si (10 hane) girilmeli.`);
  if (kimlik.length === 11 && !(f.alici.ad.trim() && f.alici.soyad.trim()) && f.alici.unvan.trim().split(/\s+/).length < 2) h.push("Ad ve soyad girilmeli.");
  if (kimlik.length === 10 && !f.alici.unvan.trim()) h.push("Unvan girilmeli.");
  if (yon === "giden" && kimlik.length === 10) h.push("Mükellef (VKN'li) kişiden alışta belgeyi karşı taraf keser; gider pusulası kesilmez.");
  if (dovizHesap && !(f.kur > 0)) h.push("TL karşılığı için kur girilmeli.");
  if (!(hedef > 0)) h.push("Belge tutarı hesaplanamadı.");
  if (!f.altinlar.length) h.push("En az bir altın satırı girilmeli.");
  f.altinlar.forEach((a, i) => {
    const n = f.altinlar.length > 1 ? `${i + 1}. satır: ` : "";
    if (!a.ad.trim()) h.push(`${n}altın seçilmeli.`);
    if (!(a.miktar > 0)) h.push(`${n}${a.birim === "GRM" ? "gram" : "adet"} girilmeli.`);
    if (!(a.birimFiyat > 0)) h.push(`${n}fiyat girilmeli.`);
    if (yon === "gelen" && !(a.kod || "").trim()) h.push(`${n}KDV kodu seçilmeli (dürbünden).`);
    if (yon === "gelen" && (a.kod || "").trim() && !kuyumKoduBul(a.kod)) h.push(`${n}KDV kodu kuyumculuk kodlarından olmalı.`);
  });
  if (yon === "gelen" && f.altinlar.length && !kuyumFaturaTipi(f.altinlar.map((a) => a.kod || ""))) {
    h.push("Özel matrah kodu (805 / 808) ile istisna kodu (230, 231 …) aynı faturada olamaz.");
  }
  if (yon === "gelen") {
    const t = satisTahmini(f, hedef);
    if (t.asim) h.push(`Altın tutarı (${t.altin.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}) belge tutarını aşıyor; gramı ya da fiyatı düşürün.`);
    if (!(f.iscilikKdvOrani >= 0 && f.iscilikKdvOrani <= 100)) h.push("İşçilik KDV oranı 0 ile 100 arasında olmalı.");
  } else {
    const t = giderTahmini(f, hedef);
    if (t.iscilik < 0) h.push("İşçilik eksi olamaz.");
    if (!(t.altin > 0)) h.push("İşçilik ödenen tutarın tamamını kaplıyor.");
  }
  return h;
};

/** Sunucuya giden istek (Backend ebankaBelge.service.ts ebankaBelgeSemasi) */
export const belgeIstegi = (f: BelgeForm, vomsisId: number, yon: BelgeYonu, hedef: number, dovizHesap: boolean) => {
  const kimlik = f.alici.vknTckn.replace(/\D/g, "");
  const altin = (a: BelgeAltin) => ({ ad: a.ad.trim(), miktar: a.miktar, birimKodu: a.birim, birimFiyat: r2(a.birimFiyat), gumus: !!a.gumus, milyem: a.milyem ?? null, kod: (a.kod || "").trim() || null });
  const g = giderTahmini(f, hedef);
  return {
    vomsisId,
    kur: dovizHesap ? f.kur : null,
    alici: {
      vknTckn: kimlik,
      unvan: f.alici.unvan.trim(),
      ad: f.alici.ad.trim(),
      soyad: f.alici.soyad.trim(),
      vergiDairesi: f.alici.vergiDairesi.trim(),
      il: f.alici.il.trim(),
      ilce: f.alici.ilce.trim(),
      adres: f.alici.adres.trim(),
      eposta: f.alici.eposta.trim(),
      telefon: f.alici.telefon.trim(),
    },
    ...(yon === "gelen"
      ? { satis: { altinlar: f.altinlar.map(altin), iscilikKdvOrani: Number(f.iscilikKdvOrani) || 0 } }
      : { gider: { altin: altin(f.altinlar[0]), iscilik: f.iscilikEkle && g.iscilik > 0 ? g.iscilik : null } }),
  };
};
