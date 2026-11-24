import { escapeXml, maskSensitive } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
import { edovizSurumu } from "./ice.edovizSurum.js";
import { edovizUblXml } from "./ubl/edovizBuilder.js";
import { ApiError } from "../../utils/ApiError.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { logger } from "../../utils/logger.js";
const alan = (ad, deger) => {
    if (deger === undefined || deger === null)
        return "";
    const metin = String(deger).trim();
    if (!metin)
        return "";
    return `<${ad}>${escapeXml(metin)}</${ad}>`;
};
/**
 * Metin alanı: boş olsa da etiket yazılır. ICE (.NET) tarafında XML'de hiç
 * gelmeyen metin `""` değil `null` olur ve sunucu ona dokunduğu anda "Nesne
 * başvurusu bir nesnenin örneğine ayarlanmadı" hatası verir. Boş etiket ise
 * `""` olarak okunur. Tarih ve sayı alanlarında bu yapılmaz: boş `<X></X>`
 * tarih/sayı olarak ayrıştırılamaz; onlar için `alan` kullanılır.
 */
const metin = (ad, deger) => `<${ad}>${escapeXml(deger === undefined || deger === null ? "" : String(deger).trim())}</${ad}>`;
/** Boş bloğu hiç göndermemek için: içi boşsa etiket de üretilmez. */
const blok = (ad, icerik) => (icerik ? `<${ad}>${icerik}</${ad}>` : "");
/** 2.0'da sona eklenen alan: müşteride Uyruk, yetkili müessesede dosya no (WSDL sırası: her ikisi de en sonda). */
const tarafXml = (ad, t, musteriMi, surum = 1, dosyaNo) => blok(ad, metin("Vkn_Tckn", t.vknTckn) +
    (musteriMi ? metin("Pasaport_No", t.pasaportNo) : "") +
    metin("Unvan", t.unvan) +
    metin("Adi", t.ad) +
    metin("Soyadi", t.soyad) +
    metin("Adres", t.adres) +
    metin("Ulke", t.ulke) +
    metin("Sehir", t.sehir) +
    metin("Ilce", t.ilce) +
    metin(musteriMi ? "VergiDairesi" : "Vergi_Dairesi", t.vergiDairesi) +
    metin("Web_Site", "") +
    metin("Telefon", t.telefon) +
    metin("Fax", "") +
    metin("Email", t.eposta) +
    metin("Ticaret_Sicil_No", t.ticaretSicilNo) +
    (musteriMi ? metin("Musteri_Turu", t.musteriTuru) : "") +
    (surum === 2 ? (musteriMi ? metin("Uyruk", t.uyruk) : metin("Yetkili_Muessese_Dosya_Numarası", dosyaNo)) : ""));
/** Belge türü: girdi 1.0 kodunu taşır (DOVIZALIMBELGESI / DOVIZSATIMBELGESI); 2.0'da GİB kodu ALIM / SATIM gider. */
export const alimBelgesiMi = (kod) => kod === "DOVIZALIMBELGESI" || kod === "ALIM";
const belgeTipiKodu = (kod, surum) => surum === 2 ? (alimBelgesiMi(kod) ? "ALIM" : kod === "DOVIZSATIMBELGESI" || kod === "SATIM" ? "SATIM" : kod) : kod;
/** Kur metni: en çok 6 ondalık, bilimsel gösterim yok (GİB CalculationRate kuralı). */
const kurMetni = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v))
        return "";
    return v.toFixed(6).replace(/\.?0+$/, "");
};
/**
 * Ek_Bilgiler bloğu. GİB e-Döviz Teknik Kılavuzu (v1.0, 3.12 AdditionalDocumentReference):
 * "Döviz ALIM belgesine ISTATISTIKNO, GELDIGIULKE, GELISNEDENI yazılacaktır. Döviz alım
 * belgesi ihracat ya da yabancı sermaye bedeli için düzenlendiği durumda ek olarak
 * gümrük beyanname / DBT / GMTY tarih-no bilgileri yazılacaktır."
 *
 * Yani bu alanlar yalnızca alım belgesine aittir. SATIM belgesinde gönderilmeleri
 * (boş etiket olarak bile) ICE'de "ISTATISTIKNO ile Belge türü uyumsuzluğu" retine
 * yol açtı; satımda hiç yazılmazlar. Blok ve Ihracat_Yabanci_Sermaye (zorunlu boolean)
 * her belgede gider; tarih alanları yalnızca kaynakta varsa yazılır (uydurulmaz).
 */
const ekBilgilerXml = (g) => {
    const alim = alimBelgesiMi(g.creditNoteTypeCode);
    const e = g.ekBilgiler;
    return (`<Ek_Bilgiler>` +
        // ICE'nin gözlenen kuralı GİB metninden farklı: Istatistik_No her iki türde de
        // bekleniyor ve kodun türü belge türüyle (alım/satım) eşleşmeli. Satımda alanı
        // hiç göndermemek de, boş göndermek de, alış kodu göndermek de aynı reti verdi:
        // "ISTATISTIKNO ile Belge türü uyumsuzluğu". Kod, fişin istatistik tanımından
        // gelir; türü servis katmanında ICE'ye gitmeden doğrulanır.
        metin("Istatistik_No", g.istatistikNo ?? e?.istatistikNo) +
        metin("Geldigi_Ulke", e?.geldigiUlke) +
        metin("Gelis_Nedeni", e?.gelisNedeni) +
        `<Ihracat_Yabanci_Sermaye>${alim && e?.ihracatYabanciSermaye ? "true" : "false"}</Ihracat_Yabanci_Sermaye>` +
        (alim
            ? alan("Gumruk_Beyan_Tarihi", e?.gumrukBeyanTarihi) +
                metin("Gumruk_Beyan_No", e?.gumrukBeyanNo) +
                alan("DBT_Tarihi", e?.dbtTarihi) +
                metin("DBT_Sayi", e?.dbtSayi) +
                alan("GMTY_Tarihi", e?.gmtyTarihi) +
                metin("GMTY_Sayi", e?.gmtySayi)
            : "") +
        metin("Vezne", e?.vezne) +
        `</Ek_Bilgiler>`);
};
/**
 * `eDoviz_Belge` gövdesini üretir. Alan sırası WSDL sequence'ı ile birebir aynıdır;
 * sıra bozulursa ICE belgeyi reddeder.
 */
export const buildEDovizInnerXml = (loginHeaderXml, g, surum = 1) => `<_eDovizBelge>` +
    loginHeaderXml +
    blok("Baslik_Bilgileri", alan("ID", g.belgeNo) +
        alan("UUID", g.uuid) +
        alan("ProfileID", g.profileId) +
        alan("CreditNoteTypeCode", belgeTipiKodu(g.creditNoteTypeCode, surum)) +
        alan("Duzenleme_Tarihi", g.duzenlemeTarihi) +
        alan("Duzenleme_Saati", g.duzenlemeSaati) +
        // Notlar .NET tarafında dizidir; etiket hiç gelmezse null olur ve sunucu
        // üzerinde döngü kurduğu anda null referans verir. Boş da olsa gönderilir.
        `<Notlar>${(g.notlar || []).map((n) => alan("string", n)).join("")}</Notlar>`) +
    tarafXml("Yetkili_Muessese", g.yetkiliMuessese, false, surum, g.odeme.yetkiliMuesseseDosyaNo) +
    tarafXml("Musteri", g.musteri, true, surum) +
    blok("Alis_Satis_Bilgileri", alan("Doviz_Kodu", g.alisSatis.dovizKodu) +
        alan("Dolar_Karsilik_Kuru", surum === 2 ? kurMetni(g.tutar.usdKuru ?? 0) : g.alisSatis.dolarKarsilikKuru) +
        alan("TL_Karsilik_Kuru", g.alisSatis.tlKarsilikKuru) +
        (surum === 2 ? alan("Kur_Bilgisi", kurMetni(g.alisSatis.tlKarsilikKuru)) : "") +
        alan("Vergi_Orani", g.alisSatis.vergiOrani) +
        alan("Vergi_Tutari", g.alisSatis.vergiTutari) +
        alan("Vergi_Matrah", g.alisSatis.vergiMatrah) +
        alan("Doviz_Miktar", g.alisSatis.dovizMiktar)) +
    (surum === 2
        ? // 2.0: yalnız iki zorunlu enum; son ödeme tarihi, açıklama ve hesap blokları ICE gövdesinden kalktı.
            `<Odeme_Bilgileri>` +
                alan("Musteri_Odeme_Yontemi", g.odeme.musteriYontemi || "NAKIT") +
                alan("Doviz_Burosu_Odeme_Yontemi", g.odeme.buroYontemi || "NAKIT") +
                `</Odeme_Bilgileri>`
        : odemeBilgileri1Xml(g)) +
    // Ek_Bilgiler nesnesi ICE tarafında koşulsuz okunuyor; blok hiç gelmezse null
    // referans verir. Blok her zaman gönderilir ama gümrük tarihleri uydurulmaz:
    // tarih alanları yalnızca kaynak fişte varsa yazılır (.NET'te eksik tarih
    // null olmaz, varsayılan değer alır). Metin alanları boş da olsa yazılır.
    ekBilgilerXml(g) +
    // Komisyon, kıymetli maden ve BuyBack blokları her belgede gönderilir. ICE bu
    // blokları koşulsuz okuduğu için blok hiç gelmediğinde null referans hatası
    // veriyor. Komisyonsuz, madensiz ve buyback'siz bir döviz alımında bu alanların
    // gerçek değeri sıfırdır; uydurma veri değil, fişin kendi değeridir.
    blok("Komisyon_Bilgileri", alan("Komisyon_Tutar_Vergi_Haric", g.komisyon?.vergiHaric ?? 0) +
        alan("Komisyon_Tutar_Vergi", g.komisyon?.vergi ?? 0) +
        alan("Komisyon_Dahil_Toplam", g.komisyon?.dahilToplam ?? 0)) +
    blok("Kiymetli_Maden_Bilgileri", metin("Kiymetli_Maden_Adi", g.kiymetliMaden?.ad) + alan("Adet", g.kiymetliMaden?.adet ?? 0)) +
    blok("Tutar_Bilgileri", alan("Miktar", g.tutar.miktar) +
        alan("Kod", g.tutar.kod) +
        // 2.0: Kur_Bilgisi = görünen TL kuru, TL_Karsilik_Kuru = hesap kuru (belgenin CalculationRate'i); bkz. tutar.hesapKuru
        (surum === 2 ? alan("Kur_Bilgisi", kurMetni(g.tutar.tlKarsilikKuru)) : "") +
        (surum === 2 ? alan("TL_Karsilik_Kuru", kurMetni(g.tutar.hesapKuru)) : alan("TL_Karsilik_Kuru", g.tutar.tlKarsilikKuru)) +
        alan("Dolar_Karsilik_Kuru", surum === 2 ? kurMetni(g.tutar.usdKuru ?? 0) : g.tutar.dolarKarsilikKuru) +
        alan("Saf_Altin_Karsiligi", g.tutar.safAltinKarsiligi) +
        metin("Vergi_Adi", g.tutar.vergiAdi) +
        metin("Vergi_Kodu", g.tutar.vergiKodu) +
        alan("Vergi_Orani", g.tutar.vergiOrani) +
        alan("Vergi_Matrahi", g.tutar.vergiMatrahi) +
        alan("Vergi_Tutari", g.tutar.vergiTutari) +
        tutarlarXml(g, surum) +
        alan("PayableAmount", g.tutar.payableAmount)) +
    blok("BuyBack", alan("Komisyon_Tutari", g.buyBackKomisyonTutari ?? 0)) +
    `<TutarHesaplanmasin>${g.tutarHesaplanmasin ? "true" : "false"}</TutarHesaplanmasin>` +
    `</_eDovizBelge>`;
/** LineExtension / TaxExclusive / TaxInclusive: 1.0'da fişteki gibi, 2.0'da surum2Tutarlari (bkz. orası). */
const tutarlarXml = (g, surum) => {
    const t = surum === 2
        ? surum2Tutarlari(g)
        : { karsilik: g.tutar.lineExtensionAmount, vergiHaric: g.tutar.taxExclusiveAmount, vergiDahil: g.tutar.taxInclusiveAmount };
    return alan("LineExtensionAmount", t.karsilik) + alan("TaxExclusiveAmount", t.vergiHaric) + alan("TaxInclusiveAmount", t.vergiDahil);
};
/** 1.0 Odeme_Bilgileri bloğu (eski ICE gövdesi; değiştirilmedi). */
const odemeBilgileri1Xml = (g) => blok("Odeme_Bilgileri", alan("Odeme_Yontemi", g.odeme.yontemi) +
    alan("Son_Odeme_Tarihi", g.odeme.sonOdemeTarihi) +
    metin("Aciklama", g.odeme.aciklama) +
    // Hesap blokları WSDL'de isteğe bağlı görünür ama ICE nesne olarak okuyor;
    // gelmediğinde null referans verir. Nakit ödemede içerik yoktur, boş gider.
    // "Numarası" etiketindeki Türkçe karakter WSDL'de böyle tanımlı; değiştirilmez.
    // Dosya numarası ICE'de zorunlu ("Yetkili Müessese Dosya Numarası gönderilmek
    // zorundadır"). Alımda ödemeyi yapan, satımda ödeme yapılan taraf müessesedir;
    // ICE hangisini okuduğunu belirtmediği için iki blokta da gönderilir.
    `<Odeme_Yapan_Hesap>${metin("Yetkili_Muessese_Dosya_Numarası", g.odeme.yetkiliMuesseseDosyaNo)}${metin("Sube_Kodu", "")}${metin("Odeme_Aciklamasi", "")}</Odeme_Yapan_Hesap>` +
    `<Odeme_Yapilan_Hesap>${metin("Yetkili_Muessese_Dosya_Numarası", g.odeme.yetkiliMuesseseDosyaNo)}${metin("Sube_Kodu", "")}${metin("Odeme_Aciklamasi", "")}</Odeme_Yapilan_Hesap>`);
/** GİB e-Döviz şematronundaki ISO 4217 listesi (paket v1.3, earsiv_schematron.xsl CurrencyCodeList). */
const GIB_PARA_KODLARI = new Set(("AED,AFN,ALL,AMD,ANG,AOA,ARS,AUD,AWG,AZN,BAM,BBD,BDT,BGN,BHD,BIF,BMD,BND,BOB,BOV,BRL,BSD,BTN,BWP,BYN,BZD,CAD,CDF," +
    "CHE,CHF,CHW,CLF,CLP,CNY,COP,COU,CRC,CUC,CUP,CVE,CZK,DJF,DKK,DOP,DZD,EEK,EGP,ERN,ETB,EUR,FJD,FKP,GBP,GEL,GHS,GIP," +
    "GMD,GNF,GTQ,GWP,GYD,HKD,HNL,HRK,HTG,HUF,IDR,ILS,INR,IQD,IRR,ISK,JMD,JOD,JPY,KES,KGS,KHR,KMF,KPW,KRW,KWD,KYD,KZT," +
    "LAK,LBP,LKR,LRD,LSL,LTL,LVL,LYD,MAD,MDL,MGA,MKD,MMK,MNT,MOP,MRU,MUR,MVR,MWK,MXN,MXV,MYR,MZN,NAD,NGN,NIO,NOK,NPR," +
    "NZD,OMR,PAB,PEN,PGK,PHP,PKR,PLN,PYG,QAR,RON,RSD,RUB,RWF,SAR,SBD,SCR,SDG,SEK,SGD,SHP,SLE,SLL,SOS,SRD,SSP,STD,STN," +
    "SVC,SYP,SZL,THB,TJS,TMT,TND,TOP,TRY,TTD,TWD,TZS,UAH,UGX,USD,USN,USS,UYI,UYU,UYW,UZS,VEF,VND,VUV,WST,XAD,XAF,XAG," +
    "XAU,XBA,XBB,XBC,XBD,XCD,XCG,XDR,XFU,XOF,XPD,XPF,XPT,XSU,XTS,XUA,XXX,VED,VES,YER,ZAR,ZMK,ZMW,ZWG,ZWL").split(","));
/** Kuruşa yuvarlama (XSLT round(): yarım yukarı; pozitif tutarlarda Math.floor(x × 100 + 0.5)). */
const kurus = (x) => Math.floor(x * 100 + 0.5);
/**
 * ICE'nin SATIM hesap denetimi (ICE TEST, 23.11.2026, docs/EDOVIZ_SURUM2_YOL_HARITASI.md §4b): `TaxExclusive × kur` kuruşa yuvarlanıp
 * karşılık tutarla karşılaştırılır; ters yön (karşılık ÷ kur) denetlenmez. ALIM'da çarpım denetlenmiyor (T vakası: 22.250 × 47,250112
 * = 1.051.314,99 iken 1.051.315 kabul gördü); ALIM'da ICE yalnız "LineExtensionAmount = TaxExclusiveAmount" istiyor.
 */
export const hesapKuraliTutuyor = (tutar, kur, karsilik) => kur > 0 && Number.isFinite(tutar) && Number.isFinite(karsilik) && kurus(tutar * kur) === kurus(karsilik);
/**
 * 2.0'da belgeye yazılan TL / karşılık tutarları (LineExtension, TaxExclusive, TaxInclusive); 1.0 gövdesi kullanmaz.
 *
 * SATIM: karşılık (LineExtension, döviz) GİB örneğindeki gibi TL tutarın hesap kuruyla çevrilmiş hâlidir (100 EUR satışta 100,14 EUR):
 * 6 ondalıklı kurla döviz miktarı kuruşuna kadar geri üretilemiyor (157.360 × 0,017794 = 2.800,06; ICE TEST "Hesaplanan: 2800.06384,
 * LineExtensionAmount: 2800" diye reddetti, 2.800,06 ile kabul etti). Satılan döviz miktarı Miktar / Doviz_Miktar'da aynen kalır;
 * TL tutarları değişmez.
 *
 * ALIM: fişin TL tutarları her zaman aynen yazılır (ICE alımda çarpımı denetlemiyor; 5. turda tam 1.051.315 TL kabul gördü).
 */
export const surum2Tutarlari = (g) => {
    const t = g.tutar;
    const fistekiGibi = { karsilik: t.lineExtensionAmount, vergiHaric: t.taxExclusiveAmount, vergiDahil: t.taxInclusiveAmount };
    const kur = Number(t.hesapKuru);
    if (!(kur > 0) || alimBelgesiMi(g.creditNoteTypeCode))
        return fistekiGibi;
    return { ...fistekiGibi, karsilik: kurus(t.taxExclusiveAmount * kur) / 100 };
};
/**
 * Yalnız-pasaport müşteri şimdilik gönderimi DURDURMAZ, günlüğe uyarı yazar (docs/EDOVIZ_SURUM2_YOL_HARITASI.md K7): GİB tam bir
 * TCKN/VKN istiyor, ICE'de denenmedi. Reddedildiği kesinleşirse bu sabit true yapılır. (Şahıs müessese için ICE basic gövdesi Person
 * üretmiyordu; 2.0 artık kendi UBL'imizle send_edoviz üzerinden gittiği için Person belgede — K11.)
 */
const TEST_BEKLEYEN_KURALLAR_DURDURUR = false;
const ondalikSayisi = (n) => {
    const m = String(n).match(/\.(\d+)$/);
    return m ? m[1].length : 0;
};
/**
 * 2.0 ön kontrolü — GİB paket v1.3 şematronunun girdiden denetlenebilen kuralları. ICE'ye gitmeden çalışır;
 * hata varsa belge gönderilmez, numara yanmaz.
 */
export const edovizSurum2OnKontrol = (g) => {
    const hatalar = [];
    const uyarilar = [];
    const m = g.musteri;
    const kimlik = String(m.vknTckn || "").trim();
    if (!kimlik) {
        (TEST_BEKLEYEN_KURALLAR_DURDURUR ? hatalar : uyarilar).push("Müşteride TCKN/VKN yok (yalnız pasaport); GİB 30.11.2026 kuralı tam bir TCKN ya da VKN istiyor.");
    }
    else if (!/^\d{10}$/.test(kimlik) && !/^\d{11}$/.test(kimlik)) {
        hatalar.push(`Müşteri kimlik numarası 11 haneli TCKN ya da 10 haneli VKN olmalı (fişteki: ${kimlik}).`);
    }
    if (/^\d{10}$/.test(kimlik) && !String(m.unvan || "").trim()) {
        hatalar.push("VKN'li müşteride unvan zorunlu; fişte müşteri unvanı boş.");
    }
    if (/^\d{11}$/.test(kimlik)) {
        if (!String(m.ad || "").trim() || !String(m.soyad || "").trim()) {
            hatalar.push("TCKN'li müşteride ad ve soyad zorunlu; fişte müşterinin adı veya soyadı boş.");
        }
        if (!/^[A-Z]{2}$/.test(String(m.uyruk || "").trim())) {
            hatalar.push("Müşterinin uyruğu boş. Döviz fişinde F8 Detay › Uyruk seçilmeli (GİB 30.11.2026 kuralı).");
        }
    }
    const ym = g.yetkiliMuessese;
    if (/^\d{11}$/.test(String(ym.vknTckn || "").trim())) {
        if (!String(ym.ad || "").trim() || !String(ym.soyad || "").trim()) {
            hatalar.push("Müessese şahıs firması (11 haneli TCKN): GİB ad ve soyad istiyor. Firma Tanımları › Firma adı en az iki kelime (ad soyad) olmalı.");
        }
    }
    if (!(Number(g.tutar.usdKuru) > 0)) {
        hatalar.push("USD karşılık kuru hesaplanamadı (fişte USD gişe kuru yok); ICE e-Döviz belgesini bu bilgi olmadan kaydetmiyor.");
    }
    if (!String(g.odeme.yetkiliMuesseseDosyaNo || "").trim()) {
        hatalar.push("Yetkili Müessese Dosya No boş. Firma Tanımları › Dosya No (YMBS'deki dosya numarası) doldurulmalı.");
    }
    const kod = String(g.tutar.kod || "").trim();
    if (!GIB_PARA_KODLARI.has(kod)) {
        hatalar.push(`Para kodu ${kod || "(boş)"} GİB'in kabul ettiği ISO 4217 kodlarından değil; e-Döviz belgesi bu kodla kesilemez` +
            " (altın gibi kıymetli madenler için ayrı belge türü gerekir).");
    }
    const kur = Number(g.tutar.hesapKuru);
    if (!(kur > 0) || ondalikSayisi(kur) > 6) {
        hatalar.push("Belgenin hesap kuru hesaplanamadı (tutarlar sıfır ya da eksik); fiş tutarları kontrol edilmeli.");
    }
    const { karsilik, vergiHaric, vergiDahil } = surum2Tutarlari(g);
    for (const [ad, v] of [
        ["Ödenecek tutar", g.tutar.payableAmount],
        ["Karşılık tutar", karsilik],
        ["Vergi hariç tutar", vergiHaric],
        ["Vergi dahil tutar", vergiDahil],
    ]) {
        if (ondalikSayisi(Number(v)) > 2)
            hatalar.push(`${ad} en çok 2 ondalık olabilir (${v}).`);
    }
    // ICE'nin gerçek denetimleri (TEST'te reddedildiği görüldü). SATIM'da karşılık bu kurla üretildiği için normalde kendiliğinden
    // tutar; bu satırlar bozuk/eksik veriyi (sıfır, NaN, tutarsız fiş) ICE'ye gitmeden yakalar. ALIM'da çarpım denetlenmez (ICE de denetlemiyor).
    const alim = alimBelgesiMi(g.creditNoteTypeCode);
    if (!alim && kur > 0 && !hesapKuraliTutuyor(vergiHaric, kur, karsilik)) {
        hatalar.push(`Belge tutarları kurla tutmuyor: ${vergiHaric} × ${kur} ≠ ${karsilik} (kuruş). Fişin döviz miktarı / TL tutarı kontrol edilmeli.`);
    }
    if (alim && kurus(karsilik) !== kurus(vergiHaric)) {
        hatalar.push(`Alım belgesinde TL karşılığı (${karsilik}) vergi hariç tutara (${vergiHaric}) eşit olmalı (ICE kuralı); fiş tutarları kontrol edilmeli.`);
    }
    return { hatalar, uyarilar };
};
/** 2.0 ön kontrolünün hatası: belge ICE'ye gitmedi, numara yanmadı. */
export class EDovizOnKontrolHatasi extends ApiError {
    hatalar;
    constructor(hatalar) {
        super(HttpStatus.BAD_REQUEST, `e-Döviz belgesi ICE'ye gönderilmedi (GİB 30.11.2026 kuralları): ${hatalar.join(" ")}`);
        this.hatalar = hatalar;
    }
}
/**
 * Bu adrese gidecek gövde sürümünü seçer; 2.0 ise ön kontrolü çalıştırır (hata → EDovizOnKontrolHatasi).
 * Uyarılar günlüğe yazılır, gönderimi durdurmaz.
 */
export const edovizGonderimSurumu = async (config, girdi) => {
    const { surum, kaynak } = await edovizSurumu(config.servisUrl);
    if (surum === 2) {
        const { hatalar, uyarilar } = edovizSurum2OnKontrol(girdi);
        if (uyarilar.length)
            logger.warn(`e-Döviz 2.0 ön kontrol uyarısı (${girdi.belgeNo}): ${uyarilar.join(" ")}`);
        if (hatalar.length)
            throw new EDovizOnKontrolHatasi(hatalar);
    }
    if (kaynak !== "WSDL")
        logger.info(`e-Döviz sürüm ${surum} (${kaynak}) — ${girdi.belgeNo}`);
    return surum;
};
/**
 * `preview_edoviz_basic` — belgeyi ICE'ye **göndermeden** önizler.
 *
 * Mali sonuç doğurmaz; okuma çağrısı sayıldığı için auth hatasında tekrar denenebilir.
 */
export const previewEDoviz = async (config, girdi) => {
    const surum = await edovizGonderimSurumu(config, girdi);
    // 2.0'da belge send_edoviz ile kendi UBL'imizle gider: kurulabildiği (ör. XSLT dosyası sunucuda var) burada, numara yanmadan denetlenir.
    // ICE'nin görsel önizlemesi basic gövdeyle alınır (send_edoviz'in önizleme ucu yok).
    if (surum === 2)
        edovizSurum2Ubl(girdi);
    const { data } = await callWithSession(config, {
        method: "preview_edoviz_basic",
        buildInnerXml: (loginHeaderXml) => buildEDovizInnerXml(loginHeaderXml, girdi, surum),
        authHatasindaTekrarla: true,
    });
    const onizleme = typeof data === "string" ? data.trim() : '';
    if (!onizleme) {
        throw ApiError.unprocessable("ICE e-Döviz önizlemesi boş döndü; belge doğrulanamadı.");
    }
    // Servis hata metni de döndürebilir; her dolu metin başarılı önizleme değildir.
    const decoded = onizleme.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const belge = /^(?:<!doctype\s+html|<html[\s/>]|%PDF-)/i.test(decoded) ||
        /^(?:<!doctype\s+html|<html[\s/>]|%PDF-)/i.test(Buffer.from(onizleme, 'base64').toString('utf8').trim());
    if (!belge)
        throw ApiError.unprocessable(`ICE e-Döviz önizlemesi doğrulanamadı: ${onizleme.slice(0, 1000)}`);
    return { onizleme };
};
/** 2.0 belgesinin UBL'i (ubl/edovizBuilder.ts): send_edoviz ile gider; önizlemede de kurulabildiği denetlenir. */
export const edovizSurum2Ubl = (g) => edovizUblXml(g, { alim: alimBelgesiMi(g.creditNoteTypeCode), tutarlar: surum2Tutarlari(g) });
/**
 * `send_edoviz` — 2.0 belgesini kendi ürettiğimiz UBL ile gönderir (K11). ICE TEST 23.11.2026: basic gövde şahıs müessesede Person
 * üretmiyordu; kendi UBL'imiz serializer + şema + şematron + kayıt adımlarından geçti (V1/V3/V4 "Başarı ile tamamlandı").
 * İçerik TEK kat Base64'tür (iki kat → "EDoviz Serializer Error … (1, 1)"). Cevap send_edoviz_basic ile aynı biçimdedir.
 *
 * ⚠️ Mali sonuç doğurur. Yazma çağrısıdır: auth hatasında otomatik tekrar KAPALI.
 */
const sendEDovizUbl = async (config, girdi) => {
    const ubl = edovizSurum2Ubl(girdi);
    const b64 = Buffer.from(ubl, "utf8").toString("base64");
    const { data } = await callWithSession(config, {
        method: "send_edoviz",
        buildInnerXml: (loginHeaderXml) => `<sendEDovizRequest>${loginHeaderXml}<edoviz_creditnotes><base64BinaryCreditNote>` +
            `<edoviz_creditnote>${b64}</edoviz_creditnote></base64BinaryCreditNote></edoviz_creditnotes></sendEDovizRequest>`,
        authHatasindaTekrarla: false,
        timeoutMs: 120_000,
    });
    const sonuc = data || {};
    if (String(sonuc.success).toLowerCase() !== "true") {
        // XSLT eki (Base64) çok uzun olduğu için günlüğe çıkarılarak yazılır
        const ozet = ubl.replace(/(<cbc:EmbeddedDocumentBinaryObject[^>]*>)[^<]*/, "$1[xslt]");
        logger.warn(`ICE send_edoviz reddetti (${girdi.belgeNo}) → cevap: ${JSON.stringify(sonuc).slice(0, 1500)}`);
        logger.warn(`ICE send_edoviz reddedilen belge (${girdi.belgeNo}) → ${ozet.slice(0, 8000)}`);
    }
    else {
        logger.info(`ICE send_edoviz kabul (${girdi.belgeNo}, ${girdi.creditNoteTypeCode}, sürüm 2, istatistik=${girdi.istatistikNo ?? ""})`);
    }
    return sonuc;
};
/**
 * e-Döviz belgesini gönderir: 1.0'da `send_edoviz_basic`, 2.0'da `send_edoviz` + kendi UBL'imiz (sürüm ICE adresinin WSDL'inden).
 *
 * ⚠️ Mali sonuç doğurur. Yazma çağrısıdır: auth hatasında otomatik tekrar KAPALI.
 */
export const sendEDoviz = async (config, girdi) => {
    let gonderilen = "";
    // Sürüm hazırlama anından farklı olabilir (ör. 30.11 gece yarısı ICE canlıyı güncelledi): kontrol burada da çalışır.
    const surum = await edovizGonderimSurumu(config, girdi);
    if (surum === 2)
        return sendEDovizUbl(config, girdi);
    const { data } = await callWithSession(config, {
        method: "send_edoviz_basic",
        buildInnerXml: (loginHeaderXml) => (gonderilen = buildEDovizInnerXml(loginHeaderXml, girdi, surum)),
        authHatasindaTekrarla: false,
        timeoutMs: 120_000,
    });
    const sonuc = data || {};
    // İş kuralı retleri SOAP fault değildir; istemci katmanı onları loglamaz. Hangi
    // gövdenin neden reddedildiğini görmek için ret durumunda istek ve cevap loglanır
    // (oturum anahtarları maskeli). Kabulde sadece özet yazılır.
    if (String(sonuc.success).toLowerCase() !== "true") {
        logger.warn(`ICE send_edoviz_basic reddetti (${girdi.belgeNo}) → cevap: ${JSON.stringify(sonuc).slice(0, 1500)}`);
        logger.warn(`ICE send_edoviz_basic reddedilen istek (${girdi.belgeNo}) → ${maskSensitive(gonderilen, 6000)}`);
    }
    else {
        logger.info(`ICE send_edoviz_basic kabul (${girdi.belgeNo}, ${girdi.creditNoteTypeCode}, sürüm ${surum}, istatistik=${girdi.istatistikNo ?? ""})`);
    }
    return sonuc;
};
/**
 * `send_edoviz_iptal` — gönderilmiş e-Döviz belgesini iptal eder.
 *
 * ⚠️ Mali sonuç doğurur.
 */
export const sendEDovizIptal = async (config, belgeNo, iptalTarihi) => {
    const { data } = await callWithSession(config, {
        method: "send_edoviz_iptal",
        buildInnerXml: (loginHeaderXml) => `<sendEDovizRequest>` +
            loginHeaderXml +
            alan("belgeNo", belgeNo) +
            alan("iptalTarihi", iptalTarihi) +
            `</sendEDovizRequest>`,
        authHatasindaTekrarla: false,
        timeoutMs: 120_000,
    });
    return {
        basarili: String(data?.success).toLowerCase() === "true",
        mesaj: data?.response_message ? String(data.response_message) : "",
    };
};
/**
 * `Get_EDoviz_Status` — UUID listesinin ICE'deki durumunu sorgular.
 *
 * Belirsiz kalan gönderimlerde yeniden göndermeden önce buraya bakılır.
 */
export const getEDovizStatus = async (config, uuidListesi) => {
    const { data } = await callWithSession(config, {
        method: "Get_EDoviz_Status",
        buildInnerXml: (loginHeaderXml) => `<Get_EDoviz_Status_Request>` +
            loginHeaderXml +
            `<UUID_List>${uuidListesi.map((u) => alan("string", u)).join("")}</UUID_List>` +
            `</Get_EDoviz_Status_Request>`,
        authHatasindaTekrarla: true,
    });
    // Boş SOAP Result, bu UUID için kayıt olmadığını belirtir. Beklenmeyen veya
    // hata içeren cevapların "kayıt yok" kabul edilmesi tekrar gönderime yol açar.
    // Durum cevabının ham hâli loglanır: isSuccecss/STATUS alanlarının ICE'de ne
    // anlama geldiği belgelenmemiş; filtre kararı bu kayıtlara bakılarak doğrulanır.
    logger.info(`ICE Get_EDoviz_Status ham cevap (${uuidListesi.join(",")}) → ${data === '' ? '<boş>' : JSON.stringify(data).slice(0, 1500)}`);
    if (data === '')
        return [];
    const kayit = data?.Get_EDoviz_Status_Response;
    if (kayit === undefined || kayit === null)
        throw ApiError.conflict('ICE e-Döviz durum yanıtı doğrulanamadı. Gönderim durduruldu.');
    if (kayit === '')
        return [];
    // ICE, tanımadığı UUID'yi de kayıt olarak geri döndürüyor: UUID alanı istekten
    // yankılanıyor, `isSuccecss` false ve durum alanları boş kalıyor. Kaydın varlığını
    // "belge mevcut" saymak hiç gönderilmemiş belgeyi kilitler; bu yüzden yalnızca
    // isSuccecss doğru olan ya da bir durum bilgisi taşıyan kayıtlar gerçek sayılır.
    const dolu = (v) => String(v ?? '').trim() !== '';
    return (Array.isArray(kayit) ? kayit : [kayit]).filter((k) => String(k?.isSuccecss).toLowerCase() === 'true' || dolu(k?.STATUS) || dolu(k?.STATUS_DESCRIPTION));
};
/**
 * `GetEDoviz_XML_PDF` — gönderilmiş belgenin XML/PDF çıktısı.
 */
export const getEDovizCikti = async (config, ettn, secenekler = { pdf: true }) => {
    const { data } = await callWithSession(config, {
        method: "GetEDoviz_XML_PDF",
        buildInnerXml: (loginHeaderXml) => `<GetEDoviz_XML_PDF>` +
            loginHeaderXml +
            alan("ETTN", ettn) +
            `<get_pdf>${secenekler.pdf ? "true" : "false"}</get_pdf>` +
            `<get_xml>${secenekler.xml ? "true" : "false"}</get_xml>` +
            `</GetEDoviz_XML_PDF>`,
        authHatasindaTekrarla: true,
        timeoutMs: 120_000,
    });
    const pdfBase64 = data?.edoviz_pdf ? String(data.edoviz_pdf) : "";
    return {
        xml: data?.edoviz_xml ? String(data.edoviz_xml) : null,
        pdf: pdfBase64 ? Buffer.from(pdfBase64, "base64") : null,
        mesaj: data?.response_message ? String(data.response_message) : "",
    };
};
