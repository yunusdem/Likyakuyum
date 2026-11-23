import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeXml } from "../ice.client.js";
import { ApiError } from "../../../utils/ApiError.js";
import type { EDovizGirdi, EDovizOdemeYontemi } from "../ice.edoviz.js";

/**
 * e-Döviz ve Kıymetli Maden Alım Satım Belgesi UBL (CreditNote) üreticisi — GİB paket v1.3 (docs/ice/gib-edoviz-v13 örnekleri,
 * docs/EDOVIZ_SURUM2_YOL_HARITASI.md K11).
 *
 * Neden: ICE'nin `send_edoviz_basic` 2.0 gövdesi şahıs (11 haneli TCKN) müessesede belgeye kişi bilgisini (Person) yazmıyor ve GİB
 * şematronu "AccountingSupplierParty/Party altında TCKN varsa Person alanı zorunludur" diye reddediyor (ICE TEST 23.11.2026; Adi/Soyadi
 * dolu, unvan dolu ve boş denendi). `send_edoviz` belgeyi bizim ürettiğimiz XML olarak alır; burada Person GİB kılavuzundaki gibi yazılır.
 *
 * Alan düzeni GİB'in "Döviz Alım/Satım Belgesi.xml" örnekleriyle birebir aynıdır. Tutarlar ve hesap kuru ICE TEST'te doğrulanan
 * kurallarla (ice.edoviz.ts surum2Tutarlari, tutar.hesapKuru) çağıran tarafından verilir.
 */

const XSLT_KLASORU = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../belge/xslt");
const xsltOnbellek = new Map<string, string>();

/** GİB paketindeki alim.xslt / satim.xslt'nin değişmemiş kopyaları (Backend/belge/xslt), Base64. */
export const edovizXsltBase64 = (alim: boolean): string => {
  const ad = alim ? "edovizAlim.xslt" : "edovizSatim.xslt";
  const hazir = xsltOnbellek.get(ad);
  if (hazir) return hazir;
  let icerik: Buffer;
  try {
    icerik = fs.readFileSync(path.join(XSLT_KLASORU, ad));
  } catch {
    icerik = Buffer.alloc(0);
  }
  if (!icerik.length) {
    throw ApiError.internal(`e-Döviz görünüm şablonu (Backend/belge/xslt/${ad}) sunucuda bulunamadı; belge gönderilmedi.`);
  }
  const b64 = icerik.toString("base64");
  xsltOnbellek.set(ad, b64);
  return b64;
};

const e = escapeXml;
const dolu = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== "";
const tutar = (n: number): string => (Math.round(Number(n) * 100) / 100).toFixed(2);
const kur6 = (n: number): string => Number(n).toFixed(6).replace(/\.?0+$/, "");
const etiket = (ad: string, v: unknown): string => (dolu(v) ? `<${ad}>${e(String(v).trim())}</${ad}>` : "");

/** Türkiye saatine göre tarih (yyyy-MM-dd) ve saat (HH:mm:ss) — GİB IssueDate / IssueTime. */
export const trTarihSaat = (iso: string): { tarih: string; saat: string } => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest("e-Döviz belge tarihi geçersiz.");
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { tarih: `${p.year}-${p.month}-${p.day}`, saat: `${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}` };
};

/** GİB PaymentMeansCode: Nakit 10, Banka Kartı 55, Havale 46, Ödeme Sistemleri 68 (kılavuz §3.16). */
const ODEME_KODU: Record<EDovizOdemeYontemi, string> = { NAKIT: "10", EFTHAVALE: "46", KREDIKARTIBANKAKARTI: "55", ODEMESISTEMLERI: "68" };
/** GİB örneğindeki sabit hesap değerleri: nakitte "0", diğerlerinde boş IBAN. */
const hesapNo = (y: EDovizOdemeYontemi): string => (y === "NAKIT" ? "0" : "TR000000000000000000000000");

const kimlikSemasi = (no: string): "TCKN" | "VKN" | null => (/^\d{11}$/.test(no) ? "TCKN" : /^\d{10}$/.test(no) ? "VKN" : null);

const adresXml = (sokak?: string, ilce?: string, il?: string, ulke?: string, ulkeKodu?: string): string =>
  `<cac:PostalAddress>` +
  etiket("cbc:StreetName", sokak) +
  etiket("cbc:CitySubdivisionName", ilce) +
  etiket("cbc:CityName", il) +
  `<cac:Country>${etiket("cbc:IdentificationCode", ulkeKodu)}<cbc:Name>${e(dolu(ulke) ? String(ulke).trim() : "Türkiye")}</cbc:Name></cac:Country>` +
  `</cac:PostalAddress>`;

const iletisimXml = (telefon?: string, eposta?: string): string =>
  dolu(telefon) || dolu(eposta) ? `<cac:Contact>${etiket("cbc:Telephone", telefon)}${etiket("cbc:ElectronicMail", eposta)}</cac:Contact>` : "";

const kisiXml = (ad?: string, soyad?: string, uyruk?: string): string =>
  `<cac:Person>${etiket("cbc:FirstName", ad)}${etiket("cbc:FamilyName", soyad)}${etiket("cbc:NationalityID", uyruk)}</cac:Person>`;

const ekBelgeXml = (id: string, tarih: string, tur: string, ek = ""): string =>
  `<cac:AdditionalDocumentReference><cbc:ID>${e(id)}</cbc:ID><cbc:IssueDate>${e(tarih)}</cbc:IssueDate>` +
  `<cbc:DocumentTypeCode>${e(tur)}</cbc:DocumentTypeCode>${ek}</cac:AdditionalDocumentReference>`;

export interface EDovizUblSecenek {
  /** ALIM mı (DOVIZALIMBELGESI / ALIM) */
  alim: boolean;
  /** surum2Tutarlari(g): belgeye yazılacak karşılık / vergi hariç / vergi dahil tutarlar */
  tutarlar: { karsilik: number; vergiHaric: number; vergiDahil: number };
  /** Test için: XSLT eki yerine verilen Base64 (verilmezse Backend/belge/xslt'den okunur) */
  xsltBase64?: string;
}

/** EDovizGirdi → GİB v1.3 CreditNote XML (UTF-8 metin). */
export const edovizUblXml = (g: EDovizGirdi, s: EDovizUblSecenek): string => {
  const { tarih } = trTarihSaat(g.duzenlemeTarihi);
  const { saat } = trTarihSaat(g.duzenlemeSaati);
  const belgeNo = g.belgeNo.trim().toUpperCase();
  const doviz = g.tutar.kod;
  const kur = Number(g.tutar.hesapKuru);
  const ym = g.yetkiliMuessese;
  const ymNo = String(ym.vknTckn || "").trim();
  const ymSema = kimlikSemasi(ymNo);
  if (!ymSema) throw ApiError.badRequest("Müessese VKN/TCKN 10 ya da 11 hane olmalı; e-Döviz belgesi kurulamadı.");
  const m = g.musteri;
  const mNo = String(m.vknTckn || "").trim();
  const mSema = kimlikSemasi(mNo);

  const notlar = (g.notlar || []).filter(dolu).map((n) => `<cbc:Note>${e(n)}</cbc:Note>`).join("");

  // İlave dokümanlar: XSLT görünümü, istatistik no; alımda geldiği ülke / geliş nedeni ve (varsa) gümrük bilgileri
  const xslt =
    `<cac:AdditionalDocumentReference><cbc:ID>${e(g.uuid)}</cbc:ID><cbc:IssueDate>${e(tarih)}</cbc:IssueDate>` +
    `<cbc:DocumentType>XSLT</cbc:DocumentType><cac:Attachment>` +
    `<cbc:EmbeddedDocumentBinaryObject mimeCode="application/xml" encodingCode="Base64" characterSetCode="UTF-8" filename="${e(belgeNo)}.xslt">` +
    (s.xsltBase64 ?? edovizXsltBase64(s.alim)) +
    `</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>`;
  const istatistik = dolu(g.istatistikNo) ? ekBelgeXml(String(g.istatistikNo).trim(), tarih, "ISTATISTIKNO") : "";
  const eb = g.ekBilgiler;
  const alimEkleri = s.alim
    ? (dolu(eb?.geldigiUlke)
        ? ekBelgeXml("", tarih, "GELDIGIULKE", `<cac:IssuerParty><cac:PartyIdentification><cbc:ID/></cac:PartyIdentification>` +
            `<cac:PostalAddress><cac:Country><cbc:Name>${e(String(eb!.geldigiUlke).trim())}</cbc:Name></cac:Country></cac:PostalAddress></cac:IssuerParty>`)
        : "") +
      (dolu(eb?.gelisNedeni) ? ekBelgeXml(String(eb!.gelisNedeni).trim(), tarih, "GELISNEDENI") : "") +
      (eb?.ihracatYabanciSermaye
        ? ekBelgeXml("", trTarihSaat(eb.gumrukBeyanTarihi).tarih, "GBTARIHI") +
          ekBelgeXml(eb.gumrukBeyanNo || "", trTarihSaat(eb.gumrukBeyanTarihi).tarih, "GBNO") +
          ekBelgeXml("", trTarihSaat(eb.dbtTarihi).tarih, "DBTTARIH") +
          ekBelgeXml(eb.dbtSayi || "", trTarihSaat(eb.dbtTarihi).tarih, "DBTSAYI") +
          ekBelgeXml("", trTarihSaat(eb.gmtyTarihi).tarih, "GMTYTARIH") +
          ekBelgeXml(eb.gmtySayi || "", trTarihSaat(eb.gmtyTarihi).tarih, "GMTYSAYI")
        : "")
    : "";

  const imza =
    `<cac:Signature><cbc:ID schemeID="VKN_TCKN">${e(ymNo)}</cbc:ID><cac:SignatoryParty>` +
    `<cac:PartyIdentification><cbc:ID schemeID="${ymSema}">${e(ymNo)}</cbc:ID></cac:PartyIdentification>` +
    (dolu(ym.unvan) ? `<cac:PartyName><cbc:Name>${e(String(ym.unvan).trim())}</cbc:Name></cac:PartyName>` : "") +
    adresXml(ym.adres, ym.ilce, ym.sehir, ym.ulke) +
    `</cac:SignatoryParty><cac:DigitalSignatureAttachment><cac:ExternalReference>` +
    `<cbc:URI>#Signature_${e(belgeNo)}</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment></cac:Signature>`;

  const duzenleyen =
    `<cac:AccountingSupplierParty><cac:Party>` +
    `<cac:PartyIdentification><cbc:ID schemeID="${ymSema}">${e(ymNo)}</cbc:ID></cac:PartyIdentification>` +
    `<cac:PartyIdentification><cbc:ID schemeID="SUBENO">${e(String(g.odeme.yetkiliMuesseseDosyaNo || "").trim())}</cbc:ID></cac:PartyIdentification>` +
    (dolu(ym.unvan) ? `<cac:PartyName><cbc:Name>${e(String(ym.unvan).trim())}</cbc:Name></cac:PartyName>` : "") +
    adresXml(ym.adres, ym.ilce, ym.sehir, ym.ulke, "TR") +
    (dolu(ym.vergiDairesi) ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${e(String(ym.vergiDairesi).trim())}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>` : "") +
    iletisimXml(ym.telefon, ym.eposta) +
    // Şahıs müessese: GİB "TCKN varsa Person zorunlu" (ad, soyad, uyruk). Uyruk alanı firma tanımında yok; müessese sahibi TR.
    (ymSema === "TCKN" ? kisiXml(ym.ad, ym.soyad, "TR") : "") +
    `</cac:Party></cac:AccountingSupplierParty>`;

  const musteri =
    `<cac:AccountingCustomerParty><cac:Party>` +
    (mSema
      ? `<cac:PartyIdentification><cbc:ID schemeID="${mSema}">${e(mNo)}</cbc:ID></cac:PartyIdentification>`
      : dolu(m.pasaportNo)
        ? `<cac:PartyIdentification><cbc:ID schemeID="PASAPORTNO">${e(String(m.pasaportNo).trim())}</cbc:ID></cac:PartyIdentification>`
        : "") +
    `<cac:PartyIdentification><cbc:ID schemeID="MUSTERITURU">${e(String(m.musteriTuru || "GERCEKKISI").trim())}</cbc:ID></cac:PartyIdentification>` +
    (dolu(m.unvan) ? `<cac:PartyName><cbc:Name>${e(String(m.unvan).trim())}</cbc:Name></cac:PartyName>` : "") +
    adresXml(m.adres, m.ilce, m.sehir, m.ulke) +
    (dolu(m.vergiDairesi) && mSema === "VKN"
      ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${e(String(m.vergiDairesi).trim())}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>`
      : "") +
    iletisimXml(m.telefon, m.eposta) +
    (mSema !== "VKN" ? kisiXml(m.ad, m.soyad, m.uyruk) : "") +
    `</cac:Party></cac:AccountingCustomerParty>`;

  // Müşteri = ödeyen (Payer), döviz bürosu = ödenen (Payee) — GİB'in iki örneğinde de böyle
  const my = g.odeme.musteriYontemi || "NAKIT";
  const by = g.odeme.buroYontemi || "NAKIT";
  const odeme =
    `<cac:PaymentMeans><cbc:PaymentMeansCode listID="UN/4461">${ODEME_KODU[my]}</cbc:PaymentMeansCode>` +
    `<cac:PayerFinancialAccount><cbc:ID>${hesapNo(my)}</cbc:ID></cac:PayerFinancialAccount></cac:PaymentMeans>` +
    `<cac:PaymentMeans><cbc:PaymentMeansCode listID="UN/4461">${ODEME_KODU[by]}</cbc:PaymentMeansCode>` +
    `<cac:PayeeFinancialAccount><cbc:ID>${hesapNo(by)}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>`;

  // USD karşılığı (K12): ICE send_edoviz bu eleman yokken belgeyi kaydedemiyor ("SP_Save_3rd_edoviz_detay ... kaydedilemedi",
  // ICE TEST 23.11.2026 V2; eklenince V1/V4 kabul). Kur yoksa ön kontrol belgeyi ICE'ye göndermez. USD belgede USD → USD 1.
  const usd = Number(g.tutar.usdKuru);
  const fiyatKuru =
    usd > 0
      ? `<cac:PricingExchangeRate><cbc:SourceCurrencyCode>${e(doviz)}</cbc:SourceCurrencyCode><cbc:TargetCurrencyCode>USD</cbc:TargetCurrencyCode>` +
        `<cbc:CalculationRate>${kur6(usd)}</cbc:CalculationRate></cac:PricingExchangeRate>`
      : "";
  // Yönlü hesap kuru: ALIM döviz → TRY, SATIM TRY → döviz
  const odemeKuru =
    `<cac:PaymentExchangeRate><cbc:SourceCurrencyCode>${e(s.alim ? doviz : "TRY")}</cbc:SourceCurrencyCode>` +
    `<cbc:TargetCurrencyCode>${e(s.alim ? "TRY" : doviz)}</cbc:TargetCurrencyCode><cbc:CalculationRate>${kur6(kur)}</cbc:CalculationRate></cac:PaymentExchangeRate>`;

  const vergi =
    `<cac:TaxTotal><cbc:TaxAmount currencyID="TRY">${tutar(g.tutar.vergiTutari)}</cbc:TaxAmount><cac:TaxSubtotal>` +
    `<cbc:TaxableAmount currencyID="TRY">${tutar(g.tutar.vergiMatrahi)}</cbc:TaxableAmount>` +
    `<cbc:TaxAmount currencyID="TRY">${tutar(g.tutar.vergiTutari)}</cbc:TaxAmount>` +
    `<cbc:CalculationSequenceNumeric>1</cbc:CalculationSequenceNumeric><cbc:Percent>${Number(g.tutar.vergiOrani) || 0}</cbc:Percent>` +
    `<cac:TaxCategory><cac:TaxScheme><cbc:Name>${e(g.tutar.vergiAdi || "BSMV")}</cbc:Name>` +
    `<cbc:TaxTypeCode>${e(g.tutar.vergiKodu || "0021")}</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>`;

  // ALIM: karşılık TL, ödenecek döviz; SATIM: karşılık döviz, ödenecek TL (GİB örnekleri)
  const t = s.tutarlar;
  const toplamlar =
    `<cac:LegalMonetaryTotal>` +
    `<cbc:LineExtensionAmount currencyID="${e(s.alim ? "TRY" : doviz)}">${tutar(t.karsilik)}</cbc:LineExtensionAmount>` +
    `<cbc:TaxExclusiveAmount currencyID="TRY">${tutar(t.vergiHaric)}</cbc:TaxExclusiveAmount>` +
    `<cbc:TaxInclusiveAmount currencyID="TRY">${tutar(t.vergiDahil)}</cbc:TaxInclusiveAmount>` +
    `<cbc:PayableAmount currencyID="${e(s.alim ? doviz : "TRY")}">${tutar(g.tutar.payableAmount)}</cbc:PayableAmount>` +
    `</cac:LegalMonetaryTotal>`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"` +
    ` xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"` +
    ` xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"` +
    ` xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">` +
    // ICE imza için UBLExtensions'ı doldurur (gider pusulasında "prefix ext is not bound" görüldü; ilk çocuk olmalı)
    `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>` +
    `<cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2.1</cbc:CustomizationID>` +
    `<cbc:ProfileID>${e(g.profileId || "EDOVIZBELGE")}</cbc:ProfileID>` +
    `<cbc:ID>${e(belgeNo)}</cbc:ID><cbc:CopyIndicator>false</cbc:CopyIndicator><cbc:UUID>${e(g.uuid)}</cbc:UUID>` +
    `<cbc:IssueDate>${tarih}</cbc:IssueDate><cbc:IssueTime>${saat}</cbc:IssueTime>` +
    `<cbc:CreditNoteTypeCode>${s.alim ? "ALIM" : "SATIM"}</cbc:CreditNoteTypeCode>` +
    notlar +
    xslt +
    istatistik +
    alimEkleri +
    imza +
    duzenleyen +
    musteri +
    odeme +
    fiyatKuru +
    odemeKuru +
    vergi +
    toplamlar +
    // GİB örneğindeki gibi: şemadan geçmek için tek boş satır
    `<cac:CreditNoteLine><cbc:ID>1</cbc:ID></cac:CreditNoteLine>` +
    `</CreditNote>`
  );
};
