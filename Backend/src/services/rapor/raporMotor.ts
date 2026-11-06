import PDFDocument from "pdfkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ApiError } from "../../utils/ApiError.js";
import { RAPOR_DIZINI, yaziTipleri, doldur } from "../belge/belgeMotor.js";
import { raporIsiCalistir } from "./raporIsHavuzu.js";
import type { RaporTanim, RaporKolon, RaporFirma, RaporBicim, RaporGrup, RaporNet, RaporAltTablo } from "./raporTanim.js";

/**
 * Rapor PDF motoru — bant tabanlı (Crystal mantığı):
 * sayfa başlığı (firma, rapor adı, filtre özeti) → kolon başlıkları → [grup başlığı → detay satırları → grup alt toplamı]* →
 * genel toplam → dipnot; her sayfada altlık (yazdıran, tarih-saat, sayfa X / Y).
 * Belge motorundan yazı tipi çözümü ve {{}} doldurma ortak kullanılır; belge dosyalarına dokunulmaz.
 */

export function raporTanimOku(kod: string): RaporTanim {
  if (!/^[A-Z0-9_]{1,20}$/.test(kod)) throw ApiError.badRequest(`Rapor kodu geçersiz: ${kod}`);
  const tam = path.join(RAPOR_DIZINI, `${kod}.json`);
  if (!existsSync(tam)) throw ApiError.notFound(`Rapor tanımı bulunamadı: rapor/${kod}.json`);
  let t: RaporTanim;
  try { t = JSON.parse(readFileSync(tam, "utf8")); }
  catch (e: any) { throw ApiError.badRequest(`Rapor tanımı okunamadı (${kod}): ${e?.message || e}`); }
  if (!Array.isArray(t.kolonlar) || !t.kolonlar.length) throw ApiError.badRequest(`Rapor tanımında kolon yok: ${kod}`);
  t.kod = t.kod || kod;
  return t;
}

// Intl biçimleyicileri seçeneklere göre bir kez kurulur; toLocaleString her çağrıda yenisini kurduğu için binlerce hücrede pahalıdır.
// Seçenekler toLocaleString / toLocaleDateString'in varsayılanlarıyla birebir aynıdır (çıktı metni değişmez).
const sayiBicimleri = new Map<string, Intl.NumberFormat>();
const sayiBicimi = (min: number | undefined, max: number) => {
  const a = `${min}|${max}`;
  let f = sayiBicimleri.get(a);
  if (!f) { f = new Intl.NumberFormat("tr-TR", min === undefined ? { maximumFractionDigits: max } : { minimumFractionDigits: min, maximumFractionDigits: max }); sayiBicimleri.set(a, f); }
  return f;
};
const tarihBicimi = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul" });
const tarihSaatBicimi = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour12: false, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });

const trSayi = (n: number, b = 2) => sayiBicimi(b, b).format(Number(n || 0));
const tarihTr = (v: any) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? tarihBicimi.format(d) : ""; };
const tarihSaatTr = (v: any) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? tarihSaatBicimi.format(d).replace(",", "") : ""; };

const saatBicimi = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour12: false, hour: "2-digit", minute: "2-digit" });
/** Saat (SS:dd): tarih-saat değerinden; "14:35" gibi hazır metin aynen döner */
const saatTr = (v: any) => {
  if (typeof v === "string" && /^\d{1,2}:\d{2}/.test(v)) return v.slice(0, 5);
  const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? saatBicimi.format(d) : "";
};

/** Hücre değerini kolon biçimine göre metne çevirir (PDF ve Excel görünüm metni). */
export function bicimle(v: any, bicim?: RaporBicim): string {
  if (v === null || v === undefined || v === "") return "";
  switch (bicim) {
    case "sayi": return trSayi(Number(v));
    case "sayi4": return trSayi(Number(v), 4);
    case "kur": return sayiBicimi(2, 5).format(Number(v || 0));
    case "tam": return sayiBicimi(undefined, 0).format(Number(v || 0));
    case "tarih": return tarihTr(v);
    case "tarihSaat": return tarihSaatTr(v);
    case "saat": return saatTr(v);
    default: return String(v);
  }
}

/**
 * Satırları tanımdaki bölüme göre ardışık parçalara ayırır (PDF, Excel ve ekran aynı kuralı kullanır). Tanımda bölüm yoksa ya da veride
 * tek bölüm varsa başlıksız tek parça döner → rapor bölümsüz görünür (docs/SEKTORLU_RAPORLAR_YOL_HARITASI.md K10).
 */
export function bolumlereAyir(tanim: RaporTanim, satirlar: Record<string, any>[]): { baslik: string; satirlar: Record<string, any>[] }[] {
  const b = tanim.bolum;
  if (!b || !satirlar.length) return [{ baslik: "", satirlar }];
  const ornek = (ss: Record<string, any>[]) => ss.find(s => s._stil !== "baslik") || ss[0];
  const parcalar: { baslik: string; satirlar: Record<string, any>[] }[] = [];
  let i = 0;
  while (i < satirlar.length) {
    const anahtar = satirlar[i][b.anahtar];
    const uyeler: Record<string, any>[] = [];
    while (i < satirlar.length && satirlar[i][b.anahtar] === anahtar) uyeler.push(satirlar[i++]);
    parcalar.push({ baslik: doldur(b.baslik, ornek(uyeler)).trim(), satirlar: uyeler });
  }
  return parcalar.length > 1 || b.herZaman ? parcalar : [{ baslik: "", satirlar }];
}

/** Veri satırları: alt başlık (`_stil: "baslik"`) satırları hariç — toplam ve kayıt sayıları bunlarla hesaplanır */
export const veriSatirlari = (satirlar: Record<string, any>[]) => (satirlar.some(s => s._stil === "baslik") ? satirlar.filter(s => s._stil !== "baslik") : satirlar);

/** Alt başlık satırının metni: `_baslik` ya da kolonlardaki ilk dolu değer */
export const baslikMetni = (s: Record<string, any>, kolonlar: { anahtar: string }[]) =>
  String(s._baslik ?? kolonlar.map(k => s[k.anahtar]).find(v => v !== null && v !== undefined && v !== "") ?? "");

/** Geçerli gruplar (dıştan içe): sorgunun seçtiği (`sonuc.gruplar`) → tanımdaki `gruplar` → tek `grup` */
export function etkinGruplar(tanim: RaporTanim, sonucGruplar?: RaporGrup[]): RaporGrup[] {
  return sonucGruplar ?? tanim.gruplar ?? (tanim.grup ? [tanim.grup] : []);
}

/** Genel toplam basılır mı (tanımda ya da herhangi bir grupta `genelToplam: false` yoksa) */
export const genelToplamVar = (tanim: RaporTanim, gruplar: RaporGrup[]) => tanim.genelToplam !== false && tanim.grup?.genelToplam !== false && !gruplar.some(x => x.genelToplam === false);

/** Net satırı metni: "Bakiye : 1.250,00 B" (|Σartı − Σeksi|; artı büyükse artı harfi, eksi büyükse eksi harfi; sıfırda harf yok) */
export function netMetni(net: RaporNet, satirlar: Record<string, any>[]): string {
  const topla = (alan: string) => satirlar.reduce((t, r) => t + (Number(r[alan]) || 0), 0);
  const fark = topla(net.arti) - topla(net.eksi);
  return `${net.etiket || "Bakiye"} : ${trSayi(Math.abs(fark))}${Math.abs(fark) < 0.005 ? "" : ` ${fark > 0 ? net.artiHarf || "B" : net.eksiHarf || "A"}`}`;
}

export interface RaporPdfGirdi {
  tanim: RaporTanim;
  satirlar: Record<string, any>[];
  filtreOzeti: string;
  firma: RaporFirma;
  kullanici: string;
  ekDipnot?: string;
  /** `tanim.ozet` bölümünün satırları */
  ozetSatirlar?: Record<string, any>[];
  /** Sorgunun seçtiği gruplar (tanımdakinin yerine) */
  gruplar?: RaporGrup[];
  /** `tanim.grupAltTablo` satırları (grup anahtar değeri → satırlar) */
  grupAltSatirlar?: Record<string, Record<string, any>[]>;
}

const sayisal = (b?: RaporBicim) => b === "sayi" || b === "sayi4" || b === "kur" || b === "tam";

/**
 * PDF'i ayrı iş parçacığında üretir: pdfkit çizimi senkron olduğundan büyük raporda ana süreçte tüm istekleri bekletirdi.
 * Yazı tipi denetimi burada yapılır ki hata ApiError olarak dönsün.
 */
export async function raporPdf(g: RaporPdfGirdi): Promise<Buffer> {
  yaziTipleri();
  return raporIsiCalistir("pdf", g);
}

/** Asıl PDF çizimi (iş parçacığında ya da yedek olarak aynı süreçte çalışır). */
export async function raporPdfUret(g: RaporPdfGirdi): Promise<Buffer> {
  const font = yaziTipleri();
  const yatay = g.tanim.kagit === "A4-yatay";
  const kenar = 28;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: yatay ? "landscape" : "portrait", margin: kenar, bufferPages: true,
      info: { Title: `${g.tanim.ad} - ${g.firma.ad}` } });
    const parcalar: Buffer[] = [];
    doc.on("data", p => parcalar.push(p));
    doc.on("end", () => resolve(Buffer.concat(parcalar)));
    doc.on("error", reject);

    const N = () => doc.font(font.normal), K = () => doc.font(font.kalin);
    const sol = kenar, genislik = doc.page.width - 2 * kenar;
    const altSinir = doc.page.height - kenar - 22; // altlık payı
    // PDF'te yalnızca pdf !== false kolonlar; ayrıntı kolonları ekran ve Excel'de kalır (kısa-öz çıktı)
    // (özet bölümüne geçilince kolon kümesi değişir; sayfa başlığı her zaman geçerli kümeyi basar)
    let kolonlar = g.tanim.kolonlar.filter(k => k.pdf !== false);
    const genislikler = (ks: RaporKolon[]) => { const tg = ks.reduce((t, k) => t + (k.g || 1), 0); return ks.map(k => ((k.g || 1) / tg) * genislik); };
    let kolonG = genislikler(kolonlar);
    // Sık satır (eski Crystal raporları gibi): yatay A4 sayfaya ~38, dikeye ~55 satır; önceki 17 pt / 8 pt ile sayfa yarı boş görünüyordu
    const satirH = 13, boyut = 7.5;
    let zebra = 0;
    const ustSayfa = () => kenar;

    /** Metni hücre genişliğine sığdırır: yazı boyutunu 5.5'e kadar küçültür, yine sığmazsa kırpar. Satır kaymasını önler. */
    const hucre = (metin: string, x: number, yy: number, g: number, hiza: "left" | "right" | "center", kalin: boolean, tabanBoyut = boyut) => {
      const f = kalin ? K() : N();
      let b = tabanBoyut, t = metin;
      const avail = g - 6;
      let w = f.fontSize(b).widthOfString(t);
      while (w > avail && b > 5.5) { b -= 0.5; w = f.fontSize(b).widthOfString(t); }
      if (w > avail) { while (t.length > 1 && f.widthOfString(t + "…") > avail) t = t.slice(0, -1); t += "…"; }
      f.fontSize(b).text(t, x + 3, yy + (satirH - b) / 2 - 0.5, { width: avail, align: hiza, lineBreak: false });
    };

    let y = 0;
    let ozetSayfasi = false; // özet bölümüne geçildi: yeni sayfalarda bölüm başlığı yinelenir

    const sayfaBasligi = () => {
      y = ustSayfa();
      // Sade başlık: solda rapor adı + filtre özeti, sağda firma (küçük)
      K().fontSize(14).fillColor("#111").text(g.tanim.ad, sol, y, { width: genislik * 0.65 });
      N().fontSize(8).fillColor("#666").text(g.filtreOzeti || "", sol, y + 18, { width: genislik * 0.65 });
      // Firma adı tek satır: sığmazsa küçülür, yine sığmazsa kırpılır (alt satıra taşıp VKN'ye binmesin)
      { const g35 = genislik * 0.35; let b = 8, t = g.firma.ad || "";
        let w = N().fontSize(b).widthOfString(t);
        while (w > g35 && b > 6) { b -= 0.5; w = N().fontSize(b).widthOfString(t); }
        if (w > g35) { while (t.length > 1 && N().widthOfString(t + "…") > g35) t = t.slice(0, -1); t += "…"; }
        N().fontSize(b).fillColor("#333").text(t, sol + genislik * 0.65, y + 2, { width: g35, align: "right", lineBreak: false }); }
      N().fontSize(7).fillColor("#888").text(g.firma.vkn ? `VKN/TCKN ${g.firma.vkn}` : "", sol + genislik * 0.65, y + 14, { width: genislik * 0.35, align: "right" });
      y += 34;
      doc.moveTo(sol, y).lineTo(sol + genislik, y).lineWidth(1).strokeColor("#222").stroke();
      y += 6;
      zebra = 0;
      if (ozetSayfasi && g.tanim.ozet) { doc.fillColor("#111"); hucre(g.tanim.ozet.baslik, sol, y, genislik, "left", true, boyut + 1.5); y += satirH; }
      kolonBasliklari();
    };

    const kolonBasliklari = () => {
      let x = sol;
      doc.fillColor("#333");
      kolonlar.forEach((k, i) => {
        hucre(k.baslik, x, y, kolonG[i], k.hiza || (sayisal(k.bicim) ? "right" : "left"), true, boyut - 0.5);
        x += kolonG[i];
      });
      y += satirH;
      doc.moveTo(sol, y).lineTo(sol + genislik, y).lineWidth(0.6).strokeColor("#555").stroke();
      y += 2;
    };

    // Sayfa toplamı / nakli yekün (tanim.sayfaToplami): yalnız ana tablo çizilirken, toplam:true kolonlar
    let anaTablo = false;
    const sayfaTop: Record<string, number> = {}, yekun: Record<string, number> = {};
    const toplamVar = () => kolonlar.some(k => k.toplam);
    const sayfaToplamli = () => anaTablo && !!g.tanim.sayfaToplami && toplamVar();

    /** Hazır değerlerle toplam satırı (sayfa kontrolü yapmaz): etiket ilk sayısal olmayan kolonda, toplam:true kolonlarda değer */
    const toplamCiz = (t: Record<string, any>, etiket: string, arka: string) => {
      let etiketYeri = kolonlar.findIndex(k => !k.toplam && !sayisal(k.bicim));
      if (etiketYeri < 0) etiketYeri = 0;
      doc.rect(sol, y, genislik, satirH).fillColor(arka).fill();
      let x = sol; K().fontSize(boyut).fillColor("#000");
      kolonlar.forEach((k, i) => {
        const metin = i === etiketYeri && !k.toplam ? etiket : k.toplam ? bicimle(t[k.anahtar] ?? 0, k.bicim) : "";
        hucre(metin, x, y, kolonG[i], k.hiza || (sayisal(k.bicim) ? "right" : "left"), true);
        x += kolonG[i];
      });
      y += satirH;
      doc.moveTo(sol, y).lineTo(sol + genislik, y).lineWidth(0.5).strokeColor("#666").stroke();
    };
    const topla = (satirlar: Record<string, any>[]) => {
      const t: Record<string, any> = {};
      for (const k of kolonlar) if (k.toplam) t[k.anahtar] = satirlar.reduce((s, r) => s + (Number(r[k.anahtar]) || 0), 0);
      return t;
    };

    const yeniSayfaGerekliyse = (ihtiyac = satirH) => {
      const pay = sayfaToplamli() ? satirH + 2 : 0; // sayfa toplamı satırının yeri her zaman ayrılır
      if (y + ihtiyac + pay <= altSinir) return;
      if (sayfaToplamli()) { toplamCiz(sayfaTop, "Sayfa toplamı", "#f1f3f5"); for (const a of Object.keys(sayfaTop)) sayfaTop[a] = 0; }
      doc.addPage(); sayfaBasligi();
      if (sayfaToplamli()) toplamCiz(yekun, "Nakli yekün", "#f1f3f5");
    };

    const satirYaz = (satir: Record<string, any>, kalin = false, arka?: string) => {
      yeniSayfaGerekliyse();
      // Çizgi yerine her ikinci satırda çok açık zemin: göz yormaz, sayfa sade kalır
      const zemin = arka || (zebra++ % 2 === 1 ? "#f6f7f9" : undefined);
      if (zemin) { doc.rect(sol, y, genislik, satirH).fillColor(zemin).fill(); }
      let x = sol;
      doc.fillColor("#111");
      kolonlar.forEach((k, i) => {
        hucre(bicimle(satir[k.anahtar], k.bicim), x, y, kolonG[i], k.hiza || (sayisal(k.bicim) ? "right" : "left"), kalin);
        x += kolonG[i];
      });
      y += satirH;
    };

    const toplamSatiri = (satirlar: Record<string, any>[], etiket: string, arka: string) => {
      yeniSayfaGerekliyse();
      toplamCiz(topla(satirlar), etiket, arka);
    };

    /** Grup / rapor altı net satırı: "Bakiye : |Σartı − Σeksi| B/A" (eski raporlardaki net + borç/alacak harfi) */
    const netSatiri = (satirlar: Record<string, any>[], net: RaporNet) => {
      yeniSayfaGerekliyse();
      doc.rect(sol, y, genislik, satirH).fillColor("#f6f7f9").fill();
      doc.fillColor("#000"); hucre(netMetni(net, satirlar), sol, y, genislik, "right", true);
      y += satirH;
    };

    /** Alt başlık bandı (`_stil: "baslik"` satırı: Döviz / Kuyum / Ticari gibi) */
    const baslikBandi = (metin: string) => {
      yeniSayfaGerekliyse(satirH * 2);
      y += 3; zebra = 0;
      doc.rect(sol, y, genislik, satirH).fillColor("#e4e8ee").fill();
      doc.fillColor("#111"); hucre(metin, sol, y, genislik, "left", true);
      y += satirH;
    };

    /** Alt tablo (Crystal alt raporu): girintili, kendi kolon başlıklarıyla; varsa toplam satırı */
    const altTabloCiz = (alt: RaporAltTablo, altSatirlar: Record<string, any>[]) => {
      const ks = alt.kolonlar.filter(k => k.pdf !== false);
      if (!ks.length || !altSatirlar.length) return;
      const gir = 18, gen = genislik - gir, tg = ks.reduce((t, k) => t + (k.g || 1), 0), gs = ks.map(k => ((k.g || 1) / tg) * gen), h = satirH - 3;
      const ciz = (deger: (k: RaporKolon, i: number) => string, kalin: boolean, arka?: string, renk = "#222") => {
        yeniSayfaGerekliyse(h);
        if (arka) doc.rect(sol + gir, y, gen, h).fillColor(arka).fill();
        let x = sol + gir; doc.fillColor(renk);
        ks.forEach((k, i) => { hucre(deger(k, i), x, y - 1.5, gs[i], k.hiza || (sayisal(k.bicim) ? "right" : "left"), kalin, boyut - 0.5); x += gs[i]; });
        y += h;
      };
      yeniSayfaGerekliyse(h * 3);
      if (alt.baslik) { doc.fillColor("#333"); hucre(alt.baslik, sol + gir, y - 1.5, gen, "left", true, boyut - 0.5); y += h; }
      ciz(k => k.baslik, true, "#eef0f3", "#444");
      // Alt başlık satırı (`_stil: "baslik"`: Döviz / Kuyum) iç tabloda bantlı ve kalın; toplama girmez
      for (const r of altSatirlar) {
        if (r._stil === "baslik") ciz((_k, i) => (i === 0 ? baslikMetni(r, ks) : ""), true, "#e4e8ee", "#111");
        else ciz(k => bicimle(r[k.anahtar], k.bicim), false);
      }
      const altVeri = veriSatirlari(altSatirlar);
      if (ks.some(k => k.toplam)) {
        let etiketYeri = ks.findIndex(k => !k.toplam && !sayisal(k.bicim)); if (etiketYeri < 0) etiketYeri = 0;
        ciz((k, i) => (k.toplam ? bicimle(altVeri.reduce((s, r) => s + (Number(r[k.anahtar]) || 0), 0), k.bicim) : i === etiketYeri ? (alt.toplamEtiketi || "Toplam") : ""), true, "#f6f7f9");
      }
      y += 4; zebra = 0;
    };

    /** Ana tablo satırı: alt başlık / veri satırı (+ sayfa toplamı birikimi, + satır altı tablo) */
    const veriSatiri = (s: Record<string, any>) => {
      if (s._stil === "baslik") { baslikBandi(baslikMetni(s, g.tanim.kolonlar)); return; }
      satirYaz(s);
      if (g.tanim.sayfaToplami) for (const k of kolonlar) if (k.toplam) { const v = Number(s[k.anahtar]) || 0;
        sayfaTop[k.anahtar] = (sayfaTop[k.anahtar] || 0) + v; yekun[k.anahtar] = (yekun[k.anahtar] || 0) + v; }
      if (g.tanim.altTablo && Array.isArray(s._alt) && s._alt.length) altTabloCiz(g.tanim.altTablo, s._alt);
    };

    sayfaBasligi();

    const gruplar = etkinGruplar(g.tanim, g.gruplar);
    /** Bir bölümün (ya da bölümsüz raporun tamamının) gövdesi: gruplar iç içe (dıştan içe), her seviyede başlık + alt seviye + ara toplam (+ net satırı) */
    const govde = (satirlar: Record<string, any>[], seviye = 0) => {
      const grup = gruplar[seviye];
      if (!grup) { for (const s of satirlar) veriSatiri(s); return; }
      let i = 0;
      while (i < satirlar.length) {
        const anahtar = satirlar[i][grup.anahtar];
        const uyeler: Record<string, any>[] = [];
        while (i < satirlar.length && satirlar[i][grup.anahtar] === anahtar) uyeler.push(satirlar[i++]);
        const ornek = uyeler.find(s => s._stil !== "baslik") || uyeler[0];
        const altBaslik = grup.altBaslik ? doldur(grup.altBaslik, ornek).trim() : "";
        yeniSayfaGerekliyse(satirH * (altBaslik ? 4 : 3));
        zebra = 0;
        if (seviye === 0) {
          y += 6;
          doc.fillColor("#111"); hucre(doldur(grup.baslik, ornek), sol, y, genislik, "left", true, boyut + 1);
          y += satirH;
          if (altBaslik) { doc.fillColor("#555"); hucre(altBaslik, sol, y - 4, genislik, "left", false, boyut - 0.5); y += satirH - 4; }
          doc.moveTo(sol, y - 2).lineTo(sol + genislik, y - 2).lineWidth(0.4).strokeColor("#999").stroke();
        } else {
          // İç seviye: girintili, çizgisiz, bir punto küçük
          y += 2;
          doc.fillColor("#222"); hucre(doldur(grup.baslik, ornek), sol + 10 * seviye, y, genislik - 10 * seviye, "left", true, boyut + 0.3);
          y += satirH - 2;
          if (altBaslik) { doc.fillColor("#555"); hucre(altBaslik, sol + 10 * seviye, y - 4, genislik - 10 * seviye, "left", false, boyut - 0.5); y += satirH - 4; }
        }
        govde(uyeler, seviye + 1);
        const gat = g.tanim.grupAltTablo;
        if (gat && (gat.seviye ?? 0) === seviye) { const alt = g.grupAltSatirlar?.[String(anahtar)]; if (alt?.length) altTabloCiz(gat, alt); }
        if (grup.altToplam !== false && toplamVar()) toplamSatiri(uyeler, doldur(grup.toplamEtiketi || "Ara toplam", ornek), seviye === 0 ? "#eef0f3" : "#f4f5f7");
        if (grup.net) netSatiri(uyeler, grup.net);
      }
    };

    const veri = veriSatirlari(g.satirlar);
    if (!veri.length) {
      // Boş raporda tek mesaj: sorgunun nedeni varsa o, yoksa genel yazı (aşağıda ayrıca not basılmaz)
      N().fontSize(9).fillColor("#666").text(g.ekDipnot || "Seçilen ölçütlerde kayıt bulunamadı.", sol, y + 10, { width: genislik, align: "center" });
      y += 30;
    } else {
      anaTablo = true;
      // Bölümler (sektör / para grubu): veride birden fazla bölüm varsa her biri başlık + gövde + bölüm toplamı; tek bölümde rapor bölümsüz çizilir
      const bolumler = bolumlereAyir(g.tanim, g.satirlar);
      for (const b of bolumler) {
        if (b.baslik) {
          yeniSayfaGerekliyse(satirH * 4);
          y += 8; zebra = 0;
          doc.rect(sol, y, genislik, satirH + 2).fillColor("#dde3ea").fill();
          doc.fillColor("#111"); hucre(b.baslik, sol, y + 1, genislik, "left", true, boyut + 2);
          y += satirH + 4;
        }
        govde(b.satirlar);
        if (b.baslik && g.tanim.bolum?.altToplam !== false && toplamVar()) { y += 2; toplamSatiri(b.satirlar, `${b.baslik} toplamı`, "#e4e8ee"); }
      }
      // Son sayfanın sayfa toplamı (yeri ayrılmıştı)
      if (sayfaToplamli()) toplamCiz(sayfaTop, "Sayfa toplamı", "#f1f3f5");
      anaTablo = false;
      if (genelToplamVar(g.tanim, gruplar) && toplamVar()) { y += 6; toplamSatiri(veri, "Genel toplam", "#dfe3e8"); }
      if (g.tanim.net) netSatiri(veri, g.tanim.net);
    }

    // Özet bölümü (Crystal alt raporu karşılığı): başlık + kendi kolonları + satırlar + toplam
    if (g.tanim.ozet && g.ozetSatirlar?.length) {
      const oz = g.tanim.ozet;
      kolonlar = oz.kolonlar.filter(k => k.pdf !== false); kolonG = genislikler(kolonlar);
      if (y + satirH * 5 > altSinir) { doc.addPage(); ozetSayfasi = true; sayfaBasligi(); }
      else { y += 14; doc.fillColor("#111"); hucre(oz.baslik, sol, y, genislik, "left", true, boyut + 1.5); y += satirH; zebra = 0; kolonBasliklari(); }
      ozetSayfasi = true;
      // Satır `_stil: "baslik"` taşıyorsa grup başlığıdır (Döviz / Kuyum / Ticari): kalın ve bantlı basılır
      for (const s of g.ozetSatirlar) {
        if (s._stil === "baslik") baslikBandi(baslikMetni(s, oz.kolonlar));
        else satirYaz(s);
      }
      if (toplamVar()) toplamSatiri(g.ozetSatirlar, "Toplam", "#dfe3e8");
    }

    const dipnot = [g.tanim.dipnot, veri.length ? g.ekDipnot : undefined].filter(Boolean).join("\n");
    if (dipnot) {
      const h = N().fontSize(7).heightOfString(dipnot, { width: genislik }) + 8;
      yeniSayfaGerekliyse(h);
      y += 6;
      N().fontSize(7).fillColor("#555").text(dipnot, sol, y, { width: genislik });
      y += h;
    }

    // Altlık: her sayfaya yazdıran, zaman, sayfa X / Y
    const zaman = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false });
    const aralik = doc.bufferedPageRange();
    for (let p = aralik.start; p < aralik.start + aralik.count; p++) {
      doc.switchToPage(p);
      const ay = doc.page.height - kenar - 12;
      doc.moveTo(sol, ay - 3).lineTo(sol + genislik, ay - 3).lineWidth(0.4).strokeColor("#999").stroke();
      N().fontSize(7).fillColor("#666")
        .text(`Yazdıran: ${g.kullanici || "-"} · ${zaman}`, sol, ay, { width: genislik / 2, lineBreak: false })
        .text(`Sayfa ${p - aralik.start + 1} / ${aralik.count}`, sol + genislik / 2, ay, { width: genislik / 2, align: "right", lineBreak: false });
    }
    doc.end();
  });
}

export { RaporKolon };
