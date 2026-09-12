/**
 * Belge motoru testi — veritabanı gerekmez.
 * Çalıştır: cd Backend && npx tsx scripts/belge-motor-test.ts
 * Çıktı: ../tmp/belge-test/STFIS1.pdf, ALFIS1.pdf (deneme1.pdf ile yan yana karşılaştırılır)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { belgeCiz, sablonOku, doldur } from "../src/services/belge/belgeMotor.js";
import { fisBelgeVerisi } from "../src/services/belge/belgeVeri.js";
import { arsivYolu } from "../src/services/belge/belgeArsiv.js";

// deneme1.pdf'teki gerçek belgenin verisi (görünüm kolon adlarıyla)
const satisFisi = {
  BELGE_ID: 6, FIS_TIPI: 1, BELGE_NO: "DIS2026000000006", ETTN: "5F73AEE7-77D7-4B78-8BDF-BBB5ABC43DE9",
  TARIH: "2026-09-12T08:43:51", IPTAL: 0, ProfileId: "EDOVIZBELGE", VEZNE_KODU: "",
  Supplier_PartyName: "KESKİNLER DÖVİZ SINIRLI YETKİLİ MÜESSESE AŞ", Supplier_StreetName: "TOPRAKLIK MAH G.M.KEMAL BULV. NO: 75/A PAMUKKALE  No:",
  Supplier_CitySubdivisionName: "PAMUKKALE", Supplier_CityName: "DENİZLİ", Supplier_Telephone: "2582651017",
  Supplier_EMail: "info@keskindoviz.com", Supplier_TaxSchemeName: "SARAYLAR", Supplier_PartyIdentification: "31534209546", TICARET_SICIL_NO: "11769",
  Customer_PartyName: "TEST MUSTERİ", Customer_Person_FirstName: "TEST", Customer_Person_FamilyName: "MUSTERİ",
  Customer_StreetName: "  No:  Kapı No:", Customer_CitySubdivisionName: "", Customer_CityName: "", Customer_CountryName: "Türkiye",
  Customer_PartyIdentification_ID: "11111111110", Customer_Telephone: "", Customer_ElectronicMail: "", Customer_TaxSchemeName: "",
  ISTATISTIK_NO: "10285", MIKTAR: 3, PARA_KODU: "USD", TL_KARSILIK_KURU: 0.02062, DOLAR_KARSILIK_KURU: 1,
  LineExtensionAmount: 145.52, TaxInclusiveAmount: 145.52, PayableAmount: 145.52, TaxAmount: 0,
};
const alisFisi = { ...satisFisi, BELGE_ID: 4, FIS_TIPI: 0, BELGE_NO: "DIA2026000000004", ETTN: "", MIKTAR: 100, TL_KARSILIK_KURU: 41.25,
  LineExtensionAmount: 4125, TaxInclusiveAmount: 4125, PayableAmount: 4125, Customer_PartyIdentification_ID: "GERCEKKISI", Customer_PartyIdentification_PassportID: "P1234567" };

let hata = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else console.log(`✓ ${ad}`); };

// 1) Yer tutucu doldurma
esit("doldur sayi", doldur("{{t.x|sayi}} TL", { t: { x: 145.52 } }), "145,52 TL");
esit("doldur sayi4", doldur("{{k|sayi4}}", { k: 0.02062 }), "0,0206");
esit("doldur bos", doldur("A{{yok.alan}}B", {}), "AB");

// 2) Veri eşleme
const v = fisBelgeVerisi(satisFisi, "STFIS1", { hesapVkn: "31534209546", dosyaNo: "1", onizleme: true });
esit("tipAdi", v.tipAdi, "SATIM");
esit("belgeNo", v.belgeNo, "DIS2026000000006");
esit("musteri TCKN", v.musteri.kimlikEtiketi, "TCKN");
esit("firma TCKN etiketi", v.firma.kimlikEtiketi, "TCKN");
esit("yaziyla", v.tutar.yaziyla, "YÜZKIRKBEŞ TL ELLİİKİ KR.");
esit("erisim", v.erisimAdresi, "http://ebelge.iceteknoloji.com.tr/edoviz/ettn/31534209546/5F73AEE7-77D7-4B78-8BDF-BBB5ABC43DE9");
esit("usd karsiligi", v.tutar.usdKarsiligi, 3);
const va = fisBelgeVerisi(alisFisi, "ALFIS1", { onizleme: true });
esit("alis tipAdi", va.tipAdi, "ALIM");
esit("alis kimliksiz musteri", va.musteri.kimlikNo, "");
esit("alis musteriTuru", va.musteri.musteriTuru, "GERCEKKISI");
esit("alis pasaport", va.musteri.pasaportNo, "P1234567");
esit("alis erisim bos", va.erisimAdresi, "");

// 3) Arşiv yolu
const yol = arsivYolu({ kokDizin: "D:/arsiv", dbName: "R2016_dvz", tarih: "2026-09-12", belgeNo: "DIS2026000000006" });
esit("arsiv yolu", yol.replace(/\\/g, "/"), "D:/arsiv/R2016_dvz/2026/09/DIS2026000000006.pdf");

// 4) PDF üretimi
const dir = path.resolve("../tmp/belge-test"); mkdirSync(dir, { recursive: true });
for (const [kod, veri] of [["STFIS1", v], ["ALFIS1", va], ["STFIS1_80", v], ["ALFIS1_80", va]] as const) {
  const sablon = sablonOku(`belge/${kod}.json`);
  const pdf = await belgeCiz(sablon, veri, `${veri.belgeNo} test`);
  writeFileSync(path.join(dir, `${kod}.pdf`), pdf);
  esit(`${kod} pdf imzası`, pdf.subarray(0, 5).toString(), "%PDF-");
  console.log(`  → ${path.join(dir, kod + ".pdf")} (${pdf.length} bayt)`);
}
try { sablonOku("belge/../src/app.json"); hata++; console.error("✗ dizin kaçışı engellenmedi"); } catch { console.log("✓ dizin kaçışı engellendi"); }

console.log(hata ? `\n${hata} HATA` : "\nTÜM TESTLER GEÇTİ");
process.exit(hata ? 1 : 0);
