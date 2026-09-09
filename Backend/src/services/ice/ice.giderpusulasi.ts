import { escapeXml } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
import { IceConnectionConfig } from "./ice.types.js";
import { IceGonderimSonucu } from "./ice.efatura.js";
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
 *    belge farklıdır** — gider pusulası `CreditNote`'tur, fatura değil
 *    (bkz. `ubl/giderPusulasiBuilder.ts`).
 *
 * 2. **Ön doğrulama ucu YOKTUR.** Canlı WSDL'de yalnızca `invoice_check_validate`,
 *    `despatchadvice_check_validate` ve `producerreceipt_check_validate` bulunur;
 *    gider pusulası için karşılığı yok. Yani e-Arşiv akışındaki
 *    "önce doğrula, sonra gönder" güvencesi bu belge türünde **uygulanamaz**.
 *    Bu yüzden yerel doğrulama daha sıkı tutulur ve ekran kullanıcıyı uyarır.
 */

/**
 * `send_egider_pusulasi` — gider pusulasını entegratöre gönderir.
 *
 * ⚠️ Mali sonuç doğurur, ön doğrulama yapılamaz. Yazma çağrısıdır:
 * otomatik yeniden deneme KAPALI.
 */
export const sendGiderPusulasi = async (
  config: IceConnectionConfig,
  belgelerBase64: string[]
): Promise<IceGonderimSonucu> => {
  const belgelerXml = belgelerBase64
    .map((b64) => `<base64Binary><earsiv_invoice>${escapeXml(b64)}</earsiv_invoice></base64Binary>`)
    .join("");

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
 * `Get_EGiderPusulasi_HTML_PDF` — gönderilmiş gider pusulasının çıktısı.
 */
export const getGiderPusulasiCikti = async (
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
