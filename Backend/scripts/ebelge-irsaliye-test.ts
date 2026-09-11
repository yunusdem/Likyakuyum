/**
 * e-İrsaliye üreteci — çevrimdışı regresyon.
 *
 * Yapı, ICE paketindeki UBL-TR şema sınıfından doğrulandı:
 * ICE_INTAGRATION_v1.0.3/.../UBL/UBLTR-Delivery-2_1.cs
 *
 * Gerçek ICE veya SQL bağlantısı kullanılmaz.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { XMLParser } from "fast-xml-parser";
import { ebelgeIrsaliyeSchema } from "../src/schemas/ebelge.schema.js";

import {
  buildDespatchAdviceXml,
  type IrsaliyeGirdi,
} from "../src/services/ice/ubl/despatchAdviceBuilder.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,
});

const temel = (): IrsaliyeGirdi => ({
  belgeNo: "ABC2026000000001",
  uuid: "22222222-2222-4222-8222-222222222222",
  tarih: "2026-02-10",
  saat: "09:30:00",
  irsaliyeTipi: "SEVK",
  gonderici: { vknTckn: "1234567890", unvan: "Likya Kuyum A.Ş.", il: "Antalya", ilce: "Muratpaşa" },
  alici: { vknTckn: "9876543210", unvan: "Alıcı Kuyumculuk Ltd.", il: "İstanbul", ilce: "Fatih" },
  satirlar: [
    { ad: "22 Ayar Bilezik", miktar: 5, birimKodu: "GRM", stokKodu: "BLZ-22", marka: "Likya" },
  ],
  sevkiyat: { sevkTarihi: "2026-02-10", sevkSaati: "10:00:00", plaka: "07 ABC 123", teslimatAdresi: { postaKodu: "34000" } },
});

/* ---------------------------------------------------------------- yapı */

test("kök öğe ve sabitler UBL-TR e-İrsaliye biçiminde", () => {
  const { xml } = buildDespatchAdviceXml(temel());
  const o = parser.parse(xml).DespatchAdvice;

  assert.ok(o, "kök öğe DespatchAdvice olmalı");
  assert.equal(o.UBLVersionID, "2.1");
  assert.equal(o.CustomizationID, "TR1.2.1");
  assert.equal(o.ProfileID, "TEMELIRSALIYE");
  assert.equal(o.DespatchAdviceTypeCode, "SEVK");
  assert.equal(o.LineCountNumeric, "1");
  assert.ok(xml.includes("urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"));
});

test("irsaliyede TUTAR yoktur", () => {
  const { xml } = buildDespatchAdviceXml(temel());

  // Faturaya özgü parasal öğelerin hiçbiri bulunmamalı
  for (const yasak of [
    "LineExtensionAmount",
    "PriceAmount",
    "TaxTotal",
    "LegalMonetaryTotal",
    "PayableAmount",
    "InvoiceLine",
  ]) {
    assert.ok(!xml.includes(yasak), `${yasak} irsaliyede bulunmamalı`);
  }
});

test("satır öğeleri DespatchLine biçiminde", () => {
  const { xml } = buildDespatchAdviceXml(temel());
  const satir = parser.parse(xml).DespatchAdvice.DespatchLine;

  assert.equal(satir.ID, "1");
  assert.equal(satir.DeliveredQuantity["#text"], "5");
  assert.equal(satir.DeliveredQuantity["@_unitCode"], "GRM");
  assert.equal(satir.Item.Name, "22 Ayar Bilezik");
  assert.equal(satir.Item.BrandName, "Likya");
  assert.equal(satir.Item.SellersItemIdentification.ID, "BLZ-22");
});

test("taraf öğeleri DespatchSupplier / DeliveryCustomer", () => {
  const { xml } = buildDespatchAdviceXml(temel());
  const o = parser.parse(xml).DespatchAdvice;

  assert.equal(o.DespatchSupplierParty.Party.PartyIdentification.ID["#text"], "1234567890");
  assert.equal(o.DeliveryCustomerParty.Party.PartyIdentification.ID["#text"], "9876543210");
  // Faturaya özgü taraf adları kullanılmamalı
  assert.ok(!xml.includes("AccountingSupplierParty"));
  assert.ok(!xml.includes("AccountingCustomerParty"));
});

/* ---------------------------------------------------------------- sevkiyat */

test("plaka RoadTransport/LicensePlateID altında", () => {
  const { xml } = buildDespatchAdviceXml(temel());
  const stage = parser.parse(xml).DespatchAdvice.Shipment.ShipmentStage;

  assert.equal(stage.TransportMeans.RoadTransport.LicensePlateID["#text"], "07ABC123");
  assert.equal(stage.TransportMeans.RoadTransport.LicensePlateID["@_schemeID"], "PLAKA");
});

test("şoför DriverPerson altında, birden çok olabilir", () => {
  const { xml } = buildDespatchAdviceXml({
    ...temel(),
    sevkiyat: {
      ...temel().sevkiyat,
      soforler: [
        { ad: "Ali", soyad: "Veli", tckn: "12345678901" },
        { ad: "Ayşe", soyad: "Can" },
      ],
    },
  });
  const soforler = parser.parse(xml).DespatchAdvice.Shipment.ShipmentStage.DriverPerson;

  assert.equal(soforler.length, 2);
  assert.equal(soforler[0].FirstName, "Ali");
  assert.equal(soforler[0].NationalityID["#text"], "12345678901");
  assert.equal(soforler[0].NationalityID["@_schemeID"], "TCKN");
  assert.equal(soforler[1].FamilyName, "Can");
});

test("fiili sevk tarihi Delivery/Despatch altında; teslimat adresi ve posta kodu korunur", () => {
  const { xml } = buildDespatchAdviceXml(temel());
  const teslim = parser.parse(xml).DespatchAdvice.Shipment.Delivery;

  assert.equal(teslim.Despatch.ActualDespatchDate, "2026-02-10");
  assert.equal(teslim.Despatch.ActualDespatchTime, "10:00:00");
  assert.equal(teslim.ActualDeliveryDate, undefined);
  assert.equal(teslim.DeliveryAddress.PostalZone, "34000");
  assert.equal(teslim.DeliveryAddress.CityName, "İstanbul");
  assert.equal(teslim.DeliveryAddress.CitySubdivisionName, "Fatih");
});

test("taşıyıcı firma CarrierParty altında", () => {
  const { xml } = buildDespatchAdviceXml({
    ...temel(),
    sevkiyat: {
      ...temel().sevkiyat,
      sevkTarihi: "2026-02-11",
      tasiyici: { vknTckn: "1112223334", unvan: "Kargo A.Ş." },
    },
  });
  const tasiyici = parser.parse(xml).DespatchAdvice.Shipment.Delivery.CarrierParty;

  assert.equal(tasiyici.PartyIdentification.ID["#text"], "1112223334");
  assert.equal(tasiyici.PartyName.Name, "Kargo A.Ş.");
});

test("ShipmentStage, Delivery'den önce gelir (şema sırası)", () => {
  const { xml } = buildDespatchAdviceXml(temel());
  const i1 = xml.indexOf("<cac:ShipmentStage>");
  const i2 = xml.indexOf("<cac:Delivery>");
  assert.ok(i1 > 0 && i2 > i1, "ShipmentStage Delivery'den sonra kalmış");
});

test("sipariş referansı LineCountNumeric ile Supplier arasında", () => {
  const { xml } = buildDespatchAdviceXml({
    ...temel(),
    siparisNo: "SIP-2026-1",
    siparisTarihi: "2026-02-01",
  });

  const i1 = xml.indexOf("<cbc:LineCountNumeric>");
  const i2 = xml.indexOf("<cac:OrderReference>");
  const i3 = xml.indexOf("<cac:DespatchSupplierParty>");
  assert.ok(i1 > 0 && i2 > i1 && i3 > i2, "OrderReference yanlış konumda");

  const ref = parser.parse(xml).DespatchAdvice.OrderReference;
  assert.equal(ref.ID, "SIP-2026-1");
  assert.equal(ref.IssueDate, "2026-02-01");
});

/* ---------------------------------------------------------------- doğrulama */

test("hatalı girdiler reddedilir", () => {
  const dene = (degisiklik: Partial<IrsaliyeGirdi>, beklenen: RegExp) =>
    assert.throws(
      () => buildDespatchAdviceXml({ ...temel(), ...degisiklik } as IrsaliyeGirdi),
      beklenen
    );

  dene({ belgeNo: "AB-1" }, /3 karakter seri/);
  dene({ belgeNo: "ABC2025000000001" }, /yıl/);
  dene({ tarih: "2026-02-30" }, /düzenleme tarihi/);
  dene({ satirlar: [] }, /en az bir satır/);
  dene({ satirlar: [{ ad: "X", miktar: 0 }] }, /sevk miktarı/);
  dene({ alici: { vknTckn: "12" } as any }, /VKN\/TCKN/);
});

test("sevkiyat doğrulamaları", () => {
  const sevk = (s: any, beklenen: RegExp) =>
    assert.throws(
      () => buildDespatchAdviceXml({ ...temel(), sevkiyat: { ...temel().sevkiyat, ...s } } as IrsaliyeGirdi),
      beklenen
    );

  // Taşıyıcı firma girilmiş olsa dahi plaka zorunludur
  sevk({ sevkTarihi: "2026-02-10", plaka: undefined }, /plakası zorunludur/);
  sevk(
    { sevkTarihi: "2026-02-10", plaka: undefined, tasiyici: { vknTckn: "1112223334", unvan: "Kargo A.Ş." } },
    /plakası zorunludur/
  );
  // Sevk tarihi düzenleme tarihinden önce olamaz
  sevk({ sevkTarihi: "2026-02-01", plaka: "07 A 1" }, /düzenleme tarihinden önce/);
  sevk({ sevkTarihi: "gecersiz", plaka: "07 A 1" }, /Fiili sevk tarihi/);
  sevk(
    { sevkTarihi: "2026-02-10", plaka: "07 A 1", soforler: [{ ad: "Ali", soyad: "" }] },
    /ad ve soyad/
  );
  sevk(
    { sevkTarihi: "2026-02-10", plaka: "07 A 1", soforler: [{ ad: "A", soyad: "B", tckn: "123" }] },
    /11 haneli/
  );
});

test("XML kaçışlama uygulanır", () => {
  const { xml } = buildDespatchAdviceXml({
    ...temel(),
    gonderici: { ...temel().gonderici, unvan: 'Likya & "Ortak" <A>' },
  });
  assert.ok(xml.includes("Likya &amp; &quot;Ortak&quot; &lt;A&gt;"));
  assert.doesNotThrow(() => parser.parse(xml));
});

test("plaka büyük harfe çevrilir", () => {
  const { xml } = buildDespatchAdviceXml({
    ...temel(),
    sevkiyat: { ...temel().sevkiyat, plaka: "07 abc 123" },
  });
  assert.ok(xml.includes('<cbc:LicensePlateID schemeID="PLAKA">07ABC123</cbc:LicensePlateID>'));
});

test("ICE XSD hatası: her satırda Item öncesinde OrderLineReference bulunur", () => {
  const girdi = temel();
  girdi.satirlar.push({ ad: "İkinci ürün", miktar: 2 });
  const satirlar = parser.parse(buildDespatchAdviceXml(girdi).xml).DespatchAdvice.DespatchLine;
  satirlar.forEach((satir: any, i: number) => {
    assert.equal(satir.OrderLineReference.LineID, String(i + 1));
    const alanlar = Object.keys(satir);
    assert.ok(alanlar.indexOf("OrderLineReference") < alanlar.indexOf("Item"));
  });
});

test("eksik veya geçersiz sevk saati ve posta kodu XML üretilmeden reddedilir", () => {
  for (const saat of [undefined, "", "24:00:00", "12:60:00", "12:00:60"]) {
    const girdi = temel();
    girdi.sevkiyat.sevkSaati = saat as any;
    assert.throws(() => buildDespatchAdviceXml(girdi), /sevk saati/);
  }
  for (const kod of [undefined, "", "1234", "123456", "abcde"]) {
    const girdi = temel();
    girdi.sevkiyat.teslimatAdresi.postaKodu = kod as any;
    assert.throws(() => buildDespatchAdviceXml(girdi), /posta kodu/);
  }
});

test("API şeması posta kodunu korur ve eksik zorunlu sevk alanlarını reddeder", () => {
  const girdi = temel();
  const parsed = ebelgeIrsaliyeSchema.parse(girdi);
  assert.equal(parsed.sevkiyat.teslimatAdresi.postaKodu, "34000");
  const teslim = parser.parse(buildDespatchAdviceXml(parsed as IrsaliyeGirdi).xml).DespatchAdvice.Shipment.Delivery;
  assert.equal(teslim.DeliveryAddress.PostalZone, "34000");
  assert.equal(teslim.Despatch.ActualDespatchTime, "10:00:00");
  assert.deepEqual(Object.keys(teslim), ["DeliveryAddress", "Despatch"]);
  for (const alan of ["sevkSaati", "teslimatAdresi", "plaka"]) {
    assert.equal(ebelgeIrsaliyeSchema.safeParse({
      ...girdi, sevkiyat: { ...girdi.sevkiyat, [alan]: undefined },
    }).success, false);
  }
});
