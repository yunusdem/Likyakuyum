import QRCode from "qrcode";
import { GIB_LOGO_DATA_URL } from "./gibLogoBase64";
import {
  sahneKur, kalinParcala, SATIR_ORANI, YAZI_TIPLERI,
  type BelgeSablon, type Cizim, type Sahne,
} from "../../../Backend/src/services/belge/sablonCekirdek";

/**
 * Belge şablonunun HTML çizicisi — termal yazıcı ve ekran önizlemesi.
 *
 * Yerleşim sunucudaki PDF motoruyla aynı çekirdekten (`sablonCekirdek.ts`) gelir; burada yalnızca
 * çizim listesi mutlak konumlu HTML'e çevrilir. Çıktı tek parçadır (görseller ve karekod data URL),
 * stil satır içidir: yerel yazdırma servisinin sarmalayıcısı veya iframe ne eklerse eklesin bozulmaz.
 * Ölçüler punto (pt); 80 mm rulo = 226,77 pt.
 */

export interface SablonHtmlSonucu { html: string; genislik: number; yukseklik: number; sahne: Sahne }

const kacis = (s: string) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
/** Şablondan gelen her ölçü sayıya zorlanır; metin HTML / SVG özniteliğine sızamaz. */
const say = (n: unknown) => { const v = Number(n); return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; };
const pt = (n: unknown) => `${say(n)}pt`;
/** Yalnızca güvenli renk yazımı (#rgb, #rrggbb); aksi hâlde siyah. */
const renk = (r: string, varsayilan = "#000") => (/^#[0-9a-fA-F]{3,8}$/.test(String(r || "")) ? r : varsayilan);
/** Görsel data URL veya geçerli adres olarak kabul edilir. */
const gorselAdresi = (u: string | undefined): string => {
  if (!u) return "";
  const trimmed = u.trim();
  if (trimmed.startsWith("data:image/")) {
    return trimmed.replace(/\s+/g, "");
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  return "";
};

export const YAZI_AILESI = {
  mono: "'Consolas', 'Segoe UI Mono', 'Courier New', monospace",
  sans: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
} as const;

/**
 * Yazı tiplerinin (yükselen + inen) / em oranı. Tarayıcı satır kutusunda yazıyı bu yükseklik ile satır yüksekliği
 * (SATIR_ORANI) farkının yarısı kadar yukarı koyar; PDF motoru (pdfkit) koymaz. Standart görünümde bu fark kapatılır.
 */
const YAZI_YUKSEKLIGI: Record<string, number> = { "Tahoma": 1.207, "Arial": 1.117, "Verdana": 1.215, "Times New Roman": 1.107, "Georgia": 1.136, "Courier New": 1.133 };

/**
 * `standart` (şablonun yaziGorunumu "standart"): normal 400 / kalın 700, öğenin rengi, kerning yok — PDF ile aynı.
 * Değilse termal görünüm: 600 / 800, hep siyah.
 */
function metinHtml(c: Extract<Cizim, { tip: "metin" }>, sol: number, ust: number, standart = false): string {
  const hiza = c.hiza === "center" || c.hiza === "right" ? c.hiza : "left";
  const kalinAgirlik = standart ? 700 : 800;
  const yaziRengi = standart ? renk(c.renk, "#000000") : "#000000";
  const parcalar = kalinParcala(c.metin)
    .map(p => (p.kalin && !c.kalin ? `<b style="font-weight:${kalinAgirlik};color:${yaziRengi}">${kacis(p.metin)}</b>` : kacis(p.metin))).join("");
  const rawBoyut = say(c.boyut);
  const etkinBoyut = rawBoyut > 0 ? rawBoyut : 7.5;
  const kayma = standart ? ((YAZI_YUKSEKLIGI[c.font || "Arial"] ?? 1.15) - SATIR_ORANI) / 2 * etkinBoyut : 0;
  const wrapStyle = c.tekSatir
    ? `white-space:${standart ? "pre" : "nowrap"};overflow:hidden;text-overflow:ellipsis;max-width:${pt(c.g)};height:${pt(etkinBoyut * SATIR_ORANI)}`
    : `white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;max-width:${pt(c.g)}`;
  const stil = [
    "position:absolute", `left:${pt(sol + say(c.x))}`, `top:${pt(ust + say(c.y))}`, `width:${pt(c.g)}`,
    `font-size:${pt(etkinBoyut)}`, `line-height:${pt(etkinBoyut * SATIR_ORANI)}`, `font-weight:${c.kalin ? kalinAgirlik : standart ? 400 : 600}`,
    `text-align:${hiza}`, `color:${yaziRengi}`, "margin:0", "padding:0",
    standart ? "font-kerning:none" : "",
    kayma ? `transform:translateY(${pt(kayma)})` : "",
    "-webkit-font-smoothing:antialiased",
    wrapStyle,
    c.font && YAZI_TIPLERI[c.font] ? `font-family:${YAZI_TIPLERI[c.font].css}` : "",
    c.italik ? "font-style:italic" : "",
    c.altCizgi ? "text-decoration:underline;text-underline-offset:1.5pt" : "",
  ].filter(Boolean).join(";");
  return `<div style="${stil}">${parcalar}</div>`;
}

/**
 * Şablonu veriyle HTML'e çizer.
 * @param gorseller şablondaki resim adı → data URL (sunucudan gelir)
 */
export async function sablonHtml(sablon: BelgeSablon, veri: Record<string, any>, gorseller: Record<string, string> = {}): Promise<SablonHtmlSonucu> {
  const sahne = sahneKur(sablon, veri);
  const { kenar: k, genislik: W, yukseklik: H } = sahne;
  const cizgiler: string[] = [];
  const ustKatman: string[] = [];
  const standart = !!sahne.standart;
  // Termal görünümde çizgi en az 1 pt (ruloda kaybolmasın); standart görünümde kendi kalınlığı
  const kalinlik = (n: unknown) => (standart ? Math.max(0.1, say(n)) : Math.max(1, say(n)));

  for (const c of sahne.cizimler) {
    switch (c.tip) {
      case "kutu":
        cizgiler.push(`<rect x="${say(k + say(c.x))}" y="${say(k + say(c.y))}" width="${Math.max(0, say(c.g))}" height="${Math.max(0, say(c.h))}" fill="${c.zemin ? renk(c.zemin, "none") : "none"}"${say(c.kalinlik) > 0 ? ` stroke="${renk(c.renk ?? "", "#000")}" stroke-width="${kalinlik(c.kalinlik)}"` : ""}/>`);
        break;
      case "cizgi":
        cizgiler.push(`<line x1="${say(k + say(c.x1))}" y1="${say(k + say(c.y1))}" x2="${say(k + say(c.x2))}" y2="${say(k + say(c.y2))}" stroke="${renk(c.renk ?? "", "#000")}" stroke-width="${kalinlik(c.kalinlik)}"${c.noktali ? ' stroke-dasharray="1 1.5"' : c.kesikli ? ' stroke-dasharray="3 2"' : ""}/>`);
        break;
      case "metin":
        ustKatman.push(metinHtml(c, k, k, standart));
        break;
      case "resim": {
        let src = gorselAdresi(gorseller[c.dosya]);
        if (!src && (c.dosya === "logo-gib.png" || c.dosya.includes("gib"))) {
          src = GIB_LOGO_DATA_URL;
        }
        // Termal ruloda firma görseli siyah-beyaz (yazıcı gri tonu noktalarla basar, eşikleme daha net çıkar; FIS_TASARIM 4.3).
        // Çekirdek bayrağı yalnız 80 mm'de firma görseline koyar (ortak alan denetimi 19.11.2026, #53)
        const sb = c.siyahBeyaz ? ";filter:grayscale(100%) contrast(500%)" : "";
        if (src) {
          ustKatman.push(`<img alt="" src="${src}" loading="eager" decoding="sync" style="position:absolute;left:${pt(k + say(c.x))};top:${pt(k + say(c.y))};width:${pt(c.g)};height:${pt(c.h)};object-fit:contain;image-rendering:-webkit-optimize-contrast;-webkit-print-color-adjust:exact;print-color-adjust:exact${sb}"/>`);
        }
        break;
      }
      case "qr": {
        const rawContent = String(c.icerik || "").trim() || "LIKYA_KUYUM";
        try {
          const svgRaw = await QRCode.toString(rawContent, {
            type: "svg",
            margin: 0,
            errorCorrectionLevel: "M",
          });
          const svgClean = svgRaw
            .replace(/<\?xml[\s\S]*?\?>/i, "")
            .replace(/width="[^"]*"/i, 'width="100%"')
            .replace(/height="[^"]*"/i, 'height="100%"')
            .replace(/<svg\b/i, '<svg style="width:100%;height:100%;display:block;shape-rendering:crispEdges;"');
          ustKatman.push(`<div style="position:absolute;left:${pt(k + say(c.x))};top:${pt(k + say(c.y))};width:${pt(c.boyut)};height:${pt(c.boyut)};overflow:hidden;box-sizing:border-box;">${svgClean}</div>`);
        } catch {
          const src = await QRCode.toDataURL(rawContent, { margin: 0, errorCorrectionLevel: "M", width: Math.max(240, Math.round(say(c.boyut) * 4)) });
          ustKatman.push(`<img alt="QR" src="${src}" loading="eager" decoding="sync" style="position:absolute;left:${pt(k + say(c.x))};top:${pt(k + say(c.y))};width:${pt(c.boyut)};height:${pt(c.boyut)};image-rendering:pixelated;-webkit-print-color-adjust:exact;print-color-adjust:exact"/>`);
        }
        break;
      }
      case "filigran":
        ustKatman.push(`<div style="position:absolute;left:0;top:${pt(H / 2 - 20)};width:${pt(W)};text-align:center;transform:rotate(-35deg);opacity:0.22;font-weight:800;font-size:${pt(Math.min(34, W / 8))};color:${renk(c.renk, "#9a9a9a")};white-space:nowrap;pointer-events:none">${kacis(c.metin)}</div>`);
        break;
    }
  }

  const svg = cizgiler.length
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${pt(W)}" height="${pt(H)}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">${cizgiler.join("")}</svg>`
    : "";
  const html = `<div class="belge-sablon" style="position:relative;width:${pt(W)};height:${pt(H)};background:#fff;color:#000000;font-family:${YAZI_AILESI[sahne.yaziTipi]};overflow:hidden;box-sizing:border-box;margin:0;padding:0">${svg}${ustKatman.join("")}</div>`;
  return { html, genislik: W, yukseklik: H, sahne };
}
// yazdirmaBelgesi (tarayıcı iframe yedeğinin tam HTML belgesi) kaldırıldı: çağıranı yoktu; tarayıcıdan yazdırma
// önizleme pencerelerindeki "Tarayıcıdan Yazdır" düğmesiyle yapılır (ortak alan denetimi 19.11.2026, #55)
