import { randomUUID } from "crypto";
import { escapeXml } from "../ice.client.js";
import { ApiError } from "../../../utils/ApiError.js";
/** Yatırım teşvik belgesi (YTB No / Tarihi) isteyen tipler. */
export const ytbTipiMi = (t) => t === "YTBSATIS" || t === "YTBISTISNA" || t === "YTBIADE";
/** İade niteliğindeki tipler: dayanak fatura (`cac:BillingReference`) zorunludur. */
export const iadeTipiMi = (t) => t === "IADE" || t === "TEVKIFATIADE" || t === "YTBIADE";
/** Tevkifatlı satır taşıyabilen tipler. */
export const tevkifatTipiMi = (t) => t === "TEVKIFAT" || t === "TEVKIFATIADE";
/* ==========================================================================
   Yardımcılar
   ========================================================================== */
/** Para alanları için 2 haneli, nokta ayraçlı biçim (UBL zorunluluğu) */
const tutar = (n) => (Math.round(n * 100) / 100).toFixed(2);
/** Miktar alanları daha hassas olabilir */
const miktar = (n) => String(Math.round(n * 100000) / 100000);
const bugun = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const simdi = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Istanbul", hour12: false });
const etiket = (ad, deger, oznitelik = "") => {
    if (deger === undefined || deger === null || String(deger).trim() === "")
        return "";
    return `<${ad}${oznitelik}>${escapeXml(deger)}</${ad}>`;
};
/** VKN mi TCKN mi? UBL'de schemeID olarak gider. */
export const kimlikSemasi = (vknTckn) => (vknTckn.length === 11 ? "TCKN" : "VKN");
/* ==========================================================================
   Doğrulama ve hesaplama
   ========================================================================== */
export const dogrulaGirdi = (girdi) => {
    if (!girdi.belgeNo?.trim())
        throw ApiError.badRequest("Fatura numarası zorunludur.");
    if (!/^[A-Z0-9]{3}\d{13}$/.test(girdi.belgeNo.trim())) {
        throw ApiError.badRequest("Fatura numarası 3 karakter seri + 13 hane (yıl + sıra) biçiminde olmalıdır. Örnek: ABC2026000000001");
    }
    if (!girdi.gonderici?.vknTckn?.trim())
        throw ApiError.badRequest("Gönderici VKN/TCKN zorunludur.");
    if (!girdi.alici?.vknTckn?.trim())
        throw ApiError.badRequest("Alıcı VKN/TCKN zorunludur.");
    const tarih = girdi.tarih || bugun();
    const d = new Date(tarih);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== tarih) {
        throw ApiError.badRequest("Geçerli bir düzenleme tarihi giriniz (GG.AA.YYYY).");
    }
    const belgeYili = girdi.belgeNo.trim().slice(3, 7);
    if (belgeYili !== tarih.slice(0, 4)) {
        // Sık yapılan hata: seri numarası elle yazılırken yıl bloğu atlanıyor.
        throw ApiError.badRequest(`Belge numarasındaki yıl (${belgeYili}) düzenleme tarihinin yılıyla (${tarih.slice(0, 4)}) uyuşmuyor. ` +
            `Fatura numarası 3 karakter seri + yıl + 9 haneli sıra olmalıdır. Örnek: ${girdi.belgeNo.trim().slice(0, 3)}${tarih.slice(0, 4)}000000001`);
    }
    if (!/^[A-Z]{3}$/.test((girdi.paraBirimi || "TRY").toUpperCase())) {
        throw ApiError.badRequest("Para birimi üç harfli kod olmalıdır.");
    }
    for (const [ad, taraf] of [
        ["Gönderici", girdi.gonderici],
        ["Alıcı", girdi.alici],
    ]) {
        const kimlik = taraf.vknTckn.trim();
        if (!/^\d{10}$|^\d{11}$/.test(kimlik)) {
            throw ApiError.badRequest(`${ad} VKN/TCKN 10 veya 11 haneli rakam olmalıdır.`);
        }
        if (kimlik.length === 11 && !(taraf.ad?.trim() && taraf.soyad?.trim())) {
            throw ApiError.badRequest(`${ad} TCKN ile tanımlandığında ad ve soyad zorunludur.`);
        }
        if (!taraf.unvan?.trim() && !(taraf.ad?.trim() && taraf.soyad?.trim())) {
            throw ApiError.badRequest(`${ad} için unvan ya da ad+soyad girilmelidir.`);
        }
        // UBL-TR AddressType'ta CitySubdivisionName (ilçe) ve CityName (il) zorunludur;
        // eksikse ICE şema doğrulaması "PostalAddress ... geçersiz Country alt öğesi" der.
        if (!taraf.ilce?.trim() || !taraf.il?.trim()) {
            throw ApiError.badRequest(`${ad} adresinde il ve ilçe zorunludur (UBL-TR kuralı).` +
                (ad === "Gönderici" ? " E-Belge → Bağlantı Ayarları ekranından firma il/ilçe bilgisini giriniz." : ""));
        }
    }
    if (!girdi.satirlar?.length)
        throw ApiError.badRequest("Faturada en az bir satır bulunmalıdır.");
    girdi.satirlar.forEach((satir, i) => {
        const no = i + 1;
        if (![satir.miktar, satir.birimFiyat, satir.kdvOrani, satir.iskontoOrani ?? 0].every(Number.isFinite)) {
            throw ApiError.badRequest(`${no}. satırdaki sayısal değerler sonlu olmalıdır.`);
        }
        if (!satir.ad?.trim())
            throw ApiError.badRequest(`${no}. satırda mal/hizmet adı zorunludur.`);
        if (!(satir.miktar > 0))
            throw ApiError.badRequest(`${no}. satırda miktar sıfırdan büyük olmalıdır.`);
        if (satir.birimFiyat < 0)
            throw ApiError.badRequest(`${no}. satırda birim fiyat negatif olamaz.`);
        if (satir.kdvOrani < 0 || satir.kdvOrani > 100) {
            throw ApiError.badRequest(`${no}. satırda KDV oranı 0-100 aralığında olmalıdır.`);
        }
        if (satir.iskontoOrani != null && (satir.iskontoOrani < 0 || satir.iskontoOrani >= 100)) {
            throw ApiError.badRequest(`${no}. satırda iskonto oranı 0-100 aralığında olmalıdır.`);
        }
        if (satir.iskontoTutari != null) {
            const brut = satir.miktar * satir.birimFiyat;
            if (!Number.isFinite(satir.iskontoTutari) || satir.iskontoTutari < 0) {
                throw ApiError.badRequest(`${no}. satırda iskonto tutarı sıfır ya da pozitif olmalıdır.`);
            }
            if (satir.iskontoTutari > brut) {
                throw ApiError.badRequest(`${no}. satırda iskonto tutarı satır tutarını aşamaz.`);
            }
        }
        const istisnaKodu = satir.istisnaKodu?.trim();
        // 14.09.2026 kuralı: 555 sıfır KDV ile kullanılamaz; diğer istisnalar sıfır KDV ister.
        if (istisnaKodu === "555" && satir.kdvOrani === 0) {
            throw ApiError.badRequest(`${no}. satırda 555 vergi muafiyet kodu KDV 0 ile kullanılamaz.`);
        }
        if (istisnaKodu === "555" && (girdi.senaryo === "YATIRIMTESVIK" || girdi.senaryo === "KAMU")) {
            throw ApiError.badRequest(`${no}. satırda 555 vergi muafiyet kodu özel senaryolu faturada kullanılamaz.`);
        }
        if (istisnaKodu && istisnaKodu !== "555" && satir.kdvOrani !== 0) {
            throw ApiError.badRequest(`${no}. satırda KDV istisnası bildirilmiş ancak KDV oranı ${satir.kdvOrani}. İstisnalı satırda oran 0 olmalıdır.`);
        }
        if (satir.kdvOrani === 0 && !istisnaKodu) {
            throw ApiError.badRequest(`${no}. satırda KDV oranı 0 ancak istisna kodu yok. Sıfır oranlı satış için GİB istisna kodu zorunludur.`);
        }
        if ((istisnaKodu === "308" || istisnaKodu === "339") && girdi.senaryo !== "YATIRIMTESVIK") {
            throw ApiError.badRequest(`${no}. satırda ${istisnaKodu} kodu yalnızca YATIRIMTESVIK profilinde kullanılabilir.`);
        }
        // Tevkifat: kod ve oran birlikte verilmelidir
        const tevkifatKod = satir.tevkifatKodu?.trim();
        const tevkifatOran = satir.tevkifatOrani;
        if (Boolean(tevkifatKod) !== Boolean(tevkifatOran)) {
            throw ApiError.badRequest(`${no}. satırda tevkifat kodu ve oranı birlikte verilmelidir.`);
        }
        if (tevkifatOran != null) {
            if (!Number.isFinite(tevkifatOran) || tevkifatOran <= 0 || tevkifatOran > 100) {
                throw ApiError.badRequest(`${no}. satırda tevkifat oranı 0-100 aralığında olmalıdır.`);
            }
            if (satir.kdvOrani === 0) {
                throw ApiError.badRequest(`${no}. satırda KDV yokken tevkifat uygulanamaz; tevkifat KDV tutarı üzerinden hesaplanır.`);
            }
            if (!tevkifatTipiMi(girdi.faturaTipi)) {
                throw ApiError.badRequest("Tevkifatlı satır bulunan faturanın tipi TEVKIFAT olmalıdır.");
            }
        }
        // Özel matrah: kod ve tutar birlikte, yalnızca OZELMATRAH tipinde
        const omKod = satir.ozelMatrahKodu?.trim();
        if (Boolean(omKod) !== (satir.ozelMatrahTutari != null)) {
            throw ApiError.badRequest(`${no}. satırda özel matrah kodu ve özel matrah tutarı birlikte verilmelidir.`);
        }
        if (omKod) {
            if (girdi.faturaTipi !== "OZELMATRAH") {
                throw ApiError.badRequest("Özel matrahlı satır bulunan faturanın tipi OZELMATRAH olmalıdır.");
            }
            if (!/^8(0[1-9]|1[0-2])$/.test(omKod)) {
                throw ApiError.badRequest(`${no}. satırda özel matrah kodu 801-812 aralığında olmalıdır.`);
            }
            if (!Number.isFinite(satir.ozelMatrahTutari) || satir.ozelMatrahTutari < 0) {
                throw ApiError.badRequest(`${no}. satırda özel matrah tutarı sıfır ya da pozitif bir sayı olmalıdır.`);
            }
            if (istisnaKodu) {
                throw ApiError.badRequest(`${no}. satırda özel matrah ile KDV istisna kodu birlikte kullanılamaz.`);
            }
            if (!(satir.kdvOrani > 0)) {
                throw ApiError.badRequest(`${no}. satırda özel matrah KDV oranı olmadan kullanılamaz.`);
            }
        }
    });
    if (girdi.faturaTipi === "OZELMATRAH" && !girdi.satirlar.some((x) => x.ozelMatrahKodu?.trim())) {
        throw ApiError.badRequest("OZELMATRAH tipi faturada en az bir satırda özel matrah kodu ve tutarı olmalıdır.");
    }
    // Tevkifat tipinde en az bir tevkifatlı satır aranır
    if (tevkifatTipiMi(girdi.faturaTipi) && !girdi.satirlar.some((x) => x.tevkifatKodu?.trim())) {
        throw ApiError.badRequest(`${girdi.faturaTipi} tipi faturada en az bir satırda tevkifat bilgisi olmalıdır.`);
    }
    // İade faturasında dayanak fatura zorunlu
    if (iadeTipiMi(girdi.faturaTipi)) {
        const iadeProfilleri = ["TEMELFATURA", "TICARIFATURA", "EARSIVFATURA", "YATIRIMTESVIK", "KAMU"];
        if (!iadeProfilleri.includes(girdi.senaryo)) {
            throw ApiError.badRequest(`${girdi.faturaTipi} fatura tipi ${girdi.senaryo} profilinde kullanılamaz.`);
        }
        if (!girdi.iadeFaturalar?.length) {
            throw ApiError.badRequest("İade faturasında iade edilen fatura bilgisi zorunludur.");
        }
        girdi.iadeFaturalar.forEach((ref, i) => {
            if (!ref.belgeNo?.trim()) {
                throw ApiError.badRequest(`${i + 1}. iade referansında fatura numarası zorunludur.`);
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(ref.tarih || "")) {
                throw ApiError.badRequest(`${i + 1}. iade referansının tarihi YYYY-AA-GG biçiminde olmalıdır.`);
            }
        });
    }
    if (girdi.faturaTipi === "TEKNOLOJIDESTEK" && girdi.senaryo !== "EARSIVFATURA") {
        throw ApiError.badRequest("TEKNOLOJIDESTEK fatura tipi yalnızca EARSIVFATURA profilinde kullanılabilir.");
    }
    if (!iadeTipiMi(girdi.faturaTipi) && girdi.iadeFaturalar?.length) {
        throw ApiError.badRequest("İade referansı yalnızca IADE tipi faturada kullanılabilir.");
    }
    // Dövizli belgede kur zorunlu
    const pb = (girdi.paraBirimi || "TRY").toUpperCase();
    if (pb !== "TRY") {
        const kur = girdi.dovizKuru?.kur;
        if (kur == null || !Number.isFinite(kur) || kur <= 0) {
            throw ApiError.badRequest(`${pb} cinsinden belgede TL karşılığı kur bilgisi zorunludur.`);
        }
    }
    // Senaryoya bağlı zorunluluklar (ICE formundaki blokların karşılığı)
    if (girdi.senaryo === "IHRACAT" && !girdi.ihracat?.firmaUnvani?.trim()) {
        throw ApiError.badRequest("İhracat faturasında ihracat yapılacak firmanın unvanı zorunludur.");
    }
    if (girdi.senaryo === "YOLCUBERABERFATURA") {
        if (!girdi.turist?.pasaportNo?.trim()) {
            throw ApiError.badRequest("Yolcu beraberi eşya faturasında turistin pasaport numarası zorunludur.");
        }
        if (!(girdi.turist?.ad?.trim() && girdi.turist?.soyad?.trim())) {
            throw ApiError.badRequest("Yolcu beraberi eşya faturasında turistin adı ve soyadı zorunludur.");
        }
    }
    if (girdi.senaryo === "IDIS" && !girdi.idisSevkiyatNo?.trim()) {
        throw ApiError.badRequest("IDIS faturasında sevkiyat numarası zorunludur.");
    }
    // YTB numarası yalnızca e-Arşiv'in YTB tiplerinde zorunlu tutulur; YATIRIMTESVIK profilinde
    // bugüne kadar numarasız belge kesilebildiği için o akış bozulmaz.
    if (ytbTipiMi(girdi.faturaTipi) && !girdi.ytb?.no?.trim()) {
        throw ApiError.badRequest("YTB fatura tiplerinde yatırım teşvik belge numarası zorunludur.");
    }
    if (ytbTipiMi(girdi.faturaTipi) && girdi.senaryo !== "EARSIVFATURA") {
        throw ApiError.badRequest("YTB fatura tipleri yalnızca e-Arşiv faturada kullanılabilir.");
    }
    if ((girdi.faturaTipi === "HALTIPISATIS" || girdi.faturaTipi === "HALTIPIKOMISYONCU") &&
        girdi.senaryo !== "EARSIVFATURA" && girdi.senaryo !== "HKS") {
        throw ApiError.badRequest("Hal tipi fatura tipleri yalnızca e-Arşiv ya da Hal Tipi profilinde kullanılabilir.");
    }
    (girdi.halMasraflari || []).forEach((m, i) => {
        if (!m.ad?.trim())
            throw ApiError.badRequest(`${i + 1}. masraf satırında açıklama zorunludur.`);
        if (!Number.isFinite(m.tutar) || m.tutar < 0)
            throw ApiError.badRequest(`${i + 1}. masraf satırında tutar sıfır ya da pozitif olmalıdır.`);
    });
    const tarihGecerli = (t) => !t || /^\d{4}-\d{2}-\d{2}$/.test(t);
    if (!tarihGecerli(girdi.siparis?.tarih))
        throw ApiError.badRequest("Sipariş tarihi YYYY-AA-GG biçiminde olmalıdır.");
    if (!tarihGecerli(girdi.ytb?.tarih))
        throw ApiError.badRequest("YTB tarihi YYYY-AA-GG biçiminde olmalıdır.");
    if (!tarihGecerli(girdi.turist?.pasaportTarihi))
        throw ApiError.badRequest("Pasaport tarihi YYYY-AA-GG biçiminde olmalıdır.");
    (girdi.irsaliyeler || []).forEach((r, i) => {
        if (!r.no?.trim())
            throw ApiError.badRequest(`${i + 1}. irsaliye satırında irsaliye numarası zorunludur.`);
        if (!tarihGecerli(r.tarih))
            throw ApiError.badRequest(`${i + 1}. irsaliye satırının tarihi YYYY-AA-GG biçiminde olmalıdır.`);
    });
    (girdi.ekBelgeler || []).forEach((r, i) => {
        if (!r.no?.trim())
            throw ApiError.badRequest(`${i + 1}. ek belge satırında belge numarası zorunludur.`);
        if (!tarihGecerli(r.tarih))
            throw ApiError.badRequest(`${i + 1}. ek belge satırının tarihi YYYY-AA-GG biçiminde olmalıdır.`);
    });
    if (!tarihGecerli(girdi.okc?.fisTarihi))
        throw ApiError.badRequest("ÖKC fiş tarihi YYYY-AA-GG biçiminde olmalıdır.");
    if (girdi.okc?.fisSaati && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(girdi.okc.fisSaati)) {
        throw ApiError.badRequest("ÖKC fiş saati SS:DD biçiminde olmalıdır.");
    }
    if (girdi.iban?.iban?.trim() && !/^TR\d{24}$/.test(girdi.iban.iban.replace(/\s/g, "").toUpperCase())) {
        throw ApiError.badRequest("IBAN 'TR' ile başlayan 26 karakter olmalıdır.");
    }
    // İhraç kayıtlı: KDV'nin tecil/ödenecek tutara etkisi doğrulanmış örnek olmadan yazılmaz
    if (girdi.faturaTipi === "IHRACKAYITLI") {
        throw ApiError.unprocessable("İhraç kayıtlı fatura bu üreteçte henüz desteklenmiyor. Yapısı doğrulanmış bir GİB/ICE örneğiyle eklenecektir.");
    }
};
/**
 * Tutarları satırlardan yeniden hesaplar.
 * İstemciden gelen toplamlar **kullanılmaz**.
 */
export const hesapla = (satirlar) => {
    const yuvarla = (n) => Math.round(n * 100) / 100;
    const satirHesaplari = satirlar.map((satir, i) => {
        const brut = yuvarla(satir.miktar * satir.birimFiyat);
        // Elle girilen iskonto tutarı orandan önce gelir (ICE formundaki "İskonto Tutarı" kolonu)
        const iskonto = satir.iskontoTutari != null
            ? yuvarla(satir.iskontoTutari)
            : yuvarla((brut * (satir.iskontoOrani || 0)) / 100);
        const matrah = yuvarla(brut - iskonto);
        // Özel matrahlı satırda KDV, satır tutarı yerine bildirilen özel matrah üzerinden hesaplanır
        const kdvMatrahi = satir.ozelMatrahKodu?.trim() ? yuvarla(satir.ozelMatrahTutari || 0) : matrah;
        const kdvTutari = yuvarla((kdvMatrahi * satir.kdvOrani) / 100);
        // Tevkifat KDV tutarı üzerinden hesaplanır, matrah üzerinden değil
        const tevkifatTutari = yuvarla((kdvTutari * (satir.tevkifatOrani || 0)) / 100);
        return { siraNo: i + 1, matrah, kdvMatrahi, iskonto, kdvTutari, kdvOrani: satir.kdvOrani, tevkifatTutari };
    });
    const malHizmetToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.matrah, 0));
    const iskontoToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.iskonto, 0));
    const kdvToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.kdvTutari, 0));
    const tevkifatToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.tevkifatTutari, 0));
    // KDV grupları — istisna bilgisi oranla birlikte taşınır
    const gruplar = new Map();
    satirHesaplari.forEach((h, i) => {
        const kaynak = satirlar[i];
        // Özel matrah kodu da istisna kodu gibi TaxExemptionReasonCode alanında taşınır; ikisi aynı satırda bulunamaz
        const kod = kaynak.ozelMatrahKodu?.trim() || kaynak.istisnaKodu;
        const anahtar = `${h.kdvOrani}|${kod || ""}`;
        const mevcut = gruplar.get(anahtar) || {
            oran: h.kdvOrani,
            matrah: 0,
            vergi: 0,
            istisnaKodu: kod,
            istisnaGerekcesi: kaynak.ozelMatrahKodu?.trim() ? kaynak.ozelMatrahGerekcesi : kaynak.istisnaGerekcesi,
        };
        gruplar.set(anahtar, {
            ...mevcut,
            matrah: yuvarla(mevcut.matrah + h.kdvMatrahi),
            vergi: yuvarla(mevcut.vergi + h.kdvTutari),
        });
    });
    // Tevkifat grupları — kod bazında
    const tevkifatMap = new Map();
    satirHesaplari.forEach((h, i) => {
        const kaynak = satirlar[i];
        if (!kaynak.tevkifatKodu || !kaynak.tevkifatOrani)
            return;
        const anahtar = `${kaynak.tevkifatKodu}|${kaynak.tevkifatOrani}`;
        const mevcut = tevkifatMap.get(anahtar) || {
            kod: kaynak.tevkifatKodu,
            oran: kaynak.tevkifatOrani,
            matrah: 0,
            vergi: 0,
        };
        tevkifatMap.set(anahtar, {
            ...mevcut,
            // Tevkifatın matrahı KDV tutarıdır
            matrah: yuvarla(mevcut.matrah + h.kdvTutari),
            vergi: yuvarla(mevcut.vergi + h.tevkifatTutari),
        });
    });
    return {
        satirlar: satirHesaplari,
        malHizmetToplam,
        iskontoToplam,
        kdvToplam,
        vergiHaricToplam: malHizmetToplam,
        // Tevkifat KDV'den kesilir; ödenecek tutar bu kadar azalır
        odenecekTutar: yuvarla(malHizmetToplam + kdvToplam - tevkifatToplam),
        tevkifatToplam,
        kdvGruplari: [...gruplar.values()].sort((a, b) => a.oran - b.oran),
        tevkifatGruplari: [...tevkifatMap.values()].sort((a, b) => a.kod.localeCompare(b.kod)),
    };
};
/* ==========================================================================
   XML parçaları
   ========================================================================== */
const partyXml = (taraf, varsayilanUlke = "Türkiye") => {
    const kimlik = taraf.vknTckn.trim();
    const sema = kimlikSemasi(kimlik);
    const kisiAdi = [taraf.ad?.trim(), taraf.soyad?.trim()].filter(Boolean).join(" ");
    const gosterilecekUnvan = taraf.unvan?.trim() || kisiAdi;
    return (`<cac:Party>` +
        etiket("cbc:WebsiteURI", taraf.webAdresi) +
        `<cac:PartyIdentification><cbc:ID schemeID="${sema}">${escapeXml(kimlik)}</cbc:ID></cac:PartyIdentification>` +
        (gosterilecekUnvan ? `<cac:PartyName><cbc:Name>${escapeXml(gosterilecekUnvan)}</cbc:Name></cac:PartyName>` : "") +
        `<cac:PostalAddress>` +
        etiket("cbc:Room", taraf.kapiNo) +
        etiket("cbc:StreetName", taraf.adres) +
        etiket("cbc:BuildingName", taraf.binaAdi) +
        etiket("cbc:BuildingNumber", taraf.binaNo) +
        etiket("cbc:CitySubdivisionName", taraf.ilce) +
        etiket("cbc:CityName", taraf.il) +
        etiket("cbc:PostalZone", taraf.postaKodu) +
        `<cac:Country><cbc:Name>${escapeXml(taraf.ulke || varsayilanUlke)}</cbc:Name></cac:Country>` +
        `</cac:PostalAddress>` +
        (taraf.vergiDairesi?.trim()
            ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${escapeXml(taraf.vergiDairesi)}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>`
            : "") +
        (taraf.telefon?.trim() || taraf.faks?.trim() || taraf.eposta?.trim()
            ? `<cac:Contact>` +
                etiket("cbc:Telephone", taraf.telefon) +
                etiket("cbc:Telefax", taraf.faks) +
                etiket("cbc:ElectronicMail", taraf.eposta) +
                `</cac:Contact>`
            : "") +
        // Gerçek kişide ad/soyad ayrıca cac:Person içinde de bildirilir
        (sema === "TCKN" && taraf.ad?.trim() && taraf.soyad?.trim()
            ? `<cac:Person><cbc:FirstName>${escapeXml(taraf.ad)}</cbc:FirstName>` +
                `<cbc:FamilyName>${escapeXml(taraf.soyad)}</cbc:FamilyName></cac:Person>`
            : "") +
        `</cac:Party>`);
};
/**
 * KDV alt toplamı. İstisna verilirse `cac:TaxCategory` içine
 * `TaxExemptionReasonCode` + `TaxExemptionReason` eklenir.
 *
 * Alan sırası UBL-TR `TaxCategoryType` sequence'ı ile aynıdır:
 * `Name` → `TaxExemptionReasonCode` → `TaxExemptionReason` → `TaxScheme`
 * (kaynak: ICE paketindeki `UBL/UBLTR-Invoice-2_1.cs`).
 */
const kdvTaxSubtotalXml = (matrahTutari, vergiTutari, oran, paraBirimi, istisna) => `<cac:TaxSubtotal>` +
    `<cbc:TaxableAmount currencyID="${paraBirimi}">${tutar(matrahTutari)}</cbc:TaxableAmount>` +
    `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(vergiTutari)}</cbc:TaxAmount>` +
    `<cbc:Percent>${oran}</cbc:Percent>` +
    `<cac:TaxCategory>` +
    `<cbc:Name>KDV</cbc:Name>` +
    (istisna?.kod?.trim()
        ? `<cbc:TaxExemptionReasonCode>${escapeXml(istisna.kod)}</cbc:TaxExemptionReasonCode>`
        : "") +
    (istisna?.gerekce?.trim()
        ? `<cbc:TaxExemptionReason>${escapeXml(istisna.gerekce)}</cbc:TaxExemptionReason>`
        : "") +
    `<cac:TaxScheme>` +
    `<cbc:TaxTypeCode>0015</cbc:TaxTypeCode>` +
    `</cac:TaxScheme></cac:TaxCategory>` +
    `</cac:TaxSubtotal>`;
/** Tevkifat alt toplamı — vergi kodu tevkifat listesinden gelir */
const tevkifatSubtotalXml = (matrahTutari, vergiTutari, oran, kod, paraBirimi) => `<cac:TaxSubtotal>` +
    `<cbc:TaxableAmount currencyID="${paraBirimi}">${tutar(matrahTutari)}</cbc:TaxableAmount>` +
    `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(vergiTutari)}</cbc:TaxAmount>` +
    `<cbc:Percent>${oran}</cbc:Percent>` +
    `<cac:TaxCategory><cac:TaxScheme>` +
    `<cbc:TaxTypeCode>${escapeXml(kod)}</cbc:TaxTypeCode>` +
    `</cac:TaxScheme></cac:TaxCategory>` +
    `</cac:TaxSubtotal>`;
/**
 * Ek belge referansı. UBL `DocumentReferenceType` sequence: ID → IssueDate → DocumentTypeCode →
 * DocumentType → ... Sıra bozulursa şema hatası alınır.
 */
const belgeReferansXml = (etiketAdi, r) => `<${etiketAdi}>` +
    `<cbc:ID>${escapeXml(r.no.trim())}</cbc:ID>` +
    etiket("cbc:IssueDate", r.tarih) +
    etiket("cbc:DocumentTypeCode", r.turKodu) +
    etiket("cbc:DocumentType", r.tur) +
    (r.ad?.trim() ? `<cac:Attachment><cac:ExternalReference><cbc:DocumentHash>${escapeXml(r.ad)}</cbc:DocumentHash></cac:ExternalReference></cac:Attachment>` : "") +
    `</${etiketAdi}>`;
/** ÖKC alanları ayrı ek belge referanslarına açılır; boş alan yazılmaz. */
const okcXml = (okc, tarih) => {
    if (!okc)
        return "";
    const alanlar = [
        ["OKCFISNO", okc.fisNo], ["OKCFISTIPI", okc.fisTipi], ["OKCNO", okc.okcNo], ["ZNO", okc.zNo],
        ["OKCFISSAATI", okc.fisSaati],
    ];
    return alanlar
        .filter(([, deger]) => deger?.trim())
        .map(([kod, deger]) => belgeReferansXml("cac:AdditionalDocumentReference", { no: deger.trim(), tarih: okc.fisTarihi || tarih, tur: kod }))
        .join("");
};
/** IBAN — `cac:PaymentMeans`. PaymentMeansCode zorunludur; UBL-TR'de banka havalesi için ZZZ kullanılır. */
const paymentMeansXml = (iban, belgeParaBirimi) => {
    const no = iban?.iban?.replace(/\s/g, "").toUpperCase();
    if (!no)
        return "";
    return `<cac:PaymentMeans>` +
        `<cbc:PaymentMeansCode>ZZZ</cbc:PaymentMeansCode>` +
        `<cac:PayeeFinancialAccount>` +
        `<cbc:ID>${escapeXml(no)}</cbc:ID>` +
        `<cbc:CurrencyCode>${escapeXml(iban?.paraBirimi || belgeParaBirimi)}</cbc:CurrencyCode>` +
        `</cac:PayeeFinancialAccount>` +
        `</cac:PaymentMeans>`;
};
/** Ad/değer çifti — GİB'in özel yapısı doğrulanmamış satır alanları için. */
const itemPropertyXml = (ad, deger) => deger === undefined || deger === null || String(deger).trim() === ""
    ? ""
    : `<cac:AdditionalItemProperty><cbc:Name>${escapeXml(ad)}</cbc:Name><cbc:Value>${escapeXml(deger)}</cbc:Value></cac:AdditionalItemProperty>`;
/** Senaryoya özel satır alanları — sırası UBL `ItemType` içinde serbesttir. */
const satirEkAlanlariXml = (satir) => (satir.gtip?.trim()
    ? `<cac:CommodityClassification><cbc:ItemClassificationCode listID="GTIP">${escapeXml(satir.gtip.trim())}</cbc:ItemClassificationCode></cac:CommodityClassification>`
    : "") +
    itemPropertyXml("Teslim Şartı", satir.teslimSarti) +
    itemPropertyXml("Eşya Kap Cinsi", satir.kapCinsi) +
    itemPropertyXml("Kap No", satir.kapNo) +
    itemPropertyXml("Kap Adet", satir.kapAdet) +
    itemPropertyXml("Künye No", satir.kunyeNo) +
    itemPropertyXml("Mal Sahibi", satir.malSahibi) +
    itemPropertyXml("Mal Sahibi VKN/TCKN", satir.malSahibiVkn) +
    itemPropertyXml("İlaç & Tıbbi Cihaz", satir.ilacTibbiCihaz) +
    itemPropertyXml("Etiket No", satir.etiketNo) +
    itemPropertyXml("Harcama Tipi", satir.harcamaTipi) +
    itemPropertyXml("Makina Adı", satir.makinaAdi) +
    itemPropertyXml("Makina ID", satir.makinaId) +
    itemPropertyXml("Makine Teşvik Sıra No", satir.makineTesvikSiraNo);
/**
 * İhracat / yolcu beraberi eşya faturasında gerçek alıcı `cac:BuyerCustomerParty` içinde bildirilir;
 * `cac:AccountingCustomerParty` ise belgenin gönderildiği taraf olarak kalır.
 */
const ihracatAliciXml = (g) => {
    const i = g.ihracat;
    if (!i?.firmaUnvani?.trim())
        return "";
    return `<cac:BuyerCustomerParty><cac:Party>` +
        (i.vkn?.trim() ? `<cac:PartyIdentification><cbc:ID schemeID="VKN">${escapeXml(i.vkn.trim())}</cbc:ID></cac:PartyIdentification>` : "") +
        `<cac:PartyName><cbc:Name>${escapeXml(i.firmaUnvani.trim())}</cbc:Name></cac:PartyName>` +
        `<cac:PostalAddress>` +
        etiket("cbc:CitySubdivisionName", i.ilce) +
        etiket("cbc:CityName", i.sehir) +
        `<cac:Country><cbc:Name>${escapeXml(i.ulke || "")}</cbc:Name></cac:Country>` +
        `</cac:PostalAddress>` +
        `</cac:Party></cac:BuyerCustomerParty>`;
};
/** Yolcu beraberi eşya: turist bilgileri `cac:BuyerCustomerParty/cac:Party/cac:Person` içinde taşınır. */
const turistXml = (g) => {
    const t = g.turist;
    if (!t?.pasaportNo?.trim() && !t?.ad?.trim())
        return "";
    return `<cac:BuyerCustomerParty><cac:Party>` +
        `<cac:PostalAddress>` +
        etiket("cbc:CitySubdivisionName", t?.ilce) +
        etiket("cbc:CityName", t?.sehir) +
        `<cac:Country><cbc:Name>${escapeXml(t?.ulke || "")}</cbc:Name></cac:Country>` +
        `</cac:PostalAddress>` +
        `<cac:Person>` +
        etiket("cbc:FirstName", t?.ad) +
        etiket("cbc:FamilyName", t?.soyad) +
        etiket("cbc:NationalityID", t?.uyruk) +
        (t?.pasaportNo?.trim()
            ? `<cac:IdentityDocumentReference><cbc:ID schemeID="PASAPORTNO">${escapeXml(t.pasaportNo.trim())}</cbc:ID>` +
                etiket("cbc:IssueDate", t.pasaportTarihi) +
                `</cac:IdentityDocumentReference>`
            : "") +
        `</cac:Person>` +
        `</cac:Party></cac:BuyerCustomerParty>`;
};
/** Yolcu beraberi eşya: aracı kurum — `cac:TaxRepresentativeParty`. */
const araciKurumXml = (g) => {
    const a = g.araciKurum;
    if (!a?.vknTckn?.trim() && !a?.unvan?.trim())
        return "";
    return `<cac:TaxRepresentativeParty>` +
        (a?.vknTckn?.trim()
            ? `<cac:PartyIdentification><cbc:ID schemeID="${kimlikSemasi(a.vknTckn.trim())}">${escapeXml(a.vknTckn.trim())}</cbc:ID></cac:PartyIdentification>`
            : "") +
        (a?.unvan?.trim() ? `<cac:PartyName><cbc:Name>${escapeXml(a.unvan.trim())}</cbc:Name></cac:PartyName>` : "") +
        `<cac:PostalAddress>` +
        etiket("cbc:CitySubdivisionName", a?.ilce) +
        etiket("cbc:CityName", a?.sehir) +
        `<cac:Country><cbc:Name>${escapeXml(a?.ulke || "Türkiye")}</cbc:Name></cac:Country>` +
        `</cac:PostalAddress>` +
        `</cac:TaxRepresentativeParty>`;
};
/** İhracat teslim şartı ve gönderim şekli — `cac:Delivery`. */
const deliveryXml = (g) => {
    const teslim = g.ihracat?.teslimSarti?.trim();
    const gonderim = g.ihracat?.gonderimSekli?.trim();
    if (!teslim && !gonderim)
        return "";
    return `<cac:Delivery>` +
        (gonderim
            ? `<cac:Shipment><cbc:ID>1</cbc:ID><cac:ShipmentStage><cbc:TransportModeCode>${escapeXml(gonderim)}</cbc:TransportModeCode></cac:ShipmentStage></cac:Shipment>`
            : "") +
        `</cac:Delivery>` +
        (teslim ? `<cac:DeliveryTerms><cbc:ID>${escapeXml(teslim)}</cbc:ID></cac:DeliveryTerms>` : "");
};
/** Turistin iade hesabı — `cac:PaymentMeans` (IBAN bloğundan ayrı bir ödeme aracı olarak yazılır). */
const turistHesabiXml = (g) => {
    const t = g.turist;
    if (!t?.hesapNo?.trim())
        return "";
    return `<cac:PaymentMeans>` +
        `<cbc:PaymentMeansCode>ZZZ</cbc:PaymentMeansCode>` +
        etiket("cbc:InstructionNote", t.odemeNotu) +
        `<cac:PayeeFinancialAccount>` +
        `<cbc:ID>${escapeXml(t.hesapNo.trim())}</cbc:ID>` +
        etiket("cbc:CurrencyCode", t.hesapParaBirimi) +
        etiket("cbc:PaymentNote", [t.bankaAdi, t.subeAdi].filter(Boolean).join(" / ")) +
        `</cac:PayeeFinancialAccount>` +
        `</cac:PaymentMeans>`;
};
/** Hal tipi komisyoncu masrafları — belge seviyesinde `cac:AllowanceCharge` (masraf). */
const masraflarXml = (g, paraBirimi) => (g.halMasraflari || [])
    .filter((m) => m.ad?.trim())
    .map((m) => `<cac:AllowanceCharge>` +
    `<cbc:ChargeIndicator>true</cbc:ChargeIndicator>` +
    `<cbc:AllowanceChargeReason>${escapeXml(m.ad.trim())}</cbc:AllowanceChargeReason>` +
    `<cbc:Amount currencyID="${paraBirimi}">${tutar(m.tutar)}</cbc:Amount>` +
    `</cac:AllowanceCharge>`)
    .join("");
const invoiceLineXml = (satir, hesap, paraBirimi) => `<cac:InvoiceLine>` +
    `<cbc:ID>${hesap.siraNo}</cbc:ID>` +
    etiket("cbc:Note", satir.not) +
    `<cbc:InvoicedQuantity unitCode="${escapeXml(satir.birimKodu || "C62")}">${miktar(satir.miktar)}</cbc:InvoicedQuantity>` +
    `<cbc:LineExtensionAmount currencyID="${paraBirimi}">${tutar(hesap.matrah)}</cbc:LineExtensionAmount>` +
    (hesap.iskonto > 0
        ? `<cac:AllowanceCharge>` +
            `<cbc:ChargeIndicator>false</cbc:ChargeIndicator>` +
            // Oran, iskontonun brüt tutara bölümünden yazılır; tutar elle girilmiş olsa da UBL oran bekler.
            `<cbc:MultiplierFactorNumeric>${Math.round((hesap.iskonto / (hesap.matrah + hesap.iskonto)) * 1e6) / 1e6}</cbc:MultiplierFactorNumeric>` +
            `<cbc:Amount currencyID="${paraBirimi}">${tutar(hesap.iskonto)}</cbc:Amount>` +
            `<cbc:BaseAmount currencyID="${paraBirimi}">${tutar(hesap.matrah + hesap.iskonto)}</cbc:BaseAmount>` +
            `</cac:AllowanceCharge>`
        : "") +
    `<cac:TaxTotal>` +
    `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(hesap.kdvTutari)}</cbc:TaxAmount>` +
    kdvTaxSubtotalXml(hesap.kdvMatrahi, hesap.kdvTutari, hesap.kdvOrani, paraBirimi, {
        kod: satir.ozelMatrahKodu?.trim() || satir.istisnaKodu,
        gerekce: satir.ozelMatrahKodu?.trim() ? satir.ozelMatrahGerekcesi : satir.istisnaGerekcesi,
    }) +
    `</cac:TaxTotal>` +
    (hesap.tevkifatTutari > 0 && satir.tevkifatKodu
        ? `<cac:WithholdingTaxTotal>` +
            `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(hesap.tevkifatTutari)}</cbc:TaxAmount>` +
            tevkifatSubtotalXml(hesap.kdvTutari, hesap.tevkifatTutari, satir.tevkifatOrani || 0, satir.tevkifatKodu, paraBirimi) +
            `</cac:WithholdingTaxTotal>`
        : "") +
    `<cac:Item>` +
    etiket("cbc:Description", satir.aciklama) +
    `<cbc:Name>${escapeXml(satir.ad)}</cbc:Name>` +
    satirEkAlanlariXml(satir) +
    (satir.hizmetKodu?.trim()
        ? `<cac:SellersItemIdentification><cbc:ID>${escapeXml(satir.hizmetKodu.trim())}</cbc:ID></cac:SellersItemIdentification>`
        : "") +
    `</cac:Item>` +
    `<cac:Price><cbc:PriceAmount currencyID="${paraBirimi}">${tutar(satir.birimFiyat)}</cbc:PriceAmount></cac:Price>` +
    `</cac:InvoiceLine>`;
export const buildInvoiceXml = (girdi) => {
    dogrulaGirdi(girdi);
    const ozet = hesapla(girdi.satirlar);
    const uuid = girdi.uuid?.trim() || randomUUID();
    const paraBirimi = (girdi.paraBirimi || "TRY").toUpperCase();
    const tarih = girdi.tarih?.trim() || bugun();
    const saat = girdi.saat?.trim() || simdi();
    const notlarXml = (girdi.notlar || [])
        .filter((n) => n && n.trim())
        .map((n) => `<cbc:Note>${escapeXml(n)}</cbc:Note>`)
        .join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
        `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"` +
        ` xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"` +
        ` xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">` +
        // ICE serileştiricisi imza icin ext:UBLExtensions ekliyor; onek burada bildirilmezse
        // "prefix ext is not bound" hatasi aliniyor. UBL-TR-de bu eleman ilk cocuk olmali.
        `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>` +
        `<cbc:UBLVersionID>2.1</cbc:UBLVersionID>` +
        `<cbc:CustomizationID>TR1.2</cbc:CustomizationID>` +
        `<cbc:ProfileID>${escapeXml(girdi.senaryo)}</cbc:ProfileID>` +
        `<cbc:ID>${escapeXml(girdi.belgeNo.trim())}</cbc:ID>` +
        `<cbc:CopyIndicator>false</cbc:CopyIndicator>` +
        `<cbc:UUID>${escapeXml(uuid)}</cbc:UUID>` +
        `<cbc:IssueDate>${escapeXml(tarih)}</cbc:IssueDate>` +
        `<cbc:IssueTime>${escapeXml(saat)}</cbc:IssueTime>` +
        `<cbc:InvoiceTypeCode>${escapeXml(girdi.faturaTipi)}</cbc:InvoiceTypeCode>` +
        notlarXml +
        `<cbc:DocumentCurrencyCode>${escapeXml(paraBirimi)}</cbc:DocumentCurrencyCode>` +
        `<cbc:LineCountNumeric>${girdi.satirlar.length}</cbc:LineCountNumeric>` +
        // UBL-TR sequence: LineCountNumeric → InvoicePeriod → OrderReference → BillingReference →
        // DespatchDocumentReference → ... → AdditionalDocumentReference → AccountingSupplierParty
        (girdi.siparis?.no?.trim()
            ? `<cac:OrderReference>` +
                `<cbc:ID>${escapeXml(girdi.siparis.no.trim())}</cbc:ID>` +
                etiket("cbc:IssueDate", girdi.siparis.tarih) +
                `</cac:OrderReference>`
            : "") +
        (girdi.iadeFaturalar || [])
            .map((ref) => `<cac:BillingReference><cac:InvoiceDocumentReference>` +
            `<cbc:ID>${escapeXml(ref.belgeNo.trim())}</cbc:ID>` +
            `<cbc:IssueDate>${escapeXml(ref.tarih)}</cbc:IssueDate>` +
            `</cac:InvoiceDocumentReference></cac:BillingReference>`)
            .join("") +
        (girdi.irsaliyeler || [])
            .filter((r) => r.no?.trim())
            .map((r) => belgeReferansXml("cac:DespatchDocumentReference", r))
            .join("") +
        (girdi.ekBelgeler || [])
            .filter((r) => r.no?.trim())
            .map((r) => belgeReferansXml("cac:AdditionalDocumentReference", r))
            .join("") +
        okcXml(girdi.okc, tarih) +
        // YTB ve IDIS bilgileri de ek belge referansı olarak taşınır (yapı ICE testinde doğrulanacak)
        (girdi.ytb?.no?.trim()
            ? belgeReferansXml("cac:AdditionalDocumentReference", { no: girdi.ytb.no.trim(), tarih: girdi.ytb.tarih, tur: "YATIRIMTESVIKBELGESI" })
            : "") +
        (girdi.idisSevkiyatNo?.trim()
            ? belgeReferansXml("cac:AdditionalDocumentReference", { no: girdi.idisSevkiyatNo.trim(), tarih, tur: "IDISSEVKIYATNO" })
            : "") +
        (girdi.senaryo === "EARSIVFATURA" && girdi.earsiv?.tip
            ? belgeReferansXml("cac:AdditionalDocumentReference", { no: girdi.earsiv.tip, tarih, tur: "EARSIVTIPI" })
            : "") +
        (girdi.senaryo === "EARSIVFATURA" && girdi.earsiv?.gonderimSekli
            ? belgeReferansXml("cac:AdditionalDocumentReference", { no: girdi.earsiv.gonderimSekli, tarih, tur: "GONDERIMSEKLI" })
            : "") +
        `<cac:AccountingSupplierParty>${partyXml(girdi.gonderici)}</cac:AccountingSupplierParty>` +
        `<cac:AccountingCustomerParty>${partyXml(girdi.alici)}</cac:AccountingCustomerParty>` +
        // UBL-TR sequence: AccountingCustomerParty → BuyerCustomerParty → ... → TaxRepresentativeParty → Delivery
        ihracatAliciXml(girdi) +
        turistXml(girdi) +
        araciKurumXml(girdi) +
        deliveryXml(girdi) +
        // UBL-TR sequence: Delivery → PaymentMeans → PaymentTerms → AllowanceCharge → PricingExchangeRate → TaxTotal
        paymentMeansXml(girdi.iban, paraBirimi) +
        turistHesabiXml(girdi) +
        masraflarXml(girdi, paraBirimi) +
        (paraBirimi !== "TRY" && girdi.dovizKuru
            ? `<cac:PricingExchangeRate>` +
                `<cbc:SourceCurrencyCode>${escapeXml(paraBirimi)}</cbc:SourceCurrencyCode>` +
                `<cbc:TargetCurrencyCode>TRY</cbc:TargetCurrencyCode>` +
                `<cbc:CalculationRate>${girdi.dovizKuru.kur}</cbc:CalculationRate>` +
                (girdi.dovizKuru.tarih ? `<cbc:Date>${escapeXml(girdi.dovizKuru.tarih)}</cbc:Date>` : "") +
                `</cac:PricingExchangeRate>`
            : "") +
        `<cac:TaxTotal>` +
        `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(ozet.kdvToplam)}</cbc:TaxAmount>` +
        ozet.kdvGruplari
            .map((g) => kdvTaxSubtotalXml(g.matrah, g.vergi, g.oran, paraBirimi, {
            kod: g.istisnaKodu,
            gerekce: g.istisnaGerekcesi || (g.istisnaKodu ? girdi.muafiyetSebebi : undefined),
        }))
            .join("") +
        `</cac:TaxTotal>` +
        // UBL-TR sequence: TaxTotal → WithholdingTaxTotal → LegalMonetaryTotal
        (ozet.tevkifatGruplari.length
            ? `<cac:WithholdingTaxTotal>` +
                `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(ozet.tevkifatToplam)}</cbc:TaxAmount>` +
                ozet.tevkifatGruplari
                    .map((g) => tevkifatSubtotalXml(g.matrah, g.vergi, g.oran, g.kod, paraBirimi))
                    .join("") +
                `</cac:WithholdingTaxTotal>`
            : "") +
        `<cac:LegalMonetaryTotal>` +
        `<cbc:LineExtensionAmount currencyID="${paraBirimi}">${tutar(ozet.malHizmetToplam)}</cbc:LineExtensionAmount>` +
        `<cbc:TaxExclusiveAmount currencyID="${paraBirimi}">${tutar(ozet.vergiHaricToplam)}</cbc:TaxExclusiveAmount>` +
        // KDV dahil toplam tevkifattan ÖNCEKİ tutardır; tevkifat yalnızca ödenecekten düşer
        `<cbc:TaxInclusiveAmount currencyID="${paraBirimi}">${tutar(ozet.malHizmetToplam + ozet.kdvToplam)}</cbc:TaxInclusiveAmount>` +
        `<cbc:AllowanceTotalAmount currencyID="${paraBirimi}">${tutar(ozet.iskontoToplam)}</cbc:AllowanceTotalAmount>` +
        `<cbc:PayableAmount currencyID="${paraBirimi}">${tutar(ozet.odenecekTutar)}</cbc:PayableAmount>` +
        `</cac:LegalMonetaryTotal>` +
        girdi.satirlar
            .map((satir, i) => invoiceLineXml(satir, ozet.satirlar[i], paraBirimi))
            .join("") +
        `</Invoice>`;
    return { xml, uuid, ozet };
};
/** Üretilen XML'i ICE'nin beklediği base64 biçimine çevirir */
export const toBase64 = (xml) => Buffer.from(xml, "utf8").toString("base64");
