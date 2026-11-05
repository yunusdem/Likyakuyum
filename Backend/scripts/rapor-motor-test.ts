/**
 * Rapor motoru testi — veritabanı gerekmez. Tüm tanımları (RAPOR_SEED) sabit veriyle PDF + Excel'e çizer;
 * tanım tutarlılığını (parametre tipleri, seçenekler, sorgu ↔ seed ↔ menü) ve özet bölümünü doğrular.
 * Çalıştır: cd Backend && npx tsx scripts/rapor-motor-test.ts
 * Çıktı: ../tmp/rapor-test/<KOD>.pdf / .xlsx
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
// Menü artık Backend/src/services/rapor/raporMenu.ts'te (ön yüz oradan dışa aktarır). Motor dışı kendi sayfası olan maddeler
// (ör. XMLDOS1 — rapor/<kod>.json yok) seed ile karşılaştırmaya girmez.
const { RAPOR_MENU } = await import("../src/services/rapor/raporMenu.js");
const menuKodlari = RAPOR_MENU.map(m => m.kod).filter(kod => existsSync(path.resolve("rapor", `${kod}.json`)));
esit("seed ↔ sorgu", RAPOR_SEED.map(r => r.kod).sort().join(), Object.keys(RAPOR_SORGULARI).sort().join());
esit("seed ↔ menü", RAPOR_SEED.map(r => r.kod).sort().join(), [...menuKodlari].sort().join());
esit("menü yolları benzersiz", new Set(RAPOR_MENU.map(m => m.yol)).size, RAPOR_MENU.length);
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
  // Aynı anahtar farklı koşullarda (kip:ozet / kip:detay) olabilir; kosulUygula sonrası tek kalır. Aynı koşulda yinelenirse sorun.
  const anahtarlar = t.kolonlar.map(k => `${k.anahtar}|${k.kosul ?? ""}`);
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
  // 01.10.2026 denetimi: KDV, TL hareketinde de ayrı TL satırıdır (eski VODVZR_KASA_HAREKET_LISTESI gibi)
  esit("kasa TL hareketi + ayrı KDV satırı", `${tlH.length}|${tlH[0].cikis}|${tlH[0].giris}|${tlH[1].paraKod}:${tlH[1].cikis}|${tlH[1].kdvSatiri}`, "2|1000|0|TL:200|true");
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
// Sektörlü Kâr / Zarar (docs/SEKTORLU_RAPORLAR_YOL_HARITASI.md): ortak havuz, sabit maliyetli satırlar, bölüm süzme, KMT/EFT + TL + seçilen para bloğu
{
  const { karZararHesapla, acikBolumler } = await import("../src/services/rapor/veri/karZarar.js");
  const USD = { paraId: 2, paraKod: "USD", paraAd: "Amerikan Doları", siraNo: 1 }, HAS = { paraId: 5, paraKod: "HAS", paraAd: "Has altın", siraNo: 5 };
  const bos = { komisyon: 0, vergiler: 0, iscilik: 0, zamanMs: 0 };
  const h = [
    { ...USD, ...bos, bolum: 1 as const, gun: "2026-10-20", tip: 0, miktar: 100, tutar: 4000, kur: 40 },     // dönem öncesi alış (devir)
    { ...USD, ...bos, bolum: 1 as const, gun: "2026-10-25", tip: 1, miktar: 20, tutar: 820, kur: 41 },       // dönem öncesi satış (devir 80, havuz 80 @40)
    { ...USD, ...bos, bolum: 2 as const, gun: "2026-11-02", tip: 0, miktar: 120, tutar: 5040, kur: 42 },     // sarraf fişiyle alış → havuz 200 @41,2
    { ...USD, ...bos, bolum: 3 as const, gun: "2026-11-03", tip: 1, miktar: 150, tutar: 6450, kur: 43 },     // perakende barkodsuz satış → maliyet 6180, brüt 270
    { ...HAS, ...bos, bolum: 2 as const, gun: "2026-11-04", tip: 1, miktar: 10, tutar: 45000, kur: 4500, iscilik: 500 }, // havuzda HAS yok → maliyet satış kuru, işçilik +500
    { ...HAS, paraAd: "Has altın (barkodlu ürün)", siraNo: 0, ...bos, bolum: 3 as const, gun: "2026-11-05", tip: 1, miktar: 5, tutar: 25000, kur: 5000, maliyetSabit: 22000 }, // ürün kartı maliyeti
    { paraId: -10, paraKod: "ST1", paraAd: "Ticari mal", siraNo: 999, ...bos, bolum: 4 as const, gun: "2026-11-05", tip: 1, miktar: 2, tutar: 1000, kur: 500, maliyetSabit: 700 },
  ];
  const ayar = { baslangic: "2026-11-01", devirKur: new Map([[1, 1], [2, 40.5], [5, 4400]]), kapanisKur: new Map([[1, 1], [2, 43], [5, 4600]]), tlId: 1, hedef: { id: 1, kod: "TL" }, tlDevir: 10000, kuyumParalar: new Set([5]),
    ticari: { devirTutar: 1400, alisTutar: 2100, satisTutar: 1000, satisMaliyeti: 700, kapanisTutar: 2800 } };
  const s = karZararHesapla(h, ayar);
  esit("kz satırlar (bölüm|para)", s.satirlar.map(r => `${r.bolum}|${r.paraKod}`).join(" "), "2|USD 2|HAS 3|HAS 3|USD 4|ST1");
  const r = (b: number, k: string) => s.satirlar.find(x => x.bolum === b && x.paraKod === k)!;
  esit("kz havuz ortak: perakende satış maliyeti sarraf alışından", `${r(3, "USD").satisMaliyeti}|${r(3, "USD").brutKar}|${r(3, "USD").ortMaliyet}|${r(3, "USD").kalanMiktar}`, "6180|270|41.2|50");
  esit("kz sarraf alış satırı", `${r(2, "USD").alisMiktar}|${r(2, "USD").alisTutar}|${r(2, "USD").netKar}`, "120|5040|0");
  esit("kz işçilik gelir, havuzsuz satış maliyeti = satış kuru", `${r(2, "HAS").brutKar}|${r(2, "HAS").iscilik}|${r(2, "HAS").netKar}`, "0|500|500");
  esit("kz barkodlu ürün kart maliyeti", `${r(3, "HAS").satisMaliyeti}|${r(3, "HAS").brutKar}`, "22000|3000");
  esit("kz ticari son alış maliyeti", `${r(4, "ST1").satisMaliyeti}|${r(4, "ST1").netKar}|${r(4, "ST1").netKarHedef}`, "700|300|300");
  esit("kz dönem öncesi satırlar listede yok", s.satirlar.some(x => x.bolum === 1), false);
  esit("kz KMT satır sayısı (4 başlık + USD 3 + HAS 3 + ticari + TL + seçilen 3)", s.kmt.length, 15);
  // KMT tablosunda Para kolonu Döviz / Kuyum / Ticari diye ayrılır; para blokları değişmez
  esit("kz KMT grupları (başlıklar ve sıra)", s.kmt.filter(x => x.para).map(x => (x._stil === "baslik" ? `[${x.para}]` : x.para)).join(" "), "[Döviz] USD [Kuyum] HAS [Ticari] TİCARİ (TL) [Toplam] TL TL");
  esit("kz KMT başlık satırı boş ve stilli", `${s.kmt[0].para}|${s.kmt[0].kmt}|${s.kmt[0].devir}|${s.kmt[0].sonuc}|${s.kmt[0]._stil}|${s.kmt[1]._stil}`, "Döviz||null|null|baslik|undefined");
  {
    // Sıra numarası küçük olsa da kuyum parası dövizlerden sonra gelir; kuyum listesi yoksa hepsi Döviz
    const karisik = h.map(x => (x.paraId === 5 ? { ...x, siraNo: 0 } : x));
    esit("kz KMT: kuyum parası sıra no'ya bakmadan Kuyum grubunda", karZararHesapla(karisik, ayar).kmt.filter(x => x.para && x.kmt !== "").slice(0, 2).map(x => x.para).join(), "USD,HAS");
    esit("kz KMT: kuyum listesi yoksa tek Döviz grubu", karZararHesapla(h, { ...ayar, kuyumParalar: undefined }).kmt.filter(x => x._stil === "baslik").map(x => x.para).join(), "Döviz,Ticari,Toplam");
  }
  const { kuyumParasiMi } = await import("../src/services/rapor/veri/karZarar.js");
  esit("kuyum parası: 22 ayar kartı (ürün tipi 0, has oranı dolu)", kuyumParasiMi({ kod: "22", ad: "22 Ayar Altın", hasOrani: 0.916, urunTipi: 0 }), true);
  esit("kuyum parası: HAS / çeyrek / yarım / gümüş / ziynet tipi", [kuyumParasiMi({ kod: "HAS", ad: "" }), kuyumParasiMi({ kod: "ÇEY", ad: "Çeyrek" }), kuyumParasiMi({ kod: "YAR", ad: "Yarım" }),
    kuyumParasiMi({ kod: "GMS", ad: "Gümüş" }), kuyumParasiMi({ kod: "X", ad: "Ata", urunTipi: 3 })].join(), "true,true,true,true,true");
  esit("kuyum parası değil: USD / CAD / EUR", [kuyumParasiMi({ kod: "USD", ad: "Amerikan Doları" }), kuyumParasiMi({ kod: "CAD", ad: "Kanada Doları", urunTipi: 0, hasOrani: 0 }), kuyumParasiMi({ kod: "EUR", ad: "Euro" })].join(), "false,false,false");
  // Para bloğu: K satırında para kodu, M / T satırlarında boş; TL satırı tek (eft boş); seçilen para bloğu son üç satır
  const k = (para: string, kmt: string) => { if (para === "TL") return kmt === "M" ? s.kmt.find(x => x.para === "TL" && x.eft === "")! : s.kmt[s.kmt.length - 3 + ["K", "M", "T"].indexOf(kmt)];
    const i = s.kmt.findIndex(x => x.para === para); return s.kmt[i + ["K", "M", "T"].indexOf(kmt) - ["K", "M", "T"].indexOf(s.kmt[i].kmt)]; };
  esit("kz USD K satırı (devir|ort alış|ort satış|kapanış|E)", `${k("USD", "K").devir}|${k("USD", "K").alis}|${k("USD", "K").satis}|${k("USD", "K").kapanis}|${k("USD", "K").sonuc}`, "40.5|42|43|43|170");
  esit("kz USD M satırı (devir|alış|satış|mevcut|F)", `${k("USD", "M").devir}|${k("USD", "M").alis}|${k("USD", "M").satis}|${k("USD", "M").kapanis}|${k("USD", "M").sonuc}`, "80|120|150|50|150");
  esit("kz HAS: barkodlu satır havuza girmez, alış yoksa ort alış = devir kuru", `${k("HAS", "M").satis}|${k("HAS", "K").alis}|${k("HAS", "M").sonuc}`, "10|4400|1000");
  esit("kz TİCARİ T satırı", `${k("TİCARİ (TL)", "T").devir}|${k("TİCARİ (TL)", "T").kapanis}|${k("TİCARİ (TL)", "T").sonuc}`, "1400|2800|300");
  esit("kz TL satırı (devir | mevcut = devir + Σsatış − Σalış)", `${k("TL", "M").devir}|${k("TL", "M").kapanis}`, "10000|55310");
  esit("kz seçilen para TL bloğu (devir|alış|satış|kapanış toplam TL|Toplam kâr)", `${k("TL", "T").devir}|${k("TL", "T").alis}|${k("TL", "T").satis}|${k("TL", "T").kapanis}|${k("TL", "T").sonuc}`, "4640|7140|52450|14260|9620");
  esit("kz seçilen para TL E/F", `${s.kmt[s.kmt.length - 3].sonuc}|${s.kmt[s.kmt.length - 2].sonuc}`, "8170|1450");
  const u = karZararHesapla(h, { ...ayar, hedef: { id: 2, kod: "USD" } });
  const ku = (kmt: string) => u.kmt[u.kmt.length - 3 + ["K", "M", "T"].indexOf(kmt)];
  esit("kz karşılık USD: net kâr kapanış kuruyla", `${u.satirlar.find(x => x.bolum === 3 && x.paraKod === "USD")!.netKarHedef}`, "6.28");
  esit("kz seçilen USD bloğu kurları (devir|alış|satış|kapanış)", `${u.kmt[u.kmt.length - 3].devir}|${u.kmt[u.kmt.length - 3].alis}|${u.kmt[u.kmt.length - 3].satis}|${u.kmt[u.kmt.length - 3].kapanis}`, "40.5|42|43|43");
  esit("kz seçilen USD M (devir|mevcut|F) ve T kâr", `${ku("M").devir.toFixed(2)}|${ku("M").kapanis.toFixed(2)}|${ku("M").sonuc.toFixed(2)}|${u.kmt[u.kmt.length - 1].sonuc.toFixed(2)}`, "114.57|331.63|33.72|217.06");
  const l = karZararHesapla(h, { ...ayar, bolumler: new Set([2, 3]) });
  esit("kz lisans süzmesi: ticari bölümü düşer, KMT kalır", `${l.satirlar.some(x => x.bolum === 4)}|${l.kmt.length}`, "false|15");
  const d = { sarraf: true, perakende: true, ticariSatir: true };
  esit("açık bölümler: kısıt yok", [...acikBolumler(null, d)].join(), "1,2,3,4");
  esit("açık bölümler: Kuyum (döviz fişi yok)", [...acikBolumler(["vezne:vezne/sarraf-fisi-kayit", "vezne:vezne/perakende-fisi-kayit", "ticari:ticari/satis-fisi"], d)].join(), "2,3,4");
  esit("açık bölümler: Döviz", [...acikBolumler(["vezne:vezne/doviz-fisi-kayit"], d)].join(), "1");
  esit("açık bölümler: tablo yoksa bölüm yok", [...acikBolumler(null, { sarraf: false, perakende: false, ticariSatir: false })].join(), "1");
  // Motor: bölümlere ayırma ve bölümlü PDF / Excel
  const { bolumlereAyir } = await import("../src/services/rapor/raporMotor.js");
  const { t, satirlar } = ornekSatirlar("KARZAR1", 9);
  satirlar.forEach((x, i) => { x.bolumAd = ["Döviz fişi", "Sarraf fişi", "Perakende fişi"][Math.floor(i / 3)]; });
  esit("bölümlere ayırma (3 bölüm)", bolumlereAyir(t, satirlar).map(b => `${b.baslik}:${b.satirlar.length}`).join(" "), "Döviz fişi:3 Sarraf fişi:3 Perakende fişi:3");
  esit("tek bölüm → başlıksız", bolumlereAyir(t, satirlar.slice(0, 3)).map(b => `${b.baslik}:${b.satirlar.length}`).join(" "), ":3");
  const pdf = await raporPdf({ tanim: t, satirlar, filtreOzeti: "bölüm testi", firma, kullanici: "test", ozetSatirlar: [{ para: "USD", kmt: "K", devir: 40.5, alis: 42, satis: 43, kapanis: 43, eft: "E", sonuc: 170 }] });
  const xlsx = await raporExcel({ tanim: t, satirlar, filtreOzeti: "bölüm testi", firma, kullanici: "test" });
  esit("bölümlü PDF ve Excel üretildi", pdf.length > 1000 && xlsx.length > 1000, true);
  writeFileSync(path.join(dir, "KARZAR1-bolumlu.pdf"), pdf); writeFileSync(path.join(dir, "KARZAR1-bolumlu.xlsx"), xlsx);
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
