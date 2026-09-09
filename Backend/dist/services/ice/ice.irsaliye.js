import { escapeXml, optionalField, toIceDateTime } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
import { toArray } from "./ice.efatura.js";
import { ApiError } from "../../utils/ApiError.js";
/**
 * `despatchadvice_check_validate` — irsaliyeyi **göndermeden** şema + schematron doğrular.
 */
export const despatchAdviceCheckValidate = async (config, irsaliyeBase64, secenekler = {}) => {
    const { data } = await callWithSession(config, {
        method: "despatchadvice_check_validate",
        buildInnerXml: (header) => `<_despatchadvice_check_validate_request>` +
            header +
            `<get_html>${secenekler.html ? "true" : "false"}</get_html>` +
            `<get_pdf>${secenekler.pdf ? "true" : "false"}</get_pdf>` +
            `<irsaliye>${escapeXml(irsaliyeBase64)}</irsaliye>` +
            `</_despatchadvice_check_validate_request>`,
        // Doğrulama belge oluşturmaz — yeniden deneme güvenli
        authHatasindaTekrarla: true,
        timeoutMs: 90_000,
    });
    return data || {};
};
/**
 * `send_DespatchAdvice` — e-İrsaliyeyi GİB'e gönderir.
 *
 * ⚠️ **GERİ ALINAMAZ.** Yazma çağrısı: otomatik yeniden deneme KAPALI.
 *
 * Zarf yapısı WSDL'den birebir:
 * `<DespatchAdvices><DespatchAdvices><DespatchAdvice>base64</DespatchAdvice></DespatchAdvices></DespatchAdvices>`
 * (dış ve iç öğe adı aynı — .NET dizi üretecinin sonucu)
 */
export const sendDespatchAdvice = async (config, girdi) => {
    const belgelerXml = girdi.despatchAdvicesBase64
        .map((b64) => `<DespatchAdvices><DespatchAdvice>${escapeXml(b64)}</DespatchAdvice></DespatchAdvices>`)
        .join("");
    const { data } = await callWithSession(config, {
        method: "send_DespatchAdvice",
        buildInnerXml: (header) => `<sendDespatchAdviceRequest>` +
            header +
            `<from_vkn_tckn>${escapeXml(girdi.fromVknTckn)}</from_vkn_tckn>` +
            `<from_alias>${escapeXml(girdi.fromAlias)}</from_alias>` +
            `<to_vkn_tckn>${escapeXml(girdi.toVknTckn)}</to_vkn_tckn>` +
            `<to_alias>${escapeXml(girdi.toAlias)}</to_alias>` +
            `<DespatchAdvices>${belgelerXml}</DespatchAdvices>` +
            `</sendDespatchAdviceRequest>`,
        authHatasindaTekrarla: false,
        timeoutMs: 120_000,
    });
    return data || {};
};
/** Gönderim cevabındaki belge satırlarını diziye çevirir */
export const irsaliyeGonderimSatirlari = (sonuc) => toArray(sonuc?.DespatchAdviceType_responseTypes?.DespatchAdviceType_responseType);
/**
 * `getUserList_DespatchAdvice` — alıcının **e-İrsaliye** posta kutusu etiketleri.
 *
 * DİKKAT: e-Fatura mükellefiyeti ile e-İrsaliye mükellefiyeti ayrıdır;
 * bu yüzden `getUserList_EFatura` yerine bu uç kullanılır.
 */
export const getUserListDespatchAdvice = async (config, vknTckn) => {
    const { data } = await callWithSession(config, {
        method: "getUserList_DespatchAdvice",
        buildInnerXml: (header) => `<_getUserList_request>` +
            header +
            `<search_Identifier>${escapeXml(vknTckn)}</search_Identifier>` +
            `</_getUserList_request>`,
        authHatasindaTekrarla: true,
    });
    return {
        basarili: String(data?.success).toLowerCase() === "true",
        mesaj: data?.response_message ? String(data.response_message) : "",
        kullanicilar: toArray(data?.GIB_User_List?.GIB_User),
    };
};
/**
 * `GetDespatchadvice` — gelen/giden irsaliye listesi.
 *
 * `Advice_SEARCH_KEY` alanları da `...Specified` bayrağı taşır; bayrak set edilmezse
 * filtre sessizce yok sayılır (docs/ice-baglanti.md §3 bulgu 5).
 */
export const getDespatchAdvices = async (config, filtre, sadeceBaslik = true) => {
    const { data } = await callWithSession(config, {
        method: "GetDespatchadvice",
        buildInnerXml: (header) => `<GetAdviceRequest>` +
            header +
            `<Advice_SEARCH_KEY>` +
            optionalField("LIMIT", filtre.limit) +
            optionalField("START_DATE", filtre.baslangicTarihi, toIceDateTime) +
            optionalField("END_DATE", filtre.bitisTarihi, toIceDateTime) +
            optionalField("READ_INCLUDED", filtre.okunmuslarDahil, (v) => (v ? "true" : "false")) +
            optionalField("PROCESSED_INCLUDED", filtre.islenmislerDahil, (v) => (v ? "true" : "false")) +
            (filtre.yon ? `<DIRECTION>${escapeXml(filtre.yon)}</DIRECTION>` : "") +
            `</Advice_SEARCH_KEY>` +
            `<HEADER_ONLY>${sadeceBaslik ? "true" : "false"}</HEADER_ONLY>` +
            `</GetAdviceRequest>`,
        authHatasindaTekrarla: true,
    });
    if (data == null)
        throw ApiError.unprocessable("ICE irsaliye listesi yanıtı alınamadı.");
    return toArray(data && typeof data === "object" ? data.despatchadvice : undefined).filter((r) => !!r && typeof r === "object");
};
/** `Get_DespatchAdvice_Status` — irsaliyelerin GİB statüsü */
export const getDespatchAdviceStatus = async (config, uuidler, yon) => {
    const { data } = await callWithSession(config, {
        method: "Get_DespatchAdvice_Status",
        buildInnerXml: (header) => `<get_DespatchAdvice_status_request>` +
            header +
            `<UUID_List>${uuidler.map((u) => `<string>${escapeXml(u)}</string>`).join("")}</UUID_List>` +
            `<Direction>${escapeXml(yon)}</Direction>` +
            `</get_DespatchAdvice_status_request>`,
        authHatasindaTekrarla: true,
    });
    return toArray(data?.get_DespatchAdvice_status_response ?? data);
};
/** `Set_DespatchAdvice_Status` — okundu / işlendi işaretleme */
export const setDespatchAdviceStatus = async (config, uuid, statu) => {
    const { data } = await callWithSession(config, {
        method: "Set_DespatchAdvice_Status",
        buildInnerXml: (header) => `<set_DespatchAdvice_statu_request>` +
            header +
            `<UUID>${escapeXml(uuid)}</UUID>` +
            `<Statu>${escapeXml(statu)}</Statu>` +
            `</set_DespatchAdvice_statu_request>`,
        authHatasindaTekrarla: false,
    });
    return String(data).toLowerCase() === "true";
};
/* ==========================================================================
   Çıktı
   ========================================================================== */
/** `GetDespatchadvice_HTML_PDF` — irsaliyenin görüntüsü */
export const getDespatchAdviceCikti = async (config, ettn, secenekler = {}) => {
    const { data } = await callWithSession(config, {
        method: "GetDespatchadvice_HTML_PDF",
        buildInnerXml: (header) => `<getDespatchadvice_HTML_PDF>` +
            header +
            `<ETTN>${escapeXml(ettn)}</ETTN>` +
            `<get_html>${secenekler.html ? "true" : "false"}</get_html>` +
            `<get_pdf>${secenekler.pdf ? "true" : "false"}</get_pdf>` +
            `</getDespatchadvice_HTML_PDF>`,
        authHatasindaTekrarla: true,
        timeoutMs: 60_000,
    });
    let pdf = null;
    if (secenekler.pdf) {
        const temiz = typeof data?.despatchadvice_pdf === "string" ? data.despatchadvice_pdf.replace(/\s/g, "") : "";
        if (temiz) {
            if (temiz.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(temiz)) {
                throw ApiError.unprocessable("ICE geçerli bir PDF verisi döndürmedi.");
            }
            const tampon = Buffer.from(temiz, "base64");
            if (tampon.subarray(0, 5).toString("ascii") !== "%PDF-") {
                throw ApiError.unprocessable("ICE cevabı PDF biçiminde değil.");
            }
            pdf = tampon;
        }
    }
    const html = secenekler.html &&
        typeof data?.despatchadvice_html === "string" &&
        data.despatchadvice_html.trim()
        ? data.despatchadvice_html
        : null;
    return { html, pdf, mesaj: typeof data?.response_message === "string" ? data.response_message : "" };
};
