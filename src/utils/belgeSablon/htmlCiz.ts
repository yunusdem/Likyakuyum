import QRCode from "qrcode";
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
/** Görsel yalnızca data URL (png/jpeg) olarak kabul edilir; şablondan dış adres çağrılamaz. */
const gorselAdresi = (u: string | undefined) => (u && /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : "");

export const YAZI_AILESI = {
  mono: "'Courier New', Courier, monospace",
  sans: "Arial, Helvetica, sans-serif",
} as const;

function metinHtml(c: Extract<Cizim, { tip: "metin" }>, sol: number, ust: number): string {
  const hiza = c.hiza === "center" || c.hiza === "right" ? c.hiza : "left";
  const parcalar = kalinParcala(c.metin)
    .map(p => (p.kalin && !c.kalin ? `<b style="font-weight:700">${kacis(p.metin)}</b>` : kacis(p.metin))).join("");
  const stil = [
    "position:absolute", `left:${pt(sol + say(c.x))}`, `top:${pt(ust + say(c.y))}`, `width:${pt(c.g)}`,
    `font-size:${pt(c.boyut)}`, `line-height:${pt(c.boyut * SATIR_ORANI)}`, `font-weight:${c.kalin ? 700 : 400}`,
    `text-align:${hiza}`, `color:${renk(c.renk)}`, "margin:0", "padding:0",
    c.tekSatir ? `white-space:pre;overflow:hidden;text-overflow:ellipsis;height:${pt(c.boyut * SATIR_ORANI)}` : "white-space:pre-wrap;overflow-wrap:anywhere",
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

  for (const c of sahne.cizimler) {
    switch (c.tip) {
      case "kutu":
        cizgiler.push(`<rect x="${say(k + say(c.x))}" y="${say(k + say(c.y))}" width="${Math.max(0, say(c.g))}" height="${Math.max(0, say(c.h))}" fill="${c.zemin ? renk(c.zemin, "none") : "none"}"${say(c.kalinlik) > 0 ? ` stroke="#333" stroke-width="${say(c.kalinlik)}"` : ""}/>`);
        break;
      case "cizgi":
        cizgiler.push(`<line x1="${say(k + say(c.x1))}" y1="${say(k + say(c.y1))}" x2="${say(k + say(c.x2))}" y2="${say(k + say(c.y2))}" stroke="#000" stroke-width="${say(c.kalinlik)}"${c.kesikli ? ' stroke-dasharray="2.5 2"' : ""}/>`);
        break;
      case "metin":
        ustKatman.push(metinHtml(c, k, k));
        break;
      case "resim": {
        const src = gorselAdresi(gorseller[c.dosya]);
        // Termal ruloda firma görseli siyah-beyaz (yazıcı gri tonu noktalarla basar, eşikleme daha net çıkar)
        const sb = c.siyahBeyaz ? ";filter:grayscale(100%) contrast(500%)" : "";
        if (src) ustKatman.push(`<img alt="" src="${src}" style="position:absolute;left:${pt(k + say(c.x))};top:${pt(k + say(c.y))};width:${pt(c.g)};height:${pt(c.h)};object-fit:contain${sb}"/>`);
        break;
      }
      case "qr": {
        const src = await QRCode.toDataURL(String(c.icerik), { margin: 0, errorCorrectionLevel: "M", width: Math.max(16, Math.round(say(c.boyut) * 4)) });
        ustKatman.push(`<img alt="" src="${src}" style="position:absolute;left:${pt(k + say(c.x))};top:${pt(k + say(c.y))};width:${pt(c.boyut)};height:${pt(c.boyut)};image-rendering:pixelated"/>`);
        break;
      }
      case "filigran":
        ustKatman.push(`<div style="position:absolute;left:0;top:${pt(H / 2 - 20)};width:${pt(W)};text-align:center;transform:rotate(-35deg);opacity:0.22;font-weight:700;font-size:${pt(Math.min(34, W / 8))};color:${renk(c.renk, "#9a9a9a")};white-space:nowrap;pointer-events:none">${kacis(c.metin)}</div>`);
        break;
    }
  }

  const svg = cizgiler.length
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${pt(W)}" height="${pt(H)}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">${cizgiler.join("")}</svg>`
    : "";
  const html = `<div class="belge-sablon" style="position:relative;width:${pt(W)};height:${pt(H)};background:#fff;color:#000;font-family:${YAZI_AILESI[sahne.yaziTipi]};overflow:hidden;box-sizing:border-box;margin:0;padding:0">${svg}${ustKatman.join("")}</div>`;
  return { html, genislik: W, yukseklik: H, sahne };
}

/** Yazdırma için tam HTML belgesi (tarayıcı iframe yedeği). */
export function yazdirmaBelgesi(govde: string, baslik: string, genislikPt: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${kacis(baslik)}</title><style>
@page { size: ${pt(genislikPt)} auto; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
html, body { margin: 0 !important; padding: 0 !important; background: #fff; }
</style></head><body>${govde}</body></html>`;
}
