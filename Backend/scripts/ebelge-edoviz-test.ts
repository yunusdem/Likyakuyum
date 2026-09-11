/** Çevrimdışı regresyon: e-Döviz eşlemesi, XML alan sırası, önizleme ve gönderim güvenliği. */
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import sql from 'mssql';
import { XMLParser } from 'fast-xml-parser';
import { EbelgeKaynakRepository as kaynakRepo, KaynakKimlik, DOVIZ_EVRAK_TURU } from '../src/models/ebelgeKaynak.repository.js';
import { EbelgeSqlRepository as repo } from '../src/models/ebelgeSql.repository.js';
import { EbelgeKaynakService as kaynak, dovizGirdisi } from '../src/services/ebelgeKaynak.service.js';
import { buildEDovizInnerXml, EDovizGirdi } from '../src/services/ice/ice.edoviz.js';

// Gerçek SQL ve HTTP erişimini test başarısızlığına çevir.
(sql.ConnectionPool.prototype as any).connect = () => { throw new Error('TEST: gerçek SQL yasak'); };
(kaynakRepo as any).pool = () => { throw new Error('TEST: taklit edilmemiş kaynak repository çağrısı'); };
globalThis.fetch = (async () => { throw new Error('TEST: gerçek ICE çağrısı yasak'); }) as any;

const kimlik: KaynakKimlik = { evrakTuru: DOVIZ_EVRAK_TURU, belgeId: 501, belgeTuru: 1 };
const baslik = () => ({
  BELGE_ID: 501, FIS_TIPI: 1, BELGE_NO: 'DVZ2026000000042', ID: 'DVZ2026000000042',
  TARIH: '2026-03-04T11:30:00.000Z', IssueDate: '2026-03-04T00:00:00.000Z', IssueTime: '2026-03-04T11:30:00.000Z',
  UNVAN: 'John Smith', MIKTAR: 1000, PARA_KODU: 'USD', CurrencyCode: 'USD',
  ETTN: '', E_BELGE_DURUMU: 0, E_BELGE_HATA_ACIKLAMASI: '', IPTAL: 0,
  ProfileId: 'TEMELDOVIZ', CreditNoteTypeCode: 'DOVIZALIM',
  Supplier_PartyIdentification: '1234567890', Supplier_PartyName: 'Lidya Kuyumculuk',
  Supplier_CityName: 'Antalya', Supplier_CitySubdivisionName: 'Muratpaşa',
  Customer_PartyIdentification_ID: '', Customer_PartyIdentification_PassportID: 'U1234567',
  Customer_Person_FirstName: 'John', Customer_Person_FamilyName: 'Smith',
  Customer_CountryName: 'ABD',
  KUR: 34.5, TL_KARSILIGI: 34500, DOLAR_KARSILIK_KURU: 1,
  TaxableAmount: 0, TaxAmount: 0, TaxPercent: 0,
  LineExtensionAmount: 34500, TaxExclusiveAmount: 34500, TaxInclusiveAmount: 34500, PayableAmount: 34500,
  KOMISYON: 50, BMV: 2.5, VEZNE_KODU: 'VZN1',
});

let kayit: { baslik: any };
let gidenVar: boolean;
let onizlemeHatasi: Error | null;
let gonderimSonucu: any;
let cagrilar: string[];
let durumlar: { durum: string; mesaj: string }[];
let gidenKayitlari: any[];

beforeEach(() => {
  kayit = { baslik: baslik() };
  gidenVar = false; onizlemeHatasi = null; cagrilar = []; durumlar = []; gidenKayitlari = [];
  gonderimSonucu = {
    success: 'true', response_code: 0, response_message: 'OK',
    CreditNoteType_responseTypes: { CreditNoteType_responseType: { success: 'true', ID: 'DVZ2026000000042', ettn: '' } },
  };
  (kaynakRepo as any).dovizDetay = async () => JSON.parse(JSON.stringify(kayit));
  (kaynakRepo as any).reserve = async () => { cagrilar.push('reserve'); };
  (kaynakRepo as any).sonuc = async (_k: any, durum: string, mesaj: string) => { durumlar.push({ durum, mesaj }); };
  (repo as any).gidenBelgeNoVarMi = async () => gidenVar;
  (repo as any).getConnectionConfig = async () => ({ servisUrl: 'x', kullaniciAdi: 'y', sifre: 'z' });
  (repo as any).insertGiden = async (k: any) => { cagrilar.push('insertGiden'); gidenKayitlari.push(k); };
  (repo as any).earsivDurumGecir = async (_u: string, _b: string, d: string) => { cagrilar.push('durum:' + d); };
  (repo as any).writeLog = async () => { cagrilar.push('log'); };
});

/** ICE adaptörünü taklit et: preview ve send çağrılarını yakala. */
const adapterTakli = async () => {
  const mod: any = await import('../src/services/ice/ice.edoviz.js');
  return mod;
};

test('Döviz fişi ICE girdisine eşlenir; pasaportlu müşteri kabul edilir', () => {
  const g = dovizGirdisi(kayit);
  assert.equal(g.belgeNo, 'DVZ2026000000042');
  assert.equal(g.creditNoteTypeCode, 'DOVIZALIM');
  assert.equal(g.musteri.pasaportNo, 'U1234567');
  assert.equal(g.musteri.ad, 'John');
  assert.equal(g.alisSatis.dovizKodu, 'USD');
  assert.equal(g.tutar.payableAmount, 34500);
  assert.equal(g.tutar.tlKarsilikKuru, 34.5);
  assert.equal(g.tutar.safAltinKarsiligi, 0);
  assert.equal(g.komisyon?.dahilToplam, 52.5);
  assert.equal(g.tutarHesaplanmasin, true, 'ERP tutarları korunmalı');
});

test('İptal, eski ETTN, eski hata ve bozuk belge no gönderimi durdurur', () => {
  const ile = (yama: any) => ({ baslik: { ...baslik(), ...yama } });
  assert.throws(() => dovizGirdisi(ile({ IPTAL: 1 })), /iptal edilmiş/);
  assert.throws(() => dovizGirdisi(ile({ ETTN: 'eski' })), /ETTN/);
  assert.throws(() => dovizGirdisi(ile({ E_BELGE_DURUMU: 2 })), /ETTN|işlem/);
  assert.throws(() => dovizGirdisi(ile({ E_BELGE_HATA_ACIKLAMASI: 'red' })), /hata kaydı/);
  assert.throws(() => dovizGirdisi(ile({ BELGE_NO: 'DV2026000000042', ID: 'DV2026000000042' })), /numarası/);
  assert.throws(() => dovizGirdisi(ile({ PARA_KODU: '', CurrencyCode: '' })), /Döviz kodu/);
  assert.throws(() => dovizGirdisi(ile({ MIKTAR: 0 })), /miktarı/);
  assert.throws(() => dovizGirdisi(ile({ PayableAmount: null })), /Ödenecek tutar/);
});

test('Kimliksiz müşteri reddedilir; TCKN veya pasaport zorunludur', () => {
  assert.throws(
    () => dovizGirdisi({ baslik: { ...baslik(), Customer_PartyIdentification_ID: '', Customer_PartyIdentification: '', Customer_PartyIdentification_PassportID: '' } }),
    /pasaport/
  );
});

test('Üretilen XML, WSDL sequence sırasını korur', () => {
  const g = dovizGirdisi(kayit);
  const xml = buildEDovizInnerXml('<Login_Request_Header/>', g as EDovizGirdi);
  const sira = ['Login_Request_Header', 'Baslik_Bilgileri', 'Yetkili_Muessese', 'Musteri',
    'Alis_Satis_Bilgileri', 'Komisyon_Bilgileri', 'Tutar_Bilgileri', 'TutarHesaplanmasin'];
  let konum = -1;
  for (const etiket of sira) {
    const yeni = xml.indexOf('<' + etiket);
    assert.ok(yeni > konum, `${etiket} alan sırası bozuk`);
    konum = yeni;
  }
  // XML ayrıştırılabilir olmalı; kaçış hataları burada yakalanır.
  const parsed = new XMLParser({ removeNSPrefix: true }).parse('<k>' + xml + '</k>');
  assert.equal(parsed.k._eDovizBelge.Baslik_Bilgileri.ID, 'DVZ2026000000042');
  assert.equal(parsed.k._eDovizBelge.TutarHesaplanmasin, true);
  assert.equal(parsed.k._eDovizBelge.Tutar_Bilgileri.Saf_Altin_Karsiligi, 0);
  assert.ok(!xml.includes('<Ek_Bilgiler>'), 'zorunlu tarihleri eksik Ek_Bilgiler üretilmemeli');
});

test('Boş blok üretilmez', () => {
  const g = dovizGirdisi({ baslik: { ...baslik(), KOMISYON: null, BMV: null } });
  const xml = buildEDovizInnerXml('', g as EDovizGirdi);
  assert.ok(!xml.includes('<Komisyon_Bilgileri>'), 'komisyon yoksa blok gönderilmemeli');
});

test('Hazırlama önizleme çağırır, gönderim yapmaz', async () => {
  const mod = await adapterTakli();
  const eski = mod.previewEDoviz;
  (mod as any).previewEDoviz = async () => { cagrilar.push('preview'); return { onizleme: '<html/>' }; };
  try {
    const hazir = await kaynak.dovizHazirla(kimlik);
    assert.equal(hazir.belgeTuruAdi, 'e-Döviz');
    assert.equal(hazir.tutar, 34500);
    assert.deepEqual(cagrilar, ['preview']);
  } finally { (mod as any).previewEDoviz = eski; }
});

test('Giden kutusunda mevcut belge yeniden hazırlanmaz', async () => {
  gidenVar = true;
  await assert.rejects(kaynak.dovizHazirla(kimlik), /zaten mevcut/);
});
