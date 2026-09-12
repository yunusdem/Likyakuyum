/**
 * Rapor motoru testi — veritabanı gerekmez. 9 tanımı sabit veriyle PDF + Excel'e çizer.
 * Çalıştır: cd Backend && npx tsx scripts/rapor-motor-test.ts
 * Çıktı: ../tmp/rapor-test/<KOD>.pdf / .xlsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { raporTanimOku, raporPdf, bicimle } from "../src/services/rapor/raporMotor.js";
import { raporExcel } from "../src/services/rapor/raporExcel.js";
import { RAPOR_SEED } from "../src/models/raporSql.repository.js";

let hata = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else console.log(`✓ ${ad}`); };

esit("bicim sayi", bicimle(1234.5, "sayi"), "1.234,50");
esit("bicim kur", bicimle(41.2537, "kur"), "41,2537");
esit("bicim tam", bicimle(12, "tam"), "12");
esit("bicim tarih", bicimle("2026-09-12T10:00:00", "tarih"), "12.09.2026");

const firma = { ad: "KESKİNLER DÖVİZ SINIRLI YETKİLİ MÜESSESE AŞ", vkn: "31534209546" };
const dir = path.resolve("../tmp/rapor-test"); mkdirSync(dir, { recursive: true });
const rnd = (n: number) => Math.round(Math.random() * n * 100) / 100;

// Her tanım için kolon anahtarlarına göre rastgele satır üretir; grup anahtarı 3 gruba bölünür
function ornekSatirlar(kod: string, adet: number) {
  const t = raporTanimOku(kod);
  const satirlar: Record<string, any>[] = [];
  for (let i = 0; i < adet; i++) {
    const s: Record<string, any> = {};
    const grupNo = Math.floor(i / Math.ceil(adet / 3));
    for (const k of t.kolonlar) {
      if (k.bicim === "tarih" || k.bicim === "tarihSaat") s[k.anahtar] = new Date(2026, 8, 1 + (i % 12), 9 + (i % 9), i % 60).toISOString();
      else if (k.bicim === "tam") s[k.anahtar] = 1 + (i % 7);
      else if (k.bicim === "kur") s[k.anahtar] = 41 + rnd(2);
      else if (k.bicim === "sayi" || k.bicim === "sayi4") s[k.anahtar] = rnd(50000);
      else s[k.anahtar] = `${k.baslik} ${i + 1}`;
    }
    if (t.grup) { s[t.grup.anahtar] = `G${grupNo + 1}`; for (const ek of ["cariBaslik", "vezneBaslik", "grup", "paraKod"]) if (!(ek in s) || t.grup.anahtar === ek) s[ek] = `G${grupNo + 1} — Örnek grup ${grupNo + 1}`; }
    satirlar.push(s);
  }
  return { t, satirlar };
}

for (const seed of RAPOR_SEED) {
  const { t, satirlar } = ornekSatirlar(seed.kod, 12);
  esit(`${seed.kod} kagit`, t.kagit, seed.kagit);
  const pdf = await raporPdf({ tanim: t, satirlar, filtreOzeti: "01.09.2026 – 12.09.2026 · Tüm vezneler", firma, kullanici: "test" });
  writeFileSync(path.join(dir, `${seed.kod}.pdf`), pdf);
  esit(`${seed.kod} pdf imzası`, pdf.subarray(0, 5).toString(), "%PDF-");
  const xlsx = await raporExcel({ tanim: t, satirlar, filtreOzeti: "Test", firma, kullanici: "test" });
  writeFileSync(path.join(dir, `${seed.kod}.xlsx`), xlsx);
  esit(`${seed.kod} xlsx imzası (PK)`, xlsx.subarray(0, 2).toString(), "PK");
}
// Boş rapor
const bos = raporTanimOku("VEZHAR1");
const bosPdf = await raporPdf({ tanim: bos, satirlar: [], filtreOzeti: "Boş", firma, kullanici: "test" });
esit("boş rapor pdf", bosPdf.subarray(0, 5).toString(), "%PDF-");
try { raporTanimOku("../belge/ALFIS1"); hata++; console.error("✗ kod doğrulaması"); } catch { console.log("✓ geçersiz kod reddedildi"); }

console.log(hata ? `\n${hata} HATA` : `\nTÜM TESTLER GEÇTİ → ${dir}`);
process.exit(hata ? 1 : 0);
