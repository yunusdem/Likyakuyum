/**
 * Çevrimdışı test: e-Döviz 2.0 (GİB paket v1.3, 30.11.2026) — docs/EDOVIZ_SURUM2_YOL_HARITASI.md
 *
 * - Sürüm seçimi: ICE WSDL'i (canlı 09.09.2026 = 1, test 20.11.2026 = 2), ortam anahtarı, tarih yedeği, önbellek.
 * - 2.0 gövdesi ICE TEST WSDL'indeki sequence sırasına ve zorunlu alanlara uyar; enum değerleri WSDL'de var.
 * - 1.0 gövdesinde 2.0 alanı yok, 2.0 gövdesinde 1.0'a özgü ödeme alanları yok.
 * - Fişten alanlar: uyruk, yönlü kur, ödeme yöntemleri (banka → havale), e-Belge Not.
 * - Ön kontrol: durduran kurallar ve yalnız uyarı yazan kurallar; GİB hesap kuralı.
 *
 * Çalıştırma: Backend klasöründe `node node_modules/tsx/dist/cli.mjs scripts/ebelge-edoviz-surum2-test.ts`
 */
import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import { XMLParser } from "fast-xml-parser";
import {
  buildEDovizInnerXml,
  edovizSurum2Ubl,
  sendEDoviz,
  surum2Tutarlari,
  edovizSurum2OnKontrol,
  hesapKuraliTutuyor,
  EDovizGirdi,
} from "../src/services/ice/ice.edoviz.js";
import {
  EDOVIZ_SURUM2_BASLANGIC,
  edovizSurumOnbellekTemizle,
  edovizSurumu,
  tarihEDovizSurumu,
  wsdlEDovizSurumu,
} from "../src/services/ice/ice.edovizSurum.js";
import { dovizGirdisi } from "../src/services/ebelgeKaynak.service.js";

(sql.ConnectionPool.prototype as any).connect = () => {
  throw new Error("TEST: gerçek SQL yasak");
};
globalThis.fetch = (async () => {
  throw new Error("TEST: ağ yasak");
}) as any;

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WSDL_CANLI = fs.readFileSync(path.join(KOK, "docs/ice/integration-2026-09-09.wsdl"), "utf8");
const WSDL_TEST = fs.readFileSync(path.join(KOK, "docs/ice/integration-test-2026-11-20.wsdl"), "utf8");
const ICE_CANLI = "https://integration.iceteknoloji.com.tr/integration.asmx";
const ICE_TEST = "https://integrationtest.iceteknoloji.com.tr/integration.asmx";

/* ---------- WSDL yardımcıları ---------- */

interface WsdlAlan {
  ad: string;
  zorunlu: boolean;
  tip: string;
}
/** complexType'ın sequence alanları (sıra, minOccurs, tip). */
const sequence = (wsdl: string, tip: string): WsdlAlan[] => {
  const m = wsdl.match(new RegExp(`<s:complexType name="${tip}">\\s*<s:sequence>([\\s\\S]*?)</s:sequence>`));
  assert.ok(m, `WSDL'de ${tip} yok`);
  return [...m[1].matchAll(/<s:element minOccurs="(\d)" maxOccurs="[^"]+" name="([^"]+)" type="([^"]+)"/g)].map((x) => ({
    ad: x[2],
    zorunlu: x[1] === "1",
    tip: x[3],
  }));
};
const enumDegerleri = (wsdl: string, tip: string): string[] => {
  const m = wsdl.match(new RegExp(`<s:simpleType name="${tip}">([\\s\\S]*?)</s:simpleType>`));
  assert.ok(m, `WSDL'de ${tip} yok`);
  return [...m[1].matchAll(/<s:enumeration value="([^"]+)"/g)].map((x) => x[1]);
};

const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: true, parseTagValue: false, trimValues: true });
type Dugum = Record<string, any>;
const adi = (d: Dugum) => Object.keys(d).find((k) => k !== ":@")!;
const cocuklar = (d: Dugum): Dugum[] => (Array.isArray(d[adi(d)]) ? d[adi(d)] : []);
const metinDegeri = (d: Dugum): string => String(cocuklar(d).find((c) => "#text" in c)?.["#text"] ?? "");

/** Blok WSDL sırasına uyuyor mu; zorunlular var mı (haric: bilinçli olarak yazılmayanlar). */
const blokDenetle = (wsdl: string, dugum: Dugum, tip: string, haric: string[] = []) => {
  const alanlar = sequence(wsdl, tip);
  const sira = alanlar.map((a) => a.ad);
  const gelen = cocuklar(dugum).map(adi);
  let onceki = -1;
  for (const ad of gelen) {
    const i = sira.indexOf(ad);
    assert.ok(i >= 0, `${tip}: WSDL'de olmayan alan ${ad}`);
    assert.ok(i > onceki, `${tip}: ${ad} sırası bozuk (${gelen.join(",")})`);
    onceki = i;
  }
  for (const a of alanlar) {
    if (a.zorunlu && !haric.includes(a.ad)) assert.ok(gelen.includes(a.ad), `${tip}: zorunlu ${a.ad} yok`);
  }
  // decimal alanlar sayı, enum alanlar WSDL değeri
  for (const c of cocuklar(dugum)) {
    const a = alanlar.find((x) => x.ad === adi(c))!;
    const v = metinDegeri(c);
    if (a.tip === "s:decimal") assert.ok(/^-?\d+(\.\d+)?$/.test(v), `${tip}.${a.ad} sayı değil: "${v}"`);
    if (a.tip === "tns:Odeme_Yontemleri") assert.ok(enumDegerleri(wsdl, "Odeme_Yontemleri").includes(v), `${a.ad}=${v} WSDL enum'unda yok`);
  }
};

/* ---------- Örnek girdiler (YENI_R2026 görünüm satırlarından) ---------- */

const ortakBaslik = {
  IPTAL: 0, E_BELGE_DURUMU: 0, E_BELGE_HATA_ACIKLAMASI: "", ETTN: "",
  ProfileId: "EDOVIZBELGE",
  Supplier_PartyIdentification: "1234567890", Supplier_PartyName: "Test Döviz", Supplier_CityName: "Antalya",
  Customer_PartyIdentification: "12345678901", Customer_PartyIdentification_ID: "12345678901",
  Customer_PartyIdentification_PassportID: "",
  Customer_Person_FirstName: "Ayşe", Customer_Person_FamilyName: "Yılmaz", Customer_Person_NationalityID: "TR",
  Customer_CountryName: "Türkiye", VEZNE_KODU: "vezne02", KOMISYON: 0, BMV: 0, FIS_GISE_USD_KURU: 51.2,
  IssueDate: "2026-11-30T00:00:00.000Z", IssueTime: "2026-11-30T10:15:00.000Z", TARIH: "2026-11-30T10:15:00.000Z",
};
/** ALIM: 100 GBP × 65,5 (görünüm: Payable döviz, LineExtension TL) */
const alimBaslik = (ek: Record<string, any> = {}) => ({
  ...ortakBaslik, BELGE_ID: 26049, FIS_TIPI: 0, BELGE_NO: "DAA2026000019678", ID: "DAA2026000019678",
  CreditNoteTypeCode: "ALIM", PARA_KODU: "GBP", MIKTAR: 100, KUR: 65.5, PaymentExchangeRate: 65.5,
  PayableAmount: 100, PayableAmountCurrency: "GBP", LineExtensionAmount: 6550, LineExtensionAmountCurrency: "TRY",
  TaxExclusiveAmount: 6550, TaxInclusiveAmount: 6550, TaxAmount: 0, TaxPercent: 0, TaxableAmount: 0,
  ISTATISTIK_KOD: "9249", ISTATISTIK_FIS_TIPI: 0, FIS_BANKA_HESABI_ID: null, FIS_E_BELGE_NOT: null,
  ...ek,
});
/** SATIM: 2.800 EUR × 56,2 (görünüm: Payable TL, LineExtension döviz) */
const satimBaslik = (ek: Record<string, any> = {}) => ({
  ...ortakBaslik, BELGE_ID: 26096, FIS_TIPI: 1, BELGE_NO: "DSS2026000007117", ID: "DSS2026000007117",
  CreditNoteTypeCode: "SATIM", PARA_KODU: "EUR", MIKTAR: 2800, KUR: 56.2, PaymentExchangeRate: 0.0177935943060498,
  PayableAmount: 157360, PayableAmountCurrency: "TRY", LineExtensionAmount: 2800, LineExtensionAmountCurrency: "EUR",
  TaxExclusiveAmount: 157360, TaxInclusiveAmount: 157360, TaxAmount: 314, TaxPercent: 0.2, TaxableAmount: 157360,
  ISTATISTIK_KOD: "10285", ISTATISTIK_FIS_TIPI: 1, FIS_BANKA_HESABI_ID: null, FIS_E_BELGE_NOT: null,
  ...ek,
});
const gonderici = { vknTckn: "1234567890", dosyaNo: "B2560" };
const girdi = (b: any): EDovizGirdi => dovizGirdisi({ baslik: b }, gonderici);
const LOGIN = "<Login_Request_Header><Session_ID>x</Session_ID><IP_Number>1</IP_Number><Security_Key>y</Security_Key></Login_Request_Header>";
const govde = (g: EDovizGirdi, surum: 1 | 2): Dugum => {
  const kok = parser.parse(buildEDovizInnerXml(LOGIN, g, surum))[0];
  assert.equal(adi(kok), "_eDovizBelge");
  return kok;
};
const blok = (kok: Dugum, ad: string): Dugum => {
  const d = cocuklar(kok).find((c) => adi(c) === ad);
  assert.ok(d, `${ad} bloğu yok`);
  return d!;
};
const deger = (kok: Dugum, blokAdi: string, alan: string): string => {
  const d = cocuklar(blok(kok, blokAdi)).find((c) => adi(c) === alan);
  return d ? metinDegeri(d) : "<yok>";
};

beforeEach(() => edovizSurumOnbellekTemizle());

/* ---------- Sürüm seçimi ---------- */

test("WSDL'den sürüm: canlı 09.09.2026 = 1, ICE test 20.11.2026 = 2, tanınmayan = null", () => {
  assert.equal(wsdlEDovizSurumu(WSDL_CANLI), 1);
  assert.equal(wsdlEDovizSurumu(WSDL_TEST), 2);
  assert.equal(wsdlEDovizSurumu("<definitions/>"), null);
  assert.equal(wsdlEDovizSurumu(""), null);
});

test("Tarih yedeği: 30.11.2026 00:00 (TR) ve sonrası 2, öncesi 1", () => {
  assert.equal(EDOVIZ_SURUM2_BASLANGIC, new Date("2026-11-30T00:00:00+03:00").getTime());
  assert.equal(tarihEDovizSurumu(new Date("2026-11-29T23:59:59+03:00").getTime()), 1);
  assert.equal(tarihEDovizSurumu(new Date("2026-11-30T00:00:00+03:00").getTime()), 2);
});

test("edovizSurumu: ortam anahtarı > WSDL > tarih; önbellek; ICE dışı adres reddedilir", async () => {
  let okuma = 0;
  const okuyucu = (wsdl: string) => async (adres: string) => {
    okuma++;
    assert.match(adres, /\?WSDL$/);
    return wsdl;
  };
  assert.deepEqual(await edovizSurumu(ICE_TEST, { ortam: "1", okuyucu: okuyucu(WSDL_TEST) }), { surum: 1, kaynak: "ENV" });
  assert.equal(okuma, 0, "ortam anahtarında WSDL okunmaz");

  assert.deepEqual(await edovizSurumu(ICE_TEST, { ortam: "", okuyucu: okuyucu(WSDL_TEST) }), { surum: 2, kaynak: "WSDL" });
  assert.deepEqual(await edovizSurumu(ICE_TEST, { ortam: "", okuyucu: okuyucu(WSDL_TEST) }), { surum: 2, kaynak: "WSDL" });
  assert.equal(okuma, 1, "aynı adres önbellekten");
  assert.deepEqual(await edovizSurumu(ICE_CANLI, { ortam: "", okuyucu: okuyucu(WSDL_CANLI) }), { surum: 1, kaynak: "WSDL" });
  assert.equal(okuma, 2, "farklı adres ayrı okunur");

  edovizSurumOnbellekTemizle();
  const bozuk = async () => {
    throw new Error("zaman aşımı");
  };
  const once = new Date("2026-11-25T12:00:00+03:00").getTime();
  const sonra = new Date("2026-11-30T09:00:00+03:00").getTime();
  assert.deepEqual(await edovizSurumu(ICE_CANLI, { ortam: "", okuyucu: bozuk, simdi: once }), { surum: 1, kaynak: "TARIH" });
  edovizSurumOnbellekTemizle();
  assert.deepEqual(await edovizSurumu(ICE_CANLI, { ortam: "", okuyucu: bozuk, simdi: sonra }), { surum: 2, kaynak: "TARIH" });

  await assert.rejects(edovizSurumu("https://ornek.com/integration.asmx", { ortam: "" }), /iceteknoloji/);
  await assert.rejects(edovizSurumu("http://integration.iceteknoloji.com.tr/integration.asmx", { ortam: "" }), /https/);
});

/* ---------- Gövde ---------- */

test("2.0 gövdesi ICE TEST WSDL sırasına ve zorunlu alanlarına uyar (alım ve satım)", () => {
  for (const b of [alimBaslik(), satimBaslik({ FIS_BANKA_HESABI_ID: 7 })]) {
    const kok = govde(girdi(b), 2);
    blokDenetle(WSDL_TEST, kok, "eDoviz_Belge");
    blokDenetle(WSDL_TEST, blok(kok, "Baslik_Bilgileri"), "Baslik_Bilgileri");
    blokDenetle(WSDL_TEST, blok(kok, "Yetkili_Muessese"), "Yetkili_Muessese_Bilgileri");
    blokDenetle(WSDL_TEST, blok(kok, "Musteri"), "Musteri_Bilgileri");
    blokDenetle(WSDL_TEST, blok(kok, "Alis_Satis_Bilgileri"), "Alis_Satis_Bilgileri");
    blokDenetle(WSDL_TEST, blok(kok, "Odeme_Bilgileri"), "Odeme_Bilgileri");
    // Gümrük tarihleri kaynakta yoksa bilinçli olarak yazılmaz (1.0'dan beri ICE kabul ediyor)
    blokDenetle(WSDL_TEST, blok(kok, "Ek_Bilgiler"), "Ek_Bilgiler", ["Gumruk_Beyan_Tarihi", "DBT_Tarihi", "GMTY_Tarihi"]);
    blokDenetle(WSDL_TEST, blok(kok, "Komisyon_Bilgileri"), "Komisyon_Bilgileri");
    blokDenetle(WSDL_TEST, blok(kok, "Kiymetli_Maden_Bilgileri"), "Kiymetli_Maden_Bilgileri");
    blokDenetle(WSDL_TEST, blok(kok, "Tutar_Bilgileri"), "Tutar_Bilgileri");
    blokDenetle(WSDL_TEST, blok(kok, "BuyBack"), "BuyBack");
  }
});

test("WSDL denetimi bozuk gövdeyi yakalar (sıra, eksik zorunlu, enum, bilinmeyen alan, sayı)", () => {
  const x = buildEDovizInnerXml(LOGIN, girdi(alimBaslik()), 2);
  const bozuk = (xml: string, tip: string, blokAd: string) =>
    assert.throws(() => blokDenetle(WSDL_TEST, blok(parser.parse(xml)[0], blokAd), tip), undefined, `${tip} bozukluğu yakalanmadı`);
  const kur = x.match(/<Kur_Bilgisi>[^<]*<\/Kur_Bilgisi>/)![0];
  bozuk(x.replace(kur, "").replace("<Vergi_Matrah>", kur + "<Vergi_Matrah>"), "Alis_Satis_Bilgileri", "Alis_Satis_Bilgileri");
  bozuk(x.replace(/<Doviz_Burosu_Odeme_Yontemi>[^<]*<\/Doviz_Burosu_Odeme_Yontemi>/, ""), "Odeme_Bilgileri", "Odeme_Bilgileri");
  bozuk(x.replace("<Musteri_Odeme_Yontemi>NAKIT", "<Musteri_Odeme_Yontemi>DIGER"), "Odeme_Bilgileri", "Odeme_Bilgileri");
  bozuk(x.replace("<Uyruk>", "<Uyrugu>X</Uyrugu><Uyruk>"), "Musteri_Bilgileri", "Musteri");
  bozuk(x.replace(/(<Tutar_Bilgileri>[\s\S]*?)<Kur_Bilgisi>[^<]*</, "$1<Kur_Bilgisi>1e-7<"), "Tutar_Bilgileri", "Tutar_Bilgileri");
});

test("1.0 gövdesi canlı WSDL'e uyar ve 2.0 alanı taşımaz; 2.0 gövdesi 1.0 ödeme alanlarını taşımaz", () => {
  const g = girdi(alimBaslik());
  const x1 = buildEDovizInnerXml(LOGIN, g, 1);
  const x2 = buildEDovizInnerXml(LOGIN, g, 2);
  for (const ad of ["Uyruk", "Kur_Bilgisi", "Musteri_Odeme_Yontemi", "Doviz_Burosu_Odeme_Yontemi"]) {
    assert.ok(!x1.includes(`<${ad}>`), `1.0'da ${ad} olmamalı`);
    assert.ok(x2.includes(`<${ad}>`), `2.0'da ${ad} olmalı`);
  }
  for (const ad of ["Odeme_Yontemi", "Son_Odeme_Tarihi", "Odeme_Yapan_Hesap", "Odeme_Yapilan_Hesap", "Aciklama"]) {
    assert.ok(x1.includes(`<${ad}>`), `1.0'da ${ad} olmalı`);
    assert.ok(!x2.includes(`<${ad}>`), `2.0'da ${ad} olmamalı`);
  }
  const k1 = govde(g, 1);
  blokDenetle(WSDL_CANLI, blok(k1, "Odeme_Bilgileri"), "Odeme_Bilgileri");
  blokDenetle(WSDL_CANLI, blok(k1, "Alis_Satis_Bilgileri"), "Alis_Satis_Bilgileri");
  blokDenetle(WSDL_CANLI, blok(k1, "Musteri"), "Musteri_Bilgileri");
  blokDenetle(WSDL_CANLI, blok(k1, "Yetkili_Muessese"), "Yetkili_Muessese_Bilgileri");
  blokDenetle(WSDL_CANLI, blok(k1, "Tutar_Bilgileri"), "Tutar_Bilgileri");
  assert.equal(deger(k1, "Baslik_Bilgileri", "CreditNoteTypeCode"), "DOVIZALIMBELGESI", "1.0 kodu değişmez");
});

/* ---------- Fişten alanlar ---------- */

test("Alım: yönlü kur TL ÷ döviz, uyruk, ödeme nakit/nakit, dosya no Yetkili_Muessese'de, belge tipi ALIM", () => {
  const kok = govde(girdi(alimBaslik()), 2);
  assert.equal(deger(kok, "Baslik_Bilgileri", "CreditNoteTypeCode"), "ALIM");
  assert.equal(deger(kok, "Alis_Satis_Bilgileri", "Kur_Bilgisi"), "65.5");
  assert.equal(deger(kok, "Tutar_Bilgileri", "Kur_Bilgisi"), "65.5");
  assert.equal(deger(kok, "Musteri", "Uyruk"), "TR");
  assert.equal(deger(kok, "Yetkili_Muessese", "Yetkili_Muessese_Dosya_Numarası"), "B2560");
  assert.equal(deger(kok, "Odeme_Bilgileri", "Musteri_Odeme_Yontemi"), "NAKIT");
  assert.equal(deger(kok, "Odeme_Bilgileri", "Doviz_Burosu_Odeme_Yontemi"), "NAKIT");
  // Bankadan ödenen alım: büro TL'yi havale ile öder
  const banka = govde(girdi(alimBaslik({ FIS_BANKA_HESABI_ID: 12 })), 2);
  assert.equal(deger(banka, "Odeme_Bilgileri", "Musteri_Odeme_Yontemi"), "NAKIT");
  assert.equal(deger(banka, "Odeme_Bilgileri", "Doviz_Burosu_Odeme_Yontemi"), "EFTHAVALE");
});

test("Satım (ICE TEST 23.11): hesap kuru Tutar.TL_Karsilik_Kuru'da (0,017794), Kur_Bilgisi görünen TL kuru (56,2), karşılık = TL × kur", () => {
  const g = girdi(satimBaslik({ FIS_BANKA_HESABI_ID: 7 }));
  assert.equal(g.tutar.hesapKuru, 0.017794);
  const kok = govde(g, 2);
  assert.equal(deger(kok, "Baslik_Bilgileri", "CreditNoteTypeCode"), "SATIM");
  assert.equal(deger(kok, "Tutar_Bilgileri", "TL_Karsilik_Kuru"), "0.017794");
  assert.equal(deger(kok, "Tutar_Bilgileri", "Kur_Bilgisi"), "56.2");
  assert.equal(deger(kok, "Alis_Satis_Bilgileri", "Kur_Bilgisi"), "56.2");
  assert.equal(deger(kok, "Alis_Satis_Bilgileri", "TL_Karsilik_Kuru"), "56.2");
  // ICE "Hesaplanan: 2800.06384, LineExtensionAmount: 2800" diye reddetmişti: karşılık TL × hesap kuru (kuruş), miktar aynen
  assert.equal(deger(kok, "Tutar_Bilgileri", "LineExtensionAmount"), "2800.06");
  assert.equal(deger(kok, "Tutar_Bilgileri", "Miktar"), "2800");
  assert.equal(deger(kok, "Alis_Satis_Bilgileri", "Doviz_Miktar"), "2800");
  // 1.0 gövdesi değişmez: karşılık fişteki gibi, TL_Karsilik_Kuru nominal
  const k1 = govde(g, 1);
  assert.equal(deger(k1, "Tutar_Bilgileri", "LineExtensionAmount"), "2800");
  assert.equal(deger(k1, "Tutar_Bilgileri", "TL_Karsilik_Kuru"), "56.2");
  assert.equal(deger(kok, "Odeme_Bilgileri", "Musteri_Odeme_Yontemi"), "EFTHAVALE");
  assert.equal(deger(kok, "Odeme_Bilgileri", "Doviz_Burosu_Odeme_Yontemi"), "NAKIT");
  // Nakit satım
  const nakit = govde(girdi(satimBaslik()), 2);
  assert.equal(deger(nakit, "Odeme_Bilgileri", "Musteri_Odeme_Yontemi"), "NAKIT");
});

test("TL'si yuvarlanmış alım (5 × 43,5 = 217,5 → 218): hesap kuru 43,6 (ICE TEST N vakası), görünen kur 43,5, karşılık 218", () => {
  const g = girdi(alimBaslik({ MIKTAR: 5, KUR: 43.5, PayableAmount: 5, LineExtensionAmount: 218, TaxExclusiveAmount: 218, TaxInclusiveAmount: 218 }));
  assert.equal(g.tutar.hesapKuru, 43.6);
  const kok = govde(g, 2);
  assert.equal(deger(kok, "Tutar_Bilgileri", "TL_Karsilik_Kuru"), "43.6");
  assert.equal(deger(kok, "Tutar_Bilgileri", "Kur_Bilgisi"), "43.5");
  assert.equal(deger(kok, "Tutar_Bilgileri", "LineExtensionAmount"), "218");
  assert.ok(hesapKuraliTutuyor(5, 43.6, 218));
  assert.ok(!hesapKuraliTutuyor(5, 43.5, 218), "nominal kur kuralı geçemezdi");
  assert.deepEqual(edovizSurum2OnKontrol(g).hatalar, []);
});

test("Uyruk: görünümde yoksa yalnız Türk TCKN'si TR sayılır; yabancı kimlik no (99…) tahmin edilmez", () => {
  assert.equal(girdi(alimBaslik({ Customer_Person_NationalityID: "" })).musteri.uyruk, "TR");
  assert.equal(girdi(alimBaslik({ Customer_Person_NationalityID: "de" })).musteri.uyruk, "DE");
  const yabanci = girdi(alimBaslik({ Customer_Person_NationalityID: "", Customer_PartyIdentification_ID: "99123456789" }));
  assert.equal(yabanci.musteri.uyruk, "");
  assert.ok(edovizSurum2OnKontrol(yabanci).hatalar.some((h) => /uyruğu boş/.test(h)));
});

test("Şahıs müessese (11 haneli TCKN): unvan ad/soyad diye bölünür (ICE TEST 23.11 reddi), tek kelimede ön kontrol durdurur", () => {
  const sahis = dovizGirdisi({ baslik: alimBaslik({ Supplier_PartyName: "ABC KUYUMCULUK AŞ" }) }, { vknTckn: "31534209546", dosyaNo: "B2560" });
  assert.equal(sahis.yetkiliMuessese.ad, "ABC KUYUMCULUK");
  assert.equal(sahis.yetkiliMuessese.soyad, "AŞ");
  const kok = govde(sahis, 2);
  assert.equal(deger(kok, "Yetkili_Muessese", "Adi"), "ABC KUYUMCULUK");
  assert.equal(deger(kok, "Yetkili_Muessese", "Soyadi"), "AŞ");
  assert.deepEqual(edovizSurum2OnKontrol(sahis).hatalar, []);
  assert.deepEqual(edovizSurum2OnKontrol(sahis).uyarilar, [], "Person artık kendi UBL'imizde (send_edoviz), uyarı yok");
  // Tüzel (10 hane): ad/soyad yazılmaz
  const tuzel = girdi(alimBaslik({ Supplier_PartyName: "Test Döviz Ltd" }));
  assert.equal(tuzel.yetkiliMuessese.ad, undefined);
  // Tek kelimelik unvanlı şahıs: ICE'ye gitmeden durur
  const tek = dovizGirdisi({ baslik: alimBaslik({ Supplier_PartyName: "KUYUMCU" }) }, { vknTckn: "31534209546", dosyaNo: "B2560" });
  assert.ok(edovizSurum2OnKontrol(tek).hatalar.some((h) => /şahıs firması/.test(h)));
});

test("e-Belge Not: Notlar'a tek satır gider (1.0 ve 2.0), boşsa Notlar boş etiket", () => {
  const g = girdi(alimBaslik({ FIS_E_BELGE_NOT: "  Müşteri  talebiyle\r\nkesildi " }));
  assert.deepEqual(g.notlar, ["Müşteri talebiyle kesildi"]);
  for (const s of [1, 2] as const) {
    const x = buildEDovizInnerXml(LOGIN, g, s);
    assert.ok(x.includes("<Notlar><string>Müşteri talebiyle kesildi</string></Notlar>"), `sürüm ${s}`);
  }
  assert.ok(buildEDovizInnerXml(LOGIN, girdi(alimBaslik()), 2).includes("<Notlar></Notlar>"));
});

/* ---------- Ön kontrol ---------- */

test("Ön kontrol: geçerli alım ve büyük satım temiz (satımda karşılık kurla üretildiği için kural tutar)", () => {
  assert.deepEqual(edovizSurum2OnKontrol(girdi(alimBaslik())), { hatalar: [], uyarilar: [] });
  assert.deepEqual(edovizSurum2OnKontrol(girdi(satimBaslik())), { hatalar: [], uyarilar: [] });
});

test("Çok büyük alım (gerçek veri DAA2026000004761: 22.250 USD, 1.051.315 TL): fişin TL tutarları aynen (ICE TEST T vakası kabul)", () => {
  const b = alimBaslik({ PARA_KODU: "USD", MIKTAR: 22250, KUR: 47.25, PayableAmount: 22250, LineExtensionAmount: 1051315, TaxExclusiveAmount: 1051315, TaxInclusiveAmount: 1051315 });
  const g = girdi(b);
  assert.equal(g.tutar.hesapKuru, 47.250112);
  const kok = govde(g, 2);
  // 5. tur: 22.250 × 47,250112 = 1.051.314,99 iken tam 1.051.315 ile ICE hesap hatası vermedi (alımda çarpım denetlenmiyor)
  assert.equal(deger(kok, "Tutar_Bilgileri", "LineExtensionAmount"), "1051315");
  assert.equal(deger(kok, "Tutar_Bilgileri", "TaxExclusiveAmount"), "1051315");
  assert.equal(deger(kok, "Tutar_Bilgileri", "TaxInclusiveAmount"), "1051315");
  assert.equal(deger(kok, "Tutar_Bilgileri", "PayableAmount"), "22250");
  assert.deepEqual(edovizSurum2OnKontrol(g).hatalar, []);
});

test("Ön kontrol: alımda karşılık vergi hariç tutara eşit değilse durdurur (ICE kuralı)", () => {
  const g = girdi(alimBaslik());
  g.tutar.taxExclusiveAmount = 6549;
  assert.ok(edovizSurum2OnKontrol(g).hatalar.some((h) => /vergi hariç tutara/.test(h)));
});

test("Ön kontrol: hesap kuru bozuksa (sıfır) karşılık üretilemez, durdurur", () => {
  const g = girdi(alimBaslik());
  g.tutar.hesapKuru = Number.NaN;
  assert.ok(edovizSurum2OnKontrol(g).hatalar.some((h) => /hesap kuru hesaplanamadı/.test(h)));
});

test("Ön kontrol durdurur: ISO dışı para (AUX), dosya no boş, ad/soyad boş, hatalı kimlik, VKN'de unvan yok, 2 ondalık", () => {
  const h = (g: EDovizGirdi) => edovizSurum2OnKontrol(g).hatalar.join(" | ");
  assert.match(h(girdi(alimBaslik({ PARA_KODU: "AUX" }))), /ISO 4217/);
  assert.match(h(dovizGirdisi({ baslik: alimBaslik() }, { vknTckn: "1234567890" })), /Dosya No boş/);
  assert.match(h(girdi(alimBaslik({ Customer_Person_FamilyName: "" }))), /ad ve soyad/);
  assert.match(h(girdi(alimBaslik({ Customer_PartyIdentification_ID: "123456789" }))), /11 haneli TCKN ya da 10 haneli VKN/);
  assert.match(h(girdi(alimBaslik({ Customer_PartyIdentification_ID: "1234567890", Customer_PartyName: "" }))), /unvan zorunlu/);
  const g = girdi(alimBaslik());
  g.tutar.payableAmount = 100.123;
  assert.match(h(g), /en çok 2 ondalık/);
  const k = girdi(alimBaslik());
  k.tutar.hesapKuru = 0;
  assert.match(h(k), /hesap kuru hesaplanamadı/);
});

test("Ön kontrol: yalnız pasaportlu müşteri uyarı (ICE testi bekleniyor), durdurmaz", () => {
  const g = girdi(alimBaslik({ Customer_PartyIdentification_ID: "", Customer_PartyIdentification: "", Customer_PartyIdentification_PassportID: "U1234567", Customer_Person_NationalityID: "US" }));
  const s = edovizSurum2OnKontrol(g);
  assert.deepEqual(s.hatalar, []);
  assert.ok(s.uyarilar.some((u) => /yalnız pasaport/.test(u)));
});

test("ICE hesap kuralı (ICE TEST 23.11 cevaplarıyla): tutar × kur kuruşa yuvarlanır, ters yön denetlenmez", () => {
  assert.ok(hesapKuraliTutuyor(100, 50, 5000), "A/I alım geçti");
  assert.ok(hesapKuraliTutuyor(2500, 0.02, 50), "K satım (hesap hatası yoktu)");
  assert.ok(hesapKuraliTutuyor(2810, 0.017794, 50), "L satım: 50,00114 → 50,00 geçti (ters yön 2809,94 ≠ 2810 denetlenmedi)");
  assert.ok(!hesapKuraliTutuyor(157360, 0.017794, 2800), "M satım: 'Hesaplanan: 2800.06384' reddedildi");
  assert.ok(hesapKuraliTutuyor(157360, 0.017794, 2800.06), "M düzeltmesi: karşılık 2800,06");
  assert.ok(!hesapKuraliTutuyor(2500, 50, 50), "B/B2 satım: 'Hesaplanan: 125000.00' reddedildi");
  assert.ok(!hesapKuraliTutuyor(100, 0, 0));
});

/* ---------- 2.0 UBL (send_edoviz, K11) ---------- */

const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", removeNSPrefix: true, parseTagValue: false });
const ubl = (g: EDovizGirdi) => ublParser.parse(edovizSurum2Ubl(g)).CreditNote;
const metinOf = (v: any) => (v && typeof v === "object" ? String(v["#text"] ?? "") : String(v ?? ""));

test("UBL alım (tüzel): GİB v1.3 alanları — SUBENO, MUSTERITURU, Person+uyruk, 2 PaymentMeans, USD karşılığı, yönlü kur, para birimleri, XSLT", () => {
  const c = ubl(girdi(alimBaslik()));
  assert.equal(c.ProfileID, "EDOVIZBELGE");
  assert.equal(c.CreditNoteTypeCode, "ALIM");
  assert.equal(c.ID, "DAA2026000019678");
  assert.equal(c.IssueDate, "2026-11-30");
  assert.equal(c.IssueTime, "13:15:00", "TR saati");
  const sup = c.AccountingSupplierParty.Party;
  const supId = ([] as any[]).concat(sup.PartyIdentification).map((p: any) => `${p.ID["@schemeID"]}=${metinOf(p.ID)}`);
  assert.deepEqual(supId, ["VKN=1234567890", "SUBENO=B2560"]);
  assert.equal(sup.Person, undefined, "tüzel müessesede Person yok");
  const cus = c.AccountingCustomerParty.Party;
  const cusId = ([] as any[]).concat(cus.PartyIdentification).map((p: any) => `${p.ID["@schemeID"]}=${metinOf(p.ID)}`);
  assert.deepEqual(cusId, ["TCKN=12345678901", "MUSTERITURU=GERCEKKISI"]);
  assert.deepEqual([cus.Person.FirstName, cus.Person.FamilyName, cus.Person.NationalityID], ["Ayşe", "Yılmaz", "TR"]);
  const pm = ([] as any[]).concat(c.PaymentMeans);
  assert.equal(pm.length, 2);
  assert.equal(metinOf(pm[0].PaymentMeansCode), "10");
  assert.equal(metinOf(pm[0].PayerFinancialAccount.ID), "0");
  assert.equal(metinOf(pm[1].PaymentMeansCode), "10");
  assert.equal(metinOf(pm[1].PayeeFinancialAccount.ID), "0");
  // USD karşılığı: GBP 65,5 / USD gişe 51,2 = 1,279297 (ICE bu alan yokken belgeyi kaydedemedi)
  const fk = c.PricingExchangeRate;
  assert.deepEqual([fk.SourceCurrencyCode, fk.TargetCurrencyCode, fk.CalculationRate], ["GBP", "USD", "1.279297"]);
  const ok = c.PaymentExchangeRate;
  assert.deepEqual([ok.SourceCurrencyCode, ok.TargetCurrencyCode, ok.CalculationRate], ["GBP", "TRY", "65.5"]);
  const t = c.LegalMonetaryTotal;
  assert.deepEqual([metinOf(t.LineExtensionAmount), t.LineExtensionAmount["@currencyID"]], ["6550.00", "TRY"]);
  assert.deepEqual([metinOf(t.PayableAmount), t.PayableAmount["@currencyID"]], ["100.00", "GBP"]);
  const refler = ([] as any[]).concat(c.AdditionalDocumentReference);
  const xslt = refler.find((r: any) => r.DocumentType === "XSLT");
  assert.ok(xslt, "XSLT eki var");
  const sablon = Buffer.from(metinOf(xslt.Attachment.EmbeddedDocumentBinaryObject), "base64").toString("utf8");
  assert.equal(sablon, fs.readFileSync(path.join(KOK, "Backend/belge/xslt/edovizAlim.xslt"), "utf8"), "GİB alım şablonu değişmeden");
  assert.ok(refler.some((r: any) => r.DocumentTypeCode === "ISTATISTIKNO" && metinOf(r.ID) === "9249"));
  assert.equal(metinOf(c.TaxTotal.TaxSubtotal.TaxCategory.TaxScheme.TaxTypeCode), "0021");
});

test("UBL satım (şahıs müessese, banka): Person (unvandan ad/soyad, uyruk TR), müşteri EFT 46/IBAN, TRY→döviz kur, karşılık 2.800,06", () => {
  const g = dovizGirdisi(
    { baslik: satimBaslik({ FIS_BANKA_HESABI_ID: 7, Supplier_PartyName: "AHMET YILMAZ KUYUMCULUK" }) },
    { vknTckn: "31534209546", dosyaNo: "B2560" }
  );
  const c = ubl(g);
  assert.equal(c.CreditNoteTypeCode, "SATIM");
  const sup = c.AccountingSupplierParty.Party;
  assert.equal(([] as any[]).concat(sup.PartyIdentification)[0].ID["@schemeID"], "TCKN");
  assert.deepEqual([sup.Person.FirstName, sup.Person.FamilyName, sup.Person.NationalityID], ["AHMET YILMAZ", "KUYUMCULUK", "TR"]);
  assert.equal(c.Signature.ID["@schemeID"], "VKN_TCKN");
  const pm = ([] as any[]).concat(c.PaymentMeans);
  assert.deepEqual([metinOf(pm[0].PaymentMeansCode), metinOf(pm[0].PayerFinancialAccount.ID)], ["46", "TR000000000000000000000000"]);
  assert.deepEqual([metinOf(pm[1].PaymentMeansCode), metinOf(pm[1].PayeeFinancialAccount.ID)], ["10", "0"]);
  const ok = c.PaymentExchangeRate;
  assert.deepEqual([ok.SourceCurrencyCode, ok.TargetCurrencyCode, ok.CalculationRate], ["TRY", "EUR", "0.017794"]);
  assert.equal(c.PricingExchangeRate.CalculationRate, "1.097656", "EUR 56,2 / USD 51,2");
  const t = c.LegalMonetaryTotal;
  assert.deepEqual([metinOf(t.LineExtensionAmount), t.LineExtensionAmount["@currencyID"]], ["2800.06", "EUR"]);
  assert.deepEqual([metinOf(t.PayableAmount), t.PayableAmount["@currencyID"]], ["157360.00", "TRY"]);
  assert.deepEqual([metinOf(t.TaxExclusiveAmount), t.TaxExclusiveAmount["@currencyID"]], ["157360.00", "TRY"]);
  const xslt = ([] as any[]).concat(c.AdditionalDocumentReference).find((r: any) => r.DocumentType === "XSLT");
  const sablon = Buffer.from(metinOf(xslt.Attachment.EmbeddedDocumentBinaryObject), "base64").toString("utf8");
  assert.equal(sablon, fs.readFileSync(path.join(KOK, "Backend/belge/xslt/edovizSatim.xslt"), "utf8"), "GİB satım şablonu değişmeden");
});

test("UBL: USD belgede USD karşılığı USD→USD 1; USD gişe kuru yoksa ön kontrol durdurur; e-Belge Not ve kaçış", () => {
  const usd = ubl(girdi(alimBaslik({ PARA_KODU: "USD", KUR: 51.2, PayableAmount: 100, LineExtensionAmount: 5120, TaxExclusiveAmount: 5120, TaxInclusiveAmount: 5120 })));
  const fk = usd.PricingExchangeRate;
  assert.deepEqual([fk.SourceCurrencyCode, fk.TargetCurrencyCode, fk.CalculationRate], ["USD", "USD", "1"]);
  const kursuz = girdi(alimBaslik({ FIS_GISE_USD_KURU: null }));
  assert.ok(edovizSurum2OnKontrol(kursuz).hatalar.some((h) => /USD karşılık kuru/.test(h)));
  const xml = edovizSurum2Ubl(girdi(alimBaslik({ FIS_E_BELGE_NOT: "A&B <not>", Supplier_PartyName: "X & Y Döviz" })));
  assert.ok(xml.includes("<cbc:Note>A&amp;B &lt;not&gt;</cbc:Note>"));
  assert.ok(xml.includes("<cbc:Name>X &amp; Y Döviz</cbc:Name>"));
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><CreditNote '));
});

test("Gönderim yolu: 2.0'da send_edoviz (tek kat Base64 UBL), 1.0'da send_edoviz_basic", async () => {
  const cagrilar: { method: string; govde: string }[] = [];
  const eskiFetch = globalThis.fetch;
  const eskiOrtam = process.env.EDOVIZ_SURUM;
  globalThis.fetch = (async (_url: any, init: any) => {
    const method = String(init?.headers?.SOAPAction || "").split("/").pop()!.replaceAll('"', "");
    cagrilar.push({ method, govde: String(init?.body || "") });
    const deger: Record<string, string> = {
      Login:
        "<isSuccecss>true</isSuccecss><Login_Request_Header><Session_ID>s</Session_ID><IP_Number>1</IP_Number><Security_Key>k</Security_Key></Login_Request_Header>",
      send_edoviz: "<success>true</success><response_code>0</response_code><response_message>Başarı ile tamamlandı</response_message>",
      send_edoviz_basic: "<success>true</success><response_code>0</response_code>",
    };
    return new Response(
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method}Response><${method}Result>${deger[method]}</${method}Result></${method}Response></soap:Body></soap:Envelope>`
    );
  }) as any;
  try {
    const config = { servisUrl: ICE_TEST, kullaniciAdi: "t", sifre: "t", uygulamaAdi: "t", uygulamaSurum: "1" } as any;
    const g = girdi(alimBaslik());
    process.env.EDOVIZ_SURUM = "2";
    const s2 = await sendEDoviz(config, g);
    assert.equal(String(s2.success), "true");
    const gonderim = cagrilar.find((c) => c.method === "send_edoviz");
    assert.ok(gonderim, "2.0 send_edoviz çağırmalı");
    const b64 = gonderim!.govde.match(/<edoviz_creditnote>([^<]*)</)![1];
    const icerik = Buffer.from(b64, "base64").toString("utf8");
    assert.ok(icerik.startsWith("<?xml") && icerik.includes("<cbc:ID>DAA2026000019678</cbc:ID>"), "tek kat Base64 UBL");
    assert.equal(icerik, edovizSurum2Ubl(g));
    cagrilar.length = 0;
    process.env.EDOVIZ_SURUM = "1";
    await sendEDoviz(config, g);
    assert.deepEqual(cagrilar.filter((c) => c.method !== "Login").map((c) => c.method), ["send_edoviz_basic"]);
  } finally {
    globalThis.fetch = eskiFetch;
    if (eskiOrtam === undefined) delete process.env.EDOVIZ_SURUM;
    else process.env.EDOVIZ_SURUM = eskiOrtam;
  }
});

test("surum2Tutarlari: alım fişteki gibi; satım karşılığı TL × kur", () => {
  assert.deepEqual(surum2Tutarlari(girdi(alimBaslik())), { karsilik: 6550, vergiHaric: 6550, vergiDahil: 6550 });
  assert.deepEqual(surum2Tutarlari(girdi(satimBaslik())), { karsilik: 2800.06, vergiHaric: 157360, vergiDahil: 157360 });
});
