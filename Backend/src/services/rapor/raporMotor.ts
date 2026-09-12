import PDFDocument from "pdfkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ApiError } from "../../utils/ApiError.js";
import { RAPOR_DIZINI, yaziTipleri, doldur } from "../belge/belgeMotor.js";
import type { RaporTanim, RaporKolon, RaporFirma, RaporBicim } from "./raporTanim.js";

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

const trSayi = (n: number, b = 2) => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: b, maximumFractionDigits: b });
const tarihTr = (v: any) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : ""; };
const tarihSaatTr = (v: any) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false }).replace(",", "") : ""; };

/** Hücre değerini kolon biçimine göre metne çevirir (PDF ve Excel görünüm metni). */
export function bicimle(v: any, bicim?: RaporBicim): string {
  if (v === null || v === undefined || v === "") return "";
  switch (bicim) {
    case "sayi": return trSayi(Number(v));
    case "sayi4": return trSayi(Number(v), 4);
    case "kur": return Number(v || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 5 });
    case "tam": return Number(v || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
    case "tarih": return tarihTr(v);
    case "tarihSaat": return tarihSaatTr(v);
    default: return String(v);
  }
}

export interface RaporPdfGirdi {
  tanim: RaporTanim;
  satirlar: Record<string, any>[];
  filtreOzeti: string;
  firma: RaporFirma;
  kullanici: string;
  ekDipnot?: string;
}

const sayisal = (b?: RaporBicim) => b === "sayi" || b === "sayi4" || b === "kur" || b === "tam";

export async function raporPdf(g: RaporPdfGirdi): Promise<Buffer> {
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
    const kolonlar = g.tanim.kolonlar;
    const toplamG = kolonlar.reduce((t, k) => t + (k.g || 1), 0);
    const kolonG = kolonlar.map(k => ((k.g || 1) / toplamG) * genislik);
    const satirH = 14, boyut = 7.5;
    const ustSayfa = () => kenar;

    /** Metni hücre genişliğine sığdırır: yazı boyutunu 5.5'e kadar küçültür, yine sığmazsa kırpar. Satır kaymasını önler. */
    const hucre = (metin: string, x: number, yy: number, g: number, hiza: "left" | "right" | "center", kalin: boolean, tabanBoyut = boyut) => {
      const f = kalin ? K() : N();
      let b = tabanBoyut, t = metin;
      const avail = g - 6;
      while (f.fontSize(b).widthOfString(t) > avail && b > 5.5) b -= 0.5;
      if (f.fontSize(b).widthOfString(t) > avail) { while (t.length > 1 && f.widthOfString(t + "…") > avail) t = t.slice(0, -1); t += "…"; }
      f.fontSize(b).text(t, x + 3, yy + (satirH - b) / 2 - 0.5, { width: avail, align: hiza, lineBreak: false });
    };

    let y = 0;

    const sayfaBasligi = () => {
      y = ustSayfa();
      K().fontSize(11).fillColor("#000").text(g.firma.ad || "", sol, y, { width: genislik * 0.6 });
      N().fontSize(7.5).fillColor("#444").text(g.firma.vkn ? `VKN/TCKN: ${g.firma.vkn}` : "", sol, y + 14, { width: genislik * 0.6 });
      K().fontSize(12).fillColor("#000").text(g.tanim.ad, sol, y, { width: genislik, align: "right" });
      N().fontSize(7.5).fillColor("#444").text(g.filtreOzeti || "", sol, y + 15, { width: genislik, align: "right" });
      y += 30;
      doc.moveTo(sol, y).lineTo(sol + genislik, y).lineWidth(0.8).strokeColor("#000").stroke();
      y += 4;
      kolonBasliklari();
    };

    const kolonBasliklari = () => {
      doc.rect(sol, y, genislik, satirH).fillColor("#e9ecef").fill();
      let x = sol;
      K().fontSize(boyut).fillColor("#000");
      kolonlar.forEach((k, i) => {
        hucre(k.baslik, x, y, kolonG[i], k.hiza || (sayisal(k.bicim) ? "right" : "left"), true);
        x += kolonG[i];
      });
      y += satirH;
      doc.moveTo(sol, y).lineTo(sol + genislik, y).lineWidth(0.5).strokeColor("#666").stroke();
    };

    const yeniSayfaGerekliyse = (ihtiyac = satirH) => {
      if (y + ihtiyac > altSinir) { doc.addPage(); sayfaBasligi(); }
    };

    const satirYaz = (satir: Record<string, any>, kalin = false, arka?: string) => {
      yeniSayfaGerekliyse();
      if (arka) { doc.rect(sol, y, genislik, satirH).fillColor(arka).fill(); }
      let x = sol;
      (kalin ? K() : N()).fontSize(boyut).fillColor("#000");
      kolonlar.forEach((k, i) => {
        hucre(bicimle(satir[k.anahtar], k.bicim), x, y, kolonG[i], k.hiza || (sayisal(k.bicim) ? "right" : "left"), kalin);
        x += kolonG[i];
      });
      y += satirH;
      doc.moveTo(sol, y).lineTo(sol + genislik, y).lineWidth(0.25).strokeColor("#ccc").stroke();
    };

    const toplamSatiri = (satirlar: Record<string, any>[], etiket: string, arka: string) => {
      const t: Record<string, any> = {};
      let etiketYazildi = false;
      for (const k of kolonlar) {
        if (k.toplam) t[k.anahtar] = satirlar.reduce((s, r) => s + (Number(r[k.anahtar]) || 0), 0);
        else if (!etiketYazildi && !sayisal(k.bicim)) { t[k.anahtar] = etiket; etiketYazildi = true; }
      }
      if (!etiketYazildi) t[kolonlar[0].anahtar] = etiket;
      // Toplam satırında sayısal olmayan kolonlar biçimsiz basılır
      yeniSayfaGerekliyse();
      doc.rect(sol, y, genislik, satirH).fillColor(arka).fill();
      let x = sol; K().fontSize(boyut).fillColor("#000");
      kolonlar.forEach((k, i) => {
        const v = t[k.anahtar];
        hucre(v === undefined ? "" : (k.toplam ? bicimle(v, k.bicim) : String(v)), x, y, kolonG[i], k.hiza || (sayisal(k.bicim) ? "right" : "left"), true);
        x += kolonG[i];
      });
      y += satirH;
      doc.moveTo(sol, y).lineTo(sol + genislik, y).lineWidth(0.5).strokeColor("#666").stroke();
    };

    sayfaBasligi();

    if (!g.satirlar.length) {
      N().fontSize(9).fillColor("#666").text("Seçilen ölçütlerde kayıt bulunamadı.", sol, y + 10, { width: genislik, align: "center" });
      y += 30;
    } else if (g.tanim.grup) {
      const grup = g.tanim.grup;
      let i = 0;
      while (i < g.satirlar.length) {
        const anahtar = g.satirlar[i][grup.anahtar];
        const uyeler: Record<string, any>[] = [];
        while (i < g.satirlar.length && g.satirlar[i][grup.anahtar] === anahtar) uyeler.push(g.satirlar[i++]);
        yeniSayfaGerekliyse(satirH * 2);
        doc.rect(sol, y, genislik, satirH).fillColor("#f3f4f6").fill();
        doc.fillColor("#000"); hucre(doldur(grup.baslik, uyeler[0]), sol, y, genislik, "left", true, boyut + 0.5);
        y += satirH;
        for (const s of uyeler) satirYaz(s);
        if (grup.altToplam !== false && kolonlar.some(k => k.toplam)) toplamSatiri(uyeler, `Ara toplam (${uyeler.length})`, "#f8f9fa");
      }
      if (kolonlar.some(k => k.toplam)) toplamSatiri(g.satirlar, `GENEL TOPLAM (${g.satirlar.length} kayıt)`, "#e2e6ea");
    } else {
      for (const s of g.satirlar) satirYaz(s);
      if (kolonlar.some(k => k.toplam)) toplamSatiri(g.satirlar, `GENEL TOPLAM (${g.satirlar.length} kayıt)`, "#e2e6ea");
    }

    const dipnot = [g.tanim.dipnot, g.ekDipnot].filter(Boolean).join("\n");
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
