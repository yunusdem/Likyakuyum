/**
 * Yönetici raporları testi (FIRSON1, FIRVAR1, LONSHO1 — docs/RAPOR_ESITLEME_UYGULAMA.md bölüm 2) — veritabanı gerekmez.
 * Çevrim yönü (TL → Döviz / Döviz → Döviz; Long / Short / Denge), varlık cinsi, long / short süzgeci, rapor altı kalemleri, para başlıkları.
 * Beklenen değerler elle hesaplanmıştır (yorumlarda). Çalıştır: cd Backend && npx tsx scripts/rapor-test-yonetici.ts
 * Çıktı: ../tmp/rapor-test/YONETICI-*.pdf / .xlsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { raporTanimOku, raporPdf, veriSatirlari } from "../src/services/rapor/raporMotor.js";
import { raporExcel } from "../src/services/rapor/raporExcel.js";
import { RaporService } from "../src/services/rapor/rapor.service.js";
import { paraBasliklariEkle, paraGrupKur } from "../src/services/rapor/paraGrup.js";
import {
  type KurSeti, FIRSON1_BOS_NOT, LONSHO1_BOS_NOT, degerlemeFarki, MALIYET_BOLUMLERI, longShortBilesenleri, lsGorunenSembol, cevrimOzeti, cevrimSecimi, dengeKalemleri, ekDeger, kurSetiKur, longShortTl, longShortUygun, lsDurumu, lsSembolu, onayAcik, secileneCevir, sonDurumKalemleri,
} from "../src/services/rapor/veri/yonetici.js";
import PDFDocument from "pdfkit";
import { yaziTipleri } from "../src/services/belge/belgeMotor.js";
import { maliyetYurut } from "../src/services/rapor/veri/analiz.js";
import { FIRVAR1_BOS_NOT, grubaGoreDiz, varlikCinsi, varlikKapsami, varlikOzetiKur } from "../src/services/rapor/veri/firmaVarlik.js";

let hata = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else console.log(`✓ ${ad}`); };
/** Sayıları 6 haneye yuvarlayıp birleştirir (kayan nokta farkı için) */
const y6 = (...s: number[]) => s.map(n => String(Math.round(n * 1e6) / 1e6)).join("|");
const firma = { ad: "ÖRNEK FİRMA", vkn: "1234567890" };
const dir = path.resolve("../tmp/rapor-test"); mkdirSync(dir, { recursive: true });

// Paralar: 1 TL, 2 USD, 3 EUR, 5 HAS. Günün kurları — alış: USD 40, EUR 44, HAS 3000; satış: USD 41, EUR 46,125, HAS 3075.
// Devir günü kurları — alış: USD 39, EUR 43, HAS 2900; satış: USD 40, EUR 44, HAS 2950. TL = 1.
const TL = 1, USD = 2, EUR = 3, HAS = 5;
const harita = (usd: number, eur: number, has: number) => new Map<number, number>([[TL, 1], [USD, usd], [EUR, eur], [HAS, has]]);
const gunAlis = harita(40, 44, 3000), gunSatis = harita(41, 46.125, 3075), devirAlis = harita(39, 43, 2900), devirSatis = harita(40, 44, 2950);
/** Kur seçimi "alış" iken: kur = alış haritası */
const gun: KurSeti = { kur: gunAlis, alis: gunAlis, satis: gunSatis }, devir: KurSeti = { kur: devirAlis, alis: devirAlis, satis: devirSatis };

// ── Ek parametre okuma: p.ek → p → ""; onay kutusu gelmediyse varsayılan
esit("ekDeger: ek / düz / yok", [ekDeger({ ek: { longShort: " long " } } as any, "longShort"), ekDeger({ longShort: "short" } as any, "longShort"), ekDeger({ ek: { longShort: "long" }, longShort: "short" } as any, "longShort"), ekDeger({} as any, "longShort")].join(), "long,short,long,");
esit("onayAcik: 1 / 0 / gelmedi (varsayılan)", [onayAcik("1", false), onayAcik("0", true), onayAcik("", true), onayAcik("", false), onayAcik("Evet", false)].join(), "true,false,true,false,true");

// ── Çevrim seçimi
esit("cevrimSecimi: değerler / boş / tanınmayan / varsayılan", [cevrimSecimi("alis"), cevrimSecimi("satis"), cevrimSecimi("kur"), cevrimSecimi(""), cevrimSecimi("x"), cevrimSecimi("", "alis")].join(), "alis,satis,kur,kur,kur,alis");
esit("cevrimOzeti: varsayılanda boş, seçilince yazılır", `${cevrimOzeti("TL → Döviz", "kur")}|${cevrimOzeti("TL → Döviz", "satis")}|${cevrimOzeti("Long çevrimi", "alis", "alis")}|${cevrimOzeti("Long çevrimi", "satis", "alis")}`,
  "| · TL → Döviz: Satış|| · Long çevrimi: Satış");

// ── secileneCevir (eski @SecilenBorc formülü)
const c = (miktar: number, paraId: number, hedefId: number, tlDoviz: any, dovizDoviz: any, kurlar = gun) => secileneCevir(miktar, paraId, { tlId: TL, hedefId, kurlar, tlDoviz, dovizDoviz });
// TL satırı → USD: 8200 ÷ 41 (satış) = 200; 8200 ÷ 40 (alış) = 205 — "Döviz → Döviz" seçimi TL satırını etkilemez
esit("TL → USD: TL → Döviz seçimi (satış / alış)", y6(c(8200, TL, USD, "satis", "alis"), c(8200, TL, USD, "alis", "satis")), "200|205");
// EUR satırı → USD: 100 × 44 ÷ 40 = 110 (alış); 100 × 46,125 ÷ 41 = 112,5 (satış) — "TL → Döviz" seçimi döviz satırını etkilemez
esit("EUR → USD: Döviz → Döviz seçimi (alış / satış)", y6(c(100, EUR, USD, "satis", "alis"), c(100, EUR, USD, "alis", "satis")), "110|112.5");
// Seçilen para TL: bölen 1 → 100 EUR = 4400 (alış) / 4612,5 (satış); TL → TL = 500
esit("EUR → TL ve TL → TL", y6(c(100, EUR, TL, "kur", "alis"), c(100, EUR, TL, "kur", "satis"), c(500, TL, TL, "satis", "satis")), "4400|4612.5|500");
// Paranın kendisi seçilen para: miktar aynen
esit("USD → USD = miktar", y6(c(50, USD, USD, "alis", "alis"), c(50, USD, USD, "satis", "satis")), "50|50");
// Seçilen paranın kuru yok → 0; satır parasının kuru yok → 0
esit("kur yoksa 0", y6(c(100, USD, 9, "alis", "alis"), c(100, 9, USD, "alis", "alis"), c(100, TL, 9, "alis", "alis")), "0|0|0");
// "kur" seçimi kur seçiminin haritasını kullanır: kur seçimi satış ise (kur = satış haritası) sonuç satışla aynı
esit("kur seçimi = kur seçiminin haritası", y6(c(100, EUR, USD, "kur", "kur", { kur: gunSatis, alis: gunAlis, satis: gunSatis }), c(8200, TL, USD, "kur", "kur", { kur: gunSatis, alis: gunAlis, satis: gunSatis }), c(100, EUR, USD, "kur", "kur")), "112.5|200|110");
{
  let okundu = 0;
  const oku = async () => { okundu++; return { alis: gunAlis, satis: gunSatis }; };
  const v = await kurSetiKur(["kur", "kur"], gunSatis, oku), s = await kurSetiKur(["kur", "satis"], gunAlis, oku);
  esit("kurSetiKur: varsayılanda ek okuma yok, seçimde iki yön", `${okundu}|${v.alis === gunSatis && v.satis === gunSatis && v.kur === gunSatis}|${s.kur === gunAlis && s.alis === gunAlis && s.satis === gunSatis}`, "1|true|true");
}

// ── FIRSON1 rapor altı (eski @SecilenKasaBorc … @ToplamBakiye)
const pozisyon = [
  { paraId: TL, vezne: 820, banka: 410, cariAlacak: 205, cariBorc: 328 },
  { paraId: USD, vezne: -10, banka: 0, cariAlacak: 5, cariBorc: 0 },
  { paraId: EUR, vezne: 20, banka: -2, cariAlacak: 0, cariBorc: 10 },
];
const kalemMetni = (k: any[]) => k.map(x => `${x.kalem}:${y6(x.borc, x.alacak, x.bakiye)}${x.bakiyeTipi}`).join(" ; ");
{
  // Karşılık TL, alış: Kasa borç 820 + 20×44 = 1700, alacak 10×40 = 400 → 1300 B · Banka 410 / 2×44 = 88 → 322 B · Cari borç 205 + 5×40 = 405, alacak 328 + 10×44 = 768 → 363 A
  // Toplam (Kasa + Cari) 2105 / 1168 → 937 B (eski raporun toplamı) · Toplam (Kasa + Banka + Cari) 2515 / 1256 → 1259 B
  const k = sonDurumKalemleri(pozisyon, (id, m) => c(m, id, TL, "kur", "kur"), "TL");
  esit("FIRSON1 kalemleri (TL, kur seçimi)", kalemMetni(k), "Kasa:1700|400|1300B ; Banka:410|88|322B ; Cari:405|768|363A ; Toplam (Kasa + Cari):2105|1168|937B ; Toplam (Kasa + Banka + Cari):2515|1256|1259B");
  esit("FIRSON1 para kodu kalemlerde", [...new Set(k.map(x => x.paraKod))].join(), "TL");
  // Karşılık USD, TL → Döviz satış (÷41), Döviz → Döviz alış (×alış ÷40): Kasa 820÷41 + 20×44÷40 = 42 / 10 → 32 B · Banka 10 / 2,2 → 7,8 B · Cari 5 + 5 = 10 / 8 + 11 = 19 → 9 A
  const u = sonDurumKalemleri(pozisyon, (id, m) => c(m, id, USD, "satis", "alis"), "USD");
  esit("FIRSON1 kalemleri (USD, TL → Döviz satış, Döviz → Döviz alış)", kalemMetni(u), "Kasa:42|10|32B ; Banka:10|2.2|7.8B ; Cari:10|19|9A ; Toplam (Kasa + Cari):52|29|23B ; Toplam (Kasa + Banka + Cari):62|31.2|30.8B");
  // Banka hareketi yoksa Banka satırı basılmaz; iki toplam eşittir
  const b = sonDurumKalemleri(pozisyon.map(o => ({ ...o, banka: 0 })), (id, m) => c(m, id, TL, "kur", "kur"), "TL");
  // Banka hareketi yoksa ne Banka satırı ne de "Toplam (Kasa + Banka + Cari)" basılır (canlı test 05.11.2026)
  esit("FIRSON1 banka yokken: banka satırı ve bankalı toplam yok", kalemMetni(b), "Kasa:1700|400|1300B ; Cari:405|768|363A ; Toplam (Kasa + Cari):2105|1168|937B");
  esit("FIRSON1 sıfır bakiye → B/A boş", sonDurumKalemleri([{ paraId: TL, vezne: 0, banka: 0, cariAlacak: 5, cariBorc: 5 }], (_id, m) => m, "TL").map(x => `${x.kalem}=${x.bakiye}${x.bakiyeTipi}`).join(), "Kasa=0,Cari=0,Toplam (Kasa + Cari)=0");
  // Yalnız bankada eksi bakiye: Banka 0 / 50 → 50 A; bankalı toplam basılır, bankasız toplam bankayı içermez
  const yb = sonDurumKalemleri([{ paraId: TL, vezne: 100, banka: -50, cariAlacak: 0, cariBorc: 0 }], (_id, m) => m, "TL");
  esit("FIRSON1 eksi banka: iki toplam ayrışır", kalemMetni(yb), "Kasa:100|0|100B ; Banka:0|50|50A ; Cari:0|0|0 ; Toplam (Kasa + Cari):100|0|100B ; Toplam (Kasa + Banka + Cari):100|50|50B");
  esit("FIRSON1 boş rapor notu tek kısa cümle", `${FIRSON1_BOS_NOT}|${FIRSON1_BOS_NOT.split(". ").length}|${FIRSON1_BOS_NOT.length < 80}`, "Seçilen tarihe kadar vezne, banka ya da cari hareketi yok.|1|true");
}

// ── FIRVAR1 varlık cinsi
esit("varlikCinsi", [varlikCinsi("kasa"), varlikCinsi("cari"), varlikCinsi("hepsi"), varlikCinsi(""), varlikCinsi("x")].join(), "kasa,cari,hepsi,hepsi,hepsi");
esit("varlikKapsami", (["hepsi", "kasa", "cari"] as const).map(x => { const k = varlikKapsami(x); return `${k.kasa ? "K" : "-"}${k.cari ? "C" : "-"}`; }).join(), "KC,K-,-C");

// ── FIRVAR1 rapor altı (eski @SecilenKapanisDevri, @SecilenAcilisDevri, @SecilenBorc, @SecilenAlacak, @Evaluasyon, @SecilenDevreden, @ToplamNetKarZarar)
const varlik = [
  { paraId: TL, paraKod: "TL", devir: 1025, devreden: 820 },   // alacak 205
  { paraId: HAS, paraKod: "HAS", devir: 2, devreden: 2 },
  { paraId: USD, paraKod: "USD", devir: 100, devreden: 150 },  // borç 50
  { paraId: EUR, paraKod: "EUR", devir: 0, devreden: 0 },      // hareketsiz → satır yok
];
const ortak = { tlId: TL, devirEtiketi: "30.09.2026", kurlar: gun, devirKurlar: devir };
const ozetMetni = (s: Record<string, any>[]) => s.map(x => (x._stil ? `[${x.kalem}]` : x.devir === null ? `${x.kalem}=${y6(x.deger)}` : `${x.kalem}:${y6(x.devir, x.borc, x.alacak, x.devreden, x.deger)}`)).join(" ; ");
{
  // Karşılık TL, kur seçimi (alış): değerler TL 820, HAS 2×3000 = 6000, USD 150×40 = 6000
  // Devir değeri = 1025 + 2×2900 + 100×39 = 10725 (devir günü kuru) · Açılış devri değeri = 1025 + 6000 + 4000 = 11025 (günün kuru) · Evalüasyon = 300
  // Borç değeri = 50×40 = 2000 · Alacak değeri = 205 · Devreden = 11025 + 2000 − 205 = 12820 · Net = 12820 − 10725 = 2095 (kâr)
  const o = varlikOzetiKur(varlik, { ...ortak, hedefId: TL, hedefKod: "TL", tlDoviz: "kur", dovizDoviz: "kur", toplamSatiri: true });
  esit("FIRVAR1 özet (TL, kur seçimi)", ozetMetni(o), "TL:1025|0|205|820|820 ; HAS:2|0|0|2|6000 ; USD:100|50|0|150|6000 ; Devir değeri (TL, 30.09.2026 kuruyla)=10725 ; Kapanış / açılış evalüasyonu (TL)=300 ; "
    + "Açılış devri değeri (TL)=11025 ; Borç değeri (TL)=2000 ; Alacak değeri (TL)=205 ; Devreden değeri (TL)=12820 ; Toplam Net Kâr / Zarar (TL)=2095");
  // Karşılık USD, iki çevrim de satış: TL 820÷41 = 20, HAS 2×3075÷41 = 150, USD 150
  // Devir değeri = 1025÷40 + 2×2950÷40 + 100 = 25,625 + 147,5 + 100 = 273,125 · Açılış = 1025÷41 + 150 + 100 = 275 · Evalüasyon = 1,875
  // Borç = 50 · Alacak = 205÷41 = 5 · Devreden = 275 + 50 − 5 = 320 · Net = 46,875
  const u = varlikOzetiKur(varlik, { ...ortak, hedefId: USD, hedefKod: "USD", tlDoviz: "satis", dovizDoviz: "satis", toplamSatiri: true });
  esit("FIRVAR1 özet (USD, satış / satış)", ozetMetni(u), "TL:1025|0|205|820|20 ; HAS:2|0|0|2|150 ; USD:100|50|0|150|150 ; Devir değeri (USD, 30.09.2026 kuruyla)=273.125 ; Kapanış / açılış evalüasyonu (USD)=1.875 ; "
    + "Açılış devri değeri (USD)=275 ; Borç değeri (USD)=50 ; Alacak değeri (USD)=5 ; Devreden değeri (USD)=320 ; Toplam Net Kâr / Zarar (USD)=46.875");
  // Karışık: TL → Döviz alış (TL ÷40; devir günü ÷39), Döviz → Döviz satış: TL 820÷40 = 20,5; devir değeri = 1025÷39 + 147,5 + 100; açılış = 1025÷40 + 250 = 275,625
  const k = varlikOzetiKur(varlik, { ...ortak, hedefId: USD, hedefKod: "USD", tlDoviz: "alis", dovizDoviz: "satis", toplamSatiri: true });
  const al = (s: Record<string, any>[], ad: string) => Number(s.find(x => String(x.kalem).startsWith(ad))?.deger);
  esit("FIRVAR1 özet (USD, alış / satış)", y6(k[0].deger, al(k, "Devir değeri"), al(k, "Açılış devri değeri"), al(k, "Alacak değeri"), al(k, "Devreden değeri")), y6(20.5, 1025 / 39 + 247.5, 275.625, 5.125, 320.5));
  // Zarar: devir 1000 TL → devreden 400 TL: mutlak 600 + "Zarar" etiketi; işaretli kalem −600
  const z = varlikOzetiKur([{ paraId: TL, paraKod: "TL", devir: 1000, devreden: 400 }], { ...ortak, hedefId: TL, hedefKod: "TL", tlDoviz: "kur", dovizDoviz: "kur", toplamSatiri: true });
  // Net kâr / zarar tek satır, işaretli (canlı test 05.11.2026: iki satır aynı değeri gösteriyordu)
  esit("FIRVAR1 zarar: tek işaretli satır", ozetMetni(z.slice(-2)), "Devreden değeri (TL)=400 ; Toplam Net Kâr / Zarar (TL)=-600");
  esit("FIRVAR1 boş rapor notu tek kısa cümle", `${FIRVAR1_BOS_NOT.split(". ").length}|${FIRVAR1_BOS_NOT.length < 80}`, "1|true");
  esit("FIRVAR1 net kâr / zarar satırı bir kez", [o, u, z].map(x => x.filter(s => /Net/.test(String(s.kalem))).length).join(), "1,1,1");
  // "Toplam satırı" işaretsiz → yalnız para satırları
  const t = varlikOzetiKur(varlik, { ...ortak, hedefId: TL, hedefKod: "TL", tlDoviz: "kur", dovizDoviz: "kur", toplamSatiri: false });
  esit("FIRVAR1 toplam satırı kapalı", ozetMetni(t), "TL:1025|0|205|820|820 ; HAS:2|0|0|2|6000 ; USD:100|50|0|150|6000");
  // Para ayrımı: Döviz (TL dahil) → Kuyum → kalemler "Toplam" başlığı altında; rakamlar aynı, satırda paraId kalmaz
  const pg = paraGrupKur(new Set([HAS]));
  const g = varlikOzetiKur(varlik, { ...ortak, hedefId: TL, hedefKod: "TL", tlDoviz: "kur", dovizDoviz: "kur", toplamSatiri: true, grupla: x => pg.grup(x) });
  esit("FIRVAR1 özet para başlıkları", g.map(x => (x._stil ? `[${x.kalem}]` : x.kalem)).slice(0, 7).join(" "), "[Döviz] TL USD [Kuyum] HAS [Toplam] Devir değeri (TL, 30.09.2026 kuruyla)");
  esit("FIRVAR1 özet: başlıklar rakamı değiştirmez", ozetMetni(g.filter(x => !x._stil).sort((a, b) => String(a.kalem).localeCompare(String(b.kalem)))), ozetMetni([...o].sort((a, b) => String(a.kalem).localeCompare(String(b.kalem)))));
  esit("FIRVAR1 özet satırında paraId yok", g.some(x => "paraId" in x), false);
  const gk = varlikOzetiKur(varlik, { ...ortak, hedefId: TL, hedefKod: "TL", tlDoviz: "kur", dovizDoviz: "kur", toplamSatiri: false, grupla: x => pg.grup(x) });
  esit("FIRVAR1 toplam satırı kapalıyken Toplam başlığı da yok", gk.map(x => (x._stil ? `[${x.kalem}]` : x.kalem)).join(" "), "[Döviz] TL USD [Kuyum] HAS");
}

// ── FIRVAR1 ana tablo: gruplar ardışık + grup içinde para başlıkları
{
  const pg = paraGrupKur(new Set([HAS]));
  const satirlar = [
    { grup: "1-Vezneler", kaynak: "Vezne 00", paraId: TL, paraKod: "TL", tlKarsiligi: 100 }, { grup: "1-Vezneler", kaynak: "Vezne 00", paraId: HAS, paraKod: "HAS", tlKarsiligi: 6000 },
    { grup: "1-Vezneler", kaynak: "Vezne 01", paraId: USD, paraKod: "USD", tlKarsiligi: 400 },
    { grup: "2-Cari alacaklar", kaynak: "Cari alacak", paraId: TL, paraKod: "TL", tlKarsiligi: 50 }, { grup: "3-Cari borçlar", kaynak: "Cari borç", paraId: TL, paraKod: "TL", tlKarsiligi: -30 },
    { grup: "2-Cari alacaklar", kaynak: "Cari alacak", paraId: USD, paraKod: "USD", tlKarsiligi: 200 }, { grup: "3-Cari borçlar", kaynak: "Cari borç", paraId: HAS, paraKod: "HAS", tlKarsiligi: -3000 },
  ];
  const sirali = grubaGoreDiz(satirlar);
  esit("grubaGoreDiz: gruplar ardışık, grup içi sıra korunur", sirali.map(s => `${s.grup[0]}${s.paraKod}`).join(" "), "1TL 1HAS 1USD 2TL 2USD 3TL 3HAS");
  const b = paraBasliklariEkle(sirali, { grupla: s => pg.grup(s), alan: "paraKod", bolumle: ["grup"] });
  esit("FIRVAR1 ana tablo para başlıkları (grup içinde)", b.map(s => `${String(s.grup)[0]}${s._stil ? `[${s.paraKod}]` : s.paraKod}`).join(" "), "1[Döviz] 1TL 1USD 1[Kuyum] 1HAS 2[Döviz] 2TL 2USD 3[Döviz] 3TL 3[Kuyum] 3HAS");
  esit("FIRVAR1 ana tablo: toplam ve kayıt sayısı değişmez", `${veriSatirlari(b).length}|${veriSatirlari(b).reduce((t, s) => t + s.tlKarsiligi, 0)}`, `7|${satirlar.reduce((t, s) => t + s.tlKarsiligi, 0)}`);
  // Çizim: tanımdaki grup + başlık satırları + özet başlıkları (PDF / Excel)
  const tanim = raporTanimOku("FIRVAR1");
  const ozetSatirlar = varlikOzetiKur(varlik, { ...ortak, hedefId: TL, hedefKod: "TL", tlDoviz: "kur", dovizDoviz: "kur", toplamSatiri: true, grupla: x => pg.grup(x) });
  const dolu = b.map(s => (s._stil ? s : { ...s, miktar: 1, kur: 1, kurSatis: 1, tlSatis: s.tlKarsiligi }));
  const pdf = await raporPdf({ tanim, satirlar: dolu, filtreOzeti: "yönetici testi", firma, kullanici: "test", ozetSatirlar });
  writeFileSync(path.join(dir, "YONETICI-FIRVAR1.pdf"), pdf);
  esit("FIRVAR1 PDF üretildi", pdf.subarray(0, 5).toString(), "%PDF-");
  const xlsx = await raporExcel({ tanim, satirlar: dolu, filtreOzeti: "yönetici testi", firma, kullanici: "test", ozetSatirlar });
  writeFileSync(path.join(dir, "YONETICI-FIRVAR1.xlsx"), xlsx);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx as any);
  const ilkKolon = (n: number) => { const l: string[] = []; wb.worksheets[n].eachRow(row => l.push(String(row.getCell(1).value ?? ""))); return (re: RegExp) => l.filter(x => re.test(x)).length; };
  const say = ilkKolon(0), sayOzet = ilkKolon(1);
  // Ana sayfa: her grup başlığı bir kez; 3 Döviz + 2 Kuyum para başlığı. Özet sayfası (Excel'de ayrı sayfa): 1 Döviz + 1 Kuyum + 1 Toplam başlığı
  esit("FIRVAR1 Excel: grup başlıkları bir kez, para başlıkları grup içinde", `${say(/^1-Vezneler$/)}|${say(/^2-Cari alacaklar$/)}|${say(/^3-Cari borçlar$/)}|${say(/^Döviz$/)}|${say(/^Kuyum$/)}`, "1|1|1|3|2");
  esit("FIRVAR1 Excel özet sayfası: Döviz / Kuyum / Toplam başlıkları ve kalemler", `${wb.worksheets[1].name}|${sayOzet(/^Döviz$/)}|${sayOzet(/^Kuyum$/)}|${sayOzet(/^Toplam$/)}|${sayOzet(/^Toplam Net Kâr \/ Zarar \(TL\)$/)}|${sayOzet(/^Borç değeri \(TL\)$/)}`, "Özet|1|1|1|1|1");
}

// ── LONSHO1: sembol, süzgeç, çevrim
esit("lsSembolu (devir > mevcut → S)", [lsSembolu(10, 5), lsSembolu(5, 10), lsSembolu(5, 5), lsSembolu(-3, -8)].join(), "S,L,L,S");
esit("longShortUygun", [longShortUygun("hepsi", "L"), longShortUygun("hepsi", "S"), longShortUygun("long", "L"), longShortUygun("long", "S"), longShortUygun("short", "S"), longShortUygun("short", "L"), longShortUygun("", "S")].join(), "true,true,true,false,true,false,true");
esit("lsDurumu değişmedi", `${JSON.stringify(lsDurumu(1500, 400))}|${lsDurumu(100, 400).durum}|${lsDurumu(250.001, 250).durum}`, '{"net":1100,"durum":"LONG"}|SHORT|DENGE');
// Long (mevcut > devir): 50 USD × 40 = 2000 (alış) / × 41 = 2050 (satış). Short: −20 EUR × 44 = −880 (alış) / × 46,125 = −922,5 (satış). Eşitlik short sayılır (rpt: else).
esit("longShortTl: long ve short ayrı seçim", y6(longShortTl(100, 150, USD, gun, { long: "alis", short: "satis" }), longShortTl(100, 150, USD, gun, { long: "satis", short: "alis" }),
  longShortTl(30, 10, EUR, gun, { long: "satis", short: "alis" }), longShortTl(30, 10, EUR, gun, { long: "alis", short: "satis" }), longShortTl(5, 5, USD, gun, { long: "alis", short: "satis" })), "2000|2050|-880|-922.5|0");
const pozLS = [{ paraId: USD, devir: 100, mevcut: 150, lsSembol: "L" }, { paraId: EUR, devir: 30, mevcut: 10, lsSembol: "S" }];
const dOrtak = { tlId: TL, devirKur: devir, mevcutKur: gun, devirEtiketi: "31.08.2026", mevcutEtiketi: "01.10.2026" };
const dMetni = (k: any[]) => k.map(x => `${x.kalem}=${y6(x.deger)}`).join(" ; ");
{
  // Denge parası TL, hepsi alış: devir 100×39 + 30×43 = 5190 · mevcut 150×40 + 10×44 = 6440 · denge farkı 2000 − 880 = 1120 · net 1250 (kâr)
  const a = dengeKalemleri(pozLS, { ...dOrtak, hedefId: TL, hedefKod: "TL", long: "alis", short: "alis", denge: "alis" });
  esit("LONSHO1 kalemleri (TL, alış)", dMetni(a), "Devir değeri (31.08.2026 kuruyla)=5190 ; Mevcut değeri (01.10.2026 kuruyla)=6440 ; Denge farkı=1120 ; Toplam Net Kâr=1250");
  esit("LONSHO1 kalemlerinde denge parası", [...new Set(a.map(x => x.paraKod))].join(), "TL");
  // Denge parası USD, Denge satış, Long satış, Short alış: devir 100 + 30×44÷40 = 133 · mevcut 150 + 10×46,125÷41 = 161,25 · denge farkı (2050 − 880) ÷ 41 · net 28,25
  const u = dengeKalemleri(pozLS, { ...dOrtak, hedefId: USD, hedefKod: "USD", long: "satis", short: "alis", denge: "satis" });
  esit("LONSHO1 kalemleri (USD, denge satış, long satış, short alış)", y6(...u.map(x => x.deger)), y6(133, 161.25, 1170 / 41, 28.25));
  // Denge alış, Long alış, Short satış: denge farkı (2000 − 922,5) ÷ 40 = 26,9375; devir 100 + 30×43÷39; mevcut 150 + 10×44÷40 = 161
  const v = dengeKalemleri(pozLS, { ...dOrtak, hedefId: USD, hedefKod: "USD", long: "alis", short: "satis", denge: "alis" });
  esit("LONSHO1 kalemleri (USD, denge alış, long alış, short satış)", y6(...v.map(x => x.deger)), y6(100 + 1290 / 39, 161, 26.9375, 161 - (100 + 1290 / 39)));
  // Long / Short seçeneği: Long → yalnız USD (3900 → 6000, denge 2000, net 2100 kâr); Short → yalnız EUR (1290 → 440, denge −880, net 850 zarar: mutlak + etiket)
  const l = dengeKalemleri(pozLS.filter(o => longShortUygun("long", o.lsSembol)), { ...dOrtak, hedefId: TL, hedefKod: "TL", long: "alis", short: "alis", denge: "alis" });
  const s = dengeKalemleri(pozLS.filter(o => longShortUygun("short", o.lsSembol)), { ...dOrtak, hedefId: TL, hedefKod: "TL", long: "alis", short: "alis", denge: "alis" });
  esit("LONSHO1 Long seçeneği", dMetni(l), "Devir değeri (31.08.2026 kuruyla)=3900 ; Mevcut değeri (01.10.2026 kuruyla)=6000 ; Denge farkı=2000 ; Toplam Net Kâr=2100");
  esit("LONSHO1 Short seçeneği", dMetni(s), "Devir değeri (31.08.2026 kuruyla)=1290 ; Mevcut değeri (01.10.2026 kuruyla)=440 ; Denge farkı=-880 ; Toplam Net Zarar=850");
  // Denge parasının kuru yoksa değerler 0 (rpt: "= 0.0 then 0.0")
  esit("LONSHO1 denge parası kursuz → 0", y6(...dengeKalemleri(pozLS, { ...dOrtak, hedefId: 9, hedefKod: "XXX", long: "alis", short: "alis", denge: "alis" }).map(x => x.deger)), "0|0|0|0");
}

// ── LONSHO1 canlı test düzeltmeleri (05.11.2026)
{
  // (b) Long / Short bileşen bazında: eksi vezne mevcudu Short kolonuna mutlak değeriyle; net = vezne + cari alacak − cari borç değişmez
  const ls = (vezne: number, cariAlacak: number, cariBorc: number) => { const b = longShortBilesenleri({ vezne, cariAlacak, cariBorc }); return `${b.longMiktar}/${b.shortMiktar}/${lsDurumu(b.longMiktar, b.shortMiktar).net}`; };
  esit("Long/Short: SAR vezne −10.000 → Short 10.000", ls(-10000, 0, 0), "0/10000/-10000");
  esit("Long/Short: HAS vezne −10 → Short 10", ls(-10, 0, 0), "0/10/-10");
  esit("Long/Short: artı vezne + cari (USD 285 + 100 − 50)", ls(285, 100, 50), "385/50/335");
  esit("Long/Short: eksi vezne + cari alacak + cari borç (−5 + 3 − 2)", ls(-5, 3, 2), "3/7/-4");
  esit("Long/Short: hiçbir kolonda eksi yok", [ls(-10000, 0, 0), ls(-10, 0, 0), ls(-5, 3, 2), ls(7, -2, 0)].every(x => !x.split("/").slice(0, 2).some(v => Number(v) < 0)), true);
  // (a) L/S = devirden mevcuda değişim yönü (eski @LongShortSembol); değişim yoksa boş. Pozisyon (net işareti) ayrı kolondur.
  esit("L/S görünen sembol: artış L, azalış S, değişim yok boş", [lsGorunenSembol(100, 150), lsGorunenSembol(150, 100), lsGorunenSembol(-30.92, -30.92), lsGorunenSembol(-10000, -10000), lsGorunenSembol(0, 0)].join(","), "L,S,,,");
  // Canlı örnek: USD devir 500 → mevcut 335 (azaldı) → L/S "S", pozisyon LONG (net artı): iki kolon farklı şeyi gösterir, ikisi de doğru
  esit("USD 500 → 335: L/S S, pozisyon LONG", `${lsGorunenSembol(500, 335)}|${lsDurumu(335, 0).durum}`, "S|LONG");
  // Süzgeç eski sembolle: değişimsiz para Long seçeneğinde kalır (eski rpt else → "L")
  esit("Long seçeneği değişimsiz parayı içerir, Short içermez", `${longShortUygun("long", lsSembolu(-5, -5))}|${longShortUygun("short", lsSembolu(-5, -5))}`, "true|false");
  // (c) Maliyet: birleşik fiş kaynağı (Döviz + Sarraf + Perakende) — maliyetYurut aynı. HAS: sarraf alış 10 g / 30.000 TL, perakende alış 5 g / 16.000 TL → ort 46.000 ÷ 15;
  // döviz satış 3 g → ort değişmez; USD yalnız döviz fişi: alış 100 / 4.000 → 40
  esit("maliyet bölümleri: Döviz, Sarraf, Perakende (Ticari yok)", MALIYET_BOLUMLERI.join(), "1,2,3");
  const m = maliyetYurut([{ paraId: HAS, tip: 0, miktar: 10, tutar: 30000, kur: 3000 }, { paraId: HAS, tip: 0, miktar: 5, tutar: 16000, kur: 3200 }, { paraId: HAS, tip: 1, miktar: 3, tutar: 9900, kur: 3300 },
    { paraId: USD, tip: 0, miktar: 100, tutar: 4000, kur: 40 }]);
  const son = new Map<number, number>(); for (const h of m) son.set(h.paraId, h.ortMaliyet);
  esit("ortalama maliyet: HAS sarraf + perakende alışları, USD döviz", y6(son.get(HAS)!, son.get(USD)!, m[2].maliyet), y6(46000 / 15, 40, 3 * 46000 / 15));
  // Değerleme farkı: USD net 335 × (46,9 − 41) = 1976,5; kur yoksa (B22: kur 0, maliyet 2750) ve maliyet yoksa 0
  esit("değerleme farkı: normal / kursuz / maliyetsiz", y6(degerlemeFarki(335, 46.9, 41), degerlemeFarki(10, 0, 2750), degerlemeFarki(100, 62.5, 0)), y6(1976.5, 0, 0));
  // (d) Toplam etiketi ilk metin kolonuna (Para) düşer: PDF'te 8 punto kalın yazı küçültülmeden ve kırpılmadan sığmalı
  const t = raporTanimOku("LONSHO1"), pdfK = t.kolonlar.filter(k => k.pdf !== false && !k.kosul), tg = pdfK.reduce((a, k) => a + (k.g || 1), 0);
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 }), genislik = doc.page.width - 56;
  const etiketKolonu = pdfK.find(k => !k.toplam && !["sayi", "sayi4", "kur", "tam"].includes(k.bicim || ""))!;
  const yer = (etiketKolonu.g / tg) * genislik - 6, olc = (metin: string) => doc.font(yaziTipleri().kalin).fontSize(8).widthOfString(metin);
  esit("toplam etiketi Para kolonuna düşer", etiketKolonu.anahtar, "paraKod");
  esit("Genel toplam ve GENEL TOPLAM (17) Para kolonuna sığar", `${olc("Genel toplam") <= yer}|${olc("GENEL TOPLAM (17)") <= yer}`, "true|true");
  esit("LONSHO1 kolon başlıkları: L/S (değişim), Pozisyon", t.kolonlar.filter(k => ["lsSembol", "durum"].includes(k.anahtar)).map(k => k.baslik).join("|"), "L/S (değişim)|Pozisyon");
  esit("LONSHO1 boş rapor notu tek kısa cümle", `${LONSHO1_BOS_NOT.split(". ").length}|${LONSHO1_BOS_NOT.length < 80}`, "1|true");
}

// ── Tanımlar: yeni parametreler var, varsayılanları bugünkü sonucu verir; eski parametre ve kolonların hiçbiri silinmedi
{
  const prm = (kod: string) => raporTanimOku(kod).parametreler.map(p => `${p.ad}:${p.tip}${p.varsayilan !== undefined ? `=${p.varsayilan}` : ""}${p.secenekler ? `[${p.secenekler.map(o => o.deger).join("/")}]` : ""}`).join(" ");
  esit("FIRSON1 parametreleri", prm("FIRSON1"), "tarih:tarih=bugun kurTuru:kurSecimi vezneIdler:vezneCoklu paraIdler:paraCoklu hedefParaId:para tlDovizCevrim:secim=kur[kur/alis/satis] dovizDovizCevrim:secim=kur[kur/alis/satis]");
  esit("FIRVAR1 parametreleri", prm("FIRVAR1"), "tarih:tarih=bugun vezneIdler:vezneCoklu paraIdler:paraCoklu kurTuru:kurSecimi hedefParaId:para varlikCinsi:secim=hepsi[hepsi/kasa/cari] "
    + "tlDovizCevrim:secim=kur[kur/alis/satis] dovizDovizCevrim:secim=kur[kur/alis/satis] toplamSatiri:onay=1");
  esit("LONSHO1 parametreleri", prm("LONSHO1"), "baslangic:tarihAralik=bugun kurTuru:kurSecimi vezneIdler:vezneCoklu paraIdler:paraCoklu hedefParaId:para longShort:secim=hepsi[hepsi/long/short] "
    + "longCevrim:secim=alis[alis/satis] shortCevrim:secim=alis[alis/satis] dengeCevrim:secim=alis[alis/satis]");
  esit("ek parametre adları (denetleyicinin okuduğu)", ["FIRSON1", "FIRVAR1", "LONSHO1"].map(k => RaporService.ekParametreAdlari(k).join(",")).join(" | "),
    "tarih,tlDovizCevrim,dovizDovizCevrim | tarih,varlikCinsi,tlDovizCevrim,dovizDovizCevrim,toplamSatiri | longShort,longCevrim,shortCevrim,dengeCevrim");
  const kolon = (kod: string) => { const t = raporTanimOku(kod); return `${t.ad}|${t.kagit}|${t.kolonlar.map(k => k.anahtar).join(",")}|${t.ozet?.baslik}|${t.ozet?.kolonlar.map(k => k.anahtar).join(",")}`; };
  esit("FIRSON1 ad / kâğıt / kolonlar değişmedi", kolon("FIRSON1"), "Firma Son Durum Raporu|A4-yatay|paraKod,paraAd,vezne,banka,cariAlacak,cariBorc,net,kur,tlKarsiligi,kurSatis,tlSatis|Son durum — seçilen para cinsinden|kalem,paraKod,borc,alacak,bakiye,bakiyeTipi");
  esit("FIRVAR1 ad / kâğıt / kolonlar değişmedi", kolon("FIRVAR1"), "Firma Varlıkları Raporu|A4|kaynak,paraKod,miktar,kur,tlKarsiligi,kurSatis,tlSatis|Varlık hareketi ve evalüasyon|kalem,devir,borc,alacak,devreden,deger");
  esit("LONSHO1 ad / kâğıt / kolonlar değişmedi", kolon("LONSHO1"), "Long / Short Denge Analizi|A4-yatay|paraKod,paraAd,devir,mevcut,lsSembol,lsMiktar,longMiktar,shortMiktar,net,durum,vadeliNet,netVadeliDahil,kur,tlKarsiligi,ortMaliyet,degerlemeFarki,kurSatis,tlSatis|"
    + "Denge analizi — denge parası cinsinden|kalem,paraKod,deger");
  esit("dipnot eklenmedi", ["FIRSON1", "FIRVAR1", "LONSHO1"].map(k => raporTanimOku(k).dipnot ?? "").join(""), "");
}

// ── Çizim: FIRSON1 ve LONSHO1 ana tablosu para başlıklarıyla (PDF / Excel)
{
  const pg = paraGrupKur(new Set([HAS]));
  for (const kod of ["FIRSON1", "LONSHO1"]) {
    const tanim = raporTanimOku(kod);
    const veri = [{ paraId: USD, paraKod: "USD" }, { paraId: HAS, paraKod: "HAS" }, { paraId: EUR, paraKod: "EUR" }].map((o, i) => ({ ...o, ...Object.fromEntries(tanim.kolonlar.filter(k => k.bicim).map(k => [k.anahtar, (i + 1) * 10])), paraAd: o.paraKod, durum: "LONG", lsSembol: "L" }));
    const satirlar = paraBasliklariEkle(veri, { grupla: s => pg.grup(s), alan: "paraKod" });
    esit(`${kod} ana tablo para başlıkları`, satirlar.map(s => (s._stil ? `[${s.paraKod}]` : s.paraKod)).join(" "), "[Döviz] USD EUR [Kuyum] HAS");
    const ozetSatirlar = kod === "FIRSON1" ? sonDurumKalemleri(pozisyon, (id, m) => c(m, id, TL, "kur", "kur"), "TL") : dengeKalemleri(pozLS, { ...dOrtak, hedefId: TL, hedefKod: "TL", long: "alis", short: "alis", denge: "alis" });
    const pdf = await raporPdf({ tanim, satirlar, filtreOzeti: "yönetici testi", firma, kullanici: "test", ozetSatirlar });
    writeFileSync(path.join(dir, `YONETICI-${kod}.pdf`), pdf);
    const xlsx = await raporExcel({ tanim, satirlar, filtreOzeti: "yönetici testi", firma, kullanici: "test", ozetSatirlar });
    writeFileSync(path.join(dir, `YONETICI-${kod}.xlsx`), xlsx);
    const metin = JSON.stringify((await (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx as any); return wb; })()).worksheets[0].getSheetValues());
    esit(`${kod} PDF / Excel: başlıklar basılı, genel toplam 3 kayıt`, `${pdf.subarray(0, 5).toString()}|${/"Döviz"/.test(metin)}|${/"Kuyum"/.test(metin)}|${/\(3 kayıt\)/.test(metin)}`, "%PDF-|true|true|true");
  }
}

console.log(hata ? `\n${hata} HATA` : "\nYÖNETİCİ TESTLERİ GEÇTİ");
process.exit(hata ? 1 : 0);
