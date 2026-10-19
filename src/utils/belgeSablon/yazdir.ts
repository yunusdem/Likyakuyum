import { triggerSilentPrint, SilentPrintResult } from "../../services/silentPrintService";
import type { FisHtml } from "./fisCikti";

export interface YaziciSecimi {
  printerId?: number | null;
  printerName?: string | null;
  copies?: number;
  isPos: boolean;
}

export function extractPlainTextFromFis(fis: FisHtml): string {
  if (!fis?.sahne || !Array.isArray(fis.sahne.cizimler)) return "";
  try {
    const texts = (fis.sahne.cizimler as any[])
      .filter((c) => c && c.tip === "metin" && c.metin)
      .map((c) => ({
        text: String(c.metin).replace(/\*\*/g, "").trim(),
        y: Math.round(Number(c.y || 0) / 9) * 9,
        x: Number(c.x || 0),
        align: c.hiza || "left",
      }))
      .filter((c) => c.text.length > 0)
      .sort((a, b) => a.y - b.y || a.x - b.x);

    const linesMap = new Map<number, typeof texts>();
    for (const t of texts) {
      if (!linesMap.has(t.y)) linesMap.set(t.y, []);
      linesMap.get(t.y)!.push(t);
    }

    const lines: string[] = [];
    const W_CHARS = 40; // 80mm standart termal karakter genişliği

    for (const [_, items] of linesMap) {
      if (items.length === 1) {
        const it = items[0];
        if (it.align === "center") {
          const pad = Math.max(0, Math.floor((W_CHARS - it.text.length) / 2));
          lines.push(" ".repeat(pad) + it.text);
        } else if (it.align === "right") {
          const pad = Math.max(0, W_CHARS - it.text.length);
          lines.push(" ".repeat(pad) + it.text);
        } else {
          lines.push(it.text);
        }
      } else {
        const leftItem = items.find((i) => i.align !== "right") || items[0];
        const rightItem = items.find((i) => i.align === "right") || items[items.length - 1];
        if (leftItem === rightItem) {
          lines.push(items.map((i) => i.text).join("  "));
        } else {
          const gap = Math.max(1, W_CHARS - leftItem.text.length - rightItem.text.length);
          lines.push(leftItem.text + " ".repeat(gap) + rightItem.text);
        }
      }
    }

    return lines.join("\r\n") + "\r\n\r\n\r\n";
  } catch {
    return "";
  }
}

/**
 * Şablondan çizilmiş fişi doğrudan tanımlı yazıcıya iletir.
 * Chrome önizleme penceresini açmaz, doğrudan donanım yazıcısına gönderir.
 */
export async function fisiYazdir(fis: FisHtml, y: YaziciSecimi): Promise<SilentPrintResult> {
  const plainText = extractPlainTextFromFis(fis);
  return triggerSilentPrint({
    html: fis.html,
    text: plainText || undefined,
    printerName: y.printerName ?? null,
    copies: y.copies || 1,
    isPos: y.isPos,
    title: fis.baslik,
    allowBrowserFallback: true,
  });
}
