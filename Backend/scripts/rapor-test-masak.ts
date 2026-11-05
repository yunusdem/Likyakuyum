/**
 * MASAK raporları saf mantık testi (docs/RAPOR_ESITLEME_UYGULAMA.md, MASAK grubu) — veritabanı gerekmez.
 * Müşteri satırı + alt fişler (B20), sektör bölümleri (B22), limitler, yaş sınırı, yüksek tutar (0 = tümü), fiş kontrol (iptal + sıra), tanımlar ve çizim.
 * Çalıştır: cd Backend && npx tsx scripts/rapor-test-masak.ts   Çıktı: ../tmp/rapor-test/MASAK-*.pdf / .xlsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { raporPdf, raporTanimOku, genelToplamVar, etkinGruplar } from "../src/services/rapor/raporMotor.js";
import { raporExcel } from "../src/services/rapor/raporExcel.js";
import { kosulSaglandi } from "../src/services/rapor/rapor.service.js";
import { musteriSatirlari, karaListeMetni, kontrolOzeti, meslekGrubu, sektorGrubu, musteriAnahtari, yerTutucuKimlik, gercekKimlik, unvanAnahtari, masakLimitleri, yasUygunMu, yuksekTutar, kontrolNedenleri, kontrolSirasi, fisParalari, yasAraligi, type MasakSatiri } from "../src/services/rapor/veri/masak.js";

let hata = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else console.log(`✓ ${ad}`); };
const firma = { ad: "ÖRNEK DÖVİZ VE KUYUMCULUK AŞ", vkn: "1234567890" };
const dir = path.resolve("../tmp/rapor-test"); mkdirSync(dir, { recursive: true });

/**
 * Örnek veri (elle hesap): USD kuru 40, EUR kuru 50.
 *  Döviz fişi bölümü (1):
 *   fiş 1  ALİ YILMAZ  (VKN 12345678901, Kuyumcu, doğum 01.01.1990)  25.09  toplam 1.000 = USD 10 × 40 (400; 10 USD) + EUR 12 × 50 (600; 15 USD)
 *   fiş 2  ALİ YILMAZ  (VKN 12345678901, Kuyumcu)                    25.09  toplam   500 = USD 12,5 × 40 (12,5 USD)
 *   fiş 3  VELİ KAYA   (pasaport P222, Avukat, doğum 15.06.2010) 26.09  toplam 3.000 = USD 75 × 40 (75 USD)
 *   fiş 4  İSİMSİZ     (kimlik yok, meslek yok)              26.09  toplam   200 = EUR 4 × 50 (5 USD)
 *  Sarraf fişi bölümü (2):
 *   fiş 500000001  ALİ YILMAZ (VKN 12345678901, Kuyumcu)             27.09  toplam 8.000 = 22 ayar 2 × 4.000 (200 USD)
 */
const satir = (fisId: number, satirNo: number, bolum: number, gun: string, unvan: string, vkn: string, pasaport: string, meslek: string, dogum: string | null, fisTutar: number,
  paraKod: string, miktar: number, kur: number, usd: number, seriNo = "AA"): MasakSatiri => ({
  fisId, satirNo, bolum, zaman: `${gun}T07:00:00.000Z`, gun, seriNo, belgeNo: `B${fisId}`, unvan, kimlikNo: vkn || pasaport, vergiKimlikNo: vkn, pasaportNo: pasaport, tip: "Alış",
  tutar: miktar * kur, fisTutar, miktar, kur, paraKod, usdKarsiligi: usd, meslekId: meslek ? 5 : 0, meslek, sektor: "", dogumTarihi: dogum, masakListesinde: false,
  supheliYetkili: "", kaydeden: "ayşe", vezneKod: "01", paralar: "" });
const veri: MasakSatiri[] = [
  satir(1, 1, 1, "2026-09-25", "ALİ YILMAZ", "12345678901", "", "Kuyumcu", "1990-01-01", 1000, "USD", 10, 40, 10),
  satir(1, 2, 1, "2026-09-25", "ALİ YILMAZ", "12345678901", "", "Kuyumcu", "1990-01-01", 1000, "EUR", 12, 50, 15),
  satir(2, 1, 1, "2026-09-25", "ALİ YILMAZ", "12345678901", "", "Kuyumcu", "1990-01-01", 500, "USD", 12.5, 40, 12.5),
  satir(3, 1, 1, "2026-09-26", "VELİ KAYA", "", "P222", "Avukat", "2010-06-15", 3000, "USD", 75, 40, 75),
  satir(4, 1, 1, "2026-09-26", "İSİMSİZ", "", "", "", null, 200, "EUR", 4, 50, 5),
  satir(500000001, 1, 2, "2026-09-27", "ALİ YILMAZ", "12345678901", "", "Kuyumcu", "1990-01-01", 8000, "22", 2, 4000, 200),
];
const meslekAdi = (x: MasakSatiri) => x.meslek || "Meslek belirtilmemiş";
const dok = (g: ReturnType<typeof musteriSatirlari>) => g.satirlar.map(m => `${m.bolum}/${m.ustGrup}/${m.unvan}:${m.islemSayisi}:${m.tutar}:${m.usdKarsiligi}:${m._alt.length}`).join(" | ");

// Müşteri satırı + alt fişler (meslek raporu, limitsiz)
{
  const g = musteriSatirlari(veri, meslekAdi);
  esit("meslek: müşteri satırları (bölüm → meslek → ünvan; işlem sayısı : tutar : USD : alt satır)", dok(g),
    "1/Avukat/VELİ KAYA:1:3000:75:1 | 1/Kuyumcu/ALİ YILMAZ:2:1500:37.5:3 | 1/Meslek belirtilmemiş/İSİMSİZ:1:200:5:1 | 2/Kuyumcu/ALİ YILMAZ:1:8000:200:1");
  const ali = g.satirlar[1];
  esit("meslek: müşteri satırında kimlik ayrı kolonlarda", `${ali.vergiKimlikNo}|${ali.pasaportNo}|${g.satirlar[0].vergiKimlikNo}|${g.satirlar[0].pasaportNo}`, "12345678901|||P222");
  esit("meslek: alt fişler (belge no · para · miktar · kur · tutar)", ali._alt.map(a => `${a.belgeNo}·${a.paraKod}·${a.miktar}·${a.kur}·${a.tutar}`).join(" "), "B1·USD·10·40·400 B1·EUR·12·50·600 B2·USD·12.5·40·500");
  esit("meslek: alt TOPLAM = satır tutarları (400 + 600 + 500)", ali._alt.reduce((t, a) => t + a.tutar, 0), 1500);
  esit("meslek: alt satırda tarih ve saat aynı zamandan, seri no ayrı", `${ali._alt[0].zaman === ali._alt[0].saat}|${ali._alt[0].seriNo}|${ali._alt[0].vezneKod}|${ali._alt[0].kaydeden}`, "true|AA|01|ayşe");
  esit("meslek: bölüm adları", [...new Set(g.satirlar.map(m => m.bolumAd))].join(), "Döviz fişi,Sarraf fişi");
  esit("meslek: ara toplam (Kuyumcu, Döviz fişi) işlem sayısı + tutar", g.satirlar.filter(m => m.bolum === 1 && m.ustGrup === "Kuyumcu").map(m => `${m.islemSayisi}|${m.tutar}`).join(), "2|1500");
  esit("meslek: genel toplam işlem sayısı / tutar / USD", `${g.satirlar.reduce((t, m) => t + m.islemSayisi, 0)}|${g.satirlar.reduce((t, m) => t + m.tutar, 0)}|${g.satirlar.reduce((t, m) => t + m.usdKarsiligi, 0)}`, "5|12700|317.5");
  esit("meslek: özet (grup : müşteri : işlem : tutar : USD)", g.ozet.map(o => `${o.grup}:${o.musteri}:${o.adet}:${o.tutar}:${o.usdKarsiligi}`).join(" | "),
    "Avukat:1:1:3000:75 | Kuyumcu:1:3:9500:237.5 | Meslek belirtilmemiş:1:1:200:5 | GENEL TOPLAM:3:5:12700:317.5");
  esit("meslek: özet payı (Kuyumcu 9.500 / 12.700)", g.ozet[1].pay.toFixed(2), "74.80");
  esit("meslek: fiş satırı sayısı (üst sınır denetimi)", g.fisSatiri, 6);
  // Tek bölüm (yalnız Döviz fişi): bölümsüz eski listeyle aynı müşteriler
  const tek = musteriSatirlari(veri.filter(x => x.bolum === 1), meslekAdi);
  esit("meslek: yalnız döviz fişi", dok(tek), "1/Avukat/VELİ KAYA:1:3000:75:1 | 1/Kuyumcu/ALİ YILMAZ:2:1500:37.5:3 | 1/Meslek belirtilmemiş/İSİMSİZ:1:200:5:1");
  esit("meslek: bölüm alanı olmayan satır Döviz fişi sayılır", musteriSatirlari(veri.slice(0, 3).map(x => ({ ...x, bolum: undefined })), meslekAdi).satirlar.map(m => `${m.bolum}:${m.bolumAd}:${m.islemSayisi}`).join(), "1:Döviz fişi:2");
}

// Müşteri anahtarı (canlı geri bildirim): nihai tüketici yer tutucu numaraları kimlik sayılmaz, ünvan büyük harf + kırpılarak karşılaştırılır
{
  esit("yerTutucuKimlik", ["11111111111", "2222222222", "0000000000", " 33333 ", "12345678901", "P222", ""].map(yerTutucuKimlik).join(), "true,true,true,true,false,false,false");
  esit("gercekKimlik", `${gercekKimlik("11111111111")}|${gercekKimlik(" 12345678901 ")}|${gercekKimlik(null)}`, "|12345678901|");
  esit("unvanAnahtari", `${unvanAnahtari("  İsim beyan edilmemiştir ")}|${unvanAnahtari("ışık")}`, "İSİM BEYAN EDİLMEMİŞTİR|IŞIK");
  esit("musteriAnahtari", [musteriAnahtari({ kimlikNo: "11111111111", unvan: "Ayşe Demir", fisId: 1 }), musteriAnahtari({ kimlikNo: "12345678901", unvan: "x", fisId: 2 }),
    musteriAnahtari({ kimlikNo: "", unvan: " ", fisId: 3 })].join(), "~AYŞE DEMİR,12345678901,#3");
  /*
   * Elle hesap (hepsi Döviz fişi, meslek yok, aynı gün):
   *  fiş 10 "NİHAİ TÜKETİCİ"          VKN 11111111111   700 TL
   *  fiş 11 "Ayşe Demir"              VKN 11111111111   400 TL
   *  fiş 12 "AYŞE DEMİR"              VKN —             300 TL
   *  fiş 13 "İsim beyan edilmemiştir" VKN 2222222222    100 TL
   *  fiş 14 "İSİM BEYAN EDİLMEMİŞTİR" VKN —             250 TL
   * Eski anahtar: 11111111111 → fiş 10 + 11 (2 işlem, 1.100), ~AYŞE DEMİR 300, 2222222222 100, ~İSİM… 250.
   * Yeni anahtar: NİHAİ TÜKETİCİ 1 işlem 700 · Ayşe Demir (ilk fişteki ünvan) 2 işlem 700 · İsim beyan edilmemiştir 2 işlem 350.
   */
  const nt = [satir(10, 1, 1, "2026-09-25", "NİHAİ TÜKETİCİ", "11111111111", "", "", null, 700, "USD", 17.5, 40, 17.5),
    satir(11, 1, 1, "2026-09-25", "Ayşe Demir", "11111111111", "", "", null, 400, "USD", 10, 40, 10),
    satir(12, 1, 1, "2026-09-25", "AYŞE DEMİR", "", "", "", null, 300, "USD", 7.5, 40, 7.5),
    satir(13, 1, 1, "2026-09-25", "İsim beyan edilmemiştir", "2222222222", "", "", null, 100, "USD", 2.5, 40, 2.5),
    satir(14, 1, 1, "2026-09-25", "İSİM BEYAN EDİLMEMİŞTİR", "", "", "", null, 250, "USD", 6.25, 40, 6.25)];
  const liste = (g: ReturnType<typeof musteriSatirlari>) => g.satirlar.map(m => `${m.unvan}:${m.islemSayisi}:${m.tutar}`).join(", ");
  esit("yer tutucu: müşteriler ünvana göre ayrılır, büyük / küçük harf farkı birleşir", liste(musteriSatirlari(nt, meslekAdi)), "Ayşe Demir:2:700, İsim beyan edilmemiştir:2:350, NİHAİ TÜKETİCİ:1:700");
  esit("yer tutucu: alt fişler (Ayşe Demir)", musteriSatirlari(nt, meslekAdi).satirlar[0]._alt.map(a => a.belgeNo).join(), "B11,B12");
  esit("yer tutucu: işlem sayısı alt limiti 2 (eskide yalnız 11111111111 grubu çıkardı)", liste(musteriSatirlari(nt, meslekAdi, masakLimitleri({ adet: 2 }))), "Ayşe Demir:2:700, İsim beyan edilmemiştir:2:350");
  esit("yer tutucu: tutar alt limiti 700", liste(musteriSatirlari(nt, meslekAdi, masakLimitleri({ esik: 700 }))), "Ayşe Demir:2:700, NİHAİ TÜKETİCİ:1:700");
  esit("yer tutucu: özet müşteri sayısı 3, işlem 5, tutar 1.750", musteriSatirlari(nt, meslekAdi).ozet.map(o => `${o.musteri}:${o.adet}:${o.tutar}`).join(), "3:5:1750");
  const yuk = (esik: number, kip: "donem" | "gunluk" | "fis") => yuksekTutar(nt, esik, kip).satirlar.map(m => `${m.unvan}:${m.islemSayisi}:${m.tutar}`).join(", ");
  esit("yer tutucu: yüksek tutar dönem ≥ 600", yuk(600, "donem"), "Ayşe Demir:2:700, NİHAİ TÜKETİCİ:1:700");
  esit("yer tutucu: yüksek tutar günlük ≥ 600 (müşteri × gün)", yuk(600, "gunluk"), "Ayşe Demir:2:700, NİHAİ TÜKETİCİ:1:700");
  esit("yer tutucu: yüksek tutar fiş ≥ 600", yuk(600, "fis"), "NİHAİ TÜKETİCİ:1:700");
}

// MSKSEK1: sektör grubu (Meslek'teki "Meslek belirtilmemiş" ile aynı biçim)
{
  esit("sektör / meslek grup adı", `${sektorGrubu({ sektor: "" })}|${sektorGrubu({ sektor: "Turizm" })}|${meslekGrubu({ meslek: "" })}`, "Sektör belirtilmemiş|Turizm|Meslek belirtilmemiş");
  const sk = [satir(20, 1, 1, "2026-09-25", "A", "12345678901", "", "", null, 100, "USD", 2.5, 40, 2.5), satir(21, 1, 1, "2026-09-25", "B", "", "", "", null, 50, "USD", 1.25, 40, 1.25)].map((x, i) => ({ ...x, sektor: i ? "" : "Turizm" }));
  esit("sektör: gruplar ve özet", musteriSatirlari(sk, sektorGrubu).ozet.map(o => `${o.grup}:${o.adet}:${o.tutar}`).join(", "), "Sektör belirtilmemiş:1:50, Turizm:1:100, GENEL TOPLAM:2:150");
}

// Limitler (eski @Gecerli): girilenlerin hepsi; girilmeyen / 0 uygulanmaz. Müşteri bölüm içinde değerlendirilir
{
  const adlar = (p: { adet?: number; esik?: number }) => musteriSatirlari(veri, meslekAdi, masakLimitleri(p)).satirlar.map(m => `${m.bolum}:${m.unvan}`).join();
  esit("limit yok", adlar({}), "1:VELİ KAYA,1:ALİ YILMAZ,1:İSİMSİZ,2:ALİ YILMAZ");
  esit("limit 0 = sınır yok", adlar({ adet: 0, esik: 0 }), "1:VELİ KAYA,1:ALİ YILMAZ,1:İSİMSİZ,2:ALİ YILMAZ");
  esit("işlem sayısı alt limiti 2 (sarraf bölümünde tek fiş → dışarıda)", adlar({ adet: 2 }), "1:ALİ YILMAZ");
  esit("tutar alt limiti 1.500 (sınır dahil)", adlar({ esik: 1500 }), "1:VELİ KAYA,1:ALİ YILMAZ,2:ALİ YILMAZ");
  esit("tutar alt limiti 1.501", adlar({ esik: 1501 }), "1:VELİ KAYA,2:ALİ YILMAZ");
  esit("iki limit birlikte (2 işlem ve 2.000 TL) → yok", adlar({ adet: 2, esik: 2000 }), "");
  esit("iki limit birlikte (2 işlem ve 1.000 TL)", adlar({ adet: 2, esik: 1000 }), "1:ALİ YILMAZ");
}

// Yaş: aralık grubu + "yaşından küçük / büyük" sınırı
{
  const yasli = veri.map(x => { const y = yasAraligi(x.dogumTarihi, x.zaman); return { ...x, yas: y.yas, yasAraligi: y.aralik, yasSira: y.sira }; });
  const ust = (x: typeof yasli[number]) => `${String(x.yasSira).padStart(2, "0")}|${x.yasSira === 99 ? x.yasAraligi : `${x.yasAraligi} yaş`}`;
  const g = musteriSatirlari(yasli, ust);
  esit("yaş: gruplar ve yaşlar (ALİ 36, VELİ 16, İSİMSİZ yok)", g.satirlar.map(m => `${m.bolum}/${m.ustGrup}/${m.unvan}:${m.yas}`).join(" | "),
    "1/00|0 – 17 yaş/VELİ KAYA:16 | 1/03|36 – 50 yaş/ALİ YILMAZ:36 | 1/99|Doğum tarihi yok/İSİMSİZ:null | 2/03|36 – 50 yaş/ALİ YILMAZ:36");
  esit("yaş: özet sırası yaş aralığına göre", g.ozet.map(o => `${o.grup}:${o.musteri}:${o.adet}`).join(" | "), "00|0 – 17 yaş:1:1 | 03|36 – 50 yaş:1:3 | 99|Doğum tarihi yok:1:1 | GENEL TOPLAM:3:5");
  const sec = (kucuk: number, buyuk: number) => musteriSatirlari(yasli, ust, m => yasUygunMu(m.ilk.yas, kucuk, buyuk)).satirlar.map(m => `${m.bolum}:${m.unvan}`).join();
  esit("yaş: sınır yok → herkes (doğum tarihi olmayan dahil)", sec(0, 0), "1:VELİ KAYA,1:ALİ YILMAZ,1:İSİMSİZ,2:ALİ YILMAZ");
  esit("yaş: 18 yaşından küçük", sec(18, 0), "1:VELİ KAYA");
  esit("yaş: 36 yaşından büyük (sınır dahil)", sec(0, 36), "1:ALİ YILMAZ,2:ALİ YILMAZ");
  esit("yaş: 16'dan küçük VEYA 37'den büyük → yalnız VELİ", sec(16, 37), "1:VELİ KAYA");
  esit("yasUygunMu", [yasUygunMu(null, 0, 0), yasUygunMu(null, 18, 0), yasUygunMu(18, 18, 0), yasUygunMu(19, 18, 0), yasUygunMu(65, 18, 65), yasUygunMu(40, 18, 65)].join(), "true,false,true,false,true,false");
}

// Yüksek tutar: dönem (eski) / günlük / fiş; 0 = tümü
{
  const adlar = (esik: number, kip: "donem" | "gunluk" | "fis") => yuksekTutar(veri, esik, kip).satirlar.map(m => `${m.bolum}:${m.unvan}:${m.islemSayisi}:${m.tutar}`).join();
  esit("yüksek: dönem toplamı ≥ 1.200", adlar(1200, "donem"), "1:ALİ YILMAZ:2:1500,1:VELİ KAYA:1:3000,2:ALİ YILMAZ:1:8000");
  esit("yüksek: fiş bazında ≥ 1.200 (ALİ'nin 1.000 ve 500'lük fişleri dışarıda)", adlar(1200, "fis"), "1:VELİ KAYA:1:3000,2:ALİ YILMAZ:1:8000");
  esit("yüksek: günlük toplam ≥ 1.200 (ALİ 25.09: 1.000 + 500)", adlar(1200, "gunluk"), "1:ALİ YILMAZ:2:1500,1:VELİ KAYA:1:3000,2:ALİ YILMAZ:1:8000");
  esit("yüksek: günlük toplam ≥ 1.501", adlar(1501, "gunluk"), "1:VELİ KAYA:1:3000,2:ALİ YILMAZ:1:8000");
  esit("yüksek: sınır dahil (dönem ≥ 1.500)", adlar(1500, "donem"), "1:ALİ YILMAZ:2:1500,1:VELİ KAYA:1:3000,2:ALİ YILMAZ:1:8000");
  esit("yüksek: 0 = tümü (her kipte bütün müşteriler)", `${adlar(0, "donem")} / ${adlar(0, "fis") === adlar(0, "donem")} / ${adlar(0, "gunluk") === adlar(0, "donem")}`,
    "1:ALİ YILMAZ:2:1500,1:İSİMSİZ:1:200,1:VELİ KAYA:1:3000,2:ALİ YILMAZ:1:8000 / true / true");
  esit("yüksek: özet tek satır (Tümü)", yuksekTutar(veri, 1200, "donem").ozet.map(o => `${o.grup}:${o.musteri}:${o.adet}:${o.tutar}`).join(), "Tümü:2:4:12500");
}

// Fiş kontrol: iptal fişler tek başına değerlendirilir, parçalı işlem toplamına girmez; sıra bölüm + tarih + seri no
{
  const f = (fisId: number, kimlikNo: string, tutar: number, ek: any = {}) => ({ fisId, gun: "2026-09-17", kimlikNo, tutar, meslekId: 5, dogumTarihi: "1980-01-01", masakListesinde: false, ...ek });
  const yaz = (m: Map<number, string[]>) => [...m.entries()].sort((a, b) => a[0] - b[0]).map(([id, n]) => `${id}:${n.join("+")}`).join(" | ");
  esit("kontrol: iptal yokken parçalı işlem (60.000 + 50.000 ≥ 100.000)", yaz(kontrolNedenleri([f(1, "111", 60000), f(2, "111", 50000)], 100000, 2)),
    "1:Parçalı işlem: aynı gün 2 fiş, toplam 110.000 TL | 2:Parçalı işlem: aynı gün 2 fiş, toplam 110.000 TL");
  esit("kontrol: fişlerden biri iptalse parçalı işlem oluşmaz", yaz(kontrolNedenleri([f(1, "111", 60000), f(2, "111", 50000, { iptal: true })], 100000, 2)), "");
  esit("kontrol: iptal fiş kendi kuralına takılır (eksik bilgi, MASAK listesi)", yaz(kontrolNedenleri([f(1, "111", 60000), f(3, "333", 150000, { meslekId: 0, iptal: true }), f(4, "444", 10, { masakListesinde: true, iptal: true })], 100000, 2)),
    "3:Eşik üstü, eksik bilgi: meslek | 4:MASAK listesinde eşleşme");
  esit("kontrol: iptal olmayanların sonucu iptal fişten etkilenmez", yaz(kontrolNedenleri([f(1, "111", 60000), f(2, "111", 50000), f(5, "111", 70000, { iptal: true })], 100000, 2)),
    "1:Parçalı işlem: aynı gün 2 fiş, toplam 110.000 TL | 2:Parçalı işlem: aynı gün 2 fiş, toplam 110.000 TL");
  const sira = kontrolSirasi([{ bolum: 1, gun: "2026-09-26", seriNo: "B", n: 1 }, { bolum: 1, gun: "2026-09-25", seriNo: "Z", n: 2 }, { bolum: 2, gun: "2026-09-24", seriNo: "A", n: 3 },
    { bolum: 1, gun: "2026-09-25", seriNo: "A", n: 4 }, { bolum: 1, gun: "2026-09-25", seriNo: "A", n: 5 }]);
  esit("kontrol sırası: bölüm, tarih, seri no; eşitlikte geliş sırası", sira.map(s => s.n).join(), "4,5,2,1,3");
  esit("fisParalari: fişin paraları kod sırasıyla, yinelemesiz", [...fisParalari([{ fisId: 1, paraKod: "USD" }, { fisId: 1, paraKod: "EUR" }, { fisId: 1, paraKod: "USD" }, { fisId: 2, paraKod: "" }])].map(([id, p]) => `${id}=${p}`).join(";"), "1=EUR, USD;2=");
}

// MSKKON1: kısa filtre özeti
{
  esit("kontrol özeti: kurallar", kontrolOzeti(240000, "kural", 2), "Eşik 240.000 TL · Parça ≥ 2");
  esit("kontrol özeti: sınır üstü / tümü / eşiksiz", `${kontrolOzeti(185000, "sinirUstu", 2)}|${kontrolOzeti(185000, "tumu", 3)}|${kontrolOzeti(0, "kural", 3)}`, "Eşik 185.000 TL · Sınır üstü|Eşik 185.000 TL · Tümü|Eşik yok · Parça ≥ 3");
  esit("kontrol özeti: 40 karakteri geçmez", kontrolOzeti(999999999, "kural", 10).length <= 40, true);
}

// KNSKLOG1: Kara listede kolonu
esit("KNSK kara listede: EVET / HAYIR", [karaListeMetni(true), karaListeMetni(1), karaListeMetni(false), karaListeMetni(0), karaListeMetni(null)].join(), "EVET,EVET,HAYIR,HAYIR,HAYIR");

// Tanımlar: alt tablo, gruplar, genel toplam, bölüm, ayrı kolonlar, "Saat gözükmesin"
{
  const anahtarlar = (kod: string, pdf = false) => raporTanimOku(kod).kolonlar.filter(k => !pdf || k.pdf !== false).map(k => k.anahtar).join();
  for (const kod of ["MSKMES1", "MSKSEK1", "MSKYAS1", "MSKYUK1"]) {
    const t = raporTanimOku(kod);
    esit(`${kod}: alt tablo (eski alt rapor kolonları + TOPLAM)`, `${t.altTablo?.kolonlar.filter(k => k.pdf !== false).map(k => k.anahtar).join()}|${t.altTablo?.toplamEtiketi}|${t.altTablo?.kolonlar.filter(k => k.toplam).map(k => k.anahtar).join()}`,
      "zaman,saat,seriNo,belgeNo,tip,unvan,miktar,paraKod,kur,tutar,usdKarsiligi|TOPLAM :|tutar,usdKarsiligi");
    esit(`${kod}: bölüm = sektör, özet tablosu duruyor`, `${t.bolum?.anahtar}|${!!t.ozet}|${t.ozet?.kolonlar.map(k => k.anahtar).join()}`, "bolumAd|true|grup,musteri,adet,tutar,usdKarsiligi,pay");
    esit(`${kod}: müşteri satırında VKN ve pasaport ayrı`, t.kolonlar.slice(0, 3).map(k => k.anahtar).join(), "unvan,vergiKimlikNo,pasaportNo");
  }
  for (const kod of ["MSKMES1", "MSKSEK1"]) {
    const t = raporTanimOku(kod);
    esit(`${kod}: grup ara toplamı (işlem sayısı + tutar) ve genel toplam`, `${etkinGruplar(t).map(g => `${g.anahtar}:${g.altToplam !== false}`).join()}|${t.kolonlar.filter(k => k.toplam).map(k => k.anahtar).join()}|${genelToplamVar(t, etkinGruplar(t))}`,
      "ustGrup:true|islemSayisi,tutar,usdKarsiligi|true");
  }
  esit("MSKYAS1: yaş aralığı grubu duruyor, toplam yok", `${etkinGruplar(raporTanimOku("MSKYAS1")).map(g => `${g.anahtar}:${g.altToplam !== false}`).join()}|${genelToplamVar(raporTanimOku("MSKYAS1"), [])}|${raporTanimOku("MSKYAS1").bolum?.altToplam}`, "ustGrup:false|false|false");
  esit("MSKYAS1: müşteri kolonları", anahtarlar("MSKYAS1", true), "unvan,vergiKimlikNo,pasaportNo,dogumTarihi,yas,meslek,islemSayisi,tutar,usdKarsiligi");
  esit("MSKYUK1: müşteri kolonları, grupsuz, genel toplam yok", `${anahtarlar("MSKYUK1", true)}|${etkinGruplar(raporTanimOku("MSKYUK1")).length}|${genelToplamVar(raporTanimOku("MSKYUK1"), [])}`,
    "unvan,vergiKimlikNo,pasaportNo,yas,sektor,meslek,islemSayisi,tutar,usdKarsiligi|0|false");
  for (const kod of ["MSKSUP1", "MSKKON1"]) { const t = raporTanimOku(kod); esit(`${kod}: genel toplam ve bölüm toplamı yok`, `${genelToplamVar(t, etkinGruplar(t))}|${t.bolum?.anahtar}|${t.bolum?.altToplam}`, "false|bolumAd|false"); }
  esit("MSKSUP1: PDF kolonları (tarih / saat, seri no basılı, VKN / pasaport ayrı)", anahtarlar("MSKSUP1", true),
    "zaman,saat,seriNo,belgeNo,tip,unvan,vergiKimlikNo,pasaportNo,uyruk,miktar,paraKod,masakListesindeMetin,supheliYetkili,bildirimFormuMetin,tutar,usdKarsiligi");
  esit("MSKKON1: PDF kolonları (eski sıra + iptal tarihi, belge tipi, adres)", anahtarlar("MSKKON1", true),
    "zaman,saat,iptalTarihi,belgeTipi,seriNo,belgeNo,tip,unvan,pasaportNo,vergiKimlikNo,vergiDairesi,adres,uyruk,babaAdi,anneAdi,kimlikSeriNo,vezneKod,miktar,paraKod,kur,neden,tutar,usdKarsiligi");
  const kon = raporTanimOku("MSKKON1"), saat = kon.kolonlar.find(k => k.anahtar === "saat")!;
  esit("MSKKON1: Saat gözükmesin (varsayılan işaretli → saat yok; işaret kalkınca var)",
    `${kosulSaglandi(saat.kosul, kon, {} as any)}|${kosulSaglandi(saat.kosul, kon, { ek: { saatGizle: "1" } } as any)}|${kosulSaglandi(saat.kosul, kon, { ek: { saatGizle: "0" } } as any)}`, "false|false|true");
  esit("KNSKLOG1: tarih ve saat ayrı kolon", raporTanimOku("KNSKLOG1").kolonlar.slice(0, 3).map(k => `${k.anahtar}:${k.bicim || ""}`).join(), "zaman:tarih,saat:saat,kullanici:");
  esit("kâğıt yönleri", ["MSKMES1", "MSKSEK1", "MSKYAS1", "MSKYUK1", "MSKSUP1", "MSKKON1", "KNSKLOG1"].map(k => raporTanimOku(k).kagit).join(), Array(7).fill("A4-yatay").join());
}

// Çizim: bölüm → meslek → müşteri + alt tablo (PDF / Excel)
{
  const g = musteriSatirlari(veri, meslekAdi), t = raporTanimOku("MSKMES1");
  const girdi = { tanim: t, satirlar: g.satirlar as Record<string, any>[], filtreOzeti: "25.09.2026 – 27.09.2026", firma, kullanici: "test", ozetSatirlar: g.ozet };
  const pdf = await raporPdf(girdi);
  esit("MSKMES1 PDF üretildi", pdf.subarray(0, 5).toString(), "%PDF-");
  writeFileSync(path.join(dir, "MASAK-meslek.pdf"), pdf);
  const xlsx = await raporExcel(girdi);
  writeFileSync(path.join(dir, "MASAK-meslek.xlsx"), xlsx);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx as any);
  // Başlık / toplam satırları ilk sütundan okunur (birleştirilmiş hücreler her sütunda aynı değeri verir); alt tablo ikinci sütundan başlar → tüm hücreler
  const ilk: string[] = [], hucreler: string[] = [];
  wb.worksheets[0].eachRow(row => { ilk.push(String(row.getCell(1).value ?? "")); row.eachCell(c => hucreler.push(String(c.value ?? ""))); });
  const say = (re: RegExp) => ilk.filter(x => re.test(x)).length, sayTum = (re: RegExp) => hucreler.filter(x => re.test(x)).length;
  esit("Excel: bölüm başlıkları ve bölüm toplamları", `${say(/^Döviz fişi$/)}|${say(/^Sarraf fişi$/)}|${say(/^Döviz fişi toplamı$/)}|${say(/^Sarraf fişi toplamı$/)}`, "1|1|1|1");
  esit("Excel: meslek grupları (3 + 1) ve ara toplamları", `${say(/^(Avukat|Kuyumcu|Meslek belirtilmemiş)$/)}|${say(/^Ara toplam \(\d+\)$/)}`, "4|4");
  esit("Excel: her müşterinin altında alt tablo + TOPLAM", `${sayTum(/^TOPLAM :$/)}|${sayTum(/^Belge no$/)}`, "4|4");
  esit("Excel: genel toplam müşteri sayısıyla", say(/^GENEL TOPLAM \(4 kayıt\)$/), 1);
  // Yaş: genel toplam ve ara toplam basılmaz, yaş aralığı başlıkları kalır
  const yasli = veri.map(x => { const y = yasAraligi(x.dogumTarihi, x.zaman); return { ...x, yas: y.yas, yasAraligi: y.aralik }; });
  const gy = musteriSatirlari(yasli, x => (x.yas === null ? x.yasAraligi : `${x.yasAraligi} yaş`));
  const yasGirdi = { tanim: raporTanimOku("MSKYAS1"), satirlar: gy.satirlar as Record<string, any>[], filtreOzeti: "yaş", firma, kullanici: "test", ozetSatirlar: gy.ozet };
  writeFileSync(path.join(dir, "MASAK-yas.pdf"), await raporPdf(yasGirdi));
  const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.load(await raporExcel(yasGirdi) as any);
  const h2: string[] = [], tum2: string[] = [];
  wb2.worksheets[0].eachRow(row => { h2.push(String(row.getCell(1).value ?? "")); row.eachCell(c => tum2.push(String(c.value ?? ""))); });
  esit("MSKYAS1 Excel: genel / ara / bölüm toplamı yok, yaş aralığı başlıkları ve alt TOPLAM var",
    `${tum2.filter(x => /GENEL TOPLAM|Ara toplam|fişi toplamı/.test(x)).length}|${h2.filter(x => /^(0 – 17 yaş|36 – 50 yaş|Doğum tarihi yok)$/.test(x)).length}|${tum2.filter(x => x === "TOPLAM :").length}`, "0|4|4");
}

console.log(hata ? `\n${hata} HATA` : "\nMASAK TESTLERİ GEÇTİ");
process.exit(hata ? 1 : 0);
