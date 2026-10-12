import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../../utils/ApiError.js";
import { sahneKur, kalinParcala, SATIR_ORANI, type BelgeSablon, type Cizim } from "./sablonCekirdek.js";

/**
 * Belge / rapor şablon motoru — PDF çizici.
 *
 * Şablon: `Backend/belge/*.json` — düzen dosyada, veri çağıran taraftan gelir. Crystal Reports'taki
 * "rpt + parametre" mantığının web karşılığıdır: şablon değişikliği kod değişikliği gerektirmez.
 * Yerleşim (koşullar, yer tutucular, liste, kayma) `sablonCekirdek.ts`'te; burada yalnızca çizilir.
 * Termal yazıcının HTML çizicisi aynı çekirdeği kullanır (docs/FIS_TASARIM_YOL_HARITASI.md).
 */

export { doldur, kosulGecti } from "./sablonCekirdek.js";
export type { BelgeOge, BelgeSablon } from "./sablonCekirdek.js";

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

const ilkVar = (adaylar: (string | undefined)[]) => adaylar.find((f): f is string => !!f && existsSync(f));
const fontKlasoru = path.join(process.env.WINDIR || "C:/Windows", "Fonts");

/** Türkçe destekli TTF yazı tipi; e-Döviz PDF'i ile aynı arama sırası (EBELGE_PDF_FONT). */
export function yaziTipleri(): { normal: string; kalin: string } {
  const normal = ilkVar([process.env.EBELGE_PDF_FONT, path.join(fontKlasoru, "arial.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"]);
  if (!normal) throw ApiError.badRequest("PDF yazı tipi bulunamadı. Sunucuda EBELGE_PDF_FONT ile Türkçe destekli bir TTF yazı tipi tanımlayın.");
  const kalin = ilkVar([process.env.EBELGE_PDF_FONT_BOLD, path.join(fontKlasoru, "arialbd.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"]);
  return { normal, kalin: kalin || normal };
}

/** Termal fiş görünümü için eş aralıklı yazı tipi; yoksa normal yazı tipine düşer. */
export function monoYaziTipleri(): { normal: string; kalin: string } {
  const normal = ilkVar([path.join(fontKlasoru, "cour.ttf"), "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf"]);
  if (!normal) return yaziTipleri();
  const kalin = ilkVar([path.join(fontKlasoru, "courbd.ttf"), "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationMono-Bold.ttf"]);
  return { normal, kalin: kalin || normal };
}

/**
 * Görsel dosyası çözücü: şablondaki `dosya` adını PNG/JPG baytına çevirir. Varsayılan: `Backend/belge/` klasörü.
 * Firma görselleri (logo, imza) Faz 4'te çağıran tarafından verilir.
 */
export type GorselCozucu = (dosya: string) => Buffer | null;
export const belgeKlasoruGorseli: GorselCozucu = (dosya) => {
  const tam = path.join(BELGE_DIZINI, path.basename(String(dosya || "")));
  return /\.(png|jpe?g)$/i.test(tam) && existsSync(tam) ? readFileSync(tam) : null;
};

/**
 * Şablonu veriyle çizer, PDF baytlarını döner.
 * Sayfa: A4, A5 veya [g,h] punto; h=0 ise içeriğe göre (termal rulo).
 */
export async function belgeCiz(sablon: BelgeSablon, veri: Record<string, any>, baslik?: string, gorsel: GorselCozucu = belgeKlasoruGorseli): Promise<Buffer> {
  const font = sablon.yaziTipi === "mono" ? monoYaziTipleri() : yaziTipleri();
  const sahne = sahneKur(sablon, veri);

  // QR görüntüleri önceden üretilir (pdfkit senkron çizer).
  const qrler = new Map<Cizim, Buffer>();
  for (const c of sahne.cizimler) {
    if (c.tip !== "qr") continue;
    qrler.set(c, await QRCode.toBuffer(c.icerik, { type: "png", margin: 0, errorCorrectionLevel: "M", width: Math.round(c.boyut * 4) }));
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [sahne.genislik, sahne.yukseklik], margin: sahne.kenar, info: { Title: baslik || sablon.ad || sablon.kod } });
    const parcalar: Buffer[] = [];
    doc.on("data", p => parcalar.push(p));
    doc.on("end", () => resolve(Buffer.concat(parcalar)));
    doc.on("error", reject);

    const sol = sahne.kenar, ust = sahne.kenar;
    const N = () => doc.font(font.normal), K = () => doc.font(font.kalin);
    const X = (x: number) => sol + x, Y = (y: number) => ust + y;

    // Katman sırası HTML çiziciyle aynı: filigran → kutu / çizgi → yazı, görsel, karekod.
    const katman = (c: Cizim) => (c.tip === "filigran" ? 0 : c.tip === "kutu" || c.tip === "cizgi" ? 1 : 2);
    const sirali = sahne.cizimler.map((c, i) => ({ c, i })).sort((a, b) => katman(a.c) - katman(b.c) || a.i - b.i).map(x => x.c);
    for (const c of sirali) {
      switch (c.tip) {
        case "filigran": {
          doc.save();
          const cx = doc.page.width / 2, cy = doc.page.height / 2;
          doc.rotate(-35, { origin: [cx, cy] });
          K().fontSize(Math.min(34, doc.page.width / 8)).fillColor(c.renk).opacity(0.22)
            .text(c.metin, cx - 300, cy - 20, { width: 600, align: "center" });
          doc.restore();
          break;
        }
        case "metin": {
          doc.fontSize(c.boyut).fillColor(c.renk);
          const x = X(c.x), y = Y(c.y);
          const parcalar = kalinParcala(c.metin);
          const duz = parcalar.map(p => p.metin).join("");
          const secenek = { width: c.g, align: c.hiza, lineBreak: !c.tekSatir, height: c.tekSatir ? c.boyut * SATIR_ORANI : undefined, ellipsis: c.tekSatir ? true : undefined, lineGap: c.boyut * (SATIR_ORANI - 1.15) };
          // Satır içi kalın, ortalı / sağa hizalı metinde tek satıra sığıyorsa parçaların toplam genişliğiyle hizalanır.
          const parcaGenisligi = () => parcalar.reduce((t, p) => t + (p.kalin || c.kalin ? K() : N()).fontSize(c.boyut).widthOfString(p.metin), 0);
          const hizaliParca = parcalar.length > 1 && c.hiza !== "left" && !c.kalin && parcaGenisligi() <= c.g;
          if (parcalar.length <= 1 || (c.hiza !== "left" && !hizaliParca)) {
            (c.kalin || (parcalar.length === 1 && parcalar[0].kalin) ? K() : N()).text(duz, x, y, secenek);
          } else {
            // Satır içi kalın: parçalar art arda (tek satır).
            const w = parcaGenisligi();
            let cx = c.hiza === "center" ? x + (c.g - w) / 2 : c.hiza === "right" ? x + c.g - w : x;
            for (const p of parcalar) {
              (p.kalin || c.kalin ? K() : N()).fontSize(c.boyut);
              doc.text(p.metin, cx, y, { lineBreak: false });
              cx += doc.widthOfString(p.metin);
            }
          }
          if (c.altCizgi) {
            const w = Math.min(c.g, (c.kalin ? K() : N()).fontSize(c.boyut).widthOfString(duz));
            const bx = c.hiza === "center" ? x + (c.g - w) / 2 : c.hiza === "right" ? x + c.g - w : x;
            doc.moveTo(bx, y + c.boyut + 1.5).lineTo(bx + w, y + c.boyut + 1.5).lineWidth(0.6).strokeColor(c.renk).stroke();
          }
          break;
        }
        case "kutu":
          doc.rect(X(c.x), Y(c.y), c.g, c.h);
          if (c.zemin && c.kalinlik > 0) doc.lineWidth(c.kalinlik).fillAndStroke(c.zemin, "#333");
          else if (c.zemin) doc.fill(c.zemin);
          else if (c.kalinlik > 0) doc.lineWidth(c.kalinlik).strokeColor("#333").stroke();
          break;
        case "cizgi":
          doc.save();
          if (c.kesikli) doc.dash(2.5, { space: 2 });
          doc.moveTo(X(c.x1), Y(c.y1)).lineTo(X(c.x2), Y(c.y2)).lineWidth(c.kalinlik).strokeColor("#000").stroke();
          doc.restore();
          break;
        case "resim": {
          const bayt = gorsel(c.dosya);
          if (bayt) {
            try { doc.image(bayt, X(c.x), Y(c.y), { fit: [c.g, c.h], align: "center", valign: "center" }); }
            catch { /* bozuk görsel belgeyi durdurmaz */ }
          }
          break;
        }
        case "qr": {
          const png = qrler.get(c);
          if (png) doc.image(png, X(c.x), Y(c.y), { width: c.boyut, height: c.boyut });
          break;
        }
      }
    }
    doc.end();
  });
}
