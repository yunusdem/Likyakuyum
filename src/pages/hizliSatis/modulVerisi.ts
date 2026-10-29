import { KurService } from "../../services/kurService";
import { SarrafFisService, UrunItem } from "../../services/sarrafFisService";
import { AktifKampanya, StokKart, TicariService, kartSatisFiyati } from "../../services/ticariService";
import { kampanyaSec } from "../../../Backend/src/services/ticari/ticariHesap";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { CompanyService } from "../../services/companyService";
import { StatisticItem, StatisticService } from "../../services/statisticService";
import { HizliSatisButon } from "../../services/hizliSatisService";
import { HizliSatisModul, URUN_TURU, paraUygunMu as paraUygun } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";
import {
  KmvSekli,
  KurSatiri,
  SepetSatiri,
  adetliMi,
  dovizOranlari,
  kurlariBirlestir,
  urunKuru,
} from "../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import { kartDahilFiyat } from "../../../Backend/src/services/ticari/ticariHesap";

/**
 * Hızlı Satış modül verisi ve satır oluşturma (docs/HIZLI_SATIS_YOL_HARITASI.md, U4–U7). Kur, ürün, istatistik ve vezne
 * fiş ekranlarındaki kaynaklardan aynı sırayla okunur.
 */

export interface ModulVerisi {
  modul: HizliSatisModul;
  kurlar: KurSatiri[];
  paralar: UrunItem[];
  kartlar: Map<number, StokKart>;
  vezne: VezneItem | null;
  istatistikler: StatisticItem[];
  tanim: any;
  kmvSekli: KmvSekli;
  /** Ticari: seçili fiyat listesi (İş 11, G7); kayıtlı müşterinin varsayılanı, yoksa ana */
  fiyatListesiId?: number | null;
  /** Ticari: yürürlükteki kampanyalar (İş 11, G12) */
  kampanyalar?: AktifKampanya[];
}

let sayac = 0;
export const satirAnahtari = () => `s${Date.now().toString(36)}${++sayac}`;

const kurOku = (r: any): KurSatiri => ({
  paraId: Number(r.paraId),
  kod: String(r.kod || "").trim(),
  ad: r.ad,
  dovizAlis: r.dovizAlis ?? null,
  dovizSatis: r.dovizSatis ?? null,
  efektifAlis: r.efektifAlis ?? null,
  efektifSatis: r.efektifSatis ?? null,
});

export async function kurlariGetir(yenile = false): Promise<KurSatiri[]> {
  const [g, a] = await Promise.all([
    KurService.getKurTablosu({ tur: 1, forceRefresh: yenile }).catch(() => null),
    KurService.getKurTablosu({ tur: 0, forceRefresh: yenile }).catch(() => null),
  ]);
  return kurlariBirlestir((g?.satirlar || []).map(kurOku), (a?.satirlar || []).map(kurOku));
}

/** Kullanıcının veznesi (Sarraf/Perakende fişindeki sıra): kullanıcı kartı → kasiyer kodu → ilk vezne */
export async function vezneBul(kullaniciId: number | undefined, kasiyerKodu?: string | null): Promise<VezneItem | null> {
  const liste = await CashDeskService.getVezneler().catch(() => [] as VezneItem[]);
  if (!liste.length) return null;
  const id = kullaniciId ? await SarrafFisService.getUserVezneId(kullaniciId).catch(() => null) : null;
  const k = String(kasiyerKodu || "").trim();
  return liste.find((v) => id && v.id === id) || liste.find((v) => k && (String(v.id) === k || String(v.kod).trim() === k)) || liste[0];
}

/** Varsayılan istatistik (Sarraf/Döviz fişi): Firma Tanımları → kullanıcı kodu → fiş tipine uyan ilk kayıt */
export function varsayilanIstatistik(liste: StatisticItem[], tanim: any, tip: 0 | 1, kullaniciKodu?: string | null): StatisticItem | null {
  const uyar = (s: StatisticItem) => (tip === 1 ? s.fisTipi === 1 || s.fisTipi === 2 : s.fisTipi === 0 || s.fisTipi === 2);
  const tanimId = Number(tip === 1 ? tanim?.SATIS_ISTATISTIK_ID : tanim?.ALIS_ISTATISTIK_ID);
  const t = tanimId ? liste.find((s) => s.id === tanimId) : undefined;
  if (t) return t;
  const k = String(kullaniciKodu || "").trim();
  const u = k ? liste.find((s) => String(s.kod || "").trim() === k && uyar(s)) : undefined;
  if (u) return u;
  return liste.find(uyar) || null;
}

export const gayriResmiMi = (s: StatisticItem | null | undefined) => Number(s?.fisDizaynTipi) === 1;

/**
 * Modül verisi. Ticari'de tam kart listesi çekilmez (G2): yalnız düzen butonlarındaki kartlar kimlikle alınır (kartIdler);
 * barkod okutma ve bekleyen sepet eksik kartı sunucudan tek tek / kimlikle getirir.
 */
export async function modulVerisiYukle(modul: HizliSatisModul, kullanici: { id?: number; cashierCode?: string | null }, kartIdler: number[] = []): Promise<ModulVerisi> {
  const [kurlar, vezne, tanim] = await Promise.all([
    modul === "ticari" ? kurlariGetir().catch(() => []) : kurlariGetir(),
    vezneBul(kullanici.id, kullanici.cashierCode),
    CompanyService.getDefinitions().catch(() => null),
  ]);
  const paralar = modul === "ticari" ? [] : await SarrafFisService.getUrunler();
  const kartlar = new Map<number, StokKart>();
  if (modul === "ticari" && kartIdler.length) for (const k of await TicariService.kartlar({ idler: kartIdler, aktif: true })) kartlar.set(k.stokKartId, k);
  const istatistikler = modul === "sarraf" || modul === "doviz" || modul === "perakende" ? await StatisticService.getStatistics().catch(() => []) : [];
  const kampanyalar = modul === "ticari" ? await TicariService.aktifKampanyalar().catch(() => [] as AktifKampanya[]) : [];
  const s = Number((tanim as any)?.KMV_UYGULAMA_SEKLI);
  return { modul, kurlar, paralar, kartlar, vezne, istatistikler, tanim, kmvSekli: (s === 1 || s === 2 || s === 3 ? s : 3) as KmvSekli, kampanyalar };
}

/** Butondan satır taslağı. fiyat 0 dönerse ekran fiyat sorar; gramli ürünse miktar sorulur (eksikMiktar). */
export interface SatirTaslagi {
  satir: SepetSatiri;
  /** Gram girilmeli (tuş takımında değer yoksa ekran sorar) */
  gramGerekli: boolean;
  /** Fiyat/kur bulunamadı: ekran sorar */
  fiyatGerekli: boolean;
}

export function butondanSatir(b: HizliSatisButon, v: ModulVerisi, tip: 0 | 1, istatistik: StatisticItem | null): SatirTaslagi | string {
  if (b.gecersiz) return `"${b.ad}" butonunun ürünü bulunamadı ya da pasif. Hızlı Satış Düzeni'nden düzeltin.`;
  if (b.urunTuru === URUN_TURU.SERBEST) {
    const fiyat = Number(b.fiyat) || 0;
    return {
      satir: { anahtar: satirAnahtari(), ad: b.ad, tur: "serbest", miktar: 1, birim: "Adet", birimFiyat: fiyat, kdvOrani: Number(b.kdvOrani ?? 20) },
      gramGerekli: false,
      fiyatGerekli: !(fiyat > 0),
    };
  }
  if (b.urunTuru === URUN_TURU.STOK) {
    const k = b.urunId ? v.kartlar.get(b.urunId) : undefined;
    if (!k) return `"${b.ad}" stok kartı bulunamadı ya da pasif.`;
    let fiyat = b.ozelFiyat !== null && b.ozelFiyat !== undefined ? Number(b.ozelFiyat) : kartDahilFiyat(kartSatisFiyati(k), k.kdvOrani, k.fiyatKdvDahil);
    if (b.ozelFiyat === null && k.paraId && !["TL", "TRY"].includes(String(k.paraKodu || "").trim().toUpperCase())) {
      const kur = urunKuru(v.kurlar, { paraId: k.paraId, kod: k.paraKodu }, 1);
      fiyat = kur > 0 ? Math.round(fiyat * kur * 100) / 100 : 0;
    }
    return {
      satir: kampanyaIsle({ anahtar: satirAnahtari(), ad: b.ozelAd || k.ad, kod: k.kod, tur: "stok", urunId: k.stokKartId, miktar: 1, birim: k.birim || "Adet", birimFiyat: fiyat, kdvOrani: Number(k.kdvOrani) || 0, ek: { stokKartId: k.stokKartId } }, v),
      gramGerekli: false,
      fiyatGerekli: !(fiyat > 0),
    };
  }
  // Ürün Tanımı / döviz
  const p = v.paralar.find((x) => x.paraId === b.urunId);
  if (!p) return `"${b.ad}" ürün tanımı bulunamadı.`;
  return paradanSatir(p, b.ozelAd || p.ad, v, tip, istatistik);
}

export function paradanSatir(p: UrunItem, ad: string, v: ModulVerisi, tip: 0 | 1, istatistik: StatisticItem | null): SatirTaslagi {
  const adetli = adetliMi(p.urunTipi);
  const kur = urunKuru(v.kurlar, { paraId: p.paraId, kod: p.kod, urunTipi: p.urunTipi }, tip);
  const temel: SepetSatiri = {
    anahtar: satirAnahtari(),
    ad,
    kod: p.kod,
    tur: "para",
    urunId: p.paraId,
    urunTipi: p.urunTipi ?? 0,
    miktar: adetli ? 1 : 0,
    birim: v.modul === "doviz" ? p.kod : adetli ? "Adet" : "Gram",
    birimFiyat: kur,
    kdvOrani: 0,
    ek: {},
  };
  if (v.modul === "perakende") {
    temel.ek = { ayar: p.kod, gram: adetli ? Number(p.gramaj) || 0 : 0, hasGram: Number(p.hasOrani) || 0 };
  } else if (v.modul === "sarraf") {
    temel.ek = { milyem: adetli ? 0 : tip === 1 ? p.satisMilyem : p.alisMilyem, iscilik: adetli ? 0 : Number(p.iscilik) || 0 };
  } else if (v.modul === "doviz") {
    temel.ek = dovizOranlari(istatistik, tip, v.kmvSekli);
  }
  return { satir: temel, gramGerekli: !adetli, fiyatGerekli: !(kur > 0) };
}

/** Alış/Satış değişince satırın kuru ve oranları yeniden (elle fiyat verilmişse fiyat korunur) */
export function satiriYenidenFiyatla(s: SepetSatiri, v: ModulVerisi, tip: 0 | 1, istatistik: StatisticItem | null): SepetSatiri {
  if (s.tur !== "para") return s;
  const p = v.paralar.find((x) => x.paraId === s.urunId);
  if (!p) return s;
  const t = paradanSatir(p, s.ad, v, tip, istatistik).satir;
  return { ...s, birimFiyat: s.fiyatElle ? s.birimFiyat : t.birimFiyat, ek: { ...s.ek, ...t.ek } };
}

/** Stok kartından satır taslağı (barkod okutma, Ara penceresi, olmayan barkoddan açılan kart); kart yerel listeye de eklenir */
export function karttanSatir(k: StokKart, v: ModulVerisi, tip: 0 | 1, istatistik: StatisticItem | null): SatirTaslagi | string {
  if (!v.kartlar.has(k.stokKartId)) v.kartlar.set(k.stokKartId, k);
  return butondanSatir({ butonId: 0, sira: 0, urunTuru: URUN_TURU.STOK, urunId: k.stokKartId, ad: k.ad, ozelAd: null, urunKodu: k.kod, urunAdi: k.ad, urunTipi: null, birim: k.birim, renk: null, fiyat: null, ozelFiyat: null, kdvOrani: k.kdvOrani, gecersiz: false, resimVar: false }, v, tip, istatistik);
}

/** Satıra yürürlükteki kampanyayı işler (İş 11, G12): en yüksek indirim; kapsayan yoksa kampanya kaldırılır */
export function kampanyaIsle(s: SepetSatiri, v: ModulVerisi): SepetSatiri {
  if (s.tur !== "stok" || !s.urunId) return s;
  const k = v.kartlar.get(Number(s.urunId));
  const sec = kampanyaSec(v.kampanyalar || [], { stokKartId: Number(s.urunId), stokGrupId: k?.stokGrupId ?? null }, s.birimFiyat);
  const kampanya = sec ? { kampanyaId: sec.kampanya.kampanyaId, ad: sec.kampanya.ad, turu: sec.kampanya.tur, deger: sec.kampanya.deger } : null;
  return { ...s, ek: { ...s.ek, kampanya } };
}

/** "3*8690001" → { adet: 3, kod: "8690001" } */
export const barkodCoz = (girdi: string): { adet: number; kod: string } => {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*\*\s*(.+)$/.exec(girdi);
  if (m) {
    const a = Number(m[1].replace(",", "."));
    return { adet: a > 0 ? a : 1, kod: m[2].trim() };
  }
  return { adet: 1, kod: girdi.trim() };
};

/**
 * Barkod / kod okutma (H7: barkodlu tekil altın buton olmaz, buradan okutulur). Perakende: barkodlu altın/özel ürün ya da
 * ürün tanımı kodu; Ticari: stok kartı barkodu/kodu; Sarraf/Döviz: ürün tanımı kodu.
 */
export async function barkoddanSatir(girdi: string, v: ModulVerisi, tip: 0 | 1, istatistik: StatisticItem | null): Promise<SatirTaslagi | string> {
  const { adet, kod } = barkodCoz(girdi);
  if (!kod) return "Barkod ya da kod yazın.";
  const kodBuyuk = kod.toLocaleUpperCase("tr-TR");
  const para = v.paralar.find((p) => String(p.kod).trim().toLocaleUpperCase("tr-TR") === kodBuyuk);

  if (v.modul === "ticari") {
    // Liste seçiliyse yerel kopya kullanılmaz: fiyat o listeden sunucudan alınır
    const k = (!v.fiyatListesiId ? [...v.kartlar.values()].find((x) => x.aktif && (x.kod.toLocaleUpperCase("tr-TR") === kodBuyuk || x.barkodlar.includes(kod))) : undefined) || (await TicariService.kartBul(kod, v.fiyatListesiId));
    if (!k) return `"${kod}" barkodlu ya da kodlu stok kartı bulunamadı.`;
    if (!k.aktif) return `"${k.ad}" stok kartı pasif.`;
    const t = karttanSatir(k, v, tip, istatistik);
    if (typeof t !== "string") t.satir.miktar = adet;
    return t;
  }

  if (v.modul === "perakende" && !para) {
    try {
      const { PerakendeService } = await import("../../services/perakendeService");
      const u = await PerakendeService.getProductByBarcode(kod);
      if (u?.satildi) return `"${kod}" barkodlu ürün satılmış.`;
      if (u && (u.altinUrunId || u.barkod)) {
        // Alışta (Perakende) satış fiyatı geçmez: alış fiyatı sorulur
        const fiyat = tip === 1 ? Number(u.satisFiyati) || 0 : 0;
        return {
          satir: {
            anahtar: satirAnahtari(), ad: u.urunAdi || "Altın Ürün", kod: u.barkod || kod, tur: "barkod", miktar: 1, birim: u.birim || "Adet",
            birimFiyat: fiyat, kdvOrani: Number(u.kdvOrani) || 0,
            ek: { altinUrunId: u.altinUrunId || null, barkod: u.barkod || kod, ayar: u.ayar || null, gram: Number(u.gram) || 0, hasGram: Number(u.hasGram) || 0 },
          },
          gramGerekli: false,
          fiyatGerekli: !(fiyat > 0),
        };
      }
    } catch (e: any) {
      return e?.message || `"${kod}" barkodlu ürün bulunamadı.`;
    }
  }

  if (!para || !paraUygun(v.modul, para)) return `"${kod}" kodlu ürün bulunamadı.`;
  const t = paradanSatir(para, para.ad, v, tip, istatistik);
  if (!t.gramGerekli) t.satir.miktar = adet;
  else if (girdi.includes("*")) { t.satir.miktar = adet; t.gramGerekli = false; }
  return t;
}
