/**
 * Yazıcıya giden fişlerin (termal / A4) şablon verisi — saf mantık, veritabanına dokunmaz.
 *
 * Fiş ekranı kaydedilmemiş fişi de basabildiği için (F9) tutarlar ekrandan gelir; firma bilgisi,
 * kuruş ayarları ve kayıtlı fişin ETTN'si sunucuda tamamlanır (docs/FIS_TASARIM_YOL_HARITASI.md).
 * Alan adları şablondaki `{{...}}` yer tutucularıdır; kılavuzdaki alan listesi buradan üretilir.
 */

import { ticariFisHesapla, yuvarla2, type IskontoTuru } from "../ticari/ticariHesap.js";
import { hesapla, type UblFaturaSatiri } from "../ice/ubl/invoiceBuilder.js";
import { iscilikSizSatir, kuyumSatirAdi, kuyumUblSatirlari, sarrafKuyumCoz, yalnizYazisi } from "../kuyumFatura.js";
import { kuyumFaturaTipi, kuyumKodAdi } from "../kuyumKodlari.js";

export interface FirmaKimlik {
  unvan: string; adres: string; ilce: string; sehir: string; telefon: string; web: string; eposta: string;
  vergiDairesi: string; vkn: string; mersis: string; ticaretSicilNo: string; subeKodu: string; subeAdi: string; dosyaNo: string;
  satisDayanagi: string;
  basamak: { doviz: number; kur: number; tl: number };
  /** TODVZ_TANIM.KMV_UYGULAMA_SEKLI: 1 uygulanmasın, 2 kura dahil, 3 kurdan hariç (varsayılan; DovizFisiPage ile aynı). */
  kmvSekli: 1 | 2 | 3;
}

/** Döviz fişi ekranının yazdırma anındaki görüntüsü (DovizFisiPrintModal'ın aldığı alanlar). */
export interface DovizFisGirdisi {
  fisId?: number | null; tip: number; tarih?: string; saat?: string; seriNo?: string; belgeNo?: string;
  unvan?: string; vergiKimlikNo?: string; detayIl?: string; detayIlce?: string; detayUyruk?: string;
  detayPasaportNo?: string; detayMeslek?: string; detayCariTipi?: string; vezneKod?: string; istatistikKodu?: string;
  guid?: string; ettn?: string; gelisNedeni?: string; isArbitraj?: boolean; geldigiUlke?: string;
  lines: { paraKodu?: string; paraAdi?: string; miktar?: number | string; kur?: number | string; tutar?: number | string; bmv?: number | string; kmv?: number | string; komisyon?: number | string }[];
  toplamTutar?: number | null; totalMasraf?: number | null; sonToplam?: number | null; odemeTutari?: number | null; bsmvTutari?: number | null; kmvTutari?: number | null; komisyonTutari?: number | null;
  giseUsdKuru?: number | null;
  dovizKurusSayisi?: number | null; kurKurusSayisi?: number | null; tlKurusSayisi?: number | null;
}

export interface DovizFisSatiri { kod: string; ad: string; miktar: number; kur: number; tl: number; usd: number; usdVar: boolean }

export interface DovizFisVerisi {
  belgeTuru: "DOVIZ_FIS"; fisId: number; satim: boolean; fisTipi: 0 | 1; tipAdi: "ALIM" | "SATIM";
  belgeBaslikEki: string; tipSeriBilgisi: string; islemTuru: string; belgeKutuBaslik: string;
  belgeNo: string; ettn: string; tarih: string; saat: string; seri: string;
  subeKodu: string; dosyaNo: string; subeNo: string; istatistikNo: string; vezne: string;
  geldigiUlke: string; satisDayanagi: string;
  gelisNedeni?: string; isArbitraj?: boolean;
  /** Firma ayarı KMV "kura dahil" ise dolu (koşulda: {{kmvDahil}} / !{{kmvDahil}}). */
  kmvDahil: boolean;
  /** Satış fişindeki KMV notu: "Kmv kura dahildir." / "Kmv kura dahil değildir."; KMV uygulanmıyorsa ya da alış fişinde boş. */
  kmvNotu: string;
  firma: FirmaKimlik & { vdVkn: string; mersisSicil: string };
  musteri: { unvan: string; ilceSehir: string; uyruk: string; ulkeKodu: string; pasaportNo: string; kimlikNo: string; vergiDairesi: string; musteriTuru: string; meslek: string };
  satirlar: DovizFisSatiri[];
  toplam: { tl: number; tutar: number; bsmv: number; bsmvVar: boolean; komisyon: number; kmv: number | null; kmvVar: boolean; masraf: number; sonToplam: number; genel: number; yaziyla: string };
  basamak: { doviz: number; kur: number; tl: number };
  qr: string; erisimAdresi: string; onizleme: boolean; iptal: boolean;
}

const yazi = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
export const sayiOku = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const str = String(v).trim().replace(/\s/g, "");
  if (!str) return 0;

  // 1. Hem nokta hem virgül içeriyorsa
  if (str.includes(",") && str.includes(".")) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Türkçe: "500.000,50" -> noktalar binlik, virgül ondalık
      const clean = str.replace(/\./g, "").replace(",", ".");
      const num = parseFloat(clean);
      return Number.isFinite(num) ? num : 0;
    } else {
      // İngilizce: "500,000.50" -> virgüller binlik, nokta ondalık
      const clean = str.replace(/,/g, "");
      const num = parseFloat(clean);
      return Number.isFinite(num) ? num : 0;
    }
  }

  // 2. Sadece virgül içeriyorsa ("5000,50" veya "9,00")
  if (str.includes(",")) {
    const parts = str.split(",");
    if (parts.length > 2) {
      const clean = str.replace(/,/g, "");
      const num = parseFloat(clean);
      return Number.isFinite(num) ? num : 0;
    }
    const clean = str.replace(",", ".");
    const num = parseFloat(clean);
    return Number.isFinite(num) ? num : 0;
  }

  // 3. Sadece nokta içeriyorsa ("9.000", "50.000", "1.000.000")
  if (str.includes(".")) {
    const dotParts = str.split(".");
    // Birden fazla nokta varsa ("1.000.000") kesinlikle binlik ayracıdır
    if (dotParts.length > 2) {
      const clean = str.replace(/\./g, "");
      const num = parseFloat(clean);
      return Number.isFinite(num) ? num : 0;
    }
    // Tek nokta: 1-3 basamak . 3 basamak ise ("9.000", "50.000", "500.000") ve başı 0 değilse binlik ayracıdır!
    if (dotParts[0].length >= 1 && dotParts[0].length <= 3 && dotParts[0] !== "0" && dotParts[1].length === 3) {
      const clean = str.replace(/\./g, "");
      const num = parseFloat(clean);
      return Number.isFinite(num) ? num : 0;
    }
    const num = parseFloat(str);
    return Number.isFinite(num) ? num : 0;
  }

  const n = parseFloat(str);
  return Number.isFinite(n) ? n : 0;
};
const buyuk = (s: string) => s.toLocaleUpperCase("tr-TR");
/** Kod / numara (belge no, ETTN, para kodu): Türkçe "i → İ" dönüşümü olmadan. */
const kodBuyuk = (s: string) => s.toUpperCase();
const kurusAyari = (v: unknown, varsayilan: number) => {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isInteger(n) && n >= 0 && n <= 8 ? n : varsayilan;
};
const yuvarla = (n: number, hane = 2) => Math.round(n * 10 ** hane) / 10 ** hane;

/**
 * Tutarın yazıyla hâli, fiş ekranındaki biçimde: "OnBirBin ÜçYüzİki TL ElliAltı Krş".
 * 1.000 → "Bin" (BirBin değil).
 */
export function fisYaziyla(tutar: number): string {
  const birler = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
  const onlar = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
  const gruplar = ["", "Bin", "Milyon", "Milyar", "Trilyon"];
  const uclu = (n: number, grup: number) => {
    const y = Math.floor(n / 100), o = Math.floor((n % 100) / 10), b = n % 10;
    return (y ? (y === 1 ? "Yüz" : birler[y] + "Yüz") : "") + onlar[o] + (grup === 1 && n === 1 ? "" : birler[b]);
  };
  const deger = Math.abs(Number(tutar) || 0);
  let lira = Math.floor(deger);
  let kurus = Math.round((deger - lira) * 100);
  if (kurus === 100) { lira += 1; kurus = 0; }
  const parcalar: string[] = [];
  for (let n = lira, i = 0; n > 0 && i < gruplar.length; n = Math.floor(n / 1000), i++) {
    const k = n % 1000;
    if (k) parcalar.unshift(uclu(k, i) + gruplar[i]);
  }
  const tam = parcalar.length ? parcalar.join(" ") : "Sıfır";
  return `${tam} TL${kurus ? ` ${onlar[Math.floor(kurus / 10)]}${birler[kurus % 10]} Krş` : ""}`;
}

/** "PAMUKKALE/DENİZLİ" — ikisi de boşsa boş. */
const ilceSehir = (ilce: string, il: string) => (ilce || il ? `${buyuk(ilce)}/${buyuk(il)}` : "");

/** ICE'nin e-Döviz erişim adresi (belgeVeri.ts ile aynı). */
export const erisimAdresiYap = (vkn: string, ettn: string) => (ettn && vkn ? `http://ebelge.iceteknoloji.com.tr/edoviz/ettn/${vkn}/${ettn}` : "");

/**
 * Döviz fişinin termal çıktı verisi. Hesaplar DovizFisiPrintModal'daki ile aynıdır:
 * geçerli satır = miktar > 0 ve kur > 0; satışta BSMV verilmemişse binde 2; genel toplam satışta TL + BSMV,
 * alışta ödeme tutarı; USD dışı dövizde ABD doları karşılığı gişe USD kuruyla.
 * Kayıtlı fişin numarası / ETTN'si `kayit` ile gelir (ekrandakinden önceliklidir).
 */
export function dovizFisVerisi(g: DovizFisGirdisi, firma: FirmaKimlik, kayit: { belgeNo?: string; ettn?: string } = {}): DovizFisVerisi {
  const satim = Number(g.tip) === 1;
  const basamak = {
    doviz: kurusAyari(g.dovizKurusSayisi, firma.basamak.doviz),
    kur: kurusAyari(g.kurKurusSayisi, firma.basamak.kur),
    tl: kurusAyari(g.tlKurusSayisi, firma.basamak.tl),
  };
  const usdKuru = sayiOku(g.giseUsdKuru);
  const satirlar: DovizFisSatiri[] = (Array.isArray(g.lines) ? g.lines : [])
    .map(l => {
      const miktar = sayiOku(l.miktar), kur = sayiOku(l.kur);
      const tl = l.tutar === undefined || l.tutar === null || l.tutar === "" ? miktar * kur : sayiOku(l.tutar);
      const kod = kodBuyuk(yazi(l.paraKodu) || "USD");
      const usdVar = kod !== "USD" && kod !== "TL" && kod !== "TRY" && usdKuru > 0;
      return { kod, ad: yazi(l.paraAdi), miktar, kur, tl, usd: usdVar ? yuvarla(tl / usdKuru) : 0, usdVar };
    })
    .filter(s => s.miktar > 0 && s.kur > 0);

  const tl = satirlar.reduce((t, s) => t + s.tl, 0);
  const tutar = g.toplamTutar !== undefined && g.toplamTutar !== null ? sayiOku(g.toplamTutar) : tl;
  const bsmv = satim ? (g.bsmvTutari !== undefined && g.bsmvTutari !== null ? sayiOku(g.bsmvTutari) : yuvarla(tl * 0.002)) : 0;
  const komisyon = sayiOku(g.komisyonTutari);
  // KMV yalnız satış fişinde doğar; alış fişinde ve firma ayarı 1 - Uygulanmasın iken "yok" (null): hesaba girmez ve
  // şablondaki KMV satırı koşulsuz bile olsa basılmaz (sablonCekirdek `satirYok`). Firma şablonuna bakmadan koddan gizlenir.
  const kmvYok = !satim || firma.kmvSekli === 1;
  const kmv = kmvYok ? 0 : sayiOku(g.kmvTutari);
  // KMV kura dahilse (firma ayarı 2) tutarın içindedir: masrafa ve son toplama eklenmez, fişte yalnız bilgi olarak basılır.
  const kmvDahil = firma.kmvSekli === 2;
  const masraf = g.totalMasraf !== undefined && g.totalMasraf !== null
    ? sayiOku(g.totalMasraf)
    : yuvarla(bsmv + komisyon + (kmvDahil ? 0 : kmv));
  const sonToplam = g.sonToplam !== undefined && g.sonToplam !== null
    ? sayiOku(g.sonToplam)
    : (g.odemeTutari !== undefined && g.odemeTutari !== null
      ? sayiOku(g.odemeTutari)
      : (satim ? yuvarla(tutar + masraf) : yuvarla(tutar - masraf)));
  const genel = sonToplam;

  const belgeNo = kodBuyuk(yazi(g.belgeNo) || yazi(kayit.belgeNo) || yazi(g.seriNo));
  const ettn = kodBuyuk(yazi(g.ettn) || yazi(g.guid) || yazi(kayit.ettn));
  const tarihHam = yazi(g.tarih);
  const tarih = /^\d{4}-\d{2}-\d{2}/.test(tarihHam) ? tarihHam.slice(0, 10).split("-").reverse().join("/") : tarihHam;
  const saat = yazi(g.saat).slice(0, 5);
  const isArbitraj = Boolean(g.isArbitraj || (g.gelisNedeni && String(g.gelisNedeni).toLowerCase().includes("arbitraj")));
  const tipAdi = satim ? "SATIM" : "ALIM";
  const belgeBaslikEki = isArbitraj ? `ARBİTRAJ ${tipAdi}` : tipAdi;
  const tipSeriBilgisi = isArbitraj ? `${tipAdi} (ARBİTRAJ)` : tipAdi;
  const islemTuru = isArbitraj ? "ARBİTRAJ" : (satim ? "DÖVİZ SATIŞ" : "DÖVİZ ALIŞ");
  const belgeKutuBaslik = isArbitraj ? `ARBİTRAJ ${tipAdi} BELGESİ BİLGİLERİ` : `${tipAdi} BELGESİ BİLGİLERİ`;
  const kmvNotu = !satim || firma.kmvSekli === 1 ? "" : kmvDahil ? "Kmv kura dahildir." : "Kmv kura dahil değildir.";

  const kimlik = yazi(g.vergiKimlikNo) || "11111111111";
  const musteri = {
    unvan: yazi(g.unvan) || "İsim beyan edilmemiştir",
    ilceSehir: ilceSehir(yazi(g.detayIlce), yazi(g.detayIl)),
    uyruk: buyuk(yazi(g.detayUyruk) || "TR"),
    ulkeKodu: "TR",
    pasaportNo: yazi(g.detayPasaportNo),
    kimlikNo: kimlik,
    vergiDairesi: "",
    musteriTuru: g.detayCariTipi === "Firma" ? "TUZELKISI" : "GERCEKKISI",
    meslek: yazi(g.detayMeslek),
  };

  const erisimAdresi = erisimAdresiYap(firma.vkn, ettn);
  const qr = erisimAdresi || JSON.stringify({ belgeNo, tip: tipAdi, tarih, vkn: firma.vkn, musteri: kimlik, tutar: yuvarla(genel), ettn: ettn || null });
  const subeKodu = firma.subeKodu || "1";

  return {
    belgeTuru: "DOVIZ_FIS", fisId: Number(g.fisId) || 0, satim, fisTipi: satim ? 1 : 0, tipAdi,
    belgeBaslikEki, tipSeriBilgisi, islemTuru, belgeKutuBaslik,
    belgeNo, ettn, tarih, saat, seri: "EDOVIZBELGE",
    subeKodu, dosyaNo: firma.dosyaNo, subeNo: firma.dosyaNo ? `${subeKodu} - ${firma.dosyaNo}` : subeKodu,
    istatistikNo: yazi(g.istatistikKodu), vezne: yazi(g.vezneKod) || "01",
    geldigiUlke: yazi(g.geldigiUlke) || (g.gelisNedeni && !satim ? yazi(g.gelisNedeni) : "Türkiye"),
    satisDayanagi: (satim && g.gelisNedeni ? yazi(g.gelisNedeni) : (firma.satisDayanagi || "32 SAYILI KARAR GEREĞİ")),
    gelisNedeni: yazi(g.gelisNedeni) || "",
    isArbitraj,
    kmvDahil, kmvNotu,
    firma: {
      ...firma,
      vdVkn: [firma.vergiDairesi, firma.vkn].filter(Boolean).join(" / "),
      mersisSicil: [firma.mersis, firma.ticaretSicilNo].filter(Boolean).join(" / "),
    },
    musteri, satirlar,
    toplam: { tl: tutar, tutar, bsmv, bsmvVar: satim && bsmv > 0, komisyon, kmv: kmvYok ? null : kmv, kmvVar: satim && kmv > 0, masraf, sonToplam, genel, yaziyla: fisYaziyla(sonToplam) },
    basamak, qr, erisimAdresi, onizleme: false, iptal: false,
  };
}

/** Boş firma (veritabanı okunamazsa); kuruş varsayılanları DovizFisiPrintModal ile aynı. */
export const bosFirma = (): FirmaKimlik => ({
  unvan: "", adres: "", ilce: "", sehir: "", telefon: "", web: "", eposta: "", vergiDairesi: "", vkn: "",
  mersis: "", ticaretSicilNo: "", subeKodu: "", subeAdi: "", dosyaNo: "", satisDayanagi: "", basamak: { doviz: 2, kur: 4, tl: 2 }, kmvSekli: 3,
});

/** KMV uygulama şekli: 1 / 2 / 3 dışındaki her değer (0, boş) DovizFisiPage'deki gibi 3 - kurdan hariç sayılır. */
const kmvSekliOku = (v: unknown): 1 | 2 | 3 => (Number(v) === 1 ? 1 : Number(v) === 2 ? 2 : 3);

/** TODVZ_TANIM satırından (ad sütunları birleştirilmiş) firma kimliği. */
export function firmaKimlikOku(r: Record<string, any> | null | undefined): FirmaKimlik {
  if (!r) return bosFirma();
  return {
    unvan: yazi(r.FIRMA_ADI), adres: yazi(r.ADRES), ilce: yazi(r.ILCE_ADI), sehir: yazi(r.IL_ADI), telefon: yazi(r.TELEFON),
    web: yazi(r.WEB_ADRESI), eposta: yazi(r.EPOSTA), vergiDairesi: yazi(r.VERGI_DAIRESI_ADI), vkn: yazi(r.VERGI_KIMLIK_NO),
    mersis: yazi(r.MERSIS_NO), ticaretSicilNo: yazi(r.TICARET_SICIL_NO), subeKodu: yazi(r.SUBE_KODU), subeAdi: yazi(r.SUBE_ADI), dosyaNo: yazi(r.DOSYA_NO),
    satisDayanagi: yazi(r.SATISIN_DAYANAGI),
    basamak: { doviz: kurusAyari(r.DOVIZ_KURUS_SAYISI, 2), kur: kurusAyari(r.KUR_KURUS_SAYISI, 4), tl: kurusAyari(r.TL_KURUS_SAYISI, 2) },
    kmvSekli: kmvSekliOku(r.KMV_UYGULAMA_SEKLI),
  };
}

// ── Sarraf fişi ─────────────────────────────────────────────────────────────

/** Sarraf fişi ekranının yazdırma anındaki görüntüsü (SarrafFisiPrintModal'ın aldığı alanlar). */
export interface SarrafFisGirdisi {
  fisId?: number | null; tip: number; tarih?: string; saat?: string; seriNo?: string; belgeNo?: string;
  unvan?: string; vergiKimlikNo?: string; detayIl?: string; detayIlce?: string; detayPasaportNo?: string;
  detayAdres?: string; detayTelefonNo?: string; vezneKod?: string; kullaniciAdi?: string;
  satirlar: { urunKodu?: string; urunAdi?: string; adet?: unknown; miktar?: unknown; milyem?: unknown; hasGram?: unknown; kur?: unknown; tutar?: unknown; aciklama?: string;
    iscilikTutari?: unknown; urunTipi?: unknown;
    /** İşçilik Toplam (KDV dahil), oranı ve KDV tutarı: çıktının altındaki işçilik / KDV % satırları (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M15) */
    iscilikToplam?: unknown; iscilikKdvOrani?: unknown; iscilikKdvTutari?: unknown }[];
  /** Fişin işçilik KDV oranı ve e-Belge KDV kodu (Kütükçü düzenindeki satırlar için; docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF36) */
  kdvOrani?: unknown; istisnaKodu?: string | null;
  /** odemeAraciTuru: 0 vezne, 1 cari, 2 POS, 3 hesap */
  odemeSatirlari?: { odemeAraciTuru?: unknown; paraKodu?: string; paraAdi?: string; adet?: unknown; miktar?: unknown; tutar?: unknown;
    /** Hesap (3) ödemesinde banka hesabının adı: çıktıda "Nakit" / "TL" yerine (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M28) */
    hesapAdi?: string }[];
  toplamTutar?: unknown; toplamHas?: unknown; odenenTutar?: unknown; kalanTutar?: unknown;
}

/** POS ile alınan ödemenin fişteki adı: "POS TL" (TL dışı para birimiyse "POS USD" gibi). */
export const posOdemeAdi = (paraKodu: unknown): string => {
  const kod = yazi(paraKodu).toLocaleUpperCase("tr-TR");
  return `POS ${!kod || kod === "TRY" || kod === "TRL" ? "TL" : kod}`;
};

const tr = (n: number, hane = 2) => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });

/** "2026-10-12" / ISO → "12.10.2026"; tanınmazsa olduğu gibi. */
function tarihNokta(v: unknown): string {
  const h = yazi(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(h);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = h ? new Date(h) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : h;
}
function saatYaz(v: unknown): string {
  const d = v ? new Date(yazi(v)) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }) : "";
}

/**
 * Sarraf fişinin Kütükçü düzenindeki görünümü (EF36): e-Belge'ye gidecek satırlarla AYNI hesap (kuyumFatura.ts). Satışta altın
 * satırları KDV %0 + kod, işçilik (İşçilik (TL) sütunu) ayrı satırda KDV'li; alışta altın satırları ödenen tutarla. Hesap
 * kurulamazsa (eksik / tutarsız satır) satırlar fişteki tutarla düz yazılır; çıktı hiçbir zaman durmaz.
 */
const miktarTr = (n: number) => Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 3 });
const fiyatTr = (n: number) => Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const oranTr = (n: number) => Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const BIRIM_ADI: Record<string, string> = { GRM: "Gram", C62: "Adet", KGM: "Kg" };

export function sarrafFaturaGorunumu(g: Pick<SarrafFisGirdisi, "tip" | "satirlar" | "kdvOrani" | "istisnaKodu">) {
  const satim = Number(g.tip) === 1;
  const ham = (Array.isArray(g.satirlar) ? g.satirlar : [])
    .filter((l) => sayiOku(l.tutar) > 0)
    .map((l) => ({ URUN_ADI: yazi(l.urunAdi) || yazi(l.urunKodu), URUN_TIPI: sayiOku(l.urunTipi), MIKTAR: sayiOku(l.miktar), ADET: sayiOku(l.adet),
      TUTAR: sayiOku(l.tutar), MILYEM: sayiOku(l.milyem), ISCILIK_TUTARI: satim ? sayiOku(l.iscilikTutari) : 0 }));
  const duz = (h: (typeof ham)[number]) => {
    const gramli = h.MIKTAR > 0;
    const ad = gramli ? kuyumSatirAdi({ ad: h.URUN_ADI, milyem: h.MILYEM, urunTipi: h.URUN_TIPI }) : h.URUN_ADI || "Ürün";
    const miktar = gramli ? h.MIKTAR : h.ADET || 1;
    // Alış: gider pusulasındaki gibi gram × (tutar ÷ gram, 6 hane); satış: faturadaki gibi (2 haneli fiyat tutmazsa 1 adet)
    if (!satim) return { ad, miktar, birimKodu: gramli ? "GRM" : "C62", birimFiyat: Math.round((h.TUTAR / miktar) * 1e6) / 1e6, kdvOrani: 0 } as UblFaturaSatiri;
    const a = iscilikSizSatir({ ad, miktar, birimKodu: gramli ? "GRM" : "C62", birimFiyat: 0 }, h.TUTAR);
    return { ad: a.ad, miktar: a.miktar, birimKodu: a.birimKodu, birimFiyat: a.birimFiyat, kdvOrani: 0 } as UblFaturaSatiri;
  };
  let ubl: UblFaturaSatiri[];
  try {
    ubl = !ham.length ? [] : satim ? kuyumUblSatirlari(sarrafKuyumCoz(ham, ham.map(() => 0), sayiOku(g.kdvOrani), yazi(g.istisnaKodu) || null)) : ham.map(duz);
  } catch {
    ubl = ham.map(duz);
  }
  const oz = hesapla(ubl);
  const tl = (n: number) => `${tr(n)} TL`;
  return {
    faturaSatirlari: ubl.map((s, i) => ({
      sira: i + 1, ad: s.ad, miktarYazi: miktarTr(s.miktar), birim: BIRIM_ADI[s.birimKodu || "C62"] || s.birimKodu || "Adet",
      fiyatYazi: `${fiyatTr(s.birimFiyat)} TL`, kdvOraniYazi: `%${tr(s.kdvOrani)}`, kdvTutariYazi: tl(oz.satirlar[i].kdvTutari), tutarYazi: tl(oz.satirlar[i].matrah),
      // Belge Tasarımı'nda hesaplı kolon için sayısal hâlleri
      miktar: s.miktar, fiyat: s.birimFiyat, kdvOrani: s.kdvOrani, kdvTutari: oz.satirlar[i].kdvTutari, tutar: oz.satirlar[i].matrah,
    })),
    toplamSatirlari: [
      { etiket: "Mal/Hizmet Toplam Tutarı", deger: tl(oz.malHizmetToplam) },
      ...oz.kdvGruplari.map((k) => ({ etiket: `KDV(${tr(k.matrah)} %${oranTr(k.oran)})`, deger: tl(k.vergi) })),
      { etiket: "Vergiler Dahil Toplam Tutar", deger: tl(oz.malHizmetToplam + oz.kdvToplam) },
      { etiket: "Ödenecek Tutar", deger: tl(oz.odenecekTutar) },
    ],
    // Kütükçü (GİB onaylı) faturasındaki gibi sebep, belge toplamı için bir kez + o kodu taşıyan her satır için bir kez yazılır
    istisnalar: satim ? oz.kdvGruplari.filter((k) => k.istisnaKodu).flatMap((k) => {
      const metin = `${k.istisnaKodu}-${k.istisnaGerekcesi || kuyumKodAdi(k.istisnaKodu)}`;
      return Array.from({ length: 1 + ubl.filter((s) => s.istisnaKodu === k.istisnaKodu).length }, () => ({ metin }));
    }) : [],
    faturaYaziyla: yalnizYazisi(oz.odenecekTutar),
    // Kütükçü'deki "Fatura Tipi": satışta koda göre (ÖZELMATRAH / İSTİSNA), alışta gider pusulası
    faturaTipi: satim ? (oz.kdvGruplari.some((k) => k.istisnaKodu) ? kuyumFaturaTipi(oz.kdvGruplari.map((k) => k.istisnaKodu || "")) || "OZELMATRAH" : "SATIS") : "GIDERPUSULASI",
  };
}

/**
 * Fişin işçilik özeti (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M15): İşçilik Toplam (KDV dahil) ve KDV'si. Satırların hepsi aynı
 * oranlıysa etikette oran yazar ("İşçilik KDV %20:"). Çıktıda yalnız işçilik KDV'si varken görünür (e-Banka fişi); yoksa düzen değişmez.
 */
export function sarrafIscilikOzeti(satirlar: SarrafFisGirdisi["satirlar"]) {
  let toplam = 0;
  let kdv = 0;
  const oranlar = new Set<number>();
  for (const l of Array.isArray(satirlar) ? satirlar : []) {
    const t = sayiOku(l.iscilikToplam);
    if (!(t > 0)) continue;
    toplam += t;
    kdv += sayiOku(l.iscilikKdvTutari);
    const o = sayiOku(l.iscilikKdvOrani);
    if (o > 0) oranlar.add(o);
  }
  const yuz = (n: number) => Math.round(n * 100) / 100;
  const oran = oranlar.size === 1 ? [...oranlar][0] : null;
  return {
    iscilik: yuz(toplam), iscilikKdv: yuz(kdv), iscilikNet: yuz(toplam - kdv), iscilikVar: kdv > 0,
    iscilikKdvEtiket: `İşçilik KDV${oran !== null ? ` %${oranTr(oran)}` : ""}:`,
  };
}

export function sarrafFisVerisi(g: SarrafFisGirdisi, firma: FirmaKimlik) {
  const satim = Number(g.tip) === 1;
  const isTeklif = !g.fisId || (g.belgeNo && String(g.belgeNo).toUpperCase().includes("TEKLİF")) || ((g as any).fisNo && String((g as any).fisNo).toUpperCase().includes("TEKLİF"));
  const fisNo = (yazi(g.seriNo) ? `${yazi(g.seriNo)}-` : "") + (yazi(g.belgeNo) || (g.fisId ? String(g.fisId) : (isTeklif ? "TEKLİF" : "")));
  const satirlar = (Array.isArray(g.satirlar) ? g.satirlar : [])
    .filter(l => sayiOku(l.miktar) > 0 || sayiOku(l.tutar) > 0 || sayiOku(l.adet) > 0 || yazi(l.urunAdi) !== "")
    .map((l, i) => {
      const miktar = sayiOku(l.miktar), adet = sayiOku(l.adet), milyem = sayiOku(l.milyem), has = sayiOku(l.hasGram), kur = sayiOku(l.kur), tutar = sayiOku(l.tutar);
      return {
        sira: i + 1, kod: yazi(l.urunKodu), ad: yazi(l.urunAdi) || yazi(l.urunKodu) || `Satır ${i + 1}`, aciklama: yazi(l.aciklama),
        adet, miktar, milyem, has, kur, tutar, hasVar: has > 0,
        miktarYazi: miktar > 0 ? `${tr(miktar)} gr` : adet > 0 ? `${adet} ad` : "-",
        ayarKur: milyem > 0 ? String(milyem) : kur > 0 ? tr(kur) : "-",
        adetYazi: adet > 0 ? String(adet) : "-", miktarGr: miktar > 0 ? tr(miktar) : "-", milyemYazi: milyem > 0 ? String(milyem) : "-",
        hasYazi: has > 0 ? tr(has, 4) : "-", kurYazi: kur > 0 ? tr(kur) : "-",
      };
    });
  const odemeler = (Array.isArray(g.odemeSatirlari) ? g.odemeSatirlari : [])
    .filter(o => sayiOku(o.miktar) > 0 || sayiOku(o.tutar) > 0 || sayiOku(o.adet) > 0 || yazi(o.paraKodu) !== "")
    .map((o, i) => {
      const miktar = sayiOku(o.miktar) || sayiOku(o.adet);
      const ad = Number(o.odemeAraciTuru) === 2 ? posOdemeAdi(o.paraKodu)
        : Number(o.odemeAraciTuru) === 3 && yazi(o.hesapAdi) ? yazi(o.hesapAdi)
        : yazi(o.paraKodu) || yazi(o.paraAdi) || "Nakit TL";
      return { sira: i + 1, ad, miktar, miktarYazi: miktar > 0 ? tr(miktar) : "", tutar: sayiOku(o.tutar) };
    });
  const tutar = sayiOku(g.toplamTutar), has = sayiOku(g.toplamHas), odenen = sayiOku(g.odenenTutar), kalan = sayiOku(g.kalanTutar);
  const isc = sarrafIscilikOzeti(g.satirlar);
  const fatura = sarrafFaturaGorunumu(g);
  const tarih = tarihNokta(g.tarih);
  const saat = yazi(g.saat).slice(0, 5);
  return {
    belgeTuru: "SARRAF_FIS" as const, fisId: Number(g.fisId) || 0, satim, tipAdi: satim ? "SATIŞ" : "ALIŞ",
    baslik: satim ? (isTeklif ? "SARRAF SATIŞ FİŞİ (TEKLİF)" : "SARRAF SATIŞ FİŞİ") : (isTeklif ? "SARRAF ALIŞ FİŞİ (TEKLİF)" : "SARRAF ALIŞ FİŞİ"),
    fisNo, tarih, saat, vezne: yazi(g.vezneKod), kasiyer: yazi(g.kullaniciAdi),
    teklif: isTeklif,
    imzaVar: !isTeklif,
    firma,
    musteri: {
      unvan: yazi(g.unvan) || "PERAKENDE MÜŞTERİ", kimlikNo: yazi(g.vergiKimlikNo), telefon: yazi(g.detayTelefonNo), adres: yazi(g.detayAdres),
      ilce: yazi(g.detayIlce), il: yazi(g.detayIl), ilceIl: [yazi(g.detayIlce), yazi(g.detayIl)].filter(Boolean).join(" / "), pasaportNo: yazi(g.detayPasaportNo),
    },
    satirlar, odemeler, odemeVar: odemeler.length > 0,
    toplam: { tutar, has, hasVar: has > 0, odenen, odenenVar: odenen > 0, kalan: Math.abs(kalan), kalanVar: kalan !== 0, yaziyla: fisYaziyla(tutar), ...isc },
    // Kütükçü düzeni (EF36): satış / alış satırları faturadaki gibi, alıcı / satıcı etiketi, ödeme notu
    ...fatura,
    // A4 alışta işçilik fatura satırına ayrılmaz: toplamların başına işçilik ve KDV % satırları (M15; satışta işçilik zaten satır + KDV toplamı)
    toplamSatirlari: !satim && isc.iscilikVar
      ? [
          { etiket: "İşçilik (KDV dahil)", deger: `${tr(isc.iscilik)} TL` },
          { etiket: isc.iscilikKdvEtiket.replace(/:$/, ""), deger: `${tr(isc.iscilikKdv)} TL` },
          ...fatura.toplamSatirlari,
        ]
      : fatura.toplamSatirlari,
    musteriEtiketi: satim ? "Alıcı Bilgileri" : "Satıcı Bilgileri",
    musteriKimlikEtiketi: yazi(g.vergiKimlikNo).replace(/\D/g, "").length === 10 ? "VKN" : "TCKN",
    firmaKimlikEtiketi: yazi(firma.vkn).replace(/\D/g, "").length === 11 ? "TCKN" : "VKN",
    firmaIlceIl: [yazi(firma.ilce), yazi(firma.sehir)].filter(Boolean).join("/ "),
    // Kütükçü yazımı: "DULKADIROGLU/ KAHRAMANMARAŞ /TÜRKİYE" ve "YAMAÇTEPE MAH.   ONİKİŞUBAT/ KAHRAMANMARAŞ"
    firmaAdresSatiri: [yazi(firma.ilce), yazi(firma.sehir)].filter(Boolean).join("/ ") + (yazi(firma.sehir) || yazi(firma.ilce) ? " /TÜRKİYE" : ""),
    musteriAdresSatiri: [yazi(g.detayAdres), [yazi(g.detayIlce), yazi(g.detayIl)].filter(Boolean).join("/ ")].filter(Boolean).join("   "),
    firmaTelSatiri: ["Tel:", yazi(firma.telefon), "Fax:"].filter(Boolean).join(" "),
    musteriTelSatiri: ["Tel:", yazi(g.detayTelefonNo), "Fax:"].filter(Boolean).join(" "),
    tarihTire: tarih.replace(/\./g, " - "),
    tarihTireBitisik: tarih.replace(/\./g, "-"),
    // Kütükçü (satış faturası) imzasız; alış fişinde satıcının teslim imzası kalır
    imzaGoster: !satim && !isTeklif,
    odemeNotu: [
      // Tek ödemede yalnız ödeme yolu (Kütükçü: "ziraat bankası"); birden çokta tutarlarıyla
      ...odemeler.map((o) => {
        const ad = ["TL", "TRY", "TRL"].includes(o.ad.toLocaleUpperCase("tr-TR")) ? "Nakit" : o.ad;
        return odemeler.length === 1 ? ad : `${ad} ${tr(o.tutar)} TL`;
      }),
      ...(kalan !== 0 ? [`Kalan bakiye ${tr(Math.abs(kalan))} TL`] : []),
    ].join(" · "),
    // Alışta kod gider pusulasına yazılmaz; çıktıda da gösterilmez
    kdvKodu: satim ? yazi(g.istisnaKodu) : "",
    qr: `VKN:${firma.vkn}|NO:${fisNo}|TAR:${yazi(g.tarih)}|TOP:${tutar.toFixed(2)}|HAS:${has.toFixed(4)}`,
    onizleme: false, iptal: false,
  };
}

// ── Perakende fişi / e-Arşiv fatura görünümü ────────────────────────────────

/** PerakendeFaturaModel (kayıtlı fatura) veya kayıt yükü. */
export interface PerakendeFisGirdisi {
  faturaId?: number | null; faturaNo?: string; ettn?: string; tarih?: string; faturaTipi?: number; senaryo?: string;
  aliciVknTckn?: string; aliciUnvan?: string; adres?: string; ilce?: string; il?: string; vergiDairesi?: string; eposta?: string; telefon?: string;
  paraKodu?: string; araToplam?: unknown; toplamKdv?: unknown; iskontoOrani?: unknown; iskontoTutari?: unknown; genelToplam?: unknown;
  satirlar?: { satirNo?: unknown; barkod?: string; urunAdi?: string; ayar?: string; miktar?: unknown; birim?: string; gram?: unknown; hasGram?: unknown; birimFiyat?: unknown; kdvOrani?: unknown; kdvTutari?: unknown; toplamTutar?: unknown }[];
  /** odemeAraciTuru: 0 vezne, 1 cari, 2 POS, 3 hesap */
  odemeler?: { odemeAraciTuru?: unknown; paraKodu?: string; paraAdi?: string; adet?: unknown; miktar?: unknown; tutar?: unknown }[];
}

export function perakendeFisVerisi(g: PerakendeFisGirdisi, firma: FirmaKimlik) {
  const satirlar = (Array.isArray(g.satirlar) ? g.satirlar : []).map((s, i) => {
    const gram = sayiOku(s.gram), has = sayiOku(s.hasGram), birimFiyat = sayiOku(s.birimFiyat);
    return {
      sira: sayiOku(s.satirNo) || i + 1, barkod: yazi(s.barkod), ad: yazi(s.urunAdi), ayar: yazi(s.ayar), miktar: sayiOku(s.miktar), birim: yazi(s.birim),
      gram, has, birimFiyat, kdvOrani: sayiOku(s.kdvOrani), kdvTutari: sayiOku(s.kdvTutari), toplam: sayiOku(s.toplamTutar),
      barkodAyar: [yazi(s.barkod), yazi(s.ayar)].join(" | "), gramYazi: `${tr(gram)}g`,
    };
  });
  // Ödeme / tahsilat satırları sarraf fişindeki gibi: POS "POS TL", diğerleri para birimiyle (altın / dövizle ödemede miktar)
  const odemeler = (Array.isArray(g.odemeler) ? g.odemeler : []).filter((o) => sayiOku(o.tutar) > 0).map((o, i) => {
    const miktar = sayiOku(o.miktar) || sayiOku(o.adet);
    const ad = Number(o.odemeAraciTuru) === 2 ? posOdemeAdi(o.paraKodu) : yazi(o.paraKodu) || yazi(o.paraAdi) || "Nakit TL";
    return { sira: i + 1, ad, miktar, miktarYazi: miktar > 0 ? tr(miktar) : "", tutar: sayiOku(o.tutar) };
  });
  const iskonto = sayiOku(g.iskontoTutari), iskontoOrani = sayiOku(g.iskontoOrani), genel = sayiOku(g.genelToplam);
  const faturaNo = yazi(g.faturaNo), ettn = yazi(g.ettn), kimlik = yazi(g.aliciVknTckn) || "11111111111";
  const iade = Number(g.faturaTipi) === 2;
  return {
    belgeTuru: "PERAKENDE_FIS" as const, faturaId: Number(g.faturaId) || 0, faturaNo, ettn, senaryo: yazi(g.senaryo) || "EARSIVFATURA",
    iade, faturaTipiAdi: iade ? "İADE" : "SATIS", baslik: iade ? "PERAKENDE İADE BİLGİ FİŞİ" : "PERAKENDE SATIŞ BİLGİ FİŞİ", tarih: tarihNokta(g.tarih), saat: saatYaz(g.tarih), paraKodu: yazi(g.paraKodu) || "TL",
    firma,
    musteri: {
      unvan: yazi(g.aliciUnvan) || "NİHAİ TÜKETİCİ", kimlikNo: kimlik, vergiDairesi: yazi(g.vergiDairesi), adres: yazi(g.adres) || "-",
      ilce: yazi(g.ilce) || "-", il: yazi(g.il) || "-", telefon: yazi(g.telefon), eposta: yazi(g.eposta),
    },
    satirlar, odemeler, odemeVar: odemeler.length > 0,
    toplam: {
      gram: satirlar.reduce((t, s) => t + s.gram, 0), has: satirlar.reduce((t, s) => t + s.has, 0),
      ara: sayiOku(g.araToplam), kdv: sayiOku(g.toplamKdv), iskonto, iskontoVar: iskonto > 0, iskontoOrani,
      iskontoEtiket: iskontoOrani > 0 ? `İskonto (%${iskontoOrani})` : "İskonto", genel, yaziyla: fisYaziyla(genel),
    },
    qr: `VKN:${firma.vkn}|AVKN:${kimlik}|NO:${faturaNo}|ETTN:${ettn}|TAR:${yazi(g.tarih)}|TOP:${genel.toFixed(2)}`,
    onizleme: false, iptal: false,
  };
}

// ── Ticari satış fişi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T17) ──────────
// Alanlar Perakende fişiyle aynı adlarla verilir (şablon Perakende örneğinden türetilebilsin); tutarlar ticari hesaptan yeniden
// çözülür, böylece kayıtlı fişle ekrandaki (kaydedilmemiş) fiş aynı basılır.

export interface TicariFisGirdisi {
  faturaId?: number | null; faturaNo?: string; ettn?: string; tarih?: string; senaryo?: string; vezneKod?: string | null;
  aliciVknTckn?: string; aliciUnvan?: string; adres?: string | null; ilce?: string | null; il?: string | null; vergiDairesi?: string | null; eposta?: string | null; telefon?: string | null;
  iskontoTuru?: unknown; iskontoDegeri?: unknown;
  satirlar?: { satirNo?: unknown; kod?: string; barkod?: string; urunAdi?: string; miktar?: unknown; birim?: string; kdvDahilFiyat?: unknown; kdvOrani?: unknown; iskontoTuru?: unknown; iskontoDegeri?: unknown }[];
  odemeler?: { odemeAraciTuru?: unknown; paraKodu?: string; paraAdi?: string; cariUnvan?: string | null; miktar?: unknown; tutar?: unknown }[];
}

const ODEME_TURU_ADI: Record<number, string> = { 0: "Nakit", 1: "Cari (veresiye)", 2: "Kredi kartı", 3: "Havale / EFT" };

export function ticariFisVerisi(g: TicariFisGirdisi, firma: FirmaKimlik) {
  const ham = Array.isArray(g.satirlar) ? g.satirlar : [];
  const hesap = ticariFisHesapla(
    ham.map((s) => ({ miktar: sayiOku(s.miktar) || 0.0001, kdvDahilFiyat: sayiOku(s.kdvDahilFiyat), kdvOrani: sayiOku(s.kdvOrani),
      iskontoTuru: (Number(s.iskontoTuru) || 0) as IskontoTuru, iskontoDegeri: sayiOku(s.iskontoDegeri) })),
    { turu: (Number(g.iskontoTuru) || 0) as IskontoTuru, deger: sayiOku(g.iskontoDegeri) });
  const satirlar = hesap.satirlar.map((h, i) => {
    const s = ham[i];
    const tur = Number(s.iskontoTuru) || 0;
    const iskontoYazi = tur === 1 ? `%${tr(sayiOku(s.iskontoDegeri), 0)}` : tur === 2 ? `${tr(sayiOku(s.iskontoDegeri))} TL` : "";
    return {
      sira: sayiOku(s.satirNo) || i + 1, kod: yazi(s.kod), barkod: yazi(s.barkod), ad: yazi(s.urunAdi), miktar: h.miktar, miktarYazi: `${tr(h.miktar, Number.isInteger(h.miktar) ? 0 : 3)} ${yazi(s.birim)}`.trim(),
      birim: yazi(s.birim), kdvDahilFiyat: h.kdvDahilFiyat, birimFiyat: h.birimFiyat, kdvOrani: h.kdvOrani, kdvTutari: h.kdvTutari,
      brut: h.brutDahil, iskontoYazi, iskontoVar: h.satirIskontoDahil > 0, satirIskonto: h.satirIskontoDahil, matrah: h.matrah, toplam: h.toplamTutar,
      kodBarkod: [yazi(s.kod), yazi(s.barkod)].filter(Boolean).join(" | "), fiyatYazi: `${tr(h.miktar, Number.isInteger(h.miktar) ? 0 : 3)} x ${tr(h.kdvDahilFiyat)}`,
      // Perakende şablonundan gelen alanlar boş kalmasın
      ayar: "", gram: 0, has: 0, barkodAyar: yazi(s.barkod), gramYazi: `${tr(h.miktar, Number.isInteger(h.miktar) ? 0 : 3)} ${yazi(s.birim)}`.trim(),
    };
  });
  const kdvOranlari = [...new Set(hesap.satirlar.map((s) => s.kdvOrani))].sort((a, b) => a - b);
  const kdvDokumu = kdvOranlari.map((oran) => {
    const ss = hesap.satirlar.filter((s) => s.kdvOrani === oran);
    return { oran, matrah: yuvarla2(ss.reduce((t, s) => t + s.matrah, 0)), kdv: yuvarla2(ss.reduce((t, s) => t + s.kdvTutari, 0)) };
  });
  const odemeler = (Array.isArray(g.odemeler) ? g.odemeler : []).filter((o) => sayiOku(o.tutar) > 0).map((o, i) => {
    const tur = Number(o.odemeAraciTuru) || 0;
    const kod = yazi(o.paraKodu) || "TL";
    const ad = tur === 1 ? yazi(o.cariUnvan) || "Cari" : tur === 2 ? posOdemeAdi(kod) : tur === 0 && !["TL", "TRY"].includes(kod) ? `${kod} ${tr(sayiOku(o.miktar))}` : ODEME_TURU_ADI[tur] || "Nakit";
    return { sira: i + 1, tur: ODEME_TURU_ADI[tur] || "Nakit", ad, tutar: sayiOku(o.tutar) };
  });
  const odenen = yuvarla2(odemeler.reduce((t, o) => t + o.tutar, 0));
  const satirIskonto = yuvarla2(hesap.satirlar.reduce((t, s) => t + s.satirIskontoDahil, 0));
  const iskonto = yuvarla2(satirIskonto + hesap.baslikIskontoDahil);
  const faturaNo = yazi(g.faturaNo), ettn = yazi(g.ettn), kimlik = yazi(g.aliciVknTckn) || "11111111111";
  const iskontoOrani = Number(g.iskontoTuru) === 1 ? sayiOku(g.iskontoDegeri) : 0;
  return {
    belgeTuru: "TICARI_FIS" as const, faturaId: Number(g.faturaId) || 0, faturaNo, ettn, senaryo: yazi(g.senaryo) || "EARSIVFATURA",
    iade: false, faturaTipiAdi: "SATIS", baslik: "SATIŞ BİLGİ FİŞİ", tarih: tarihNokta(g.tarih), saat: saatYaz(g.tarih), paraKodu: "TL", vezne: yazi(g.vezneKod),
    firma,
    musteri: {
      unvan: yazi(g.aliciUnvan) || "NİHAİ TÜKETİCİ", kimlikNo: kimlik, vergiDairesi: yazi(g.vergiDairesi), adres: yazi(g.adres) || "-",
      ilce: yazi(g.ilce) || "-", il: yazi(g.il) || "-", telefon: yazi(g.telefon), eposta: yazi(g.eposta),
    },
    satirlar,
    kdvDokumu,
    odemeler, odemeVar: odemeler.length > 0,
    toplam: {
      kalem: satirlar.length, miktar: yuvarla2(satirlar.reduce((t, s) => t + s.miktar, 0)),
      brut: hesap.brutDahil, satirIskonto, fisIskonto: hesap.baslikIskontoDahil, fisIskontoVar: hesap.baslikIskontoDahil > 0,
      iskonto, iskontoVar: iskonto > 0, iskontoOrani, iskontoEtiket: iskontoOrani > 0 ? `İskonto (%${tr(iskontoOrani, 0)})` : "İskonto",
      ara: hesap.matrah, kdv: hesap.toplamKdv, genel: hesap.genelToplam, yaziyla: fisYaziyla(hesap.genelToplam),
      odenen, paraUstu: yuvarla2(Math.max(0, odenen - hesap.genelToplam)), paraUstuVar: odenen - hesap.genelToplam > 0.004,
      gram: 0, has: 0,
    },
    qr: `VKN:${firma.vkn}|AVKN:${kimlik}|NO:${faturaNo}|ETTN:${ettn}|TAR:${yazi(g.tarih)}|TOP:${hesap.genelToplam.toFixed(2)}`,
    onizleme: false, iptal: false,
  };
}
