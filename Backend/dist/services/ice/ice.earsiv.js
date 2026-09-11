import { escapeXml, optionalField, toIceDateTime } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
import { toArray } from "./ice.efatura.js";
import { ApiError } from "../../utils/ApiError.js";
/** Yalnız başlık okur. WSDL'de sayfa/ofset veya DIRECTION alanı yoktur. */
export const getEArchive = async (config, filtre) => {
    const { data } = await callWithSession(config, {
        method: "GetEArchive",
        buildInnerXml: (header) => `<GetEArchiveRequest>${header}<EArchive_SEARCH_KEY>` +
            optionalField("LIMIT", filtre.limit) +
            optionalField("START_DATE", filtre.baslangic, toIceDateTime) +
            optionalField("END_DATE", filtre.bitis, toIceDateTime) +
            optionalField("READ_INCLUDED", true, () => "true") +
            optionalField("PROCESSED_INCLUDED", true, () => "true") +
            `</EArchive_SEARCH_KEY><HEADER_ONLY>true</HEADER_ONLY></GetEArchiveRequest>`,
        authHatasindaTekrarla: true,
    });
    // Boş sonuç geçerlidir; eksik SOAP yanıtı boş liste gibi sunulamaz.
    if (data == null)
        throw ApiError.unprocessable("ICE arşiv yanıtı alınamadı.");
    if (typeof data !== "object" && data !== "")
        throw ApiError.unprocessable("ICE arşiv yanıtının biçimi geçersiz.");
    return toArray(data && typeof data === "object" ? data.EArchive : undefined)
        .filter((r) => !!r && typeof r === "object");
};
export const setEArchiveStatus = async (config, uuid, statu) => {
    const { data } = await callWithSession(config, {
        method: "Set_EArchive_Status",
        buildInnerXml: (header) => `<set_statu_request>${header}<UUID>${escapeXml(uuid)}</UUID>` +
            `<Statu>${escapeXml(statu)}</Statu></set_statu_request>`,
        authHatasindaTekrarla: false,
    });
    return String(data).toLowerCase() === "true";
};
/**
 * e-Arşiv operasyonları (Faz 8a).
 *
 * Kaynak: docs/ice/integration-2026-09-09.wsdl
 *
 * e-Arşiv, e-Fatura mükellefi OLMAYAN alıcıya kesilen faturadır. Belge GİB'e
 * anlık iletilmez; **rapor** olarak toplu bildirilir. Bu yüzden e-Fatura'dan
 * iki farkı vardır:
 *  - Alıcı posta kutusu (alias) yoktur → `send_earsiv` yalnızca belgeleri alır.
 *  - İptal, belgeyi silmez; GİB'e **iptal bildirimi** olarak gider.
 */
/**
 * `send_earsiv` — e-Arşiv faturasını entegratöre gönderir.
 *
 * ⚠️ Mali sonuç doğurur. Yazma çağrısıdır: otomatik yeniden deneme KAPALI.
 * Zarf yapısı: `<earsiv_invoices><base64Binary><earsiv_invoice>…`
 */
export const sendEarsiv = async (config, invoicesBase64) => {
    const belgelerXml = invoicesBase64
        .map((b64) => `<base64Binary><earsiv_invoice>${escapeXml(b64)}</earsiv_invoice></base64Binary>`)
        .join("");
    const { data } = await callWithSession(config, {
        method: "send_earsiv",
        buildInnerXml: (loginHeaderXml) => `<sendEArsivRequest>` +
            loginHeaderXml +
            `<earsiv_invoices>${belgelerXml}</earsiv_invoices>` +
            `</sendEArsivRequest>`,
        authHatasindaTekrarla: false,
        timeoutMs: 120_000,
    });
    return data || {};
};
/**
 * `send_earsiv_iptal` — e-Arşiv faturası için GİB'e **iptal bildirimi** gönderir.
 *
 * ⚠️ Belgeyi silmez; iptal edildiği bilgisini raporlar. Geri alınamaz.
 */
export const sendEarsivIptal = async (config, faturaNo, iptalTarihi) => {
    const { data } = await callWithSession(config, {
        method: "send_earsiv_iptal",
        buildInnerXml: (loginHeaderXml) => `<sendEArsivRequest>` +
            loginHeaderXml +
            `<faturaNo>${escapeXml(faturaNo)}</faturaNo>` +
            `<iptalTarihi>${toIceDateTime(iptalTarihi)}</iptalTarihi>` +
            `</sendEArsivRequest>`,
        authHatasindaTekrarla: false,
        timeoutMs: 60_000,
    });
    return data || {};
};
/**
 * `preview_invoice` — kesilmiş bir e-Arşiv faturasının PDF görüntüsünü döndürür.
 * Alıcı doğrulaması için VKN + fatura no + tarih + tutar birlikte istenir.
 */
export const previewInvoice = async (config, girdi) => {
    const { data } = await callWithSession(config, {
        method: "preview_invoice",
        buildInnerXml: (loginHeaderXml) => `<invoice>` +
            loginHeaderXml +
            `<vkn_tckn>${escapeXml(girdi.vknTckn)}</vkn_tckn>` +
            `<faturaNo>${escapeXml(girdi.faturaNo)}</faturaNo>` +
            `<duzenlenmeTarihi>${toIceDateTime(girdi.duzenlenmeTarihi)}</duzenlenmeTarihi>` +
            `<odenecekTutar>${girdi.odenecekTutar.toFixed(2)}</odenecekTutar>` +
            `</invoice>`,
        authHatasindaTekrarla: true,
        timeoutMs: 60_000,
    });
    const b64 = typeof data?.response_message === "string" ? data.response_message : "";
    if (String(data?.success).toLowerCase() !== "true") {
        throw ApiError.unprocessable("ICE PDF önizleme isteğini karşılayamadı.");
    }
    const temiz = b64.replace(/\s/g, "");
    if (!temiz || temiz.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(temiz)) {
        throw ApiError.unprocessable("ICE geçerli bir PDF verisi döndürmedi.");
    }
    const pdf = Buffer.from(temiz, "base64");
    if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw ApiError.unprocessable("ICE cevabı PDF biçiminde değil.");
    }
    return pdf;
};
/* ==========================================================================
   Belge e-posta gönderimi
   ========================================================================== */
/** `EmailDocumentType` — canlı WSDL'deki enum birebir */
export const EMAIL_BELGE_TURLERI = [
    "Diger",
    "EFatura_Gelen",
    "EFatura_Giden",
    "EFatura_Gelen_KabulRed",
    "EFatura_Giden_KabulRed",
    "EArsiv",
    "EArsiv_Iptal",
    "ESMM",
    "ESMM_Iptal",
    "EMM",
    "EMM_Iptal",
    "EIrsaliye_Gelen",
    "EIrsaliye_Giden",
    "EIrsaliye_Yanit_Gelen",
    "EIrsaliye_Yanit_Giden",
    "EDekont",
    "ESigorta_Komisyon_Gider_Belgesi",
    "EGiderPusulasi",
];
/**
 * `Send_Document_Email` — belgeyi alıcıya **e-posta ile gönderir**.
 *
 * DİKKAT: Bu, mail *durumu okumak* değildir (`GetInvoice_EMail_Statu` onu yapar);
 * bu uç gerçekten mail gönderir.
 *
 * Zarf yapısı WSDL'den birebir:
 * `SendDocumentEmailRequest → DocumentEmailRequestList → DocumentEmailRequest[]`
 * her istekte `ID`, `UUID`, `DocumentType`, `EmailRecipientList → EmailRecipient[]`
 *
 * Yazma çağrısıdır (mail gider): otomatik yeniden deneme KAPALI —
 * aksi halde alıcıya iki kez mail gidebilir.
 */
export const sendDocumentEmail = async (config, belgeler) => {
    const istekXml = belgeler
        .map((b) => `<DocumentEmailRequest>` +
        (b.belgeNo?.trim() ? `<ID>${escapeXml(b.belgeNo)}</ID>` : "") +
        `<UUID>${escapeXml(b.uuid)}</UUID>` +
        `<DocumentType>${escapeXml(b.belgeTuru)}</DocumentType>` +
        `<EmailRecipientList>` +
        b.alicilar
            .map((a) => `<EmailRecipient>` +
            (a.unvan?.trim() ? `<Title>${escapeXml(a.unvan)}</Title>` : "") +
            `<Email>${escapeXml(a.eposta)}</Email>` +
            `</EmailRecipient>`)
            .join("") +
        `</EmailRecipientList>` +
        `</DocumentEmailRequest>`)
        .join("");
    const { data } = await callWithSession(config, {
        method: "Send_Document_Email",
        buildInnerXml: (header) => `<SendDocumentEmailRequest>` +
            header +
            `<DocumentEmailRequestList>${istekXml}</DocumentEmailRequestList>` +
            `</SendDocumentEmailRequest>`,
        authHatasindaTekrarla: false,
        timeoutMs: 90_000,
    });
    // Cevap: DocumentEmailResponseList → DocumentEmailResponse[] → EmailResponseList → EmailRecipientResponse[]
    const belgeCevaplari = toArray(data?.DocumentEmailResponseList?.DocumentEmailResponse);
    const sonuclar = [];
    for (const belge of belgeCevaplari) {
        for (const alici of toArray(belge?.EmailResponseList?.EmailRecipientResponse)) {
            sonuclar.push(alici);
        }
    }
    return sonuclar;
};
/**
 * `GetInvoice_Rapor_Statu` — e-Arşiv faturalarının GİB'e raporlanma durumu.
 * e-Arşiv'de belgenin "gitti" sayılması bu rapora bağlıdır.
 */
export const getEarsivRaporStatu = async (config, ettnler) => {
    const { data } = await callWithSession(config, {
        method: "GetInvoice_Rapor_Statu",
        buildInnerXml: (loginHeaderXml) => `<getInvoice_ETTN_List>` +
            loginHeaderXml +
            `<ETTNs>${ettnler.map((e) => `<string>${escapeXml(e)}</string>`).join("")}</ETTNs>` +
            `</getInvoice_ETTN_List>`,
        authHatasindaTekrarla: true,
    });
    return toArray(data?.Earsiv_Rapor_Status?.Earsiv_Rapor_Statu ?? data?.Earsiv_Rapor_Statu);
};
/**
 * `GetInvoice_EMail_Statu` — e-Arşiv faturasının alıcıya e-posta ile
 * iletilip iletilmediğini döndürür.
 */
export const getEarsivMailStatu = async (config, ettnler) => {
    const { data } = await callWithSession(config, {
        method: "GetInvoice_EMail_Statu",
        buildInnerXml: (loginHeaderXml) => `<getInvoice_ETTN_List>` +
            loginHeaderXml +
            `<ETTNs>${ettnler.map((e) => `<string>${escapeXml(e)}</string>`).join("")}</ETTNs>` +
            `</getInvoice_ETTN_List>`,
        authHatasindaTekrarla: true,
    });
    return toArray(data?.email_status?.Email_Statu ?? data?.Email_Statu);
};
