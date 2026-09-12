import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../../utils/ApiError.js";

/**
 * Belge / rapor şablon motoru.
 *
 * Şablon: `Backend/belge/*.json` (ileride `Backend/rapor/*.json`) — düzen dosyada,
 * veri çağıran taraftan gelir. Crystal Reports'taki "rpt + parametre" mantığının
 * web karşılığıdır: şablon değişikliği kod değişikliği gerektirmez.
 *
 * Çizim temeli `ebelgeKaynakPdf.ts` → `eDovizBelgePdf` ile aynıdır (pdfkit, A4,
 * Türkçe TTF); o dosya değiştirilmemiş, mantık buraya genelleştirilmiştir.
 */

export type BelgeOge =
  | { tip: "metin"; x: number; y: number; g?: number; metin: string; boyut?: number; kalin?: boolean; hiza?: "left" | "center" | "right"; renk?: string; altCizgi?: boolean; kosul?: string }
  | { tip: "satirlar"; x: number; y: number; g: number; satirlar: string[]; boyut?: number; aralik?: number; kosul?: string }
  | { tip: "tablo"; x: number; y: number; g: number; etiketG: number; satirH?: number; satirlar: [string, string, boolean?][]; boyut?: number; hizaDeger?: "left" | "right"; kosul?: string }
  | { tip: "kutu"; x: number; y: number; g: number; h: number; kosul?: string }
  | { tip: "cizgi"; x1: number; y1: number; x2: number; y2: number; kosul?: string }
  | { tip: "resim"; dosya: string; x: number; y: number; g?: number; h?: number; kosul?: string }
  | { tip: "qr"; x: number; y: number; boyut: number; icerik: string; kosul?: string }
  | { tip: "filigran"; metin: string; renk?: string; kosul?: string };

export interface BelgeSablon {
  kod: string;
  ad: string;
  /** "A4", "A5" veya punto cinsinden [genişlik, yükseklik] (80 mm fiş: [227, 1000]). */
  kagit?: "A4" | "A5" | [number, number];
  kenar?: number;
  yaziBoyutu?: number;
  ogeler: BelgeOge[];
}

const buDosya = fileURLToPath(import.meta.url);
/** `Backend/` kökü: hem `src/services/belge` hem `dist/services/belge` için üç üst dizin. */
export const BACKEND_KOK = path.resolve(path.dirname(buDosya), "../../..");
export const BELGE_DIZINI = path.join(BACKEND_KOK, "belge");
export const RAPOR_DIZINI = path.join(BACKEND_KOK, "rapor");

/** Şablon dosyasını okur. `duzenDosyasi` örn. "belge/ALFIS1.json". */
export function sablonOku(duzenDosyasi: string): BelgeSablon {
  const temiz = duzenDosyasi.replace(/\\/g, "/").replace(/^\/+/, "");
  if (temiz.includes("..") || !/^(belge|rapor)\/[A-Za-z0-9_-]+\.json$/.test(temiz)) {
    throw ApiError.badRequest(`Şablon dosya adı geçersiz: ${duzenDosyasi}`);
  }
  const tam = path.join(BACKEND_KOK, temiz);
  if (!existsSync(tam)) throw ApiError.notFound(`Şablon dosyası bulunamadı: ${temiz}`);
  let sablon: BelgeSablon;
  try { sablon = JSON.parse(readFileSync(tam, "utf8")); }
  catch (e: any) { throw ApiError.badRequest(`Şablon dosyası okunamadı (${temiz}): ${e?.message || e}`); }
  if (!Array.isArray(sablon.ogeler)) throw ApiError.badRequest(`Şablonda 'ogeler' listesi yok: ${temiz}`);
  return sablon;
}

/** Türkçe destekli TTF yazı tipi; e-Döviz PDF'i ile aynı arama sırası (EBELGE_PDF_FONT). */
export function yaziTipleri(): { normal: string; kalin: string } {
  const adaylar = [process.env.EBELGE_PDF_FONT,
    path.join(process.env.WINDIR || "C:/Windows", "Fonts", "arial.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"];
  const normal = adaylar.find((f): f is string => !!f && existsSync(f));
  if (!normal) throw ApiError.badRequest("PDF yazı tipi bulunamadı. Sunucuda EBELGE_PDF_FONT ile Türkçe destekli bir TTF yazı tipi tanımlayın.");
  const kalin = [process.env.EBELGE_PDF_FONT_BOLD,
    path.join(process.env.WINDIR || "C:/Windows", "Fonts", "arialbd.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"].find((f): f is string => !!f && existsSync(f));
  return { normal, kalin: kalin || normal };
}

const trSayi = (n: number, basamak = 2) =>
  Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

/** `{{yol.alt|bicim}}` yer tutucularını veriden doldurur. */
export function doldur(metin: string, veri: Record<string, any>): string {
  return String(metin ?? "").replace(/\{\{\s*([\w.]+)\s*(?:\|\s*(\w+))?\s*\}\}/g, (_m, yol: string, bicim?: string) => {
    const deger = yol.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), veri);
    if (deger === undefined || deger === null || deger === false) return "";
    switch (bicim) {
      case "sayi": return trSayi(Number(deger));
      case "sayi4": return trSayi(Number(deger), 4);
      // Kur: ICE çıktısındaki gibi en az 2, en çok 5 hane (0,02062).
      case "kur": return Number(deger || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 5 });
      case "buyuk": return String(deger).toLocaleUpperCase("tr-TR");
      default: return String(deger);
    }
  });
}

const yerTutucuVar = (m: string) => /\{\{[^}]+\}\}/.test(m);
/** Koşul: yer tutucu doldurulunca boş, "0", "false" ise öğe çizilmez. */
const kosulGecti = (kosul: string | undefined, veri: Record<string, any>) => {
  if (!kosul) return true;
  const d = doldur(kosul, veri).trim();
  return d !== "" && d !== "0" && d !== "false";
};

/**
 * Şablonu veriyle çizer, PDF baytlarını döner.
 * Sayfa: A4 (595×842), A5 veya [g,h] punto (80 mm fiş için 227 pt genişlik); kenar boşluğu şablondan.
 */
export async function belgeCiz(sablon: BelgeSablon, veri: Record<string, any>, baslik?: string): Promise<Buffer> {
  const font = yaziTipleri();
  const kenar = sablon.kenar ?? 28;
  const varsayilanBoyut = sablon.yaziBoyutu ?? 8;

  // QR görüntüleri önceden üretilir (pdfkit senkron çizer).
  const qrler = new Map<BelgeOge, Buffer>();
  for (const o of sablon.ogeler) {
    if (o.tip !== "qr" || !kosulGecti(o.kosul, veri)) continue;
    const icerik = doldur(o.icerik, veri).trim();
    if (!icerik) continue;
    qrler.set(o, await QRCode.toBuffer(icerik, { type: "png", margin: 0, errorCorrectionLevel: "M", width: Math.round(o.boyut * 4) }));
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: sablon.kagit || "A4", margin: kenar, info: { Title: baslik || sablon.ad || sablon.kod } });
    const parcalar: Buffer[] = [];
    doc.on("data", p => parcalar.push(p));
    doc.on("end", () => resolve(Buffer.concat(parcalar)));
    doc.on("error", reject);

    const sol = doc.page.margins.left, ust = doc.page.margins.top;
    const genislik = doc.page.width - sol - doc.page.margins.right;
    const N = () => doc.font(font.normal), K = () => doc.font(font.kalin);
    const X = (x: number) => sol + x, Y = (y: number) => ust + y;

    /** `**kalın**` parçalarını destekleyen tek satır metin. */
    const zenginMetin = (metin: string, x: number, y: number, g: number, boyut: number, hiza: "left" | "center" | "right", kalinHepsi: boolean, renk: string) => {
      doc.fontSize(boyut).fillColor(renk);
      const parcalar = metin.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
      if (parcalar.length <= 1 || hiza !== "left") {
        (kalinHepsi ? K() : N()).text(metin.replace(/\*\*/g, ""), x, y, { width: g, align: hiza, lineBreak: true });
        return;
      }
      let cx = x;
      for (const p of parcalar) {
        const kalin = p.startsWith("**");
        const t = kalin ? p.slice(2, -2) : p;
        (kalin || kalinHepsi ? K() : N());
        doc.text(t, cx, y, { lineBreak: false, continued: false });
        cx += doc.widthOfString(t);
      }
    };

    for (const o of sablon.ogeler) {
      if (!kosulGecti((o as any).kosul, veri)) continue;
      switch (o.tip) {
        case "filigran": {
          doc.save();
          const cx = doc.page.width / 2, cy = doc.page.height / 2;
          doc.rotate(-35, { origin: [cx, cy] });
          K().fontSize(34).fillColor(o.renk || "#9a9a9a").opacity(0.22)
            .text(doldur(o.metin, veri), cx - 300, cy - 20, { width: 600, align: "center" });
          doc.restore();
          break;
        }
        case "metin": {
          const metin = doldur(o.metin, veri);
          const g = o.g ?? genislik - o.x;
          const boyut = o.boyut ?? varsayilanBoyut;
          zenginMetin(metin, X(o.x), Y(o.y), g, boyut, o.hiza || "left", !!o.kalin, o.renk || "#000");
          if (o.altCizgi) {
            const w = Math.min(g, (o.kalin ? K() : N()).fontSize(boyut).widthOfString(metin.replace(/\*\*/g, "")));
            const bx = o.hiza === "center" ? X(o.x) + (g - w) / 2 : o.hiza === "right" ? X(o.x) + g - w : X(o.x);
            doc.moveTo(bx, Y(o.y) + boyut + 1.5).lineTo(bx + w, Y(o.y) + boyut + 1.5).lineWidth(0.6).strokeColor(o.renk || "#000").stroke();
          }
          break;
        }
        case "satirlar": {
          const boyut = o.boyut ?? varsayilanBoyut;
          let y = Y(o.y);
          for (const ham of o.satirlar) {
            const istegeBagli = ham.startsWith("?");
            const kaynak = istegeBagli ? ham.slice(1) : ham;
            const dolu = doldur(kaynak, veri);
            // İsteğe bağlı satır: yer tutucuların hepsi boşsa basılmaz.
            if (istegeBagli && yerTutucuVar(kaynak) && dolu.replace(/\*\*/g, "").trim() === kaynak.replace(/\{\{[^}]+\}\}/g, "").replace(/\*\*/g, "").trim()) continue;
            zenginMetin(dolu, X(o.x), y, o.g, boyut, "left", false, "#000");
            y += N().fontSize(boyut).heightOfString(dolu.replace(/\*\*/g, "") || " ", { width: o.g }) + (o.aralik ?? 2);
          }
          break;
        }
        case "tablo": {
          const boyut = o.boyut ?? varsayilanBoyut;
          const satirH = o.satirH ?? 15;
          let y = Y(o.y);
          for (const [etiketHam, degerHam, kalin] of o.satirlar) {
            const etiket = doldur(etiketHam, veri), deger = doldur(degerHam, veri);
            doc.rect(X(o.x), y, o.g, satirH).lineWidth(0.5).strokeColor("#333").stroke();
            doc.moveTo(X(o.x) + o.etiketG, y).lineTo(X(o.x) + o.etiketG, y + satirH).stroke();
            (kalin ? K() : N()).fontSize(boyut).fillColor("#000").text(etiket, X(o.x) + 3, y + (satirH - boyut) / 2 - 0.5, { width: o.etiketG - 6, lineBreak: false });
            (kalin ? K() : N()).text(deger, X(o.x) + o.etiketG + 3, y + (satirH - boyut) / 2 - 0.5, { width: o.g - o.etiketG - 6, align: o.hizaDeger || "right", lineBreak: false });
            y += satirH;
          }
          break;
        }
        case "kutu":
          doc.rect(X(o.x), Y(o.y), o.g, o.h).lineWidth(0.6).strokeColor("#333").stroke();
          break;
        case "cizgi":
          doc.moveTo(X(o.x1), Y(o.y1)).lineTo(X(o.x2), Y(o.y2)).lineWidth(0.8).strokeColor("#000").stroke();
          break;
        case "resim": {
          const dosya = path.join(BELGE_DIZINI, path.basename(o.dosya));
          if (existsSync(dosya)) doc.image(dosya, X(o.x), Y(o.y), { fit: [o.g ?? 60, o.h ?? 60], align: "center", valign: "center" });
          break;
        }
        case "qr": {
          const png = qrler.get(o);
          if (png) doc.image(png, X(o.x), Y(o.y), { width: o.boyut, height: o.boyut });
          break;
        }
      }
    }
    doc.end();
  });
}
