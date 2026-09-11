import { randomUUID } from "node:crypto";
import { escapeXml } from "../ice.client.js";
import { ApiError } from "../../../utils/ApiError.js";
import { UblTaraf, kimlikSemasi } from "./invoiceBuilder.js";

export interface MustahsilSatiri {
  ad: string; aciklama?: string; miktar: number; birimKodu?: string; birimFiyat: number;
  stopajOrani: number; stopajKodu: string; stopajAdi?: string;
}
export interface MustahsilGirdi {
  belgeNo: string; uuid?: string; tarih?: string; saat?: string; paraBirimi?: string; notlar?: string[];
  gonderici: UblTaraf; uretici: UblTaraf; smsKodu: string; smsSaglayiciAdi: string; smsSaglayiciVkn: string;
  satirlar: MustahsilSatiri[];
}
export interface MustahsilHesap {
  satirlar: { siraNo: number; brut: number; stopaj: number }[];
  brutToplam: number; stopajToplam: number; netOdenecek: number;
  stopajGruplari: { kod: string; ad: string; oran: number; matrah: number; vergi: number }[];
}
const yuvarla = (n: number) => Math.round(n * 100) / 100;
const para = (n: number) => yuvarla(n).toFixed(2);
const miktar = (n: number) => String(Math.round(n * 100000) / 100000);
const bugun = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const simdi = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Istanbul", hour12: false });
const tag = (n: string, v?: unknown) => v === undefined || v === null || String(v).trim() === "" ? "" : `<${n}>${escapeXml(v)}</${n}>`;

export function dogrulaMustahsil(g: MustahsilGirdi): void {
  const no = (g.belgeNo || "").trim().toUpperCase(); const tarih = g.tarih || bugun();
  if (!/^[A-Z0-9]{3}\d{13}$/.test(no)) throw ApiError.badRequest("Müstahsil makbuzu numarası 3 karakter seri ve 13 rakam olmalıdır.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih) || no.slice(3,7) !== tarih.slice(0,4)) throw ApiError.badRequest("Belge tarihi veya belge numarasındaki yıl geçersiz.");
  if ((g.paraBirimi || "TRY").toUpperCase() !== "TRY") throw ApiError.badRequest("e-Müstahsil bu sürümde yalnız TRY destekler.");
  for (const [ad,t] of [["Düzenleyen",g.gonderici],["Üretici",g.uretici]] as const) {
    if (!/^\d{10}$|^\d{11}$/.test(t?.vknTckn?.trim() || "")) throw ApiError.badRequest(`${ad} VKN/TCKN geçersiz.`);
    if (!t.il?.trim() || !t.ilce?.trim()) throw ApiError.badRequest(`${ad} il ve ilçe bilgisi zorunludur.`);
  }
  if (g.uretici.vknTckn.length === 11 && (!g.uretici.ad?.trim() || !g.uretici.soyad?.trim())) throw ApiError.badRequest("TCKN'li üreticinin adı ve soyadı zorunludur.");
  if (!g.uretici.telefon?.trim() || !g.smsKodu?.trim()) throw ApiError.badRequest("Üretici telefonu ve SMS kodu zorunludur.");
  if (!g.smsSaglayiciAdi?.trim() || !/^\d{10}$/.test(g.smsSaglayiciVkn || "")) throw ApiError.badRequest("SMS sağlayıcı adı ve 10 haneli VKN'si zorunludur.");
  if (!g.satirlar?.length) throw ApiError.badRequest("En az bir ürün satırı zorunludur.");
  g.satirlar.forEach((s,i) => {
    if (!s.ad?.trim() || ![s.miktar,s.birimFiyat,s.stopajOrani].every(Number.isFinite) || s.miktar <= 0 || s.birimFiyat < 0 || s.stopajOrani < 0 || s.stopajOrani > 100) throw ApiError.badRequest(`${i+1}. müstahsil satırı geçersiz.`);
    if (!/^\d{4}$/.test(s.stopajKodu || "")) throw ApiError.badRequest(`${i+1}. satır stopaj kodu 4 rakam olmalıdır.`);
  });
}
export function hesaplaMustahsil(satirlar: MustahsilSatiri[]): MustahsilHesap {
  const hs = satirlar.map((s,i) => { const brut=yuvarla(s.miktar*s.birimFiyat); return {siraNo:i+1,brut,stopaj:yuvarla(brut*s.stopajOrani/100)}; });
  const gr = new Map<string,{kod:string;ad:string;oran:number;matrah:number;vergi:number}>();
  satirlar.forEach((s,i)=>{ const k=`${s.stopajKodu}:${s.stopajOrani}`, e=gr.get(k)||{kod:s.stopajKodu,ad:s.stopajAdi||"GELİR VERGİSİ STOPAJI",oran:s.stopajOrani,matrah:0,vergi:0}; e.matrah=yuvarla(e.matrah+hs[i].brut); e.vergi=yuvarla(e.vergi+hs[i].stopaj); gr.set(k,e); });
  const brutToplam=yuvarla(hs.reduce((a,b)=>a+b.brut,0)), stopajToplam=yuvarla(hs.reduce((a,b)=>a+b.stopaj,0));
  return {satirlar:hs,brutToplam,stopajToplam,netOdenecek:yuvarla(brutToplam-stopajToplam),stopajGruplari:[...gr.values()]};
}
const party = (t: UblTaraf, contact: string) => {
  const id=t.vknTckn.trim(), unvan=t.unvan?.trim()||[t.ad,t.soyad].filter(Boolean).join(" ");
  return `<cac:Party><cac:PartyIdentification><cbc:ID schemeID="${kimlikSemasi(id)}">${id}</cbc:ID></cac:PartyIdentification>`+
    (unvan?`<cac:PartyName><cbc:Name>${escapeXml(unvan)}</cbc:Name></cac:PartyName>`:"")+`<cac:PostalAddress>${tag("cbc:StreetName",t.adres)}<cbc:CitySubdivisionName>${escapeXml(t.ilce!)}</cbc:CitySubdivisionName><cbc:CityName>${escapeXml(t.il!)}</cbc:CityName><cac:Country><cbc:Name>${escapeXml(t.ulke||"TÜRKİYE")}</cbc:Name></cac:Country></cac:PostalAddress>${contact}`+
    (id.length===11?`<cac:Person><cbc:FirstName>${escapeXml(t.ad!)}</cbc:FirstName><cbc:FamilyName>${escapeXml(t.soyad!)}</cbc:FamilyName></cac:Person>`:"")+`</cac:Party>`;
};
const taxSub = (matrah:number,vergi:number,s:Pick<MustahsilSatiri,"stopajOrani"|"stopajKodu"|"stopajAdi">) => `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">${para(matrah)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">${para(vergi)}</cbc:TaxAmount><cbc:CalculationSequenceNumeric>1</cbc:CalculationSequenceNumeric><cbc:Percent>${s.stopajOrani}</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>${escapeXml(s.stopajAdi||"GELİR VERGİSİ STOPAJI")}</cbc:Name><cbc:TaxTypeCode>${s.stopajKodu}</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`;

export function buildMustahsilXml(g: MustahsilGirdi) {
  dogrulaMustahsil(g); const h=hesaplaMustahsil(g.satirlar), uuid=g.uuid?.trim()||randomUUID(), tarih=g.tarih||bugun(), saat=g.saat||simdi();
  const operator=`<cac:Contact><cac:OtherCommunication><cbc:ChannelCode name="SMS_PROVIDER">${escapeXml(g.smsSaglayiciAdi)}</cbc:ChannelCode><cbc:Value>${g.smsSaglayiciVkn}</cbc:Value></cac:OtherCommunication></cac:Contact>`;
  const sms=`<cac:Contact><cbc:ID>${escapeXml(g.smsKodu)}</cbc:ID><cbc:Name>SMS</cbc:Name><cbc:Telephone>${escapeXml(g.uretici.telefon!)}</cbc:Telephone></cac:Contact>`;
  const xml=`<?xml version="1.0" encoding="UTF-8"?><CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2.1</cbc:CustomizationID><cbc:ProfileID>EARSIVBELGE</cbc:ProfileID><cbc:ID>${escapeXml(g.belgeNo.toUpperCase())}</cbc:ID><cbc:CopyIndicator>false</cbc:CopyIndicator><cbc:UUID>${uuid}</cbc:UUID><cbc:IssueDate>${tarih}</cbc:IssueDate><cbc:IssueTime>${saat}</cbc:IssueTime><cbc:CreditNoteTypeCode>MUSTAHSILMAKBUZ</cbc:CreditNoteTypeCode>${(g.notlar||[]).map(n=>tag("cbc:Note",n)).join("")}<cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode><cac:AccountingSupplierParty>${party(g.gonderici,operator)}</cac:AccountingSupplierParty><cac:AccountingCustomerParty>${party(g.uretici,sms)}</cac:AccountingCustomerParty><cac:TaxTotal><cbc:TaxAmount currencyID="TRY">${para(h.stopajToplam)}</cbc:TaxAmount>${h.stopajGruplari.map(x=>taxSub(x.matrah,x.vergi,{stopajOrani:x.oran,stopajKodu:x.kod,stopajAdi:x.ad})).join("")}</cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="TRY">${para(h.brutToplam)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="TRY">${para(h.brutToplam)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="TRY">${para(h.brutToplam)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="TRY">${para(h.netOdenecek)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${g.satirlar.map((s,i)=>`<cac:CreditNoteLine><cbc:ID>${i+1}</cbc:ID><cbc:CreditedQuantity unitCode="${escapeXml(s.birimKodu||"C62")}">${miktar(s.miktar)}</cbc:CreditedQuantity><cbc:LineExtensionAmount currencyID="TRY">${para(h.satirlar[i].brut)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="TRY">${para(h.satirlar[i].stopaj)}</cbc:TaxAmount>${taxSub(h.satirlar[i].brut,h.satirlar[i].stopaj,s)}</cac:TaxTotal><cac:Item>${tag("cbc:Description",s.aciklama)}<cbc:Name>${escapeXml(s.ad)}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">${para(s.birimFiyat)}</cbc:PriceAmount></cac:Price></cac:CreditNoteLine>`).join("")}</CreditNote>`;
  return {xml,uuid,ozet:h};
}
