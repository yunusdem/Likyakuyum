/**
 * G2 analiz raporları testi (docs/RAPOR_ESITLEME_UYGULAMA.md bölüm 2) — veritabanı gerekmez.
 * ALTISC1 (Altın İşçilik), KARLIL1 (Kârlılık), PERDEG1 (Personel Değerlendirme): saf hesaplar elle hesaplanmış örneklerle,
 * tanım kuralları (eski kolon seti, toplamlar, sektör bölümü, para ayrımı) ve bölümlü / gruplu çizim (PDF + Excel).
 * Çalıştır: cd Backend && npx tsx scripts/rapor-test-analiz.ts   Çıktı: ../tmp/rapor-test/ANALIZ-*.pdf / .xlsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { raporPdf, raporTanimOku, etkinGruplar, genelToplamVar, bolumlereAyir } from "../src/services/rapor/raporMotor.js";
import { raporExcel } from "../src/services/rapor/raporExcel.js";
import { kosulSaglandi } from "../src/services/rapor/rapor.service.js";
import { paraGrupKur } from "../src/services/rapor/paraGrup.js";
import { acikBolumler } from "../src/services/rapor/fisKaynak.js";
import type { RaporTanim } from "../src/services/rapor/raporTanim.js";
import { maliyetYurut, karlilikParaOzeti, karlilikGenelToplam, karlilikToplamTablosu, sarrafIscilikSatiri, dovizIscilikSatiri, altinIscilikDuzenle,
  personelSatiri, personelSirala } from "../src/services/rapor/veri/analiz.js";

let hata = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else console.log(`✓ ${ad}`); };
const firma = { ad: "ÖRNEK KUYUMCULUK", vkn: "1234567890" };
const dir = path.resolve("../tmp/rapor-test"); mkdirSync(dir, { recursive: true });
const y = (n: number | null, b = 4) => (n === null ? "null" : n.toFixed(b));

// Para grupları: 5 = HAS, 6 = 22 ayar, 7 = çeyrek → Kuyum; diğerleri Döviz
const pg = paraGrupKur(new Set([5, 6, 7]), new Set(["HAS", "22", "CEY"]));
const grupla = (s: { paraId?: any; paraKod?: any }) => pg.grup({ paraId: s.paraId, paraKod: s.paraKod });

/** Koşulları uygulanmış tanım (rapor.service kosulUygula ile aynı kural; kolonlar + tek grup + özet) */
function kipTanimi(t: RaporTanim, p: Record<string, any>): RaporTanim {
  const ok = (k?: any) => kosulSaglandi(k, t, p as any);
  return { ...t, kolonlar: t.kolonlar.filter(k => ok(k.kosul)), grup: t.grup && ok(t.grup.kosul) ? t.grup : undefined,
    ...(t.gruplar ? { gruplar: t.gruplar.filter(g => ok(g.kosul)) } : {}), ...(t.ozet ? { ozet: { ...t.ozet, kolonlar: t.ozet.kolonlar.filter(k => ok(k.kosul)) } } : {}) };
}
/** Excel'in ilk sayfasındaki tüm hücre metinleri (satır sırasıyla) ve sayfa adları */
async function excelOku(xlsx: Buffer) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx as any);
  const oku = (ws?: ExcelJS.Worksheet) => { const s: string[] = []; ws?.eachRow(row => { const h: string[] = []; row.eachCell(c => { if (c.value !== null && c.value !== undefined && c.value !== "") h.push(String(c.value)); }); s.push([...new Set(h)].join(" ¦ ")); }); return s; };
  return { ana: oku(wb.worksheets[0]), ozet: oku(wb.getWorksheet("Özet")), sayfalar: wb.worksheets.map(w => w.name) };
}

/* ================================================================== KARLIL1 — Kârlılık */
{
  // Dönem 01.11.2026'dan başlar. USD: dönem öncesi 100 @40; dönemde 100 @42 alış, 150 @43 satış. HAS: dönem öncesi 10 @4000; dönemde 4 @4500 satış.
  // EUR: yalnız dönem öncesi hareket → tabloya girmez.
  const h = maliyetYurut([
    { paraId: 2, paraKod: "USD", paraAd: "Amerikan Doları", tip: 0, miktar: 100, tutar: 4000, kur: 40, tarih: "2026-10-20T00:00:00Z" },
    { paraId: 2, paraKod: "USD", paraAd: "Amerikan Doları", tip: 0, miktar: 100, tutar: 4200, kur: 42, tarih: "2026-11-02T00:00:00Z" },
    { paraId: 2, paraKod: "USD", paraAd: "Amerikan Doları", tip: 1, miktar: 150, tutar: 6450, kur: 43, tarih: "2026-11-03T00:00:00Z" },
    { paraId: 3, paraKod: "EUR", paraAd: "Euro", tip: 0, miktar: 50, tutar: 2400, kur: 48, tarih: "2026-10-21T00:00:00Z" },
    { paraId: 5, paraKod: "HAS", paraAd: "Has Altın", tip: 0, miktar: 10, tutar: 40000, kur: 4000, tarih: "2026-10-25T00:00:00Z" },
    { paraId: 5, paraKod: "HAS", paraAd: "Has Altın", tip: 1, miktar: 4, tutar: 18000, kur: 4500, tarih: "2026-11-04T00:00:00Z" },
  ]);
  const bas = new Date("2026-11-01");
  const para = karlilikParaOzeti(h, bas);
  esit("karlılık: para satırları (dönem öncesi EUR yok)", para.map(o => o.para).join(" | "), "USD — Amerikan Doları | HAS — Has Altın");
  // USD: ort. alış = 4200 ÷ 100 = 42 (dönem içi alış); ort. satış = 6450 ÷ 150 = 43; brüt kâr = 6450 − 150 × 42 = 150; kâr % = 150 ÷ 6450 × 100 = 2,3256
  esit("karlılık USD (alış mik|ort alış|ort satış|satış mik|satış tutarı|brüt kâr|kâr %)",
    `${para[0].alisMiktar}|${para[0].ortAlis}|${para[0].ortSatis}|${para[0].satisMiktar}|${para[0].satisTutar}|${para[0].brutKar}|${y(para[0].karYuzde)}`, "100|42|43|150|6450|150|2.3256");
  // HAS: dönemde alış yok → ort. alış = yürüyen ortalama maliyet 4000; brüt kâr = 18000 − 4 × 4000 = 2000; kâr % = 2000 ÷ 18000 × 100 = 11,1111
  esit("karlılık HAS (dönemde alış yok → yürüyen ortalama)", `${para[1].alisMiktar}|${para[1].ortAlis}|${para[1].ortSatis}|${para[1].satisTutar}|${para[1].brutKar}|${y(para[1].karYuzde)}`, "0|4000|4500|18000|2000|11.1111");
  // GENEL TOPLAM: Σ satış 6450 + 18000 = 24450; Σ brüt kâr 150 + 2000 = 2150; toplam kâr % = 2150 ÷ 24450 × 100 = 8,7935
  const genel = karlilikGenelToplam(para)!;
  esit("karlılık genel toplam (satış|brüt kâr|kâr %|miktar kolonları boş)", `${genel.para}|${genel.satisTutar}|${genel.brutKar}|${y(genel.karYuzde)}|${genel.alisMiktar}|${genel.ortAlis}|${genel.satisMiktar}`, "GENEL TOPLAM|24450|2150|8.7935|null|null|null");
  // Eski raporda genel toplam her zaman basılır (B16): tek parada da var; hiç satır yoksa yok
  const tek = karlilikGenelToplam(para.slice(0, 1))!;
  esit("karlılık genel toplam tek parada da var", `${tek.para}|${tek.satisTutar}|${tek.brutKar}|${y(tek.karYuzde)}`, "GENEL TOPLAM|6450|150|2.3256");
  esit("karlılık genel toplam: satır yoksa yok", karlilikGenelToplam([]), null);
  // "Toplam" tablosu: detay kipinde para satırları Döviz / Kuyum başlıkları altında + GENEL TOPLAM; para bazında kipte yalnız GENEL TOPLAM
  const tablo = karlilikToplamTablosu(para, genel, grupla);
  esit("karlılık toplam tablosu (detay kipi)", tablo.map(s => (s._stil === "baslik" ? `[${s.para}]` : s.para)).join(" | "), "[Döviz] | USD — Amerikan Doları | [Kuyum] | HAS — Has Altın | GENEL TOPLAM");
  esit("karlılık toplam tablosu: başlık satırı rakam taşımaz", `${tablo[0].satisTutar}|${tablo[0].brutKar}|${tablo[0]._stil}`, "undefined|undefined|baslik");
  esit("karlılık toplam tablosu (para bazında kip)", karlilikToplamTablosu([], genel, grupla).map(s => s.para).join(), "GENEL TOPLAM");
  esit("karlılık toplam tablosu: rakamlar değişmez", `${tablo.reduce((a, s) => a + (s._stil ? 0 : s.para === "GENEL TOPLAM" ? 0 : Number(s.satisTutar)), 0)}`, "24450");
  // Sıra no küçük olsa da kuyum parası dövizlerden sonra gelir
  const ters = karlilikToplamTablosu([para[1], para[0]], genel, grupla);
  esit("karlılık toplam tablosu: kuyum dövizden sonra", ters.filter(s => !s._stil).map(s => s.paraKod).join(), "USD,HAS,");

  // Tanım: para ayrımı bölümle (yalnız başlık), detay kipinde para grubu; eski kolon seti para bazında kipte
  const t = raporTanimOku("KARLIL1");
  esit("KARLIL1 kod / ad değişmedi", `${t.kod}|${t.ad}`, "KARLIL1|Kârlılık Raporu");
  esit("KARLIL1 bölüm = para grubu (başlık her zaman, toplamsız)", JSON.stringify(t.bolum), '{"anahtar":"paraGrupAd","baslik":"{{paraGrupAd}}","altToplam":false,"herZaman":true}');
  const tOzet = kipTanimi(t, {}), tDetay = kipTanimi(t, { birlestir: "detay" });
  esit("KARLIL1 para bazında kip: eski 8 kolon PDF'te, grup yok", `${tOzet.kolonlar.filter(k => k.pdf !== false).map(k => k.anahtar).join()}|${etkinGruplar(tOzet).length}`,
    "para,alisMiktar,ortAlis,ortSatis,satisMiktar,satisTutar,brutKar,karYuzde|0");
  esit("KARLIL1 detay kipi: grup = para, kolonlar duruyor", `${etkinGruplar(tDetay).map(g => g.anahtar).join()}|${tDetay.kolonlar.length}`, "paraBaslik|16");
  esit("KARLIL1 detay kipi: tarih / saat ve seri no / belge no ayrı kolon (B8 / B9)", tDetay.kolonlar.slice(0, 4).map(k => `${k.anahtar}:${k.bicim || ""}`).join(), "zaman:tarih,saat:saat,seriNo:,belgeNo:");
  esit("KARLIL1 parametreler duruyor", t.parametreler.map(p => p.ad).join(), "baslangic,vezneIdler,paraIdler,siralama,birlestir");
  esit("KARLIL1 toplam tablosu kolonları duruyor", t.ozet!.kolonlar.map(k => k.anahtar).join(), "para,alisMiktar,ortAlis,ortSatis,satisMiktar,satisTutar,brutKar,karYuzde");

  // Çizim — para bazında kip: Döviz / Kuyum başlıkları, bölüm toplamı yok, GENEL TOPLAM "Özet" sayfasında
  const satirlar = para.map(o => ({ ...o, paraGrupAd: grupla(o) === "kuyum" ? "Kuyum" : "Döviz" }));
  const girdi = { tanim: tOzet, satirlar, filtreOzeti: "analiz testi", firma, kullanici: "test", ozetSatirlar: karlilikToplamTablosu([], genel, grupla) };
  const pdf = await raporPdf(girdi); writeFileSync(path.join(dir, "ANALIZ-KARLIL1-ozet.pdf"), pdf);
  esit("KARLIL1 para bazında PDF", pdf.subarray(0, 5).toString(), "%PDF-");
  const x = await excelOku(await raporExcel(girdi));
  esit("KARLIL1 para bazında Excel: Döviz / Kuyum başlıkları", `${x.ana.filter(s => s === "Döviz").length}|${x.ana.filter(s => s === "Kuyum").length}`, "1|1");
  esit("KARLIL1 para bazında Excel: bölüm toplamı ve motor genel toplamı yok", x.ana.some(s => /toplamı|GENEL TOPLAM/.test(s)), false);
  esit("KARLIL1 para bazında Excel: Özet sayfasında GENEL TOPLAM", x.ozet.some(s => s.startsWith("GENEL TOPLAM")), true);
  // Tek para grubu: başlık yine basılır (herZaman)
  esit("KARLIL1 tek para grubu: başlık yine var", bolumlereAyir(tOzet, satirlar.slice(0, 1)).map(b => b.baslik).join(), "Döviz");
  // Çizim — detay kipi: bölüm (para grubu) → para grubu başlığı → satırlar → ara toplam; Özet sayfasında başlıklı para tablosu
  const detay = [
    { paraGrupAd: "Döviz", paraBaslik: "USD — Amerikan Doları", zaman: "2026-11-03T09:00:00Z", saat: "2026-11-03T09:00:00Z", seriNo: "S1", belgeNo: "A1", miktar: 150, satisKuru: 43, maliyetKuru: 41, satisTutari: 6450, maliyetTutari: 6150, brutKar: 300, komisyon: 0, vergiler: 0, netKar: 300, karYuzde: 4.65 },
    { paraGrupAd: "Kuyum", paraBaslik: "HAS — Has Altın", zaman: "2026-11-04T09:00:00Z", saat: "2026-11-04T09:00:00Z", seriNo: "S2", belgeNo: "A2", miktar: 4, satisKuru: 4500, maliyetKuru: 4000, satisTutari: 18000, maliyetTutari: 16000, brutKar: 2000, komisyon: 0, vergiler: 0, netKar: 2000, karYuzde: 11.11 },
  ];
  const girdiD = { tanim: tDetay, satirlar: detay, filtreOzeti: "analiz testi", firma, kullanici: "test", ozetSatirlar: tablo };
  const pdfD = await raporPdf(girdiD); writeFileSync(path.join(dir, "ANALIZ-KARLIL1-detay.pdf"), pdfD);
  const xD = await excelOku(await raporExcel(girdiD));
  esit("KARLIL1 detay Excel: bölüm + grup başlıkları sırayla", xD.ana.filter(s => /^(Döviz|Kuyum|USD — Amerikan Doları|HAS — Has Altın)$/.test(s)).join(" > "), "Döviz > USD — Amerikan Doları > Kuyum > HAS — Has Altın");
  esit("KARLIL1 detay Excel: ara toplam 2, bölüm toplamı yok, genel toplam var", `${xD.ana.filter(s => s.startsWith("Ara toplam")).length}|${xD.ana.some(s => /(Döviz|Kuyum) toplamı/.test(s))}|${xD.ana.some(s => s.startsWith("GENEL TOPLAM (2 kayıt)"))}`, "2|false|true");
  esit("KARLIL1 detay Excel: Özet sayfası (2 başlık + 2 para + genel toplam)", xD.ozet.filter(s => /^(Döviz|Kuyum)$|^USD|^HAS|^GENEL TOPLAM/.test(s)).length, 5);
  esit("KARLIL1 detay PDF", pdfD.subarray(0, 5).toString(), "%PDF-");
}

/* ================================================================== ALTISC1 — Altın işçilik */
{
  // Sarraf fişi: işçilik has gramı 0,3 × has kuru 4000 = 1200 TL; fiş KDV'si 240, oran %20 → matrah = 240 ÷ 0,20 = 1200 (yalnız fişin ilk satırında)
  const sr = { fisId: 7, siraNo: 6, tarih: "2026-11-03T00:00:00Z", seriNo: "", belgeNo: "SRF-7", paraId: 6, paraKod: "22", paraAd: "22 Ayar", tipKod: 1, adet: 2, miktar: 10, milyem: 916, hasGram: 9.16, sekilKod: 2,
    iscilikMiktari: 30, iscilikHasGram: 0.3, hasKuru: 4000, kdvOrani: 20, fisKdv: 240, tutar: 37840 };
  const s1 = sarrafIscilikSatiri(sr, true), s2 = sarrafIscilikSatiri({ ...sr, paraId: 5, paraKod: "HAS", paraAd: "Has Altın", siraNo: 5, tarih: "2026-11-02T00:00:00Z", iscilikHasGram: 0.5, tutar: 2000 }, false);
  esit("sarraf işçilik satırı (işçilik TL|KDV|matrah|tip|şekil|cins)", `${s1.iscilikTutari}|${s1.kdv}|${y(s1.kdvMatrahi, 2)}|${s1.tip}|${s1.sekil}|${s1.cins}`, "1200|240|1200.00|Satış|Gram başına|22");
  esit("sarraf işçilik: fişin ikinci satırında KDV yinelenmez", `${s2.iscilikTutari}|${s2.kdv}|${s2.kdvMatrahi}`, "2000|0|0");
  esit("sarraf işçilik: KDV oranı 0 → matrah 0", sarrafIscilikSatiri({ ...sr, kdvOrani: 0, fisKdv: 50 }, true).kdvMatrahi, 0);
  esit("sarraf işçilik: bölüm / belge / seri-belge / para başlığı", `${s1.bolum}|${s1.bolumAd}|${s1.belge}|${s1.seriNo}|${s1.belgeNo}|${s1.paraBaslik}`, "2|Sarraf fişi|Sarraf fişi||SRF-7|22 — 22 Ayar");
  // Döviz fişi (eski rapor): 2 çeyrek, işçilik 300 → işçilik tutarı 600; KDV 60 → matrah = 300 × 2 − 60 = 540; tutar satır tutarı
  const dr = { fisId: 11, siraNo: 7, tarih: "2026-11-05T00:00:00Z", seriNo: "SAK001", belgeNo: "KAS0001", paraId: 7, paraKod: "CEY", paraAd: "Çeyrek Altın", tipKod: 1, miktar: 2, iscilik: 300, kdvOrani: 20, kdv: 60, tutar: 9000 };
  const d1 = dovizIscilikSatiri(dr), d0 = dovizIscilikSatiri({ ...dr, fisId: 10, tarih: "2026-11-01T00:00:00Z", tipKod: 0, tutar: 4000 });
  const dUsd = dovizIscilikSatiri({ ...dr, fisId: 12, paraId: 2, paraKod: "USD", paraAd: "Amerikan Doları", siraNo: 1, tutar: 100 });
  esit("döviz fişi işçilik satırı (birim fiyat|işçilik TL|KDV|matrah|tutar|tip|cins)", `${d1.iscilikBirimFiyati}|${d1.iscilikTutari}|${d1.kdv}|${d1.kdvMatrahi}|${d1.tutar}|${d1.tip}|${d1.cins}`, "300|600|60|540|9000|Satış|Çeyrek Altın");
  esit("döviz fişi işçilik: bölüm / seri no ve belge no ayrı / sarraf kolonları boş", `${d1.bolum}|${d1.bolumAd}|${d1.seriNo}|${d1.belgeNo}|${d1.adet}|${d1.hasGram}|${d1.hasKuru}|${d0.tip}`, "1|Döviz fişi|SAK001|KAS0001|null|null|null|Alış");
  // Düzen: bölüm (Döviz fişi → Sarraf fişi) → para grubu (Döviz → Kuyum) → sıra no → kod → tarih
  const karisik = [s1, s2, d1, dUsd, d0];
  const duz = altinIscilikDuzenle(karisik, grupla);
  esit("altın işçilik düzeni", duz.map(s => `${s.bolumAd}/${s.paraGrupAd}/${s.paraKod}/${String(s.tarih).slice(8, 10)}`).join(" "),
    "Döviz fişi/Döviz/USD/05 Döviz fişi/Kuyum/CEY/01 Döviz fişi/Kuyum/CEY/05 Sarraf fişi/Kuyum/HAS/02 Sarraf fişi/Kuyum/22/03");
  // Toplamlar düzenle değişmez: tutar 37840 + 2000 + 9000 + 100 + 4000 = 52940; KDV matrahı 1200 + 0 + 540 + 540 + 540 = 2820
  const top = (ss: Record<string, any>[], a: string) => ss.reduce((t, s) => t + (Number(s[a]) || 0), 0);
  esit("altın işçilik: düzen toplamları değiştirmez (tutar|KDV matrahı|işçilik TL)", `${top(duz, "tutar")}|${top(duz, "kdvMatrahi")}|${top(duz, "iscilikTutari")}|${duz.length}`, `52940|2820|${1200 + 2000 + 600 * 3}|5`);
  esit("altın işçilik: girdi dizisi değişmez", karisik.map(s => s.paraKod).join(), "22,HAS,CEY,USD,CEY");
  // Lisans (K10): bölümler açık modüllere göre; sarraf tablosu yoksa bölüm yok; perakende bölümü bu raporda açılmaz
  const tablo = (sarraf: boolean) => ({ sarraf, perakende: false, ticariSatir: false });
  esit("altın işçilik bölümleri: kısıt yok / yalnız döviz / yalnız sarraf / tablo yok / hiçbiri",
    [[...acikBolumler(null, tablo(true))].join(""), [...acikBolumler(["vezne:vezne/doviz-fisi-kayit"], tablo(true))].join(""), [...acikBolumler(["vezne:vezne/sarraf-fisi-kayit", "vezne:vezne/perakende-fisi-kayit"], tablo(true))].join(""),
      [...acikBolumler(null, tablo(false))].join(""), [...acikBolumler(["ticari:x"], tablo(true))].join("")].join("|"), "12|1|2|1|");

  // Tanım: seri no / belge no ayrı, eski kolonlar PDF'te, eski genel toplam kolonları toplanıyor, bizim kolonlar ve toplamlar duruyor
  const t = raporTanimOku("ALTISC1");
  const k = (a: string) => t.kolonlar.find(x => x.anahtar === a);
  esit("ALTISC1 kod / ad / kâğıt", `${t.kod}|${t.ad}|${t.kagit}`, "ALTISC1|Altın İşçilik Raporu|A4-yatay");
  esit("ALTISC1 seri no ve belge no ayrı kolon (yan yana)", t.kolonlar.map(x => x.baslik).join("|").includes("Seri no|Belge no"), true);
  esit("ALTISC1 eski kolonlar PDF'te", ["tarih", "seriNo", "belgeNo", "cins", "miktar", "iscilikBirimFiyati", "kdv", "kdvMatrahi", "tutar"].every(a => k(a) && k(a)!.pdf !== false), true);
  esit("ALTISC1 eski genel toplam kolonları (KDV matrahı + tutar) toplanıyor", `${k("kdvMatrahi")!.toplam}|${k("tutar")!.toplam}`, "true|true");
  esit("ALTISC1 bizim kolonlar duruyor", ["belge", "unvan", "tip", "vezneKod", "adet", "milyem", "hasGram", "sekil", "iscilikMiktari", "iscilikHasGram", "hasKuru", "iscilikTutari", "kdvOrani"].every(a => !!k(a)), true);
  esit("ALTISC1 bizim toplamlar duruyor", t.kolonlar.filter(x => x.toplam).map(x => x.anahtar).join(), "adet,hasGram,iscilikHasGram,iscilikTutari,tutar,kdvMatrahi");
  esit("ALTISC1 eski kolonlardan yalnız KDV matrahı + tutar toplanır (B16)", `${!!k("miktar")!.toplam}|${!!k("kdv")!.toplam}`, "false|false");
  esit("ALTISC1 parametreler duruyor", t.parametreler.map(p => p.ad).join(), "baslangic,fisTipi,vezneIdler,paraIdler");
  esit("ALTISC1 bölüm = sektör", JSON.stringify(t.bolum), '{"anahtar":"bolumAd","baslik":"{{bolumAd}}"}');
  esit("ALTISC1 gruplar: para grubu (yalnız başlık) → para (ara toplamlı)", etkinGruplar(t).map(g => `${g.anahtar}:${g.altToplam}`).join(), "paraGrupAd:false,paraBaslik:true");
  esit("ALTISC1 genel toplam basılır", genelToplamVar(t, etkinGruplar(t)), true);

  // Çizim: iki bölüm → bölüm başlığı + para grubu başlığı + para başlığı + ara toplam + bölüm toplamı + genel toplam
  const girdi = { tanim: t, satirlar: duz, filtreOzeti: "analiz testi", firma, kullanici: "test" };
  const pdf = await raporPdf(girdi); writeFileSync(path.join(dir, "ANALIZ-ALTISC1.pdf"), pdf);
  esit("ALTISC1 PDF", pdf.subarray(0, 5).toString(), "%PDF-");
  const xlsx = await raporExcel(girdi); writeFileSync(path.join(dir, "ANALIZ-ALTISC1.xlsx"), xlsx);
  const x = await excelOku(xlsx);
  esit("ALTISC1 Excel: başlık sırası (bölüm > para grubu > para)", x.ana.filter(s => /^(Döviz fişi|Sarraf fişi|Döviz|Kuyum| {3}.+ — .+)$/.test(s)).map(s => s.trim()).join(" > "),
    "Döviz fişi > Döviz > USD — Amerikan Doları > Kuyum > CEY — Çeyrek Altın > Sarraf fişi > Kuyum > HAS — Has Altın > 22 — 22 Ayar");
  esit("ALTISC1 Excel: ara toplam para başına (4), para grubu toplamı yok", `${x.ana.filter(s => s.includes("Ara toplam (")).length}|${x.ana.some(s => /(Döviz|Kuyum) toplamı/.test(s))}`, "4|false");
  esit("ALTISC1 Excel: bölüm toplamları ve genel toplam", `${x.ana.filter(s => /(Döviz fişi|Sarraf fişi) toplamı/.test(s)).length}|${x.ana.some(s => s.includes("GENEL TOPLAM (5 kayıt)"))}`, "2|true");
  // Tek bölüm (yalnız sarraf lisansı ya da veride tek bölüm): bölüm başlığı ve bölüm toplamı çizilmez, para grubu başlığı kalır
  const xTek = await excelOku(await raporExcel({ ...girdi, satirlar: duz.filter(s => s.bolum === 2) }));
  esit("ALTISC1 tek bölüm: sektör başlığı ve bölüm toplamı yok, Kuyum başlığı ve genel toplam var",
    `${xTek.ana.some(s => s === "Sarraf fişi")}|${xTek.ana.some(s => s.includes("fişi toplamı"))}|${xTek.ana.filter(s => s === "Kuyum").length}|${xTek.ana.some(s => s.includes("GENEL TOPLAM (2 kayıt)"))}`, "false|false|1|true");
}

/* ================================================================== PERDEG1 — Personel değerlendirme */
{
  // 4 alış 12.240 TL + 4 satış 11.760 TL, 6 gün → ciro 24.000, hareket 8, ciro/gün 4.000, hareket/gün 1,3333, ortalama işlem 3.000
  const r = personelSatiri({ bolum: 1, kullaniciId: 1, personel: "Ofis", alisAdet: 4, alisTutar: 12240, satisAdet: 4, satisTutar: 11760, iptalAdet: 1, komisyon: 20, sapmaAdet: 2, gunSayisi: 6 });
  esit("personel satırı (ciro|hareket|ciro/gün|hareket/gün|ort. işlem)", `${r.toplamTutar}|${r.toplamAdet}|${r.ciroGun}|${y(r.hareketGun)}|${r.ortIslem}`, "24000|8|4000|1.3333|3000");
  esit("personel satırı: komisyon / iptal / sapma / bölüm", `${r.komisyon}|${r.iptalAdet}|${r.sapmaAdet}|${r.bolum}|${r.bolumAd}`, "20|1|2|1|Döviz fişi");
  const bos = personelSatiri({ bolum: 3, kullaniciId: 7, personel: "", alisAdet: 0, alisTutar: 0, satisAdet: 0, satisTutar: 0, iptalAdet: 2, gunSayisi: 0 });
  esit("personel satırı: gün 0 → oranlar 0, adsız kullanıcı, bölüm adı", `${bos.ciroGun}|${bos.hareketGun}|${bos.ortIslem}|${bos.personel}|${bos.bolumAd}`, "0|0|0|Kullanıcı 7|Perakende fişi");
  esit("personel satırı: bölüm gelmezse döviz fişi", personelSatiri({ kullaniciId: 1, personel: "A" }).bolumAd, "Döviz fişi");
  // Sıralama bölümün içinde kalır; eşitlikte gelen sıra korunur
  const ss = [{ bolum: 1, personel: "A", toplamTutar: 100, toplamAdet: 5 }, { bolum: 1, personel: "B", toplamTutar: 300, toplamAdet: 2 }, { bolum: 2, personel: "A", toplamTutar: 50, toplamAdet: 1 },
    { bolum: 1, personel: "C", toplamTutar: 300, toplamAdet: 2 }, { bolum: 2, personel: "C", toplamTutar: 50, toplamAdet: 9 }];
  const sira = (s?: string) => personelSirala(ss, s).map(x => `${x.bolum}${x.personel}`).join(" ");
  esit("personel sırası: ciro (varsayılan)", sira("ciro"), "1B 1C 1A 2A 2C");
  esit("personel sırası: hareket", sira("hareket"), "1A 1B 1C 2C 2A");
  esit("personel sırası: ad (gelen sıra, bölümler ayrı)", sira("ad"), "1A 1B 1C 2A 2C");
  esit("personel sırası: seçim yoksa ciro", sira(undefined), "1B 1C 1A 2A 2C");
  esit("personel sırası: girdi dizisi değişmez", ss.map(x => `${x.bolum}${x.personel}`).join(" "), "1A 1B 2A 1C 2C");

  // Tanım: eskide genel toplam yok (B16) → toplam basılmaz; sektör bölümü; eski kolonlar PDF'te; bizim kolonlar duruyor
  const t = raporTanimOku("PERDEG1");
  esit("PERDEG1 kod / ad", `${t.kod}|${t.ad}`, "PERDEG1|Personel Değerlendirme Raporu");
  esit("PERDEG1 genel toplam basılmaz", `${t.genelToplam}|${genelToplamVar(t, etkinGruplar(t))}`, "false|false");
  esit("PERDEG1 bölüm = sektör, bölüm toplamı yok", JSON.stringify(t.bolum), '{"anahtar":"bolumAd","baslik":"{{bolumAd}}","altToplam":false}');
  esit("PERDEG1 eski kolonlar PDF'te ve başta", t.kolonlar.filter(k => k.pdf !== false).slice(0, 6).map(k => k.anahtar).join(), "personel,gunSayisi,toplamTutar,ciroGun,toplamAdet,hareketGun");
  esit("PERDEG1 bizim kolonlar duruyor", t.kolonlar.map(k => k.anahtar).join(), "personel,gunSayisi,toplamTutar,ciroGun,toplamAdet,hareketGun,alisAdet,alisTutar,satisAdet,satisTutar,ortIslem,komisyon,iptalAdet,sapmaAdet");
  esit("PERDEG1 parametreler duruyor", t.parametreler.map(p => p.ad).join(), "baslangic,kullaniciIdler,vezneIdler,siralama");

  // Çizim: üç bölüm → başlıklar var, hiçbir toplam satırı yok; tek bölüm → rapor bölümsüz (eski görünüm)
  const satirlar = personelSirala([
    personelSatiri({ bolum: 1, kullaniciId: 1, personel: "Ayşe", alisAdet: 4, alisTutar: 12240, satisAdet: 4, satisTutar: 11760, gunSayisi: 6, komisyon: 20 }),
    personelSatiri({ bolum: 1, kullaniciId: 2, personel: "Mehmet", alisAdet: 1, alisTutar: 90000, satisAdet: 0, satisTutar: 0, gunSayisi: 1 }),
    personelSatiri({ bolum: 2, kullaniciId: 1, personel: "Ayşe", alisAdet: 2, alisTutar: 44000, satisAdet: 3, satisTutar: 16350, gunSayisi: 3 }),
    personelSatiri({ bolum: 3, kullaniciId: 2, personel: "Mehmet", alisAdet: 1, alisTutar: 11500, satisAdet: 3, satisTutar: 95000, gunSayisi: 3 }),
  ], "ciro");
  esit("PERDEG1 örnek sırası (bölüm içinde ciroya göre)", satirlar.map(s => `${s.bolum}${s.personel}:${s.toplamTutar}`).join(" "), "1Mehmet:90000 1Ayşe:24000 2Ayşe:60350 3Mehmet:106500");
  const girdi = { tanim: t, satirlar, filtreOzeti: "analiz testi", firma, kullanici: "test" };
  const pdf = await raporPdf(girdi); writeFileSync(path.join(dir, "ANALIZ-PERDEG1.pdf"), pdf);
  esit("PERDEG1 PDF", pdf.subarray(0, 5).toString(), "%PDF-");
  const xlsx = await raporExcel(girdi); writeFileSync(path.join(dir, "ANALIZ-PERDEG1.xlsx"), xlsx);
  const x = await excelOku(xlsx);
  esit("PERDEG1 Excel: bölüm başlıkları", x.ana.filter(s => /^(Döviz fişi|Sarraf fişi|Perakende fişi|Ticari fiş)$/.test(s)).join(" > "), "Döviz fişi > Sarraf fişi > Perakende fişi");
  esit("PERDEG1 Excel: genel toplam ve bölüm toplamı yok", x.ana.some(s => /GENEL TOPLAM|toplamı|Ara toplam/.test(s)), false);
  const xTek = await excelOku(await raporExcel({ ...girdi, satirlar: satirlar.filter(s => s.bolum === 1) }));
  esit("PERDEG1 tek bölüm: başlık ve toplam yok", `${xTek.ana.some(s => s === "Döviz fişi")}|${xTek.ana.some(s => /GENEL TOPLAM|toplamı/.test(s))}|${xTek.ana.filter(s => /^(Mehmet|Ayşe) ¦/.test(s)).length}`, "false|false|2");
}

console.log(hata ? `\n${hata} HATA` : "\nANALİZ TESTLERİ GEÇTİ");
process.exit(hata ? 1 : 0);
