/**
 * G1 fiş raporları (FISLIS1, GUNFIS1, ISTRAP1, ISTKMV1, VERNUM1, VERKOM1) saf mantık testi — veritabanı gerekmez.
 * Süzgeçler, sıralama, gruplama seçimi, gün toplamı, kırılım, para başlıkları ve tanım koşulları; örnekler elle hesaplanmıştır.
 * Çalıştır: cd Backend && npx tsx scripts/rapor-test-fis.ts   Çıktı: ../tmp/rapor-test/FIS-*.pdf / .xlsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { raporPdf, raporTanimOku } from "../src/services/rapor/raporMotor.js";
import { raporExcel } from "../src/services/rapor/raporExcel.js";
import { kosulSaglandi, parametreDegeri, RaporService } from "../src/services/rapor/rapor.service.js";
import { paraBasliklariEkle, paraGrupKur } from "../src/services/rapor/paraGrup.js";
import {
  metinAraliginda, isimBeyanEdilmemis, paraOzeti, paraGruplayici, fisSirala, gunlukToplamlar, gunToplamlari, istatistikGruplari, istatistikSirala,
  kmvGruplari, kmvKirilimAnahtari, kmvKirilimla, kmvSirala, fisCinsiBolumleri, VERGI_NO_CINSI, fisSayilariEkle, kimlikOzetiBaslikli,
} from "../src/services/rapor/veri/fis.js";
import { netMetni } from "../src/services/rapor/raporMotor.js";
import { vergiKomisyonGruplari } from "../src/services/rapor/veri/vergiKomisyon.js";

let hata = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else console.log(`✓ ${ad}`); };
const firma = { ad: "ÖRNEK FİRMA", vkn: "1234567890" };
const dir = path.resolve("../tmp/rapor-test"); mkdirSync(dir, { recursive: true });

// ── Süzgeçler ──────────────────────────────────────────────────────────────────────────────────────────────────────────
esit("metin aralığı: uçlar dahil", [metinAraliginda("AA00344795", "AA00344795", "AA00344797"), metinAraliginda("AA00344797", "AA00344795", "AA00344797"), metinAraliginda("AA00344798", "AA00344795", "AA00344797"),
  metinAraliginda("AA00344794", "AA00344795", "AA00344797")].join(), "true,true,false,false");
esit("metin aralığı: boş uç sınırsız", [metinAraliginda("X", "", ""), metinAraliginda("ZEYNEP", "", "M"), metinAraliginda("AHMET", "", "M"), metinAraliginda("ZEYNEP", "M", ""), metinAraliginda("AHMET", "M", undefined)].join(), "true,false,true,true,false");
esit("metin aralığı: büyük / küçük harf ve Türkçe sıra", [metinAraliginda("mekmer", "MEKMER", "MEKMER"), metinAraliginda("ŞAHİN", "s", "t"), metinAraliginda("ÇELİK", "c", "d"), metinAraliginda("IŞIK", "i", "j")].join(), "true,true,true,false");
esit("metin aralığı: boş değer aralık verilince dışarıda", [metinAraliginda("", "A", ""), metinAraliginda(null, "A", "Z"), metinAraliginda("  ", "", "")].join(), "false,false,true");
esit("isim beyan edilmemiş", [isimBeyanEdilmemis("İsim beyan edilmemiştir"), isimBeyanEdilmemis("İSİM BEYAN EDİLMEMİŞTİR"), isimBeyanEdilmemis("  "), isimBeyanEdilmemis(null), isimBeyanEdilmemis("MEKMER")].join(), "true,true,true,true,false");

// ── Para özeti + Döviz / Kuyum / Ticari başlıkları ─────────────────────────────────────────────────────────────────────
const pg = paraGrupKur(new Set<number>(), new Set(["CEY", "22"]));
const grupla = paraGruplayici(pg);
{
  // USD alış: fiş 1 (120 @41 = 4920) + fiş 2 (80 @42 = 3360) → 200 / 8280, ort. 41,4; ticari fişin TL satırı döviz fişinin TL satırıyla birleşmez
  const o = paraOzeti([
    { fisId: 1, paraKod: "USD", tip: "Alış", miktar: 120, tutar: 4920 }, { fisId: 2, paraKod: "USD", tip: "Alış", miktar: 80, tutar: 3360, bmv: 1.5 },
    { fisId: 3, paraKod: "CEY", tip: "Satış", miktar: 2, tutar: 9000, kdv: 60 }, { fisId: 4, paraKod: "TL", tip: "Satış", miktar: 3, tutar: 900, ticari: true },
    { fisId: 5, paraKod: "TL", tip: "Satış", miktar: 1, tutar: 100 }, { fisId: 4, paraKod: "TL", tip: "Satış", miktar: 2, tutar: 300, ticari: true }]);
  esit("para özeti: grup sayısı (ticari ayrı)", o.length, 4);
  esit("para özeti: USD alış (adet|miktar|tutar|ort kur|bsmv)", `${o[0].adet}|${o[0].miktar}|${o[0].tutar}|${o[0].ortKur}|${o[0].bmv}`, "2|200|8280|41.4|1.5");
  esit("para özeti: ticari TL (adet|miktar|tutar|ticari) ve döviz TL", `${o[2].adet}|${o[2].miktar}|${o[2].tutar}|${o[2].ticari}  ${o[3].adet}|${o[3].tutar}|${o[3].ticari}`, "1|5|1200|true  1|100|undefined");
  const b = paraBasliklariEkle(o, { grupla, alan: "paraKod" });
  esit("özet başlıkları: Döviz → Kuyum → Ticari", b.map(s => (s._stil ? `[${s.paraKod}]` : s.paraKod)).join(" "), "[Döviz] USD TL [Kuyum] CEY [Ticari] TL");
  esit("özet başlıkları toplamı değiştirmez", b.reduce((t, s) => t + (Number(s.tutar) || 0), 0), 8280 + 9000 + 1200 + 100);
}

// ── FISLIS1: sıralama ve "Toplam" liste tipi ───────────────────────────────────────────────────────────────────────────
{
  const f = (bolum: number, gunIso: string, fisId: number, seriNo: string, belgeNo: string, paraKod: string, miktar: number, tutar: number, ek: any = {}) =>
    ({ bolum, bolumAd: bolum === 1 ? "Döviz fişi" : "Sarraf fişi", gun: `${gunIso}T00:00:00.000Z`, gunIso, gunBaslik: gunIso.split("-").reverse().join("."), fisId, seriNo, belgeNo, paraKod, miktar, tutar, kmv: 0, komisyon: 0, bmv: 0, kdv: 0, toplamTutar: tutar, odemeTutari: tutar, ...ek });
  const s = [
    f(1, "2026-09-25", 10, "AA03", "KAL09", "USD", 120, 4920), f(1, "2026-09-25", 11, "AA01", "KAL07", "EUR", 50, 2400, { kmv: 4.8 }), f(1, "2026-09-25", 12, "AA02", "KAL08", "USD", 40, 1660, { odemeTutari: 1663.32 }),
    f(1, "2026-09-26", 13, "AA00", "KAL01", "USD", 10, 410), f(2, "2026-09-25", 500000001, "", "S0001", "22", 5, 15000),
  ];
  esit("fiş sırası: tarih → sorgu sırası aynen", fisSirala(s, "tarih") === s, true);
  esit("fiş sırası: seri no (gün ve bölüm içinde)", fisSirala(s, "seri").map(x => x.fisId).join(), "11,12,10,13,500000001");
  esit("fiş sırası: belge no", fisSirala(s, "belge").map(x => x.belgeNo).join(), "KAL07,KAL08,KAL09,KAL01,S0001");
  esit("fiş sırası: para (eşitlikte fiş no)", fisSirala(s, "para").map(x => `${x.paraKod}${x.fisId}`).join(), "EUR11,USD10,USD12,USD13,22500000001");
  // 25.09 döviz: 120 + 50 + 40 = 210 miktar, 4920 + 2400 + 1660 = 8980 lira, KMV 4,80, ödeme 4920 + 2400 + 1663,32 = 8983,32, 3 fiş
  const t = gunlukToplamlar(s);
  esit("gün toplamları: satır sayısı (bölüm × gün)", t.map(x => `${x.bolumAd}/${x.gunBaslik}`).join(" "), "Döviz fişi/25.09.2026 Döviz fişi/26.09.2026 Sarraf fişi/25.09.2026");
  esit("gün toplamları: 25.09 (fiş|miktar|lira|kmv|ödeme)", `${t[0].adet}|${t[0].miktar}|${t[0].tutar}|${t[0].kmv}|${t[0].odemeTutari.toFixed(2)}`, "3|210|8980|4.8|8983.32");
  esit("gün toplamları: genel toplam değişmez", t.reduce((a, x) => a + x.tutar, 0), s.reduce((a, x) => a + x.tutar, 0));
}

// ── GUNFIS1: gün toplamı (grup altı tablo) ─────────────────────────────────────────────────────────────────────────────
const gunSatirlari = (() => {
  const g = (bolum: number, gunIso: string, fisId: number, vezneKod: string, tipKod: number, paraKod: string, miktar: number, kur: number) => {
    const gunBaslik = gunIso.split("-").reverse().join("."), tip = tipKod === 1 ? "Satış" : "Alış";
    return { bolum, bolumAd: "Döviz fişi", fisId, zaman: `${gunIso}T07:00:00.000Z`, saat: `${gunIso}T07:00:00.000Z`, gunIso, gunBaslik, gunAnahtar: `${bolum}|${gunIso}`, vezneKod, tipKod, tip, seriNo: `S${fisId}`, belgeNo: `B${fisId}`, unvan: "",
      paraKod, miktar, kur, tutar: miktar * kur, komisyon: 0, bmv: 0, kmv: 0, kdv: 0, grupAnahtar: `${vezneKod}|${tipKod}`, grupBaslik: `${vezneKod} — Vezne ${vezneKod} · ${tip}` };
  };
  return [g(1, "2026-09-28", 1, "00", 0, "USD", 20, 41), g(1, "2026-09-28", 2, "00", 0, "USD", 30, 42), g(1, "2026-09-28", 3, "00", 1, "EUR", 10, 48.5), g(1, "2026-09-28", 3, "00", 1, "CEY", 2, 4500),
    g(1, "2026-09-30", 4, "01", 1, "USD", 5, 41)];
})();
{
  const gt = gunToplamlari(gunSatirlari, grupla);
  esit("gün toplamı: gün anahtarları", Object.keys(gt).join(" "), "1|2026-09-28 1|2026-09-30");
  // 28.09: USD alış 20 @41 + 30 @42 = 50 / 2080 → ort. 41,6; EUR satış 10 / 485; CEY (kuyum) satış 2 / 9000
  const g28 = gt["1|2026-09-28"];
  esit("gün toplamı 28.09: başlıklar ve paralar", g28.map(s => (s._stil ? `[${s.paraKod}]` : `${s.paraKod}/${s.tip}`)).join(" "), "[Döviz] USD/Alış EUR/Satış [Kuyum] CEY/Satış");
  esit("gün toplamı 28.09: USD alış (fiş|miktar|ort kur|lira)", `${g28[1].adet}|${g28[1].miktar}|${g28[1].ortKur}|${g28[1].tutar}`, "2|50|41.6|2080");
  esit("gün toplamı 28.09: lira toplamı", g28.reduce((t, s) => t + (Number(s.tutar) || 0), 0), 2080 + 485 + 9000);
  esit("gün toplamı 30.09", gt["1|2026-09-30"].map(s => `${s.paraKod}:${s.tutar ?? ""}`).join(" "), "Döviz: USD:205");
  esit("gün toplamı: başlıksız (gruplayıcı verilmezse)", gunToplamlari(gunSatirlari)["1|2026-09-28"].length, 3);
}

// ── ISTRAP1: gruplama ve sıra ──────────────────────────────────────────────────────────────────────────────────────────
{
  const r = (bolum: number, ist: string, paraKod: string, siraNo: number, gunIso: string, seriNo: string) => ({ bolum, istatistikBaslik: ist, paraKod, siraNo, gunIso, gunBaslik: gunIso.split("-").reverse().join("."), seriNo });
  esit("istatistik grupları: detay + para", istatistikGruplari("para", true).map(g => g.anahtar).join(), "istatistikBaslik,altGrup");
  esit("istatistik grupları: detay + tarih (fiş sayılı etiketler, miktar yalnız alt grupta)", istatistikGruplari("tarih", true).map(g => `${g.anahtar}:${g.toplamEtiketi ?? ""}:${g.net?.arti ?? "-"}`).join(),
    "istatistikBaslik:ARA TOPLAM ({{istFisSayisi}} fiş):-,altGrup:Toplam ({{altFisSayisi}} fiş):miktar");
  esit("istatistik grupları: tek paralı raporda istatistik grubunda da miktar", `${istatistikGruplari("para", true, true)[0].net?.arti}|${istatistikGruplari("seri", true, true)[0].net?.arti}|${istatistikGruplari("seri", true)[0].net}`, "miktar|miktar|undefined");
  esit("istatistik grupları: detay + seri no → tek seviye", istatistikGruplari("seri", true).length, 1);
  {
    const ss = fisSayilariEkle(istatistikSirala([r(1, "10285", "USD", 1, "2026-09-26", "S3"), r(1, "10285", "USD", 1, "2026-09-28", "S1"), r(1, "10285", "EUR", 2, "2026-09-25", "S2"), r(1, "9249", "USD", 1, "2026-09-25", "A1")], "para"));
    esit("fiş sayıları (istatistik | para alt grubu)", ss.map(x => `${x.istFisSayisi}/${x.altFisSayisi}`).join(" "), "3/2 3/2 3/1 1/1");
    // Miktar net satırı: 10285 USD alt grubu 40 + 10 = 50 → "Miktar : 50,00"
    esit("miktar net satırı metni", netMetni(istatistikGruplari("para", true)[1].net!, [{ miktar: 40 }, { miktar: 10 }]).trim(), "Miktar : 50,00");
  }
  esit("istatistik grupları: toplam kipi → tek seviye", `${istatistikGruplari("para", false).length}|${istatistikGruplari("tarih", false).length}`, "1|1");
  // Sorgu sırası: bölüm → istatistik → para sıra no → gün
  const s = [r(1, "10285", "USD", 1, "2026-09-26", "S3"), r(1, "10285", "USD", 1, "2026-09-28", "S1"), r(1, "10285", "EUR", 2, "2026-09-25", "S2"), r(1, "9249", "USD", 1, "2026-09-25", "A1"), r(2, "10285", "22", 40, "2026-09-25", "")];
  esit("istatistik sırası: para (sorgu sırası korunur)", istatistikSirala(s, "para").map(x => `${x.istatistikBaslik}/${x.altGrup}/${x.seriNo}`).join(" "), "10285/USD/S3 10285/USD/S1 10285/EUR/S2 9249/USD/A1 10285/22/");
  esit("istatistik sırası: tarih (gün + para; istatistik ve bölüm yerinde)", istatistikSirala(s, "tarih").map(x => `${x.bolum}:${x.istatistikBaslik}/${x.altGrupBaslik}`).join(" "),
    "1:10285/25.09.2026 · EUR 1:10285/26.09.2026 · USD 1:10285/28.09.2026 · USD 1:9249/25.09.2026 · USD 2:10285/25.09.2026 · 22");
  esit("istatistik sırası: seri no", istatistikSirala(s, "seri").map(x => x.seriNo).join(), "S1,S2,S3,A1,");
}

// ── ISTKMV1: gruplama, kırılım ─────────────────────────────────────────────────────────────────────────────────────────
{
  esit("KMV grupları: yok / döviz / vezne", [kmvGruplari("yok"), kmvGruplari("doviz"), kmvGruplari("vezne")].map(g => g.map(x => `${x.anahtar}${x.altToplam === false ? "(toplamsız)" : ""}`).join("+")).join(" "),
    "istatistikBaslik istatistikBaslik+paraKod(toplamsız) istatistikBaslik+vezneKod(toplamsız)");
  const ANONIM = "İSİM BEYAN EDİLMEMİŞTİR";
  const k = (fisId: number, gunIso: string, saat: string, vezneKod: string, unvan: string, seriNo: string, paraKod: string, miktar: number, kur: number, kmv = 0) =>
    ({ istatistikBaslik: "10285 — EFEKTIF SATIS", fisId, gunIso, zaman: `${gunIso}T${saat}:00.000Z`, saat: `${gunIso}T${saat}:00.000Z`, vezneKod, tip: "Satış", unvan, kimlikNo: "", ulke: "", belgeNo: `B${fisId}`, seriNo, paraKod, miktar, kur, tutar: miktar * kur, kmv, kmvOrani: kmv ? 0.002 : 0, fisToplami: miktar * kur + kmv });
  const s = [
    k(1, "2026-09-25", "07:00", "00", ANONIM, "S1", "USD", 120, 41),           // 4920
    k(2, "2026-09-25", "08:00", "01", ANONIM, "S2", "USD", 80, 42, 6.72),      // 3360 + 6,72
    k(3, "2026-09-25", "09:00", "00", "MEKMER", "S3", "USD", 10, 41, 0.82),    // 410 + 0,82
    k(4, "2026-09-25", "10:00", "00", ANONIM, "S4", "EUR", 50, 48),            // 2400
    k(5, "2026-09-26", "07:00", "00", ANONIM, "S5", "USD", 40, 41.5),          // 1660
  ];
  const toplam = (ss: Record<string, any>[], alan: string) => ss.reduce((t, x) => t + (Number(x[alan]) || 0), 0);
  esit("kırılım anahtarı: yok + kutu işaretsiz → her satır kendi başına", s.map(x => kmvKirilimAnahtari(x, { siralama: "yok", isimsizTopla: false })).join(), ",,,,");
  esit("kırılım anahtarı: yok + kutu işaretli → isimsizler gün × para", s.map(x => { const a = kmvKirilimAnahtari(x, { siralama: "yok", isimsizTopla: true }); return a === null ? "-" : a.split("|").slice(2).join("|"); }).join(" "),
    "2026-09-25|G|USD 2026-09-25|G|USD - 2026-09-25|G|EUR 2026-09-26|G|USD");
  const yok = kmvKirilimla(s, { siralama: "yok", isimsizTopla: false });
  esit("kırılım: varsayılan (yok, işaretsiz) satırları değiştirmez", yok.length === 5 && yok.every((x, i) => x === s[i]), true);
  // İsimsiz USD 25.09: 120 + 80 = 200 miktar, 4920 + 3360 = 8280 tutar → ort. kur 41,4; KMV 6,72; fiş toplamı 8286,72
  const top = kmvKirilimla(s, { siralama: "yok", isimsizTopla: true });
  esit("kırılım: isimsizler toplandı (satır sayısı ve sıra)", top.map(x => `${x.unvan === ANONIM ? "isimsiz" : x.unvan}/${x.paraKod}/${x.gunIso.slice(8)}`).join(" "), "isimsiz/USD/25 MEKMER/USD/25 isimsiz/EUR/25 isimsiz/USD/26");
  esit("kırılım: toplanan satır (miktar|kur|tutar|kmv|fiş toplamı)", `${top[0].miktar}|${top[0].kur}|${top[0].tutar}|${top[0].kmv}|${top[0].fisToplami.toFixed(2)}`, "200|41.4|8280|6.72|8286.72");
  esit("kırılım: toplanan satırda ortak olmayan alanlar boş, fişler altta", `${top[0].vezneKod}|${top[0].seriNo}|${top[0].belgeNo}|${top[0].saat}|${top[0].kmvOrani}|${top[0]._alt.map((a: any) => a.seriNo).join("+")}|${top[0]._alt[1].fisToplami.toFixed(2)}`, "|||null|null|S1+S2|3366.72");
  esit("kırılım: tek satırlı kırılım olduğu gibi (alt tablo yok)", `${top[2] === s[3]}|${"_alt" in top[2]}`, "true|false");
  esit("kırılım: toplamlar değişmez (tutar|kmv|fiş toplamı)", `${toplam(top, "tutar")}|${toplam(top, "kmv").toFixed(2)}|${toplam(top, "fisToplami").toFixed(2)}`, `${toplam(s, "tutar")}|7.54|12757.54`);
  // Döviz bazında: isimsizler kutu işaretli olmasa da para × gün toplanır; sıra para koduna göre (EUR, USD)
  const dvz = kmvKirilimla(kmvSirala(s, "doviz"), { siralama: "doviz", isimsizTopla: false });
  esit("kırılım: döviz bazında sıra ve toplama", dvz.map(x => `${x.paraKod}/${x.miktar}`).join(" "), "EUR/50 USD/200 USD/10 USD/40");
  // Vezne bazında: isimsiz USD fişleri farklı veznelerde → toplanmaz; aynı vezne + gün + para toplanır
  const vzn = kmvKirilimla(kmvSirala([...s, k(6, "2026-09-25", "11:00", "00", ANONIM, "S6", "USD", 30, 41)], "vezne"), { siralama: "vezne", isimsizTopla: false });
  esit("kırılım: vezne bazında (vezne/para/miktar)", vzn.map(x => `${x.vezneKod}/${x.paraKod}/${x.miktar}`).join(" "), "00/USD/150 00/USD/10 00/EUR/50 00/USD/40 01/USD/80");
  // İsimli fişte aynı ünvan + seri no + para satırları tek satır: 10 @41 + 5 @42 = 15 / 620 → ort. 41,3333
  const isimli = kmvKirilimla([k(7, "2026-09-27", "07:00", "00", "MEKMER", "S7", "USD", 10, 41), k(7, "2026-09-27", "07:00", "00", "MEKMER", "S7", "USD", 5, 42), k(7, "2026-09-27", "07:00", "00", "MEKMER", "S7", "EUR", 1, 48)], { siralama: "doviz", isimsizTopla: false });
  esit("kırılım: isimli fiş (ünvan + seri no + para)", isimli.map(x => `${x.paraKod}/${x.miktar}/${x.tutar}/${Number(x.kur).toFixed(4)}/${x.seriNo}`).join(" "), "USD/15/620/41.3333/S7 EUR/1/48/48.0000/S7");
}

// ── VERKOM1 / VERNUM1 seçimleri ────────────────────────────────────────────────────────────────────────────────────────
esit("vergi-komisyon grupları", [vergiKomisyonGruplari("vezne", false), vergiKomisyonGruplari("vezne", true), vergiKomisyonGruplari("para", true), vergiKomisyonGruplari("gun", true)].map(g => g.map(x => x.anahtar).join("+")).join(" "),
  "grupAnahtar grupAnahtar+gunAnahtar grupAnahtar+gunAnahtar grupAnahtar");
esit("vergi-komisyon gün alt grubu etiketi", vergiKomisyonGruplari("para", true)[1].toplamEtiketi, "{{gunBaslik}} toplamı");
esit("fiş cinsi → bölümler", `${fisCinsiBolumleri("doviz")}|${fisCinsiBolumleri("altin")}|${fisCinsiBolumleri("hepsi")}|${fisCinsiBolumleri("")}`, "1|2|undefined|undefined");
{
  // Kimlik özeti: kimlik A'nın satırları bir araya gelir; kimlik içinde Döviz → Kuyum → Ticari; toplam değişmez
  const o = kimlikOzetiBaslikli([{ kimlik: "A", paraKod: "CEY", tutar: 9000 }, { kimlik: "B", paraKod: "USD", tutar: 410 }, { kimlik: "A", paraKod: "USD", tutar: 4920 }, { kimlik: "A", paraKod: "TL", tutar: 500, ticari: true }], grupla);
  esit("kimlik özeti başlıkları", o.map(s => `${s.kimlik}:${s._stil ? `[${s.paraKod}]` : s.paraKod}`).join(" "), "A:[Döviz] A:USD A:[Kuyum] A:CEY A:[Ticari] A:TL B:[Döviz] B:USD");
  esit("kimlik özeti toplamı değişmez", o.reduce((t, s) => t + (Number(s.tutar) || 0), 0), 14830);
}
esit("vergi no cins harfleri", `${VERGI_NO_CINSI[1]}${VERGI_NO_CINSI[2]}${VERGI_NO_CINSI[3]}${VERGI_NO_CINSI[4]}`, "DAPT");

// ── Tanımlar: parametreler, koşullar, düzen ────────────────────────────────────────────────────────────────────────────
{
  const t = Object.fromEntries(["FISLIS1", "GUNFIS1", "ISTRAP1", "ISTKMV1", "VERNUM1", "VERKOM1"].map(k => [k, raporTanimOku(k)]));
  const adlar = (kod: string) => t[kod].parametreler.map(p => p.ad).join();
  const gorunen = (kod: string, p: any) => t[kod].kolonlar.filter(k => kosulSaglandi(k.kosul, t[kod], p)).map(k => k.anahtar).join();
  esit("FISLIS1 parametreleri", adlar("FISLIS1"), "baslangic,fisTipi,vezneIdler,cariIdler,paraIdler,istatistikIdler,listeTipi,seriNo,belgeNo,siralama,iptal");
  esit("FISLIS1 ek parametre adları", ["listeTipi", "seriNoIlk", "seriNoSon", "belgeNoIlk", "belgeNoSon", "iptal"].every(a => RaporService.ekParametreAdlari("FISLIS1").includes(a)), true);
  esit("FISLIS1 varsayılanlar (liste tipi | sıralama)", `${parametreDegeri(t.FISLIS1, {} as any, "listeTipi")}|${parametreDegeri(t.FISLIS1, {} as any, "siralama")}`, "detay|tarih");
  esit("FISLIS1 detay kolonları (eski sıra: tarih, para, vezne, seri, belge, miktar, kur, KMV, lira)", gorunen("FISLIS1", {}).split(",").filter(a => t.FISLIS1.kolonlar.find(k => k.anahtar === a)!.pdf !== false).join(),
    "zaman,saat,paraKod,vezneKod,seriNo,belgeNo,miktar,kur,kmv,tutar");
  esit("FISLIS1 toplam kolonları", gorunen("FISLIS1", { ek: { listeTipi: "toplam" } }), "zaman,adet,miktar,kmv,tutar,komisyon,bmv,kdv,toplamTutar,odemeTutari");
  esit("FISLIS1 gün grubu yalnız detayda; bölüm + sayfa toplamı", `${kosulSaglandi(t.FISLIS1.grup?.kosul, t.FISLIS1, {} as any)}|${kosulSaglandi(t.FISLIS1.grup?.kosul, t.FISLIS1, { ek: { listeTipi: "toplam" } } as any)}|${t.FISLIS1.bolum?.anahtar}|${t.FISLIS1.sayfaToplami}`, "true|false|bolumAd|true");
  esit("GUNFIS1 parametreleri (tarih aralığı)", `${adlar("GUNFIS1")}|${t.GUNFIS1.parametreler[0].tip}`, "baslangic,fisTipi,vezneIdler,paraIdler,iptal|tarihAralik");
  esit("GUNFIS1 gruplar: gün → vezne × tip; gün toplamı grup altında", `${(t.GUNFIS1.gruplar || []).map(g => g.anahtar).join()}|${t.GUNFIS1.grupAltTablo?.seviye}|${t.GUNFIS1.grupAltTablo?.baslik}|${t.GUNFIS1.grupAltTablo?.kolonlar.map(k => k.anahtar).join()}`,
    "gunAnahtar,grupAnahtar|0|GÜN TOPLAMI|paraKod,tip,miktar,ortKur,tutar");
  esit("GUNFIS1 PDF kolonları (eski sıra + bizim ekler)", t.GUNFIS1.kolonlar.filter(k => k.pdf !== false).map(k => k.anahtar).join(), "zaman,saat,paraKod,seriNo,belgeNo,miktar,kur,tutar,kmv,komisyon,bmv");
  esit("ISTRAP1 detayda miktar toplanmaz (farklı paralar), tutar toplanır", `${t.ISTRAP1.kolonlar.find(k => k.anahtar === "miktar" && k.kosul === "kip:detay")!.toplam}|${t.ISTRAP1.kolonlar.find(k => k.anahtar === "tutar" && k.kosul === "kip:detay")!.toplam}`, "undefined|true");
  esit("ISTRAP1 sıralama + saat yalnız detayda", `${parametreDegeri(t.ISTRAP1, {} as any, "siralama")}|${gorunen("ISTRAP1", {}).includes("saat")}|${gorunen("ISTRAP1", { birlestir: "toplam" }).includes("saat")}|${t.ISTRAP1.sayfaToplami}|${t.ISTRAP1.bolum?.anahtar}`, "para|true|false|true|bolumAd");
  esit("ISTKMV1 parametreleri + istatistik PDF'te + alt tablo", `${adlar("ISTKMV1")}|${t.ISTKMV1.kolonlar.find(k => k.anahtar === "istatistikKod")!.pdf !== false}|${t.ISTKMV1.altTablo?.kolonlar.length}|${t.ISTKMV1.bolum === undefined}`,
    "baslangic,fisTipi,istatistikIdler,vezneIdler,paraIdler,siralama,isimsizTopla|true|9|true");
  esit("VERNUM1 parametreleri", adlar("VERNUM1"), "baslangic,fisTipi,durum,arama,ad,vergiNo,gosterim,fisCinsi,istatistikIdler,vezneIdler,paraIdler,siralama,iptal,saatGizle");
  esit("VERNUM1 saat: varsayılan gizli, kutu kaldırılınca görünür", `${gorunen("VERNUM1", {}).includes("saat")}|${gorunen("VERNUM1", { ek: { saatGizle: "0" } }).includes("saat")}|${gorunen("VERNUM1", { ek: { saatGizle: "1" } }).includes("saat")}`, "false|true|false");
  const tutarli = (p: any) => ["kur", "tutar", "usdKarsiligi"].map(a => (gorunen("VERNUM1", p).split(",").includes(a) ? a : "-")).join();
  esit("VERNUM1 gösterim: ikisi / fiş tutarı / dolar karşılığı", `${tutarli({})} ${tutarli({ ek: { gosterim: "tutar" } })} ${tutarli({ ek: { gosterim: "dolar" } })}`, "kur,tutar,usdKarsiligi kur,tutar,- -,-,usdKarsiligi");
  esit("VERNUM1 PDF'te eski kolon seti (ünvan, vergi dairesi, vergi no, pasaport …)", t.VERNUM1.kolonlar.filter(k => k.pdf !== false).map(k => k.anahtar).join(),
    "unvan,vergiDairesi,vergiNo,pasaportNo,tip,zaman,saat,seriNo,belgeNo,paraKod,kur,miktar,tutar,usdKarsiligi,cins");
  esit("VERKOM1 parametreleri + sayfa toplamı + para bölümü", `${adlar("VERKOM1")}|${t.VERKOM1.sayfaToplami}|${t.VERKOM1.bolum?.anahtar}|${t.VERKOM1.bolum?.altToplam}`,
    "baslangic,vezneIdler,paraIdler,fisTipi,birlestir,siralama,istatistikIdler,tarihAraToplami,iptal|true|paraGrupAd|false");
  esit("kâğıt yönü değişmedi", Object.values(t).map(x => x.kagit).join(), Array(6).fill("A4-yatay").join());

  // Çizim: GUNFIS1 gün grubu + gün toplamı + sayfa toplamı; özet Döviz / Kuyum başlıklarıyla
  const ozet = paraBasliklariEkle(paraOzeti(gunSatirlari.map(x => ({ ...x, ticari: false }))), { grupla, alan: "paraKod" });
  const girdi = { tanim: t.GUNFIS1, satirlar: gunSatirlari, filtreOzeti: "28.09.2026 – 30.09.2026 · Tüm vezneler", firma, kullanici: "test", ozetSatirlar: ozet, grupAltSatirlar: gunToplamlari(gunSatirlari, grupla) };
  const pdf = await raporPdf(girdi); writeFileSync(path.join(dir, "FIS-GUNFIS1.pdf"), pdf);
  esit("GUNFIS1 PDF üretildi", pdf.subarray(0, 5).toString(), "%PDF-");
  const xlsx = await raporExcel(girdi); writeFileSync(path.join(dir, "FIS-GUNFIS1.xlsx"), xlsx);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx as any);
  const hucreler = JSON.stringify(wb.worksheets[0].getSheetValues());
  const ilk: string[] = []; wb.worksheets[0].eachRow(row => ilk.push(String(row.getCell(1).value ?? "")));
  esit("GUNFIS1 Excel: 2 gün başlığı, 3 vezne × tip başlığı, 2 gün toplamı tablosu", `${ilk.filter(x => /^\d\d\.09\.2026$/.test(x)).length}|${ilk.filter(x => /^ {3}0\d — /.test(x)).length}|${(hucreler.match(/GÜN TOPLAMI/g) || []).length}`, "2|3|2");
  esit("GUNFIS1 Excel: gün ara toplamı etiketi", /28\.09\.2026 toplamı \(4\)/.test(hucreler) && /30\.09\.2026 toplamı \(1\)/.test(hucreler), true);
  esit("GUNFIS1 Excel: özet sayfasında Döviz / Kuyum başlıkları", (() => { const o: string[] = []; wb.getWorksheet("Özet")!.eachRow(row => o.push(String(row.getCell(1).value ?? ""))); return o.filter(x => x === "Döviz" || x === "Kuyum").join(); })(), "Döviz,Kuyum");

  // Çizim: ISTKMV1 kırılım satırı + altındaki fişler
  const kmvS = kmvKirilimla([1, 2, 3].map(n => ({ istatistikBaslik: "10285 — EFEKTIF SATIS", istatistikKod: "10285", fisId: n, gunIso: "2026-09-25", zaman: "2026-09-25T07:00:00.000Z", saat: `2026-09-25T0${6 + n}:00:00.000Z`, vezneKod: "00", tip: "Satış",
    unvan: n === 3 ? "MEKMER" : "İsim beyan edilmemiştir", kimlikNo: "", ulke: "", belgeNo: `B${n}`, seriNo: `S${n}`, paraKod: "USD", miktar: 100 * n, kur: 41, tutar: 4100 * n, kmv: 8.2 * n, kmvOrani: 0.002, fisToplami: 4108.2 * n })), { siralama: "yok", isimsizTopla: true });
  const kmvGirdi = { tanim: t.ISTKMV1, satirlar: kmvS, filtreOzeti: "kırılım", firma, kullanici: "test", gruplar: kmvGruplari("yok") };
  const kmvPdf = await raporPdf(kmvGirdi); writeFileSync(path.join(dir, "FIS-ISTKMV1.pdf"), kmvPdf);
  const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.load(await raporExcel(kmvGirdi) as any);
  const h2 = JSON.stringify(wb2.worksheets[0].getSheetValues());
  esit("ISTKMV1 PDF + Excel: kırılım satırı (300 USD) ve altındaki iki fiş", `${kmvPdf.subarray(0, 5).toString()}|${kmvS.length}|${kmvS[0].miktar}|${/"S1"/.test(h2) && /"S2"/.test(h2)}|${/GENEL TOPLAM \(2 kayıt\)/.test(h2)}`, "%PDF-|2|300|true|true");
}

console.log(hata ? `\n${hata} HATA` : "\nFİŞ RAPORLARI TESTLERİ GEÇTİ");
process.exit(hata ? 1 : 0);
