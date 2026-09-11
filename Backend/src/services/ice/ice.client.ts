import { XMLParser } from "fast-xml-parser";
import { ApiError } from "../../utils/ApiError.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { logger } from "../../utils/logger.js";
import { IceCallResult, IceFaultCode } from "./ice.types.js";

/**
 * ICE Teknoloji SOAP 1.1 istemcisi.
 *
 * - İstek XML'i elle kurulur, her değer kaçışlanır (enjeksiyon koruması).
 * - Cevap fast-xml-parser ile okunur; DTD / entity çözümü kapalıdır (XXE koruması).
 * - Hem SOAP Fault hem de "HTTP 200 + success=false" durumu karşılanır.
 *
 * Oturum yönetimi bu dosyada DEĞİL, ice.session.ts içindedir.
 */

const TEMPURI = "http://tempuri.org/";

/** Okuma çağrıları için varsayılan zaman aşımı */
export const READ_TIMEOUT_MS = 30_000;
/** Belge gönderimi gibi ağır çağrılar için zaman aşımı */
export const WRITE_TIMEOUT_MS = 120_000;

/** Cevap gövdesi üst sınırı — XML bombası / bellek taşması koruması */
const MAX_RESPONSE_BYTES = 80 * 1024 * 1024; // 80 MB

/** Yalnızca bu adreslere bağlanılır (SSRF koruması) */
const ALLOWED_HOST_SUFFIX = ".iceteknoloji.com.tr";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Ad alanı öneklerini at: soap:Envelope -> Envelope, tem:Login -> Login
  removeNSPrefix: true,
  // XXE / entity genişletme koruması
  processEntities: false,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

/**
 * XML metin değeri kaçışlama. Unvanlarda &, <, " gibi karakterler geçebiliyor.
 */
export const escapeXml = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * Servis adresi doğrulaması: yalnızca https ve yalnızca ICE alan adı.
 */
export const assertAllowedServiceUrl = (rawUrl: string): URL => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw ApiError.badRequest("Entegratör servis adresi geçerli bir URL değil.");
  }

  if (url.protocol !== "https:") {
    throw ApiError.badRequest(
      "Entegratör servis adresi https:// ile başlamalıdır. Kimlik bilgileri şifresiz bağlantıda gönderilemez."
    );
  }

  const host = url.hostname.toLowerCase();
  if (!host.endsWith(ALLOWED_HOST_SUFFIX)) {
    throw ApiError.badRequest(
      `Entegratör servis adresi yalnızca *${ALLOWED_HOST_SUFFIX} alan adında olabilir.`
    );
  }

  return url;
};

/**
 * Log ve denetim kaydı için hassas alanları maskeler.
 * Session_ID / Security_Key / Password / base64 belge gövdeleri asla saklanmaz.
 */
export const maskSensitive = (xml: string, maxLength = 2000): string => {
  if (!xml) return "";
  let masked = xml
    .replace(/(<(?:\w+:)?Session_ID>)[^<]*(<)/gi, "$1***$2")
    .replace(/(<(?:\w+:)?Security_Key>)[^<]*(<)/gi, "$1***$2")
    .replace(/(<(?:\w+:)?Password>)[^<]*(<)/gi, "$1***$2")
    .replace(/(<(?:\w+:)?invoice>)[^<]*(<)/gi, "$1[belge]$2")
    .replace(/(<(?:\w+:)?earsiv_invoice>)[^<]*(<)/gi, "$1[belge]$2")
    .replace(/(<(?:\w+:)?CONTENT>)[^<]*(<)/gi, "$1[belge]$2")
    .replace(/(<(?:\w+:)?\w*_pdf>)[^<]*(<)/gi, "$1[pdf]$2")
    .replace(/(<(?:\w+:)?\w*_xml>)[^<]*(<)/gi, "$1[xml]$2");

  if (masked.length > maxLength) {
    masked = `${masked.slice(0, maxLength)}…[kısaltıldı]`;
  }
  return masked;
};

/**
 * SOAP 1.1 zarfı kurar. `innerXml` gövdeye olduğu gibi konur.
 */
export const buildEnvelope = (method: string, innerXml: string): string =>
  `<?xml version="1.0" encoding="utf-8"?>` +
  `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
  ` xmlns:xsd="http://www.w3.org/2001/XMLSchema"` +
  ` xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
  `<soap:Body><${method} xmlns="${TEMPURI}">${innerXml}</${method}></soap:Body>` +
  `</soap:Envelope>`;

/**
 * ICE fault kodunu bizim ApiError'ımıza çevirir.
 */
export const mapFaultToApiError = (faultCode: string, faultMessage: string): ApiError => {
  const code = (faultCode || "").toUpperCase().trim() as IceFaultCode;
  const mesaj = faultMessage?.trim() || "Entegratör servisinden hata döndü.";

  switch (code) {
    case "AUTHORIZATION":
      return ApiError.unauthorized(`Entegratör yetki hatası: ${mesaj}`);
    case "NOTFOUND":
      return ApiError.notFound(`Entegratörde kayıt bulunamadı: ${mesaj}`);
    case "EXISTS":
      return ApiError.conflict(`Entegratörde kayıt zaten mevcut: ${mesaj}`);
    case "FORMAT":
      return ApiError.unprocessable(`Gönderilen veri eksik ya da uyumsuz: ${mesaj}`);
    case "TIMEOUT":
      return new ApiError(HttpStatus.SERVICE_UNAVAILABLE, `Entegratör servisinde zaman aşımı: ${mesaj}`);
    default:
      return new ApiError(HttpStatus.BAD_GATEWAY, `Entegratör servisi hatası: ${mesaj}`);
  }
};

/** Fault düğümünden kod ve mesajı çıkarır */
const extractFault = (body: any): { code: string; message: string } | null => {
  const fault = body?.Fault;
  if (!fault) return null;

  const code =
    (typeof fault.faultcode === "string" ? fault.faultcode : fault.faultcode?.["#text"]) ||
    fault.Code?.Value ||
    "";
  const message =
    (typeof fault.faultstring === "string" ? fault.faultstring : fault.faultstring?.["#text"]) ||
    fault.Reason?.Text ||
    "";

  // "soap:Server" gibi öneki at, sondaki anlamlı kodu bırak (ör. "AUTHORIZATION")
  const cleanCode = String(code).split(":").pop() || "";
  return { code: cleanCode, message: String(message) };
};

export interface IceCallOptions {
  url: string;
  method: string;
  innerXml: string;
  timeoutMs?: number;
  /** Log/denetim kaydı için çağrıyı tanımlayan opsiyonel etiket */
  ilgiliUuid?: string;
}

/**
 * Tek bir SOAP çağrısı yapar ve `<MetodResult>` düğümünü döndürür.
 * Fault ya da HTTP hatası durumunda ApiError fırlatır.
 */
export const callSoap = async <T = any>(options: IceCallOptions): Promise<IceCallResult<T>> => {
  const { url, method, innerXml, timeoutMs = READ_TIMEOUT_MS } = options;

  assertAllowedServiceUrl(url);

  const envelope = buildEnvelope(method, innerXml);
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${TEMPURI}${method}"`,
      },
      body: envelope,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    const sureMs = Date.now() - started;
    if (err?.name === "AbortError") {
      logger.warn(`ICE ${method}: zaman aşımı (${timeoutMs} ms)`);
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        `Entegratör servisi ${timeoutMs / 1000} saniyede yanıt vermedi (${method}).`
      );
    }
    logger.error(`ICE ${method}: bağlantı hatası (${sureMs} ms)`, err);
    throw new ApiError(HttpStatus.BAD_GATEWAY, `Entegratör servisine ulaşılamadı (${method}): ${err?.message || "bilinmeyen hata"}`);
  }
  clearTimeout(timer);

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength && contentLength > MAX_RESPONSE_BYTES) {
    throw new ApiError(
      HttpStatus.BAD_GATEWAY,
      `Entegratör cevabı çok büyük (${Math.round(contentLength / 1048576)} MB). İstek daraltılmalı.`
    );
  }

  const text = await response.text();
  const sureMs = Date.now() - started;

  if (text.length > MAX_RESPONSE_BYTES) {
    throw new ApiError(
      HttpStatus.BAD_GATEWAY, "Entegratör cevabı işlenemeyecek kadar büyük.");
  }

  let parsed: any;
  try {
    parsed = parser.parse(text);
  } catch (err) {
    logger.error(`ICE ${method}: cevap ayrıştırılamadı`, err);
    throw new ApiError(
      HttpStatus.BAD_GATEWAY, `Entegratör cevabı okunamadı (${method}).`);
  }

  const body = parsed?.Envelope?.Body;
  if (!body) {
    if (!response.ok) {
      throw new ApiError(
      HttpStatus.BAD_GATEWAY, `Entegratör servisi HTTP ${response.status} döndü (${method}).`);
    }
    throw new ApiError(
      HttpStatus.BAD_GATEWAY, `Entegratör cevabında SOAP gövdesi bulunamadı (${method}).`);
  }

  const fault = extractFault(body);
  if (fault) {
    logger.warn(`ICE ${method}: fault ${fault.code} — ${fault.message}`);
    // Sunucu tarafı (.NET) hatalarında hangi alanın sorun çıkardığı ancak
    // gönderilen gövde ve fault ayrıntısıyla anlaşılır. Oturum anahtarları
    // maskelenir; belge içerikleri zaten tam olarak loglanır.
    logger.warn(`ICE ${method}: gönderilen istek → ${maskSensitive(envelope, 6000)}`);
    if (body.Fault?.detail !== undefined) {
      logger.warn(`ICE ${method}: fault ayrıntısı → ${JSON.stringify(body.Fault.detail).slice(0, 3000)}`);
    }
    throw mapFaultToApiError(fault.code, fault.message);
  }

  if (!response.ok) {
    throw new ApiError(
      HttpStatus.BAD_GATEWAY, `Entegratör servisi HTTP ${response.status} döndü (${method}).`);
  }

  const responseNode = body[`${method}Response`];
  const result = responseNode ? responseNode[`${method}Result`] : undefined;

  return {
    data: (result !== undefined ? result : responseNode) as T,
    trace: { metod: method, basarili: true, sureMs },
  };
};

/**
 * Login_Request_Header bloğunu üretir. Oturum bilgileri buradan geçer.
 */
export const buildLoginHeaderXml = (header: {
  Session_ID: string;
  IP_Number: string;
  Security_Key: string;
}): string =>
  `<Login_Request_Header>` +
  `<Session_ID>${escapeXml(header.Session_ID)}</Session_ID>` +
  `<IP_Number>${escapeXml(header.IP_Number)}</IP_Number>` +
  `<Security_Key>${escapeXml(header.Security_Key)}</Security_Key>` +
  `</Login_Request_Header>`;

/**
 * WSDL'deki .NET alışkanlığı: her opsiyonel alanın yanında `<Alan>Specified` boolean'ı var.
 * Bu bayrak `true` verilmezse ICE filtreyi SESSİZCE yok sayar (docs/ice-baglanti.md §3 bulgu 5).
 */
export const optionalField = (name: string, value: unknown, formatter?: (v: any) => string): string => {
  const dolu = value !== undefined && value !== null && String(value).trim() !== "";
  if (!dolu) {
    return `<${name}Specified>false</${name}Specified>`;
  }
  const metin = formatter ? formatter(value) : escapeXml(value);
  return `<${name}>${metin}</${name}><${name}Specified>true</${name}Specified>`;
};

/** ICE tarih alanları xs:dateTime bekliyor */
export const toIceDateTime = (value: Date | string): string => {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().replace(/\.\d{3}Z$/, "");
};
