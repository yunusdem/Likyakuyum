import { VERGI_DAIRELERI, VergiDairesiKaydi } from "./vergiDaireleriVeri.js";

/**
 * GİB'in verdiği vergi dairesinden il / ilçe (docs/GIB_BUTON_IL_ILCE_YOL_HARITASI.md K4).
 * Aynı adlı daire birden çok ilde varsa firmanın kendi ili seçilir; yine çözülmezse il / ilçe boş + uyarı.
 */

export interface VdIlIlce {
  il: string;
  ilce: string;
  /** Bulunan dairenin GİB kodu (ör. 034272) */
  vdKodu: string | null;
  /** Doldurulamayan alan için kullanıcıya gösterilecek kısa uyarı */
  uyari: string | null;
}

const trBuyuk = (s: string | null | undefined) => String(s ?? "").toLocaleUpperCase("tr-TR");

/** "KADIKÖY VERGİ DAİRESİ MÜD.", "Kadıköy V.D.", "KADIKÖY" aynı; "BOĞAZİÇİ KUR." = "BOĞAZİÇİ KURUMLAR" */
export const vdAdiNormalize = (s: string | null | undefined): string =>
  trBuyuk(s)
    .replace(/[.,/()-]/g, " ")
    // \b Türkçe harfte çalışmaz; sınır boşlukla aranır
    .replace(/(^|\s)VERG[İI] DA[İI]RES[İI](?=\s|$)/g, " ")
    .replace(/(^|\s)(V\s?D|MAL MÜDÜRLÜĞÜ|MALMÜDÜRLÜĞÜ|MÜDÜRLÜĞÜ|MÜD|MD)(?=\s|$)/g, " ")
    .replace(/(^|\s)KUR(?=\s|$)/g, " KURUMLAR")
    .replace(/\s+/g, " ")
    .trim();

/** İl adı karşılaştırması: büyük harf, "34 - İSTANBUL" gibi plaka önekleri atılır */
const ilNormalize = (s: string | null | undefined) => trBuyuk(s).replace(/^\s*\d+\s*-\s*/, "").replace(/\s+/g, " ").trim();

const NORMAL = VERGI_DAIRELERI.map((k) => ({ k, n: vdAdiNormalize(k.ad) }));

/** Daire adından (ya da 6 haneli koddan) aday kayıtlar: önce birebir, yoksa içerme (en az 4 harf) */
export const vergiDairesiAdaylari = (girdi: string | null | undefined): VergiDairesiKaydi[] => {
  const ham = String(girdi ?? "").trim();
  const kod = ham.match(/^\d{6}$/)?.[0] ?? ham.match(/\((\d{6})\)/)?.[1];
  if (kod) {
    const k = VERGI_DAIRELERI.find((x) => x.kod === kod);
    if (k) return [k];
  }
  const n = vdAdiNormalize(ham);
  if (!n) return [];
  const birebir = NORMAL.filter((x) => x.n === n).map((x) => x.k);
  if (birebir.length) return birebir;
  if (n.length < 4) return [];
  return NORMAL.filter((x) => x.n.length >= 4 && (x.n.includes(n) || n.includes(x.n))).map((x) => x.k);
};

export const vergiDairesiIlIlce = (vergiDairesi: string | null | undefined, firmaIli?: string | null): VdIlIlce => {
  if (!String(vergiDairesi ?? "").trim()) return { il: "", ilce: "", vdKodu: null, uyari: null };
  let adaylar = vergiDairesiAdaylari(vergiDairesi);
  if (adaylar.length > 1) {
    const fi = ilNormalize(firmaIli);
    const firmadakiler = fi ? adaylar.filter((a) => ilNormalize(a.il) === fi) : [];
    if (firmadakiler.length) adaylar = firmadakiler;
  }
  if (!adaylar.length) {
    return { il: "", ilce: "", vdKodu: null, uyari: "Vergi dairesinin ili bulunamadı; il ve ilçeyi girin." };
  }
  const iller = new Set(adaylar.map((a) => a.ilKodu));
  if (iller.size > 1) {
    return { il: "", ilce: "", vdKodu: null, uyari: "Bu adda vergi dairesi birden çok ilde var; il ve ilçeyi girin." };
  }
  // Aynı ilde birden çok aday (içerme eşleşmesi): il kesin, ilçe yalnız hepsinde aynıysa
  const ilceler = new Set(adaylar.map((a) => a.ilce));
  const ilce = ilceler.size === 1 ? adaylar[0].ilce : "";
  return {
    il: adaylar[0].il,
    ilce,
    vdKodu: adaylar.length === 1 ? adaylar[0].kod : null,
    uyari: ilce ? null : "İlçe vergi dairesinden çıkarılamadı; ilçeyi girin.",
  };
};
