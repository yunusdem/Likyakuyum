import { ApiError } from "../utils/ApiError.js";
import { GiderPusulasiGirdi } from "./ice/ubl/giderPusulasiBuilder.js";
import { UblFaturaGirdi, hesapla } from "./ice/ubl/invoiceBuilder.js";
import { BELGE_NO_BICIMI, NIHAI_TUKETICI, PerakendeBaslik, PerakendeSatir, aliciTarafi, perakendeGiderGirdisi } from "./ebelgePerakende.js";
import { faturaTipiKodlardan, kuyumNotlari, kuyumUblSatirlari, sarrafKuyumCoz } from "./kuyumFatura.js";

/**
 * Sarraf fişi (TODVZ_SARRAF_FISI) → e-Belge girdisi. Saf dönüşüm; veritabanına ve ICE'ye dokunmaz.
 *
 * Eski e-Belge görünümü (VODVZ_GONDERIME_HAZIR_E_BELGE) yalnız "e-Fatura" seçili ve e-belge başlangıç tarihi tanımlı
 * fişleri listeliyor, belge numarası olarak da fişin iç numarasını (DOC…) veriyordu; bu yüzden yeni programın Sarraf
 * fişleri hiç gönderilemiyordu (10.10.2026). Artık:
 *  - Fiş, belge türü ne olursa olsun listelenir; e-Belge numarası fişin kendi numarasından bağımsız olarak gönderim
 *    anında e-Belge Ayarları'ndaki seriden verilir (firmadan firmaya fiş numarası biçimi değişebilir).
 *  - Satırlar fişin kendi satırlarından (TODVZ_SARRAF_FISI_SATIRI) gelir: satır tutarı müşterinin ödediği tutardır,
 *    fatura toplamı fişin toplamıyla (POS'tan çekilenle) aynı olur. Eski satır görünümü (VODVZ_E_FATURA_SATIRI) has gram ×
 *    has kuru hesaplıyor, işçiliği ve satırın kendi kurunu saymıyordu (10.10.2026: 72.632,29 TL'lik fiş 57.312,50 göründü).
 *  - KDV fiş düzeyindedir (işçilik has gramı × has kuru × oran) ve satır tutarlarının içindedir (fiş toplamına eklenmez):
 *    satırlara işçilik has gramı oranında dağıtılır, satır matrahı tutardan düşülür, özel matrah 805 ile gider.
 *    KDV yoksa satırlar %0, firma muafiyet koduyla (Perakende ile aynı kural).
 *  - Satış → e-Arşiv / e-Fatura (mükellef sorgusu), nihai tüketiciden alış → e-Gider pusulası, VKN'li alış gönderilmez.
 */

/** Listede ve kaynak anahtarında belge türü: 1 satış faturası, 2 e-İrsaliye seçili satış, 3 alış (e-Gider) */
export const sarrafKaynakTuru = (tip: unknown, belgeTuru: unknown): 1 | 2 | 3 =>
  Number(tip) === 0 ? 3 : Number(belgeTuru) === 2 ? 2 : 1;

export interface SarrafBaslik {
  SARRAF_FISI_ID: number;
  TIP: number;
  BELGE_TURU?: number | null;
  TARIH: Date | string;
  UNVAN?: string | null;
  VERGI_KIMLIK_NO?: string | null;
  ADRES?: string | null;
  IL_ADI?: string | null;
  ILCE_ADI?: string | null;
  VERGI_DAIRESI_ADI?: string | null;
  EPOSTA?: string | null;
  TELEFON_NO?: string | null;
  E_FATURA_KDV_MUAFIYET_KODU?: string | null;
  E_FATURA_KDV_MUAFIYET_ADI?: string | null;
  /** Fiş düzeyinde işçilik KDV'si (oran % ve tutar); satır tutarlarının içinde */
  KDV_ORANI?: number | null;
  KDV?: number | null;
  /** Fişin kendi numarası (gider pusulasına not olarak yazılır); SARRAF_FIS_NO tablodan (Kaynak detay sorgusu) */
  FIS_NO?: string | null;
  SARRAF_FIS_NO?: string | null;
  /** Fişte seçilen GİB kodu (kuyumKodlari.ts); boşsa altın 805, gümüş 808 (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF29) */
  E_BELGE_ISTISNA_KODU?: string | null;
}

/** TODVZ_SARRAF_FISI_SATIRI + ürün (TODVZ_PARA) */
export interface SarrafSatir {
  SATIR_NO: number;
  URUN_ADI?: string | null;
  /** TODVZ_PARA.BIRIM: 1 gram, diğer adet */
  URUN_BIRIM?: number | null;
  /** Gram */
  MIKTAR?: number | null;
  ADET?: number | null;
  ISCILIK_HAS_GRAM?: number | null;
  /** Satır tutarı (KDV dahil, müşterinin ödediği) */
  TUTAR?: number | null;
  /** Has oranı (kesir, ör. 0,916); 0 ise ürün kartındaki (PARA_HAS_ORANI) */
  MILYEM?: number | null;
  PARA_HAS_ORANI?: number | null;
  HAS_GRAM?: number | null;
  /** TODVZ_PARA.URUN_TIPI: 0 para, 1 altın, 2 gümüş, 3 ziynet (gümüşte özel matrah 808) */
  URUN_TIPI?: number | null;
  /** İşçilik (TL) sütunu (göç 021); faturada işçilik satırı bundan (EF35) */
  ISCILIK_TUTARI?: number | null;
}

const temiz = (v: unknown): string => String(v ?? "").trim();
const yuvarla = (n: number): number => Math.round(n * 100) / 100;
const sayi = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Alıcı / satıcı kimliği: rakam dışı karakterler atılır, boşsa nihai tüketici */
export const sarrafAliciVkn = (b: Pick<SarrafBaslik, "VERGI_KIMLIK_NO">): string =>
  temiz(b.VERGI_KIMLIK_NO).replace(/\D/g, "") || NIHAI_TUKETICI;

/** Fiş toplamı = satır tutarlarının toplamı (Sarraf fişindeki toplam; KDV içinde) */
export const sarrafToplam = (satirlar: SarrafSatir[]): number =>
  yuvarla(satirlar.reduce((t, s) => t + yuvarla(sayi(s.TUTAR)), 0));

/**
 * Fiş KDV'sinin satırlara dağılımı: işçilik has gramı oranında (fişte KDV böyle hesaplanıyor); işçilik has gramı
 * yoksa tutar oranında. Kuruş artığı son payı olan satıra yazılır.
 */
export const sarrafSatirKdvleri = (b: Pick<SarrafBaslik, "KDV" | "KDV_ORANI">, satirlar: SarrafSatir[]): number[] => {
  const kdv = yuvarla(Math.max(0, sayi(b.KDV)));
  if (!kdv || sayi(b.KDV_ORANI) <= 0) return satirlar.map(() => 0);
  const iscilik = satirlar.map((s) => Math.max(0, sayi(s.ISCILIK_HAS_GRAM)));
  const agirlik = iscilik.some((x) => x > 0) ? iscilik : satirlar.map((s) => Math.max(0, sayi(s.TUTAR)));
  const toplam = agirlik.reduce((t, x) => t + x, 0);
  if (toplam <= 0) return satirlar.map(() => 0);
  const paylar = agirlik.map((x) => yuvarla((kdv * x) / toplam));
  const son = agirlik.reduce((s, x, i) => (x > 0 ? i : s), 0);
  paylar[son] = yuvarla(paylar[son] + (kdv - paylar.reduce((t, x) => t + x, 0)));
  return paylar;
};

/**
 * Satırın faturadaki miktarı ve birimi: adetli satır adet (C62), değilse gram (GRM). Birim fiyat kuruşla tam
 * bölünmüyorsa (ör. 100 TL / 3 adet) miktar 1 alınır, adet / gram ürün adına yazılır; toplam fişle birebir kalır.
 */
export const sarrafSatirMiktari = (s: SarrafSatir, tutar: number): { ad: string; miktar: number; birim: string } => {
  const ad = temiz(s.URUN_ADI) || "Ürün";
  const adet = sayi(s.ADET);
  const gram = sayi(s.MIKTAR);
  const gramYazi = gram > 0 ? `${gram.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} gr` : "";
  const aday = adet > 0 ? { ad: gramYazi ? `${ad} (${gramYazi})` : ad, miktar: adet, birim: "C62" }
    : gram > 0 ? { ad, miktar: gram, birim: Number(s.URUN_BIRIM) === 1 ? "GRM" : "C62" }
    : { ad, miktar: 1, birim: "C62" };
  const birimFiyat = yuvarla(tutar / aday.miktar);
  // Tam eşitlik: kuruş farkı bile faturayı fişten (POS'tan çekilenden) ayırır
  if (Math.abs(yuvarla(birimFiyat * aday.miktar) - tutar) < 0.005) return aday;
  const ek = [adet > 0 ? `${adet} adet` : "", gramYazi].filter(Boolean).join(", ");
  return { ad: ek ? `${ad} (${ek})` : ad, miktar: 1, birim: "C62" };
};

/** Perakende dönüşümünün beklediği biçime çevirir; belge numarası dışarıdan (seriden) verilir */
export const sarrafPerakendeBicimi = (kaynak: { baslik: SarrafBaslik; satirlar: SarrafSatir[] }, belgeNo: string): { baslik: PerakendeBaslik; satirlar: PerakendeSatir[] } => {
  const b = kaynak.baslik;
  if (!kaynak.satirlar.length) throw ApiError.badRequest("Sarraf fişinin satırları bulunamadı.");
  if (kaynak.satirlar.some((s) => sayi(s.TUTAR) < 0)) throw ApiError.badRequest("Sarraf fişinde eksi tutarlı satır var; e-belge düzenlenemez.");
  const kdvler = sarrafSatirKdvleri(b, kaynak.satirlar);
  const kdvVar = kdvler.some((x) => x > 0);
  if (kdvler.some((k, i) => k > yuvarla(sayi(kaynak.satirlar[i].TUTAR)))) throw ApiError.badRequest("Fişteki KDV satır tutarından büyük; fişi kontrol edin.");
  return {
    baslik: {
      FATURA_ID: Number(b.SARRAF_FISI_ID),
      FATURA_NO: belgeNo,
      // Fişin ETTN'si kayıtta önceden üretilmiş bir değer; reddedilen gönderimden sonra yeni numarayla tekrar
      // denenebilmesi için her gönderim kendi ETTN'sini alır.
      ETTN: null,
      TARIH: b.TARIH,
      FATURA_TIPI: Number(b.TIP) === 0 ? 0 : 1,
      ALICI_VKN_TCKN: sarrafAliciVkn(b),
      ALICI_UNVAN: temiz(b.UNVAN) || null,
      ADRES: temiz(b.ADRES) || null,
      ILCE: temiz(b.ILCE_ADI) || null,
      IL: temiz(b.IL_ADI) || null,
      VERGI_DAIRESI: temiz(b.VERGI_DAIRESI_ADI) || null,
      EPOSTA: temiz(b.EPOSTA) || null,
      TELEFON: temiz(b.TELEFON_NO) || null,
      PARA_KODU: "TL",
      ISKONTO_TUTARI: 0,
      GENEL_TOPLAM: sarrafToplam(kaynak.satirlar),
      E_FATURA_KDV_MUAFIYET_KODU: b.E_FATURA_KDV_MUAFIYET_KODU,
      E_FATURA_KDV_MUAFIYET_ADI: b.E_FATURA_KDV_MUAFIYET_ADI,
    },
    satirlar: kaynak.satirlar.map((s, i) => {
      const kdv = kdvler[i];
      const matrah = yuvarla(yuvarla(sayi(s.TUTAR)) - kdv);
      const m = sarrafSatirMiktari(s, matrah);
      return {
        SATIR_NO: Number(s.SATIR_NO),
        URUN_ADI: m.ad,
        MIKTAR: m.miktar,
        BIRIM: m.birim,
        TUTAR: matrah,
        // Fişte KDV varsa tüm satırlar aynı oranla, KDV'si işçilikten (tam matrahtan küçük) → özel matrah 805
        KDV_ORANI: kdvVar ? sayi(b.KDV_ORANI) : 0,
        KDV_TUTARI: kdv,
      };
    }),
  };
};

/**
 * Satış fişi → kuyum satış faturası çözümü (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF16): her altın satırı
 * "22 ayar altın" gram × fiyat, KDV %0 + 805 (gümüş 808); işçilik (fiş KDV'si ÷ oran) tek satırda, fişin KDV oranıyla.
 * KDV'siz fişte yalnız altın satırları. Toplam fiş toplamına eşit.
 */
export const sarrafKuyumCozumu = (kaynak: { baslik: SarrafBaslik; satirlar: SarrafSatir[] }) => {
  const b = kaynak.baslik;
  if (!kaynak.satirlar.length) throw ApiError.badRequest("Sarraf fişinin satırları bulunamadı.");
  if (kaynak.satirlar.some((s) => sayi(s.TUTAR) < 0)) throw ApiError.badRequest("Sarraf fişinde eksi tutarlı satır var; e-belge düzenlenemez.");
  const kdvler = sarrafSatirKdvleri(b, kaynak.satirlar);
  if (kdvler.some((k, i) => k > yuvarla(sayi(kaynak.satirlar[i].TUTAR)))) throw ApiError.badRequest("Fişteki KDV satır tutarından büyük; fişi kontrol edin.");
  return sarrafKuyumCoz(kaynak.satirlar, kdvler, sayi(b.KDV_ORANI), temiz(b.E_BELGE_ISTISNA_KODU) || null);
};

/** Satış fişi → e-Fatura / e-Arşiv girdisi (kuyum düzeni, EF16 + EF27). Senaryo çağıranda mükellef sorgusuyla kesinleşir. */
export function sarrafFaturaGirdisi(kaynak: { baslik: SarrafBaslik; satirlar: SarrafSatir[] }, belgeNo: string): Omit<UblFaturaGirdi, "gonderici"> {
  if (Number(kaynak.baslik.TIP) === 0) throw ApiError.badRequest("Bu fiş alış fişi; fatura değil gider pusulası düzenlenir.");
  if (Number(kaynak.baslik.BELGE_TURU) === 2) throw ApiError.badRequest("Fişte belge türü e-İrsaliye seçili; e-İrsaliye ekranından gönderin.");
  const no = temiz(belgeNo).toUpperCase();
  if (!BELGE_NO_BICIMI.test(no)) throw ApiError.badRequest(`Belge numarası GİB biçiminde değil (${no || "boş"}).`);
  const bicim = sarrafPerakendeBicimi(kaynak, no).baslik;
  const cozum = sarrafKuyumCozumu(kaynak);
  const satirlar = kuyumUblSatirlari(cozum);
  const toplam = sarrafToplam(kaynak.satirlar);
  const ozet = hesapla(satirlar);
  if (Math.abs(ozet.odenecekTutar - toplam) > 0.011) {
    throw ApiError.badRequest(`Fişin toplamı (${toplam.toFixed(2)}) ile e-belge toplamı (${ozet.odenecekTutar.toFixed(2)}) uyuşmuyor; gönderim durduruldu.`);
  }
  const alici = aliciTarafi(bicim);
  const tarih = new Date(kaynak.baslik.TARIH);
  if (Number.isNaN(tarih.getTime())) throw ApiError.badRequest("Fiş tarihi okunamadı.");
  return {
    belgeNo: no,
    tarih: tarih.toISOString().slice(0, 10),
    paraBirimi: "TRY",
    senaryo: alici.vknTckn === NIHAI_TUKETICI ? "EARSIVFATURA" : "TICARIFATURA",
    faturaTipi: faturaTipiKodlardan(satirlar),
    alici,
    satirlar,
    notlar: kuyumNotlari(toplam),
    gorunum: "KUYUM",
  };
}

/** Kaynak önizlemesinde faturaya gidecek satırlar (ad, miktar, KDV hariç tutar, KDV) */
export const sarrafFaturaOnizlemeSatirlari = (kaynak: { baslik: SarrafBaslik; satirlar: SarrafSatir[] }) => {
  const satirlar = kuyumUblSatirlari(sarrafKuyumCozumu(kaynak));
  const ozet = hesapla(satirlar);
  return satirlar.map((s, i) => ({ URUN_ADI: s.ad, MIKTAR: s.miktar, TUTAR: ozet.satirlar[i].matrah, KDV_TUTARI: ozet.satirlar[i].kdvTutari }));
};

/* ==========================================================================
   Alış → kuyum e-Gider pusulası (docs/E_GIDER_YOL_HARITASI.md K19, K22, K23)
   ========================================================================== */

/** Fişte KDV var mı (alışta olmamalı: satıcı KDV mükellefi değil) */
export const sarrafKdvVar = (b: Pick<SarrafBaslik, "KDV" | "KDV_ORANI">): boolean => sayi(b.KDV) > 0 && sayi(b.KDV_ORANI) > 0;

export const KDV_SIFIR_UYARISI =
  "Bu alış fişinde KDV var; gider pusulasında KDV olmaz. Belge KDV 0 olarak, satıcıya ödenen tutarla (KDV dahil) gönderilecektir.";

/** Milyem binde (916); satırda yoksa ürün kartından; kesir (0,916) ya da binde tutulabilir */
export const sarrafMilyemBin = (s: Pick<SarrafSatir, "MILYEM" | "PARA_HAS_ORANI">): number | null => {
  const m = sayi(s.MILYEM) > 0 ? sayi(s.MILYEM) : sayi(s.PARA_HAS_ORANI);
  if (!(m > 0)) return null;
  return Math.round(m <= 1 ? m * 1000 : m);
};

/** Belgede kuyum satır adı: "22 AYAR BİLEZİK (Milyem 916, Has 11,450 gr)"; adet / gram eki varsa aynı parantezde */
export const sarrafKuyumAdi = (ad: string, s: SarrafSatir): string => {
  const ek: string[] = [];
  const milyem = sarrafMilyemBin(s);
  if (milyem) ek.push(`Milyem ${milyem}`);
  const has = sayi(s.HAS_GRAM);
  if (has > 0) ek.push(`Has ${has.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} gr`);
  if (!ek.length) return ad;
  return ad.endsWith(")") ? `${ad.slice(0, -1)}; ${ek.join(", ")})` : `${ad} (${ek.join(", ")})`;
};

/**
 * Alış fişi → kuyum e-Gider pusulası girdisi. Mükellef (VKN'li) kişiden alışta belgeyi karşı taraf keser.
 *  - Satır tutarı satıcıya ödenen tutardır (fiş satırı; KDV varsa içinde, K22); belge toplamı fiş toplamıyla aynı.
 *  - Vergi 0003 GV stopajı %0 (vatandaşın kendi eşyası, K23).
 *  - Fişte KDV varsa onay (kdvSifir) olmadan durur: KDV 0 olarak gönderileceği kullanıcıya sorulur (K9).
 *  - Satır adı kuyum biçiminde (milyem, has gram), fiş no not olarak.
 */
export function sarrafGiderGirdisi(
  kaynak: { baslik: SarrafBaslik; satirlar: SarrafSatir[] },
  belgeNo: string,
  secenek: { kdvSifir?: boolean } = {}
): Omit<GiderPusulasiGirdi, "gonderici"> {
  const b = kaynak.baslik;
  if (Number(b.TIP) !== 0) throw ApiError.badRequest("Bu fiş satış fişi; gider pusulası düzenlenmez.");
  if (!kaynak.satirlar.length) throw ApiError.badRequest("Sarraf fişinin satırları bulunamadı.");
  if (kaynak.satirlar.some((s) => sayi(s.TUTAR) < 0)) throw ApiError.badRequest("Sarraf fişinde eksi tutarlı satır var; e-belge düzenlenemez.");
  if (sarrafKdvVar(b) && !secenek.kdvSifir) throw ApiError.conflict(`${KDV_SIFIR_UYARISI} Göndermek için onay gerekir.`);

  const bicim = sarrafPerakendeBicimi({ baslik: { ...b, KDV: 0, KDV_ORANI: 0 }, satirlar: kaynak.satirlar }, belgeNo);
  bicim.satirlar = bicim.satirlar.map((satir, i) => ({ ...satir, URUN_ADI: sarrafKuyumAdi(String(satir.URUN_ADI || ""), kaynak.satirlar[i]) }));
  const girdi = perakendeGiderGirdisi(bicim);
  const fisNo = temiz(b.SARRAF_FIS_NO) || temiz(b.FIS_NO);
  return { ...girdi, vergiTuruKodu: "0003", notlar: fisNo ? [`Sarraf fiş no: ${fisNo}`] : girdi.notlar };
}
