/** Çevrimdışı regresyon: e-Döviz eşlemesi, XML alan sırası, önizleme ve gönderim güvenliği. */
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import sql from 'mssql';
import { XMLParser } from 'fast-xml-parser';
import { EbelgeKaynakRepository as kaynakRepo, kaynakSecim, kaynakAnahtar, KaynakKimlik, DOVIZ_EVRAK_TURU } from '../src/models/ebelgeKaynak.repository.js';
import { EbelgeSqlRepository as repo } from '../src/models/ebelgeSql.repository.js';
import { EbelgeKaynakService as kaynak, dovizGirdisi } from '../src/services/ebelgeKaynak.service.js';
import { buildEDovizInnerXml, EDovizGirdi } from '../src/services/ice/ice.edoviz.js';
import { clearSession } from '../src/services/ice/ice.session.js';
const config = { servisUrl: 'https://integration.iceteknoloji.com.tr/integration.asmx', kullaniciAdi: 'offline-edoviz', sifre: 'offline', uygulamaAdi: 'offline', uygulamaSurum: '1' };
const ettn = 'b005795e-b8a8-4142-9fd4-a096f32bcbcc';
let overrides: Record<string, string | Error>;

// Gerçek SQL ve HTTP erişimini test başarısızlığına çevir.
(sql.ConnectionPool.prototype as any).connect = () => { throw new Error('TEST: gerçek SQL yasak'); };
(kaynakRepo as any).pool = () => { throw new Error('TEST: taklit edilmemiş kaynak repository çağrısı'); };
globalThis.fetch = async (_url, init) => {
  const method = String((init?.headers as any).SOAPAction).split('/').pop()!.replaceAll('"', '');
  if (method !== 'Login') cagrilar.push(method);
  const defaults: Record<string, string> = {
    Login: '<isSuccecss>true</isSuccecss><Login_Request_Header><Session_ID>offline</Session_ID><IP_Number>127.0.0.1</IP_Number><Security_Key>offline</Security_Key></Login_Request_Header>',
    Get_EDoviz_Status: '',
    preview_edoviz_basic: '&lt;html&gt;Fiş önizlemesi&lt;/html&gt;',
    send_edoviz_basic: `<success>true</success><CreditNoteType_responseTypes><CreditNoteType_responseType><success>true</success><shema_is_validate>true</shema_is_validate><schematron_is_validate>true</schematron_is_validate><ettn>${ettn}</ettn><ID>DVZ2026000000042</ID></CreditNoteType_responseType></CreditNoteType_responseTypes>`,
  };
  const value = overrides[method] ?? defaults[method];
  if (value instanceof Error) throw value;
  assert.notEqual(value, undefined, `Beklenmeyen ICE operasyonu: ${method}`);
  if (method === 'send_edoviz_basic') {
    assert.equal(gidenKayitlari.length, 1, 'ICE çağrısından önce giden kaydı yazılmalı');
    assert.ok(String(init?.body).toLowerCase().includes(ettn));
  }
  return new Response(`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method}Response><${method}Result>${value}</${method}Result></${method}Response></soap:Body></soap:Envelope>`);
};

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
  // Fişin istatistik tanımından gelen kod (TODVZ_ISTATISTIK.KOD); ICE belge türüyle doğrular.
  ISTATISTIK_KOD: '1010',
});

let kayit: { baslik: any };
let gidenVar: boolean;
let onizlemeHatasi: Error | null;
let gonderimSonucu: any;
let cagrilar: string[];
let durumlar: { durum: string; mesaj: string }[];
let gidenKayitlari: any[];

beforeEach(() => {
  clearSession(config); overrides = {};
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
  // Ayar boş: gönderici VKN görünümden gelir (fatura akışıyla aynı öncelik).
  (repo as any).getAyar = async () => ({ firmaVkn: '' });
  // Firma tanımındaki Dosya No: ICE ödeme hesap bloğunda zorunlu tutuyor.
  (repo as any).getFirmaBilgisi = async () => ({ vkn: '', unvan: '', adres: '', telefon: '', dosyaNo: 'DSY-001' });
  (repo as any).getConnectionConfig = async () => config;
  (repo as any).insertGiden = async (k: any) => { cagrilar.push('insertGiden'); gidenKayitlari.push(k); gidenVar = true; };
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
  // ICE yalnızca DOVIZALIMBELGESI / DOVIZSATIMBELGESI tanır; görünümdeki
  // "DOVIZALIM" metni değil, fişin FIS_TIPI değeri belirleyicidir.
  assert.equal(g.creditNoteTypeCode, 'DOVIZSATIMBELGESI', 'FIS_TIPI=1 satış belgesidir');
  assert.equal(dovizGirdisi({ baslik: { ...baslik(), FIS_TIPI: 0 } }).creditNoteTypeCode, 'DOVIZALIMBELGESI');
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
  // Görünüm kimlik yerine tür etiketi (GERCEKKISI) yazıyorsa bu kimlik sayılmaz:
  // pasaport da yoksa reddedilir; varsa etiket Musteri_Turu'na taşınır.
  assert.throws(
    () => dovizGirdisi({ baslik: { ...baslik(), Customer_PartyIdentification_ID: 'GERCEKKISI', Customer_PartyIdentification_PassportID: '' } }),
    /kimliksiz/
  );
  const etiketli = dovizGirdisi({ baslik: { ...baslik(), Customer_PartyIdentification_ID: 'GERCEKKISI' } });
  assert.equal(etiketli.musteri.vknTckn, '');
  assert.equal(etiketli.musteri.musteriTuru, 'GERCEKKISI');
  // Tür yoksa kimlikten türetilir: 10 hane VKN tüzel, TCKN/pasaport gerçek kişi.
  assert.equal(dovizGirdisi({ baslik: { ...baslik(), Customer_PartyIdentification_ID: '1234567890' } }).musteri.musteriTuru, 'TUZELKISI');
  assert.equal(dovizGirdisi(kayit).musteri.musteriTuru, 'GERCEKKISI');
  // Gönderici VKN: fatura akışıyla aynı öncelik — E-Belge ayarındaki Firma VKN
  // varsa o, yoksa görünümdeki firma.
  assert.equal(dovizGirdisi(kayit, { vknTckn: '31534209546' }).yetkiliMuessese.vknTckn, '31534209546');
  assert.equal(dovizGirdisi(kayit, { vknTckn: '' }).yetkiliMuessese.vknTckn, '1234567890');
  assert.equal(dovizGirdisi(kayit).yetkiliMuessese.vknTckn, '1234567890');

  // ICE iş kuralları (gerçek ret mesajlarından): istatistik kodu gümrük bilgisi
  // olmasa da gitmeli; Yetkili Müessese Dosya Numarası ödeme hesap bloğunda zorunlu.
  const xmlDosyali = buildEDovizInnerXml('', dovizGirdisi(kayit, { vknTckn: '', dosyaNo: 'DSY-001' }));
  // ICE'nin gözlenen kuralı: Istatistik_No her iki türde gider; kodun türü belge türüyle
  // eşleşmeli. Satımda hiç göndermemek, boş göndermek ve alış kodu göndermek aynı reti
  // verdi ("ISTATISTIKNO ile Belge türü uyumsuzluğu"). Tür, fişin istatistik tanımından
  // (TODVZ_ISTATISTIK.FIS_TIPI) ICE'ye gitmeden doğrulanır; ret numarayı yaktığı için.
  assert.match(xmlDosyali, /<Ek_Bilgiler><Istatistik_No>1010<\/Istatistik_No><Geldigi_Ulke><\/Geldigi_Ulke><Gelis_Nedeni><\/Gelis_Nedeni>/, 'satım belgesinde de istatistik kodu gitmeli');
  const xmlAlim = buildEDovizInnerXml('', dovizGirdisi({ baslik: { ...baslik(), FIS_TIPI: 0 } }, { vknTckn: '', dosyaNo: 'DSY-001' }));
  assert.match(xmlAlim, /<Ek_Bilgiler><Istatistik_No>1010<\/Istatistik_No>/, 'alım belgesinde istatistik kodu gitmeli');
  assert.throws(() => dovizGirdisi({ baslik: { ...baslik(), ISTATISTIK_KOD: '' } }), /istatistik kodu yok/i, 'kod yoksa ICE\'ye gitmeden durmalı');
  // Alış kodu (FIS_TIPI=0 tanımlı istatistik) satış fişine takılmışsa ICE'ye gitmeden durur.
  assert.throws(() => dovizGirdisi({ baslik: { ...baslik(), FIS_TIPI: 1, ISTATISTIK_KOD: '9249', ISTATISTIK_FIS_TIPI: 0 } }), /alış türüne ait; bu bir satış fişi/);
  // Tür bilgisi eşleşiyorsa geçer; tanım türü bilinmiyorsa (null) engel konmaz, ICE karar verir.
  assert.equal(dovizGirdisi({ baslik: { ...baslik(), FIS_TIPI: 1, ISTATISTIK_KOD: '10285', ISTATISTIK_FIS_TIPI: 1 } }).istatistikNo, '10285');
  assert.equal(dovizGirdisi({ baslik: { ...baslik(), FIS_TIPI: 1, ISTATISTIK_KOD: '10285', ISTATISTIK_FIS_TIPI: null } }).istatistikNo, '10285');
  assert.match(xmlDosyali, /<Odeme_Yapan_Hesap><Yetkili_Muessese_Dosya_Numarası>DSY-001<\/Yetkili_Muessese_Dosya_Numarası>/);
  assert.match(xmlDosyali, /<Odeme_Yapilan_Hesap><Yetkili_Muessese_Dosya_Numarası>DSY-001<\/Yetkili_Muessese_Dosya_Numarası>/);
  // Gönderici bilgisi verilmiş ama dosya no boşsa ICE'ye gitmeden durdurulur (ret kesin, numara yakılmasın).
  assert.throws(() => dovizGirdisi(kayit, { vknTckn: '', dosyaNo: '' }), /Dosya No/);
  // Gönderici bilgisi hiç verilmemişse (salt eşleme testleri) kontrol devreye girmez.
  assert.equal(dovizGirdisi(kayit).odeme.yetkiliMuesseseDosyaNo, '');
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
  // Ek_Bilgiler bloğu ICE'de koşulsuz okunduğu için her zaman gider; ama gümrük
  // tarihleri kaynak fişte yoksa uydurulmaz — tarih etiketleri hiç yazılmaz.
  assert.ok(xml.includes('<Ek_Bilgiler>'), 'Ek_Bilgiler bloğu her belgede gönderilmeli');
  for (const tarihAlani of ['Gumruk_Beyan_Tarihi', 'DBT_Tarihi', 'GMTY_Tarihi']) {
    assert.ok(!xml.includes(`<${tarihAlani}>`), `${tarihAlani} kaynakta yokken uydurulmamalı`);
  }
});

test('ICE koşulsuz okuduğu bloklar hep gönderilir; verisi olmayan blok gönderilmez', () => {
  const g = dovizGirdisi({ baslik: { ...baslik(), KOMISYON: null, BMV: null } });
  const xml = buildEDovizInnerXml('', g as EDovizGirdi);
  // ICE bu üç bloğu koşulsuz okuyor; gelmediğinde "Nesne başvurusu bir nesnenin
  // örneğine ayarlanmadı" hatası veriyor. Komisyonsuz alımda gerçek değer sıfırdır.
  assert.match(xml, /<Komisyon_Bilgileri><Komisyon_Tutar_Vergi_Haric>0</);
  assert.match(xml, /<Kiymetli_Maden_Bilgileri><Kiymetli_Maden_Adi><\/Kiymetli_Maden_Adi><Adet>0<\/Adet><\/Kiymetli_Maden_Bilgileri>/);
  // WSDL: Saf_Altin_Karsiligi → Vergi_Adi → Vergi_Kodu → Vergi_Orani. Vergi kodu
  // hiç gönderilmediğinde ICE null referans veriyor; alımda oran sıfır olsa da gider.
  assert.match(xml, /<Saf_Altin_Karsiligi>0<\/Saf_Altin_Karsiligi><Vergi_Adi>BSMV<\/Vergi_Adi><Vergi_Kodu>0021<\/Vergi_Kodu><Vergi_Orani>/);
  // Ödeme hesap blokları nesne olarak okunur; nakitte boş ama mevcut gider.
  assert.match(xml, /<Odeme_Yapan_Hesap><Yetkili_Muessese_Dosya_Numarası><\/Yetkili_Muessese_Dosya_Numarası><Sube_Kodu><\/Sube_Kodu><Odeme_Aciklamasi><\/Odeme_Aciklamasi><\/Odeme_Yapan_Hesap><Odeme_Yapilan_Hesap>/);
  assert.match(xml, /<BuyBack><Komisyon_Tutari>0<\/Komisyon_Tutari><\/BuyBack>/);
  // .NET tarafında XML'de hiç gelmeyen metin ve dizi alanları null olur ve
  // "Nesne başvurusu bir nesnenin örneğine ayarlanmadı" hatası verir. Bu yüzden
  // Notlar dizisi ile metin alanları boş da olsa etiket olarak yazılır.
  assert.match(xml, /<Notlar><\/Notlar>|<Notlar><string>/, 'Notlar etiketi her zaman yazılmalı');
  assert.match(xml, /<Musteri>.*<Adres><\/Adres>.*<Musteri_Turu>GERCEKKISI<\/Musteri_Turu><\/Musteri>/, 'boş metin alanı etiket olarak yazılmalı, tür dolu gitmeli');
  assert.match(xml, /<Ek_Bilgiler>.*<Ihracat_Yabanci_Sermaye>false<\/Ihracat_Yabanci_Sermaye>.*<\/Ek_Bilgiler>/);
  // Tarih alanları boş etiket olarak yazılamaz (ayrıştırılamaz); yoksa hiç gitmez.
  assert.ok(!xml.includes('<Gumruk_Beyan_Tarihi>'), 'kaynakta olmayan gümrük tarihi uydurulmamalı');
});

test('Hazırlama önizleme çağırır, gönderim yapmaz', async () => {
  const hazir = await kaynak.dovizHazirla(kimlik);
  assert.equal(hazir.belgeTuruAdi, 'e-Döviz');
  assert.equal(hazir.tutar, 34500);
  assert.deepEqual(cagrilar, ['preview_edoviz_basic']);
});

test('Durumu sıfır yeni döviz ETTN ile seçilir; gerçek gönderim kaydı kilitli kalır', () => {
  const row = { kaynak: 'DOVIZ', belgeTuru: 0, durum: 'GONDERILMEDI', eskiEttn: ettn, eskiDurum: 0 };
  assert.equal(kaynakSecim(row).secilebilir, true);
  for (const patch of [{ uuid: ettn }, { eskiDurum: 1 }, { eskiHata: 'Servis reddi' }, { durum: 'BELIRSIZ' }, { durum: 'GONDERILIYOR' }]) {
    assert.equal(kaynakSecim({ ...row, ...patch }).secilebilir, false);
  }
  assert.equal(kaynakSecim({ ...row, kaynak: 'FATURA' }).secilebilir, false);
  assert.notEqual(kaynakAnahtar({ ...kimlik, belgeNo: 'DVZ2026000000042' }), kaynakAnahtar({ ...kimlik, belgeNo: 'DVZ2026000000043' }));
});

test('Yeni ETTN korunur; ICE kontrolü ve önizleme sonrası bir kez gönderilir', async () => {
  kayit.baslik.ETTN = ettn; kayit.baslik.UUID = ettn; kayit.baslik.PayableAmountCurrency = 'TRY';
  const hazir = await kaynak.dovizHazirla(kimlik);
  assert.equal(hazir.paraBirimi, 'TRY');
  assert.deepEqual(cagrilar, ['Get_EDoviz_Status', 'preview_edoviz_basic']);
  await kaynak.dovizGonder(kimlik, hazir.parmakizi, 'offline');
  assert.equal(gidenKayitlari[0].uuid, ettn);
  assert.equal(gidenKayitlari[0].paraBirimi, 'TRY');
  assert.equal(cagrilar.filter(c => c === 'send_edoviz_basic').length, 1);
  assert.ok(cagrilar.includes('durum:GONDERILDI'));
  await assert.rejects(kaynak.dovizGonder(kimlik, hazir.parmakizi, 'offline'), /zaten mevcut/);
});

test('ICE kaydı, bozuk durum cevabı, hata metni ve bağlantı hatasında gönderim açılmaz', async () => {
  kayit.baslik.ETTN = ettn; kayit.baslik.UUID = ettn;
  for (const value of ['<Get_EDoviz_Status_Response><UUID>' + ettn + '</UUID><STATUS_DESCRIPTION>Gönderildi</STATUS_DESCRIPTION></Get_EDoviz_Status_Response>', '<unexpected/>', new Error('offline bağlantı hatası')]) {
    overrides.Get_EDoviz_Status = value;
    await assert.rejects(kaynak.dovizHazirla(kimlik));
  }
  delete overrides.Get_EDoviz_Status;
  overrides.preview_edoviz_basic = 'Vergi kimlik numarası geçersiz';
  await assert.rejects(kaynak.dovizHazirla(kimlik), /önizlemesi doğrulanamadı/);
  assert.equal(gidenKayitlari.length, 0);
});

test('Gönderim zaman aşımında sonuç belirsiz kalır ve tekrar gönderilmez', async () => {
  kayit.baslik.ETTN = ettn; kayit.baslik.UUID = ettn;
  const hazir = await kaynak.dovizHazirla(kimlik);
  overrides.send_edoviz_basic = new Error('offline zaman aşımı');
  await assert.rejects(kaynak.dovizGonder(kimlik, hazir.parmakizi, 'offline'), /belirsiz/);
  assert.ok(cagrilar.includes('durum:BELIRSIZ'));
  await assert.rejects(kaynak.dovizGonder(kimlik, hazir.parmakizi, 'offline'), /zaten mevcut/);
  assert.equal(cagrilar.filter(c => c === 'send_edoviz_basic').length, 1);
});

test('Giden kutusunda mevcut belge yeniden hazırlanmaz', async () => {
  gidenVar = true;
  await assert.rejects(kaynak.dovizHazirla(kimlik), /zaten mevcut/);
});

test('Durum sorgusu: ICE belgeyi tanıyorsa askıdaki giden kaydı GONDERILDI olur', async () => {
  // Gönderim ICE'ye ulaşmış ama son adım (durum geçişi) başarısız olmuşsa kayıt
  // GONDERILIYOR'da takılır. Durum sorgusunda ICE'nin belgeyi tanıması sonucun
  // kendisidir: giden kaydı ve kaynak fiş GONDERILDI'ye çekilir.
  let gecisler: string[] = [];
  (repo as any).getGiden = async () => ({ uuid: ettn, belgeTuru: 'EDoviz', gonderimDurumu: 'GONDERILIYOR', KAYNAK_FIS_ID: '99:501:1:DVZ2026000000042' });
  (repo as any).earsivDurumGecir = async (_u: string, b: string, d: string, _s: any, _c: any, tur: string) => { gecisler.push(`${b}>${d}:${tur}`); };
  overrides['Get_EDoviz_Status'] = `<Get_EDoviz_Status_Response><isSuccecss>true</isSuccecss><UUID>${ettn}</UUID><STATUS>GONDERILDI</STATUS></Get_EDoviz_Status_Response>`;
  const sonuc = await kaynak.dovizDurum(ettn, 'test');
  assert.equal(String(sonuc.STATUS), 'GONDERILDI');
  assert.deepEqual(gecisler, ['GONDERILIYOR>GONDERILDI:EDoviz'], 'giden kaydı e-Döviz türüyle GONDERILDI olmalı');
  assert.deepEqual(durumlar.map(d => d.durum), ['GONDERILDI'], 'kaynak fiş de kapatılmalı');

  // ICE tanımıyorsa (yalnız UUID yankısı, isSuccecss=false) belge ICE'de oluşmamıştır.
  // Gönderim 5 dakikadan eskiyse kayıt HATA'ya çekilir ve kaynak yeniden gönderilebilir olur.
  gecisler = []; durumlar = [];
  overrides['Get_EDoviz_Status'] = `<Get_EDoviz_Status_Response><isSuccecss>false</isSuccecss><UUID>${ettn}</UUID></Get_EDoviz_Status_Response>`;
  (repo as any).getGiden = async () => ({ uuid: ettn, belgeTuru: 'EDoviz', gonderimDurumu: 'GONDERILIYOR', KAYNAK_FIS_ID: '99:501:1:DVZ2026000000042', GONDERIM_TARIHI: new Date(Date.now() - 10 * 60 * 1000) });
  const eski = await kaynak.dovizDurum(ettn, 'test');
  assert.equal(eski.STATUS, 'BULUNAMADI');
  assert.deepEqual(gecisler, ['GONDERILIYOR>HATA:EDoviz'], 'eski ve tanınmayan gönderim HATA olmalı');
  assert.deepEqual(durumlar.map(d => d.durum), ['HATA'], 'kaynak fiş yeniden gönderilebilir olmalı');

  // Taze gönderimde (5 dk içinde) ICE gecikmiş olabilir: kayda dokunulmaz, ekrana "bekliyor" döner.
  gecisler = []; durumlar = [];
  (repo as any).getGiden = async () => ({ uuid: ettn, belgeTuru: 'EDoviz', gonderimDurumu: 'GONDERILIYOR', GONDERIM_TARIHI: new Date() });
  const taze = await kaynak.dovizDurum(ettn, 'test');
  assert.equal(taze.STATUS, 'BEKLIYOR');
  assert.deepEqual(gecisler, []);
  assert.deepEqual(durumlar, []);

  // Zaten kesinleşmiş kayıt (GONDERILDI) yeniden yazılmaz.
  (repo as any).getGiden = async () => ({ uuid: ettn, belgeTuru: 'EDoviz', gonderimDurumu: 'GONDERILDI' });
  overrides['Get_EDoviz_Status'] = `<Get_EDoviz_Status_Response><isSuccecss>true</isSuccecss><UUID>${ettn}</UUID></Get_EDoviz_Status_Response>`;
  await kaynak.dovizDurum(ettn, 'test');
  assert.deepEqual(gecisler, []);
});
