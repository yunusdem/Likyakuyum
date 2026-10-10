import { ApiError } from "../utils/ApiError.js";
import { GiderPusulasiGirdi } from "./ice/ubl/giderPusulasiBuilder.js";
import { UblFaturaGirdi } from "./ice/ubl/invoiceBuilder.js";
import { NIHAI_TUKETICI, PerakendeBaslik, PerakendeSatir, perakendeFaturaGirdisi, perakendeGiderGirdisi } from "./ebelgePerakende.js";

/**
 * Sarraf fişi (TODVZ_SARRAF_FISI) → e-Belge girdisi. Saf dönüşüm; veritabanına ve ICE'ye dokunmaz.
 *
 * Eski e-Belge görünümü (VODVZ_GONDERIME_HAZIR_E_BELGE) yalnız "e-Fatura" seçili ve e-belge başlangıç tarihi tanımlı
 * fişleri listeliyor, belge numarası olarak da fişin iç numarasını (DOC…) veriyordu; bu yüzden yeni programın Sarraf
 * fişleri hiç gönderilemiyordu (10.10.2026). Artık:
 *  - Fiş, belge türü ne olursa olsun listelenir; e-Belge numarası fişin kendi numarasından bağımsız olarak gönderim
 *    anında e-Belge Ayarları'ndaki seriden verilir (firmadan firmaya fiş numarası biçimi değişebilir).
 *  - Satırlar ERP'nin fatura satırı görünümünden (VODVZ_E_FATURA_SATIRI) gelir; KDV / istisna / özel matrah kuralı
 *    Perakende ile aynıdır (%0 → firma muafiyet kodu, KDV küçük matrahtan → özel matrah 805).
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
}

export interface SarrafSatir {
  SATIR_NO: number;
  PARA_ADI?: string | null;
  BIRIM_ADI?: string | null;
  MIKTAR?: number | null;
  TUTAR?: number | null;
  KDV_ORANI?: number | null;
  KDV?: number | null;
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

/** Fiş toplamı = satırların matrah + KDV toplamı (satır görünümü fişin fatura tutarını verir) */
export const sarrafToplam = (satirlar: SarrafSatir[]): number =>
  yuvarla(satirlar.reduce((t, s) => t + yuvarla(sayi(s.TUTAR)) + yuvarla(sayi(s.KDV)), 0));

/** Perakende dönüşümünün beklediği biçime çevirir; belge numarası dışarıdan (seriden) verilir */
export const sarrafPerakendeBicimi = (kaynak: { baslik: SarrafBaslik; satirlar: SarrafSatir[] }, belgeNo: string): { baslik: PerakendeBaslik; satirlar: PerakendeSatir[] } => {
  const b = kaynak.baslik;
  if (!kaynak.satirlar.length) throw ApiError.badRequest("Sarraf fişinin fatura satırları bulunamadı.");
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
    satirlar: kaynak.satirlar.map((s) => ({
      SATIR_NO: Number(s.SATIR_NO),
      URUN_ADI: temiz(s.PARA_ADI) || "Ürün",
      MIKTAR: sayi(s.MIKTAR),
      BIRIM: temiz(s.BIRIM_ADI),
      TUTAR: yuvarla(sayi(s.TUTAR)),
      KDV_ORANI: sayi(s.KDV_ORANI),
      KDV_TUTARI: yuvarla(sayi(s.KDV)),
    })),
  };
};

/** Satış fişi → e-Fatura / e-Arşiv girdisi. Senaryo çağıranda mükellef sorgusuyla kesinleşir. */
export function sarrafFaturaGirdisi(kaynak: { baslik: SarrafBaslik; satirlar: SarrafSatir[] }, belgeNo: string): Omit<UblFaturaGirdi, "gonderici"> {
  if (Number(kaynak.baslik.TIP) === 0) throw ApiError.badRequest("Bu fiş alış fişi; fatura değil gider pusulası düzenlenir.");
  if (Number(kaynak.baslik.BELGE_TURU) === 2) throw ApiError.badRequest("Fişte belge türü e-İrsaliye seçili; e-İrsaliye ekranından gönderin.");
  return perakendeFaturaGirdisi(sarrafPerakendeBicimi(kaynak, belgeNo));
}

/** Alış fişi → e-Gider pusulası girdisi. Mükellef (VKN'li) kişiden alışta belgeyi karşı taraf keser. */
export function sarrafGiderGirdisi(kaynak: { baslik: SarrafBaslik; satirlar: SarrafSatir[] }, belgeNo: string): Omit<GiderPusulasiGirdi, "gonderici"> {
  if (Number(kaynak.baslik.TIP) !== 0) throw ApiError.badRequest("Bu fiş satış fişi; gider pusulası düzenlenmez.");
  return perakendeGiderGirdisi(sarrafPerakendeBicimi(kaynak, belgeNo));
}
