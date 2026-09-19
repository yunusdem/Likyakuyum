/**
 * UBL üreteci — mali alanlar (istisna / tevkifat / iade / döviz) çevrimdışı regresyonu.
 *
 * Yapılar ICE paketindeki UBL-TR şema sınıflarından doğrulandı:
 * ICE_INTAGRATION_v1.0.3/.../UBL/UBLTR-Invoice-2_1.cs
 *   - InvoiceType sequence: … LineCountNumeric → BillingReference → …
 *     AllowanceCharge → TaxExchangeRate → PricingExchangeRate → TaxTotal →
 *     WithholdingTaxTotal → LegalMonetaryTotal → InvoiceLine
 *   - TaxCategoryType: Name → TaxExemptionReasonCode → TaxExemptionReason → TaxScheme
 *
 * Gerçek ICE veya SQL bağlantısı kullanılmaz.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { XMLParser } from "fast-xml-parser";

import {
  buildInvoiceXml,
  hesapla,
  type UblFaturaGirdi,
} from "../src/services/ice/ubl/invoiceBuilder.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,
});

const temel = (): UblFaturaGirdi => ({
  belgeNo: "ABC2026000000001",
  uuid: "11111111-1111-4111-8111-111111111111",
  tarih: "2026-01-15",
  saat: "10:00:00",
  senaryo: "TICARIFATURA",
  faturaTipi: "SATIS",
  paraBirimi: "TRY",
  gonderici: { vknTckn: "1234567890", unvan: "Likya Kuyum A.Ş.", il: "Antalya", ilce: "Muratpaşa" },
  alici: { vknTckn: "9876543210", unvan: "Alıcı A.Ş.", il: "Antalya", ilce: "Muratpaşa" },
  satirlar: [{ ad: "Bilezik", miktar: 1, birimFiyat: 1000, kdvOrani: 20 }],
});

/* ================================================================ istisna */

test("istisna: sıfır oranlı satırda TaxExemptionReason alanları yazılır", () => {
  const { xml } = buildInvoiceXml({
    ...temel(),
    faturaTipi: "ISTISNA",
    satirlar: [
      {
        ad: "Külçe Altın",
        miktar: 100,
        birimKodu: "GRM",
        birimFiyat: 30,
        kdvOrani: 0,
        istisnaKodu: "301",
        istisnaGerekcesi: "Külçe altın teslimi",
      },
    ],
  });
  const o = parser.parse(xml).Invoice;
  const kategori = o.TaxTotal.TaxSubtotal.TaxCategory;

  assert.equal(kategori.TaxExemptionReasonCode, "301");
  assert.equal(kategori.TaxExemptionReason, "Külçe altın teslimi");
  assert.equal(o.TaxTotal.TaxAmount["#text"], "0.00");
  assert.equal(o.LegalMonetaryTotal.PayableAmount["#text"], "3000.00");
});

test("istisna: TaxCategory alan sırası UBL-TR sequence'ı ile aynı", () => {
  const { xml } = buildInvoiceXml({
    ...temel(),
    faturaTipi: "ISTISNA",
    satirlar: [
      { ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 0, istisnaKodu: "301", istisnaGerekcesi: "G" },
    ],
  });

  // Name → TaxExemptionReasonCode → TaxExemptionReason → TaxScheme
  const kesit = /<cac:TaxCategory>(.*?)<\/cac:TaxCategory>/s.exec(xml)![1];
  const sira = [...kesit.matchAll(/<cbc:(Name|TaxExemptionReasonCode|TaxExemptionReason)>|<cac:(TaxScheme)>/g)].map(
    (m) => m[1] || m[2]
  );
  assert.deepEqual(sira, ["Name", "TaxExemptionReasonCode", "TaxExemptionReason", "TaxScheme"]);
});

test("istisna: kod olmadan sıfır KDV reddedilir", () => {
  assert.throws(
    () =>
      buildInvoiceXml({
        ...temel(),
        satirlar: [{ ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 0 }],
      }),
    /istisna kodu yok/
  );
});

test("istisna: kod varken pozitif KDV reddedilir", () => {
  assert.throws(
    () =>
      buildInvoiceXml({
        ...temel(),
        satirlar: [{ ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 20, istisnaKodu: "301" }],
      }),
    /oran 0 olmalıdır/
  );
});

test("14.09.2026: 233 kabul edilir; 555 KDV 0 ile reddedilir", () => {
  assert.doesNotThrow(() => buildInvoiceXml({
    ...temel(), faturaTipi: "ISTISNA",
    satirlar: [{ ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 0, istisnaKodu: "233" }],
  }));
  assert.throws(() => buildInvoiceXml({
    ...temel(), satirlar: [{ ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 0, istisnaKodu: "555" }],
  }), /555.*KDV 0/);
  assert.throws(() => buildInvoiceXml({
    ...temel(), senaryo: "KAMU", satirlar: [{ ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 20, istisnaKodu: "555" }],
  }), /555.*senaryolu/);
});

test("14.09.2026: 308/339 yalnızca YATIRIMTESVIK profilinde", () => {
  for (const kod of ["308", "339"]) {
    const satirlar = [{ ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 0, istisnaKodu: kod }];
    assert.throws(() => buildInvoiceXml({ ...temel(), satirlar }), /yalnızca YATIRIMTESVIK/);
    assert.doesNotThrow(() => buildInvoiceXml({ ...temel(), senaryo: "YATIRIMTESVIK", satirlar }));
  }
});

test("14.09.2026: IADE+KAMU ve TEKNOLOJIDESTEK+EARSIVFATURA profil kuralları", () => {
  const iadeFaturalar = [{ belgeNo: "ABC2026000000002", tarih: "2026-01-01" }];
  assert.doesNotThrow(() => buildInvoiceXml({ ...temel(), faturaTipi: "IADE", senaryo: "KAMU", iadeFaturalar }));
  assert.throws(() => buildInvoiceXml({ ...temel(), faturaTipi: "IADE", senaryo: "TICARIFATURA", iadeFaturalar }), /IADE.*TICARIFATURA/);
  assert.doesNotThrow(() => buildInvoiceXml({ ...temel(), faturaTipi: "TEKNOLOJIDESTEK", senaryo: "EARSIVFATURA" }));
  assert.throws(() => buildInvoiceXml({ ...temel(), faturaTipi: "TEKNOLOJIDESTEK", senaryo: "TEMELFATURA" }), /yalnızca EARSIVFATURA/);
});

/* ================================================================ tevkifat */

test("tevkifat: KDV tutarı üzerinden hesaplanır ve ödenecekten düşer", () => {
  const ozet = hesapla([
    { ad: "Hizmet", miktar: 1, birimFiyat: 1000, kdvOrani: 20, tevkifatKodu: "601", tevkifatOrani: 50 },
  ]);

  assert.equal(ozet.malHizmetToplam, 1000);
  assert.equal(ozet.kdvToplam, 200);
  assert.equal(ozet.tevkifatToplam, 100); // 200'ün %50'si
  assert.equal(ozet.odenecekTutar, 1100); // 1000 + 200 - 100
});

test("tevkifat: WithholdingTaxTotal TaxTotal'dan sonra, LegalMonetaryTotal'dan önce", () => {
  const { xml } = buildInvoiceXml({
    ...temel(),
    faturaTipi: "TEVKIFAT",
    satirlar: [
      { ad: "Hizmet", miktar: 1, birimFiyat: 1000, kdvOrani: 20, tevkifatKodu: "601", tevkifatOrani: 50 },
    ],
  });

  const i1 = xml.indexOf("<cac:TaxTotal>");
  const i2 = xml.indexOf("<cac:WithholdingTaxTotal>");
  const i3 = xml.indexOf("<cac:LegalMonetaryTotal>");
  assert.ok(i1 > 0 && i2 > i1 && i3 > i2, "UBL-TR sequence sırası bozulmuş");

  const o = parser.parse(xml).Invoice;
  assert.equal(o.WithholdingTaxTotal.TaxAmount["#text"], "100.00");
  assert.equal(o.WithholdingTaxTotal.TaxSubtotal.TaxCategory.TaxScheme.TaxTypeCode, "601");
  // Tevkifatın matrahı KDV tutarıdır
  assert.equal(o.WithholdingTaxTotal.TaxSubtotal.TaxableAmount["#text"], "200.00");
});

test("tevkifat: KDV dahil toplam tevkifattan etkilenmez, ödenecek etkilenir", () => {
  const { xml } = buildInvoiceXml({
    ...temel(),
    faturaTipi: "TEVKIFAT",
    satirlar: [
      { ad: "Hizmet", miktar: 1, birimFiyat: 1000, kdvOrani: 20, tevkifatKodu: "601", tevkifatOrani: 50 },
    ],
  });
  const t = parser.parse(xml).Invoice.LegalMonetaryTotal;

  assert.equal(t.TaxInclusiveAmount["#text"], "1200.00"); // tevkifat öncesi
  assert.equal(t.PayableAmount["#text"], "1100.00"); // tevkifat sonrası
});

test("tevkifat: kod/oran birlikte, tip TEVKIFAT olmalı", () => {
  assert.throws(
    () =>
      buildInvoiceXml({
        ...temel(),
        satirlar: [{ ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 20, tevkifatKodu: "601" }],
      }),
    /birlikte verilmelidir/
  );
  assert.throws(
    () =>
      buildInvoiceXml({
        ...temel(),
        faturaTipi: "SATIS",
        satirlar: [
          { ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 20, tevkifatKodu: "601", tevkifatOrani: 50 },
        ],
      }),
    /tipi TEVKIFAT olmalıdır/
  );
  assert.throws(
    () => buildInvoiceXml({ ...temel(), faturaTipi: "TEVKIFAT" }),
    /en az bir satırda tevkifat/
  );
});

/* ================================================================ iade */

test("iade: BillingReference LineCountNumeric ile Supplier arasında", () => {
  const { xml } = buildInvoiceXml({
    ...temel(),
    faturaTipi: "IADE",
    senaryo: "TEMELFATURA",
    iadeFaturalar: [{ belgeNo: "ABC2025000000099", tarih: "2025-12-01" }],
  });

  const i1 = xml.indexOf("<cbc:LineCountNumeric>");
  const i2 = xml.indexOf("<cac:BillingReference>");
  const i3 = xml.indexOf("<cac:AccountingSupplierParty>");
  assert.ok(i1 > 0 && i2 > i1 && i3 > i2, "BillingReference yanlış konumda");

  const ref = parser.parse(xml).Invoice.BillingReference.InvoiceDocumentReference;
  assert.equal(ref.ID, "ABC2025000000099");
  assert.equal(ref.IssueDate, "2025-12-01");
});

test("iade: birden çok dayanak fatura yazılabilir", () => {
  const { xml } = buildInvoiceXml({
    ...temel(),
    faturaTipi: "IADE",
    senaryo: "TEMELFATURA",
    iadeFaturalar: [
      { belgeNo: "ABC2025000000001", tarih: "2025-11-01" },
      { belgeNo: "ABC2025000000002", tarih: "2025-11-02" },
    ],
  });
  const refs = parser.parse(xml).Invoice.BillingReference;
  assert.equal(refs.length, 2);
});

test("iade: dayanak yoksa ve yanlış tipte kullanılırsa reddedilir", () => {
  assert.throws(() => buildInvoiceXml({ ...temel(), faturaTipi: "IADE", senaryo: "TEMELFATURA" }), /iade edilen fatura/);
  assert.throws(
    () =>
      buildInvoiceXml({
        ...temel(),
        iadeFaturalar: [{ belgeNo: "X", tarih: "2025-01-01" }],
      }),
    /yalnızca IADE tipi/
  );
  assert.throws(
    () =>
      buildInvoiceXml({
        ...temel(),
        faturaTipi: "IADE",
        senaryo: "TEMELFATURA",
        iadeFaturalar: [{ belgeNo: "X", tarih: "01.01.2025" }],
      }),
    /YYYY-AA-GG/
  );
});

/* ================================================================ döviz */

test("döviz: PricingExchangeRate TaxTotal'dan önce yazılır", () => {
  const { xml } = buildInvoiceXml({
    ...temel(),
    paraBirimi: "USD",
    dovizKuru: { kur: 42.15, tarih: "2026-01-15" },
  });

  const i1 = xml.indexOf("<cac:PricingExchangeRate>");
  const i2 = xml.indexOf("<cac:TaxTotal>");
  assert.ok(i1 > 0 && i2 > i1, "PricingExchangeRate yanlış konumda");

  const kur = parser.parse(xml).Invoice.PricingExchangeRate;
  assert.equal(kur.SourceCurrencyCode, "USD");
  assert.equal(kur.TargetCurrencyCode, "TRY");
  assert.equal(kur.CalculationRate, "42.15");
  assert.equal(kur.Date, "2026-01-15");
});

test("döviz: tutarlar belge para biriminde etiketlenir", () => {
  const { xml } = buildInvoiceXml({
    ...temel(),
    paraBirimi: "USD",
    dovizKuru: { kur: 42.15 },
  });
  const o = parser.parse(xml).Invoice;
  assert.equal(o.DocumentCurrencyCode, "USD");
  assert.equal(o.LegalMonetaryTotal.PayableAmount["@_currencyID"], "USD");
});

test("döviz: kur olmadan yabancı para reddedilir", () => {
  assert.throws(() => buildInvoiceXml({ ...temel(), paraBirimi: "EUR" }), /kur bilgisi zorunludur/);
  assert.throws(
    () => buildInvoiceXml({ ...temel(), paraBirimi: "EUR", dovizKuru: { kur: 0 } }),
    /kur bilgisi zorunludur/
  );
});

test("TRY belgede kur bloğu yazılmaz", () => {
  const { xml } = buildInvoiceXml({ ...temel(), dovizKuru: { kur: 1 } });
  assert.ok(!xml.includes("PricingExchangeRate"));
});

/* ================================================================ özel matrah */

// 19.09.2026 (docs/ebelge-revizyon.md K4): özel matrah GİB UBL-TR kılavuzuna göre yazıldı. Gönderimden önce her belge
// ICE `invoice_check_validate`ten geçtiği için yapı ICE'de reddedilirse belge kesilmez.
const ozelMatrahli = (): UblFaturaGirdi => ({
  ...temel(),
  faturaTipi: "OZELMATRAH",
  // 22 ayar bilezik: satış bedeli 100.000, KDV yalnızca 5.000 TL işçilik üzerinden
  satirlar: [{ ad: "22 Ayar Bilezik", miktar: 1, birimFiyat: 100000, kdvOrani: 20,
    ozelMatrahKodu: "805", ozelMatrahGerekcesi: "Altından mamül ziynet eşyası", ozelMatrahTutari: 5000 }],
});

test("özel matrah: KDV satır tutarı üzerinden değil özel matrah üzerinden hesaplanır", () => {
  const { ozet } = buildInvoiceXml(ozelMatrahli());
  assert.equal(ozet.malHizmetToplam, 100000);
  assert.equal(ozet.kdvToplam, 1000);
  assert.equal(ozet.odenecekTutar, 101000);
  assert.deepEqual(ozet.kdvGruplari, [{ oran: 20, matrah: 5000, vergi: 1000, istisnaKodu: "805", istisnaGerekcesi: "Altından mamül ziynet eşyası" }]);
});

test("özel matrah: kod TaxExemptionReasonCode alanında, TaxableAmount özel matrah tutarıdır", () => {
  const { xml } = buildInvoiceXml(ozelMatrahli());
  const f = parser.parse(xml).Invoice;
  assert.equal(f.InvoiceTypeCode, "OZELMATRAH");
  for (const alt of [f.TaxTotal.TaxSubtotal, f.InvoiceLine.TaxTotal.TaxSubtotal]) {
    assert.equal(alt.TaxableAmount["#text"], "5000.00");
    assert.equal(alt.TaxAmount["#text"], "1000.00");
    assert.equal(alt.TaxCategory.TaxExemptionReasonCode, "805");
    assert.equal(alt.TaxCategory.TaxScheme.TaxTypeCode, "0015");
  }
  assert.equal(f.InvoiceLine.LineExtensionAmount["#text"], "100000.00");
  assert.equal(f.LegalMonetaryTotal.TaxInclusiveAmount["#text"], "101000.00");
  assert.equal(f.LegalMonetaryTotal.PayableAmount["#text"], "101000.00");
});

test("özel matrah: özel matrahlı ve normal KDV'li satır ayrı gruplanır", () => {
  const g = ozelMatrahli();
  g.satirlar.push({ ad: "Kutu", miktar: 1, birimFiyat: 100, kdvOrani: 20 });
  const { ozet } = buildInvoiceXml(g);
  assert.equal(ozet.kdvGruplari.length, 2);
  assert.equal(ozet.kdvToplam, 1020);
  assert.equal(ozet.odenecekTutar, 101120);
});

test("özel matrah: kural ihlalleri reddedilir", () => {
  const s = ozelMatrahli().satirlar[0];
  assert.throws(() => buildInvoiceXml({ ...temel(), faturaTipi: "OZELMATRAH" }), /en az bir satırda özel matrah/);
  assert.throws(() => buildInvoiceXml({ ...ozelMatrahli(), faturaTipi: "SATIS" }), /tipi OZELMATRAH olmalıdır/);
  assert.throws(() => buildInvoiceXml({ ...ozelMatrahli(), satirlar: [{ ...s, ozelMatrahKodu: "351" }] }), /801-812/);
  assert.throws(() => buildInvoiceXml({ ...ozelMatrahli(), satirlar: [{ ...s, ozelMatrahTutari: undefined }] }), /birlikte verilmelidir/);
  assert.throws(() => buildInvoiceXml({ ...ozelMatrahli(), satirlar: [{ ...s, ozelMatrahTutari: -1 }] }), /sıfır ya da pozitif/);
});

test("ihraç kayıtlı hâlâ açıkça reddedilir (uydurma yapılmaz)", () => {
  assert.throws(() => buildInvoiceXml({ ...temel(), faturaTipi: "IHRACKAYITLI" }), /henüz desteklenmiyor/);
});

/* ================================================================ tevkifat iade */

const tevkifatIade = (): UblFaturaGirdi => ({
  ...temel(),
  senaryo: "TEMELFATURA",
  faturaTipi: "TEVKIFATIADE",
  iadeFaturalar: [{ belgeNo: "ABC2025000000009", tarih: "2025-12-20" }],
  satirlar: [{ ad: "İşçilik", miktar: 1, birimFiyat: 1000, kdvOrani: 20, tevkifatKodu: "616", tevkifatOrani: 50 }],
});

test("tevkifat iade: hem dayanak fatura hem tevkifat bloğu yazılır", () => {
  const { xml, ozet } = buildInvoiceXml(tevkifatIade());
  const f = parser.parse(xml).Invoice;
  assert.equal(f.InvoiceTypeCode, "TEVKIFATIADE");
  assert.equal(f.BillingReference.InvoiceDocumentReference.ID, "ABC2025000000009");
  assert.equal(f.WithholdingTaxTotal.TaxAmount["#text"], "100.00");
  assert.equal(ozet.odenecekTutar, 1100);
});

test("tevkifat iade: dayanak, tevkifat ve profil kuralları", () => {
  assert.throws(() => buildInvoiceXml({ ...tevkifatIade(), iadeFaturalar: [] }), /iade edilen fatura bilgisi zorunludur/);
  assert.throws(() => buildInvoiceXml({ ...tevkifatIade(), satirlar: temel().satirlar }), /en az bir satırda tevkifat/);
  assert.throws(() => buildInvoiceXml({ ...tevkifatIade(), senaryo: "TICARIFATURA" }), /TICARIFATURA profilinde kullanılamaz/);
});

/* ================================================================ karma */

test("karma senaryo: istisnalı ve KDV'li satır ayrı gruplanır", () => {
  const { xml, ozet } = buildInvoiceXml({
    ...temel(),
    faturaTipi: "ISTISNA",
    satirlar: [
      { ad: "Külçe Altın", miktar: 100, birimKodu: "GRM", birimFiyat: 30, kdvOrani: 0, istisnaKodu: "301" },
      { ad: "İşçilik", miktar: 1, birimFiyat: 500, kdvOrani: 20 },
    ],
  });

  assert.equal(ozet.kdvGruplari.length, 2);
  assert.equal(ozet.malHizmetToplam, 3500);
  assert.equal(ozet.kdvToplam, 100);
  assert.equal(ozet.odenecekTutar, 3600);

  const altToplamlar = parser.parse(xml).Invoice.TaxTotal.TaxSubtotal;
  assert.equal(altToplamlar.length, 2);
  // Sıfır oranlı grup istisna kodu taşımalı
  const istisnali = altToplamlar.find((x: any) => x.Percent === "0");
  assert.equal(istisnali.TaxCategory.TaxExemptionReasonCode, "301");
});

test("geriye dönük uyum: sade SATIS faturası bozulmadı", () => {
  const { xml, ozet } = buildInvoiceXml(temel());
  const o = parser.parse(xml).Invoice;

  assert.equal(ozet.odenecekTutar, 1200);
  assert.equal(ozet.tevkifatToplam, 0);
  assert.ok(!xml.includes("WithholdingTaxTotal"));
  assert.ok(!xml.includes("BillingReference"));
  assert.ok(!xml.includes("PricingExchangeRate"));
  assert.equal(o.LegalMonetaryTotal.PayableAmount["#text"], "1200.00");
});

test("ext ad alanı bildirilir ve UBLExtensions ilk çocuk elemandır", () => {
  const { xml } = buildInvoiceXml(temel());
  assert.ok(xml.includes('xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"'));
  // ICE imzayı buraya yazıyor; eleman kökten hemen sonra, UBLVersionID'den önce olmalı
  assert.ok(xml.indexOf("<ext:UBLExtensions>") < xml.indexOf("<cbc:UBLVersionID>"));
});

test("adreste il/ilçe zorunlu (UBL-TR AddressType)", () => {
  assert.throws(
    () => buildInvoiceXml({ ...temel(), alici: { vknTckn: "9876543210", unvan: "Alıcı A.Ş." } as any }),
    /il ve ilçe zorunludur/
  );
  assert.throws(
    () => buildInvoiceXml({ ...temel(), gonderici: { vknTckn: "1234567890", unvan: "X", il: "Antalya" } as any }),
    /Bağlantı Ayarları/
  );
});

/* ================================================================ taraf alanları (2. tur Faz 7) */

test("alıcı: adres kırılımı ve iletişim alanları UBL-TR sırasıyla yazılır", () => {
  const { xml } = buildInvoiceXml({
    ...temel(),
    alici: {
      vknTckn: "9876543210", unvan: "Alıcı A.Ş.", vergiDairesi: "Muratpaşa",
      adres: "Fener Mah. Bülent Ecevit Cad.", binaAdi: "Likya Apt.", binaNo: "12", kapiNo: "3",
      postaKodu: "07160", ilce: "Muratpaşa", il: "Antalya", ulke: "Türkiye",
      telefon: "02421112233", faks: "02421112244", eposta: "alici@ornek.com", webAdresi: "https://ornek.com",
    },
  });
  const alici = parser.parse(xml).Invoice.AccountingCustomerParty.Party;
  assert.equal(alici.PostalAddress.Room, "3");
  assert.equal(alici.PostalAddress.StreetName, "Fener Mah. Bülent Ecevit Cad.");
  assert.equal(alici.PostalAddress.BuildingName, "Likya Apt.");
  assert.equal(alici.PostalAddress.BuildingNumber, "12");
  assert.equal(alici.PostalAddress.PostalZone, "07160");
  assert.equal(alici.Contact.Telefax, "02421112244");
  assert.equal(alici.WebsiteURI, "https://ornek.com");
  // UBL-TR AddressType sequence bozulursa ICE şema hatası verir
  const sira = ["Room", "StreetName", "BuildingName", "BuildingNumber", "CitySubdivisionName", "CityName", "PostalZone", "Country"];
  const adresXml = xml.slice(xml.indexOf("<cac:AccountingCustomerParty>"));
  const yerler = sira.map((e) => adresXml.indexOf(`<cbc:${e}>`) >= 0 ? adresXml.indexOf(`<cbc:${e}>`) : adresXml.indexOf("<cac:Country>"));
  assert.deepEqual(yerler, [...yerler].sort((a, b) => a - b));
});

test("alıcı: boş adres alanları XML'e hiç yazılmaz", () => {
  const { xml } = buildInvoiceXml(temel());
  for (const e of ["Room", "BuildingName", "BuildingNumber", "PostalZone", "Telefax"]) {
    assert.ok(!xml.includes(`<cbc:${e}>`), e);
  }
});

/* ================================================================ belge blokları (2. tur Faz 8) */

const bloklu = (): UblFaturaGirdi => ({
  ...temel(),
  siparis: { no: "SIP-2026-1", tarih: "2026-01-10" },
  irsaliyeler: [{ no: "IRS2026000000001", tarih: "2026-01-12" }, { no: "IRS2026000000002", tarih: "2026-01-13" }],
  ekBelgeler: [{ no: "EK-1", tarih: "2026-01-14", tur: "Sözleşme", turKodu: "SZL" }],
  okc: { fisNo: "0001", fisTipi: "SATIS", fisTarihi: "2026-01-15", fisSaati: "10:05", okcNo: "OKC-9", zNo: "12" },
  iban: { iban: "TR330006100519786457841326" },
});

test("blok: sipariş, irsaliye, ek belge, ÖKC ve IBAN yazılır", () => {
  const { xml } = buildInvoiceXml(bloklu());
  const f = parser.parse(xml).Invoice;
  assert.equal(f.OrderReference.ID, "SIP-2026-1");
  assert.equal(f.OrderReference.IssueDate, "2026-01-10");
  assert.equal(f.DespatchDocumentReference.length, 2);
  assert.equal(f.DespatchDocumentReference[1].ID, "IRS2026000000002");
  assert.equal(f.PaymentMeans.PayeeFinancialAccount.ID, "TR330006100519786457841326");
  assert.equal(f.PaymentMeans.PayeeFinancialAccount.CurrencyCode, "TRY");
  // ek belge + ÖKC alanları (fiş no, fiş tipi, ÖKC no, Z no, saat) aynı listede
  const ek = f.AdditionalDocumentReference;
  assert.equal(ek.length, 6);
  assert.equal(ek[0].DocumentType, "Sözleşme");
  assert.deepEqual(ek.slice(1).map((r: any) => r.DocumentType), ["OKCFISNO", "OKCFISTIPI", "OKCNO", "ZNO", "OKCFISSAATI"]);
});

test("blok: UBL-TR sırası — OrderReference → BillingReference → Despatch → Additional → Supplier", () => {
  const { xml } = buildInvoiceXml({
    ...bloklu(), senaryo: "TEMELFATURA", faturaTipi: "IADE",
    iadeFaturalar: [{ belgeNo: "ABC2025000000001", tarih: "2025-12-01" }],
  });
  const sira = ["<cac:OrderReference>", "<cac:BillingReference>", "<cac:DespatchDocumentReference>",
    "<cac:AdditionalDocumentReference>", "<cac:AccountingSupplierParty>"].map((e) => xml.indexOf(e));
  assert.ok(sira.every((x) => x > 0));
  assert.deepEqual(sira, [...sira].sort((a, b) => a - b));
  // PaymentMeans, PricingExchangeRate ve TaxTotal'dan önce gelmeli
  assert.ok(xml.indexOf("<cac:PaymentMeans>") < xml.indexOf("<cac:TaxTotal>"));
});

test("blok: geçersiz IBAN ve tarih reddedilir, boş bloklar yazılmaz", () => {
  assert.throws(() => buildInvoiceXml({ ...temel(), iban: { iban: "TR12" } }), /IBAN/);
  assert.throws(() => buildInvoiceXml({ ...temel(), irsaliyeler: [{ no: "", tarih: "2026-01-01" }] }), /irsaliye numarası zorunludur/);
  assert.throws(() => buildInvoiceXml({ ...temel(), siparis: { no: "S1", tarih: "15.01.2026" } }), /Sipariş tarihi/);
  assert.throws(() => buildInvoiceXml({ ...temel(), okc: { fisSaati: "25:00" } }), /ÖKC fiş saati/);
  const { xml } = buildInvoiceXml(temel());
  for (const e of ["OrderReference", "DespatchDocumentReference", "AdditionalDocumentReference", "PaymentMeans"]) {
    assert.ok(!xml.includes(`<cac:${e}>`), e);
  }
});

/* ================================================================ satır kolonları (2. tur Faz 9) */

test("satır: hizmet kodu, satır notu ve elle iskonto tutarı", () => {
  const { xml, ozet } = buildInvoiceXml({
    ...temel(),
    satirlar: [{ ad: "Bilezik", hizmetKodu: "BLZ-22", not: "Vitrin ürünü", miktar: 2, birimFiyat: 1000, kdvOrani: 20, iskontoTutari: 150 }],
  });
  const satir = parser.parse(xml).Invoice.InvoiceLine;
  assert.equal(satir.Note, "Vitrin ürünü");
  assert.equal(satir.Item.SellersItemIdentification.ID, "BLZ-22");
  assert.equal(satir.AllowanceCharge.Amount["#text"], "150.00");
  // 150 / 2000 = 0.075 — oran tutardan geri hesaplanır
  assert.equal(satir.AllowanceCharge.MultiplierFactorNumeric, "0.075");
  assert.equal(ozet.iskontoToplam, 150);
  assert.equal(ozet.malHizmetToplam, 1850);
  assert.equal(ozet.odenecekTutar, 2220);
});

test("satır: iskonto tutarı orandan önce gelir, oran tek başına da çalışır", () => {
  const tutarli = buildInvoiceXml({
    ...temel(),
    satirlar: [{ ad: "Bilezik", miktar: 1, birimFiyat: 1000, kdvOrani: 20, iskontoOrani: 50, iskontoTutari: 100 }],
  });
  assert.equal(tutarli.ozet.iskontoToplam, 100);
  const oranli = buildInvoiceXml({
    ...temel(), satirlar: [{ ad: "Bilezik", miktar: 1, birimFiyat: 1000, kdvOrani: 20, iskontoOrani: 10 }],
  });
  assert.equal(oranli.ozet.iskontoToplam, 100);
});

test("satır: geçersiz iskonto tutarı reddedilir, boş kolonlar yazılmaz", () => {
  assert.throws(() => buildInvoiceXml({
    ...temel(), satirlar: [{ ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 20, iskontoTutari: 200 }],
  }), /satır tutarını aşamaz/);
  assert.throws(() => buildInvoiceXml({
    ...temel(), satirlar: [{ ad: "X", miktar: 1, birimFiyat: 100, kdvOrani: 20, iskontoTutari: -5 }],
  }), /sıfır ya da pozitif/);
  const { xml } = buildInvoiceXml(temel());
  assert.ok(!xml.includes("<cbc:Note>"));
  assert.ok(!xml.includes("SellersItemIdentification"));
});

/* ================================================================ yeni senaryolar (2. tur Faz 10-12) */

test("ihracat: yurt dışı alıcı BuyerCustomerParty'de, teslim şartı Delivery'de", () => {
  const { xml } = buildInvoiceXml({
    ...temel(), senaryo: "IHRACAT", faturaTipi: "ISTISNA",
    ihracat: { firmaUnvani: "Lidya GmbH", vkn: "1234567890", ulke: "Almanya", sehir: "Berlin", teslimSarti: "FOB", gonderimSekli: "4" },
    satirlar: [{ ad: "Bilezik", miktar: 1, birimFiyat: 1000, kdvOrani: 0, istisnaKodu: "301", gtip: "7113190000", kapCinsi: "KOLI", kapNo: "1", kapAdet: 2 }],
  });
  const f = parser.parse(xml).Invoice;
  assert.equal(f.ProfileID, "IHRACAT");
  assert.equal(f.BuyerCustomerParty.Party.PartyName.Name, "Lidya GmbH");
  assert.equal(f.DeliveryTerms.ID, "FOB");
  assert.equal(f.Delivery.Shipment.ShipmentStage.TransportModeCode, "4");
  assert.equal(f.InvoiceLine.Item.CommodityClassification.ItemClassificationCode["#text"], "7113190000");
  const ozellikler = f.InvoiceLine.Item.AdditionalItemProperty.map((p: any) => p.Name);
  assert.ok(ozellikler.includes("Eşya Kap Cinsi") && ozellikler.includes("Kap Adet"));
  assert.throws(() => buildInvoiceXml({ ...temel(), senaryo: "IHRACAT", faturaTipi: "ISTISNA" }), /firmanın unvanı zorunludur/);
});

test("yolcu beraberi: turist, pasaport, aracı kurum ve iade hesabı", () => {
  const girdi: UblFaturaGirdi = {
    ...temel(), senaryo: "YOLCUBERABERFATURA",
    turist: { ad: "John", soyad: "Smith", ulke: "İngiltere", uyruk: "GB", pasaportNo: "P123456", pasaportTarihi: "2024-05-01",
      bankaAdi: "Ziraat", subeAdi: "Kaleiçi", hesapNo: "TR330006100519786457841326", hesapParaBirimi: "TRY", odemeNotu: "İade" },
    araciKurum: { vknTckn: "1234567890", unvan: "Global Blue", sehir: "İstanbul" },
  };
  const f = parser.parse(buildInvoiceXml(girdi).xml).Invoice;
  assert.equal(f.ProfileID, "YOLCUBERABERFATURA");
  assert.equal(f.BuyerCustomerParty.Party.Person.FirstName, "John");
  assert.equal(f.BuyerCustomerParty.Party.Person.IdentityDocumentReference.ID["#text"], "P123456");
  assert.equal(f.TaxRepresentativeParty.PartyName.Name, "Global Blue");
  assert.equal(f.PaymentMeans.PayeeFinancialAccount.ID, "TR330006100519786457841326");
  assert.throws(() => buildInvoiceXml({ ...girdi, turist: { ad: "John", soyad: "Smith" } }), /pasaport numarası zorunludur/);
});

test("IDIS / YTB / e-Arşiv tipi ek belge referansı olarak yazılır", () => {
  const idis = parser.parse(buildInvoiceXml({ ...temel(), senaryo: "IDIS", idisSevkiyatNo: "SEV-1" }).xml).Invoice;
  assert.equal(idis.AdditionalDocumentReference.DocumentType, "IDISSEVKIYATNO");
  assert.throws(() => buildInvoiceXml({ ...temel(), senaryo: "IDIS" }), /sevkiyat numarası zorunludur/);

  const ytb = parser.parse(buildInvoiceXml({
    ...temel(), senaryo: "EARSIVFATURA", faturaTipi: "YTBSATIS", ytb: { no: "YTB-9", tarih: "2026-01-02" },
    earsiv: { tip: "INTERNET", gonderimSekli: "ELEKTRONIK" },
  }).xml).Invoice;
  const turler = ytb.AdditionalDocumentReference.map((r: any) => r.DocumentType);
  assert.deepEqual(turler, ["YATIRIMTESVIKBELGESI", "EARSIVTIPI", "GONDERIMSEKLI"]);
  assert.throws(() => buildInvoiceXml({ ...temel(), senaryo: "EARSIVFATURA", faturaTipi: "YTBSATIS" }), /teşvik belge numarası zorunludur/);
  assert.throws(() => buildInvoiceXml({ ...temel(), faturaTipi: "YTBSATIS", ytb: { no: "1" } }), /yalnızca e-Arşiv faturada/);
});

test("hal tipi: masraflar belge seviyesinde AllowanceCharge olarak yazılır", () => {
  const { xml } = buildInvoiceXml({
    ...temel(), senaryo: "HKS", faturaTipi: "HALTIPIKOMISYONCU",
    halMasraflari: [{ ad: "Komisyon", tutar: 100, kdvOrani: 20 }, { ad: "Navlun", tutar: 50 }],
    satirlar: [{ ad: "Domates", miktar: 10, birimFiyat: 50, kdvOrani: 1, kunyeNo: "K-1", malSahibi: "Ali Veli" }],
  });
  const f = parser.parse(xml).Invoice;
  assert.equal(f.AllowanceCharge.length, 2);
  assert.equal(f.AllowanceCharge[0].AllowanceChargeReason, "Komisyon");
  assert.equal(f.AllowanceCharge[0].ChargeIndicator, "true");
  assert.throws(() => buildInvoiceXml({ ...temel(), senaryo: "HKS", faturaTipi: "HALTIPIKOMISYONCU", halMasraflari: [{ ad: "", tutar: 5 }] }), /açıklama zorunludur/);
});

test("belge seviyesindeki muafiyet sebebi, gerekçesiz istisna grubuna yazılır", () => {
  const { xml } = buildInvoiceXml({
    ...temel(), faturaTipi: "ISTISNA", muafiyetSebebi: "Külçe altın teslimi",
    satirlar: [{ ad: "Külçe", miktar: 1, birimFiyat: 1000, kdvOrani: 0, istisnaKodu: "229" }],
  });
  assert.ok(xml.includes("<cbc:TaxExemptionReason>Külçe altın teslimi</cbc:TaxExemptionReason>"));
});

test("tevkifat ve istisna aynı satırda taşınmaz (20.09.2026 kuralı)", () => {
  // Tevkifatlı satırda KDV > 0 olduğu için istisna kodu zaten reddedilir
  assert.throws(() => buildInvoiceXml({
    ...temel(), faturaTipi: "TEVKIFAT",
    satirlar: [{ ad: "İşçilik", miktar: 1, birimFiyat: 1000, kdvOrani: 20, istisnaKodu: "229", tevkifatKodu: "616", tevkifatOrani: 50 }],
  }), /KDV istisnası bildirilmiş/);
  // İstisna tipli faturada tevkifat verilirse tip uyuşmazlığı hatası alınır
  assert.throws(() => buildInvoiceXml({
    ...temel(), faturaTipi: "ISTISNA",
    satirlar: [{ ad: "Külçe", miktar: 1, birimFiyat: 1000, kdvOrani: 0, istisnaKodu: "229", tevkifatKodu: "616", tevkifatOrani: 50 }],
  }), /tipi TEVKIFAT olmalıdır|KDV yokken tevkifat/);
});
