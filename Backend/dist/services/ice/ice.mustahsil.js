import { escapeXml } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
const b64 = (x) => `<base64Binary><earsiv_invoice>${escapeXml(x)}</earsiv_invoice></base64Binary>`;
export async function validateMustahsil(c, xmlBase64, html = false) {
    const { data } = await callWithSession(c, { method: "producerreceipt_check_validate", buildInnerXml: h => `<_producerreceipt_check_validate_request>${h}<get_html>${html}</get_html><get_pdf>false</get_pdf><producer_receipt>${escapeXml(xmlBase64)}</producer_receipt></_producerreceipt_check_validate_request>`, authHatasindaTekrarla: true, timeoutMs: 60_000 });
    return data || {};
}
export async function sendMustahsil(c, xmlBase64) {
    const { data } = await callWithSession(c, { method: "send_emustahsil", buildInnerXml: h => `<sendEMustahsilRequest>${h}<earsiv_invoices>${b64(xmlBase64)}</earsiv_invoices></sendEMustahsilRequest>`, authHatasindaTekrarla: false, timeoutMs: 120_000 });
    return data || {};
}
export async function cancelMustahsil(c, no, tarih) { const { data } = await callWithSession(c, { method: "send_emustahsil_iptal", buildInnerXml: h => `<Emustahsil_IptalType_request>${h}<mustahsilNo>${escapeXml(no)}</mustahsilNo><iptalTarihi>${escapeXml(tarih)}</iptalTarihi></Emustahsil_IptalType_request>`, authHatasindaTekrarla: false, timeoutMs: 120_000 }); return { basarili: String(data?.success).toLowerCase() === "true", mesaj: String(data?.response_message || "") }; }
export async function getProducerReceipts(c, o = {}) {
    const limit = Math.min(Math.max(o.limit || 100, 1), 1000), uu = o.uuid ? `<UUID_List><string>${escapeXml(o.uuid)}</string></UUID_List>` : "";
    const { data } = await callWithSession(c, { method: "GetProducerReceipt", buildInnerXml: h => `<GetProducerReceiptRequest>${h}<ProducerReceipt_SEARCH_KEY><LIMIT>${limit}</LIMIT><LIMITSpecified>true</LIMITSpecified>${uu}${o.baslangic ? `<START_DATE>${escapeXml(o.baslangic)}</START_DATE><START_DATESpecified>true</START_DATESpecified>` : `<START_DATESpecified>false</START_DATESpecified>`}${o.bitis ? `<END_DATE>${escapeXml(o.bitis)}</END_DATE><END_DATESpecified>true</END_DATESpecified>` : `<END_DATESpecified>false</END_DATESpecified>`}<READ_INCLUDED>${!!o.okunanlar}</READ_INCLUDED><READ_INCLUDEDSpecified>true</READ_INCLUDEDSpecified><PROCESSED_INCLUDED>${!!o.islenenler}</PROCESSED_INCLUDED><PROCESSED_INCLUDEDSpecified>true</PROCESSED_INCLUDEDSpecified></ProducerReceipt_SEARCH_KEY><HEADER_ONLY>false</HEADER_ONLY></GetProducerReceiptRequest>`, authHatasindaTekrarla: true, timeoutMs: 120_000 });
    const x = data?.ProducerReceipt;
    return !x ? [] : Array.isArray(x) ? x : [x];
}
export async function setProducerReceiptStatus(c, uuid, statu) { const { data } = await callWithSession(c, { method: "Set_ProducerReceipt_Status", buildInnerXml: h => `<set_statu_request>${h}<UUID>${escapeXml(uuid)}</UUID><Statu>${statu}</Statu></set_statu_request>`, authHatasindaTekrarla: false }); return String(data).toLowerCase() === "true"; }
