import { escapeXml, optionalField, toIceDateTime } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
import { IceConnectionConfig } from "./ice.types.js";
import { toArray } from "./ice.efatura.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * e-İrsaliye ICE operasyonları (Faz 9).
 *
 * Kaynak: docs/ice/integration-2026-09-09.wsdl
 *
 * e-Faturadan iki önemli farkı var:
 *  1. **Ön doğrulama ucu VAR** — `despatchadvice_check_validate`. Bu yüzden
 *     e-Arşiv/e-Fatura'daki "önce doğrulat, geçerse gönder" disiplini burada da uygulanabiliyor.
 *  2. **Yanıt belgesi ayrı bir belgedir** — gelen irsaliyeye `send_ReceiptAdvice` ile
 *     kabul/red yanıtı verilir; e-Faturadaki `invoice_Red_Kabul` gibi tek çağrı değildir.
 */

/* ==========================================================================
   Doğrulama — belge GÖNDERİLMEZ
   ========================================================================== */

export interface IceIrsaliyeValidateSonucu {
  success?: boolean | string;
  shema_validate?: boolean | string;
  shematron_validate?: boolean | string;
  response_message?: string;
  despatchadvice_html?: string;
  despatchadvice_pdf?: string;
}

/**
 * `despatchadvice_check_validate` — irsaliyeyi **göndermeden** şema + schematron doğrular.
 */
export const despatchAdviceCheckValidate = async (
  config: IceConnectionConfig,
  irsaliyeBase64: string,
  secenekler: { html?: boolean; pdf?: boolean } = {}
): Promise<IceIrsaliyeValidateSonucu> => {
  const { data } = await callWithSession<IceIrsaliyeValidateSonucu>(config, {
    method: "despatchadvice_check_validate",
    buildInnerXml: (header) =>
      `<_despatchadvice_check_validate_request>` +
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

/* ==========================================================================
   Gönderim — MALİ/HUKUKİ SONUÇ DOĞURUR
   ========================================================================== */

export interface IceIrsaliyeSatirSonucu {
  success?: boolean | string;
  shema_is_validate?: boolean | string;
  schematron_is_validate?: boolean | string;
  ettn?: string;
  ID?: string;
  response_message?: string;
}

export interface IceIrsaliyeGonderimSonucu {
  success?: boolean | string;
  response_code?: number | string;
  response_message?: string;
  DespatchAdviceType_responseTypes?: {
    DespatchAdviceType_responseType?: IceIrsaliyeSatirSonucu | IceIrsaliyeSatirSonucu[];
  };
}

export interface IrsaliyeGonderimGirdisi {
  fromVknTckn: string;
  fromAlias: string;
  toVknTckn: string;
  toAlias: string;
  despatchAdvicesBase64: string[];
}

/**
 * `send_DespatchAdvice` — e-İrsaliyeyi GİB'e gönderir.
 *
 * ⚠️ **GERİ ALINAMAZ.** Yazma çağrısı: otomatik yeniden deneme KAPALI.
 *
 * Zarf yapısı WSDL'den birebir:
 * `<DespatchAdvices><DespatchAdvices><DespatchAdvice>base64</DespatchAdvice></DespatchAdvices></DespatchAdvices>`
 * (dış ve iç öğe adı aynı — .NET dizi üretecinin sonucu)
 */
export const sendDespatchAdvice = async (
  config: IceConnectionConfig,
  girdi: IrsaliyeGonderimGirdisi
): Promise<IceIrsaliyeGonderimSonucu> => {
  const belgelerXml = girdi.despatchAdvicesBase64
    .map((b64) => `<DespatchAdvices><DespatchAdvice>${escapeXml(b64)}</DespatchAdvice></DespatchAdvices>`)
    .join("");

  const { data } = await callWithSession<IceIrsaliyeGonderimSonucu>(config, {
    method: "send_DespatchAdvice",
    buildInnerXml: (header) =>
      `<sendDespatchAdviceRequest>` +
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
export const irsaliyeGonderimSatirlari = (
  sonuc: IceIrsaliyeGonderimSonucu
): IceIrsaliyeSatirSonucu[] =>
  toArray<IceIrsaliyeSatirSonucu>(
    sonuc?.DespatchAdviceType_responseTypes?.DespatchAdviceType_responseType
  );

/* ==========================================================================
   Mükellef sorgusu
   ========================================================================== */

export interface IceIrsaliyeMukellef {
  Identifier?: string;
  Alias?: string;
  Title?: string;
  Type?: string;
}

/**
 * `getUserList_DespatchAdvice` — alıcının **e-İrsaliye** posta kutusu etiketleri.
 *
 * DİKKAT: e-Fatura mükellefiyeti ile e-İrsaliye mükellefiyeti ayrıdır;
 * bu yüzden `getUserList_EFatura` yerine bu uç kullanılır.
 */
export const getUserListDespatchAdvice = async (
  config: IceConnectionConfig,
  vknTckn: string
): Promise<{ basarili: boolean; mesaj: string; kullanicilar: IceIrsaliyeMukellef[] }> => {
  const { data } = await callWithSession<any>(config, {
    method: "getUserList_DespatchAdvice",
    buildInnerXml: (header) =>
      `<_getUserList_request>` +
      header +
      `<search_Identifier>${escapeXml(vknTckn)}</search_Identifier>` +
      `</_getUserList_request>`,
    authHatasindaTekrarla: true,
  });

  return {
    basarili: String(data?.success).toLowerCase() === "true",
    mesaj: data?.response_message ? String(data.response_message) : "",
    kullanicilar: toArray<IceIrsaliyeMukellef>(data?.GIB_User_List?.GIB_User),
  };
};

/* ==========================================================================
   Gelen irsaliyeler
   ========================================================================== */

export interface IceDespatchAdviceKaydi {
  CONTENT?: string;
  ID?: string;
  UUID?: string;
  HEADER?: {
    SENDER?: string;
    RECEIVER?: string;
    SUPPLIER?: string;
    CUSTOMER?: string;
    ISSUE_DATE?: string;
    PROFILEID?: string;
    DESPATCHADVICE_TYPE_CODE?: string;
    STATUS?: string;
    STATUS_DESCRIPTION?: string;
    GIB_STATUS_CODE?: number | string;
    GIB_STATUS_DESCRIPTION?: string;
    RESPONSE_CODE?: string;
    RESPONSE_DESCRIPTION?: string;
    HASH?: string;
    CDATE?: string;
    ENVELOPE_IDENTIFIER?: string;
  };
}

export interface GelenIrsaliyeFiltre {
  limit?: number;
  baslangicTarihi?: Date;
  bitisTarihi?: Date;
  okunmuslarDahil?: boolean;
  islenmislerDahil?: boolean;
  yon?: "IN" | "OUT";
}

/**
 * `GetDespatchadvice` — gelen/giden irsaliye listesi.
 *
 * `Advice_SEARCH_KEY` alanları da `...Specified` bayrağı taşır; bayrak set edilmezse
 * filtre sessizce yok sayılır (docs/ice-baglanti.md §3 bulgu 5).
 */
export const getDespatchAdvices = async (
  config: IceConnectionConfig,
  filtre: GelenIrsaliyeFiltre,
  sadeceBaslik = true
): Promise<IceDespatchAdviceKaydi[]> => {
  const { data } = await callWithSession<any>(config, {
    method: "GetDespatchadvice",
    buildInnerXml: (header) =>
      `<GetAdviceRequest>` +
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

  if (data == null) throw ApiError.unprocessable("ICE irsaliye listesi yanıtı alınamadı.");
  return toArray<IceDespatchAdviceKaydi>(
    data && typeof data === "object" ? data.despatchadvice : undefined
  ).filter((r): r is IceDespatchAdviceKaydi => !!r && typeof r === "object");
};

/* ==========================================================================
   Statü
   ========================================================================== */

export interface IceIrsaliyeStatu {
  InstanceIdentifier?: string;
  ETTN?: string;
  ID?: string;
  Status_Code?: string;
  Status?: string;
  Response_ETTN?: string;
  Response_ID?: string;
  Response_Status_Code?: string;
  Response_Status?: string;
}

/** `Get_DespatchAdvice_Status` — irsaliyelerin GİB statüsü */
export const getDespatchAdviceStatus = async (
  config: IceConnectionConfig,
  uuidler: string[],
  yon: "IN" | "OUT"
): Promise<IceIrsaliyeStatu[]> => {
  const { data } = await callWithSession<any>(config, {
    method: "Get_DespatchAdvice_Status",
    buildInnerXml: (header) =>
      `<get_DespatchAdvice_status_request>` +
      header +
      `<UUID_List>${uuidler.map((u) => `<string>${escapeXml(u)}</string>`).join("")}</UUID_List>` +
      `<Direction>${escapeXml(yon)}</Direction>` +
      `</get_DespatchAdvice_status_request>`,
    authHatasindaTekrarla: true,
  });

  return toArray<IceIrsaliyeStatu>(data?.get_DespatchAdvice_status_response ?? data);
};

/** `Set_DespatchAdvice_Status` — okundu / işlendi işaretleme */
export const setDespatchAdviceStatus = async (
  config: IceConnectionConfig,
  uuid: string,
  statu: "Okunmadı" | "Okundu" | "Islendi" | "Islenmedi"
): Promise<boolean> => {
  const { data } = await callWithSession<boolean | string>(config, {
    method: "Set_DespatchAdvice_Status",
    buildInnerXml: (header) =>
      `<set_DespatchAdvice_statu_request>` +
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
export const getDespatchAdviceCikti = async (
  config: IceConnectionConfig,
  ettn: string,
  secenekler: { html?: boolean; pdf?: boolean } = {}
): Promise<{ html: string | null; pdf: Buffer | null; mesaj: string }> => {
  const { data } = await callWithSession<any>(config, {
    method: "GetDespatchadvice_HTML_PDF",
    buildInnerXml: (header) =>
      `<getDespatchadvice_HTML_PDF>` +
      header +
      `<ETTN>${escapeXml(ettn)}</ETTN>` +
      `<get_html>${secenekler.html ? "true" : "false"}</get_html>` +
      `<get_pdf>${secenekler.pdf ? "true" : "false"}</get_pdf>` +
      `</getDespatchadvice_HTML_PDF>`,
    authHatasindaTekrarla: true,
    timeoutMs: 60_000,
  });

  let pdf: Buffer | null = null;
  if (secenekler.pdf) {
    const temiz =
      typeof data?.despatchadvice_pdf === "string" ? data.despatchadvice_pdf.replace(/\s/g, "") : "";
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

  const html =
    secenekler.html &&
    typeof data?.despatchadvice_html === "string" &&
    data.despatchadvice_html.trim()
      ? data.despatchadvice_html
      : null;

  return { html, pdf, mesaj: typeof data?.response_message === "string" ? data.response_message : "" };
};
