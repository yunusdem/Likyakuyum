import assert from 'node:assert/strict';
import { test } from 'node:test';
import { XMLParser } from 'fast-xml-parser';
import { buildMustahsilXml, dogrulaMustahsil, hesaplaMustahsil } from '../dist/services/ice/ubl/mustahsilBuilder.js';

const taraf={vknTckn:'1234567890',unvan:'Likya Kuyum',il:'Antalya',ilce:'Muratpaşa',adres:'Merkez'};
const uretici={vknTckn:'11111111111',ad:'Ali',soyad:'Çiftçi',il:'Antalya',ilce:'Korkuteli',adres:'Köy',telefon:'5551112233'};
const girdi=()=>({belgeNo:'MST2026000000001',uuid:'11111111-2222-4333-8444-555555555555',tarih:'2026-09-10',saat:'12:30:00',gonderici:{...taraf},uretici:{...uretici},smsKodu:'843921',smsSaglayiciAdi:'SMS AŞ',smsSaglayiciVkn:'9876543210',satirlar:[{ad:'Hurda altın',miktar:10,birimKodu:'GRM',birimFiyat:3000,stopajOrani:2,stopajKodu:'0003',stopajAdi:'GELİR VERGİSİ S. (MUHTASAR)'}]});

test('brüt, stopaj ve net ödeme doğru hesaplanır',()=>assert.deepEqual(hesaplaMustahsil(girdi().satirlar),{satirlar:[{siraNo:1,brut:30000,stopaj:600}],brutToplam:30000,stopajToplam:600,netOdenecek:29400,stopajGruplari:[{kod:'0003',ad:'GELİR VERGİSİ S. (MUHTASAR)',oran:2,matrah:30000,vergi:600}]}));
test('resmi profil ve belge tipi üretilir',()=>{const {xml}=buildMustahsilXml(girdi());assert.match(xml,/<cbc:ProfileID>EARSIVBELGE/);assert.match(xml,/<cbc:CreditNoteTypeCode>MUSTAHSILMAKBUZ/);});
test('SMS kodu, telefon ve sağlayıcı VKN XML içinde bulunur',()=>{const {xml}=buildMustahsilXml(girdi());for(const v of ['843921','5551112233','SMS_PROVIDER','9876543210'])assert.ok(xml.includes(v));});
test('stopaj net ödemeden düşülür',()=>{const {xml}=buildMustahsilXml(girdi());assert.match(xml,/<cbc:PayableAmount currencyID="TRY">29400.00/);assert.match(xml,/<cbc:TaxAmount currencyID="TRY">600.00/);});
test('UBL üst düzey öğe sırası korunur',()=>{const {xml}=buildMustahsilXml(girdi());const tags=['UBLExtensions','UBLVersionID','CustomizationID','ProfileID','ID','CopyIndicator','UUID','IssueDate','IssueTime','CreditNoteTypeCode','DocumentCurrencyCode','AccountingSupplierParty','AccountingCustomerParty','TaxTotal','LegalMonetaryTotal','CreditNoteLine'];let p=-1;for(const t of tags){const n=xml.indexOf(':'+t);assert.ok(n>p,t);p=n;}});
test('XML ayrıştırılabilir ve kimlik semaları doğrudur',()=>{const {xml}=buildMustahsilXml(girdi());const p=new XMLParser({removeNSPrefix:true,ignoreAttributes:false}).parse(xml);assert.equal(p.CreditNote.ID,'MST2026000000001');assert.equal(p.CreditNote.AccountingCustomerParty.Party.PartyIdentification.ID['@_schemeID'],'TCKN');});
test('belge numarası ve yıl uyuşmazlığı reddedilir',()=>assert.throws(()=>dogrulaMustahsil({...girdi(),belgeNo:'MST2025000000001'}),/yıl/));
test('SMS alanları eksik belge reddedilir',()=>assert.throws(()=>dogrulaMustahsil({...girdi(),smsKodu:''}),/SMS kodu/));
test('üretici telefonu eksik belge reddedilir',()=>assert.throws(()=>dogrulaMustahsil({...girdi(),uretici:{...uretici,telefon:''}}),/telefonu/));
test('geçersiz stopaj kodu ve oranı reddedilir',()=>{assert.throws(()=>dogrulaMustahsil({...girdi(),satirlar:[{...girdi().satirlar[0],stopajKodu:'003'}]}),/4 rakam/);assert.throws(()=>dogrulaMustahsil({...girdi(),satirlar:[{...girdi().satirlar[0],stopajOrani:101}]}),/satırı geçersiz/);});
test('TRY dışı para birimi reddedilir',()=>assert.throws(()=>dogrulaMustahsil({...girdi(),paraBirimi:'USD'}),/yalnız TRY/));
test('XML özel karakterleri güvenli kaçırır',()=>{const {xml}=buildMustahsilXml({...girdi(),satirlar:[{...girdi().satirlar[0],ad:'Altın & Gümüş <hurda>'}]});assert.ok(xml.includes('Altın &amp; Gümüş &lt;hurda&gt;'));});
