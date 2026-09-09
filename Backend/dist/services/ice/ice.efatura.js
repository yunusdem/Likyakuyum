import { READ_TIMEOUT_MS, escapeXml, optionalField, toIceDateTime, } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
/**
 * INVOICE_SEARCH_KEY bloğu. Alan sırası şema sequence'ı ile aynı.
 */
export const buildInvoiceSearchKeyXml = (filtre) => {
    const parcalar = [];
    parcalar.push(optionalField("LIMIT", filtre.limit));
    if (filtre.id)
        parcalar.push(`<ID>${escapeXml(filtre.id)}</ID>`);
    if (filtre.uuid)
        parcalar.push(`<UUID>${escapeXml(filtre.uuid)}</UUID>`);
    if (filtre.from)
        parcalar.push(`<FROM>${escapeXml(filtre.from)}</FROM>`);
    if (filtre.to)
        parcalar.push(`<TO>${escapeXml(filtre.to)}</TO>`);
    parcalar.push(optionalField("START_DATE", filtre.baslangicTarihi, (v) => toIceDateTime(v)));
    parcalar.push(optionalField("END_DATE", filtre.bitisTarihi, (v) => toIceDateTime(v)));
    parcalar.push(optionalField("READ_INCLUDED", filtre.okunmuslarDahil, (v) => (v ? "true" : "false")));
    // PROCESSED_INCLUDED yalnızca CANLI WSDL'de var (2020 paketinde yoktu)
    parcalar.push(optionalField("PROCESSED_INCLUDED", filtre.islenmislerDahil, (v) => (v ? "true" : "false")));
    if (filtre.yon)
        parcalar.push(`<DIRECTION>${escapeXml(filtre.yon)}</DIRECTION>`);
    if (filtre.sender)
        parcalar.push(`<SENDER>${escapeXml(filtre.sender)}</SENDER>`);
    if (filtre.receiver)
        parcalar.push(`<RECEIVER>${escapeXml(filtre.receiver)}</RECEIVER>`);
    return `<INVOICE_SEARCH_KEY>${parcalar.join("")}</INVOICE_SEARCH_KEY>`;
};
const buildGetInvoiceRequestXml = (loginHeaderXml, filtre, sadeceBaslik) => `<GetInvoiceRequest>` +
    loginHeaderXml +
    buildInvoiceSearchKeyXml(filtre) +
    // HEADER_ONLY şemada string; boolean değil
    `<HEADER_ONLY>${sadeceBaslik ? "true" : "false"}</HEADER_ONLY>` +
    `</GetInvoiceRequest>`;
/** Tek düğüm ya da dizi dönebilen alanları daima diziye çevirir */
export const toArray = (deger) => {
    if (deger === undefined || deger === null)
        return [];
    return Array.isArray(deger) ? deger : [deger];
};
/**
 * `GetInvoice_Count` — aynı filtreyle yalnızca ADET döner.
 * Sayfalama için önce bu çağrılır; tüm listeyi çekip saymaya gerek kalmaz.
 */
export const getInvoiceCount = async (config, filtre) => {
    const { data } = await callWithSession(config, {
        method: "GetInvoice_Count",
        buildInnerXml: (loginHeaderXml) => buildGetInvoiceRequestXml(loginHeaderXml, filtre, true),
        authHatasindaTekrarla: true,
        timeoutMs: READ_TIMEOUT_MS,
    });
    const sayi = Number(data);
    return isNaN(sayi) ? 0 : sayi;
};
/**
 * `GetInvoice` — belge listesi.
 * `sadeceBaslik=true` iken CONTENT (base64 UBL) gelmez; liste ekranı için çok daha hafiftir.
 */
export const getInvoices = async (config, filtre, sadeceBaslik = true) => {
    const { data, trace } = await callWithSession(config, {
        method: "GetInvoice",
        buildInnerXml: (loginHeaderXml) => buildGetInvoiceRequestXml(loginHeaderXml, filtre, sadeceBaslik),
        authHatasindaTekrarla: true,
        timeoutMs: READ_TIMEOUT_MS,
    });
    return { faturalar: toArray(data?.INVOICE), sureMs: trace.sureMs };
};
export const getInvoiceStatusDetail = async (config, uuid) => {
    const { data } = await callWithSession(config, {
        method: "Get_Invoice_Status_Detail",
        buildInnerXml: (loginHeaderXml) => `<get_invoice_status_request>${loginHeaderXml}<UUID>${escapeXml(uuid)}</UUID></get_invoice_status_request>`,
        authHatasindaTekrarla: true,
    });
    return data || {};
};
/**
 * `invoice_check_validate` — belgeyi **göndermeden** şema ve schematron doğrular,
 * istenirse HTML/PDF önizleme döndürür.
 *
 * Canlı hesapla mali sonuç doğurmadan test etmenin ana yolu (docs/ice-baglanti.md §10.3 C4).
 */
export const invoiceCheckValidate = async (config, invoiceBase64, secenekler = {}) => {
    const { data } = await callWithSession(config, {
        method: "invoice_check_validate",
        buildInnerXml: (loginHeaderXml) => `<_invoice_check_validate_request>` +
            loginHeaderXml +
            `<get_html>${secenekler.html ? "true" : "false"}</get_html>` +
            `<get_pdf>${secenekler.pdf ? "true" : "false"}</get_pdf>` +
            `<invoice><invoice>${escapeXml(invoiceBase64)}</invoice></invoice>` +
            `</_invoice_check_validate_request>`,
        // Doğrulama okuma işlemidir, belge oluşturmaz — yeniden deneme güvenli
        authHatasindaTekrarla: true,
        timeoutMs: 90_000,
    });
    return data || {};
};
/**
 * `Get_Son_Belge_ID` — ICE tarafındaki son belge numarası.
 * Kendi numaratörümüzle karşılaştırıp çakışmayı önceden yakalamak için (§3.1).
 */
export const getSonBelgeId = async (config, seri, belgeTuru, yil) => {
    const { data } = await callWithSession(config, {
        method: "Get_Son_Belge_ID",
        buildInnerXml: (loginHeaderXml) => loginHeaderXml +
            `<Seri>${escapeXml(seri)}</Seri>` +
            `<Belge_Turu>${escapeXml(belgeTuru)}</Belge_Turu>` +
            `<Yil>${Number(yil)}</Yil>`,
        authHatasindaTekrarla: true,
    });
    return data;
};
/**
 * `getUserList_EFatura` — VKN/TCKN'nin e-Fatura mükellefi olup olmadığını,
 * mükellefse GİB posta kutusu etiketlerini (alias) döndürür.
 *
 * Sonuç boşsa alıcı e-Fatura mükellefi değildir → e-Arşiv kesilmelidir.
 */
export const getUserListEFatura = async (config, vknTckn) => {
    const { data } = await callWithSession(config, {
        method: "getUserList_EFatura",
        buildInnerXml: (loginHeaderXml) => `<_getUserList_request>` +
            loginHeaderXml +
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
 * `send_invoice_taslak` — belgeyi ICE'de **taslak** olarak oluşturur.
 *
 * ÖNEMLİ: Taslak GİB'e **gitmez**. GİB'e ancak
 * `send_draft_document_approval` + `DraftApproval` ile gönderilir — bu çağrı
 * Faz 6 kapsamında bilerek kullanılmamaktadır.
 *
 * Yazma çağrısıdır: `authHatasindaTekrarla: false`.
 */
export const buildSendInvoiceInnerXml = (loginHeaderXml, girdi) => {
    // Alan sırası send_invoice_request şemasının sequence'ı ile birebir aynı olmalıdır
    const invoicesXml = girdi.invoicesBase64
        .map((b64) => `<invoiceType><invoice>${escapeXml(b64)}</invoice></invoiceType>`)
        .join("");
    return (`<sendInvoiceRequest>` +
        loginHeaderXml +
        `<from_vkn_tckn>${escapeXml(girdi.fromVknTckn)}</from_vkn_tckn>` +
        `<from_alias>${escapeXml(girdi.fromAlias)}</from_alias>` +
        `<to_vkn_tckn>${escapeXml(girdi.toVknTckn)}</to_vkn_tckn>` +
        `<to_alias>${escapeXml(girdi.toAlias)}</to_alias>` +
        `<invoices>${invoicesXml}</invoices>` +
        `</sendInvoiceRequest>`);
};
/**
 * `send_invoice` — belgeyi **doğrudan GİB'e** gönderir.
 *
 * ⚠️⚠️ **GERİ ALINAMAZ.** Taslak değildir; belge GİB'e iletilir, fatura numarası ve
 * kontör kalıcı olarak yanar. Düzeltmenin tek yolu alıcının red cevabı (ticari fatura,
 * 8 gün içinde) ya da iade faturası kesmektir.
 *
 * İstek zarfı `send_invoice_taslak` ile birebir aynıdır (`send_invoice_request`);
 * fark yalnızca metod adıdır. Yazma çağrısı: otomatik yeniden deneme KAPALI.
 */
export const sendInvoice = async (config, girdi) => {
    const { data } = await callWithSession(config, {
        method: "send_invoice",
        buildInnerXml: (loginHeaderXml) => buildSendInvoiceInnerXml(loginHeaderXml, girdi),
        authHatasindaTekrarla: false,
        timeoutMs: 120_000,
    });
    return data || {};
};
export const sendInvoiceTaslak = async (config, girdi) => {
    const { data } = await callWithSession(config, {
        method: "send_invoice_taslak",
        buildInnerXml: (loginHeaderXml) => buildSendInvoiceInnerXml(loginHeaderXml, girdi),
        authHatasindaTekrarla: false,
        timeoutMs: 120_000,
    });
    return data || {};
};
/** Gönderim cevabındaki belge satırlarını diziye çevirir */
export const gonderimSatirlari = (sonuc) => toArray(sonuc?.invoiceType_responseTypes?.invoiceType_responseType);
/** Canlı WSDL'deki DocumentType enum'u */
export const ICE_DOCUMENT_TYPES = [
    "EFatura",
    "EArsiv",
    "EIrsaliye",
    "EIrsaliyeYanit",
    "ESMM",
    "EMM",
    "EDoviz_Alim",
    "EDoviz_Satim",
    "EAdisyon",
    "EDekont",
    "ESigorta_Komisyon_Gider_Belgesi",
    "EGiderPusulasi",
];
/**
 * `send_draft_document_approval` — taslağı onaylar (**GİB'e gönderir**) veya iptal eder.
 *
 * ⚠️ `processType = "DraftApproval"` belgeyi GİB'e iletir ve **geri alınamaz**.
 * Faz 6'da yalnızca `"DraftCancel"` kullanılmaktadır; onay Faz 7'de,
 * ayrı bir kullanıcı kararıyla açılacaktır (docs/ice-baglanti.md §9).
 */
export const sendDraftDocumentApproval = async (config, dokumanNo, documentType, processType) => {
    const { data } = await callWithSession(config, {
        method: "send_draft_document_approval",
        buildInnerXml: (loginHeaderXml) => `<documentApprovalRequest>` +
            loginHeaderXml +
            `<dokumanNo>${escapeXml(dokumanNo)}</dokumanNo>` +
            `<documentType>${escapeXml(documentType)}</documentType>` +
            `<processType>${escapeXml(processType)}</processType>` +
            `</documentApprovalRequest>`,
        authHatasindaTekrarla: false,
        timeoutMs: 90_000,
    });
    return data || {};
};
/**
 * `invoice_Red_Kabul` — gelen ticari faturaya kabul veya red cevabı gönderir.
 *
 * **GERİ ALINAMAZ.** `authHatasindaTekrarla: false` — oturum düşse bile çağrı
 * tekrarlanmaz; aksi halde ikinci bir cevap gönderilebilir (§11.1 S8).
 */
export const invoiceRedKabul = async (config, ettn, redKabul, aciklama) => {
    const { data } = await callWithSession(config, {
        method: "invoice_Red_Kabul",
        buildInnerXml: (loginHeaderXml) => `<invoice_red_kabul_request>` +
            loginHeaderXml +
            `<ETTN>${escapeXml(ettn)}</ETTN>` +
            `<Red_Kabul>${escapeXml(redKabul)}</Red_Kabul>` +
            `<Aciklama>${escapeXml(aciklama)}</Aciklama>` +
            `</invoice_red_kabul_request>`,
        authHatasindaTekrarla: false, // yazma çağrısı — asla tekrarlanmaz
        timeoutMs: 60_000,
    });
    return data || {};
};
/** ICE'nin kabul ettiği okuma/işlenme statüleri */
export const ICE_BELGE_STATULERI = ["Okunmadı", "Okundu", "Islendi", "Islenmedi"];
/**
 * `Set_Invoice_Status` — belgenin okundu/işlendi statüsünü ICE tarafında işaretler.
 * Mali sonuç doğurmaz ama yine de yazma çağrısıdır; tekrarlanmaz.
 */
export const setInvoiceStatus = async (config, uuid, statu) => {
    const { data } = await callWithSession(config, {
        method: "Set_Invoice_Status",
        buildInnerXml: (loginHeaderXml) => `<get_invoice_set_statu_request>` +
            loginHeaderXml +
            `<UUID>${escapeXml(uuid)}</UUID>` +
            `<Statu>${escapeXml(statu)}</Statu>` +
            `</get_invoice_set_statu_request>`,
        authHatasindaTekrarla: false,
    });
    return String(data).toLowerCase() === "true";
};
/** `GetInvoice_HTML` — belgenin HTML çıktısı (üçüncü tarafın ürettiği HTML!) */
export const getInvoiceHtml = async (config, ettn) => {
    const { data } = await callWithSession(config, {
        method: "GetInvoice_HTML",
        buildInnerXml: (loginHeaderXml) => `<getInvoice_ETTN>${loginHeaderXml}<ETTN>${escapeXml(ettn)}</ETTN></getInvoice_ETTN>`,
        authHatasindaTekrarla: true,
    });
    return typeof data === "string" ? data : "";
};
/** `GetInvoice_PDF` — belgenin PDF çıktısı (base64) */
export const getInvoicePdf = async (config, ettn) => {
    const { data } = await callWithSession(config, {
        method: "GetInvoice_PDF",
        buildInnerXml: (loginHeaderXml) => `<getInvoice_ETTN>${loginHeaderXml}<ETTN>${escapeXml(ettn)}</ETTN></getInvoice_ETTN>`,
        authHatasindaTekrarla: true,
        timeoutMs: 60_000,
    });
    if (typeof data !== "string" || !data.trim()) {
        return Buffer.alloc(0);
    }
    return Buffer.from(data, "base64");
};
/**
 * PAYABLE_AMOUNT gibi öznitelikli sayısal alanlardan değeri çıkarır.
 * `<PAYABLE_AMOUNT currencyID="TRY">1234.56</PAYABLE_AMOUNT>` → 1234.56
 */
export const parseAmount = (deger) => {
    if (deger === null || deger === undefined)
        return null;
    const ham = typeof deger === "object" ? deger["#text"] : deger;
    const sayi = Number(ham);
    return isNaN(sayi) ? null : sayi;
};
/** Aynı alandan para birimi kodunu okur */
export const parseCurrency = (deger) => {
    if (deger && typeof deger === "object") {
        return deger["@_currencyID"] ? String(deger["@_currencyID"]) : null;
    }
    return null;
};
/** ICE'nin döndürdüğü dateTime metnini Date'e çevirir */
export const parseIceDate = (deger) => {
    if (!deger)
        return null;
    const d = new Date(String(deger));
    return isNaN(d.getTime()) ? null : d;
};
