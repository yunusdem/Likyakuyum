import { tutarYaziyla } from "../ebelgeKaynakPdf.js";
const temiz = (v) => (v === null || v === undefined ? "" : String(v).trim());
const sayi = (v, varsayilan = 0) => { const n = Number(v); return Number.isFinite(n) ? n : varsayilan; };
const tarihYaz = (v) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }).replace(/\./g, "-") : "";
};
const saatYaz = (v) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false }) : "";
};
function kimlikEtiketi(no) {
    return no.length === 11 ? "TCKN" : no.length === 10 ? "VKN" : "";
}
export function fisBelgeVerisi(b, kod, s) {
    const fisTipi = Number(b.FIS_TIPI) === 1 ? 1 : 0;
    const satim = fisTipi === 1;
    const belgeNo = temiz(b.BELGE_NO || b.ID).toUpperCase();
    const ettn = temiz(b.ETTN || b.UUID);
    const firmaVkn = temiz(s.hesapVkn) || temiz(b.Supplier_PartyIdentification);
    const firma = {
        unvan: temiz(b.Supplier_PartyName), adSoyad: "",
        adres: temiz(b.Supplier_StreetName), ilce: temiz(b.Supplier_CitySubdivisionName), sehir: temiz(b.Supplier_CityName),
        ulke: temiz(b.Supplier_CountryName) || "Türkiye",
        telefon: temiz(b.Supplier_Telephone), eposta: temiz(b.Supplier_EMail), vergiDairesi: temiz(b.Supplier_TaxSchemeName),
        kimlikNo: firmaVkn, kimlikEtiketi: kimlikEtiketi(firmaVkn) || "VKN", vkn: firmaVkn,
        pasaportNo: "", musteriTuru: "", ticaretSicilNo: temiz(b.TICARET_SICIL_NO),
    };
    // Görünüm, kimliksiz müşteride kimlik kolonuna GERCEKKISI/TUZELKISI etiketi yazar (bkz. dovizGirdisi).
    const kimlikHam = temiz(b.Customer_PartyIdentification_ID || b.Customer_PartyIdentification);
    const turEtiketi = /^(GERCEK_?KISI|TUZEL_?KISI)$/i.test(kimlikHam) ? kimlikHam.toUpperCase().replace("_", "") : "";
    const musteriKimlik = turEtiketi ? "" : kimlikHam;
    const pasaport = temiz(b.Customer_PartyIdentification_PassportID);
    const adSoyad = [temiz(b.Customer_Person_FirstName), temiz(b.Customer_Person_FamilyName)].filter(Boolean).join(" ");
    const musteriUnvan = temiz(b.Customer_PartyName) || temiz(b.UNVAN) || adSoyad;
    const musteri = {
        unvan: musteriUnvan, adSoyad: adSoyad && adSoyad !== musteriUnvan ? adSoyad : "",
        adres: temiz(b.Customer_StreetName), ilce: temiz(b.Customer_CitySubdivisionName), sehir: temiz(b.Customer_CityName),
        ulke: temiz(b.Customer_CountryName) || "Türkiye",
        telefon: temiz(b.Customer_Telephone), eposta: temiz(b.Customer_ElectronicMail), vergiDairesi: temiz(b.Customer_TaxSchemeName),
        kimlikNo: musteriKimlik, kimlikEtiketi: kimlikEtiketi(musteriKimlik), vkn: musteriKimlik,
        pasaportNo: pasaport, musteriTuru: turEtiketi || (musteriKimlik.length === 10 ? "TUZELKISI" : "GERCEKKISI"),
        ticaretSicilNo: "",
    };
    const miktar = sayi(b.MIKTAR);
    const kur = sayi(b.TL_KARSILIK_KURU ?? b.KUR);
    const usdKuru = sayi(b.DOLAR_KARSILIK_KURU ?? b.DOLAR_KURU ?? b.PricingExchangeRate);
    const net = sayi(b.TaxInclusiveAmount ?? b.PayableAmount);
    const tl = sayi(b.LineExtensionAmount ?? b.PayableAmount ?? net);
    const bsmv = sayi(b.TaxAmount ?? b.BMV);
    const tutar = {
        miktar, kod: temiz(b.PARA_KODU || b.CurrencyCode), kur, usdKuru,
        usdKarsiligi: usdKuru > 0 ? miktar * usdKuru : (temiz(b.PARA_KODU) === "USD" ? miktar : 0),
        tl, bsmv, net, yaziyla: tutarYaziyla(net),
    };
    const tarihKaynak = b.IssueDate || b.TARIH;
    const hesapVkn = temiz(s.hesapVkn) || firmaVkn;
    const erisimAdresi = ettn && hesapVkn ? `http://ebelge.iceteknoloji.com.tr/edoviz/ettn/${hesapVkn}/${ettn}` : "";
    const tipAdi = satim ? "SATIM" : "ALIM";
    // Büyük QR (yönetici kararı G1): belgeyi tanımlayan özet. ICE'nin resmî QR'ı gönderilmiş belgede ICE PDF'inden gelir.
    const qrBuyuk = JSON.stringify({
        belgeNo, tip: tipAdi, tarih: tarihYaz(tarihKaynak), vkn: hesapVkn,
        musteri: musteriKimlik || pasaport || musteri.musteriTuru,
        doviz: `${tutar.miktar} ${tutar.kod}`, kur, tutar: net, ettn: ettn || null,
    });
    return {
        kod, belgeNo, ettn, fisId: Number(b.BELGE_ID ?? b.FIS_ID) || 0, fisTipi, satim, tipAdi,
        islemEtiketi: satim ? "SATILAN" : "SATIN ALINAN",
        urunEtiketi: satim ? "Satılan Ürün" : "Satın Alınan Ürün",
        tarih: tarihYaz(tarihKaynak), saat: saatYaz(b.IssueTime || b.TARIH),
        dosyaNo: temiz(s.dosyaNo), istatistikNo: temiz(b.ISTATISTIK_NO || b.ISTATISTIK_KOD),
        senaryo: temiz(b.ProfileId) || "EDOVIZBELGE", vezne: temiz(b.VEZNE_KODU),
        firma, musteri, tutar,
        onizleme: s.onizleme, iptal: Number(b.IPTAL || 0) !== 0, hesapVkn, erisimAdresi,
        qrBuyuk, qrKucuk: erisimAdresi,
    };
}
