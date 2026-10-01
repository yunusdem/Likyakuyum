/** Tanım listesini, koda göre değer veren bir fonksiyonla gruplara çevirir (sıra tanımdaki gibi). */
export const gruplariKur = (tanimlar, deger) => tanimlar.map((t) => ({
    kod: t.kod,
    baslik: t.baslik,
    tur: t.tur ?? "alis-satis",
    satirlar: t.satirlar.flatMap(([kod, ad, ortakKod, altAd]) => {
        const d = deger(kod);
        return d ? [{ kod, ad, ...(ortakKod ? { ortakKod } : {}), ...(altAd ? { altAd } : {}), ...d }] : [];
    }),
}));
export const DOVIZ_ADLARI = {
    USD: "Amerikan Doları",
    EUR: "Euro",
    GBP: "İngiliz Sterlini",
    CHF: "İsviçre Frangı",
    AUD: "Avustralya Doları",
    CAD: "Kanada Doları",
    SAR: "Suudi Riyali",
    JPY: "Japon Yeni",
    KWD: "Kuveyt Dinarı",
    JOD: "Ürdün Dinarı",
    AED: "BAE Dirhemi",
    QAR: "Katar Riyali",
    DKK: "Danimarka Kronu",
    SEK: "İsveç Kronu",
    NOK: "Norveç Kronu",
    RUB: "Rus Rublesi",
    AZN: "Azerbaycan Manatı",
    CNY: "Çin Yuanı",
    RON: "Romanya Leyi",
    BGN: "Bulgar Levası",
    SGD: "Singapur Doları",
    SEPET: "Döviz Sepeti",
};
