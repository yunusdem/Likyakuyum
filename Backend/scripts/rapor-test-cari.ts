/**
 * Cari grubu raporları — saf mantık testi (docs/RAPOR_ESITLEME_UYGULAMA.md bölüm 2; veritabanı gerekmez).
 * CARBAK1 / CAREKS1 / CARHAR1 / CARKRT1 / POSEKS1 / VADISL1: hesap tipi süzgeci, limit, gruplama seçimi, net satırı, devir seçenekleri, tanım tutarlılığı.
 * Beklenen değerler elle hesaplanmıştır. Çalıştır: cd Backend && npx tsx scripts/rapor-test-cari.ts
 */
import { raporTanimOku, netMetni, etkinGruplar, genelToplamVar, raporPdf } from "../src/services/rapor/raporMotor.js";
import { raporExcel } from "../src/services/rapor/raporExcel.js";
import { kosulSaglandi } from "../src/services/rapor/rapor.service.js";
import {
  bakiyeSuzgeci, cariBakiyeDuzeni, paraBakiyeToplamlari, ekstreKur, cariHareketDuzeni, cariHareketSatirlari, hareketAdi, hareketHarfi,
  hesapTipiOku, hesapTipiKodu, metinAraligi, metinAraligiOzeti, secim, onay, ekstreGruplari, grupAltBasliklari,
} from "../src/services/rapor/veri/cariTemel.js";
import { paraBasliklariEkle, paraGrupKur } from "../src/services/rapor/paraGrup.js";
import { posEkstreKur, islemDurumu, vadeliIslemDuzeni, vadeliIslemSatiri } from "../src/services/rapor/veri/cari.js";

let hata = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else console.log(`✓ ${ad}`); };
const p = (ek: Record<string, string>, ekstra: Record<string, any> = {}) => ({ ek, ...ekstra }) as any;

// ── Ortak yardımcılar
esit("hesap tipi: varsayılan / geçersiz → hepsi", `${hesapTipiOku(p({}))}|${hesapTipiOku(p({ hesapTipi: "xyz" }))}|${hesapTipiOku(p({ hesapTipi: "alacak" }))}`, "hepsi|hepsi|alacak");
esit("hesap tipi kodu (borç 0 / alacak 1 / hepsi null)", `${hesapTipiKodu("borc")}|${hesapTipiKodu("alacak")}|${hesapTipiKodu("hepsi")}`, "0|1|null");
esit("secim: ek → düz alan → ilk", `${secim(p({ siralama: "ad" }), "siralama", ["kod", "ad"])}|${secim(p({}, { siralama: "ad" }), "siralama", ["kod", "ad"])}|${secim(p({}), "siralama", ["kod", "ad"])}`, "ad|ad|kod");
esit("onay", `${onay(p({ devirsiz: "1" }), "devirsiz")}|${onay(p({ devirsiz: "0" }), "devirsiz")}|${onay(p({}), "devirsiz")}`, "true|false|false");
{
  const girdiler: Record<string, any> = {}; const req = { input: (ad: string, _t: any, v: any) => { girdiler[ad] = v; } };
  const s = metinAraligi(req, p({ cariAdIlk: "A", cariAdSon: "M" }), "C.AD", "cariAd");
  esit("metin aralığı SQL + girdiler", `${s}|${girdiler.cariAdIlk}|${girdiler.cariAdSon}`, " AND RTRIM(ISNULL(C.AD,''))>=@cariAdIlk AND RTRIM(ISNULL(C.AD,''))<=@cariAdSon|A|M");
  esit("metin aralığı: tek uç / boş", `${metinAraligi(req, p({ posKodSon: "P9" }), "PC.KOD", "posKod")}|${metinAraligi(req, p({}), "PC.KOD", "posKod")}`, " AND RTRIM(ISNULL(PC.KOD,''))<=@posKodSon|");
  esit("metin aralığı özeti", `${metinAraligiOzeti(p({ cariAdIlk: "A" }), "cariAd", "Ad")}|${metinAraligiOzeti(p({}), "cariAd", "Ad")}`, " · Ad A → …|");
}
esit("hareket adı: belge türleri (5 = ticari fiş) ve cari hareket tipi", [hareketAdi({ evrakTipi: 5 }), hareketAdi({ evrakTipi: 4 }), hareketAdi({ evrakTipi: 1 }), hareketAdi({ evrakTipi: 0, hareketTipi: 2 }), hareketAdi({ evrakTipi: 9 })].join(","),
  "Ticari fiş,Perakende fişi,Virman dekontu,POS / Kredi Kartı,Diğer");
esit("hareket harfi N/F/Ç/S/A", [0, 1, 2, 3, 4, 5, null].map(hareketHarfi).join(""), "NFÇSAAN");

// ── CARBAK1
const b = (borcBakiye: number, alacakBakiye: number) => ({ borcBakiye, alacakBakiye });
esit("bakiye süzgeci: hepsi (sıfır hariç)", [b(10, 0), b(0, 5), b(0, 0)].map(s => bakiyeSuzgeci(s, { hesapTipi: "hepsi" })).join(), "true,true,false");
esit("bakiye süzgeci: borç / alacak", `${bakiyeSuzgeci(b(10, 0), { hesapTipi: "borc" })}|${bakiyeSuzgeci(b(0, 5), { hesapTipi: "borc" })}|${bakiyeSuzgeci(b(0, 5), { hesapTipi: "alacak" })}|${bakiyeSuzgeci(b(10, 0), { hesapTipi: "alacak" })}`, "true|false|true|false");
esit("bakiye süzgeci: |bakiye| limit (uçlar dahil, alacakta mutlak)", [b(100, 0), b(0, 100), b(99.99, 0), b(0, 500), b(0, 500.01)].map(s => bakiyeSuzgeci(s, { hesapTipi: "hepsi", alt: 100, ust: 500 })).join(), "true,true,false,true,false");
esit("bakiye süzgeci: yalnız alt limit", [b(5, 0), b(0, 1e9)].map(s => bakiyeSuzgeci(s, { hesapTipi: "hepsi", alt: 10 })).join(), "false,true");
{
  const kart = cariBakiyeDuzeni("kart", "kod"), para = cariBakiyeDuzeni("para", "ad");
  esit("CARBAK1 kart bazında: cari grubu, toplam yok, kod sırası", `${kart.gruplar[0].anahtar}|${kart.gruplar[0].altToplam}|${kart.sira}`, "cariKod|false|C.KOD, ISNULL(P.SIRA_NO,99), P.KOD");
  esit("CARBAK1 para bazında: para grubu + Toplam + net, ad sırası, genel toplam yok", `${para.gruplar[0].anahtar}|${para.gruplar[0].toplamEtiketi}|${para.gruplar[0].net?.arti}-${para.gruplar[0].net?.eksi}|${para.sira}|${para.gruplar[0].genelToplam}`,
    "paraKod|Toplam|borcBakiye-alacakBakiye|ISNULL(P.SIRA_NO,99), P.KOD, C.AD, C.KOD|false");
  // Elle: USD borç 100 + 30, alacak 250 → toplam B 130, A 250, net 120 A; TL borç 50 → net 50 B
  const t = paraBakiyeToplamlari([{ paraKod: "USD", ...b(100, 0) }, { paraKod: "TL", ...b(50, 0) }, { paraKod: "USD", ...b(30, 0) }, { paraKod: "USD", ...b(0, 250) }]);
  esit("para bazında toplam + net bakiye", t.map(x => `${x.paraKod}:${x.borcBakiye}/${x.alacakBakiye}=${x.netBakiye}${x.bakiyeTipi}`).join(" "), "USD:130/250=120A TL:50/0=50B");
  esit("grup net satırı (Bakiye : 120,00 A)", netMetni(para.gruplar[0].net!, [b(100, 0), b(30, 0), b(0, 250)]), "Bakiye : 120,00 A");
}

// ── CAREKS1
{
  const ortak = { cariKod: "C1", cariAd: "Ali", paraId: 2, paraKod: "USD", siraNo: 1, hasOrani: 0 };
  const h = (tarih: string, tip: number, meblag: number, ek: Record<string, any> = {}) => ({ ...ortak, tarih, eklemeZamani: tarih, tip, meblag, evrakTipi: 0, hareketTipi: 0, ...ek });
  // Devir = Değil: dönem öncesi alacak 100 − borç 40 = 60 A; hareketler borç 50 (→10 A), alacak 20 (→30 A); emanet bilgi satırı 7 bakiyeyi değiştirmez
  const e = ekstreKur([{ ...ortak, borc: 40, alacak: 100 }], [h("2026-09-02", 0, 50), h("2026-09-05", 1, 20)],
    [{ ...ortak, tarih: "2026-09-03", eklemeZamani: "2026-09-03", dekontTip: 0, meblag: 7, fisNo: "18" }], { baslangic: "2026-09-01" });
  esit("ekstre: devir + yürüyen bakiye + bilgi satırı arada", e.satirlar.map(s => `${s.hareketTipi}:${s.borc ?? "-"}/${s.alacak ?? "-"}/${s.emanet ?? ""}=${s.bakiye}${s.yon}`).join(" "),
    "Devir:0/60/=60A Nakit:50/0/=10A Emanet alma (bilgi):-/-/7=10A Nakit:0/20/=30A");
  esit("ekstre: para toplamı (devir dahil, bilgi hariç) cari altında", JSON.stringify(e.grupAltSatirlar.C1.map(x => [x.paraKod, x.borc, x.alacak, x.bakiye, x.yon])), JSON.stringify([["USD", 50, 80, 30, "A"]]));
  esit("ekstre: net satırı = son bakiye (devir + hareketler; bilgi satırı sayılmaz)", netMetni({ arti: "borc", eksi: "alacak" }, e.satirlar), "Bakiye : 30,00 A");
  esit("ekstre: bilgi satırı işaretli", `${e.bilgiVar}|${e.satirlar.filter(s => s.bilgiSatiri).length}`, "true|1");
  // Devir = Dahil: dönem öncesi kayıt satır satır, toplu devir satırı yok; aynı son bakiye
  const d = ekstreKur([], [h("2026-08-10", 1, 100), h("2026-08-20", 0, 40), h("2026-09-02", 0, 50), h("2026-09-05", 1, 20)], [], { baslangic: "2026-09-01", devirSatiri: false });
  esit("ekstre devir dahil: satır satır, son bakiye aynı", `${d.satirlar.length}|${d.satirlar.some(s => s.hareketTipi === "Devir")}|${d.satirlar.at(-1)!.bakiye}${d.satirlar.at(-1)!.yon}|${d.grupAltSatirlar.C1[0].borc}/${d.grupAltSatirlar.C1[0].alacak}`, "4|false|30A|90/120");
  // Ada göre sıralama: carinin adına göre dizilir, başlık "Ad — Kod"
  const s2 = ekstreKur([], [h("2026-09-02", 0, 1, { cariKod: "A1", cariAd: "Zeki" }), h("2026-09-02", 0, 1, { cariKod: "Z9", cariAd: "Ayşe" })], [], { baslangic: "2026-09-01", adaGore: true });
  esit("ekstre ada göre: sıra ve başlık", [...new Set(s2.satirlar.map(s => s.cariBaslik))].join(" | "), "Ayşe — Z9 | Zeki — A1");
  // Yalnız bilgi satırı olan grup özet / para toplamına girmez; iki gerçek grupta GENEL TOPLAM para başına
  const g = ekstreKur([], [h("2026-09-02", 0, 10), h("2026-09-02", 1, 4, { cariKod: "C2", cariAd: "Veli" })], [{ ...ortak, cariKod: "C3", cariAd: "Can", tarih: "2026-09-02", dekontTip: 1, meblag: 3 }], { baslangic: "2026-09-01" });
  esit("ekstre: bilgi grubunda toplam yok, genel toplam para başına", g.paraToplamlari.map(x => `${x.cari}:${x.borc}/${x.alacak}=${x.bakiye}${x.yon}`).join(" "), "C1 — Ali:10/0=10B C2 — Veli:0/4=4A GENEL TOPLAM:10/4=6B");
  // Devir dahil: dönem öncesi satırlar "0" dönemi ("Devir" toplamı), dönem içi "1"; harf N/F/Ç/S
  const dd = ekstreKur([], [h("2026-08-10", 1, 100, { onceki: 1, hareketTipi: 1 }), h("2026-09-02", 0, 50, { onceki: 0, hareketTipi: 2 })], [], { baslangic: "2026-09-01", bitis: "2026-09-30", devirSatiri: false });
  esit("ekstre devir dahil: dönem grubu + etiketler + harf", dd.satirlar.map(x => `${x.donem}:${x.donemBaslik}:${x.donemToplam}:${x.hareketHarf}`).join(" | "),
    "0:01.09.2026 öncesi:Devir:F | 1:01.09.2026 – 30.09.2026:Dönem toplamı:Ç");
  esit("ekstre devir dahil: 3. seviye dönem grubu yalnız dahil'de", `${ekstreGruplari([{ anahtar: "a", baslik: "A" }], true)?.map(x => x.anahtar).join(">")}|${ekstreGruplari([], false)}`, "a>donem|undefined");
  const pgk = paraGrupKur(new Set([28]));
  esit("ekstre para toplamı tablosunda Döviz / Kuyum başlıkları", grupAltBasliklari({ C1: [{ paraId: 28, paraKod: "22" }, { paraId: 2, paraKod: "USD" }] }, x => pgk.grup(x)).C1.map(x => x._stil ? `[${x.paraKod}]` : x.paraKod).join(" "), "[Döviz] USD [Kuyum] 22");
  const t = raporTanimOku("CAREKS1");
  esit("CAREKS1 Tip harfi kolonu", t.kolonlar.some(k => k.anahtar === "hareketHarf"), true);
  esit("CAREKS1 tanım: cari zorunlu değil, iki seviye grup, grup altı tablo, net", `${!!t.parametreler.find(x => x.ad === "cariIdler")?.zorunlu}|${etkinGruplar(t).map(x => x.anahtar).join(">")}|${t.grupAltTablo?.seviye}|${!!t.net}|${!!etkinGruplar(t)[1].net}`,
    "false|cariAnahtar>grupAnahtar|0|true|true");
}

// ── CARHAR1
{
  const d = cariHareketDuzeni();
  esit("CARHAR1 varsayılan: para grubu, tarih sırası (eski düzen)", `${d.kip}|${d.grupAlani}|${d.sira.startsWith("ISNULL(P.SIRA_NO,99), P.KOD, CH.tarih")}`, "tarih|paraKod|true");
  esit("CARHAR1 sıralama → grup", ["sondan", "bastan", "ad", "kod", "xyz"].map(s => { const x = cariHareketDuzeni(s); return `${x.kip}:${x.gruplar[0].anahtar}`; }).join(" "), "sondan:gun bastan:gun ad:cariKod kod:cariKod tarih:paraKod");
  esit("CARHAR1 sondan başa: gün azalan", cariHareketDuzeni("sondan").sira.startsWith("CAST(CH.tarih AS date) DESC"), true);
  const k = (gun: string, paraKod: string, tipKod: number, meblag: number, hareketTipiKod = 0) => ({ gun, paraKod, tipKod, meblag, hareketTipiKod, hareketTipi: hareketTipiKod, evrakTipi: 0 });
  // Gün grubunda S.No gün değişince sıfırlanır; para bazında net: USD borç 100 − alacak 30 = 70 B, TL alacak 5 = 5 A
  const { satirlar, netToplamlar } = cariHareketSatirlari([k("2026-09-02", "USD", 0, 100), k("2026-09-02", "TL", 1, 5, 2), k("2026-09-03", "USD", 1, 30, 1)], "gun");
  esit("CARHAR1 S.No gün grubunda", satirlar.map(s => s.siraNo).join(), "1,2,1");
  esit("CARHAR1 harf ve B/A", satirlar.map(s => `${s.hareketHarf}${s.tip[0]}`).join(), "NB,ÇA,FA");
  esit("CARHAR1 para bazında net toplam", netToplamlar.map(x => `${x.paraKod}:${x.adet}:${x.netToplam}${x.netTipi}`).join(" "), "USD:2:70B TL:1:5A");
  esit("CARHAR1 grup net satırı", netMetni(d.gruplar[0].net!, satirlar.filter(s => s.paraKod === "USD")), "Net toplam : 70,00 B");
  const t = raporTanimOku("CARHAR1");
  esit("CARHAR1 Para kolonu yalnız para grubu dışında", `${kosulSaglandi("p:siralama!=tarih", t, p({}))}|${kosulSaglandi("p:siralama!=tarih", t, p({}, { siralama: "ad" }))}`, "false|true");
}

// ── POSEKS1
{
  const r = (tarih: string, borc: number, alacak: number, onceki: number, devirKaydi = 0) => ({ posId: 2, cihazKod: "P1", cihazAd: "GARANTİ", paraKod: "TL", tarih, borc, alacak, onceki, devirKaydi, islem: "x", aciklama: "a" });
  // Devir 250 (cihaz) + dönem öncesi borç 100 / alacak 30; dönem içi borç 40 → son bakiye 360
  const k = [r("1800-01-01", 250, 0, 1, 1), r("2026-09-10", 100, 0, 1), r("2026-09-12", 0, 30, 1), r("2026-09-20", 40, 0, 0)];
  const toplu = posEkstreKur(k, { baslangic: "2026-09-15", devir: "toplu" });
  esit("POS toplu devir: tek satır brüt", toplu.satirlar.map(s => `${s.aciklama}:${s.borc}/${s.alacak}=${s.bakiye}`).join(" "), "POS Devir:350/30=320 a:40/0=360");
  const satir = posEkstreKur(k, { baslangic: "2026-09-15", devir: "satir" });
  esit("POS satır satır devir: her kayıt 'POS Devir', cihaz devri tarihsiz", satir.satirlar.map(s => `${s.aciklama}:${s.tarih ?? "-"}=${s.bakiye}`).join(" "), "POS Devir:-=250 POS Devir:2026-09-10=350 POS Devir:2026-09-12=320 a:2026-09-20=360");
  esit("POS iki devir düzeninde son bakiye ve toplam aynı", `${JSON.stringify(toplu.sonBakiyeler)}` === `${JSON.stringify(satir.sonBakiyeler)}`, true);
  const pgk = paraGrupKur(new Set([28]), new Set(["22"])); // POS özeti paraKod taşır (gerçekte paraGrupBilgisi kodları da verir)
  const iki = posEkstreKur([...k, { ...r("2026-09-20", 3, 0, 0), paraKod: "22", paraId: 28 }], { baslangic: "2026-09-15", devir: "toplu" });
  esit("POS özet: cihaz içinde Döviz / Kuyum başlıkları", paraBasliklariEkle(iki.sonBakiyeler, { grupla: x => pgk.grup(x), alan: "cihaz", bolumle: ["posAnahtar"] }).map(x => x._stil ? `[${x.cihaz}]` : x.paraKod).join(" "), "[Döviz] TL [Kuyum] 22");
  const yok = posEkstreKur(k, { baslangic: "2026-09-15", devir: "yok" });
  esit("POS devirsiz", yok.satirlar.map(s => `${s.borc}=${s.bakiye}`).join(" ") + `|${yok.sonBakiyeler[0].sonBakiye}`, "40=40|40");
}

// ── VADISL1
{
  esit("işlem durumu harfi", [islemDurumu(1, 1), islemDurumu(1, 0), islemDurumu(0, 1), islemDurumu(0, 0)].join(), "İK,İ,K,V");
  esit("VADISL1 sıralama → grup", ["vade", "tarih", "ad", "kod", ""].map(s => { const x = vadeliIslemDuzeni(s); return `${x.kip}:${x.gruplar[0].anahtar}:${x.gruplar[0].genelToplam}`; }).join(" "),
    "vade:paraKod:false tarih:gun:false ad:cariKod:false kod:cariKod:false vade:paraKod:false");
  const s = (satirTip: number, meblag: number) => vadeliIslemSatiri({ satirTip, meblag, tipKod: 2, vade: "2026-10-10", bugun: "2026-10-01", gun: "2026-09-30", iptal: 0, kapandi: 0, borcluKod: "B", borcluAd: "X", alacakliKod: "", alacakliAd: "" });
  const ss = [s(0, 100), s(1, 160), s(0, 20)];
  esit("VADISL1 satır: B/A, durum, kalan gün, tür", ss.map(x => `${x.tipHarf}${x.islemDurumu}${x.kalanGun}`).join() + `|${ss[0].tip}|${ss[0].alacakli}`, "BV9,AV9,BV9|Dekont (virman)|");
  esit("VADISL1 net: |120 − 160| = 40 A", netMetni(vadeliIslemDuzeni().gruplar[0].net!, ss), "Net toplam : 40,00 A");
  const t = raporTanimOku("VADISL1");
  esit("VADISL1 rapor sonu net (|Σ| + B/A)", t.net ? netMetni(t.net, ss) : "", "Genel net toplam : 40,00 A");
  esit("VADISL1 genel toplam basılmaz", genelToplamVar(t, etkinGruplar(t, vadeliIslemDuzeni("ad").gruplar)), false);
}

// ── Tanımlar: yeni parametreler ve çizim (PDF + Excel)
{
  const ad = (kod: string) => raporTanimOku(kod).parametreler.map(x => x.ad).join(",");
  esit("CARBAK1 parametreleri", ad("CARBAK1"), "baslangic,cariIdler,cariAd,paraIdler,hesapTipi,limit,listeSekli,siralama,kurTuru");
  esit("CAREKS1 parametreleri", ad("CAREKS1"), "cariIdler,cariAd,baslangic,paraIdler,hesapTipi,siralama,devir");
  esit("CARHAR1 parametreleri", ad("CARHAR1"), "baslangic,cariIdler,cariAd,vezneIdler,paraIdler,hesapTipi,hareketTipleri,siralama");
  esit("CARKRT1 parametreleri", ad("CARKRT1"), "arama,cariIdler,cariAd,siralama");
  esit("POSEKS1 parametreleri", ad("POSEKS1"), "baslangic,posKod,posAd,cariIdler,vezneIdler,paraIdler,devirSekli,devirsiz");
  esit("VADISL1 parametreleri", ad("VADISL1"), "durum,vade,baslangic,cariIdler,cariAd,vezneIdler,paraIdler,hesapTipi,siralama,iptaller");
  const t = raporTanimOku("CARBAK1");
  const kolon = (liste: string) => t.kolonlar.filter(k => kosulSaglandi(k.kosul, t, p({ listeSekli: liste }))).filter(k => k.anahtar === "borcBakiye").map(k => !!k.toplam).join();
  esit("CARBAK1 borç bakiye toplamı yalnız para bazında", `${kolon("kart")}|${kolon("para")}`, "false|true");
  // CAREKS1 iki seviyeli düzen + grup altı tablo + bilgi satırı çizilir
  const e = ekstreKur([], [{ cariKod: "C1", cariAd: "Ali", paraKod: "USD", siraNo: 1, tarih: "2026-09-02", tip: 0, meblag: 5 }],
    [{ cariKod: "C1", cariAd: "Ali", paraKod: "USD", siraNo: 1, tarih: "2026-09-03", dekontTip: 1, meblag: 2 }], { baslangic: "2026-09-01" });
  const girdi = { tanim: raporTanimOku("CAREKS1"), satirlar: e.satirlar, filtreOzeti: "test", firma: { ad: "F", vkn: "1" }, kullanici: "test", grupAltSatirlar: e.grupAltSatirlar, ozetSatirlar: e.paraToplamlari };
  esit("CAREKS1 PDF", (await raporPdf(girdi)).subarray(0, 5).toString(), "%PDF-");
  esit("CAREKS1 Excel", (await raporExcel(girdi)).subarray(0, 2).toString(), "PK");
}

console.log(hata ? `\n${hata} HATA` : "\nCARİ TESTLERİ GEÇTİ");
process.exit(hata ? 1 : 0);
