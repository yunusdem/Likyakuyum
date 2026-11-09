/**
 * e-Banka toplu Sarraf fişi (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md T1–T9). Saf: React / API içe aktarmaz, tsx ile sınanır.
 *
 * Sarraf fişi ekranının kurallarının kopyasıdır; ekrandaki karşılıkları SarrafFisiPage.tsx'te:
 *   kurlariBirlestir → loadLookupsAndData (anlık + günlük kur birleştirme) · hasKurlari → getHasKurAlisSatis · gumusKuru → getGumusKurForTip
 *   urunKuru → getKurForProduct · urunMilyemi → getMilyemForProduct · varsayilanIstatistik → getDefaultStatistic
 *   masakSiniriAsildi → masakStatus · kayitVerisi → handleSave (satır ve ödeme eşlemesi) · varsayilanVezne → getUserVezne
 * O kurallar değişirse burası da güncellenmeli. Toplu kesimde yalnız altın / gümüş ürün seçilir (ziynet, döviz yok).
 */

export interface TfKur {
  paraId?: number | null;
  kod?: string | null;
  ad?: string | null;
  efektifAlis?: number | null;
  efektifSatis?: number | null;
  dovizAlis?: number | null;
  dovizSatis?: number | null;
  parite?: number | null;
  urunTipi?: number | null;
}

export interface TfUrun {
  id?: number;
  paraId?: number;
  kod?: string;
  ad?: string;
  urunTipi?: number;
  hasOrani?: number;
  alisMilyem?: number;
  satisMilyem?: number;
  hasAlisKatsayisi?: number;
  hasSatisKatsayisi?: number;
}

export interface TfIstatistik {
  id: number | null;
  kod: string;
  fisTipi?: number;
  fisDizaynTipi?: number;
}

const buyuk = (s?: string | null) => (s || "").toUpperCase().trim();
const sayi = (v: unknown) => Number(v) || 0;

/** Günlük (TUR 1) üzerine anlık (TUR 0) kur; anlıkta boş olan alan günlükten kalır */
export function kurlariBirlestir(gunluk: TfKur[], anlik: TfKur[]): TfKur[] {
  const anahtar = (k: TfKur) => (k.kod ? buyuk(k.kod) : k.paraId ? `ID_${k.paraId}` : k.ad ? buyuk(k.ad) : "");
  const m = new Map<string, TfKur>();
  for (const k of gunluk || []) {
    const a = anahtar(k);
    if (a) m.set(a, k);
  }
  const dolu = (v: unknown) => v !== null && v !== undefined && Number(v) > 0;
  for (const k of anlik || []) {
    const a = anahtar(k);
    if (!a) continue;
    const e = m.get(a);
    m.set(a, {
      ...e,
      ...k,
      efektifAlis: dolu(k.efektifAlis) ? k.efektifAlis : e?.efektifAlis ?? null,
      efektifSatis: dolu(k.efektifSatis) ? k.efektifSatis : e?.efektifSatis ?? null,
      dovizAlis: dolu(k.dovizAlis) ? k.dovizAlis : e?.dovizAlis ?? null,
      dovizSatis: dolu(k.dovizSatis) ? k.dovizSatis : e?.dovizSatis ?? null,
      parite: k.parite ?? e?.parite ?? null,
    });
  }
  return Array.from(m.values());
}

/** Has altın kuru (alış / satış): efektif yoksa döviz kuru, biri yoksa öteki; kur satırı yoksa yedek (ekranın Has Kuru kutusu) */
export function hasKurlari(kurlar: TfKur[], yedek = 0): { alis: number; satis: number } {
  const k = kurlar.find((x) =>
    ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes(buyuk(x.kod)) ||
    (x.ad && ["HAS ALTIN", "HAS"].includes(buyuk(x.ad))) ||
    buyuk(x.kod).startsWith("HAS") ||
    buyuk(x.ad).startsWith("HAS"));
  if (k) {
    const alis = sayi(k.efektifAlis) > 0 ? sayi(k.efektifAlis) : sayi(k.dovizAlis);
    const satis = sayi(k.efektifSatis) > 0 ? sayi(k.efektifSatis) : sayi(k.dovizSatis);
    if (alis > 0 || satis > 0) return { alis: alis > 0 ? alis : satis, satis: satis > 0 ? satis : alis };
  }
  return { alis: yedek, satis: yedek };
}

export const hasKuru = (kurlar: TfKur[], tip: 0 | 1, yedek = 0) => (tip === 0 ? hasKurlari(kurlar, yedek).alis : hasKurlari(kurlar, yedek).satis);

/** Has gümüş kuru (getGumusKurForTip) */
export function gumusKuru(kurlar: TfKur[], tip: 0 | 1, yedek = 0): number {
  const k = kurlar.find((x) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes(buyuk(x.kod)) || (x.ad && ["HAS GÜMÜŞ", "GÜMÜŞ", "GUMUS"].includes(buyuk(x.ad))));
  if (k) {
    const r = tip === 0 ? (sayi(k.efektifAlis) > 0 ? sayi(k.efektifAlis) : sayi(k.dovizAlis)) : (sayi(k.efektifSatis) > 0 ? sayi(k.efektifSatis) : sayi(k.dovizSatis));
    if (r > 0) return r;
  }
  return yedek;
}

const gumusMu = (u: TfUrun) => {
  const kod = buyuk(u.kod), ad = buyuk(u.ad);
  return u.urunTipi === 2 || kod.includes("GUMUS") || kod.includes("GÜMÜŞ") || ad.includes("GÜMÜŞ") || ad.includes("GUMUS");
};

/** Satır kuru (getKurForProduct): ürünün kendi kur satırı (alışta efektif / döviz alış, satışta satış), yoksa gümüş ya da has kuru */
export function urunKuru(u: TfUrun, kurlar: TfKur[], tip: 0 | 1, yedek: { has?: number; gumus?: number } = {}): number {
  const pId = u.paraId ?? u.id;
  const kod = buyuk(u.kod), ad = buyuk(u.ad);
  if (kod === "TL" || kod === "TRY" || kod === "TRL") return 1;
  const k = kurlar.find((x) => (pId && x.paraId === pId) || (kod && x.kod && buyuk(x.kod) === kod) || (ad && x.ad && buyuk(x.ad) === ad));
  if (k) {
    const r = tip === 0 ? (sayi(k.efektifAlis) > 0 ? sayi(k.efektifAlis) : sayi(k.dovizAlis)) : (sayi(k.efektifSatis) > 0 ? sayi(k.efektifSatis) : sayi(k.dovizSatis));
    if (r > 0) return r;
  }
  if (gumusMu(u)) return gumusKuru(kurlar, tip, yedek.gumus);
  return hasKuru(kurlar, tip, yedek.has);
}

/** Satırın "has kuru" (applyProductToRow curHasKuru): gümüşte gümüş, altında has altın kuru */
export const satirHasKuru = (u: TfUrun, urunTipi: number, kurlar: TfKur[], tip: 0 | 1) => (urunTipi === 2 ? gumusKuru(kurlar, tip) : hasKuru(kurlar, tip));

/** Ürün milyemi (getMilyemForProduct): alışta alış milyemi / has alış katsayısı / has oranı, satışta satış karşılıkları; yoksa "" */
export function urunMilyemi(u: TfUrun, tip: 0 | 1): number | "" {
  const alis = sayi(u.alisMilyem) > 0 ? u.alisMilyem : sayi(u.hasAlisKatsayisi) > 0 ? u.hasAlisKatsayisi : u.hasOrani;
  const satis = sayi(u.satisMilyem) > 0 ? u.satisMilyem : sayi(u.hasSatisKatsayisi) > 0 ? u.hasSatisKatsayisi : u.hasOrani;
  const v = tip === 0 ? alis : satis;
  return sayi(v) > 0 ? Number(v) : "";
}

/** Varsayılan istatistik (getDefaultStatistic): kullanıcının alış / satış istatistiği, firma tanımı, fiş tipine uyan ilk kayıt */
export function varsayilanIstatistik(
  tip: 0 | 1, liste: TfIstatistik[], tanim: Record<string, any> | null | undefined, kullanici: { buyStatCode?: string | null; sellStatCode?: string | null } | null | undefined
): TfIstatistik | undefined {
  if (!liste || !liste.length) return undefined;
  const kod = tip === 0 ? kullanici?.buyStatCode : kullanici?.sellStatCode;
  if (kod && kod.trim()) {
    const k = kod.trim().toLowerCase();
    return liste.find((s) => (s.kod && s.kod.toLowerCase() === k) || String(s.id) === k) || { id: null, kod: kod.trim(), fisTipi: tip, fisDizaynTipi: 0 };
  }
  if (tanim) {
    const id = tip === 0 ? tanim.ALIS_ISTATISTIK_ID : tanim.SATIS_ISTATISTIK_ID;
    if (id) {
      const k = String(id).trim().toLowerCase();
      const f = liste.find((s) => String(s.id).trim() === k || (s.kod && s.kod.trim().toLowerCase() === k));
      if (f) return f;
    }
  }
  return liste.find((s) => (tip === 0 ? [0, 2] : [1, 2]).includes(Number(s.fisTipi))) || liste[0];
}

/** Cari kartında tanımlı alış / satış istatistiği (handleSelectCustomer), yoksa varsayılan */
export function fisIstatistigi(
  tip: 0 | 1, cari: { alisIstatistikId?: unknown; satisIstatistikId?: unknown } | null | undefined, liste: TfIstatistik[], varsayilan: TfIstatistik | undefined
): TfIstatistik | undefined {
  const id = Number(tip === 0 ? cari?.alisIstatistikId : cari?.satisIstatistikId) || 0;
  return (id && liste.find((s) => s.id === id)) || varsayilan;
}

/** Veznesi (getUserVezne): kullanıcıya bağlı vezne, yoksa kasiyer kodu, yoksa ilk vezne */
export function varsayilanVezne<T extends { id: number; kod: string }>(liste: T[], kullaniciVezneId: number | null | undefined, kasiyerKodu?: string | null): T | undefined {
  if (!liste.length) return undefined;
  if (kullaniciVezneId) {
    const v = liste.find((x) => x.id === kullaniciVezneId);
    if (v) return v;
  }
  const t = String(kasiyerKodu || "").trim();
  if (t) {
    const m = liste.find((v) => String(v.id) === t || v.kod.trim() === t) || (!isNaN(Number(t)) ? liste.find((v) => v.id === Number(t)) : undefined);
    if (m) return m;
  }
  return liste[0];
}

// ─── MASAK bildirim sınırı (masakStatus) ─────────────────────────────────────

export interface TfMasakKalemi { paraId?: number | null; kod: string; ad: string; urunTipi?: number; miktar: number; kur: number; tutar: number; hasGram: number }

/**
 * Fişin MASAK bildirim sınırını aşıp aşmadığı (masakStatus ile aynı hesap): altın kalemleri Altın Vergi Sınırı × sınır parasının kuru,
 * döviz kalemleri Döviz Vergi Sınırı, TL kalemleri TL Vergi Sınırı. Aşılınca kayıtta isim, TC / VKN, adres ve kişilik tipi zorunlu.
 */
export function masakSiniriAsildi(p: {
  tanim: Record<string, any> | null | undefined;
  paralar: { id?: number; kod?: string; urunTipi?: number; hasOrani?: number }[];
  kurlar: TfKur[];
  urunler: { id?: number; kod?: string; urunTipi?: number }[];
  tip: 0 | 1;
  hasKuruYedek: number;
  kalemler: TfMasakKalemi[];
  odemeler: TfMasakKalemi[];
  toplamTutar: number;
}): boolean {
  const t = p.tanim || {};
  const tlLimit = Number(t.TL_VERGI_SINIRI) > 0 ? Number(t.TL_VERGI_SINIRI) : 100000;
  const dovizLimit = Number(t.DOVIZ_VERGI_SINIRI) > 0 ? Number(t.DOVIZ_VERGI_SINIRI) : 5000;
  const dovizParaId = t.DOVIZ_VERGI_SINIRI_PARA_ID ? Number(t.DOVIZ_VERGI_SINIRI_PARA_ID) : 2;
  const limitPara = p.paralar.find((x) => Number(x.id) === dovizParaId) || p.paralar.find((x) => x.kod?.toUpperCase() === (dovizParaId === 3 ? "EUR" : "USD")) || p.paralar.find((x) => x.kod?.toUpperCase() === "USD");
  const limitParaKodu = (limitPara?.kod || (dovizParaId === 3 ? "EUR" : "USD")).toUpperCase().trim();
  const altinLimit = Number(t.ALTIN_VERGI_SINIRI) > 0 ? Number(t.ALTIN_VERGI_SINIRI) : 5000;
  const altinParaId = t.ALTIN_VERGI_SINIRI_PARA_ID ? Number(t.ALTIN_VERGI_SINIRI_PARA_ID) : 2;
  const altinPara = p.paralar.find((x) => Number(x.id) === altinParaId) || p.paralar.find((x) => x.kod?.toUpperCase() === "USD") || p.paralar.find((x) => x.kod?.toUpperCase() === "22");
  const altinParaKodu = (altinPara?.kod || "USD").toUpperCase().trim();
  const yonKuru = (k?: TfKur) => Number(p.tip === 0 ? (k?.efektifAlis || k?.dovizAlis) : (k?.efektifSatis || k?.dovizSatis)) || 0;
  const usdRate = (() => { const r = yonKuru(p.kurlar.find((k) => buyuk(k.kod) === "USD" || Number(k.paraId) === 2)); return r > 0 ? r : 35; })();
  const limitParaRate = (() => { const r = yonKuru(p.kurlar.find((k) => buyuk(k.kod) === limitParaKodu || Number(k.paraId) === dovizParaId)); return r > 0 ? r : limitParaKodu === "USD" ? usdRate : 38; })();
  const altinParaRate = (() => {
    if (altinParaKodu === "TL" || altinParaKodu === "TRY") return 1;
    const d = yonKuru(p.kurlar.find((k) => buyuk(k.kod) === altinParaKodu || (altinParaId && Number(k.paraId) === altinParaId)));
    if (d > 0) return d;
    if (altinParaKodu === "USD" || altinParaKodu === "$") return usdRate;
    if (altinParaKodu === "EUR" || altinParaKodu === "€") return limitParaRate > 0 && limitParaKodu === "EUR" ? limitParaRate : 38;
    const hasRate = yonKuru(p.kurlar.find((k) => ["HAS", "ALTIN", "HAS ALTIN"].includes(buyuk(k.kod)))) || p.hasKuruYedek || 3200;
    const oran = altinPara?.hasOrani ? Number(altinPara.hasOrani) : altinParaKodu === "22" ? 0.916 : altinParaKodu === "14" ? 0.585 : altinParaKodu === "18" ? 0.75 : 1;
    return hasRate * oran;
  })();
  const tlMi = (kod?: string) => ["TL", "TRY", "TRL", "POS", "HAVALE", ""].includes(buyuk(kod));
  const altinMi = (x: TfMasakKalemi) => {
    const kod = buyuk(x.kod), ad = buyuk(x.ad);
    if (["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "SAR", "AED", "RUB", "KWD", "$", "€", "£"].includes(kod)) return false;
    if (tlMi(kod)) return false;
    if ([1, 2, 3].includes(Number(x.urunTipi))) return true;
    const eslesen = [...p.paralar, ...p.kurlar, ...p.urunler].find((y: any) => (x.paraId && Number(y.id ?? y.paraId) === Number(x.paraId)) || (y.kod && buyuk(y.kod) === kod));
    if (eslesen && [1, 2, 3].includes(Number((eslesen as any).urunTipi))) return true;
    return ["HAS", "GA", "ATA", "CEYREK", "YARIM", "TAM", "GREMSE", "ZIYNET", "22", "14", "18", "24", "22AYAR", "14AYAR", "18AYAR", "24AYAR"].includes(kod)
      || kod.includes("ALTIN") || kod.includes("GUMUS") || kod.endsWith("AYAR")
      || ["ALTIN", "AYAR", "ZIYNET", "BİLEZİK", "BILEZIK", "ÇEYREK", "CEYREK", "YARIM", "ATA", "HAS", "GÜMÜŞ", "GUMUS"].some((s) => ad.includes(s));
  };
  const kalemler = [...p.kalemler, ...p.odemeler];
  if (!kalemler.length) return Math.abs(p.toplamTutar) >= tlLimit;
  let dovizKarsiligi = 0, dovizDogrudan = false, doviz = false, altinTl = 0, altin = false, tl = 0;
  for (const x of kalemler) {
    if (altinMi(x)) {
      altin = true;
      altinTl += x.tutar > 0 ? x.tutar : x.miktar * (x.kur > 0 ? x.kur : altinParaRate > 0 ? altinParaRate : 3000);
    } else if (!tlMi(x.kod)) {
      doviz = true;
      const hedefPara = x.kod === limitParaKodu || (dovizParaId && Number(x.paraId) === dovizParaId)
        || (limitParaKodu === "USD" && (x.kod === "$" || x.kod === "USD" || x.kod.includes("DOLAR") || buyuk(x.ad).includes("DOLAR")))
        || (limitParaKodu === "EUR" && (x.kod === "€" || x.kod === "EUR" || x.kod.includes("EURO") || buyuk(x.ad).includes("EURO")));
      if (hedefPara) {
        dovizKarsiligi += x.miktar;
        if (x.miktar >= dovizLimit) dovizDogrudan = true;
      } else {
        const satirTl = x.tutar > 0 ? x.tutar : x.miktar * (x.kur > 0 ? x.kur : 1);
        const oran = limitParaRate > 0 ? limitParaRate : usdRate;
        const es = oran > 0 ? satirTl / oran : x.miktar;
        dovizKarsiligi += es;
        if (es >= dovizLimit) dovizDogrudan = true;
      }
    } else {
      tl += x.tutar > 0 ? x.tutar : x.miktar;
    }
  }
  const altinAsti = altin && (altinTl >= altinLimit * (altinParaRate > 0 ? altinParaRate : 1) || (altinParaRate > 0 ? altinTl / altinParaRate : altinTl) >= altinLimit);
  const dovizAsti = doviz && (dovizDogrudan || dovizKarsiligi >= dovizLimit);
  const tlAsti = (!altin && !doviz ? Math.abs(p.toplamTutar) >= tlLimit : false) || tl >= tlLimit;
  return altinAsti || dovizAsti || tlAsti;
}

/** Sınır aşılınca kayıtta zorunlu müşteri bilgilerinden eksik olanlar (handleSave MASAK bloğu) */
export function masakEksikleri(m: { unvan: string; vkn: string; adres: string; kisilikTipi: number | null | undefined }): string[] {
  const u = (m.unvan || "").trim();
  const n = u.toLocaleUpperCase("tr-TR");
  const eksik: string[] = [];
  if (!u || n === "İSİM BEYAN EDİLMEMİŞTİR" || n === "ISIM BEYAN EDILMEMISTIR" || n.includes("BEYAN")) eksik.push("İsim / Ünvan");
  if (!(m.vkn || "").trim()) eksik.push("T.C. Kimlik / VKN");
  if (!(m.adres || "").trim()) eksik.push("Müşteri Adresi");
  if (m.kisilikTipi === undefined || m.kisilikTipi === null) eksik.push("Hukuki Yapı / Kişilik Tipi");
  return eksik;
}

// ─── Kayıt verisi (handleSave) ───────────────────────────────────────────────

/** Fişin müşteri / detay bilgileri (handleSelectCustomer'ın doldurduğu alanlar) */
export interface TfMusteri {
  cariKartId: number | null;
  unvan: string;
  vkn: string;
  adres: string;
  telefon: string;
  eposta: string;
  kisilikTipi: number | null;
  babaAdi?: string | null;
  anneAdi?: string | null;
  dogumTarihi?: string | null;
  dogumYeri?: string | null;
  kimlikSeriNo?: string | null;
  pasaportNo?: string | null;
  kimlikBelgeTuru?: number | null;
  kimlikGecerlilikTarihi?: string | null;
  vekilAdi?: string | null;
  vekilKimlikNo?: string | null;
}

/** Fişin Hesap (banka) ödeme satırı: TL hesapta TL, döviz hesapta döviz miktarı × o günün kuru (e-Banka ön doldurmasıyla aynı) */
export interface TfOdeme {
  bankaId: number;
  hesapNo: string;
  hesapAdi: string;
  paraId: number | null;
  paraKodu: string;
  paraAdi: string;
  miktar: number;
  kur: number;
  tutar: number;
}

const iki = (n: number) => String(n).padStart(2, "0");
const sayiVeyaSifir = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Sarraf fişi kayıt verisi: satır ve ödeme eşlemesi handleSave'deki gibi. Satır, ekranın kendi recomputeRow'uyla hesaplanmış altın / gümüş
 * satırıdır (e-Banka dengesi dahil). Tarih / saat kayıt anı (kayıt kipinde ekran da öyle kaydeder).
 */
export function kayitVerisi(p: {
  vezneId: number;
  tip: 0 | 1;
  satir: Record<string, any>;
  musteri: TfMusteri;
  istatistik: TfIstatistik | undefined;
  altinHasKuru: number;
  gumusHasKuru: number;
  kdvOrani: number | null;
  istisnaKodu: string | null;
  belgeTuru: number;
  kullaniciId: number;
  odeme: TfOdeme;
  simdi: Date;
}) {
  const s = p.satir;
  const d = p.simdi;
  const tarih = `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
  const urunTipi = Number(s.urunTipi) || 1;
  const iscilikHas = sayiVeyaSifir(s.iscilikHasGram);
  const kdv = (p.kdvOrani || 0) * (p.altinHasKuru || 0) * iscilikHas / 100;
  const m = p.musteri;
  const doviz = !["TL", "TRY", ""].includes((p.odeme.paraKodu || "").toUpperCase());
  return {
    sarrafFisiId: null,
    vezneId: p.vezneId,
    cariKartId: m.cariKartId,
    tarih,
    saat: `${tarih}T${iki(d.getHours())}:${iki(d.getMinutes())}:00`,
    fisNo: null,
    seriNo: null,
    belgeNo: null,
    irsaliyeNo: null,
    tip: p.tip,
    altinHasKuru: p.altinHasKuru || 0,
    istatistikId: p.istatistik?.id || null,
    istatistikKodu: (p.istatistik?.kod || "").trim() || null,
    alisKuru: 0,
    satisKuru: 0,
    gumusHasKuru: p.gumusHasKuru || 0,
    kdvOrani: p.kdvOrani,
    kdv: parseFloat(kdv.toFixed(2)),
    istisnaKodu: (p.istisnaKodu || "").trim() || null,
    belgeTuru: p.belgeTuru,
    unvan: m.unvan || null,
    kisilikTipi: m.kisilikTipi || null,
    vergiKimlikNo: m.vkn || null,
    babaAdi: m.babaAdi || null,
    anneAdi: m.anneAdi || null,
    adres: m.adres || null,
    eposta: m.eposta || null,
    telefonNo: m.telefon || null,
    dogumTarihi: m.dogumTarihi || null,
    dogumYeri: m.dogumYeri || null,
    kimlikSeriNo: m.kimlikSeriNo || null,
    pasaportNo: m.pasaportNo || null,
    kimlikBelgeTuru: m.kimlikBelgeTuru || null,
    kimlikGecerlilikTarihi: m.kimlikGecerlilikTarihi || null,
    vekilAdi: m.vekilAdi || null,
    vekilKimlikNo: m.vekilKimlikNo || null,
    masakListesindeVar: false,
    kullaniciId: p.kullaniciId || 1,
    yazdirilanBelgeTipi: 0,
    satirlar: [{
      satirId: null,
      satirNo: 1,
      urunId: Number(s.urunId) || 0,
      miktar: sayiVeyaSifir(s.miktar),
      milyem: sayiVeyaSifir(s.milyem),
      hasGram: sayiVeyaSifir(s.hasGram),
      adet: sayiVeyaSifir(s.adet) > 0 ? sayiVeyaSifir(s.adet) : 1,
      iscilikiMiktari: sayiVeyaSifir(s.iscilikiMiktari),
      iscilikHasGram: iscilikHas,
      iscilikTutari: sayiVeyaSifir(s.iscilikTutari),
      iscilikKdvOrani: sayiVeyaSifir(s.iscilikKdvOrani) || null,
      iscilikKdvTutari: sayiVeyaSifir(s.iscilikKdvTutari) || null,
      iscilikHesaplamaSekli: Number(s.iscilikHesaplamaSekli) || 0,
      aciklama: null,
      kur: sayiVeyaSifir(s.kur),
      tutar: sayiVeyaSifir(s.tutar),
      urunTipi,
      karat: null,
    }],
    odemeSatirlari: [{
      satirNo: 1,
      islemeYeri: 2,
      odemeAraciTuru: 3,
      cariKartId: null,
      cariKod: p.odeme.hesapNo || null,
      cariUnvan: p.odeme.hesapAdi || null,
      bankaId: p.odeme.bankaId,
      posCihaziId: null,
      paraId: p.odeme.paraId || null,
      paraKodu: p.odeme.paraKodu || "TL",
      paraAdi: p.odeme.paraAdi || null,
      iskontoId: null,
      // TL ve döviz (para) satırında adet = miktar (handleSave'deki isPZ dalı)
      adet: p.odeme.miktar,
      miktar: p.odeme.miktar,
      milyem: 0,
      hasGram: 0,
      kur: doviz ? p.odeme.kur : 1,
      tutar: p.odeme.tutar,
    }],
  };
}

// ─── Satır hesabı ────────────────────────────────────────────────────────────

/** Sarraf fişi ekranının satır hesabı (SarrafFisiPage recomputeRow); testte dosyadan alınan aynı fonksiyon verilir */
export type SatirHesabi = (r: any, defaultKur?: number, changedField?: any, iscilikGirisSekli?: number, isKdvDisabled?: boolean) => any;

/**
 * Toplu fişin altın / gümüş satırı: ürün seçimindeki e-Banka dalı gibi kurulur (applyProductToRow: miktar boş, ebSabit = banka tutarı,
 * KDV %), sonra İşçilik Toplam yazılmış gibi yeniden hesaplanır (updateRow). Ürünün tanımlı işçiliği kullanılmaz; yalnız yazılan tutar (T2).
 */
export function topluSatir(hesapla: SatirHesabi, p: {
  urun: TfUrun & { paraId: number; kod: string; ad: string };
  urunTipi: number;
  tip: 0 | 1;
  kur: number;
  altinHasKuru: number;
  hedef: number;
  kdvOrani: number;
  kdvKapali: boolean;
  iscilikToplam: number;
  iscilikGirisSekli: number;
}) {
  const milyem = urunMilyemi(p.urun, p.tip);
  let satir = hesapla({
    id: "tf", satirId: null, satirNo: 1, urunId: p.urun.paraId, urunKodu: p.urun.kod, urunAdi: p.urun.ad, adet: 1, miktar: "", milyem,
    refMilyem: milyem !== "" ? milyem : Number(p.urun.hasOrani) || Number(p.urun.alisMilyem) || "", hasGram: "", iscilikToplam: "", tlTutar: "",
    iscilikHesaplamaSekli: 0, iscilikiMiktari: "", iscilikHasGram: "", iscilikTutari: "", iscilikKdvOrani: p.kdvKapali ? "" : p.kdvOrani || "",
    iscilikKdvTutari: "", kur: p.kur, tutar: "", urunTipi: p.urunTipi, karat: "", aciklama: "",
    ebSabit: { miktar: 0, adet: 1, kur: p.kur, tutar: parseFloat(p.hedef.toFixed(2)), kdvAyarli: true },
  }, p.kur, undefined, p.iscilikGirisSekli, p.kdvKapali);
  if (p.iscilikToplam > 0) satir = hesapla({ ...satir, iscilikToplam: p.iscilikToplam }, p.altinHasKuru, "iscilikToplam", p.iscilikGirisSekli, p.kdvKapali);
  return satir;
}

// ─── İşçilik ve belge türü (M23, M24) ────────────────────────────────────────

const tlOku = (v: string): number => {
  const t = (v || "").replace("%", "").trim();
  if (!t) return 0;
  if (!t.includes(",") && /^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : 0;
};

/**
 * İşçilik Toplam (KDV dahil): satırdaki kutu önceliklidir — "%10" / "10%" hareket tutarının yüzdesi, değilse TL; boşsa üstteki yüzde.
 */
export function topluIscilik(satirYazisi: string, ustYuzde: string, hedef: number): number {
  const yazi = (satirYazisi || "").trim();
  if (yazi) {
    const n = tlOku(yazi);
    return /%/.test(yazi) ? Math.round(hedef * n) / 100 : n;
  }
  const y = Math.max(0, tlOku(ustYuzde));
  return y > 0 ? Math.round(hedef * y) / 100 : 0;
}

/** Satırın belgesi: satışta GİB sorgusuna göre e-Fatura / e-Arşiv, alışta e-Gider pusulası (VKN'li satıcıda düzenlenmez) */
export function topluBelge(tip: 0 | 1, vkn: string, mukellef: { mukellefMi: boolean; etiket: string; mesaj: string } | null | undefined): { tur: number; yazi: string; not: string } {
  if (tip === 0) {
    return (vkn || "").length === 10
      ? { tur: 0, yazi: "Gider pusulası düzenlenmez", not: "VKN'li satıcıdan alışta faturayı satıcı keser" }
      : { tur: 0, yazi: "e-Gider pusulası", not: "" };
  }
  if (!mukellef) return { tur: 0, yazi: "e-Arşiv", not: "VKN / TC yok" };
  return mukellef.mukellefMi
    ? { tur: 1, yazi: "e-Fatura", not: `GİB'de e-Fatura mükellefi${mukellef.etiket ? ` (${mukellef.etiket})` : ""}` }
    : { tur: 0, yazi: "e-Arşiv", not: `GİB'de e-Fatura mükellefi değil${mukellef.mesaj ? ` — ${mukellef.mesaj}` : ""}` };
}
