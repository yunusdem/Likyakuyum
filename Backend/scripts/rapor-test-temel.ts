/**
 * Rapor ortak altyapısı testi (docs/RAPOR_ESITLEME_UYGULAMA.md bölüm 1) — veritabanı gerekmez.
 * Koşullar, ek parametreler, çok seviyeli grup, net satırı, alt tablo, sayfa toplamı, para başlıkları, bölüm.
 * Çalıştır: cd Backend && npx tsx scripts/rapor-test-temel.ts   Çıktı: ../tmp/rapor-test/TEMEL-*.pdf / .xlsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { raporPdf, bicimle, etkinGruplar, genelToplamVar, netMetni, veriSatirlari, baslikMetni, bolumlereAyir } from "../src/services/rapor/raporMotor.js";
import { raporExcel } from "../src/services/rapor/raporExcel.js";
import { kosulSaglandi, parametreDegeri, lisansSecenekleri, RaporService } from "../src/services/rapor/rapor.service.js";
import { ek, ekOnay, ekSayi } from "../src/services/rapor/raporOrtak.js";
import { kuyumParasiMi, paraBasliklariEkle, paraGrubunaGoreSirala, paraGrupKur } from "../src/services/rapor/paraGrup.js";
import { acikBolumler, BOLUM_ADI, FIS_ID_KAYMASI } from "../src/services/rapor/fisKaynak.js";
import type { RaporTanim } from "../src/services/rapor/raporTanim.js";

let hata = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else console.log(`✓ ${ad}`); };
const firma = { ad: "ÖRNEK FİRMA", vkn: "1234567890" };
const dir = path.resolve("../tmp/rapor-test"); mkdirSync(dir, { recursive: true });

// Biçim
esit("bicim saat (tarih-saat)", bicimle("2026-09-12T07:05:00Z", "saat"), "10:05");
esit("bicim saat (hazır metin)", bicimle("14:35:10", "saat"), "14:35");
esit("bicim saat (boş)", bicimle(null, "saat"), "");

// Ek parametreler
const p1: any = { ek: { hesapTipi: "borc", saatGizle: "1", altLimit: "1.250,5", ad: "  ali " } };
esit("ek / ekOnay / ekSayi", `${ek(p1, "hesapTipi")}|${ek(p1, "ad")}|${ek(p1, "yok")}|${ekOnay(p1, "saatGizle")}|${ekOnay({ ek: { saatGizle: "0" } } as any, "saatGizle")}|${ekOnay({} as any, "x")}|${ekSayi({ ek: { n: "12,5" } } as any, "n")}|${ekSayi(p1, "yok")}`,
  "borc|ali||true|false|false|12.5|undefined");

// Koşullar
const tanim: RaporTanim = {
  kod: "TEMEL1", ad: "Temel test", kagit: "A4-yatay",
  parametreler: [
    { ad: "birlestir", etiket: "Rapor tipi", tip: "secim", secenekler: [{ deger: "detay", ad: "Detay" }, { deger: "toplam", ad: "Toplam" }], varsayilan: "detay" },
    { ad: "siralama", etiket: "Sıralama", tip: "secim", secenekler: [{ deger: "kod", ad: "Kod" }, { deger: "ad", ad: "Ad" }, { deger: "tarih", ad: "Tarih" }] },
    { ad: "saatGizle", etiket: "Saat gözükmesin", tip: "onay" },
    { ad: "ad", etiket: "Ad", tip: "metinAralik" }, { ad: "limit", etiket: "Limit", tip: "sayiAralik" },
  ],
  kolonlar: [
    { anahtar: "zaman", baslik: "Tarih", g: 1.4, bicim: "tarih" },
    { anahtar: "saat", baslik: "Saat", g: 0.9, bicim: "saat", kosul: "p:saatGizle!=1" },
    { anahtar: "paraKod", baslik: "Para", g: 1.2 },
    { anahtar: "aciklama", baslik: "Açıklama", g: 3 },
    { anahtar: "borc", baslik: "Borç", g: 1.6, bicim: "sayi", toplam: true },
    { anahtar: "alacak", baslik: "Alacak", g: 1.6, bicim: "sayi", toplam: true },
    { anahtar: "ozetKolon", baslik: "Toplam kipi", g: 1, kosul: "kip:toplam" },
  ],
  gruplar: [
    { anahtar: "cariKod", baslik: "{{cariKod}} — {{cariAd}}", toplamEtiketi: "{{cariKod}} toplamı", net: { arti: "borc", eksi: "alacak" } },
    { anahtar: "gun", baslik: "{{gun}}", toplamEtiketi: "Gün toplamı", kosul: "p:siralama=tarih" },
  ],
  net: { arti: "borc", eksi: "alacak", etiket: "Genel bakiye" },
  altTablo: { baslik: "Fişler", kolonlar: [{ anahtar: "belgeNo", baslik: "Belge no", g: 2 }, { anahtar: "tutar", baslik: "Tutar", g: 2, bicim: "sayi", toplam: true }], toplamEtiketi: "TOPLAM" },
  grupAltTablo: { baslik: "Para toplamı", kolonlar: [{ anahtar: "paraKod", baslik: "Para", g: 1 }, { anahtar: "bakiye", baslik: "Bakiye", g: 2, bicim: "sayi" }, { anahtar: "ba", baslik: "B/A", g: 0.5 }] },
  sayfaToplami: true,
};
const pBos: any = {};
esit("parametreDegeri: varsayılan / ilk seçenek / ek", `${parametreDegeri(tanim, pBos, "birlestir")}|${parametreDegeri(tanim, pBos, "siralama")}|${parametreDegeri(tanim, { ek: { siralama: "ad" } } as any, "siralama")}|${parametreDegeri(tanim, { birlestir: "toplam" } as any, "birlestir")}`,
  "detay|kod|ad|toplam");
esit("kosul kip", `${kosulSaglandi("kip:toplam", tanim, pBos)}|${kosulSaglandi("kip:toplam", tanim, { birlestir: "toplam" } as any)}|${kosulSaglandi("kip:detay", tanim, pBos)}`, "false|true|true");
esit("kosul p:=", `${kosulSaglandi("p:siralama=tarih", tanim, pBos)}|${kosulSaglandi("p:siralama=tarih|ad", tanim, { ek: { siralama: "ad" } } as any)}`, "false|true");
esit("kosul p:!= (onay)", `${kosulSaglandi("p:saatGizle!=1", tanim, pBos)}|${kosulSaglandi("p:saatGizle!=1", tanim, { ek: { saatGizle: "1" } } as any)}|${kosulSaglandi("p:saatGizle!=1", tanim, { ek: { saatGizle: "0" } } as any)}`, "true|false|true");
esit("kosul kurIkisi / boş", `${kosulSaglandi("kurIkisi", tanim, { kurAlani: "ikisi" } as any)}|${kosulSaglandi(undefined, tanim, pBos)}`, "true|true");

// Gruplar, net, veri satırları
esit("etkinGruplar: tanım / sorgu / boş sorgu", `${etkinGruplar(tanim).length}|${etkinGruplar(tanim, [{ anahtar: "x", baslik: "X" }]).map(g => g.anahtar).join()}|${etkinGruplar(tanim, []).length}|${etkinGruplar({ ...tanim, gruplar: undefined, grup: { anahtar: "g", baslik: "G" } }).length}`, "2|x|0|1");
esit("genelToplamVar", `${genelToplamVar(tanim, etkinGruplar(tanim))}|${genelToplamVar({ ...tanim, genelToplam: false }, [])}|${genelToplamVar(tanim, [{ anahtar: "a", baslik: "A", genelToplam: false }])}`, "true|false|false");
const ss = [{ borc: 1500, alacak: 250 }, { borc: 0, alacak: 250.5 }];
esit("netMetni borç", netMetni({ arti: "borc", eksi: "alacak" }, ss), "Bakiye : 999,50 B");
esit("netMetni alacak + etiket + harf", netMetni({ arti: "borc", eksi: "alacak", etiket: "Net", eksiHarf: "Ç" }, [{ borc: 10, alacak: 30 }]), "Net : 20,00 Ç");
esit("netMetni sıfır → harf yok", netMetni({ arti: "borc", eksi: "alacak" }, [{ borc: 5, alacak: 5 }]), "Bakiye : 0,00");
const karisik = [{ paraKod: "Döviz", _stil: "baslik", _baslik: "Döviz" }, { paraKod: "USD", borc: 1 }, { paraKod: "Kuyum", _stil: "baslik" }, { paraKod: "22", borc: 2 }];
esit("veriSatirlari başlıkları atar", veriSatirlari(karisik).map(s => s.paraKod).join(), "USD,22");
esit("baslikMetni: _baslik ya da ilk dolu kolon", `${baslikMetni(karisik[0], tanim.kolonlar)}|${baslikMetni(karisik[2], tanim.kolonlar)}`, "Döviz|Kuyum");

// Para grupları
esit("kuyumParasiMi", [kuyumParasiMi({ kod: "22", ad: "22 Ayar Altın", hasOrani: 0.916, urunTipi: 0 }), kuyumParasiMi({ kod: "ÇEY", ad: "Çeyrek" }), kuyumParasiMi({ kod: "USD", ad: "Amerikan Doları" })].join(), "true,true,false");
const pg = paraGrupKur(new Set([5, 6]), new Set(["HAS", "22"]));
esit("paraGrupKur.grup (id / kod / ikisi de yok)", `${pg.grup({ paraId: 5 })}|${pg.grup({ paraKod: " 22 " })}|${pg.grup({ paraId: 2, paraKod: "USD" })}|${pg.grup({})}`, "kuyum|kuyum|doviz|doviz");
const ozetS = [{ paraKod: "HAS", t: 1 }, { paraKod: "USD", t: 2 }, { paraKod: "22", t: 3 }, { paraKod: "EUR", t: 4 }, { paraKod: "TİCARİ", t: 5, ticari: true }];
const baslikli = paraBasliklariEkle(ozetS, { grupla: s => (s.ticari ? "ticari" : pg.grup(s)), alan: "paraKod" });
esit("paraBasliklariEkle: sıra ve başlıklar", baslikli.map(s => (s._stil ? `[${s.paraKod}]` : s.paraKod)).join(" "), "[Döviz] USD EUR [Kuyum] HAS 22 [Ticari] TİCARİ");
esit("paraBasliklariEkle: toplam değişmez", `${baslikli.reduce((t, s) => t + (Number(s.t) || 0), 0)}`, "15");
const vezneli = [{ vezneKod: "01", paraKod: "HAS" }, { vezneKod: "01", paraKod: "USD" }, { vezneKod: "02", paraKod: "22" }];
esit("paraBasliklariEkle: grup içinde kalır (bolumle)", paraBasliklariEkle(vezneli, { grupla: s => pg.grup(s), alan: "paraKod", bolumle: ["vezneKod"] }).map(s => `${s.vezneKod}:${s._stil ? `[${s.paraKod}]` : s.paraKod}`).join(" "),
  "01:[Döviz] 01:USD 01:[Kuyum] 01:HAS 02:[Kuyum] 02:22");
esit("paraGrubunaGoreSirala", paraGrubunaGoreSirala(ozetS, s => (s.ticari ? "ticari" : pg.grup(s))).map(s => `${s.paraGrupAd}:${s.paraKod}`).join(" "), "Döviz:USD Döviz:EUR Kuyum:HAS Kuyum:22 Ticari:TİCARİ");

// Sektör bölümleri
esit("BOLUM_ADI / kayma", `${BOLUM_ADI[2]}|${FIS_ID_KAYMASI[2]}|${FIS_ID_KAYMASI[4]}`, "Sarraf fişi|500000000|1500000000");
esit("acikBolumler", [...acikBolumler(["vezne:vezne/sarraf-fisi-kayit", "ticari:x"], { sarraf: true, perakende: true, ticariSatir: true })].join(), "2,4");
esit("bolum herZaman: tek bölümde de başlık", bolumlereAyir({ ...tanim, bolum: { anahtar: "pg", baslik: "{{pg}}", herZaman: true } }, [{ pg: "Döviz" }, { pg: "Döviz" }]).map(b => `${b.baslik}:${b.satirlar.length}`).join(), "Döviz:2");
esit("bolum: tek bölümde başlıksız (varsayılan)", bolumlereAyir({ ...tanim, bolum: { anahtar: "pg", baslik: "{{pg}}" } }, [{ pg: "Döviz" }]).map(b => b.baslik).join(), "");

// Ek parametre adları (tanımdan)
esit("ekParametreAdlari (KARZAR1: ek yok ama sabit parametreler listelenir)", Array.isArray(RaporService.ekParametreAdlari("KARZAR1")), true);

// Lisansa göre seçenekler (VEZHAR1 belge tipi)
{
  const vt = RaporService.tanim("VEZHAR1");
  const secenek = (m: string[] | null) => lisansSecenekleri(vt, m).parametreler.find(x => x.ad === "belgeTipi")!.secenekler!.map(o => o.deger).join(",");
  esit("lisans seçenekleri: kısıt yok", secenek(null), "hepsi,fis,transfer,cari,hesap,dekont,sarraf,perakende,ticari,urun");
  esit("lisans seçenekleri: Döviz", secenek(["vezne:vezne/doviz-fisi-kayit"]), "hepsi,fis,transfer,cari,hesap,dekont,urun");
  esit("lisans seçenekleri: Kuyum + Ticari", secenek(["vezne:vezne/sarraf-fisi-kayit", "vezne:vezne/perakende-fisi-kayit", "ticari:x"]), "hepsi,transfer,cari,hesap,dekont,sarraf,perakende,ticari,urun");
}

// Çizim: çok seviyeli grup + net + alt tablo + grup altı tablo + sayfa toplamı + para başlıkları (PDF / Excel)
{
  const satirlar: Record<string, any>[] = [];
  for (let c = 1; c <= 3; c++) for (let g = 1; g <= 2; g++) for (let i = 0; i < 9; i++) {
    const kuyum = i % 3 === 2;
    satirlar.push({ cariKod: `C0${c}`, cariAd: `Cari ${c}`, gun: `0${g}.11.2026`, zaman: `2026-11-0${g}T0${i}:15:00Z`, saat: `2026-11-0${g}T0${i}:15:00Z`, paraKod: kuyum ? "22" : "USD", paraId: kuyum ? 6 : 2,
      aciklama: `Hareket ${i + 1}`, borc: (i + 1) * 100, alacak: i * 40, ...(i === 0 ? { _alt: [{ belgeNo: "B-1", tutar: 100 }, { belgeNo: "B-2", tutar: 250.5 }] } : {}) });
  }
  const basliklilar = paraBasliklariEkle(satirlar, { grupla: s => pg.grup(s), alan: "paraKod", bolumle: ["cariKod", "gun"] });
  const grupAltSatirlar = Object.fromEntries(["C01", "C02", "C03"].map(c => [c, [{ paraKod: "USD", bakiye: 1200, ba: "B" }, { paraKod: "22", bakiye: 35.5, ba: "A" }]]));
  const girdi = { tanim, satirlar: basliklilar, filtreOzeti: "temel testi", firma, kullanici: "test", grupAltSatirlar,
    ozetSatirlar: undefined as any };
  const pdf = await raporPdf(girdi);
  esit("temel PDF üretildi", pdf.subarray(0, 5).toString(), "%PDF-");
  writeFileSync(path.join(dir, "TEMEL-gruplu.pdf"), pdf);
  const xlsx = await raporExcel(girdi);
  writeFileSync(path.join(dir, "TEMEL-gruplu.xlsx"), xlsx);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx as any);
  const ilk: string[] = []; wb.worksheets[0].eachRow(row => ilk.push(String(row.getCell(1).value ?? "")));
  const say = (re: RegExp) => ilk.filter(x => re.test(x)).length;
  esit("Excel: 3 cari başlığı, 6 gün başlığı", `${say(/^C0\d — Cari \d$/)}|${say(/^ {3}0\d\.11\.2026$/)}`, "3|6");
  esit("Excel: para başlıkları her gün grubunda (6 × Döviz + 6 × Kuyum)", `${say(/^Döviz$/)}|${say(/^Kuyum$/)}`, "6|6");
  esit("Excel: net satırları (3 cari + genel)", `${say(/^Bakiye : /)}|${say(/^Genel bakiye : /)}`, "3|1");
  const duz = ilk.join("\n");
  esit("Excel: ara toplam sayısı başlık satırlarını saymaz", /Gün toplamı \(9\)/.test(JSON.stringify(wb.worksheets[0].getSheetValues())), true);
  esit("Excel: genel toplam kayıt sayısı = veri satırı", /GENEL TOPLAM \(54 kayıt\)/.test(JSON.stringify(wb.worksheets[0].getSheetValues())), true);
  esit("Excel: alt tablo başlığı ve toplamı", /Fişler/.test(JSON.stringify(wb.worksheets[0].getSheetValues())) && /TOPLAM/.test(JSON.stringify(wb.worksheets[0].getSheetValues())) && /Para toplamı/.test(JSON.stringify(wb.worksheets[0].getSheetValues())), true);
  void duz;
  // Sorgunun seçtiği gruplama (tek seviye) ve grupsuz
  const tek = await raporPdf({ ...girdi, gruplar: [{ anahtar: "paraKod", baslik: "{{paraKod}}" }], satirlar });
  const grupsuz = await raporExcel({ ...girdi, gruplar: [], satirlar });
  esit("sorgu grupları: tek seviye PDF, grupsuz Excel", tek.length > 1000 && grupsuz.length > 1000, true);
  // Sayfa toplamı olmayan, alt tablosuz sade tanım hâlâ çizilir
  const sade = await raporPdf({ tanim: { ...tanim, gruplar: undefined, net: undefined, altTablo: undefined, grupAltTablo: undefined, sayfaToplami: false }, satirlar, filtreOzeti: "sade", firma, kullanici: "test" });
  esit("sade tanım PDF", sade.subarray(0, 5).toString(), "%PDF-");
}

console.log(hata ? `\n${hata} HATA` : "\nTEMEL TESTLERİ GEÇTİ");
process.exit(hata ? 1 : 0);
