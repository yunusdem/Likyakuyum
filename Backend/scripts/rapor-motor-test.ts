/**
 * Rapor motoru testi — veritabanı gerekmez. Tüm tanımları (RAPOR_SEED) sabit veriyle PDF + Excel'e çizer;
 * tanım tutarlılığını (parametre tipleri, seçenekler, sorgu ↔ seed ↔ menü) ve özet bölümünü doğrular.
 * Çalıştır: cd Backend && npx tsx scripts/rapor-motor-test.ts
 * Çıktı: ../tmp/rapor-test/<KOD>.pdf / .xlsx
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { raporTanimOku, raporPdf, bicimle } from "../src/services/rapor/raporMotor.js";
import { raporExcel } from "../src/services/rapor/raporExcel.js";
import { RAPOR_SEED } from "../src/models/raporSql.repository.js";
import { RAPOR_SORGULARI } from "../src/services/rapor/raporVeri.js";

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
    if (t.grup) { s[t.grup.anahtar] = `G${grupNo + 1}`; for (const ek of ["cariBaslik", "vezneBaslik", "grup", "paraKod", "grupBaslik", "hesapBaslik"]) if (!(ek in s) || t.grup.anahtar === ek) s[ek] = `G${grupNo + 1} — Örnek grup ${grupNo + 1}`; }
    satirlar.push(s);
  }
  return { t, satirlar };
}

// Tanım tutarlılığı: seed ↔ sorgu ↔ frontend menüsü; parametre tipleri ve zorunlu ekleri
const TIPLER = ["tarih", "tarihAralik", "saatAralik", "vezne", "para", "cari", "fisTipi", "kurSecimi", "kmt", "cariAralik", "vezneAralik", "paraCoklu", "cariCoklu", "vezneCoklu", "hareketTipi", "secim", "sayi", "listeCoklu", "metin"];
const KAYNAKLAR = ["hesap", "istatistik", "meslek", "sektor", "kullanici", "banka"];
const menuMetni = readFileSync(path.resolve("../src/services/raporService.ts"), "utf8");
const menuKodlari = [...menuMetni.matchAll(/\{ kod: "([A-Z0-9_]+)", yol: "([a-z0-9-]+)"/g)].map(m => m[1]);
esit("seed ↔ sorgu", RAPOR_SEED.map(r => r.kod).sort().join(), Object.keys(RAPOR_SORGULARI).sort().join());
esit("seed ↔ menü", RAPOR_SEED.map(r => r.kod).sort().join(), [...menuKodlari].sort().join());
esit("menü yolları benzersiz", new Set([...menuMetni.matchAll(/yol: "([a-z0-9-]+)"/g)].map(m => m[1])).size, menuKodlari.length);
for (const seed of RAPOR_SEED) {
  const t = raporTanimOku(seed.kod);
  const sorunlar: string[] = [];
  if (t.kod !== seed.kod) sorunlar.push("kod uyuşmuyor");
  if (t.ad !== seed.ad) sorunlar.push(`ad uyuşmuyor (${t.ad} ≠ ${seed.ad})`);
  const adlar = new Set<string>();
  for (const p of t.parametreler) {
    if (!TIPLER.includes(p.tip)) sorunlar.push(`bilinmeyen tip ${p.tip}`);
    if (adlar.has(p.ad)) sorunlar.push(`yinelenen parametre ${p.ad}`); adlar.add(p.ad);
    if (p.tip === "secim" && !p.secenekler?.length) sorunlar.push(`${p.ad}: seçenek yok`);
    if (p.tip === "listeCoklu" && !KAYNAKLAR.includes(p.kaynak || "")) sorunlar.push(`${p.ad}: kaynak geçersiz`);
  }
  const anahtarlar = t.kolonlar.map(k => k.anahtar);
  if (new Set(anahtarlar).size !== anahtarlar.length) sorunlar.push("yinelenen kolon anahtarı");
  if (!t.kolonlar.some(k => k.pdf !== false)) sorunlar.push("PDF'te kolon kalmıyor");
  esit(`${seed.kod} tanım tutarlı`, sorunlar.join("; "), "");
}

for (const seed of RAPOR_SEED) {
  const { t, satirlar } = ornekSatirlar(seed.kod, 12);
  esit(`${seed.kod} kagit`, t.kagit, seed.kagit);
  // Özet bölümü olan raporlarda özet satırları da üretilir
  const ozetSatirlar = t.ozet ? Array.from({ length: 4 }, (_, i) => Object.fromEntries(t.ozet!.kolonlar.map(k => [k.anahtar, ["sayi", "sayi4", "kur", "tam"].includes(k.bicim || "") ? rnd(9000) : `${k.baslik} ${i + 1}`]))) : undefined;
  const pdf = await raporPdf({ tanim: t, satirlar, filtreOzeti: "01.09.2026 – 12.09.2026 · Tüm vezneler", firma, kullanici: "test", ozetSatirlar });
  writeFileSync(path.join(dir, `${seed.kod}.pdf`), pdf);
  esit(`${seed.kod} pdf imzası`, pdf.subarray(0, 5).toString(), "%PDF-");
  const xlsx = await raporExcel({ tanim: t, satirlar, filtreOzeti: "Test", firma, kullanici: "test", ozetSatirlar });
  writeFileSync(path.join(dir, `${seed.kod}.xlsx`), xlsx);
  esit(`${seed.kod} xlsx imzası (PK)`, xlsx.subarray(0, 2).toString(), "PK");
}
// Kasa: KDV'nin TL'ye yansıması ve devirli yürüyen bakiye (saf fonksiyonlar)
{
  const { kasaNakitSatirlari, yuruyenBakiye } = await import("../src/services/rapor/veri/kasa.js");
  const tl = { id: 1, kod: "TL" };
  const tlH = kasaNakitSatirlari({ paraId: 1, paraKod: "TL", meblag: 1000, kdv: 200, tip: 1, aciklama: "Kira" }, tl);
  esit("kasa TL hareketi tek satır, KDV dahil", `${tlH.length}|${tlH[0].cikis}|${tlH[0].giris}`, "1|1200|0");
  const usdH = kasaNakitSatirlari({ paraId: 2, paraKod: "USD", meblag: 100, kdv: 50, tip: 0, aciklama: "Komisyon" }, tl);
  esit("kasa döviz hareketi + TL KDV satırı", usdH.map(x => `${x.paraKod}:${x.giris}`).join(","), "USD:100,TL:50");
  esit("kasa KDV satırı açıklaması", usdH[1].aciklama, "KDV — Komisyon");
  const y = yuruyenBakiye([{ anahtar: "TL", devir: -300, ortak: { paraKod: "TL" }, hareketler: [{ giris: 1000, cikis: 0 }, { giris: 0, cikis: 250 }] }], d => ({ aciklama: "devir" }));
  esit("yürüyen bakiye", y.map(x => x.bakiye).join(","), "-300,700,450");
  esit("devir satırı çıkış kolonunda", `${y[0].giris}|${y[0].cikis}`, "0|300");
}
// Vezne: kur sapması
{
  const { kurSapmasi } = await import("../src/services/rapor/veri/vezne.js");
  const s1 = kurSapmasi(41.5, 41, 1000);
  esit("kur sapması fark / % / TL", `${s1.fark.toFixed(2)}|${s1.sapmaYuzde.toFixed(4)}|${s1.tlEtkisi.toFixed(0)}`, "0.50|1.2195|500");
  esit("gişe kuru yoksa karşılaştırılmaz", kurSapmasi(41.5, 0, 1000).giseVar, false);
}
// Cari: vadeye kalan gün
{
  const { kalanGun } = await import("../src/services/rapor/veri/cari.js");
  esit("kalan gün ileri", kalanGun("2026-09-27", "2026-09-17"), 10);
  esit("kalan gün geçmiş", kalanGun("2026-09-10T15:30:00", "2026-09-17"), -7);
  esit("kalan gün ay sonu", kalanGun("2026-10-01", "2026-09-30"), 1);
}
// Fiş: para bazında özet (farklı fiş adedi, ortalama kur)
{
  const { paraOzeti } = await import("../src/services/rapor/veri/fis.js");
  const o = paraOzeti([{ fisId: 1, paraKod: "USD", tip: "Alış", miktar: 100, tutar: 4100 }, { fisId: 1, paraKod: "USD", tip: "Alış", miktar: 100, tutar: 4200, bmv: 5 },
    { fisId: 2, paraKod: "USD", tip: "Satış", miktar: 50, tutar: 2150 }]);
  esit("para özeti grup sayısı", o.length, 2);
  esit("para özeti alış (adet|miktar|ort kur|bmv)", `${o[0].adet}|${o[0].miktar}|${o[0].ortKur}|${o[0].bmv}`, "1|200|41.5|5");
}
// Analiz: ağırlıklı ortalama maliyet (elle hesaplanmış örnek)
{
  const { maliyetYurut } = await import("../src/services/rapor/veri/analiz.js");
  // 100 USD @40 + 100 USD @42 → ort 41; 150 sat @43 → maliyet 6150, kâr 300; kalan 50 @41; 50 al @45 → ort 43; 100 sat @44 → maliyet 4300, kâr 100
  const h = maliyetYurut([{ paraId: 2, tip: 0, miktar: 100, tutar: 4000, kur: 40 }, { paraId: 2, tip: 0, miktar: 100, tutar: 4200, kur: 42 }, { paraId: 2, tip: 1, miktar: 150, tutar: 6450, kur: 43 },
    { paraId: 2, tip: 0, miktar: 50, tutar: 2250, kur: 45 }, { paraId: 2, tip: 1, miktar: 100, tutar: 4400, kur: 44 }, { paraId: 3, tip: 1, miktar: 10, tutar: 480, kur: 48 }]);
  esit("ort. maliyet 1. satış", `${h[2].ortMaliyet}|${h[2].maliyet}`, "41|6150");
  esit("ort. maliyet 2. satış", `${h[4].ortMaliyet}|${h[4].maliyet}`, "43|4300");
  esit("stoksuz satışta maliyet = satış kuru", `${h[5].ortMaliyet}|${h[5].maliyet}`, "48|480");
}
// MASAK: yaş aralığı, fiş kontrol kuralları, grup özeti
{
  const { yasAraligi, masakKontrol, grupOzeti } = await import("../src/services/rapor/veri/masak.js");
  esit("yaş: doğum günü gelmemiş", yasAraligi("1990-09-18", "2026-09-17").yas, 35);
  esit("yaş: doğum günü bugün", yasAraligi("1990-09-17", "2026-09-17").yas, 36);
  esit("yaş aralığı 18–25", yasAraligi("2008-09-17", "2026-09-17").aralik, "18 – 25");
  esit("yaş aralığı 0–17", yasAraligi("2008-09-18", "2026-09-17").aralik, "0 – 17");
  esit("doğum tarihi yok", yasAraligi(null, "2026-09-17").aralik, "Doğum tarihi yok");
  const f = (fisId: number, kimlikNo: string, tutar: number, ek: any = {}) => ({ fisId, gun: "2026-09-17", kimlikNo, tutar, meslekId: 5, dogumTarihi: "1980-01-01", masakListesinde: false, ...ek });
  const k = masakKontrol([f(1, "111", 90000), f(2, "111", 80000), f(3, "111", 70000), f(4, "222", 250000, { meslekId: 0 }), f(5, "333", 1000, { masakListesinde: true }),
    f(6, "444", 250000), f(7, "555", 90000), f(8, "555", 90000, { gun: "2026-09-16" })], 185000, 3);
  esit("kontrol: parçalı işlem 3 fiş", [1, 2, 3].every(i => k.get(i)?.[0].startsWith("Parçalı işlem")), true);
  esit("kontrol: eşik üstü eksik meslek", k.get(4)?.[0], "Eşik üstü, eksik bilgi: meslek");
  esit("kontrol: MASAK listesi", k.get(5)?.[0], "MASAK listesinde eşleşme");
  esit("kontrol: eşik üstü ama bilgiler tam → takılmaz", k.has(6), false);
  esit("kontrol: farklı günler parçalı sayılmaz", k.has(7) || k.has(8), false);
  const o = grupOzeti([{ grupBaslik: "A", tutar: 300, usdKarsiligi: 7 }, { grupBaslik: "A", tutar: 100, usdKarsiligi: 3 }, { grupBaslik: "B", tutar: 600, usdKarsiligi: 15 }]);
  const { knskOzeti } = await import("../src/services/rapor/veri/masak.js");
  esit("KNSK özeti", knskOzeti([{ basarili: true, karaListede: false }, { basarili: true, karaListede: true }, { basarili: false, karaListede: false }]).map(x => x.adet).join("|"), "3|2|1|1");
  esit("grup özeti (adet|tutar|pay)", o.map(x => `${x.grup}:${x.adet}|${x.tutar}|${x.pay}`).join(" "), "A:2|400|40 B:1|600|60");
}
// Yönetici: long / short durumu
{
  const { lsDurumu } = await import("../src/services/rapor/veri/yonetici.js");
  esit("long", JSON.stringify(lsDurumu(1500, 400)), '{"net":1100,"durum":"LONG"}');
  esit("short", lsDurumu(100, 400).durum, "SHORT");
  esit("denge", lsDurumu(250.001, 250).durum, "DENGE");
}
// Özet bölümü: uzun ana gövde + özet → sayfa taşması dahil çizilebilmeli; Excel'de "Özet" sayfası oluşmalı
{
  const { t, satirlar } = ornekSatirlar("VEZHAR1", 60);
  const tanim = { ...t, ozet: { baslik: "GENEL TOPLAM — para bazında", kolonlar: [{ anahtar: "paraKod", baslik: "Para", g: 2 }, { anahtar: "miktar", baslik: "Miktar", g: 2, bicim: "sayi" as const, toplam: true }, { anahtar: "tutar", baslik: "Tutar", g: 2, bicim: "sayi" as const, toplam: true }] } };
  const ozetSatirlar = Array.from({ length: 30 }, (_, i) => ({ paraKod: `P${i}`, miktar: rnd(1000), tutar: rnd(90000) }));
  const pdf = await raporPdf({ tanim, satirlar, filtreOzeti: "Özet testi", firma, kullanici: "test", ozetSatirlar });
  writeFileSync(path.join(dir, "_ozet-test.pdf"), pdf);
  esit("özet bölümü pdf", pdf.subarray(0, 5).toString(), "%PDF-");
  const ozetsiz = await raporPdf({ tanim, satirlar, filtreOzeti: "Özet testi", firma, kullanici: "test" });
  esit("özet bölümü pdf'i büyütür", pdf.length > ozetsiz.length, true);
  const ExcelJS = (await import("exceljs")).default; const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await raporExcel({ tanim, satirlar, filtreOzeti: "Özet testi", firma, kullanici: "test", ozetSatirlar }) as any);
  esit("excel özet sayfası", wb.worksheets.map(w => w.name).includes("Özet"), true);
  esit("excel özet satır sayısı (başlık 3 + 30 + toplam)", wb.getWorksheet("Özet")!.rowCount, 34);
}
// Boş rapor
const bos = raporTanimOku("VEZHAR1");
const bosPdf = await raporPdf({ tanim: bos, satirlar: [], filtreOzeti: "Boş", firma, kullanici: "test" });
esit("boş rapor pdf", bosPdf.subarray(0, 5).toString(), "%PDF-");
try { raporTanimOku("../belge/ALFIS1"); hata++; console.error("✗ kod doğrulaması"); } catch { console.log("✓ geçersiz kod reddedildi"); }

console.log(hata ? `\n${hata} HATA` : `\nTÜM TESTLER GEÇTİ → ${dir}`);
process.exit(hata ? 1 : 0);
