/**
 * e-Gider Pusulası üreteci — çevrimdışı regresyon.
 *
 * Üretilen XML, GİB'in resmî paketindeki örnek belgelerin YAPISI ile karşılaştırılır:
 * docs/ice/gib-faz8/gider-paketi/e-Gider Pusulası Paketi/
 *
 * Gerçek ICE veya SQL bağlantısı kullanılmaz.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

import {
  buildGiderPusulasiXml,
  hesaplaGiderPusulasi,
  IADE_BELGE_TIPLERI,
  xsltFaturaKokuneUyarla,
  type GiderPusulasiGirdi,
} from "../src/services/ice/ubl/giderPusulasiBuilder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORNEK_DIZIN = path.resolve(
  __dirname,
  "../../docs/ice/gib-faz8/gider-paketi/e-Gider Pusulası Paketi"
);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,
});

const ornekVar = fs.existsSync(ORNEK_DIZIN);

const temelGirdi = (): GiderPusulasiGirdi => ({
  belgeNo: "GIP2026000000001",
  uuid: "7DC52246-5750-496E-8BF2-BD27BC0764DC",
  tarih: "2026-03-01",
  saat: "12:00:00",
  belgeTipi: "SATIS",
  paraBirimi: "TRY",
  notlar: ["Hurda altın alımı"],
  gonderici: {
    vknTckn: "1234567890",
    unvan: "Likya Kuyum A.Ş.",
    il: "Antalya",
    ilce: "Muratpaşa",
    vergiDairesi: "Muratpaşa",
  },
  alici: {
    vknTckn: "12345678901",
    ad: "Ayşe",
    soyad: "Yılmaz",
    il: "Antalya",
    ilce: "Muratpaşa",
  },
  satirlar: [{ ad: "22 Ayar Hurda Altın", miktar: 10, birimKodu: "GRM", birimFiyat: 175, vergiOrani: 10 }],
});

/* ---------------------------------------------------------------- hesaplama */

test("tutarlar satırlardan hesaplanır", () => {
  const ozet = hesaplaGiderPusulasi([
    { ad: "A", miktar: 10, birimFiyat: 175, vergiOrani: 10 },
    { ad: "B", miktar: 2, birimFiyat: 100, vergiOrani: 20 },
  ]);

  assert.equal(ozet.malHizmetToplam, 1950); // 1750 + 200
  assert.equal(ozet.vergiToplam, 215); // 175 + 40
  assert.equal(ozet.odenecekTutar, 2165);
  assert.equal(ozet.vergiGruplari.length, 2);
  assert.deepEqual(ozet.vergiGruplari[0], { oran: 10, matrah: 1750, vergi: 175 });
});

/* ---------------------------------------------------------------- yapı */

// ICE gider pusulasını fatura okuyucusu ve UBL-TR Invoice şemasıyla açıyor (27.10.2026, ICE test):
// kök Invoice, satır InvoiceLine, fatura şemasında zorunlu LineCountNumeric. İçerik GİB gider pusulası.
test("kök öğe ve sabitler: ICE'nin beklediği Invoice biçimi, GİB gider içeriği", () => {
  const girdi = temelGirdi();
  const { xml } = buildGiderPusulasiXml(girdi);
  const o = parser.parse(xml).Invoice;

  assert.ok(o, "kök öğe Invoice olmalı");
  assert.equal(o.UBLVersionID, "2.1");
  assert.equal(o.CustomizationID, "TR1.2.1");
  assert.equal(o.ProfileID, "GIDERPUSULASI");
  assert.equal(o.InvoiceTypeCode, "SATIS");
  assert.equal(o.CopyIndicator, "false");
  assert.equal(o.LineCountNumeric, String(girdi.satirlar.length));
  assert.ok(xml.includes("urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"));
  // CreditNote öğeleri kalmamalı (ICE kök adında reddediyordu)
  assert.ok(!xml.includes("CreditNote"));
  assert.ok(!xml.includes("CreditedQuantity"));
});

test("LineCountNumeric satır sayısıyla aynı ve DocumentCurrencyCode'dan hemen sonra", () => {
  const { xml } = buildGiderPusulasiXml({
    ...temelGirdi(),
    satirlar: [
      { ad: "A", miktar: 1, birimFiyat: 10, vergiOrani: 0 },
      { ad: "B", miktar: 2, birimFiyat: 20, vergiOrani: 0 },
      { ad: "C", miktar: 3, birimFiyat: 30, vergiOrani: 0 },
    ],
  });
  assert.ok(xml.includes("</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>3</cbc:LineCountNumeric>"));
  assert.equal((xml.match(/<cac:InvoiceLine>/g) || []).length, 3);
});

test("satır öğeleri InvoiceLine biçiminde", () => {
  const { xml } = buildGiderPusulasiXml(temelGirdi());
  const o = parser.parse(xml).Invoice;
  const satir = o.InvoiceLine;

  assert.equal(satir.ID, "1");
  assert.equal(satir.InvoicedQuantity["#text"], "10");
  assert.equal(satir.InvoicedQuantity["@_unitCode"], "GRM");
  assert.equal(satir.LineExtensionAmount["#text"], "1750.00");
  assert.equal(satir.Price.PriceAmount["#text"], "175.00");
  assert.equal(satir.Item.Name, "22 Ayar Hurda Altın");
});

test("toplamlar ve vergi bloğu doğru", () => {
  const { xml, ozet } = buildGiderPusulasiXml(temelGirdi());
  const o = parser.parse(xml).Invoice;

  assert.equal(ozet.odenecekTutar, 1925);
  assert.equal(o.LegalMonetaryTotal.LineExtensionAmount["#text"], "1750.00");
  assert.equal(o.LegalMonetaryTotal.TaxExclusiveAmount["#text"], "1750.00");
  assert.equal(o.LegalMonetaryTotal.TaxInclusiveAmount["#text"], "1925.00");
  assert.equal(o.LegalMonetaryTotal.PayableAmount["#text"], "1925.00");
  assert.equal(o.TaxTotal.TaxAmount["#text"], "175.00");
  assert.equal(o.TaxTotal.TaxSubtotal.Percent, "10");
  assert.equal(o.TaxTotal.TaxSubtotal.TaxCategory.TaxScheme.TaxTypeCode, "0015");
});

test("vergi türü kodu dışarıdan verilebilir (stopaj varsayımı yapılmaz)", () => {
  const { xml } = buildGiderPusulasiXml({ ...temelGirdi(), vergiTuruKodu: "0003" });
  assert.ok(xml.includes("<cbc:TaxTypeCode>0003</cbc:TaxTypeCode>"));
});

test("taraflar doğru schemeID ile yazılır", () => {
  const { xml } = buildGiderPusulasiXml(temelGirdi());
  const o = parser.parse(xml).Invoice;

  assert.equal(o.AccountingSupplierParty.Party.PartyIdentification.ID["@_schemeID"], "VKN");
  assert.equal(o.AccountingCustomerParty.Party.PartyIdentification.ID["@_schemeID"], "TCKN");
  assert.equal(o.AccountingCustomerParty.Party.Person.FirstName, "Ayşe");
  assert.equal(o.AccountingCustomerParty.Party.Person.FamilyName, "Yılmaz");
});

/* ---------------------------------------------------------------- iade */

test("iade: BillingReference GİB örneğindeki biçimde", () => {
  const { xml } = buildGiderPusulasiXml({
    ...temelGirdi(),
    belgeTipi: "IADE",
    iadeDayanak: { belgeTipi: "EARSIV_FATURA", belgeNo: "GIB2026000000002", belgeTarihi: "2026-02-01" },
  });
  const o = parser.parse(xml).Invoice;
  const ref = o.BillingReference.InvoiceDocumentReference;

  assert.equal(o.InvoiceTypeCode, "IADE");
  assert.equal(ref.ID["@_schemeID"], "EARSIV_FATURA");
  assert.equal(ref.ID["#text"], "GIB2026000000002");
  assert.equal(ref.IssueDate, "2026-02-01");
});

test("iade: BELGESIZ dayanakta boş ID öğesi yazılır", () => {
  const { xml } = buildGiderPusulasiXml({
    ...temelGirdi(),
    belgeTipi: "IADE",
    iadeDayanak: { belgeTipi: "BELGESIZ", belgeTarihi: "2026-02-01" },
  });
  assert.ok(xml.includes('<cbc:ID schemeID="BELGESIZ"/>'));
});

test("iade: kargo bilgisi Delivery altında yazılır", () => {
  const { xml } = buildGiderPusulasiXml({
    ...temelGirdi(),
    belgeTipi: "IADE",
    iadeDayanak: { belgeTipi: "SATIS_FISI", belgeNo: "001", belgeTarihi: "2026-02-01" },
    kargo: { vkn: "0123456789", unvan: "Kargo A.Ş.", yetkiBelgeNo: "YB-1", il: "Antalya", ilce: "Kepez" },
  });
  const o = parser.parse(xml).Invoice;
  const kargo = o.Delivery.DeliveryParty;

  assert.equal(kargo.PartyIdentification.ID["#text"], "0123456789");
  assert.equal(kargo.PartyName.Name, "Kargo A.Ş.");
  assert.equal(kargo.IndustryClassificationCode["@_name"], "YETKIBELGENO");
});

test("iade: SMS kanalı Contact altında bildirilir", () => {
  const { xml } = buildGiderPusulasiXml({
    ...temelGirdi(),
    belgeTipi: "IADE",
    iadeDayanak: { belgeTipi: "SATIS_FISI", belgeNo: "001", belgeTarihi: "2026-02-01" },
    iadeKanali: { tip: "SMS", saglayiciAdi: "Operatör", saglayiciVkn: "1112223334", kod: "123456", telefon: "5555555555" },
  });
  const o = parser.parse(xml).Invoice;
  const contact = o.AccountingCustomerParty.Party.Contact;

  assert.equal(contact.Name, "SMS");
  assert.equal(contact.ID, "123456");
  assert.equal(contact.Telephone, "5555555555");
});

/* ---------------------------------------------------------------- doğrulama */

test("hatalı girdiler reddedilir", () => {
  const dene = (degisiklik: Partial<GiderPusulasiGirdi>, beklenen: RegExp) =>
    assert.throws(() => buildGiderPusulasiXml({ ...temelGirdi(), ...degisiklik } as GiderPusulasiGirdi), beklenen);

  dene({ belgeNo: "GIP-1" }, /3 karakter seri/);
  dene({ belgeNo: "GIP2025000000001" }, /yıl/);
  dene({ tarih: "2026-02-30" }, /düzenleme tarihi/);
  dene({ satirlar: [] }, /en az bir satır/);
  dene({ satirlar: [{ ad: "A", miktar: 0, birimFiyat: 10, vergiOrani: 10 }] }, /miktar/);
  dene({ satirlar: [{ ad: "A", miktar: 1, birimFiyat: Infinity, vergiOrani: 10 }] }, /sonlu/);
  dene({ alici: { vknTckn: "123" } as any }, /VKN\/TCKN/);
  dene({ alici: { vknTckn: "12345678901", unvan: "X", il: "Antalya", ilce: "Muratpaşa" } as any }, /ad ve soyad/);
  dene({ paraBirimi: "TRYY" }, /üç harfli/);
});

test("iade doğrulamaları", () => {
  const iade = (ek: Partial<GiderPusulasiGirdi>) =>
    buildGiderPusulasiXml({ ...temelGirdi(), belgeTipi: "IADE", ...ek } as GiderPusulasiGirdi);

  assert.throws(() => iade({}), /dayanak belge/);
  assert.throws(
    () => iade({ iadeDayanak: { belgeTipi: "SATIS_FISI", belgeTarihi: "2026-02-01" } }),
    /dayanak belge numarası/
  );
  assert.throws(
    () => iade({ iadeDayanak: { belgeTipi: "EARSIV_FATURA", belgeNo: "X", belgeTarihi: "01.02.2026" } }),
    /YYYY-AA-GG/
  );
  // Belgesiz iadede karşı taraf TCKN olmalı (GİB örneği)
  assert.throws(
    () =>
      iade({
        iadeDayanak: { belgeTipi: "BELGESIZ", belgeTarihi: "2026-02-01" },
        alici: { vknTckn: "1234567890", unvan: "Tüzel", il: "Antalya", ilce: "Muratpaşa" } as any,
      }),
    /gerçek TCKN/
  );
});

test("XML kaçışlama uygulanır", () => {
  const { xml } = buildGiderPusulasiXml({
    ...temelGirdi(),
    gonderici: { ...temelGirdi().gonderici, unvan: 'Likya & "Ortak" <A>' },
  });
  assert.ok(xml.includes("Likya &amp; &quot;Ortak&quot; &lt;A&gt;"));
  assert.doesNotThrow(() => parser.parse(xml));
});

/* ---------------------------------------------------------------- GİB örneğiyle karşılaştırma */

// GİB örnekleri CreditNote; ICE Invoice istediği için üretim fatura adlarını kullanır. Karşılaştırmada eşlenir.
const faturaAdi = (k: string): string => ({ CreditNoteTypeCode: "InvoiceTypeCode", CreditNoteLine: "InvoiceLine" } as Record<string, string>)[k] || k;

test("GİB örnek belgesindeki tüm zorunlu öğeler üretimde var", { skip: !ornekVar }, () => {
  const ornek = fs.readFileSync(path.join(ORNEK_DIZIN, "GiderPusulasıSATIS.xml"), "utf8");
  const ornekObj = parser.parse(ornek).CreditNote;
  const { xml } = buildGiderPusulasiXml(temelGirdi());
  const bizim = parser.parse(xml).Invoice;

  // İmzayı biz üretmiyoruz (mühür ICE'de) — onun dışında tüm üst düzey öğeler.
  // XSLT eki (AdditionalDocumentReference) GİB'de zorunlu; yokken ICE belgeyi açamadı (27.10.2026).
  const uretmediklerimiz = new Set(["Signature"]);
  const eksikler = Object.keys(ornekObj).filter(
    (k) => !uretmediklerimiz.has(k) && !(faturaAdi(k) in bizim)
  );

  assert.deepEqual(eksikler, [], `GİB örneğinde olup üretimde olmayan öğeler: ${eksikler.join(", ")}`);
});

/* ---------------------------------------------------------------- XSLT eki (GİB §3.1.13, zorunlu) */

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

test("XSLT eki GİB örneğindeki biçimde yazılır", () => {
  const girdi = temelGirdi();
  const { xml, uuid } = buildGiderPusulasiXml(girdi);
  const ek = parser.parse(xml).Invoice.AdditionalDocumentReference;

  assert.ok(ek, "AdditionalDocumentReference yok");
  assert.equal(ek.ID, uuid);
  assert.equal(ek.IssueDate, girdi.tarih);
  const nesne = ek.Attachment.EmbeddedDocumentBinaryObject;
  assert.equal(nesne["@_characterSetCode"], "UTF-8");
  assert.equal(nesne["@_encodingCode"], "Base64");
  assert.equal(nesne["@_filename"], `${girdi.belgeNo}.xslt`);
  assert.equal(nesne["@_mimeCode"], "application/xml");
});

test("XSLT eki geçerli Base64 ve GİB şablonunun fatura köküne uyarlanmış hali", () => {
  const { xml } = buildGiderPusulasiXml(temelGirdi());
  const icerik = String(parser.parse(xml).Invoice.AdditionalDocumentReference.Attachment.EmbeddedDocumentBinaryObject["#text"]);

  assert.ok(icerik.length > 1000, "ek boş ya da çok kısa");
  assert.equal(icerik.length % 4, 0, "Base64 uzunluğu 4'ün katı değil");
  assert.ok(BASE64.test(icerik), "Base64 dışı karakter var");

  const cozulen = Buffer.from(icerik, "base64");
  assert.equal(cozulen.toString("base64"), icerik, "gidiş-dönüş tutmuyor");
  assert.ok(cozulen.toString("utf8").includes("<xsl:stylesheet"), "çözülen içerik XSLT değil");

  // Ek = Backend kopyasının uyarlanmış hali; Backend kopyası da GİB paketindekinin birebir aynısı
  const backendKopya = fs.readFileSync(path.resolve(__dirname, "../belge/xslt/giderPusulasi.xslt"));
  assert.equal(cozulen.toString("utf8"), xsltFaturaKokuneUyarla(backendKopya.toString("utf8")), "ek, uyarlanmış şablon değil");
  if (ornekVar) {
    assert.ok(backendKopya.equals(fs.readFileSync(path.join(ORNEK_DIZIN, "giderPusulasi.xslt"))), "Backend kopyası GİB paketindeki XSLT ile aynı değil");
  }
});

// ICE PDF'i bu şablonla çiziyor; şablon CreditNote ararken belge Invoice olunca PDF boş çıkıyordu (27.10.2026).
// .NET XslCompiledTransform ile yerelde: asıl şablon → hiçbir değer yok, uyarlanmış → belge no, ETTN, taraflar, tutarlar dolu.
test("XSLT uyarlaması: şablon belgeyi fatura adlarıyla arar, CreditNote kalmaz", () => {
  const gib = fs.readFileSync(path.resolve(__dirname, "../belge/xslt/giderPusulasi.xslt"), "utf8");
  assert.ok(gib.includes('match="//n1:CreditNote"'), "GİB şablonu beklenen CreditNote kalıbını içermiyor (sürüm değişmiş olabilir)");

  const u = xsltFaturaKokuneUyarla(gib);
  assert.ok(!/Credit(Note|ed)/.test(u), "uyarlanmış şablonda CreditNote kaldı");
  assert.ok(u.includes('xmlns:n1="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"'));
  assert.ok(u.includes('match="//n1:Invoice"'));
  assert.ok(u.includes('match="//n1:Invoice/cac:InvoiceLine"'));
  assert.ok(u.includes("cbc:InvoiceTypeCode") && u.includes("cbc:InvoicedQuantity"));
  // Uyarlama yalnız ad değiştirir: her n1:CreditNote bir n1:Invoice olur (şablondaki eski n1:Invoice'lar da kalır), satır sayısı aynı
  const say = (s: string, r: RegExp) => (s.match(r) || []).length;
  assert.equal(say(u, /n1:Invoice(?![A-Za-z])/g), say(gib, /n1:CreditNote(?![A-Za-z])/g) + say(gib, /n1:Invoice(?![A-Za-z])/g));
  assert.equal(say(u, /cac:InvoiceLine/g), say(gib, /cac:CreditNoteLine/g));
  assert.equal(u.split("\n").length, gib.split("\n").length);
});

test("XSLT uyarlaması: tanınmayan bir Credit… alanı kalırsa gönderim durur", () => {
  assert.throws(() => xsltFaturaKokuneUyarla('<x select="//n1:CreditNote/cac:CreditNoteDocumentReference"/>'), /uyarlanamayan/);
  assert.doesNotThrow(() => xsltFaturaKokuneUyarla('<x select="//n1:CreditNote/cac:CreditNoteLine/cbc:CreditedQuantity"/>'));
});

test("XSLT eki SATIS ve IADE'de GİB örneklerindeki sırada", { skip: !ornekVar }, () => {
  const sirali = new XMLParser({ preserveOrder: true, ignoreAttributes: true, removeNSPrefix: true });
  const ustOgeler = (x: string): string[] =>
    ((sirali.parse(x).find((d: any) => d.CreditNote || d.Invoice) || {}) as any)[x.includes("<Invoice ") ? "Invoice" : "CreditNote"]
      .map((d: any) => faturaAdi(Object.keys(d)[0])).filter((k: string) => k !== "#text");

  const karsilastir = (ornekDosya: string, girdi: GiderPusulasiGirdi) => {
    const ornek = ustOgeler(fs.readFileSync(path.join(ORNEK_DIZIN, ornekDosya), "utf8"));
    const bizim = ustOgeler(buildGiderPusulasiXml(girdi).xml);
    // İkisinde de olan öğeler aynı sırada olmalı (GİB adları fatura adlarına eşlenmiş)
    const ortak = (liste: string[]) => [...new Set(liste.filter((k) => ornek.includes(k) && bizim.includes(k)))];
    assert.deepEqual(ortak(bizim), ortak(ornek), `${ornekDosya}: üst düzey öğe sırası GİB örneğinden farklı`);
    const i = (k: string) => bizim.indexOf(k);
    assert.ok(i("AdditionalDocumentReference") > i("DocumentCurrencyCode"));
    assert.ok(i("AdditionalDocumentReference") < i("AccountingSupplierParty"));
    if (bizim.includes("BillingReference")) assert.ok(i("BillingReference") < i("AdditionalDocumentReference"));
  };

  karsilastir("GiderPusulasıSATIS.xml", temelGirdi());
  karsilastir("GiderPusulasıIADE_Belgesiz.xml", {
    ...temelGirdi(),
    belgeTipi: "IADE",
    iadeDayanak: { belgeTipi: "BELGESIZ", belgeTarihi: "2026-02-01" },
  });
});

test("ICE'ye giden zarf: belge iki kat Base64 (ICE içeriği iki kez çözüyor)", async () => {
  const { toBase64 } = await import("../src/services/ice/ubl/invoiceBuilder.js");
  const { giderPusulasiBelgeleriXml } = await import("../src/services/ice/ice.giderpusulasi.js");
  const { xml } = buildGiderPusulasiXml(temelGirdi());
  const zarf = giderPusulasiBelgeleriXml([toBase64(xml), toBase64(xml)]);

  const icerikler = [...zarf.matchAll(/<base64Binary><earsiv_invoice>([^<]*)<\/earsiv_invoice><\/base64Binary>/g)].map((m) => m[1]);
  assert.equal(icerikler.length, 2, "her belge ayrı base64Binary içinde olmalı");
  for (const icerik of icerikler) {
    assert.ok(BASE64.test(icerik) && icerik.length % 4 === 0, "zarftaki içerik geçerli Base64 değil");
    // ASMX'in kendi çözdüğü katman: çıkan metin yine Base64 olmalı (ICE bunu ikinci kez çözüyor)
    const birKat = Buffer.from(icerik, "base64").toString("utf8");
    assert.ok(BASE64.test(birKat) && !birKat.includes("<"), "bir kez çözülünce XML değil Base64 metni çıkmalı");
    assert.equal(birKat, toBase64(xml));
    assert.equal(Buffer.from(birKat, "base64").toString("utf8"), xml, "iki kez çözülünce özgün XML çıkmalı");
  }
});

test("GİB iade örneğindeki dayanak tipleri enum ile örtüşüyor", { skip: !ornekVar }, () => {
  const dosyalar = fs.readdirSync(ORNEK_DIZIN).filter((f) => f.includes("IADE") && f.endsWith(".xml"));
  assert.ok(dosyalar.length >= 3, "üç iade örneği bekleniyor");

  const gorulen = new Set<string>();
  for (const dosya of dosyalar) {
    const icerik = fs.readFileSync(path.join(ORNEK_DIZIN, dosya), "utf8");
    const eslesme = /<cbc:ID schemeID="([A-Z_]+)"\s*\/?>/.exec(icerik);
    if (eslesme) gorulen.add(eslesme[1]);
  }

  for (const tip of gorulen) {
    assert.ok(
      (IADE_BELGE_TIPLERI as readonly string[]).includes(tip),
      `GİB örneğindeki ${tip} enum'da yok`
    );
  }
});

/* ---------------------------------------------------------------- kontör okuyucu */

test("kontör okuyucu: tanınan alandan kalanı bulur", async () => {
  const { EbelgeService } = await import("../src/services/ebelge.service.js");

  assert.deepEqual(EbelgeService.kontorOku([{ Urun: "EFatura", KalanKontor: "250" }]), {
    okunabildi: true,
    kalan: 250,
    kaynakAlan: "KalanKontor",
  });

  // Birden çok aday varsa en kısıtlayıcı olan seçilir
  assert.equal(
    EbelgeService.kontorOku([{ kalan_adet: "500", kontor_bakiye: "12" }]).kalan,
    12
  );

  // Virgüllü ondalık
  assert.equal(EbelgeService.kontorOku([{ kalanKontor: "10,5" }]).kalan, 10.5);
});

test("kontör okuyucu: tanımadığı yapıda uydurmaz", async () => {
  const { EbelgeService } = await import("../src/services/ebelge.service.js");

  assert.deepEqual(EbelgeService.kontorOku([{ Aciklama: "bilinmeyen", Tarih: "2026-01-01" }]), {
    okunabildi: false,
    kalan: null,
    kaynakAlan: null,
  });
  assert.equal(EbelgeService.kontorOku([]).okunabildi, false);
  assert.equal(EbelgeService.kontorOku([null as any, "metin" as any]).okunabildi, false);
  // Sayıya çevrilemeyen değer aday sayılmaz
  assert.equal(EbelgeService.kontorOku([{ kalanKontor: "sınırsız" }]).okunabildi, false);
});
