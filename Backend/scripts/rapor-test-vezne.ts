/**
 * Vezne grubu rapor testi (docs/RAPOR_ESITLEME_UYGULAMA.md bölüm 2 "Vezne") — veritabanı gerekmez.
 * Saf mantık: belge / işlem tipi süzgeci, sıralama (baştan sona / sondan başa), listeleme şekli (vezne / para / genel), para ayrımı başlıkları,
 * kur kontrolü kipi; tanım denetimleri (yeni parametreler, kolon koşulları). Örnekler elle hesaplanmıştır.
 * Çalıştır: cd Backend && npx tsx scripts/rapor-test-vezne.ts
 */
import { raporTanimOku, etkinGruplar, bolumlereAyir, veriSatirlari } from "../src/services/rapor/raporMotor.js";
import { kosulSaglandi, parametreDegeri } from "../src/services/rapor/rapor.service.js";
import { paraGrupKur } from "../src/services/rapor/paraGrup.js";
import { FIS_BELGELERI, VEZNE_BELGE } from "../src/services/rapor/kaynak.js";
import {
  VEZNE_BELGE_SECIMI, belgeKodlari, hareketSuz, hareketSirala, vezneOzetiBaslikla, listelemeSekli, bakiyeListele, baslikliSonuc, secimDegeri, paraSirasi,
} from "../src/services/rapor/veri/vezneTemel.js";
import { kurKontrolKipi, kurSapmasi } from "../src/services/rapor/veri/vezne.js";

let hata = 0, gecen = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else { gecen++; console.log(`✓ ${ad}`); } };

// ── Belge tipi seçimi ────────────────────────────────────────────────────────────────────────────────────────────────
esit("belge kodları: fis / ticari / urun", `${belgeKodlari("fis")}|${belgeKodlari("ticari")}|${belgeKodlari("urun")}`, "0|9|7");
esit("belge kodları: hepsi / boş / bilinmeyen → süzme yok", `${belgeKodlari("hepsi")}|${belgeKodlari("")}|${belgeKodlari("yok")}`, "null|null|null");
esit("belge seçimleri kaynak.ts adlarıyla eşleşir", Object.entries(VEZNE_BELGE_SECIMI).map(([a, k]) => `${a}=${k.map(x => VEZNE_BELGE[x]).join("+")}`).join(" "),
  "fis=Fiş transfer=Transfer cari=Cari hesap=Hesap dekont=Dekont sarraf=Sarraf perakende=Perakende urun=Ürün tanımı ticari=Ticari");
esit("ticari fiş (9) fiş belgesidir, ayrı seçimdir", `${FIS_BELGELERI.includes(9)}|${belgeKodlari("perakende")!.includes(9)}|${belgeKodlari("ticari")!.includes(6)}`, "true|false|false");

// ── Örnek hareketler (elle): iki vezne, dört gün; belgeTipi sayısal kod ─────────────────────────────────────────────
// no: satırı tanımak için. Vezne 00: n1 fiş alış USD 100 giriş (25.09 10:00), n2 aynı fişin TL ödemesi 4.100 çıkış, n3 transfer EUR 50 çıkış (25.09 saatsiz),
// n4 sarraf satış 22 ayar 8 çıkış (26.09 09:30), n5 ticari fiş tahsilatı TL 1.200 giriş (26.09 14:00), n6 cari USD 20 giriş (27.09 saatsiz).
// Vezne 01: n7 perakende satış CEY 2 çıkış (25.09 11:00), n8 ürün tanımı 22 ayar 3 çıkış (26.09 08:00), n9 dekont USD 40 giriş (26.09 saatsiz).
const h = (no: number, vezneKod: string, gun: string, saat: string, belgeTipi: number, belgeId: number, paraKod: string, paraSira: number, giris: number, cikis: number) =>
  ({ no, vezneKod, tarih: `2026-09-${gun}T00:00:00.000Z`, saat, belgeTipi, belgeId, paraKod, paraSira, giris, cikis });
const hareketler = [
  h(5, "00", "26", "14:00", 9, 12, "TL", 9999999, 1200, 0),
  h(1, "00", "25", "10:00", 0, 7, "USD", 1, 100, 0),
  h(9, "01", "26", "", 4, 3, "USD", 1, 40, 0),
  h(2, "00", "25", "10:00", 0, 7, "TL", 9999999, 0, 4100),
  h(4, "00", "26", "09:30", 5, 2, "22", 30, 0, 8),
  h(7, "01", "25", "11:00", 6, 5, "CEY", 51, 0, 2),
  h(3, "00", "25", "", 1, 4, "EUR", 2, 0, 50),
  h(6, "00", "27", "", 2, 9, "USD", 1, 20, 0),
  h(8, "01", "26", "08:00", 7, 1, "22", 30, 0, 3),
];
const nolar = (s: { no: number }[]) => s.map(x => x.no).join(",");

// Süzgeç
esit("süzgeç yok → aynı dizi", hareketSuz(hareketler, {}) === hareketler && hareketSuz(hareketler, { belgeTipi: "hepsi", islemTipi: "hepsi" }) === hareketler, true);
esit("belge tipi: fiş (yalnız döviz fişi; ödeme ayağı dahil)", nolar(hareketSuz(hareketler, { belgeTipi: "fis" })), "1,2");
esit("belge tipi: ticari (perakende ayrı)", `${nolar(hareketSuz(hareketler, { belgeTipi: "ticari" }))}|${nolar(hareketSuz(hareketler, { belgeTipi: "perakende" }))}`, "5|7");
esit("belge tipi: transfer / cari / dekont / sarraf / ürün tanımı", ["transfer", "cari", "dekont", "sarraf", "urun"].map(b => nolar(hareketSuz(hareketler, { belgeTipi: b }))).join("|"), "3|6|9|4|8");
esit("belge tipi: hesap (örnekte yok) → boş", hareketSuz(hareketler, { belgeTipi: "hesap" }).length, 0);
esit("işlem tipi: giriş", nolar(hareketSuz(hareketler, { islemTipi: "giris" })), "5,1,9,6");
esit("işlem tipi: çıkış", nolar(hareketSuz(hareketler, { islemTipi: "cikis" })), "2,4,7,3,8");
esit("belge + işlem birlikte: fiş çıkışı (TL ödeme ayağı)", nolar(hareketSuz(hareketler, { belgeTipi: "fis", islemTipi: "cikis" })), "2");
esit("giriş + çıkış = tümü (elle: 4 + 5 = 9)", hareketSuz(hareketler, { islemTipi: "giris" }).length + hareketSuz(hareketler, { islemTipi: "cikis" }).length, 9);
esit("giriş toplamı USD (elle: 100 + 40 + 20 = 160)", hareketSuz(hareketler, { islemTipi: "giris" }).filter(x => x.paraKod === "USD").reduce((t, x) => t + x.giris, 0), 160);

// Sıralama: vezne → gün → saat → belge tipi → belge → para sırası (TL en sonda)
esit("baştan sona", nolar(hareketSirala(hareketler, "bas")), "3,1,2,4,5,6,7,9,8");
esit("varsayılan = baştan sona", nolar(hareketSirala(hareketler)), "3,1,2,4,5,6,7,9,8");
// Sondan başa: yalnız gün ve saat tersine; vezne sırası ve aynı fişin iç sırası (USD, sonra TL) aynı
esit("sondan başa", nolar(hareketSirala(hareketler, "son")), "6,5,4,1,2,3,8,9,7");
esit("sıralama girdiyi değiştirmez", nolar(hareketler), "5,1,9,2,4,7,3,6,8");
esit("süzgeç + sondan başa (vezne 00 çıkışları)", nolar(hareketSirala(hareketSuz(hareketler, { islemTipi: "cikis" }).filter(x => x.vezneKod === "00"), "son")), "4,2,3");

// ── Para ayrımı: özet tablosunda vezne içinde başlıklar ─────────────────────────────────────────────────────────────
const pg = paraGrupKur(new Set([30, 51, 60]), new Set(["22", "CEY", "HAS"]));
const ozet = [
  { vezne: "00 — Ana kasa", paraKod: "22", paraId: 30, giris: 0, cikis: 8, net: -8 },
  { vezne: "00 — Ana kasa", paraKod: "USD", paraId: 1, giris: 120, cikis: 0, net: 120 },
  { vezne: "00 — Ana kasa", paraKod: "TL", paraId: 9, giris: 1200, cikis: 4100, net: -2900 },
  { vezne: "01 — Şube", paraKod: "CEY", paraId: 51, giris: 0, cikis: 2, net: -2 },
  { vezne: "01 — Şube", paraKod: "22", paraId: 30, giris: 0, cikis: 3, net: -3 },
];
const ozetB = vezneOzetiBaslikla(ozet, o => pg.grup(o));
esit("özet: vezne içinde Döviz → Kuyum, TL dövizde", ozetB.map(s => (s._stil ? `[${s.vezne.slice(0, 2)}:${s.paraKod}]` : s.paraKod)).join(" "), "[00:Döviz] USD TL [00:Kuyum] 22 [01:Kuyum] CEY 22");
esit("özet: rakamlar değişmez (Σgiriş 1.320, Σçıkış 4.113)", `${ozetB.reduce((t, s) => t + (s.giris || 0), 0)}|${ozetB.reduce((t, s) => t + (s.cikis || 0), 0)}`, "1320|4113");
esit("özet: başlık yalnız başlıktır (veri satırı sayısı aynı)", veriSatirlari(ozetB).length, 5);

// ── Listeleme şekli (vezne bakiye raporları) ────────────────────────────────────────────────────────────────────────
esit("listeleme şekli: geçerli / boş / bilinmeyen", `${listelemeSekli("para")}|${listelemeSekli("genel")}|${listelemeSekli("vezne")}|${listelemeSekli("")}|${listelemeSekli("x")}`, "para|genel|vezne|vezne|vezne");
// Elle: kurlar USD 40, EUR 50, 22 ayar 3.000, HAS 3.300; karşılık parası USD (÷ 40)
const b = (vezneKod: string, vezneAd: string, paraId: number, paraKod: string, paraAd: string, siraNo: number, miktar: number, kur: number) =>
  ({ vezneId: Number(vezneKod) + 1, vezneKod, vezneAd, vezneBaslik: `${vezneKod} — ${vezneAd}`, paraId, paraKod, paraAd, siraNo, miktar, kur, tlKarsiligi: miktar * kur, hedefKarsiligi: (miktar * kur) / 40, tlSatis: miktar * kur });
const bakiye = [
  b("00", "Ana kasa", 9, "TL", "Türk lirası", 0, 1000, 1),
  b("00", "Ana kasa", 1, "USD", "Amerikan doları", 1, 150, 40),
  b("00", "Ana kasa", 30, "22", "22 ayar altın", 30, 6, 3000),
  b("00", "Ana kasa", 60, "HAS", "Has altın", 32, 5, 3300),
  b("01", "Şube", 9, "TL", "Türk lirası", 0, 500, 1),
  b("01", "Şube", 1, "USD", "Amerikan doları", 1, -50, 40),
  b("01", "Şube", 2, "EUR", "Euro", 2, 20, 50),
  b("01", "Şube", 30, "22", "22 ayar altın", 30, -6, 3000),
];
const grupla = (s: Record<string, any>) => pg.grup(s);
const tlTop = (s: Record<string, any>[]) => veriSatirlari(s).reduce((t, x) => t + x.tlKarsiligi, 0);
// Elle: TL 1.500 + USD 100 × 40 = 4.000 + EUR 20 × 50 = 1.000 + 22 ayar 0 + HAS 5 × 3.300 = 16.500 → 23.000
esit("örnek TL karşılığı toplamı (elle 23.000)", tlTop(bakiye), 23000);

const vz = bakiyeListele(bakiye, "vezne", { grupla, vezneAnahtar: "vezneKod" });
esit("vezne bazında: tanımdaki grup geçerli (sorgu grup döndürmez)", vz.gruplar, undefined);
esit("vezne bazında: her veznede Döviz / Kuyum başlığı", vz.satirlar.map(s => (s._stil ? `[${s.vezneKod}:${s.paraKod}]` : s.paraKod)).join(" "), "[00:Döviz] TL USD [00:Kuyum] 22 HAS [01:Döviz] TL USD EUR [01:Kuyum] 22");
esit("vezne bazında: toplam değişmez", tlTop(vz.satirlar), 23000);

const pr = bakiyeListele(bakiye, "para", { grupla, vezneAnahtar: "vezneKod" });
esit("para bazında: grup = para", JSON.stringify(pr.gruplar), '[{"anahtar":"paraId","baslik":"{{paraBaslik}}","altToplam":true}]');
esit("para bazında: sıra Döviz → Kuyum, para sırası, vezne", pr.satirlar.map(s => `${s.paraGrupAd}:${s.paraKod}@${s.vezneKod}`).join(" "),
  "Döviz:TL@00 Döviz:TL@01 Döviz:USD@00 Döviz:USD@01 Döviz:EUR@01 Kuyum:22@00 Kuyum:22@01 Kuyum:HAS@00");
esit("para bazında: grup başlığı metni", `${pr.satirlar[2].paraBaslik}|${pr.satirlar[7].paraBaslik}`, "USD — Amerikan doları|HAS — Has altın");
esit("para bazında: başlık satırı yok, toplam değişmez", `${pr.satirlar.some(s => s._stil)}|${tlTop(pr.satirlar)}`, "false|23000");
// USD grubunun ara toplamı (elle): 150 × 40 − 50 × 40 = 4.000 TL = 100 USD
esit("para bazında: USD grubu TL / karşılık toplamı (elle 4.000 / 100)", `${pr.satirlar.filter(s => s.paraKod === "USD").reduce((t, s) => t + s.tlKarsiligi, 0)}|${pr.satirlar.filter(s => s.paraKod === "USD").reduce((t, s) => t + s.hedefKarsiligi, 0)}`, "4000|100");
const tanimBolum = { ...raporTanimOku("VEZBAK1") };
esit("para bazında: bölümler Döviz / Kuyum (tanımdaki bolum)", bolumlereAyir(tanimBolum, pr.satirlar).map(x => `${x.baslik}:${x.satirlar.length}`).join(" "), "Döviz:5 Kuyum:3");
esit("vezne bazında: bölüm çizilmez (tek parça, başlıksız)", bolumlereAyir(tanimBolum, vz.satirlar).map(x => `${x.baslik}:${x.satirlar.length}`).join(" "), `:${vz.satirlar.length}`);

const gn = bakiyeListele(bakiye, "genel", { grupla, vezneAnahtar: "vezneKod" });
esit("genel: grupsuz", JSON.stringify(gn.gruplar), "[]");
// Elle: TL 1.000 + 500 = 1.500 · USD 150 − 50 = 100 · EUR 20 · 22 ayar 6 − 6 = 0 · HAS 5
esit("genel: para başına tek satır, vezneler toplanır", gn.satirlar.map(s => (s._stil ? `[${s.paraKod}]` : `${s.paraKod}=${s.miktar}`)).join(" "), "[Döviz] TL=1500 USD=100 EUR=20 [Kuyum] 22=0 HAS=5");
esit("genel: karşılıklar toplanır (USD 4.000 TL / 100; 22 ayar 0)", gn.satirlar.filter(s => s.paraKod === "USD" || s.paraKod === "22").map(s => `${s.tlKarsiligi}/${s.hedefKarsiligi}`).join(" "), "4000/100 0/0");
esit("genel: vezne alanları boş, kur aynı", gn.satirlar.filter(s => !s._stil).map(s => `${s.vezneKod}|${s.vezneBaslik}|${s.kur}`).join(" "), "||1 ||40 ||50 ||3000 ||3300");
esit("genel: toplam değişmez", tlTop(gn.satirlar), 23000);
esit("genel: girdi satırları değişmez", `${bakiye[0].miktar}|${bakiye[1].miktar}|${bakiye[0].vezneKod}`, "1000|150|00");
const gnAnlik = bakiyeListele(bakiye, "genel", { grupla, vezneAnahtar: "vezneBaslik", sifirAt: true });
esit("genel (anlık): toplamı sıfır olan para düşer", gnAnlik.satirlar.map(s => (s._stil ? `[${s.paraKod}]` : s.paraKod)).join(" "), "[Döviz] TL USD EUR [Kuyum] HAS");
// Para adına göre sıra (VEZANL1 sıralama = ad): Amerikan doları, Euro, Türk lirası | 22 ayar altın, Has altın
const adSirasi = (x: any, y: any) => String(x.paraAd).localeCompare(String(y.paraAd), "tr");
esit("para bazında: ada göre sıra", [...new Set(bakiyeListele(bakiye, "para", { grupla, vezneAnahtar: "vezneBaslik", paraSirala: adSirasi }).satirlar.map(s => s.paraKod))].join(" "), "USD EUR TL 22 HAS");
esit("para sırası: sıra no, sonra kod", [{ paraKod: "B", siraNo: 2 }, { paraKod: "A", siraNo: 2 }, { paraKod: "Z", siraNo: 1 }, { paraKod: "Y" }].sort(paraSirasi).map(x => x.paraKod).join(""), "ZABY");

// Sonuç: kayıt sayısı başlık satırlarını saymaz; gruplar ve kolon başlığı sonuca eklenir
const tVezbak = raporTanimOku("VEZBAK1");
const s1 = baslikliSonuc(vz, tVezbak, "özet");
esit("sonuç: toplam kayıt = veri satırı (8), satırlar başlıklı (12)", `${s1.toplamKayit}|${s1.satirlar.length}|${"gruplar" in s1}|${"kolonBasliklari" in s1}`, "8|12|false|false");
const s2 = baslikliSonuc(gn, tVezbak, "özet", "not", { kolonBasliklari: { hedefKarsiligi: "USD" } });
esit("sonuç: genel → boş grup dizisi + kolon başlığı", `${s2.toplamKayit}|${JSON.stringify(s2.gruplar)}|${s2.kolonBasliklari?.hedefKarsiligi}|${s2.ekDipnot}`, "5|[]|USD|undefined");
const s3 = baslikliSonuc({ satirlar: [] }, tVezbak, "özet", "boş notu");
esit("sonuç: boş raporda not kalır", `${s3.toplamKayit}|${s3.ekDipnot}`, "0|boş notu");
const s4 = baslikliSonuc(vz, { ...tVezbak, ustSinir: 5 }, "özet");
esit("sonuç: üst sınır veri satırına göre", `${s4.sinirAsildi}|${s4.toplamKayit}|${s4.satirlar.length}`, "true|8|0");
esit("etkin gruplar: genel → grupsuz, vezne → tanımdaki grup", `${etkinGruplar(tVezbak, s2.gruplar).length}|${etkinGruplar(tVezbak, s1.gruplar).map(g => g.anahtar).join()}`, "0|vezneKod");

// ── Seçim değeri: ek parametre → doğrudan alan ──────────────────────────────────────────────────────────────────────
esit("seçim değeri", `${secimDegeri({ ek: { listeleme: "para" } } as any, "listeleme")}|${secimDegeri({ listeleme: "genel" } as any, "listeleme")}|${secimDegeri({} as any, "listeleme")}|${secimDegeri({ ek: { belgeTipi: "fis" }, belgeTipi: "cari" } as any, "belgeTipi")}`, "para|genel||fis");

// ── Kur kontrolü kipi (varsayılan eski rapordaki "Genel") ve kur sapması ────────────────────────────────────────────
esit("kur kontrolü kipi: boş / geçersiz → genel; bizim kipler kalır", [undefined, "", "x", "genel", "vezne", "kullanici", "ayrinti", "gun"].map(v => kurKontrolKipi(v)).join(), "genel,genel,genel,genel,vezne,kullanici,ayrinti,gun");
const sp = kurSapmasi(41.5, 41, 1000);
esit("kur sapması (imza ve davranış aynı)", `${sp.fark.toFixed(2)}|${sp.sapmaYuzde.toFixed(4)}|${sp.tlEtkisi.toFixed(0)}|${sp.giseVar}|${kurSapmasi(41.5, 0, 1000).giseVar}`, "0.50|1.2195|500|true|false");

// ── Tanımlar ────────────────────────────────────────────────────────────────────────────────────────────────────────
const prm = (kod: string, ad: string) => raporTanimOku(kod).parametreler.find(x => x.ad === ad);
const pdfKolonlari = (kod: string, p: any) => { const t = raporTanimOku(kod); return t.kolonlar.filter(k => kosulSaglandi(k.kosul, t, p) && k.pdf !== false).map(k => k.anahtar).join(","); };
const ekranKolonlari = (kod: string, p: any) => { const t = raporTanimOku(kod); return t.kolonlar.filter(k => kosulSaglandi(k.kosul, t, p)).map(k => k.anahtar).join(","); };
{
  const t = raporTanimOku("VEZHAR1");
  esit("VEZHAR1 belge tipi seçenekleri", prm("VEZHAR1", "belgeTipi")?.secenekler?.map(s => s.deger).join(), "hepsi,fis,transfer,cari,hesap,dekont,sarraf,perakende,ticari,urun");
  esit("VEZHAR1 belge tipi seçenekleri sorguda karşılanır", prm("VEZHAR1", "belgeTipi")!.secenekler!.filter(s => s.deger !== "hepsi").every(s => !!belgeKodlari(s.deger)), true);
  esit("VEZHAR1 işlem tipi / sıralama seçenekleri", `${prm("VEZHAR1", "islemTipi")?.secenekler?.map(s => s.deger).join()}|${prm("VEZHAR1", "siralama")?.secenekler?.map(s => s.deger).join()}`, "hepsi,giris,cikis|bas,son");
  esit("VEZHAR1 varsayılanlar", ["belgeTipi", "islemTipi", "siralama", "saatGizle"].map(a => parametreDegeri(t, {} as any, a)).join("|"), "hepsi|hepsi|bas|");
  esit("VEZHAR1 fiş tipi (alış / satış) kalır", prm("VEZHAR1", "fisTipi")?.tip, "fisTipi");
  esit("VEZHAR1 saat gözükmesin: kolon düşer", `${ekranKolonlari("VEZHAR1", {}).includes(",saat,")}|${ekranKolonlari("VEZHAR1", { ek: { saatGizle: "0" } }).includes(",saat,")}|${ekranKolonlari("VEZHAR1", { ek: { saatGizle: "1" } }).includes(",saat,")}`, "true|true|false");
  esit("VEZHAR1 tarih ve saat ayrı kolon", `${t.kolonlar[0].anahtar}:${t.kolonlar[0].bicim}|${t.kolonlar[1].anahtar}`, "tarih:tarih|saat");
  esit("VEZHAR1 giriş / çıkış ana tabloda toplanmaz (eski raporda toplam gizli; paralar karışık)", t.kolonlar.filter(k => k.anahtar === "giris" || k.anahtar === "cikis").some(k => k.toplam), false);
  esit("VEZHAR1 PDF kolonları (varsayılan) aynı", pdfKolonlari("VEZHAR1", {}), "tarih,saat,belgeTipi,paraKod,yon,aciklama,kur,giris,cikis,bankaHesabi");
}
for (const kod of ["VEZBAK1", "VEZANL1"]) {
  const t = raporTanimOku(kod);
  esit(`${kod} listeleme şekli`, `${prm(kod, "listeleme")?.secenekler?.map(s => s.deger).join()}|${parametreDegeri(t, {} as any, "listeleme")}`, "vezne,para,genel|vezne");
  esit(`${kod} para adı PDF'te basılı`, t.kolonlar.find(k => k.anahtar === "paraAd")?.pdf !== false, true);
  esit(`${kod} para bazında: vezne kolonu gelir, para kolonları başlığa geçer`, `${ekranKolonlari(kod, {}).startsWith("paraKod,paraAd,miktar")}|${ekranKolonlari(kod, { ek: { listeleme: "para" } }).startsWith("vezneBaslik,miktar")}|${ekranKolonlari(kod, { ek: { listeleme: "genel" } }).startsWith("paraKod,paraAd,miktar")}`, "true|true|true");
  esit(`${kod} bölüm = para grubu (yalnız başlık)`, `${t.bolum?.anahtar}|${t.bolum?.altToplam}`, "paraGrupAd|false");
  esit(`${kod} kâğıt`, t.kagit, "A4");
}
esit("VEZBAK1 PDF kolonları (varsayılan)", pdfKolonlari("VEZBAK1", {}), "paraKod,paraAd,miktar,kur,tlKarsiligi,hedefKarsiligi");
{
  // Birim maliyet: kutu işaretsizken ekran / Excel'de (bugünkü gibi), PDF'te yok; işaretliyken PDF'te de
  const say = (liste: string) => liste.split(",").filter(x => x === "birimMaliyet").length;
  esit("VEZANL1 birim maliyet: işaretsiz → ekranda 1, PDF'te 0", `${say(ekranKolonlari("VEZANL1", {}))}|${say(pdfKolonlari("VEZANL1", {}))}|${say(ekranKolonlari("VEZANL1", { ek: { maliyetGoster: "0" } }))}|${say(pdfKolonlari("VEZANL1", { ek: { maliyetGoster: "0" } }))}`, "1|0|1|0");
  esit("VEZANL1 birim maliyet: işaretli → ekranda 1, PDF'te 1", `${say(ekranKolonlari("VEZANL1", { ek: { maliyetGoster: "1" } }))}|${say(pdfKolonlari("VEZANL1", { ek: { maliyetGoster: "1" } }))}`, "1|1");
  esit("VEZANL1 birim maliyet göster kutusu ve sıralama", `${prm("VEZANL1", "maliyetGoster")?.tip}|${prm("VEZANL1", "siralama")?.secenekler?.map(s => s.deger).join()}`, "onay|sira,ad");
  esit("VEZANL1 PDF kolonları (varsayılan) aynı", pdfKolonlari("VEZANL1", {}), "paraKod,paraAd,miktar,kur,tlKarsiligi,hedefKarsiligi");
}
{
  const t = raporTanimOku("KURKON2");
  esit("KURKON2 varsayılan rapor tipi Genel; ayrıntı ve gün kipleri kalır", `${parametreDegeri(t, {} as any, "birlestir")}|${prm("KURKON2", "birlestir")?.secenekler?.map(s => s.deger).join()}`, "genel|ayrinti,gun,genel,vezne,kullanici");
  esit("KURKON2 seçenekleri sorguda karşılanır", prm("KURKON2", "birlestir")!.secenekler!.every(s => kurKontrolKipi(s.deger) === s.deger), true);
  const k1 = raporTanimOku("KURKON1");
  esit("KURKON1 tarih ve saat ayrı kolon", `${k1.kolonlar[0].anahtar}:${k1.kolonlar[0].bicim}|${k1.kolonlar[1].anahtar}`, "zaman:tarih|saat");
  esit("kâğıt yönleri değişmedi", ["VEZHAR1", "VEZHAS1", "VEZALT1", "KURKON1", "KURKON2"].map(k => raporTanimOku(k).kagit).join(), "A4-yatay,A4-yatay,A4-yatay,A4-yatay,A4-yatay");
}

console.log(hata ? `\n${hata} HATA (${gecen} geçti)` : `\nVEZNE TESTLERİ GEÇTİ (${gecen} denetim)`);
process.exit(hata ? 1 : 0);
