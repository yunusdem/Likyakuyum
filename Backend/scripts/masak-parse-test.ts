/**
 * Geçici doğrulama betiği (Faz 2) — MASAK Excel ayrıştırıcısını gerçek dosyalarla test eder.
 * Kullanım: node node_modules/tsx/dist/cli.mjs scripts/masak-parse-test.ts <xlsx-klasoru>
 */
import fs from "fs";
import path from "path";
import {
  parseMasakExcel,
  normalizeMetin,
  tcknAyikla,
  tarihAyikla,
} from "../src/utils/masakExcel.util.js";
import type { MasakListeKod } from "../src/models/masakSql.repository.js";

const KLASOR = process.argv[2];
if (!KLASOR) {
  console.error("Kullanim: masak-parse-test.ts <xlsx-klasoru>");
  process.exit(2);
}

const BEKLENEN: { dosya: string; kod: MasakListeKod; beklenen: number }[] = [
  { dosya: "A.xlsx", kod: "A", beklenen: 476 },
  { dosya: "B.xlsx", kod: "B", beklenen: 112 },
  { dosya: "C.xlsx", kod: "C", beklenen: 1443 },
  { dosya: "D.xlsx", kod: "3AB", beklenen: 276 },
];

let hataVar = false;

for (const { dosya, kod, beklenen } of BEKLENEN) {
  const buffer = fs.readFileSync(path.join(KLASOR, dosya));
  const t0 = Date.now();
  const sonuc = await parseMasakExcel(buffer, kod);
  const sure = Date.now() - t0;

  const tcknli = sonuc.kayitlar.filter((k) => k.tckn).length;
  const tarihli = sonuc.kayitlar.filter((k) => k.dogumTarihiDt).length;
  const ekBilgili = sonuc.kayitlar.filter((k) => k.ekBilgi).length;
  const tuzel = sonuc.kayitlar.filter((k) => k.kayitTipi === "TUZEL").length;
  const uygun = sonuc.kayitlar.length === beklenen;
  if (!uygun) hataVar = true;

  console.log(
    `${uygun ? "OK " : "HATA"} ${dosya} (${kod}): ${sonuc.kayitlar.length}/${beklenen} kayit | ` +
      `baslik=${sonuc.baslikSatiri} atlanan=${sonuc.atlananSatir} | ` +
      `tckn=${tcknli} tarih=${tarihli} tuzel=${tuzel} ekBilgi=${ekBilgili} | ${sure}ms`
  );
  if (sonuc.eslesmeyenBasliklar.length) {
    console.log(`     eslesmeyen: ${JSON.stringify(sonuc.eslesmeyenBasliklar)}`);
  }

  const ilk = sonuc.kayitlar[0];
  console.log(
    `     ilk: sira=${ilk.siraNo} ad="${ilk.adUnvan.slice(0, 38)}" uyruk="${ilk.uyruk}" ` +
      `yaptirim="${(ilk.yaptirimTuru || "").slice(0, 26)}" dogum=${ilk.dogumTarihiDt?.toISOString().slice(0, 10)}`
  );

  const bosNorm = sonuc.kayitlar.filter((k) => !k.adUnvanNorm).length;
  if (bosNorm > 0) {
    console.log(`     UYARI: ${bosNorm} kayitta normalize ad bos`);
    hataVar = true;
  }
}

const kontroller: [string, unknown, unknown][] = [
  ["normalize-1", normalizeMetin("ABD AL-BASET AZZOUZ "), "ABD AL BASET AZZOUZ"],
  ["normalize-2", normalizeMetin("abdullah aymaz"), "ABDULLAH AYMAZ"],
  ["normalize-3", normalizeMetin("ABDÜLKADİR ŞAHİN-ÇİĞDEM"), "ABDULKADIR SAHIN CIGDEM"],
  ["tckn-gecerli", tcknAyikla("39472770166"), "39472770166"],
  ["tckn-gecersiz", tcknAyikla("12345678901"), null],
  ["tckn-metin-ici", tcknAyikla("TCKN: 27029036896 (FETO)"), "27029036896"],
  ["tarih-iso", tarihAyikla("1978-06-05")?.toISOString().slice(0, 10), "1978-06-05"],
  ["tarih-nokta", tarihAyikla("07.02.1966")?.toISOString().slice(0, 10), "1966-02-07"],
  ["tarih-yazili", tarihAyikla(" 7 Şubat 1966")?.toISOString().slice(0, 10), "1966-02-07"],
  ["tarih-belirsiz", tarihAyikla("a)1970 b)1971 c)1972"), null],
];

console.log("\n--- yardimci fonksiyonlar ---");
for (const [ad, alinan, beklenen] of kontroller) {
  const ok = JSON.stringify(alinan) === JSON.stringify(beklenen);
  if (!ok) hataVar = true;
  console.log(`${ok ? "OK " : "HATA"} ${ad}: ${JSON.stringify(alinan)} (beklenen ${JSON.stringify(beklenen)})`);
}

console.log(hataVar ? "\nSONUC: HATA VAR" : "\nSONUC: TUM TESTLER GECTI");
process.exit(hataVar ? 1 : 0);
