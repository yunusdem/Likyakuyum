/**
 * Kuyum faturası (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF7, EF8, EF13, EF16, U3–U5) — çevrimdışı test.
 * Gerçek ICE veya SQL bağlantısı kullanılmaz. Çalıştırma: npx tsx --test scripts/kuyum-fatura-test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ebankaGiderGirdisi,
  ebankaSatisGirdisi,
  iscilikCoz,
  iscilikSizSatir,
  kuyumSatirAdi,
  kuyumSatisCoz,
  kuyumUblSatirlari,
  sarrafKuyumCoz,
  yalnizYazisi,
} from "../src/services/kuyumFatura.js";
import { buildInvoiceXml, hesapla, UblTaraf } from "../src/services/ice/ubl/invoiceBuilder.js";
import { buildGiderPusulasiXml, hesaplaGiderPusulasi } from "../src/services/ice/ubl/giderPusulasiBuilder.js";
import { sarrafFaturaGirdisi, sarrafSatirKdvleri } from "../src/services/ebelgeSarraf.js";

const r2 = (n: number) => Math.round(n * 100) / 100;
const gonderici: UblTaraf = { vknTckn: "1234567890", unvan: "DENEME KUYUMCULUK", il: "KAHRAMANMARAŞ", ilce: "DULKADİROĞLU", vergiDairesi: "AKSU" };
const alici: UblTaraf = { vknTckn: "31198708850", unvan: "MUHAMMED BAHRİ GÖDEOĞLU", ad: "MUHAMMED BAHRİ", soyad: "GÖDEOĞLU", il: "KAHRAMANMARAŞ", ilce: "ONİKİŞUBAT", adres: "YAMAÇTEPE MAH." };

// Deterministik rastgele (testler her çalıştırmada aynı)
let tohum = 20261031;
const rastgele = () => ((tohum = (tohum * 1103515245 + 12345) % 2147483648) / 2147483648);

test("işçilik çözücü: bulduğu her değer kuruşu kuruşuna tutar, boşluklar ~%17", () => {
  let bos = 0;
  for (let k = 1; k <= 100000; k++) {
    const kalan = k / 100;
    const m = iscilikCoz(kalan, 20);
    if (m === null) { bos++; continue; }
    assert.ok(m >= 0);
    assert.equal(r2(m + r2((m * 20) / 100)), kalan, `kalan ${kalan}`);
  }
  assert.ok(bos > 10000 && bos < 25000, `boş ${bos}`);
  assert.equal(iscilikCoz(0, 20), 0);
  assert.equal(iscilikCoz(12.34, 0), 12.34);
  assert.equal(iscilikCoz(-1, 20), null);
});

test("Kütükçü e-Fatura örneği: 3,9 gr × 5.706 → işçilik 346,60 + KDV 69,32 = 22.669,32", () => {
  const c = kuyumSatisCoz([{ ad: "22 ayar altın", miktar: 3.9, birimKodu: "GRM", birimFiyat: 5706 }], 22669.32, 20);
  assert.equal(c.altinlar[0].tutar, 22253.4);
  assert.deepEqual(c.iscilik, { matrah: 346.6, oran: 20, kdv: 69.32 });
  assert.equal(c.fiyatKaydi, null);
});

test("Kütükçü e-Arşiv örneği: 43,66 gr × 5.706 → işçilik 876,04 + KDV 175,21 = 250.175,21", () => {
  const c = kuyumSatisCoz([{ ad: "22 ayar altın", miktar: 43.66, birimKodu: "GRM", birimFiyat: 5706 }], 250175.21, 20);
  assert.equal(c.altinlar[0].tutar, 249123.96);
  assert.deepEqual(c.iscilik, { matrah: 876.04, oran: 20, kdv: 175.21 });
});

test("EF8: 1500 TL gelen para → fatura toplamı 1500,00 (2000 rastgele durum, fiyat en çok birkaç kuruş kayar)", () => {
  for (let i = 0; i < 2000; i++) {
    const gram = r2(0.01 + rastgele() * 300);
    const fiyat = r2(1000 + rastgele() * 6000);
    const altin = r2(gram * fiyat);
    const hedef = r2(altin + rastgele() * altin * 0.05 + (i % 7 === 0 ? 0 : 0.01));
    const c = kuyumSatisCoz([{ ad: "22 ayar altın", miktar: gram, birimKodu: "GRM", birimFiyat: fiyat }], hedef, i % 5 === 0 ? 10 : 20);
    const ozet = hesapla(kuyumUblSatirlari(c));
    assert.equal(ozet.odenecekTutar, hedef, `durum ${i}: ${gram} gr × ${fiyat} → ${hedef}`);
    // Kayma sınırlı: fiyat en çok 10 kuruş, ya da fiyat aynı kalıp en çok 5 kuruş satır iskontosu
    if (c.fiyatKaydi) assert.ok(Math.abs(c.fiyatKaydi.yeni - c.fiyatKaydi.eski) <= 0.101, `kayma ${JSON.stringify(c.fiyatKaydi)} ${gram} gr`);
    assert.ok((c.altinlar[0].iskonto || 0) <= 0.05);
  }
});

test("U4: gram 6'nın katıysa fiyat kaydırmak yetmez → 1 kuruş iskonto, fiyat aynı, toplam tam", () => {
  const c = kuyumSatisCoz([{ ad: "22 ayar altın", miktar: 6, birimKodu: "GRM", birimFiyat: 5000 }], 30000.03, 20);
  assert.equal(c.fiyatKaydi, null);
  assert.equal(c.altinlar[0].iskonto, 0.01);
  assert.equal(c.altinlar[0].birimFiyat, 5000);
  assert.equal(hesapla(kuyumUblSatirlari(c)).odenecekTutar, 30000.03);
  for (const gram of [6, 12, 18, 300, 1.2, 0.6]) {
    for (let k = 1; k <= 60; k++) {
      const hedef = r2(gram * 5000 + k / 100);
      assert.equal(hesapla(kuyumUblSatirlari(kuyumSatisCoz([{ ad: "x", miktar: gram, birimKodu: "GRM", birimFiyat: 5000 }], hedef, 20))).odenecekTutar, hedef, `${gram} gr ${hedef}`);
    }
  }
});

test("EF9: altın tutarı gelen parayı aşarsa hata", () => {
  assert.throws(() => kuyumSatisCoz([{ ad: "22 ayar altın", miktar: 0.285, birimKodu: "GRM", birimFiyat: 5746.03 }], 1500, 20), /aşıyor/);
});

test("Birden çok altın satırı + tek işçilik satırı", () => {
  const c = kuyumSatisCoz(
    [
      { ad: "22 ayar altın", miktar: 10, birimKodu: "GRM", birimFiyat: 5700 },
      { ad: "14 ayar altın", miktar: 5.25, birimKodu: "GRM", birimFiyat: 3650.5 },
      { ad: "Çeyrek Altın", miktar: 2, birimKodu: "C62", birimFiyat: 9500 },
    ],
    100000,
    20
  );
  const satirlar = kuyumUblSatirlari(c);
  assert.equal(satirlar.length, 4);
  assert.equal(satirlar[3].ad, "işçilik");
  assert.equal(hesapla(satirlar).odenecekTutar, 100000);
});

test("Ayar adı: ürün adı, has oranı, milyem; gümüş kendi adıyla", () => {
  assert.equal(kuyumSatirAdi({ ad: "22 AYAR BİLEZİK" }), "22 ayar altın");
  assert.equal(kuyumSatirAdi({ ad: "KOLYE", hasOrani: 0.585 }), "14 ayar altın");
  assert.equal(kuyumSatirAdi({ ad: "HURDA", hasOrani: 0, milyem: 0.916 }), "22 ayar altın");
  assert.equal(kuyumSatirAdi({ ad: "HAS ALTIN", hasOrani: 0.995 }), "24 ayar altın");
  assert.equal(kuyumSatirAdi({ ad: "925 GÜMÜŞ KOLYE", hasOrani: 0.925 }), "925 GÜMÜŞ KOLYE");
  assert.equal(kuyumSatirAdi({ ad: "ÖZEL ÜRÜN", milyem: 0.95 }), "ÖZEL ÜRÜN");
});

test("İşçiliksiz satır: 2 haneli fiyat tutmazsa 1 adet, gram ada yazılır", () => {
  const tam = iscilikSizSatir({ ad: "22 ayar altın", miktar: 3.9, birimKodu: "GRM", birimFiyat: 0 }, 22253.4);
  assert.deepEqual([tam.miktar, tam.birimKodu, tam.birimFiyat, tam.tutar], [3.9, "GRM", 5706, 22253.4]);
  const kesirli = iscilikSizSatir({ ad: "22 ayar altın", miktar: 3.9, birimKodu: "GRM", birimFiyat: 0 }, 22253.41);
  assert.deepEqual([kesirli.ad, kesirli.miktar, kesirli.birimKodu, kesirli.tutar], ["22 ayar altın (3,9 gr)", 1, "C62", 22253.41]);
});

test("Yazıyla tutar: Kütükçü örneği", () => {
  assert.equal(yalnizYazisi(22669.32), "YALNIZ YİRMİİKİBİNALTIYÜZALTMIŞDOKUZ TÜRK LİRASI OTUZİKİ KURUŞ");
  assert.equal(yalnizYazisi(1500), "YALNIZ BİNBEŞYÜZ TÜRK LİRASI");
});

test("e-Banka satış girdisi: ÖZELMATRAH, altın %0 + 805, işçilik %20, toplam = gelen para; XML üretilir", () => {
  const { girdi, cozum } = ebankaSatisGirdisi(
    { altinlar: [{ ad: "22 ayar altın", miktar: 0.26, birimKodu: "GRM", birimFiyat: 5746.03 }], iscilikKdvOrani: 20 },
    1500,
    { belgeNo: "KKA2026000000001", tarih: "2026-10-31", alici, odemeNotu: "Garanti BBVA" }
  );
  assert.equal(girdi.faturaTipi, "OZELMATRAH");
  assert.equal(girdi.gorunum, "KUYUM");
  assert.deepEqual(girdi.notlar, ["YALNIZ BİNBEŞYÜZ TÜRK LİRASI", "Ödeme Notu: Garanti BBVA"]);
  assert.equal(girdi.satirlar[0].istisnaKodu, "805");
  assert.equal(girdi.satirlar[0].kdvOrani, 0);
  assert.equal(girdi.satirlar[1].kdvOrani, 20);
  assert.ok(cozum.iscilik);
  const { xml, ozet } = buildInvoiceXml({ ...girdi, senaryo: "EARSIVFATURA", gonderici });
  assert.equal(ozet.odenecekTutar, 1500);
  assert.match(xml, /<cbc:InvoiceTypeCode>OZELMATRAH<\/cbc:InvoiceTypeCode>/);
  assert.match(xml, /<cbc:Percent>0<\/cbc:Percent>.*?<cbc:TaxExemptionReasonCode>805<\/cbc:TaxExemptionReasonCode>/s);
  assert.match(xml, /<cbc:PayableAmount currencyID="TRY">1500.00<\/cbc:PayableAmount>/);
  // Kütükçü şablonu Base64 ek olarak (EF19, U7)
  assert.match(xml, /filename="KKA2026000000001\.xslt"/);
});

test("ÖZELMATRAH tipinde ne özel matrah ne 805 %0 satırı varsa doğrulama durdurur", () => {
  assert.throws(
    () => buildInvoiceXml({ belgeNo: "KKA2026000000001", tarih: "2026-10-31", senaryo: "EARSIVFATURA", faturaTipi: "OZELMATRAH", gonderici, alici, satirlar: [{ ad: "işçilik", miktar: 1, birimFiyat: 100, kdvOrani: 20 }] }),
    /özel matrah/
  );
});

test("e-Banka gider pusulası: işçiliksiz tek satır / işçilikli iki satır, toplam = ödenen; VKN'li satıcı reddedilir", () => {
  const ortak = { belgeNo: "GDR2026000000001", tarih: "2026-10-31", alici: { ...alici, unvan: "" } };
  const tek = ebankaGiderGirdisi({ altin: { ad: "22 Ayar Altın", miktar: 0.26, birimKodu: "GRM", birimFiyat: 5746.03, milyem: 0.916 } }, 1500, ortak);
  assert.equal(tek.satirlar.length, 1);
  assert.equal(tek.satirlar[0].ad, "22 AYAR ALTIN (Milyem 916, Has 0,238 gr)");
  assert.equal(tek.vergiTuruKodu, "0003");
  assert.equal(hesaplaGiderPusulasi(tek.satirlar, "0003").odenecekTutar, 1500);
  const iki = ebankaGiderGirdisi({ altin: { ad: "22 Ayar Altın", miktar: 0.25, birimKodu: "GRM", birimFiyat: 5746.03 }, iscilik: 63.49 }, 1500, ortak);
  assert.equal(iki.satirlar.length, 2);
  assert.equal(iki.satirlar[1].ad, "İŞÇİLİK");
  assert.equal(hesaplaGiderPusulasi(iki.satirlar, "0003").odenecekTutar, 1500);
  const { ozet } = buildGiderPusulasiXml({ ...iki, gonderici });
  assert.equal(ozet.odenecekTutar, 1500);
  assert.throws(() => ebankaGiderGirdisi({ altin: { ad: "x", miktar: 1, birimKodu: "GRM", birimFiyat: 1 } }, 1500, { ...ortak, alici: { ...alici, vknTckn: "1234567890" } }), /Mükellef/);
  for (let i = 0; i < 1000; i++) {
    const gram = r2(0.01 + rastgele() * 200);
    const hedef = r2(10 + rastgele() * 500000);
    const g = ebankaGiderGirdisi({ altin: { ad: "22 Ayar Altın", miktar: gram, birimKodu: "GRM", birimFiyat: 1 } }, hedef, ortak);
    assert.equal(hesaplaGiderPusulasi(g.satirlar, "0003").odenecekTutar, hedef, `${gram} gr → ${hedef}`);
  }
});

test("Sarraf satış fişi (EF16): KDV'li fiş → altın satırları + tek işçilik, toplam fiş toplamı; KDV'siz fiş → yalnız altın", () => {
  const baslik = { SARRAF_FISI_ID: 1, TIP: 1, BELGE_TURU: 1, TARIH: "2026-10-31T10:00:00Z", UNVAN: "ALİM CAN KAPTANOĞLU", VERGI_KIMLIK_NO: "39685429264", IL_ADI: "KAHRAMANMARAŞ", ILCE_ADI: "ONİKİŞUBAT", KDV_ORANI: 20, KDV: 500 };
  const satirlar = [
    { SATIR_NO: 1, URUN_ADI: "22 AYAR BİLEZİK", URUN_BIRIM: 1, MIKTAR: 12.5, ADET: 1, ISCILIK_HAS_GRAM: 0.4, TUTAR: 72632.29, MILYEM: 0.916, PARA_HAS_ORANI: 0.916, URUN_TIPI: 1 },
    { SATIR_NO: 2, URUN_ADI: "ÇEYREK ALTIN", URUN_BIRIM: 0, MIKTAR: 0, ADET: 2, ISCILIK_HAS_GRAM: 0, TUTAR: 19000, MILYEM: 0, PARA_HAS_ORANI: 0, URUN_TIPI: 3 },
  ];
  const kdvler = sarrafSatirKdvleri(baslik, satirlar);
  const c = sarrafKuyumCoz(satirlar, kdvler, 20);
  assert.equal(c.altinlar[0].ad, "22 ayar altın");
  assert.equal(c.altinlar[1].ad, "ÇEYREK ALTIN");
  assert.equal(c.altinlar[1].birimKodu, "C62");
  assert.equal(c.iscilik?.oran, 20);
  assert.ok(Math.abs((c.iscilik?.kdv || 0) - 500) <= 0.05);
  const girdi = sarrafFaturaGirdisi({ baslik, satirlar }, "KKA2026000000002");
  assert.equal(girdi.senaryo, "TICARIFATURA");
  assert.equal(girdi.faturaTipi, "OZELMATRAH");
  const { ozet } = buildInvoiceXml({ ...girdi, gonderici });
  assert.equal(ozet.odenecekTutar, 91632.29);

  const kdvsiz = sarrafFaturaGirdisi({ baslik: { ...baslik, KDV: 0, KDV_ORANI: 0, VERGI_KIMLIK_NO: "" }, satirlar: [{ ...satirlar[0], MIKTAR: 36, TUTAR: 212850, ISCILIK_HAS_GRAM: 0 }] }, "KKA2026000000003");
  assert.equal(kdvsiz.senaryo, "EARSIVFATURA");
  assert.equal(kdvsiz.satirlar.length, 1);
  assert.deepEqual([kdvsiz.satirlar[0].miktar, kdvsiz.satirlar[0].birimFiyat, kdvsiz.satirlar[0].istisnaKodu], [36, 5912.5, "805"]);
  assert.equal(buildInvoiceXml({ ...kdvsiz, gonderici }).ozet.odenecekTutar, 212850);
});

test("Perakende alış (EF18): kuyum adı, 0003 %0, KDV'li fiş onaysız durur, onayla ödenen tutar", async () => {
  const { perakendeKuyumGiderGirdisi } = await import("../src/services/ebelgePerakende.js");
  const baslik = { FATURA_ID: 5, FATURA_NO: "GDR2026000000005", TARIH: "2026-10-31T09:00:00Z", FATURA_TIPI: 0, ALICI_VKN_TCKN: "39685429264", ALICI_UNVAN: "ALİM CAN KAPTANOĞLU", IL: "KAHRAMANMARAŞ", ILCE: "ONİKİŞUBAT", ADRES: "NECİPFAZIL MAH.", GENEL_TOPLAM: 66512.5 };
  const satir = { SATIR_NO: 1, URUN_ADI: "Bilezik", AYAR: "22", MIKTAR: 11.5, BIRIM: "Gram", GRAM: 11.5, HAS_GRAM: 10.534, TUTAR: 66512.5, KDV_ORANI: 0, KDV_TUTARI: 0 };
  const g = perakendeKuyumGiderGirdisi({ baslik, satirlar: [satir] });
  assert.equal(g.satirlar[0].ad, "BİLEZİK 22 AYAR (Milyem 916, Has 10,534 gr)");
  assert.equal(g.vergiTuruKodu, "0003");
  assert.equal(hesaplaGiderPusulasi(g.satirlar, "0003").odenecekTutar, 66512.5);
  const kdvli = { baslik: { ...baslik, GENEL_TOPLAM: 66612.5 }, satirlar: [{ ...satir, KDV_ORANI: 20, KDV_TUTARI: 100 }] };
  assert.throws(() => perakendeKuyumGiderGirdisi(kdvli), /onay/);
  assert.equal(hesaplaGiderPusulasi(perakendeKuyumGiderGirdisi(kdvli, { kdvSifir: true }).satirlar, "0003").odenecekTutar, 66612.5);
  assert.throws(() => perakendeKuyumGiderGirdisi({ baslik: { ...baslik, ALICI_VKN_TCKN: "1234567890" }, satirlar: [satir] }), /Mükellef/);
});

test("Perakende satış (EF17, EF27): satırlar aynı, Kuyum görünümü + yazıyla tutar; Ticari satışta görünüm yok", async () => {
  const { perakendeSatisGirdisi } = await import("../src/services/ebelgeKaynak.service.js");
  const baslik = { FATURA_ID: 6, FATURA_NO: "EAR2026000000006", TARIH: "2026-10-31T09:00:00Z", FATURA_TIPI: 1, ALICI_VKN_TCKN: "", GENEL_TOPLAM: 1200, E_FATURA_KDV_MUAFIYET_KODU: "350", E_FATURA_KDV_MUAFIYET_ADI: "Diğer" };
  const satir = { SATIR_NO: 1, URUN_ADI: "Saat", MIKTAR: 1, BIRIM: "Adet", BIRIM_FIYAT: 1000, TUTAR: 1000, KDV_ORANI: 20, KDV_TUTARI: 200 };
  const g = perakendeSatisGirdisi({ baslik, satirlar: [satir] });
  assert.equal(g.gorunum, "KUYUM");
  assert.deepEqual(g.notlar, ["YALNIZ BİNİKİYÜZ TÜRK LİRASI"]);
  assert.equal(g.faturaTipi, "SATIS");
  assert.equal(perakendeSatisGirdisi({ baslik: { ...baslik, FIS_KAYNAGI: 1 }, satirlar: [satir] }).gorunum, undefined);
});

test("KDV kodu (EF29–EF34): 805 / 808 ön değer, başka kod tüm satırlara, koda göre fatura tipi", async () => {
  const { satirKodu, kuyumFaturaTipi } = await import("../src/services/kuyumKodlari.js");
  assert.deepEqual([satirKodu(null, false), satirKodu("", true), satirKodu("805", true), satirKodu("230", true), satirKodu("230", false)], ["805", "808", "808", "230", "230"]);
  assert.deepEqual([kuyumFaturaTipi(["805", "808"]), kuyumFaturaTipi(["230"]), kuyumFaturaTipi(["805", "230"])], ["OZELMATRAH", "ISTISNA", null]);

  const baslik = { SARRAF_FISI_ID: 9, TIP: 1, BELGE_TURU: 1, TARIH: "2026-10-31T10:00:00Z", UNVAN: "ALİM CAN KAPTANOĞLU", VERGI_KIMLIK_NO: "39685429264", IL_ADI: "KAHRAMANMARAŞ", ILCE_ADI: "ONİKİŞUBAT", KDV_ORANI: 20, KDV: 300 };
  const satirlar = [
    { SATIR_NO: 1, URUN_ADI: "22 AYAR BİLEZİK", URUN_BIRIM: 1, MIKTAR: 10, ADET: 1, ISCILIK_HAS_GRAM: 0.3, TUTAR: 60000, MILYEM: 0.916, PARA_HAS_ORANI: 0.916, URUN_TIPI: 1 },
    { SATIR_NO: 2, URUN_ADI: "925 GÜMÜŞ KOLYE", URUN_BIRIM: 1, MIKTAR: 20, ADET: 1, ISCILIK_HAS_GRAM: 0.1, TUTAR: 2000, MILYEM: 0.925, PARA_HAS_ORANI: 0.925, URUN_TIPI: 2 },
  ];
  // Altın + gümüş birlikte: ikisi de yazılır, altta iki ayrı istisna sebebi
  const g = sarrafFaturaGirdisi({ baslik, satirlar }, "KKA2026000000010");
  assert.deepEqual([g.faturaTipi, g.satirlar.map((s) => s.istisnaKodu || "")], ["OZELMATRAH", ["805", "808", ""]]);
  const { xml, ozet } = buildInvoiceXml({ ...g, gonderici });
  assert.equal(ozet.odenecekTutar, 62000);
  assert.equal((xml.match(/<cbc:TaxExemptionReasonCode>/g) || []).length, 4); // 2 belge düzeyi + 2 satır
  assert.match(xml, /Gümüşten mamul/);
  // Fişte 230 seçili: tüm altın satırları 230, işçilik %20, tip İSTİSNA (Kütükçü yapısı)
  const ist = sarrafFaturaGirdisi({ baslik: { ...baslik, E_BELGE_ISTISNA_KODU: "230" }, satirlar }, "KKA2026000000011");
  assert.deepEqual([ist.faturaTipi, ist.satirlar.map((s) => s.istisnaKodu || "")], ["ISTISNA", ["230", "230", ""]]);
  assert.match(buildInvoiceXml({ ...ist, gonderici }).xml, /<cbc:InvoiceTypeCode>ISTISNA<\/cbc:InvoiceTypeCode>/);
  // e-Banka: satır başına kod; karışık kod reddedilir
  const ortak = { belgeNo: "KKA2026000000012", tarih: "2026-10-31", alici };
  assert.throws(() => ebankaSatisGirdisi({ altinlar: [{ ad: "x", miktar: 1, birimKodu: "GRM", birimFiyat: 100, kod: "805" }, { ad: "y", miktar: 1, birimKodu: "GRM", birimFiyat: 100, kod: "230" }], iscilikKdvOrani: 20 }, 250, ortak), /birlikte olamaz/);
  const { ebankaBelgeSemasi } = await import("../src/services/ebankaBelge.service.js");
  const p = ebankaBelgeSemasi.safeParse({ vomsisId: 1, alici: { vknTckn: "39685429264" }, satis: { altinlar: [{ ad: "x", miktar: 1, birimKodu: "GRM", birimFiyat: 1, kod: "999" }], iscilikKdvOrani: 20 } });
  assert.equal(p.success, false);
});

test("İşçilik (TL) sütunu (EF35): fişte KDV oranı yokken işçilik satırı sütundan, %20 KDV, toplam fiş toplamı (Kütükçü örneği)", () => {
  const baslik = { SARRAF_FISI_ID: 20, TIP: 1, BELGE_TURU: 1, TARIH: "2026-10-31T10:00:00Z", UNVAN: "MUHAMMED BAHRİ GÖDEOĞLU", VERGI_KIMLIK_NO: "31198708850", IL_ADI: "KAHRAMANMARAŞ", ILCE_ADI: "ONİKİŞUBAT", KDV_ORANI: null, KDV: 0 };
  const satir = { SATIR_NO: 1, URUN_ADI: "22 AYAR BİLEZİK", URUN_BIRIM: 1, MIKTAR: 3.9, ADET: 1, ISCILIK_HAS_GRAM: 0, TUTAR: 22669.32, MILYEM: 0.916, PARA_HAS_ORANI: 0.916, URUN_TIPI: 1, ISCILIK_TUTARI: 346.6 };
  const g = sarrafFaturaGirdisi({ baslik, satirlar: [satir] }, "KKF2026000000275");
  assert.equal(g.faturaTipi, "OZELMATRAH");
  assert.deepEqual(g.satirlar.map((s) => [s.ad, s.miktar, s.birimFiyat, s.kdvOrani, s.istisnaKodu || ""]), [["22 ayar altın", 3.9, 5706, 0, "805"], ["işçilik", 1, 346.6, 20, ""]]);
  const { ozet } = buildInvoiceXml({ ...g, gonderici });
  assert.deepEqual([ozet.kdvToplam, ozet.odenecekTutar], [69.32, 22669.32]);
  // Fişte oran varsa o oranla (eski fiş) — işçilik yine sütundan
  const g10 = sarrafFaturaGirdisi({ baslik: { ...baslik, KDV_ORANI: 10, KDV: 0 }, satirlar: [satir] }, "KKF2026000000276");
  assert.equal(g10.satirlar[1].kdvOrani, 10);
  assert.equal(buildInvoiceXml({ ...g10, gonderici }).ozet.odenecekTutar, 22669.32);
  // Sütun boş, KDV yok → tek altın satırı; iki satırdan biri dolu → tek işçilik satırında toplanır
  assert.equal(sarrafFaturaGirdisi({ baslik, satirlar: [{ ...satir, ISCILIK_TUTARI: 0, TUTAR: 22253.4 }] }, "KKF2026000000277").satirlar.length, 1);
  const iki = sarrafFaturaGirdisi({ baslik, satirlar: [satir, { ...satir, SATIR_NO: 2, ISCILIK_TUTARI: 0, TUTAR: 11412 , MIKTAR: 2 }] }, "KKF2026000000278");
  assert.deepEqual([iki.satirlar.length, iki.satirlar[2].ad], [3, "işçilik"]);
  assert.equal(buildInvoiceXml({ ...iki, gonderici }).ozet.odenecekTutar, 34081.32);
});
