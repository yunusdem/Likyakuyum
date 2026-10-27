import { escapeXml } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
import { IceConnectionConfig } from "./ice.types.js";
import { IceGonderimSonucu, getInvoiceHtml, getInvoicePdf } from "./ice.efatura.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * e-Gider Pusulası ICE operasyonları (Faz 8d).
 *
 * Kaynak: docs/ice/integration-2026-09-09.wsdl
 *
 * ## Doğrulanan iki nokta
 *
 * 1. `send_egider_pusulasi`, e-Arşiv ile **aynı zarfı** (`send_earsiv_request`) kullanır:
 *    `<earsiv_invoices><base64Binary><earsiv_invoice>…`. Zarf aynı olsa da **içerideki
 *    belge farklıdır** — GİB'de gider pusulası `CreditNote`'tur, ama ICE bu metotta belgeyi
 *    `Invoice` kökü ve fatura şemasıyla bekliyor (bkz. `ubl/giderPusulasiBuilder.ts` başı).
 *    Zarf aynı olsa da ICE içeriği **iki kat Base64** bekliyor (bkz. `giderPusulasiBelgeleriXml`).
 *
 * 2. **Ön doğrulama ucu YOKTUR.** Canlı WSDL'de yalnızca `invoice_check_validate`,
 *    `despatchadvice_check_validate` ve `producerreceipt_check_validate` bulunur;
 *    gider pusulası için karşılığı yok. Yani e-Arşiv akışındaki
 *    "önce doğrula, sonra gönder" güvencesi bu belge türünde **uygulanamaz**.
 *    Bu yüzden yerel doğrulama daha sıkı tutulur ve ekran kullanıcıyı uyarır.
 */

/**
 * `earsiv_invoices` içeriği. ICE bu metotta `earsiv_invoice` içeriğini Base64 çözdükten sonra
 * çıkan metni BİR KEZ DAHA Base64 çözüyor (e-Arşiv'de `send_earsiv` bunu yapmıyor). Bu yüzden
 * belge (zaten Base64) ikinci kez Base64'e çevrilir. Kanıt (ICE test sunucusu, 27.10.2026):
 * tek kat `<deneme/>` → "Base-64 olmayan bir karakter…"; iki kat → Base64 geçti, "XML belgesinde
 * bir hata var (1, 2)". Gerçek belge tek katla iki kez aynı Base64 hatasını almıştı.
 */
export const giderPusulasiBelgeleriXml = (belgelerBase64: string[]): string =>
  belgelerBase64
    .map((b64) => Buffer.from(b64, "utf8").toString("base64"))
    .map((ikiKat) => `<base64Binary><earsiv_invoice>${escapeXml(ikiKat)}</earsiv_invoice></base64Binary>`)
    .join("");

/**
 * `send_egider_pusulasi` — gider pusulasını entegratöre gönderir.
 * `belgelerBase64`: diğer belge türlerindeki gibi tek kat Base64 (ikinci katı burası ekler).
 *
 * ⚠️ Mali sonuç doğurur, ön doğrulama yapılamaz. Yazma çağrısıdır:
 * otomatik yeniden deneme KAPALI.
 */
export const sendGiderPusulasi = async (
  config: IceConnectionConfig,
  belgelerBase64: string[]
): Promise<IceGonderimSonucu> => {
  const belgelerXml = giderPusulasiBelgeleriXml(belgelerBase64);

  const { data } = await callWithSession<IceGonderimSonucu>(config, {
    method: "send_egider_pusulasi",
    buildInnerXml: (loginHeaderXml) =>
      `<sendEArsivRequest>` +
      loginHeaderXml +
      `<earsiv_invoices>${belgelerXml}</earsiv_invoices>` +
      `</sendEArsivRequest>`,
    authHatasindaTekrarla: false,
    timeoutMs: 120_000,
  });

  return data || {};
};

export interface IceGiderPusulasiCikti {
  response_message?: string;
  UUID?: string;
  html?: string;
  pdf?: string;
}

/**
 * Gönderilmiş gider pusulasının çıktısı (PDF / HTML).
 *
 * ICE gider pusulasını fatura olarak saklıyor (bkz. `ubl/giderPusulasiBuilder.ts` başı). ICE test
 * sunucusunda (27.10.2026) `Get_EGiderPusulasi_HTML_PDF` hem gönderilen hem deneme belgesinde, ETTN
 * küçük ya da büyük harf, BOŞ döndü; `GetInvoice_PDF` geçerli PDF, `GetInvoice_HTML` HTML verdi.
 * Bu yüzden önce fatura çağrıları; istenen çıktıların hiçbiri gelmezse gider çağrısı yedek olarak denenir.
 */
export const getGiderPusulasiCikti = async (
  config: IceConnectionConfig,
  ettn: string,
  secenekler: { html?: boolean; pdf?: boolean } = {}
): Promise<{ html: string | null; pdf: Buffer | null; mesaj: string }> => {
  let pdf: Buffer | null = null;
  let html: string | null = null;
  if (secenekler.pdf) {
    const b = await getInvoicePdf(config, ettn);
    if (b.length) {
      if (b.subarray(0, 5).toString("ascii") !== "%PDF-") throw ApiError.unprocessable("ICE cevabı PDF biçiminde değil.");
      pdf = b;
    }
  }
  if (secenekler.html) {
    const h = await getInvoiceHtml(config, ettn);
    if (h.trim()) html = h;
  }
  if (pdf || html || !(secenekler.pdf || secenekler.html)) return { html, pdf, mesaj: "" };
  return giderCiktisiGiderCagrisiyla(config, ettn, secenekler);
};

/** `Get_EGiderPusulasi_HTML_PDF` — ICE'nin gider pusulasına özel çıktı çağrısı (şu an boş dönüyor; yedek) */
const giderCiktisiGiderCagrisiyla = async (
  config: IceConnectionConfig,
  ettn: string,
  secenekler: { html?: boolean; pdf?: boolean; xml?: boolean } = {}
): Promise<{ html: string | null; pdf: Buffer | null; mesaj: string }> => {
  const { data } = await callWithSession<IceGiderPusulasiCikti>(config, {
    method: "Get_EGiderPusulasi_HTML_PDF",
    buildInnerXml: (loginHeaderXml) =>
      `<eGiderPusulasi_HTML_PDF>` +
      loginHeaderXml +
      `<ETTN>${escapeXml(ettn)}</ETTN>` +
      `<get_xml>${secenekler.xml ? "true" : "false"}</get_xml>` +
      `<get_html>${secenekler.html ? "true" : "false"}</get_html>` +
      `<get_pdf>${secenekler.pdf ? "true" : "false"}</get_pdf>` +
      `</eGiderPusulasi_HTML_PDF>`,
    authHatasindaTekrarla: true,
    timeoutMs: 60_000,
  });

  let pdf: Buffer | null = null;
  if (secenekler.pdf) {
    const temiz = typeof data?.pdf === "string" ? data.pdf.replace(/\s/g, "") : "";
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

  return {
    html: secenekler.html && typeof data?.html === "string" && data.html.trim() ? data.html : null,
    pdf,
    mesaj: typeof data?.response_message === "string" ? data.response_message : "",
  };
};
