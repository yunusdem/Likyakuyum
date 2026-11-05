/**
 * Kasa grubu raporları (HESBAK1, HESEKS1, KASDEF1, KASHAR1) saf mantık testi — veritabanı gerekmez (docs/RAPOR_ESITLEME_UYGULAMA.md bölüm 2, Kasa).
 * Hesap tipi süzgeci, liste şekli / sıralama düzeni, grup seçimi, devir seçenekleri, net satırı, gün içi eski sıra, para başlıkları; elle hesaplanmış örnekler.
 * Çalıştır: cd Backend && npx tsx scripts/rapor-test-kasa.ts   Çıktı: ../tmp/rapor-test/KASA-*.pdf / .xlsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { raporPdf, raporTanimOku, netMetni, bolumlereAyir, etkinGruplar, genelToplamVar } from "../src/services/rapor/raporMotor.js";
import { raporExcel } from "../src/services/rapor/raporExcel.js";
import { kosulSaglandi, RaporService } from "../src/services/rapor/rapor.service.js";
import { paraBasliklariEkle, paraGrubunaGoreSirala, paraGrupKur } from "../src/services/rapor/paraGrup.js";
import { PARA_GRUBU_SEVIYESI, paraGrubunaDiz, hesapIciParaBasliklari, gunIciEskiSira, hesapBakiyeDuzeni, hesapEkstresiKur, hesapTipiUygun, hesbakGruplari, heseksGruplari, kasaNakitSatirlari, type EkstreNakit, type EkstreSecenek } from "../src/services/rapor/veri/kasa.js";

let hata = 0, gecen = 0;
const esit = (ad: string, a: unknown, b: unknown) => { if (a !== b) { hata++; console.error(`✗ ${ad}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); } else { gecen++; console.log(`✓ ${ad}`); } };
const firma = { ad: "ÖRNEK FİRMA", vkn: "1234567890" };
const dir = path.resolve("../tmp/rapor-test"); mkdirSync(dir, { recursive: true });
const excelIlkSutun = async (xlsx: Buffer, sayfa = 0) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx as any); const s: string[] = []; wb.worksheets[sayfa].eachRow(r => s.push(String(r.getCell(1).value ?? ""))); return { ilk: s, tum: JSON.stringify(wb.worksheets[sayfa].getSheetValues()) }; };

// ───────────────────────── Hesap tipi süzgeci (Borç = TIP 1 çıkış, Alacak = TIP 0 giriş)
esit("hesap tipi: hepsi", `${hesapTipiUygun(0, "hepsi")}|${hesapTipiUygun(1, "hepsi")}|${hesapTipiUygun(1, "")}`, "true|true|true");
esit("hesap tipi: borç yalnız TIP 1", `${hesapTipiUygun(1, "borc")}|${hesapTipiUygun(0, "borc")}`, "true|false");
esit("hesap tipi: alacak yalnız TIP 0", `${hesapTipiUygun(0, "alacak")}|${hesapTipiUygun(1, "alacak")}`, "true|false");

// ───────────────────────── HESBAK1: liste şekli + sıralama
{
  // Sorgudan gelen sıra: hesap kodu → para sıra no; sentetik KDV satırı sonda
  const ham = [
    { hesapId: 1, hesapKod: "001", hesapAd: "ZEYNEP", paraId: 1, paraKod: "TL", siraNo: 0 },
    { hesapId: 1, hesapKod: "001", hesapAd: "ZEYNEP", paraId: 3, paraKod: "EUR", siraNo: 2 },
    { hesapId: 2, hesapKod: "002", hesapAd: "ÇAĞLA", paraId: 1, paraKod: "TL", siraNo: 0 },
    { hesapId: 2, hesapKod: "002", hesapAd: "ÇAĞLA", paraId: 2, paraKod: "USD", siraNo: 1 },
    { hesapId: 3, hesapKod: "003", hesapAd: "CAN", paraId: null, paraKod: "-", siraNo: 99 },
    { hesapId: 4, hesapKod: "004", hesapAd: "DENİZ", paraId: 1, paraKod: "TL", siraNo: 0 },
    { hesapId: 0, hesapKod: "KDV", hesapAd: "KDV", paraId: 1, paraKod: "TL", siraNo: 0 },
  ];
  const yaz = (o: { listeSekli: string; siralama: string }) => hesapBakiyeDuzeni(ham, o).map(s => `${s.hesapKod}:${s.paraKod}`).join(" ");
  esit("HESBAK1 hesap bazında / kod: sorgu sırası aynen", yaz({ listeSekli: "hesap", siralama: "kod" }), "001:TL 001:EUR 002:TL 002:USD 003:- 004:TL KDV:TL");
  esit("HESBAK1 hesap bazında / ad: CAN, ÇAĞLA, DENİZ, ZEYNEP; KDV sonda", yaz({ listeSekli: "hesap", siralama: "ad" }), "003:- 002:TL 002:USD 004:TL 001:TL 001:EUR KDV:TL");
  esit("HESBAK1 para bazında / kod: para sırası, içinde kod; parasız hesap sonda", yaz({ listeSekli: "para", siralama: "kod" }), "001:TL 002:TL 004:TL KDV:TL 002:USD 001:EUR 003:-");
  esit("HESBAK1 para bazında / ad", yaz({ listeSekli: "para", siralama: "ad" }), "002:TL 004:TL 001:TL KDV:TL 002:USD 001:EUR 003:-");
  esit("HESBAK1 düzen satır eklemez / çıkarmaz", hesapBakiyeDuzeni(ham, { listeSekli: "para", siralama: "ad" }).length, ham.length);

  const gh = hesbakGruplari("hesap"), gp = hesbakGruplari("para");
  esit("HESBAK1 grup: hesap bazında", `${gh.length}|${gh[0].anahtar}|${gh[0].toplamEtiketi}|${gh[0].net ? "net" : "net yok"}`, "1|hesapBaslik|Toplam|net yok");
  esit("HESBAK1 grup: para bazında (Döviz / Kuyum dış grubu + net satırlı para grubu)", `${gp.length}|${gp[0].anahtar}:${gp[0].altToplam}|${gp[1].anahtar}|${gp[1].toplamEtiketi}|${gp[1].net?.arti}-${gp[1].net?.eksi}|${gp[1].genelToplam}`,
    "2|paraGrupAd:false|paraKod|Toplam|borcBakiye-alacakBakiye|false");
  esit("HESBAK1 grup: bilinmeyen değer hesap bazına düşer", hesbakGruplari("xyz")[0].anahtar, "hesapBaslik");
  // Para bazında net: TL grubunda borç bakiye 10 + 0, alacak bakiye 0 + 85.404 → |10 − 85.404| = 85.394 A
  esit("HESBAK1 para grubu net satırı (alacak fazlası)", netMetni(gp[1].net!, [{ borcBakiye: 10, alacakBakiye: 0 }, { borcBakiye: 0, alacakBakiye: 85404 }]), "Bakiye : 85.394,00 A");
  esit("HESBAK1 para grubu net satırı (borç fazlası)", netMetni(gp[1].net!, [{ borcBakiye: 250.5, alacakBakiye: 0 }, { borcBakiye: 0, alacakBakiye: 50 }]), "Bakiye : 200,50 B");

  const t = raporTanimOku("HESBAK1");
  const kolon = (a: string) => t.kolonlar.find(k => k.anahtar === a)!;
  esit("HESBAK1 tanım: Kod ve Ad PDF'te basılı", `${kolon("hesapKod").pdf !== false}|${kolon("hesapAd").pdf !== false}`, "true|true");
  esit("HESBAK1 tanım: borç / alacak bakiye toplanır", `${kolon("borcBakiye").toplam}|${kolon("alacakBakiye").toplam}|${kolon("tlKarsiligi").toplam}`, "true|true|true");
  esit("HESBAK1 tanım: varsayılan grup = hesap bazında grup", JSON.stringify(t.grup), JSON.stringify(gh[0]));
  esit("HESBAK1 tanım: yeni parametreler", ["listeSekli", "siralama", "hesapAd"].map(a => { const p = t.parametreler.find(x => x.ad === a); return `${p?.tip}:${p?.varsayilan ?? ""}`; }).join(" "), "secim:hesap secim:kod metinAralik:");
  esit("HESBAK1 tanım: eski parametreler duruyor", ["baslangic", "hesapIdler", "paraIdler", "kurTuru"].every(a => t.parametreler.some(x => x.ad === a)), true);
  esit("HESBAK1 ek parametre adları", RaporService.ekParametreAdlari("HESBAK1").join(), "hesapAdIlk,hesapAdSon,listeSekli,siralama");
}

// ───────────────────────── HESEKS1: devir, hesap tipi, sıralama, gruplar (elle hesaplanmış örnek)
const tl = { id: 1, kod: "TL" };
const hareket = (hesapKod: string, hesapAd: string, paraId: number, paraKod: string, tarih: string, tip: number, meblag: number, kdv: number, aciklama: string, onceki: number, hareketId: number) =>
  kasaNakitSatirlari({ hesapKod, hesapAd, paraId, paraKod, tarih, tip, meblag, kdv, aciklama, onceki, hareketId, vezneKod: "01", kaydeden: "Ofis", miktar: 0, hasTutari: 0, hasKuru: 0 }, tl)
    .map(n => ({ ...n, grupSira: n.kdvSatiri ? 0 : paraKod === "TL" ? 0 : 1 })) as EkstreNakit[];
// Hesap kodu → tarih sırası (sorgunun "Kod" / "Ad" sırası). Dönem: 01.10.2026 – 31.10.2026
const kodSirali: EkstreNakit[] = [
  ...hareket("001", "KİRA", 1, "TL", "2026-09-10", 1, 1000, 0, "Eylül kirası", 1, 1),      // dönem öncesi borç 1.000
  ...hareket("001", "KİRA", 1, "TL", "2026-09-20", 0, 400, 0, "İade", 1, 2),               // dönem öncesi alacak 400
  ...hareket("001", "KİRA", 1, "TL", "2026-10-02", 1, 500, 0, "Ekim kirası", 0, 3),        // borç 500
  ...hareket("001", "KİRA", 2, "USD", "2026-10-03", 0, 100, 20, "Komisyon", 0, 4),         // USD alacak 100 + TL KDV alacak 20
  ...hareket("001", "KİRA", 1, "TL", "2026-10-05", 0, 2000, 0, "Tahsilat", 0, 6),          // alacak 2.000
  ...hareket("002", "ABONE", 1, "TL", "2026-10-04", 1, 300, 0, "Abonelik", 0, 5),          // borç 300
];
const tarihSirali = [...kodSirali].sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)) || a.hareketId - b.hareketId);
const sec = (o: Partial<EkstreSecenek> = {}): EkstreSecenek => ({ siralama: "kod", hesapTipi: "hepsi", devirGizle: false, devirAyrinti: false, baslangic: "2026-10-01", bitis: "2026-10-31", ...o });
const satirMetni = (ss: Record<string, any>[]) => ss.map(s => `${s.grupAnahtar}:${s.devirSatiri ? "D" : s.hareketId}${s.kdvSatiri ? "k" : ""}=${s.borc}/${s.alacak}→${s.bakiye}${s.bakiyeTipi}`).join(" ");
const kapanisMetni = (ks: Record<string, any>[]) => ks.map(k => `${k.hesap}|${k.paraKod}=${k.borc}/${k.alacak}→${k.bakiye}${k.bakiyeTipi}`).join(" ");
{
  const v = hesapEkstresiKur(kodSirali, sec());
  // 001|TL: devir 1.000 / 400 → 600 B; +500 → 1.100 B; KDV −20 → 1.080 B; −2.000 → 920 A. 001|USD: devir 0; −100 → 100 A. 002|TL: devir 0; +300 → 300 B
  esit("HESEKS1 varsayılan: devir satırı + yürüyen bakiye", satirMetni(v.satirlar),
    "001|TL:D=1000/400→600B 001|TL:3=500/0→1100B 001|TL:4k=0/20→1080B 001|TL:6=0/2000→920A 001|USD:D=0/0→0 001|USD:4=0/100→100A 002|TL:D=0/0→0 002|TL:5=300/0→300B");
  esit("HESEKS1 varsayılan: kapanış hesap × para", kapanisMetni(v.kapanis), "001 — KİRA|TL=1500/2420→920A 001 — KİRA|USD=0/100→100A 002 — ABONE|TL=300/0→300B");
  esit("HESEKS1 varsayılan: devir satırı alanları", `${v.satirlar[0].aciklama}|${v.satirlar[0].tarih}|${v.satirlar[0].giris}|${v.satirlar[0].cikis}|${v.satirlar[0].hesapBaslik}`, "01.10.2026 öncesi devir|2026-10-01|400|1000|001 — KİRA");
  esit("HESEKS1 varsayılan: giriş = alacak, çıkış = borç", v.satirlar.filter(s => !s.devirSatiri).every(s => s.giris === s.alacak && s.cikis === s.borc), true);
  esit("HESEKS1 varsayılan: dönem alanı yok, yardımcı alan sızmaz", `${"donem" in v.satirlar[1]}|${"grupSira" in v.satirlar[1]}`, "false|false");

  const b = hesapEkstresiKur(kodSirali, sec({ hesapTipi: "borc" }));
  // Yalnız borç (TIP 1) satırları: 001|TL devir 1.000 → 1.000 B; +500 → 1.500 B. 001|USD hiç yok. 002|TL 300 B
  esit("HESEKS1 hesap tipi borç", satirMetni(b.satirlar), "001|TL:D=1000/0→1000B 001|TL:3=500/0→1500B 002|TL:D=0/0→0 002|TL:5=300/0→300B");
  esit("HESEKS1 hesap tipi borç: kapanış", kapanisMetni(b.kapanis), "001 — KİRA|TL=1500/0→1500B 002 — ABONE|TL=300/0→300B");
  const a = hesapEkstresiKur(kodSirali, sec({ hesapTipi: "alacak" }));
  // Yalnız alacak (TIP 0): 001|TL devir 400 → 400 A; KDV 20 → 420 A; 2.000 → 2.420 A. 001|USD 100 A. 002 hiç yok
  esit("HESEKS1 hesap tipi alacak", satirMetni(a.satirlar), "001|TL:D=0/400→400A 001|TL:4k=0/20→420A 001|TL:6=0/2000→2420A 001|USD:D=0/0→0 001|USD:4=0/100→100A");
  esit("HESEKS1 borç + alacak kapanışı = hepsi", `${b.kapanis[0].borc}|${a.kapanis[0].alacak}`, `${v.kapanis[0].borc}|${v.kapanis[0].alacak}`);

  const g = hesapEkstresiKur(kodSirali, sec({ devirGizle: true }));
  // Devir görünmesin: dönem öncesi hiç girmez; 001|TL: 500 B → 480 B → 1.520 A
  esit("HESEKS1 devir görünmesin", satirMetni(g.satirlar), "001|TL:3=500/0→500B 001|TL:4k=0/20→480B 001|TL:6=0/2000→1520A 001|USD:4=0/100→100A 002|TL:5=300/0→300B");
  esit("HESEKS1 devir görünmesin: kapanış dönem içi", kapanisMetni(g.kapanis), "001 — KİRA|TL=500/2020→1520A 001 — KİRA|USD=0/100→100A 002 — ABONE|TL=300/0→300B");

  const d = hesapEkstresiKur(kodSirali, sec({ devirAyrinti: true }));
  // Dönem öncesi satır satır: 1.000 B → 600 B (dönem 0), sonra 1.100 B → 1.080 B → 920 A (dönem 1); devir satırı yok
  esit("HESEKS1 dönem öncesi satır satır", d.satirlar.map(s => `${s.grupAnahtar}:${s.hareketId}${s.kdvSatiri ? "k" : ""}@${s.donem}=${s.borc}/${s.alacak}→${s.bakiye}${s.bakiyeTipi}`).join(" "),
    "001|TL:1@0=1000/0→1000B 001|TL:2@0=0/400→600B 001|TL:3@1=500/0→1100B 001|TL:4k@1=0/20→1080B 001|TL:6@1=0/2000→920A 001|USD:4@1=0/100→100A 002|TL:5@1=300/0→300B");
  esit("HESEKS1 dönem öncesi satır satır: dönem başlık / toplam etiketi", `${d.satirlar[0].donemBaslik}|${d.satirlar[0].donemToplam}|${d.satirlar[2].donemBaslik}|${d.satirlar[2].donemToplam}`, "01.10.2026 öncesi|Devir|01.10.2026 – 31.10.2026|Dönem toplamı");
  esit("HESEKS1 dönem öncesi satır satır: devir satırı yok, kapanış aynı", `${d.satirlar.some(s => s.devirSatiri)}|${kapanisMetni(d.kapanis) === kapanisMetni(v.kapanis)}`, "false|true");
  // Para ara toplamı iki gösterimde de aynı (brüt devir): 001|TL borç 1.500, alacak 2.420
  const araToplam = (ss: Record<string, any>[]) => { const x = ss.filter(s => s.grupAnahtar === "001|TL"); return `${x.reduce((t, s) => t + s.borc, 0)}/${x.reduce((t, s) => t + s.alacak, 0)}`; };
  esit("HESEKS1 ara toplam: tek devir satırı = satır satır", `${araToplam(v.satirlar)}|${araToplam(d.satirlar)}`, "1500/2420|1500/2420");
  esit("HESEKS1 devir görünmesin + satır satır: devir görünmesin geçerli", satirMetni(hesapEkstresiKur(kodSirali, sec({ devirGizle: true, devirAyrinti: true })).satirlar), satirMetni(g.satirlar));

  const tr = hesapEkstresiKur(tarihSirali, sec({ siralama: "tarih" }));
  // Tarih sırası: hesap grubu yok, para içinde tarih. TL: devir 1.000 / 400 → 600 B; 3 → 1.100 B; 4k → 1.080 B; 5 (002) → 1.380 B; 6 → 620 A. USD: 100 A
  esit("HESEKS1 tarih sırası: para içinde tarih, hesaplar karışık", satirMetni(tr.satirlar), "TL:D=1000/400→600B TL:3=500/0→1100B TL:4k=0/20→1080B TL:5=300/0→1380B TL:6=0/2000→620A USD:D=0/0→0 USD:4=0/100→100A");
  esit("HESEKS1 tarih sırası: satır kendi hesabını taşır, devirde hesap boş", `${tr.satirlar[3].hesapKod}|${tr.satirlar[3].hesapAd}|${tr.satirlar[0].hesapKod}|${tr.satirlar[0].grupBaslik}`, "002|ABONE||Para birimi: TL");
  esit("HESEKS1 tarih sırası: kapanış yine hesap × para", kapanisMetni(tr.kapanis), kapanisMetni(v.kapanis));

  const ad = hesapEkstresiKur(kodSirali, sec({ siralama: "ad" }));
  esit("HESEKS1 ad sırası: ABONE (002) önce, KİRA (001) sonra", [...new Set(ad.satirlar.map(s => s.grupAnahtar))].join(" "), "002|TL 001|TL 001|USD");
  esit("HESEKS1 ad sırası: kapanış da ada göre", ad.kapanis.map(k => k.hesap).join(" / "), "002 — ABONE / 001 — KİRA / 001 — KİRA");
  esit("HESEKS1 ad sırası: hesap grubu ardışık", ad.satirlar.map(s => s.hesapBaslik).filter((x, i, l) => x !== l[i - 1]).length, 2);

  // Gruplar
  const gs = (o: Partial<EkstreSecenek>) => heseksGruplari(sec(o)).map(x => x.anahtar).join(">");
  esit("HESEKS1 gruplar: kod / ad → hesap > para", `${gs({})}|${gs({ siralama: "ad" })}`, "hesapBaslik>grupAnahtar|hesapBaslik>grupAnahtar");
  esit("HESEKS1 gruplar: tarih → Döviz / Kuyum > para", gs({ siralama: "tarih" }), "paraGrupAd>grupAnahtar");
  esit("HESEKS1 gruplar: satır satır → dönem seviyesi eklenir", `${gs({ devirAyrinti: true })}|${gs({ siralama: "tarih", devirAyrinti: true }).replace("paraGrupAd>", "")}|${gs({ devirAyrinti: true, devirGizle: true })}`, "hesapBaslik>grupAnahtar>donem|grupAnahtar>donem|hesapBaslik>grupAnahtar");
  const hg = heseksGruplari(sec());
  esit("HESEKS1 gruplar: hesap seviyesinde ara toplam yok, parada var, genel toplam yok", `${hg[0].altToplam}|${hg[1].altToplam}|${hg.every(x => x.genelToplam === false)}`, "false|true|true");
  const t = raporTanimOku("HESEKS1");
  esit("HESEKS1 tanım: gruplar = varsayılan grup seçimi", JSON.stringify(t.gruplar), JSON.stringify(hg));
  esit("HESEKS1 tanım: genel toplam basılmaz", genelToplamVar(t, etkinGruplar(t)), false);
  esit("HESEKS1 tanım: hesap seçimi zorunlu değil", t.parametreler.find(x => x.ad === "hesapIdler")?.zorunlu ?? false, false);
  esit("HESEKS1 tanım: yeni parametreler", ["hesapTipi", "siralama", "devirGizle", "devirAyrinti", "hesapAd"].map(a => { const p = t.parametreler.find(x => x.ad === a); return `${p?.tip}:${p?.varsayilan ?? ""}`; }).join(" "), "secim:hepsi secim:kod onay: onay: metinAralik:");
  esit("HESEKS1 ek parametre adları", RaporService.ekParametreAdlari("HESEKS1").join(), "hesapAdIlk,hesapAdSon,hesapTipi,siralama,devirGizle,devirAyrinti");
  const hesapKolonu = t.kolonlar.find(k => k.anahtar === "hesapKod")!, hesapAdKolonu = t.kolonlar.find(k => k.anahtar === "hesapAd")!;
  esit("HESEKS1 tanım: hesap kolonları yalnız tarih sırasında", `${kosulSaglandi(hesapKolonu.kosul, t, {})}|${kosulSaglandi(hesapKolonu.kosul, t, { siralama: "tarih" })}|${kosulSaglandi(hesapAdKolonu.kosul, t, { siralama: "ad" })}|${kosulSaglandi(hesapAdKolonu.kosul, t, { ek: { siralama: "tarih" } })}`, "false|true|false|true");
  esit("HESEKS1 tanım: eski kolonlar duruyor", ["tarih", "aciklama", "vezneKod", "miktar", "hasKuru", "hasTutari", "borc", "alacak", "bakiye", "bakiyeTipi", "giris", "cikis", "kdv", "kaydeden"].every(a => t.kolonlar.some(k => k.anahtar === a)), true);

  // Kapanış özeti: para başlıkları (K11) — yalnız başlık, toplam değişmez
  const pg = paraGrupKur(new Set([9]), new Set(["HAS"]));
  const kap = [...v.kapanis, { hesap: "003 — İŞÇİLİK", paraKod: "HAS", borc: 5, alacak: 0, bakiye: 5, bakiyeTipi: "B" }];
  const baslikli = paraBasliklariEkle(kap, { grupla: s => pg.grup({ paraKod: s.paraKod }), alan: "hesap" });
  esit("HESEKS1 kapanış: Döviz / Kuyum başlıkları", baslikli.map(s => (s._stil ? `[${s.hesap}]` : `${s.hesap.slice(0, 3)}:${s.paraKod}`)).join(" "), "[Döviz] 001:TL 001:USD 002:TL [Kuyum] 003:HAS");
  esit("HESEKS1 kapanış: başlıklar toplamı değiştirmez", baslikli.reduce((x, s) => x + (Number(s.borc) || 0), 0), kap.reduce((x, s) => x + s.borc, 0));

  // Çizim: iki seviye (hesap > para) ve üç seviye (dönem) PDF / Excel
  const girdi = { tanim: t, satirlar: v.satirlar, filtreOzeti: "kasa testi", firma, kullanici: "test", ozetSatirlar: baslikli, gruplar: heseksGruplari(sec()) };
  const pdf = await raporPdf(girdi); writeFileSync(path.join(dir, "KASA-HESEKS1.pdf"), pdf);
  esit("HESEKS1 PDF üretildi", pdf.subarray(0, 5).toString(), "%PDF-");
  const x1 = await excelIlkSutun(await raporExcel(girdi));
  esit("HESEKS1 Excel: 2 hesap başlığı, 3 para başlığı", `${x1.ilk.filter(s => /^00\d — /.test(s)).length}|${x1.ilk.filter(s => /^ {3}Para birimi: /.test(s)).length}`, "2|3");
  esit("HESEKS1 Excel: para ara toplamı var, genel toplam yok", `${(x1.tum.match(/Ara toplam \(/g) || []).length}|${/GENEL TOPLAM/.test(x1.tum)}`, "3|false");
  const girdi3 = { ...girdi, satirlar: d.satirlar, gruplar: heseksGruplari(sec({ devirAyrinti: true })) };
  const pdf3 = await raporPdf(girdi3); writeFileSync(path.join(dir, "KASA-HESEKS1-satir-satir.pdf"), pdf3);
  const x3 = await excelIlkSutun(await raporExcel(girdi3));
  esit("HESEKS1 Excel (satır satır): dönem başlıkları ve Devir toplamı", `${x3.ilk.filter(s => /^ {6}01\.10\.2026 öncesi$/.test(s)).length}|${(x3.tum.match(/Devir \(2\)/g) || []).length}|${(x3.tum.match(/Dönem toplamı \(/g) || []).length}`, "1|1|3");
  // Tarih sırası: para grupları Döviz / Kuyum dış grubunda; sıra ve rakamlar değişmez
  const trPg = paraGrubunaDiz(tr.satirlar, s => pg.grup({ paraKod: s.paraKod }));
  esit("HESEKS1 tarih: paraGrupAd yazılır, sıra ve rakam değişmez", `${trPg.map(s => s.paraGrupAd).join()}|${satirMetni(trPg) === satirMetni(tr.satirlar)}`, "Döviz,Döviz,Döviz,Döviz,Döviz,Döviz,Döviz|true");
  const trKuyum = paraGrubunaDiz(tr.satirlar, s => (s.paraKod === "TL" ? "doviz" : "kuyum"));
  esit("HESEKS1 tarih: Kuyum parası Döviz'den sonra", trKuyum.map(s => `${s.paraGrupAd}:${s.paraKod}`).filter((x, i, l) => x !== l[i - 1]).join(" "), "Döviz:TL Kuyum:USD");
  const girdiT = { ...girdi, satirlar: trKuyum, gruplar: heseksGruplari(sec({ siralama: "tarih" })) };
  const xt = await excelIlkSutun(await raporExcel(girdiT)); writeFileSync(path.join(dir, "KASA-HESEKS1-tarih.pdf"), await raporPdf(girdiT));
  esit("HESEKS1 Excel (tarih): hesap başlığı yok, Döviz / Kuyum başlığı, 2 para başlığı", `${xt.ilk.filter(s => /^00\d — /.test(s)).length}|${xt.ilk.filter(s => s === "Döviz" || s === "Kuyum").join(",")}|${xt.ilk.filter(s => /^ {3}Para birimi: /.test(s)).length}`, "0|Döviz,Kuyum|2");
}

// ───────────────────────── KASHAR1: gün içi eski sıra + net satırları
{
  const gun = (v: any) => String(v).slice(0, 10);
  const ham = [
    { id: 1, tarih: "2026-10-01T09:00", paraId: 3, tip: 0 }, { id: 2, tarih: "2026-10-01T10:00", paraId: 1, tip: 0 }, { id: 3, tarih: "2026-10-01T11:00", paraId: 1, tip: 1 },
    { id: 4, tarih: "2026-10-02T08:00", paraId: 2, tip: 1 }, { id: 5, tarih: "2026-10-01T12:00", paraId: 1, tip: 1 }, { id: 6, tarih: "2026-10-02T09:00", paraId: 1, tip: 0 },
  ];
  // 01.10: para 1 → tip 1 (3, 5), tip 0 (2); para 3 → 1. 02.10: para 1 → 6; para 2 → 4
  esit("KASHAR1 gün içi eski sıra: gün → para → tip azalan → geliş sırası", gunIciEskiSira(ham, gun).map(x => x.id).join(), "3,5,2,1,6,4");
  esit("KASHAR1 gün içi eski sıra: satır sayısı ve girdi değişmez", `${gunIciEskiSira(ham, gun).length}|${ham.map(x => x.id).join()}`, "6|1,2,3,4,5,6");

  const t = raporTanimOku("KASHAR1");
  esit("KASHAR1 tanım: sıralama seçenekleri (bizimkiler + eski gün içi sıra)", t.parametreler.find(p => p.ad === "siralama")!.secenekler!.map(s => s.deger).join(), "tarih,hesap,para,gunpara");
  esit("KASHAR1 tanım: varsayılan sıralama değişmedi", t.parametreler.find(p => p.ad === "siralama")!.varsayilan, "tarih");
  esit("KASHAR1 tanım: grup ve rapor sonu net satırı (giriş − çıkış)", `${t.grup?.net?.arti}-${t.grup?.net?.eksi}:${t.grup?.net?.etiket}|${t.net?.arti}-${t.net?.eksi}:${t.net?.etiket}`, "giris-cikis:Net|giris-cikis:Genel net");
  // Gün: giriş 97.000 + 0, çıkış 11.596 + 10 → |97.000 − 11.606| = 85.394 B (giriş fazlası B, çıkış fazlası A)
  const gunSatirlari = [{ giris: 97000, cikis: 0 }, { giris: 0, cikis: 11596 }, { giris: 0, cikis: 10 }];
  esit("KASHAR1 ara toplam net: giriş fazlası B", netMetni(t.grup!.net!, gunSatirlari), "Net : 85.394,00 B");
  esit("KASHAR1 ara toplam net: çıkış fazlası A", netMetni(t.grup!.net!, [{ giris: 100, cikis: 0 }, { giris: 0, cikis: 350.25 }]), "Net : 250,25 A");
  esit("KASHAR1 genel net: sıfırda harf yok", netMetni(t.net!, [{ giris: 40, cikis: 0 }, { giris: 0, cikis: 40 }]), "Genel net : 0,00");
  esit("KASHAR1 tanım: toplam kolonları ve özet duruyor", `${["giris", "cikis", "net", "kdv"].every(a => t.kolonlar.find(k => k.anahtar === a)?.toplam)}|${t.ozet?.baslik}`, "true|Para bazında net toplam");

  const satirlar = [0, 1, 2, 3].map(i => ({ grupAnahtar: i < 2 ? "01.10.2026" : "02.10.2026", grupBaslik: i < 2 ? "01.10.2026" : "02.10.2026", tarih: `2026-10-0${i < 2 ? 1 : 2}T10:00:00Z`, hesapKod: "001", hesapAd: "KİRA", aciklama: `Hareket ${i}`,
    vezneKod: "01", paraKod: "TL", meblag: 100 * (i + 1), ba: i % 2 ? "A" : "B", giris: i % 2 ? 0 : 100 * (i + 1), cikis: i % 2 ? 100 * (i + 1) : 0, net: (i % 2 ? -1 : 1) * 100 * (i + 1) }));
  const pg = paraGrupKur(new Set([9]), new Set(["HAS"]));
  const ozet = paraBasliklariEkle([{ paraKod: "HAS", giris: 5, cikis: 0, netToplam: 5, netTipi: "B" }, { paraKod: "TL", giris: 400, cikis: 600, netToplam: 200, netTipi: "A" }], { grupla: s => pg.grup(s), alan: "paraKod" });
  esit("KASHAR1 özet: Döviz önce, Kuyum sonra; başlık satırlı", ozet.map(s => (s._stil ? `[${s.paraKod}]` : s.paraKod)).join(" "), "[Döviz] TL [Kuyum] HAS");
  const girdi = { tanim: t, satirlar, filtreOzeti: "kasa testi", firma, kullanici: "test", ozetSatirlar: ozet };
  writeFileSync(path.join(dir, "KASA-KASHAR1.pdf"), await raporPdf(girdi));
  const x = await excelIlkSutun(await raporExcel(girdi));
  // 01.10: 100 − 200 → 100 A; 02.10: 300 − 400 → 100 A; genel: 400 − 600 → 200 A
  // "Para" sıralaması: Döviz / Kuyum dış grubu (para grupları içinde), genel toplam ve genel net kalır
  const paraSatir = (paraKod: string, i: number) => ({ ...satirlar[i], paraKod, grupAnahtar: `Para birimi: ${paraKod}`, grupBaslik: `Para birimi: ${paraKod}` });
  const paraKip = paraGrubunaDiz([paraSatir("TL", 0), paraSatir("TL", 1), paraSatir("HAS", 2), paraSatir("USD", 3)], s => pg.grup(s));
  esit("KASHAR1 para sıralaması: Döviz → Kuyum", paraKip.map(s => `${s.paraGrupAd}:${s.paraKod}`).join(" "), "Döviz:TL Döviz:TL Döviz:USD Kuyum:HAS");
  const xp = await excelIlkSutun(await raporExcel({ ...girdi, satirlar: paraKip, gruplar: [PARA_GRUBU_SEVIYESI, t.grup!] }));
  writeFileSync(path.join(dir, "KASA-KASHAR1-para.pdf"), await raporPdf({ ...girdi, satirlar: paraKip, gruplar: [PARA_GRUBU_SEVIYESI, t.grup!] }));
  // TL: 100 − 200 → 100 A; USD: −400 → 400 A; HAS: 300 → 300 B; genel: 400 − 600 → 200 A
  esit("KASHAR1 Excel (para): Döviz / Kuyum başlıkları, para netleri, genel net", `${xp.ilk.filter(s => s === "Döviz" || s === "Kuyum").join(",")}|${xp.ilk.filter(s => /^(Net|Genel net) : /.test(s)).join(" | ")}|${/GENEL TOPLAM \(4 kayıt\)/.test(xp.tum)}`,
    "Döviz,Kuyum|Net : 100,00 A | Net : 400,00 A | Net : 300,00 B | Genel net : 200,00 A|true");
  esit("KASHAR1 Excel: gün net satırları ve genel net", x.ilk.filter(s => /^(Net|Genel net) : /.test(s)).join(" | "), "Net : 100,00 A | Net : 100,00 A | Genel net : 200,00 A");
}

// ───────────────────────── KASDEF1: para grubu bölümü (ana tablo) + kapanış başlıkları
{
  const t = raporTanimOku("KASDEF1");
  esit("KASDEF1 tanım: para grubu bölümü (her zaman başlık, bölüm toplamı yok)", JSON.stringify(t.bolum), JSON.stringify({ anahtar: "paraGrupAd", baslik: "{{paraGrupAd}}", altToplam: false, herZaman: true }));
  esit("KASDEF1 tanım: grup para, genel toplam yok, özet duruyor", `${t.grup?.anahtar}|${t.grup?.genelToplam}|${t.ozet?.baslik}|${t.ozet?.kolonlar.map(k => k.anahtar).join()}`, "paraKod|false|Kapanış — para bazında|paraKod,giris,cikis,devredenGiris,devredenCikis,toplam");
  const pg = paraGrupKur(new Set([5, 6]), new Set(["22", "HAS"]));
  // Sıra numarasına göre gelen para grupları: TL, 22, USD, HAS → Döviz (TL, USD), Kuyum (22, HAS); kendi içinde sıra korunur
  const gruplar = [{ paraId: 1, paraKod: "TL" }, { paraId: 5, paraKod: "22" }, { paraId: 2, paraKod: "USD" }, { paraId: 6, paraKod: "HAS" }];
  const sirali = paraGrubunaGoreSirala(gruplar, g => pg.grup(g));
  esit("KASDEF1 para grupları: Döviz → Kuyum", sirali.map(g => `${g.paraGrupAd}:${g.paraKod}`).join(" "), "Döviz:TL Döviz:USD Kuyum:22 Kuyum:HAS");
  const satirlar = sirali.flatMap(g => [0, 1].map(i => ({ paraKod: g.paraKod, paraGrupAd: g.paraGrupAd, grupBaslik: `Para birimi: ${g.paraKod}`, tarih: "2026-10-01", hesapKod: i ? "001" : "Devir", hesapAd: "", aciklama: `Satır ${i}`, giris: 100 + i, cikis: i * 10, bakiye: 100 + i - i * 10 })));
  esit("KASDEF1 bölümler: Döviz ve Kuyum başlığı", bolumlereAyir(t, satirlar).map(b => `${b.baslik}:${b.satirlar.length}`).join(" "), "Döviz:4 Kuyum:4");
  esit("KASDEF1 bölümler: yalnız döviz varken de başlık", bolumlereAyir(t, satirlar.slice(0, 4)).map(b => `${b.baslik}:${b.satirlar.length}`).join(" "), "Döviz:4");
  const kapanis = sirali.map(g => ({ paraKod: g.paraKod, giris: 201, cikis: 10, devredenGiris: 0, devredenCikis: 191, toplam: 201 }));
  const ozet = paraBasliklariEkle(kapanis, { grupla: s => pg.grup(s), alan: "paraKod" });
  esit("KASDEF1 kapanış: başlıklar, sıra ve toplam aynı", `${ozet.map(s => (s._stil ? `[${s.paraKod}]` : s.paraKod)).join(" ")}|${ozet.reduce((x, s) => x + (Number(s.toplam) || 0), 0)}`, "[Döviz] TL USD [Kuyum] 22 HAS|804");
  const girdi = { tanim: t, satirlar, filtreOzeti: "kasa testi", firma, kullanici: "test", ozetSatirlar: ozet };
  writeFileSync(path.join(dir, "KASA-KASDEF1.pdf"), await raporPdf(girdi));
  const x = await excelIlkSutun(await raporExcel(girdi));
  esit("KASDEF1 Excel: 2 bölüm başlığı, 4 para grubu, bölüm toplamı yok", `${x.ilk.filter(s => s === "Döviz" || s === "Kuyum").length}|${x.ilk.filter(s => /^Para birimi: /.test(s)).length}|${/(Döviz|Kuyum) toplamı/.test(x.tum)}`, "2|4|false");
}

// ───────────────────────── HESBAK1 çizimi: para bazında grup + Toplam + Bakiye net satırı
{
  const t = raporTanimOku("HESBAK1");
  const satir = (hesapKod: string, hesapAd: string, paraKod: string, bakiye: number) => ({ hesapKod, hesapAd, hesapBaslik: `${hesapKod} — ${hesapAd}`, paraId: 1, paraKod, giris: Math.max(bakiye, 0), cikis: Math.max(-bakiye, 0), bakiye,
    borcBakiye: bakiye < 0 ? -bakiye : 0, alacakBakiye: bakiye > 0 ? bakiye : 0, kur: 1, tlKarsiligi: bakiye, kurSatis: 1, tlSatis: bakiye });
  const satirlar = [satir("001", "KİRA", "TL", 79300), satir("002", "ABONE", "TL", -1500), satir("001", "KİRA", "EUR", -10)];
  const pgH = paraGrupKur(new Set([9]), new Set(["HAS"]));
  const paraSirali = [satirlar[0], satirlar[1], satirlar[2], { ...satir("003", "ALTIN", "HAS", -5), paraId: 9 }, { ...satir("004", "BOŞ", "-", 0), paraId: null }];
  const dizili = paraGrubunaDiz(paraSirali, s => pgH.grup(s));
  esit("HESBAK1 para bazında: Döviz → Kuyum, parasız satır sonda (önceki grupta)", dizili.map(s => `${s.paraGrupAd}:${s.hesapKod}/${s.paraKod}`).join(" "), "Döviz:001/TL Döviz:002/TL Döviz:001/EUR Kuyum:003/HAS Kuyum:004/-");
  const girdi = { tanim: t, satirlar: dizili.slice(0, 3), filtreOzeti: "kasa testi", firma, kullanici: "test", gruplar: hesbakGruplari("para") };
  writeFileSync(path.join(dir, "KASA-HESBAK1-para.pdf"), await raporPdf({ ...girdi, satirlar: dizili }));
  const x = await excelIlkSutun(await raporExcel(girdi));
  // TL: borç bakiye 1.500, alacak bakiye 79.300 → 77.800 A; EUR: borç 10 → 10 B
  esit("HESBAK1 Excel (para bazında): Döviz başlığı", x.ilk.filter(s => s === "Döviz" || s === "Kuyum").join(","), "Döviz");
  esit("HESBAK1 Excel (para bazında): para başlıkları, Toplam ve Bakiye satırları", `${x.ilk.filter(s => /^ {3}Para birimi: /.test(s)).map(s => s.trim()).join(",")}|${(x.tum.match(/Toplam \(\d\)/g) || []).join(",")}|${x.ilk.filter(s => /^Bakiye : /.test(s)).join(",")}`,
    "Para birimi: TL,Para birimi: EUR|Toplam (2),Toplam (1)|Bakiye : 77.800,00 A,Bakiye : 10,00 B");
  // Hesap bazında: her hesabın para satırlarının üstünde Döviz / Kuyum başlığı (hesap grubunun içinde); parasız hesap başlıksız
  const hesapSirali = [satirlar[0], { ...satir("001", "KİRA", "HAS", 3), paraId: 9 }, satirlar[2], satirlar[1], { ...satir("004", "BOŞ", "-", 0), paraId: null }];
  const hb = hesapIciParaBasliklari(hesapSirali, s => pgH.grup(s));
  esit("HESBAK1 hesap bazında: hesap içinde para başlıkları", hb.map(s => (s._stil ? `${s.hesapBaslik.slice(0, 3)}[${s.paraKod}]` : `${s.hesapKod}:${s.paraKod}`)).join(" "),
    "001[Döviz] 001:TL 001:EUR 001[Kuyum] 001:HAS 002[Döviz] 002:TL 004:-");
  esit("HESBAK1 hesap bazında: başlıklar toplamı değiştirmez", hb.reduce((a, s) => a + (Number(s.alacakBakiye) || 0), 0), hesapSirali.reduce((a, s) => a + s.alacakBakiye, 0));
  const girdiH = { ...girdi, satirlar: hesapIciParaBasliklari([satirlar[0], satirlar[2], satirlar[1]], s => pgH.grup(s)), gruplar: hesbakGruplari("hesap") };
  writeFileSync(path.join(dir, "KASA-HESBAK1-hesap.pdf"), await raporPdf(girdiH));
  const xh = await excelIlkSutun(await raporExcel(girdiH));
  esit("HESBAK1 Excel (hesap bazında): hesap başlıkları, Toplam (veri satırı sayısıyla), Döviz başlıkları, net satırı yok", `${xh.ilk.filter(s => /^00\d — /.test(s)).join(",")}|${(xh.tum.match(/Toplam \(\d\)/g) || []).join(",")}|${xh.ilk.filter(s => s === "Döviz").length}|${xh.ilk.some(s => /^Bakiye : /.test(s))}`, "001 — KİRA,002 — ABONE|Toplam (2),Toplam (1)|2|false");
}

console.log(hata ? `\n${gecen} geçti, ${hata} HATA` : `\nKASA TESTLERİ GEÇTİ (${gecen})`);
process.exit(hata ? 1 : 0);
