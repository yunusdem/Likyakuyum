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
