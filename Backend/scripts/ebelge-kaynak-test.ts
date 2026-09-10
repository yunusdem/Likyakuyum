/** Çevrimdışı regresyon: kaynak (kesilmiş fatura) eşleme, kısmi hata, mükellef sorgu hatası, tekrar gönderim. */
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import sql from 'mssql';
import { EbelgeKaynakRepository as kaynakRepo, kaynakAnahtar, KaynakKimlik } from '../src/models/ebelgeKaynak.repository.js';
import { EbelgeSqlRepository as repo } from '../src/models/ebelgeSql.repository.js';
import { EbelgeService as service } from '../src/services/ebelge.service.js';
import { EbelgeKaynakService as kaynak, kaynakFaturaGirdisi, kaynakParmakizi } from '../src/services/ebelgeKaynak.service.js';

// Gerçek SQL ve HTTP erişimini test başarısızlığına çevir.
(sql.ConnectionPool.prototype as any).connect = () => { throw new Error('TEST: gerçek SQL yasak'); };
(kaynakRepo as any).pool = () => { throw new Error('TEST: taklit edilmemiş kaynak repository çağrısı'); };
globalThis.fetch = (async () => { throw new Error('TEST: gerçek ICE çağrısı yasak'); }) as any;

const kimlik: KaynakKimlik = { evrakTuru: 0, belgeId: 1001, belgeTuru: 0 };
const baslik = () => ({
  EVRAK_TURU: 0, BELGE_ID: 1001, BELGE_TURU: 0, BELGE_NO: 'ABC2026000000001', TARIH: '2026-01-02T00:00:00.000Z',
  UNVAN: 'Ahmet Yılmaz', MIKTAR: 240, PARA_KODU: 'TL', ETTN: '', E_BELGE_DURUMU: 0, E_BELGE_HATA_ACIKLAMASI: '',
  VERGI_KIMLIK_NO: '12345678901', VERGI_DAIRESI_ADI: 'Muratpaşa', IL_ADI: 'Antalya', ILCE_ADI: 'Muratpaşa',
  ADRES: 'Test cad. 1', E_FATURA_KDV_MUAFIYET_KODU: '301', E_FATURA_KDV_MUAFIYET_ADI: 'Külçe altın teslimi',
});
const satirlar = () => [{ SATIR_NO: 1, PARA_ADI: 'Bilezik', BIRIM_ADI: 'GR', MIKTAR: 2, TUTAR: 200, KDV_ORANI: 20, KDV: 40 }];

let kaynakKayit: { baslik: any; satirlar: any[] };
let durumlar: { durum: string; mesaj: string }[];
let rezerve: string[];
let gidenVar: boolean;
let mukellefMi: boolean | Error;
let gonderimHatasi: Error | null;
let gonderilenSenaryo: string[];

beforeEach(() => {
  kaynakKayit = { baslik: baslik(), satirlar: satirlar() };
  durumlar = []; rezerve = []; gidenVar = false; mukellefMi = true; gonderimHatasi = null; gonderilenSenaryo = [];
  (kaynakRepo as any).detay = async () => JSON.parse(JSON.stringify(kaynakKayit));
  (kaynakRepo as any).reserve = async (k: KaynakKimlik) => {
    if (rezerve.includes(kaynakAnahtar(k))) throw new Error('Kaynak belge daha önce işleme alınmış; durumunu kontrol edin.');
    rezerve.push(kaynakAnahtar(k));
  };
  (kaynakRepo as any).sonuc = async (_k: KaynakKimlik, durum: string, mesaj: string) => { durumlar.push({ durum, mesaj }); };
  (repo as any).gidenBelgeNoVarMi = async () => gidenVar;
  (service as any).mukellefSorgula = async () => { if (mukellefMi instanceof Error) throw mukellefMi; return { mukellefMi }; };
  (service as any).dogrulaGidenBelge = async (girdi: any) => ({
    semaGecerli: true, schematronGecerli: true, mesaj: '',
    ozet: { odenecekTutar: girdi.satirlar[0].birimFiyat * girdi.satirlar[0].miktar * 1.2 },
  });
  (service as any).faturaGonder = async (g: any) => { gonderilenSenaryo.push('efatura:' + g.senaryo); if (gonderimHatasi) throw gonderimHatasi; return { mesaj: 'Gönderildi' }; };
  (service as any).earsivGonder = async (g: any) => { gonderilenSenaryo.push('earsiv:' + g.senaryo); if (gonderimHatasi) throw gonderimHatasi; return { mesaj: 'Gönderildi' }; };
});

test('Kaynak başlık ve satırları UBL girdisine eşlenir', () => {
  const g = kaynakFaturaGirdisi(kaynakKayit);
  assert.equal(g.belgeNo, 'ABC2026000000001');
  assert.equal(g.tarih, '2026-01-02');
  assert.equal(g.alici.vknTckn, '12345678901');
  assert.equal(g.alici.ad, 'Ahmet');
  assert.equal(g.alici.soyad, 'Yılmaz');
  assert.equal(g.satirlar[0].birimFiyat, 100);
  assert.equal(g.satirlar[0].birimKodu, 'GR');
});

test('Fatura dışı belge türü, eski ETTN ve eski hata kaydı gönderimi durdurur', () => {
  assert.throws(() => kaynakFaturaGirdisi({ ...kaynakKayit, baslik: { ...baslik(), BELGE_TURU: 2 } }), /e-Gider veya e-İrsaliye/);
  assert.throws(() => kaynakFaturaGirdisi({ ...kaynakKayit, baslik: { ...baslik(), ETTN: 'eski-ettn' } }), /ETTN/);
  assert.throws(() => kaynakFaturaGirdisi({ ...kaynakKayit, baslik: { ...baslik(), E_BELGE_DURUMU: 1 } }), /ETTN|işlem/);
  assert.throws(() => kaynakFaturaGirdisi({ ...kaynakKayit, baslik: { ...baslik(), E_BELGE_HATA_ACIKLAMASI: 'red' } }), /hata kaydı/);
});

test('Tutar, KDV, belge no, döviz ve birim uyumsuzlukları reddedilir', () => {
  const ile = (b: any = {}, s: any = {}) => ({ baslik: { ...baslik(), ...b }, satirlar: [{ ...satirlar()[0], ...s }] });
  assert.throws(() => kaynakFaturaGirdisi(ile({}, { KDV: 20 })), /uyuşmuyor/);
  assert.throws(() => kaynakFaturaGirdisi(ile({ MIKTAR: 500 })), /toplam/);
  assert.throws(() => kaynakFaturaGirdisi(ile({ BELGE_NO: 'AB2026000000001' })), /numarası/);
  assert.throws(() => kaynakFaturaGirdisi(ile({ PARA_KODU: 'USD' })), /dövizli/);
  assert.throws(() => kaynakFaturaGirdisi(ile({}, { BIRIM_ADI: '' })), /birim/);
  assert.throws(() => kaynakFaturaGirdisi(ile({}, { MIKTAR: null })), /miktar/);
  assert.throws(() => kaynakFaturaGirdisi({ baslik: baslik(), satirlar: [] }), /satırları/);
});

test('KDV sıfırsa istisna kodu kaynak tanımından alınır', () => {
  const g = kaynakFaturaGirdisi({ baslik: { ...baslik(), MIKTAR: 200 }, satirlar: [{ ...satirlar()[0], KDV_ORANI: 0, KDV: 0 }] });
  assert.equal(g.faturaTipi, 'ISTISNA');
  assert.equal((g.satirlar[0] as any).istisnaKodu, '301');
});

test('Mükellefe e-Fatura, mükellef olmayana e-Arşiv seçilir', async () => {
  assert.equal((await kaynak.hazirla(kimlik, 'a')).belgeTuruAdi, 'e-Fatura');
  mukellefMi = false;
  const hazir = await kaynak.hazirla(kimlik, 'a');
  assert.equal(hazir.belgeTuruAdi, 'e-Arşiv');
  assert.equal(hazir.senaryo, 'EARSIVFATURA');
  await kaynak.gonder(kimlik, hazir.parmakizi, hazir.senaryo, 'a');
  assert.deepEqual(gonderilenSenaryo, ['earsiv:EARSIVFATURA']);
  assert.deepEqual(durumlar, [{ durum: 'GONDERILDI', mesaj: 'Gönderildi' }]);
});

test('Mükellef sorgu hatası hazırlamayı ve gönderimi durdurur; gönderim yapılmaz', async () => {
  mukellefMi = new Error('ICE mükellef sorgusu yanıt vermedi');
  await assert.rejects(kaynak.hazirla(kimlik, 'a'), /mükellef sorgusu/);
  mukellefMi = true;
  const hazir = await kaynak.hazirla(kimlik, 'a');
  mukellefMi = new Error('ICE mükellef sorgusu yanıt vermedi');
  await assert.rejects(kaynak.gonder(kimlik, hazir.parmakizi, hazir.senaryo, 'a'), /mükellef sorgusu/);
  assert.deepEqual(gonderilenSenaryo, []);
  assert.deepEqual(durumlar.map(d => d.durum), ['HATA']);
});

test('Hazırlama sonrası kaynak değişirse veya mükellefiyet değişirse gönderim durur', async () => {
  const hazir = await kaynak.hazirla(kimlik, 'a');
  kaynakKayit.satirlar[0].TUTAR = 300;
  await assert.rejects(kaynak.gonder(kimlik, hazir.parmakizi, hazir.senaryo, 'a'), /değişmiş/);
  kaynakKayit = { baslik: baslik(), satirlar: satirlar() };
  rezerve = [];
  mukellefMi = false;
  await assert.rejects(kaynak.gonder(kimlik, hazir.parmakizi, hazir.senaryo, 'a'), /mükellefiyeti değişmiş/);
  assert.deepEqual(gonderilenSenaryo, []);
});

test('Aynı kaynak iki kez gönderilemez; giden kutusundaki belge yeniden gönderilmez', async () => {
  const hazir = await kaynak.hazirla(kimlik, 'a');
  await kaynak.gonder(kimlik, hazir.parmakizi, hazir.senaryo, 'a');
  await assert.rejects(kaynak.gonder(kimlik, hazir.parmakizi, hazir.senaryo, 'a'), /işleme alınmış/);
  gidenVar = true;
  await assert.rejects(kaynak.gonder(kimlik, hazir.parmakizi, hazir.senaryo, 'a'), /zaten mevcut/);
  await assert.rejects(kaynak.hazirla(kimlik, 'a'), /zaten mevcut/);
  assert.equal(gonderilenSenaryo.length, 1);
});

test('Gönderim hatasında giden kaydı varsa KONTROL_GEREKLI, yoksa HATA yazılır', async () => {
  const hazir = await kaynak.hazirla(kimlik, 'a');
  gonderimHatasi = new Error('ICE zaman aşımı');
  await assert.rejects(kaynak.gonder(kimlik, hazir.parmakizi, hazir.senaryo, 'a'), /zaman aşımı/);
  assert.deepEqual(durumlar, [{ durum: 'HATA', mesaj: 'ICE zaman aşımı' }]);
  durumlar = []; rezerve = []; gonderilenSenaryo = [];
  // ICE'ye ulaşıldıktan sonra giden kaydı oluşmuş senaryo: yeniden gönderim yerine kontrol istenir.
  (repo as any).gidenBelgeNoVarMi = async () => gonderilenSenaryo.length > 0;
  await assert.rejects(kaynak.gonder(kimlik, hazir.parmakizi, hazir.senaryo, 'a'));
  assert.deepEqual(durumlar.map(d => d.durum), ['KONTROL_GEREKLI']);
});

test('Parmak izi kaynak içeriğine bağlıdır', () => {
  const a = kaynakParmakizi(kaynakKayit);
  assert.equal(a, kaynakParmakizi(JSON.parse(JSON.stringify(kaynakKayit))));
  assert.notEqual(a, kaynakParmakizi({ ...kaynakKayit, satirlar: [{ ...satirlar()[0], TUTAR: 201 }] }));
});
