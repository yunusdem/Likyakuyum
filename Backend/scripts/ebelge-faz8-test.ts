/** Çevrimdışı regresyon: gerçek fetch ve SQL bağlantısı kullanılmaz. */
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { XMLParser } from 'fast-xml-parser';
import sql from 'mssql';
import { EbelgeService as service } from '../src/services/ebelge.service.js';
import { EbelgeSqlRepository as repo } from '../src/models/ebelgeSql.repository.js';
import { buildInvoiceXml } from '../src/services/ice/ubl/invoiceBuilder.js';
import { ebelgeTarihSchema, ebelgeArsivSenkronizeSchema, ebelgeArsivStatuSchema } from '../src/schemas/ebelge.schema.js';
import { previewInvoice, getEArchive } from '../src/services/ice/ice.earsiv.js';
import { clearSession } from '../src/services/ice/ice.session.js';

const config: any = { servisUrl: 'https://integration.iceteknoloji.com.tr/integration.asmx',
  kullaniciAdi: 'offline-test', sifre: 'offline', uygulamaAdi: 'offline', uygulamaSurum: '1', dbName: 'offline' };
const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false });
const uuid = '11111111-1111-4111-8111-111111111111';
const input = () => ({ uuid, belgeNo: 'ABC2026000000001', tarih: '2026-01-01', saat: '10:00:00',
  senaryo: 'EARSIVFATURA' as const, faturaTipi: 'SATIS' as const, paraBirimi: 'TRY',
  gonderici: { vknTckn: '1234567890', unvan: 'Test satıcı' },
  alici: { vknTckn: '9876543210', unvan: 'Test alıcı' },
  satirlar: [{ ad: 'Test ürün', aciklama: 'A & B', miktar: 2, birimFiyat: 100, kdvOrani: 20 }] });
let rows: Map<string, any>;
let calls: { method: string; body: string }[];
let overrides: Record<string, string | Error>;
let failInsert = false;
let failFinalize = false;
let failLog = false;
let archive: Map<string, any>;
const successRow = (extra = '') => `<success>true</success><response_code>0</response_code><invoiceType_responseTypes><invoiceType_responseType><success>true</success><shema_is_validate>true</shema_is_validate><schematron_is_validate>true</schematron_is_validate><ettn>${uuid}</ettn><ID>ABC2026000000001</ID>${extra}</invoiceType_responseType></invoiceType_responseTypes>`;

// Her gerçek DB girişini test başarısızlığına çevir.
(sql.ConnectionPool.prototype as any).connect = () => { throw new Error('TEST: gerçek SQL yasak'); };
(repo as any).getPool = () => { throw new Error('TEST: taklit edilmemiş repository çağrısı'); };
globalThis.fetch = async (_url, init) => {
  const method = String((init?.headers as any).SOAPAction).split('/').pop()!.replaceAll('"', '');
  const body = String(init?.body);
  calls.push({ method, body });
  if (method === 'send_earsiv') assert.equal(rows.get(uuid)?.gonderimDurumu, 'GONDERILIYOR', 'ICE öncesi yer tutma');
  if (method === 'send_earsiv_iptal') assert.equal(rows.get(uuid)?.gonderimDurumu, 'IPTAL_EDILIYOR');
  const defaults: Record<string, string> = {
    Login: '<isSuccecss>true</isSuccecss><Login_Request_Header><Session_ID>offline</Session_ID><IP_Number>127.0.0.1</IP_Number><Security_Key>offline</Security_Key></Login_Request_Header>',
    invoice_check_validate: '<shema_validate>true</shema_validate><shematron_validate>true</shematron_validate>',
    getUserList_EFatura: '<success>true</success>',
    Get_Son_Belge_ID: '<Son_Belge_ID>0</Son_Belge_ID>',
    send_earsiv: successRow(), send_earsiv_iptal: '<success>true</success>',
    GetInvoice_Rapor_Statu: '<Earsiv_Rapor_Status><Earsiv_Rapor_Statu><ETTN>' + uuid + '</ETTN><Raporlandi>false</Raporlandi></Earsiv_Rapor_Statu></Earsiv_Rapor_Status>',
    GetInvoice_EMail_Statu: '<email_status/>',
    preview_invoice: '<success>true</success><response_message>' + Buffer.from('%PDF-1.4\nTEST').toString('base64') + '</response_message>',
    GetEArchive: `<EArchive><UUID>${uuid}</UUID><ID>ABC2026000000001</ID><STATUS_CODE>777</STATUS_CODE><STATUS_DESCRIPTION>Tanımsız örnek durum</STATUS_DESCRIPTION><HEADER><CUSTOMER>9876543210</CUSTOMER><CUSTOMER_TITLE>Alıcı</CUSTOMER_TITLE><SUPPLIER>1234567890</SUPPLIER><ISSUE_DATE>2026-01-01T12:00:00</ISSUE_DATE><PAYABLE_AMOUNT currencyID="TRY">240.00</PAYABLE_AMOUNT><PROFILEID>EARSIVFATURA</PROFILEID></HEADER></EArchive>`,
    Set_EArchive_Status: 'true',
  };
  const value = overrides[method] ?? defaults[method];
  if (value instanceof Error) throw value;
  assert.notEqual(value, undefined, `Beklenmeyen ICE operasyonu: ${method}`);
  return new Response(`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method}Response><${method}Result>${value}</${method}Result></${method}Response></soap:Body></soap:Envelope>`);
};

beforeEach(() => {
  clearSession(config); rows = new Map(); calls = []; overrides = {};
  failInsert = false; failFinalize = false; failLog = false;
  archive = new Map();
  repo.upsertEarsivArsiv = async (r) => { archive.set(r.uuid, { ...archive.get(r.uuid), ...r }); };
  repo.earsivArsivVarMi = async (id) => archive.has(id);
  repo.setEarsivArsivIsaret = async (id, statu) => { archive.get(id).isaret = statu; };
  (service as any).goncericiTamamla = async () => input().gonderici;
  repo.getConnectionConfig = async () => config;
  repo.gidenBelgeNoVarMi = async (no) => [...rows.values()].some((r) => r.belgeNo === no);
  repo.insertGiden = async (row) => {
    if (failInsert) throw new Error('disk/SQL hatası');
    if ([...rows.values()].some((r) => r.belgeNo === row.belgeNo)) throw new Error('UNIQUE çakışması');
    rows.set(row.uuid, { ...row, DUZENLEME_TARIHI: row.duzenlemeTarihi, ALICI_VKN: row.aliciVkn, TUTAR: row.tutar });
  };
  repo.getGiden = async (id) => rows.get(id) || null;
  repo.earsivDurumGecir = async (id, expected, next, result) => {
    if (failFinalize && next === 'GONDERILDI') throw new Error('SQL sonucu kaydedilemedi');
    const row = rows.get(id);
    assert.equal(row?.gonderimDurumu, expected, 'Atomik karşılaştırmalı durum geçişi');
    row.gonderimDurumu = next; row.sonuc = result;
  };
  repo.writeLog = async () => { if (failLog) throw new Error('log yazılamadı'); };
});

test('Başarılı gönderim: kalıcı kayıt, aynı ETTN ve WSDL zarfı', async () => {
  const result = await service.earsivGonder(input(), 'test');
  assert.equal(result.ettn, uuid); assert.equal(rows.get(uuid).gonderimDurumu, 'GONDERILDI');
  const request = parser.parse(calls.find((c) => c.method === 'send_earsiv')!.body).Envelope.Body.send_earsiv.sendEArsivRequest;
  assert.deepEqual(Object.keys(request), ['Login_Request_Header', 'earsiv_invoices']);
  const xml = Buffer.from(request.earsiv_invoices.base64Binary.earsiv_invoice, 'base64').toString();
  assert.equal(parser.parse(xml).Invoice.UUID, uuid);
  assert.equal(xml, rows.get(uuid).xmlIcerik);
});
test('Aynı numaralı eşzamanlı isteklerden yalnızca biri gönderir', async () => {
  const results = await Promise.allSettled([service.earsivGonder(input(), 'a'),
    service.earsivGonder({ ...input(), uuid: '22222222-2222-4222-8222-222222222222', tarih: '2026-01-02' }, 'b')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(calls.filter((c) => c.method === 'send_earsiv').length, 1);
});
test('SQL yer tutma hatasında ICE gönderimi yapılmaz', async () => {
  failInsert = true; await assert.rejects(service.earsivGonder(input(), 'a'));
  assert.equal(calls.filter((c) => c.method === 'send_earsiv').length, 0);
});
test('Bağlantı kopması BELIRSIZ bırakır, tekrar göndermez', async () => {
  overrides.send_earsiv = new Error('offline simulated timeout');
  await assert.rejects(service.earsivGonder(input(), 'a'), /belirsiz/);
  assert.equal(rows.get(uuid).gonderimDurumu, 'BELIRSIZ');
  await assert.rejects(service.earsivGonder(input(), 'a'));
  assert.equal(calls.filter((c) => c.method === 'send_earsiv').length, 1);
});
test('ICE başarılı fakat SQL sonuç kaydı başarısız: rezervasyon korunur', async () => {
  failFinalize = true; await assert.rejects(service.earsivGonder(input(), 'a'));
  assert.equal(rows.get(uuid).gonderimDurumu, 'GONDERILIYOR');
  await assert.rejects(service.earsivGonder(input(), 'a'));
  assert.equal(calls.filter((c) => c.method === 'send_earsiv').length, 1);
});
test('Log hatası kesinleşmiş gönderim kaydını kaybettirmez', async () => {
  failLog = true; await assert.rejects(service.earsivGonder(input(), 'a'));
  assert.equal(rows.get(uuid).gonderimDurumu, 'GONDERILDI');
});
test('Üst yanıt başarılı, satır başarısız ise GONDERILDI olmaz', async () => {
  overrides.send_earsiv = successRow().replace('<invoiceType_responseType><success>true', '<invoiceType_responseType><success>false');
  await assert.rejects(service.earsivGonder(input(), 'a'));
  assert.equal(rows.get(uuid).gonderimDurumu, 'HATA');
});
test('Eksik veya farklı ETTN içeren yanıt BELIRSIZ kalır', async () => {
  overrides.send_earsiv = successRow().replace(uuid, 'başka-ettn');
  await assert.rejects(service.earsivGonder(input(), 'a'));
  assert.equal(rows.get(uuid).gonderimDurumu, 'BELIRSIZ');
});
test('Doğrulama geçmezse kayıt ve gönderim yok', async () => {
  overrides.invoice_check_validate = '<shema_validate>false</shema_validate><shematron_validate>true</shematron_validate>';
  await assert.rejects(service.earsivGonder(input(), 'a'));
  assert.equal(rows.size, 0); assert.ok(!calls.some((c) => c.method === 'send_earsiv'));
});
test('Mükellef sorgu hatası mükellef değil sayılmaz', async () => {
  overrides.getUserList_EFatura = '<success>false</success>';
  await assert.rejects(service.earsivGonder(input(), 'a')); assert.equal(rows.size, 0);
});
test('e-Fatura mükellefine e-Arşiv gönderilmez', async () => {
  overrides.getUserList_EFatura = '<success>true</success><GIB_User_List><GIB_User><Identifier>9876543210</Identifier></GIB_User></GIB_User_List>';
  await assert.rejects(service.earsivGonder(input(), 'a'), /mükellefi/); assert.equal(rows.size, 0);
});
test('ICE son numarasıyla çakışma engellenir', async () => {
  overrides.Get_Son_Belge_ID = '<Son_Belge_ID>1</Son_Belge_ID>';
  await assert.rejects(service.earsivGonder(input(), 'a')); assert.equal(rows.size, 0);
});
test('Eksik özel vergi senaryolarında gerçek gönderim yapılmaz', async () => {
  await assert.rejects(service.earsivGonder({ ...input(), faturaTipi: 'OZELMATRAH' }, 'a'));
  assert.equal(calls.length, 0);
});
test('İptal eşzamanlı isteklerde bir kez yapılır; istenen tarih saklanır', async () => {
  await service.earsivGonder(input(), 'a');
  const date = new Date('2026-01-02');
  await Promise.allSettled([service.earsivIptal(uuid, date, 'a'), service.earsivIptal(uuid, date, 'b')]);
  assert.equal(calls.filter((c) => c.method === 'send_earsiv_iptal').length, 1);
  assert.equal(rows.get(uuid).gonderimDurumu, 'IPTAL');
  assert.equal(rows.get(uuid).sonuc.iptalTarihi, date);
});
test('İptalde zaman aşımı tekrar iptale izin vermez', async () => {
  await service.earsivGonder(input(), 'a'); overrides.send_earsiv_iptal = new Error('offline simulated timeout');
  await assert.rejects(service.earsivIptal(uuid, new Date('2026-01-02'), 'a'));
  assert.equal(rows.get(uuid).gonderimDurumu, 'IPTAL_BELIRSIZ');
  await assert.rejects(service.earsivIptal(uuid, new Date('2026-01-02'), 'a'));
  assert.equal(calls.filter((c) => c.method === 'send_earsiv_iptal').length, 1);
});
test('Durum sorgusu kısmi hatayı açıklar; iki hata başarı sayılmaz', async () => {
  await service.earsivGonder(input(), 'a'); overrides.GetInvoice_EMail_Statu = new Error('offline mail hata');
  const result = await service.earsivDurum([uuid], 'a');
  assert.equal(result.hatalar.length, 1); assert.equal(result.rapor.length, 1);
  overrides.GetInvoice_Rapor_Statu = new Error('offline rapor hata');
  await assert.rejects(service.earsivDurum([uuid], 'a'));
});
test('PDF başarısız/bozuk yanıtları reddeder', async () => {
  assert.ok((await previewInvoice(config, { vknTckn: '9876543210', faturaNo: input().belgeNo, duzenlenmeTarihi: new Date(), odenecekTutar: 240 })).length);
  for (const xml of ['<success>false</success><response_message>YWJj</response_message>', '<success>true</success><response_message>YWJj</response_message>']) {
    overrides.preview_invoice = xml;
    await assert.rejects(previewInvoice(config, { vknTckn: '9876543210', faturaNo: input().belgeNo, duzenlenmeTarihi: new Date(), odenecekTutar: 240 }));
  }
});
test('UBL açıklama alanı OASIS sequence sırasında; tarihler gerçek takvim tarihi', () => {
  const { xml, ozet } = buildInvoiceXml(input());
  assert.ok(xml.indexOf('<cbc:Description>') < xml.indexOf('<cbc:Name>Test ürün'));
  assert.equal(ozet.odenecekTutar, 240);
  assert.equal(ebelgeTarihSchema.safeParse('2026-02-30').success, false);
  assert.equal(ebelgeTarihSchema.safeParse('2028-02-29').success, true);
  assert.throws(() => buildInvoiceXml({ ...input(), tarih: '2025-01-01' }));
});
test('Tablo/indeks kurulum hatası yutulmaz; sonraki çağrı tekrar dener', async () => {
  let attempts = 0;
  const pool: any = { config: { server: 'offline-index', database: 'offline-index' },
    request: () => ({ batch: async () => { attempts++; throw new Error('Tekrar eden belge numarası'); } }) };
  await assert.rejects(repo.ensureTablesExist(pool), /Tekrar eden/);
  await assert.rejects(repo.ensureTablesExist(pool), /Tekrar eden/);
  assert.equal(attempts, 2);
});

const archiveFilter = { baslangic: new Date('2026-01-01T00:00:00+03:00'), bitis: new Date('2026-01-31T23:59:59+03:00'), limit: 250 };
test('Arşiv senkronizasyonu WSDL sırasını kullanır, giden durumunu değiştirmez', async () => {
  rows.set(uuid, { gonderimDurumu: 'BELIRSIZ' });
  const result = await service.senkronizeEarsivArsiv(archiveFilter, 'a');
  assert.equal(result.yazilan, 1); assert.equal(rows.get(uuid).gonderimDurumu, 'BELIRSIZ');
  assert.equal(archive.get(uuid).iceStatuKodu, '777'); assert.equal(archive.get(uuid).tutar, 240);
  const request = parser.parse(calls.find((c) => c.method === 'GetEArchive')!.body).Envelope.Body.GetEArchive.GetEArchiveRequest;
  assert.deepEqual(Object.keys(request.EArchive_SEARCH_KEY), ['LIMIT', 'LIMITSpecified', 'START_DATE', 'START_DATESpecified', 'END_DATE', 'END_DATESpecified', 'READ_INCLUDED', 'READ_INCLUDEDSpecified', 'PROCESSED_INCLUDED', 'PROCESSED_INCLUDEDSpecified']);
  assert.equal(request.HEADER_ONLY, 'true');
  await service.senkronizeEarsivArsiv(archiveFilter, 'a'); assert.equal(archive.size, 1);
  assert.ok(!calls.some((c) => c.method.startsWith('send_')));
});
test('Arşiv sınırı dolunca tam senkronizasyon iddia edilmez', async () => {
  const r = await service.senkronizeEarsivArsiv({ ...archiveFilter, limit: 1 }, 'a');
  assert.equal(r.siniraUlasildi, true); assert.ok(r.uyari);
});
test('Eksik başlık atlanır, sahte sıfır tutarlı kayıt oluşmaz', async () => {
  overrides.GetEArchive = `<EArchive><UUID>${uuid}</UUID><ID>ABC2026000000001</ID></EArchive>`;
  const r = await service.senkronizeEarsivArsiv(archiveFilter, 'a');
  assert.equal(r.atlanan, 1); assert.equal(archive.size, 0);
});
test('Boş arşiv geçerlidir; bozuk SOAP sonucu reddedilir', async () => {
  overrides.GetEArchive = ''; assert.deepEqual(await getEArchive(config, archiveFilter), []);
  overrides.GetEArchive = 'bozuk'; await assert.rejects(getEArchive(config, archiveFilter));
});
test('Arşiv işareti sadece ICE kabul ettikten sonra kaydedilir', async () => {
  await service.senkronizeEarsivArsiv(archiveFilter, 'a');
  overrides.Set_EArchive_Status = 'false';
  await assert.rejects(service.earsivArsivIsaretle(uuid, 'Okundu', 'a'));
  assert.equal(archive.get(uuid).isaret, undefined);
  overrides.Set_EArchive_Status = 'true'; await service.earsivArsivIsaretle(uuid, 'Okundu', 'a');
  assert.equal(archive.get(uuid).isaret, 'Okundu');
  await service.senkronizeEarsivArsiv(archiveFilter, 'a'); assert.equal(archive.get(uuid).isaret, 'Okundu');
});
test('Arşiv dışında UUID işaretlenemez; mali durum kelimeleri kabul edilmez', async () => {
  await assert.rejects(service.earsivArsivIsaretle(uuid, 'Okundu', 'a'));
  assert.equal(calls.length, 0);
  assert.equal(ebelgeArsivStatuSchema.safeParse({ uuid, statu: 'IPTAL' }).success, false);
  assert.equal(ebelgeArsivSenkronizeSchema.safeParse({ baslangic: '2026-02-30', bitis: '2026-03-01' }).success, false);
  assert.equal(ebelgeArsivSenkronizeSchema.safeParse({ baslangic: '2026-03-02', bitis: '2026-03-01' }).success, false);
});
