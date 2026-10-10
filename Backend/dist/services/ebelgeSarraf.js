import { ApiError } from "../utils/ApiError.js";
import { NIHAI_TUKETICI, perakendeFaturaGirdisi, perakendeGiderGirdisi } from "./ebelgePerakende.js";
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
export const sarrafKaynakTuru = (tip, belgeTuru) => Number(tip) === 0 ? 3 : Number(belgeTuru) === 2 ? 2 : 1;
const temiz = (v) => String(v ?? "").trim();
const yuvarla = (n) => Math.round(n * 100) / 100;
const sayi = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
/** Alıcı / satıcı kimliği: rakam dışı karakterler atılır, boşsa nihai tüketici */
export const sarrafAliciVkn = (b) => temiz(b.VERGI_KIMLIK_NO).replace(/\D/g, "") || NIHAI_TUKETICI;
/** Fiş toplamı = satır tutarlarının toplamı (Sarraf fişindeki toplam; KDV içinde) */
export const sarrafToplam = (satirlar) => yuvarla(satirlar.reduce((t, s) => t + yuvarla(sayi(s.TUTAR)), 0));
/**
 * Fiş KDV'sinin satırlara dağılımı: işçilik has gramı oranında (fişte KDV böyle hesaplanıyor); işçilik has gramı
 * yoksa tutar oranında. Kuruş artığı son payı olan satıra yazılır.
 */
export const sarrafSatirKdvleri = (b, satirlar) => {
    const kdv = yuvarla(Math.max(0, sayi(b.KDV)));
    if (!kdv || sayi(b.KDV_ORANI) <= 0)
        return satirlar.map(() => 0);
    const iscilik = satirlar.map((s) => Math.max(0, sayi(s.ISCILIK_HAS_GRAM)));
    const agirlik = iscilik.some((x) => x > 0) ? iscilik : satirlar.map((s) => Math.max(0, sayi(s.TUTAR)));
    const toplam = agirlik.reduce((t, x) => t + x, 0);
    if (toplam <= 0)
        return satirlar.map(() => 0);
    const paylar = agirlik.map((x) => yuvarla((kdv * x) / toplam));
    const son = agirlik.reduce((s, x, i) => (x > 0 ? i : s), 0);
    paylar[son] = yuvarla(paylar[son] + (kdv - paylar.reduce((t, x) => t + x, 0)));
    return paylar;
};
/**
 * Satırın faturadaki miktarı ve birimi: adetli satır adet (C62), değilse gram (GRM). Birim fiyat kuruşla tam
 * bölünmüyorsa (ör. 100 TL / 3 adet) miktar 1 alınır, adet / gram ürün adına yazılır; toplam fişle birebir kalır.
 */
export const sarrafSatirMiktari = (s, tutar) => {
    const ad = temiz(s.URUN_ADI) || "Ürün";
    const adet = sayi(s.ADET);
    const gram = sayi(s.MIKTAR);
    const gramYazi = gram > 0 ? `${gram.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} gr` : "";
    const aday = adet > 0 ? { ad: gramYazi ? `${ad} (${gramYazi})` : ad, miktar: adet, birim: "C62" }
        : gram > 0 ? { ad, miktar: gram, birim: Number(s.URUN_BIRIM) === 1 ? "GRM" : "C62" }
            : { ad, miktar: 1, birim: "C62" };
    const birimFiyat = yuvarla(tutar / aday.miktar);
    // Tam eşitlik: kuruş farkı bile faturayı fişten (POS'tan çekilenden) ayırır
    if (Math.abs(yuvarla(birimFiyat * aday.miktar) - tutar) < 0.005)
        return aday;
    const ek = [adet > 0 ? `${adet} adet` : "", gramYazi].filter(Boolean).join(", ");
    return { ad: ek ? `${ad} (${ek})` : ad, miktar: 1, birim: "C62" };
};
/** Perakende dönüşümünün beklediği biçime çevirir; belge numarası dışarıdan (seriden) verilir */
export const sarrafPerakendeBicimi = (kaynak, belgeNo) => {
    const b = kaynak.baslik;
    if (!kaynak.satirlar.length)
        throw ApiError.badRequest("Sarraf fişinin satırları bulunamadı.");
    if (kaynak.satirlar.some((s) => sayi(s.TUTAR) < 0))
        throw ApiError.badRequest("Sarraf fişinde eksi tutarlı satır var; e-belge düzenlenemez.");
    const kdvler = sarrafSatirKdvleri(b, kaynak.satirlar);
    const kdvVar = kdvler.some((x) => x > 0);
    if (kdvler.some((k, i) => k > yuvarla(sayi(kaynak.satirlar[i].TUTAR))))
        throw ApiError.badRequest("Fişteki KDV satır tutarından büyük; fişi kontrol edin.");
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
/** Satış fişi → e-Fatura / e-Arşiv girdisi. Senaryo çağıranda mükellef sorgusuyla kesinleşir. */
export function sarrafFaturaGirdisi(kaynak, belgeNo) {
    if (Number(kaynak.baslik.TIP) === 0)
        throw ApiError.badRequest("Bu fiş alış fişi; fatura değil gider pusulası düzenlenir.");
    if (Number(kaynak.baslik.BELGE_TURU) === 2)
        throw ApiError.badRequest("Fişte belge türü e-İrsaliye seçili; e-İrsaliye ekranından gönderin.");
    return perakendeFaturaGirdisi(sarrafPerakendeBicimi(kaynak, belgeNo));
}
/** Alış fişi → e-Gider pusulası girdisi. Mükellef (VKN'li) kişiden alışta belgeyi karşı taraf keser. */
export function sarrafGiderGirdisi(kaynak, belgeNo) {
    if (Number(kaynak.baslik.TIP) !== 0)
        throw ApiError.badRequest("Bu fiş satış fişi; gider pusulası düzenlenmez.");
    return perakendeGiderGirdisi(sarrafPerakendeBicimi(kaynak, belgeNo));
}
