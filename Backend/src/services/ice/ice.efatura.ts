import {
  READ_TIMEOUT_MS,
  escapeXml,
  optionalField,
  toIceDateTime,
} from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
import { IceConnectionConfig } from "./ice.types.js";

/**
 * e-Fatura okuma operasyonları (Faz 3).
 *
 * Kaynak: docs/ice/integration-2026-09-09.wsdl
 *
 * DİKKAT — `...Specified` tuzağı:
 * WSDL'deki her opsiyonel alanın yanında bir `<Alan>Specified` boolean'ı var.
 * Bu bayrak `true` verilmezse ICE ilgili filtreyi SESSİZCE yok sayar; sorgu
 * "çalışıyor" görünür ama yanlış veri döner (docs/ice-baglanti.md §3 bulgu 5).
 * Bu yüzden filtreler `optionalField()` ile kuruluyor.
 *
 * Alan SIRASI da şemadaki sequence ile birebir aynı olmalıdır.
 */

export interface GelenFaturaFiltre {
  limit?: number;
  id?: string;
  uuid?: string;
  from?: string;
  to?: string;
  baslangicTarihi?: string | Date;
  bitisTarihi?: string | Date;
  /** true → okunmuş belgeler de gelsin */
  okunmuslarDahil?: boolean;
  /** true → işlenmiş belgeler de gelsin */
  islenmislerDahil?: boolean;
  /** "IN" (gelen) / "OUT" (giden) */
  yon?: "IN" | "OUT";
  sender?: string;
  receiver?: string;
}

/** ICE'den dönen fatura başlığı (INVOICEHEADER) */
export interface IceInvoiceHeader {
  SENDER?: string;
  RECEIVER?: string;
  SUPPLIER?: string;
  CUSTOMER?: string;
  ISSUE_DATE?: string;
  PAYABLE_AMOUNT?: any;
  FROM?: string;
  TO?: string;
  PROFILEID?: string;
  INVOICE_TYPE_CODE?: string;
  STATUS?: string;
  STATUS_DESCRIPTION?: string;
  GIB_STATUS_CODE?: number | string;
  GIB_STATUS_DESCRIPTION?: string;
  RESPONSE_CODE?: string;
  RESPONSE_DESCRIPTION?: string;
  FILENAME?: string;
  HASH?: string;
  CDATE?: string;
  ENVELOPE_IDENTIFIER?: string;
}

export interface IceInvoice {
  CONTENT?: string; // base64 UBL — yalnızca HEADER_ONLY=false çağrılarında dolu
  HEADER?: IceInvoiceHeader;
  ID?: string;
  UUID?: string;
}

/**
 * INVOICE_SEARCH_KEY bloğu. Alan sırası şema sequence'ı ile aynı.
 */
export const buildInvoiceSearchKeyXml = (filtre: GelenFaturaFiltre): string => {
  const parcalar: string[] = [];

  parcalar.push(optionalField("LIMIT", filtre.limit));

  if (filtre.id) parcalar.push(`<ID>${escapeXml(filtre.id)}</ID>`);
  if (filtre.uuid) parcalar.push(`<UUID>${escapeXml(filtre.uuid)}</UUID>`);
  if (filtre.from) parcalar.push(`<FROM>${escapeXml(filtre.from)}</FROM>`);
  if (filtre.to) parcalar.push(`<TO>${escapeXml(filtre.to)}</TO>`);

  parcalar.push(optionalField("START_DATE", filtre.baslangicTarihi, (v) => toIceDateTime(v)));
  parcalar.push(optionalField("END_DATE", filtre.bitisTarihi, (v) => toIceDateTime(v)));
  parcalar.push(
    optionalField("READ_INCLUDED", filtre.okunmuslarDahil, (v) => (v ? "true" : "false"))
  );
  // PROCESSED_INCLUDED yalnızca CANLI WSDL'de var (2020 paketinde yoktu)
  parcalar.push(
    optionalField("PROCESSED_INCLUDED", filtre.islenmislerDahil, (v) => (v ? "true" : "false"))
  );

  if (filtre.yon) parcalar.push(`<DIRECTION>${escapeXml(filtre.yon)}</DIRECTION>`);
  if (filtre.sender) parcalar.push(`<SENDER>${escapeXml(filtre.sender)}</SENDER>`);
  if (filtre.receiver) parcalar.push(`<RECEIVER>${escapeXml(filtre.receiver)}</RECEIVER>`);

  return `<INVOICE_SEARCH_KEY>${parcalar.join("")}</INVOICE_SEARCH_KEY>`;
};

const buildGetInvoiceRequestXml = (
  loginHeaderXml: string,
  filtre: GelenFaturaFiltre,
  sadeceBaslik: boolean
): string =>
  `<GetInvoiceRequest>` +
  loginHeaderXml +
  buildInvoiceSearchKeyXml(filtre) +
  // HEADER_ONLY şemada string; boolean değil
  `<HEADER_ONLY>${sadeceBaslik ? "true" : "false"}</HEADER_ONLY>` +
  `</GetInvoiceRequest>`;

/** Tek düğüm ya da dizi dönebilen alanları daima diziye çevirir */
export const toArray = <T>(deger: T | T[] | undefined | null): T[] => {
  if (deger === undefined || deger === null) return [];
  return Array.isArray(deger) ? deger : [deger];
};

/**
 * `GetInvoice_Count` — aynı filtreyle yalnızca ADET döner.
 * Sayfalama için önce bu çağrılır; tüm listeyi çekip saymaya gerek kalmaz.
 */
export const getInvoiceCount = async (
  config: IceConnectionConfig,
  filtre: GelenFaturaFiltre
): Promise<number> => {
  const { data } = await callWithSession<number | string>(config, {
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
export const getInvoices = async (
  config: IceConnectionConfig,
  filtre: GelenFaturaFiltre,
  sadeceBaslik = true
): Promise<{ faturalar: IceInvoice[]; sureMs: number }> => {
  const { data, trace } = await callWithSession<any>(config, {
    method: "GetInvoice",
    buildInnerXml: (loginHeaderXml) =>
      buildGetInvoiceRequestXml(loginHeaderXml, filtre, sadeceBaslik),
    authHatasindaTekrarla: true,
    timeoutMs: READ_TIMEOUT_MS,
  });

  return { faturalar: toArray<IceInvoice>(data?.INVOICE), sureMs: trace.sureMs };
};

/** `Get_Invoice_Status_Detail` — tek belgenin güncel GİB statüsü */
export interface IceInvoiceStatusDetail {
  UUID?: string;
  STATUS?: string;
  STATUS_CODE?: string;
  STATUS_DESCRIPTION?: string;
  PORTAL_STATUS?: string;
  MAIL_STATUS?: string;
  MAIL_STATUS_DESCRIPTION?: string;
}

export const getInvoiceStatusDetail = async (
  config: IceConnectionConfig,
  uuid: string
): Promise<IceInvoiceStatusDetail> => {
  const { data } = await callWithSession<IceInvoiceStatusDetail>(config, {
    method: "Get_Invoice_Status_Detail",
    buildInnerXml: (loginHeaderXml) =>
      `<get_invoice_status_request>${loginHeaderXml}<UUID>${escapeXml(uuid)}</UUID></get_invoice_status_request>`,
    authHatasindaTekrarla: true,
  });
  return data || {};
};

/* ==========================================================================
   Doğrulama (Faz 5) — belge GÖNDERİLMEZ
   ========================================================================== */

export interface IceCheckValidateSonucu {
  success?: boolean | string;
  shema_validate?: boolean | string;
  shematron_validate?: boolean | string;
  response_message?: string;
  invoice_html?: string;
  invoice_pdf?: string;
}

/**
 * `invoice_check_validate` — belgeyi **göndermeden** şema ve schematron doğrular,
 * istenirse HTML/PDF önizleme döndürür.
 *
 * Canlı hesapla mali sonuç doğurmadan test etmenin ana yolu (docs/ice-baglanti.md §10.3 C4).
 */
export const invoiceCheckValidate = async (
  config: IceConnectionConfig,
  invoiceBase64: string,
  secenekler: { html?: boolean; pdf?: boolean } = {}
): Promise<IceCheckValidateSonucu> => {
  const { data } = await callWithSession<IceCheckValidateSonucu>(config, {
    method: "invoice_check_validate",
    buildInnerXml: (loginHeaderXml) =>
      `<_invoice_check_validate_request>` +
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
export const getSonBelgeId = async (
  config: IceConnectionConfig,
  seri: string,
  belgeTuru: string,
  yil: number
): Promise<any> => {
  const { data } = await callWithSession<any>(config, {
    method: "Get_Son_Belge_ID",
    buildInnerXml: (loginHeaderXml) =>
      loginHeaderXml +
      `<Seri>${escapeXml(seri)}</Seri>` +
      `<Belge_Turu>${escapeXml(belgeTuru)}</Belge_Turu>` +
      `<Yil>${Number(yil)}</Yil>`,
    authHatasindaTekrarla: true,
  });
  return data;
};

/* ==========================================================================
   Mükellef sorgulama
   ========================================================================== */

export interface IceGibUser {
  Identifier?: string;
  Alias?: string;
  CreationTime?: string;
  Title?: string;
  Unit?: string;
  Type?: string;
  AccountType?: string;
}

/**
 * `getUserList_EFatura` — VKN/TCKN'nin e-Fatura mükellefi olup olmadığını,
 * mükellefse GİB posta kutusu etiketlerini (alias) döndürür.
 *
 * Sonuç boşsa alıcı e-Fatura mükellefi değildir → e-Arşiv kesilmelidir.
 */
export const getUserListEFatura = async (
  config: IceConnectionConfig,
  vknTckn: string
): Promise<{ basarili: boolean; mesaj: string; kullanicilar: IceGibUser[] }> => {
  const { data } = await callWithSession<any>(config, {
    method: "getUserList_EFatura",
    buildInnerXml: (loginHeaderXml) =>
      `<_getUserList_request>` +
      loginHeaderXml +
      `<search_Identifier>${escapeXml(vknTckn)}</search_Identifier>` +
      `</_getUserList_request>`,
    authHatasindaTekrarla: true,
  });

  return {
    basarili: String(data?.success).toLowerCase() === "true",
    mesaj: data?.response_message ? String(data.response_message) : "",
    kullanicilar: toArray<IceGibUser>(data?.GIB_User_List?.GIB_User),
  };
};

/* ==========================================================================
   Taslak gönderimi (Faz 6) — GİB'e GİTMEZ
   ========================================================================== */

export interface IceGonderimSatirSonucu {
  success?: boolean | string;
  shema_is_validate?: boolean | string;
  schematron_is_validate?: boolean | string;
  ettn?: string;
  ID?: string;
  response_message?: string;
}

export interface IceGonderimSonucu {
  success?: boolean | string;
  response_code?: number | string;
  response_message?: string;
  invoiceType_responseTypes?: { invoiceType_responseType?: IceGonderimSatirSonucu | IceGonderimSatirSonucu[] };
}

export interface TaslakGonderimGirdisi {
  fromVknTckn: string;
  fromAlias: string;
  toVknTckn: string;
  toAlias: string;
  /** Base64 UBL belgeleri — birden çok belge çoklanabilir */
  invoicesBase64: string[];
}

/**
 * `send_invoice_taslak` — belgeyi ICE'de **taslak** olarak oluşturur.
 *
 * ÖNEMLİ: Taslak GİB'e **gitmez**. GİB'e ancak
 * `send_draft_document_approval` + `DraftApproval` ile gönderilir — bu çağrı
 * Faz 6 kapsamında bilerek kullanılmamaktadır.
 *
 * Yazma çağrısıdır: `authHatasindaTekrarla: false`.
 */
export const buildSendInvoiceInnerXml = (
  loginHeaderXml: string,
  girdi: TaslakGonderimGirdisi
): string => {
  // Alan sırası send_invoice_request şemasının sequence'ı ile birebir aynı olmalıdır
  const invoicesXml = girdi.invoicesBase64
    .map((b64) => `<invoiceType><invoice>${escapeXml(b64)}</invoice></invoiceType>`)
    .join("");

  return (
    `<sendInvoiceRequest>` +
    loginHeaderXml +
    `<from_vkn_tckn>${escapeXml(girdi.fromVknTckn)}</from_vkn_tckn>` +
    `<from_alias>${escapeXml(girdi.fromAlias)}</from_alias>` +
    `<to_vkn_tckn>${escapeXml(girdi.toVknTckn)}</to_vkn_tckn>` +
    `<to_alias>${escapeXml(girdi.toAlias)}</to_alias>` +
    `<invoices>${invoicesXml}</invoices>` +
    `</sendInvoiceRequest>`
  );
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
export const sendInvoice = async (
  config: IceConnectionConfig,
  girdi: TaslakGonderimGirdisi
): Promise<IceGonderimSonucu> => {
  const { data } = await callWithSession<IceGonderimSonucu>(config, {
    method: "send_invoice",
    buildInnerXml: (loginHeaderXml) => buildSendInvoiceInnerXml(loginHeaderXml, girdi),
    authHatasindaTekrarla: false,
    timeoutMs: 120_000,
  });

  return data || {};
};

export const sendInvoiceTaslak = async (
  config: IceConnectionConfig,
  girdi: TaslakGonderimGirdisi
): Promise<IceGonderimSonucu> => {
  const { data } = await callWithSession<IceGonderimSonucu>(config, {
    method: "send_invoice_taslak",
    buildInnerXml: (loginHeaderXml) => buildSendInvoiceInnerXml(loginHeaderXml, girdi),
    authHatasindaTekrarla: false,
    timeoutMs: 120_000,
  });

  return data || {};
};

/** Gönderim cevabındaki belge satırlarını diziye çevirir */
export const gonderimSatirlari = (sonuc: IceGonderimSonucu): IceGonderimSatirSonucu[] =>
  toArray<IceGonderimSatirSonucu>(sonuc?.invoiceType_responseTypes?.invoiceType_responseType);

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
] as const;
export type IceDocumentType = (typeof ICE_DOCUMENT_TYPES)[number];

/** Canlı WSDL'deki ProcessType enum'u */
export type IceProcessType = "DraftApproval" | "DraftCancel";

export interface IceDraftApprovalSonucu {
  success?: boolean | string;
  response_message?: string;
  response_message_detail?: string;
}

/**
 * `send_draft_document_approval` — taslağı onaylar (**GİB'e gönderir**) veya iptal eder.
 *
 * ⚠️ `processType = "DraftApproval"` belgeyi GİB'e iletir ve **geri alınamaz**.
 * Faz 6'da yalnızca `"DraftCancel"` kullanılmaktadır; onay Faz 7'de,
 * ayrı bir kullanıcı kararıyla açılacaktır (docs/ice-baglanti.md §9).
 */
export const sendDraftDocumentApproval = async (
  config: IceConnectionConfig,
  dokumanNo: string,
  documentType: IceDocumentType,
  processType: IceProcessType
): Promise<IceDraftApprovalSonucu> => {
  const { data } = await callWithSession<IceDraftApprovalSonucu>(config, {
    method: "send_draft_document_approval",
    buildInnerXml: (loginHeaderXml) =>
      `<documentApprovalRequest>` +
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

/* ==========================================================================
   Yazma çağrıları (Faz 4) — DİKKAT: hiçbiri otomatik tekrarlanmaz
   ========================================================================== */

export interface IceRedKabulSonucu {
  success?: boolean | string;
  response_message?: string;
}

/**
 * `invoice_Red_Kabul` — gelen ticari faturaya kabul veya red cevabı gönderir.
 *
 * **GERİ ALINAMAZ.** `authHatasindaTekrarla: false` — oturum düşse bile çağrı
 * tekrarlanmaz; aksi halde ikinci bir cevap gönderilebilir (§11.1 S8).
 */
export const invoiceRedKabul = async (
  config: IceConnectionConfig,
  ettn: string,
  redKabul: "Red" | "Kabul",
  aciklama: string
): Promise<IceRedKabulSonucu> => {
  const { data } = await callWithSession<IceRedKabulSonucu>(config, {
    method: "invoice_Red_Kabul",
    buildInnerXml: (loginHeaderXml) =>
      `<invoice_red_kabul_request>` +
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
export const ICE_BELGE_STATULERI = ["Okunmadı", "Okundu", "Islendi", "Islenmedi"] as const;
export type IceBelgeStatu = (typeof ICE_BELGE_STATULERI)[number];

/**
 * `Set_Invoice_Status` — belgenin okundu/işlendi statüsünü ICE tarafında işaretler.
 * Mali sonuç doğurmaz ama yine de yazma çağrısıdır; tekrarlanmaz.
 */
export const setInvoiceStatus = async (
  config: IceConnectionConfig,
  uuid: string,
  statu: IceBelgeStatu
): Promise<boolean> => {
  const { data } = await callWithSession<boolean | string>(config, {
    method: "Set_Invoice_Status",
    buildInnerXml: (loginHeaderXml) =>
      `<get_invoice_set_statu_request>` +
      loginHeaderXml +
      `<UUID>${escapeXml(uuid)}</UUID>` +
      `<Statu>${escapeXml(statu)}</Statu>` +
      `</get_invoice_set_statu_request>`,
    authHatasindaTekrarla: false,
  });
  return String(data).toLowerCase() === "true";
};

/** `GetInvoice_HTML` — belgenin HTML çıktısı (üçüncü tarafın ürettiği HTML!) */
export const getInvoiceHtml = async (
  config: IceConnectionConfig,
  ettn: string
): Promise<string> => {
  const { data } = await callWithSession<string>(config, {
    method: "GetInvoice_HTML",
    buildInnerXml: (loginHeaderXml) =>
      `<getInvoice_ETTN>${loginHeaderXml}<ETTN>${escapeXml(ettn)}</ETTN></getInvoice_ETTN>`,
    authHatasindaTekrarla: true,
  });
  return typeof data === "string" ? data : "";
};

/** `GetInvoice_PDF` — belgenin PDF çıktısı (base64) */
export const getInvoicePdf = async (
  config: IceConnectionConfig,
  ettn: string
): Promise<Buffer> => {
  const { data } = await callWithSession<string>(config, {
    method: "GetInvoice_PDF",
    buildInnerXml: (loginHeaderXml) =>
      `<getInvoice_ETTN>${loginHeaderXml}<ETTN>${escapeXml(ettn)}</ETTN></getInvoice_ETTN>`,
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
export const parseAmount = (deger: any): number | null => {
  if (deger === null || deger === undefined) return null;
  const ham = typeof deger === "object" ? deger["#text"] : deger;
  const sayi = Number(ham);
  return isNaN(sayi) ? null : sayi;
};

/** Aynı alandan para birimi kodunu okur */
export const parseCurrency = (deger: any): string | null => {
  if (deger && typeof deger === "object") {
    return deger["@_currencyID"] ? String(deger["@_currencyID"]) : null;
  }
  return null;
};

/** ICE'nin döndürdüğü dateTime metnini Date'e çevirir */
export const parseIceDate = (deger: any): Date | null => {
  if (!deger) return null;
  const d = new Date(String(deger));
  return isNaN(d.getTime()) ? null : d;
};
