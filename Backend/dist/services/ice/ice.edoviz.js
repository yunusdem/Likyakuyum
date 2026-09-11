import { escapeXml } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
import { ApiError } from "../../utils/ApiError.js";
const alan = (ad, deger) => {
    if (deger === undefined || deger === null)
        return "";
    const metin = String(deger).trim();
    if (!metin)
        return "";
    return `<${ad}>${escapeXml(metin)}</${ad}>`;
};
/** Boş bloğu hiç göndermemek için: içi boşsa etiket de üretilmez. */
const blok = (ad, icerik) => (icerik ? `<${ad}>${icerik}</${ad}>` : "");
const tarafXml = (ad, t, musteriMi) => blok(ad, alan("Vkn_Tckn", t.vknTckn) +
    (musteriMi ? alan("Pasaport_No", t.pasaportNo) : "") +
    alan("Unvan", t.unvan) +
    alan("Adi", t.ad) +
    alan("Soyadi", t.soyad) +
    alan("Adres", t.adres) +
    alan("Ulke", t.ulke) +
    alan("Sehir", t.sehir) +
    alan("Ilce", t.ilce) +
    alan(musteriMi ? "VergiDairesi" : "Vergi_Dairesi", t.vergiDairesi) +
    alan("Telefon", t.telefon) +
    alan("Email", t.eposta) +
    alan("Ticaret_Sicil_No", t.ticaretSicilNo) +
    (musteriMi ? alan("Musteri_Turu", t.musteriTuru) : ""));
/**
 * `eDoviz_Belge` gövdesini üretir. Alan sırası WSDL sequence'ı ile birebir aynıdır;
 * sıra bozulursa ICE belgeyi reddeder.
 */
export const buildEDovizInnerXml = (loginHeaderXml, g) => `<_eDovizBelge>` +
    loginHeaderXml +
    blok("Baslik_Bilgileri", alan("ID", g.belgeNo) +
        alan("UUID", g.uuid) +
        alan("ProfileID", g.profileId) +
        alan("CreditNoteTypeCode", g.creditNoteTypeCode) +
        alan("Duzenleme_Tarihi", g.duzenlemeTarihi) +
        alan("Duzenleme_Saati", g.duzenlemeSaati) +
        blok("Notlar", (g.notlar || []).map((n) => alan("string", n)).join(""))) +
    tarafXml("Yetkili_Muessese", g.yetkiliMuessese, false) +
    tarafXml("Musteri", g.musteri, true) +
    blok("Alis_Satis_Bilgileri", alan("Doviz_Kodu", g.alisSatis.dovizKodu) +
        alan("Dolar_Karsilik_Kuru", g.alisSatis.dolarKarsilikKuru) +
        alan("TL_Karsilik_Kuru", g.alisSatis.tlKarsilikKuru) +
        alan("Vergi_Orani", g.alisSatis.vergiOrani) +
        alan("Vergi_Tutari", g.alisSatis.vergiTutari) +
        alan("Vergi_Matrah", g.alisSatis.vergiMatrah) +
        alan("Doviz_Miktar", g.alisSatis.dovizMiktar)) +
    blok("Ek_Bilgiler", alan("Istatistik_No", g.ekBilgiler?.istatistikNo) +
        alan("Geldigi_Ulke", g.ekBilgiler?.geldigiUlke) +
        alan("Gelis_Nedeni", g.ekBilgiler?.gelisNedeni) +
        alan("Ihracat_Yabanci_Sermaye", g.ekBilgiler?.ihracatYabanciSermaye) +
        alan("Gumruk_Beyan_Tarihi", g.ekBilgiler?.gumrukBeyanTarihi) +
        alan("Gumruk_Beyan_No", g.ekBilgiler?.gumrukBeyanNo) +
        alan("DBT_Tarihi", g.ekBilgiler?.dbtTarihi) +
        alan("DBT_Sayi", g.ekBilgiler?.dbtSayi) +
        alan("GMTY_Tarihi", g.ekBilgiler?.gmtyTarihi) +
        alan("GMTY_Sayi", g.ekBilgiler?.gmtySayi) +
        alan("Vezne", g.ekBilgiler?.vezne)) +
    blok("Komisyon_Bilgileri", alan("Komisyon_Tutar_Vergi_Haric", g.komisyon?.vergiHaric) +
        alan("Komisyon_Tutar_Vergi", g.komisyon?.vergi) +
        alan("Komisyon_Dahil_Toplam", g.komisyon?.dahilToplam)) +
    blok("Tutar_Bilgileri", alan("Miktar", g.tutar.miktar) +
        alan("Kod", g.tutar.kod) +
        alan("TL_Karsilik_Kuru", g.tutar.tlKarsilikKuru) +
        alan("Dolar_Karsilik_Kuru", g.tutar.dolarKarsilikKuru) +
        alan("Saf_Altin_Karsiligi", g.tutar.safAltinKarsiligi) +
        alan("Vergi_Orani", g.tutar.vergiOrani) +
        alan("Vergi_Matrahi", g.tutar.vergiMatrahi) +
        alan("Vergi_Tutari", g.tutar.vergiTutari) +
        alan("LineExtensionAmount", g.tutar.lineExtensionAmount) +
        alan("TaxExclusiveAmount", g.tutar.taxExclusiveAmount) +
        alan("TaxInclusiveAmount", g.tutar.taxInclusiveAmount) +
        alan("PayableAmount", g.tutar.payableAmount)) +
    `<TutarHesaplanmasin>${g.tutarHesaplanmasin ? "true" : "false"}</TutarHesaplanmasin>` +
    `</_eDovizBelge>`;
/**
 * `preview_edoviz_basic` — belgeyi ICE'ye **göndermeden** önizler.
 *
 * Mali sonuç doğurmaz; okuma çağrısı sayıldığı için auth hatasında tekrar denenebilir.
 */
export const previewEDoviz = async (config, girdi) => {
    const { data } = await callWithSession(config, {
        method: "preview_edoviz_basic",
        buildInnerXml: (loginHeaderXml) => buildEDovizInnerXml(loginHeaderXml, girdi),
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
/**
 * `send_edoviz_basic` — e-Döviz belgesini gönderir.
 *
 * ⚠️ Mali sonuç doğurur. Yazma çağrısıdır: auth hatasında otomatik tekrar KAPALI.
 */
export const sendEDoviz = async (config, girdi) => {
    const { data } = await callWithSession(config, {
        method: "send_edoviz_basic",
        buildInnerXml: (loginHeaderXml) => buildEDovizInnerXml(loginHeaderXml, girdi),
        authHatasindaTekrarla: false,
        timeoutMs: 120_000,
    });
    return data || {};
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
