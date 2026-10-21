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
    const W_CHARS = 40; // 80mm standart termal karakter genişliği

    const rawElements: { type: "text" | "divider"; text: string; rawY: number; x: number; g: number; align: string }[] = [];
    for (const c of (fis.sahne.cizimler as any[])) {
      if (!c) continue;
      if (c.tip === "metin" && c.metin) {
        const t = String(c.metin).replace(/\*\*/g, "").trim();
        if (t) {
          rawElements.push({
            type: "text",
            text: t,
            rawY: Number(c.y || 0),
            x: Number(c.x || 0),
            g: Number(c.g || 0),
            align: c.hiza || "left",
          });
        }
      } else if (c.tip === "cizgi") {
        rawElements.push({
          type: "divider",
          text: "-".repeat(W_CHARS),
          rawY: Number(c.y1 || c.y || 0),
          x: 0,
          g: W_CHARS,
          align: "left",
        });
      }
    }

    rawElements.sort((a, b) => a.rawY - b.rawY || a.x - b.x);

    const lines: string[] = [];
    let currentGroup: typeof rawElements = [];
    let currentGroupY = -999;

    const flushGroup = () => {
      if (currentGroup.length === 0) return;
      currentGroup.sort((a, b) => a.x - b.x);
      if (currentGroup.length === 1) {
        const it = currentGroup[0];
        if (it.align === "center") {
          const pad = Math.max(0, Math.floor((W_CHARS - it.text.length) / 2));
          lines.push(" ".repeat(pad) + it.text);
        } else if (it.align === "right") {
          const pad = Math.max(0, W_CHARS - it.text.length);
          lines.push(" ".repeat(pad) + it.text);
        } else {
          lines.push(it.text);
        }
      } else if (currentGroup.length === 2) {
        const left = currentGroup[0];
        const right = currentGroup[1];
        const gap = Math.max(1, W_CHARS - left.text.length - right.text.length);
        lines.push(left.text + " ".repeat(gap) + right.text);
      } else {
        let lineStr = currentGroup[0].text;
        for (let i = 1; i < currentGroup.length - 1; i++) {
          lineStr += " " + currentGroup[i].text;
        }
        const last = currentGroup[currentGroup.length - 1];
        const gap = Math.max(1, W_CHARS - lineStr.length - last.text.length);
        lines.push(lineStr + " ".repeat(gap) + last.text);
      }
      currentGroup = [];
    };

    for (const el of rawElements) {
      if (el.type === "divider") {
        flushGroup();
        if (lines.length === 0 || lines[lines.length - 1] !== "-".repeat(W_CHARS)) {
          lines.push("-".repeat(W_CHARS));
        }
      } else {
        if (currentGroup.length === 0) {
          currentGroup.push(el);
          currentGroupY = el.rawY;
        } else if (Math.abs(el.rawY - currentGroupY) <= 4.5) {
          currentGroup.push(el);
        } else {
          flushGroup();
          currentGroup.push(el);
          currentGroupY = el.rawY;
        }
      }
    }
    flushGroup();

    return lines.join("\r\n") + "\r\n\r\n\r\n";
  } catch {
    return "";
  }
}

/**
 * Şablondan çizilmiş fişi (veya fiş listesini) doğrudan tanımlı yazıcıya iletir.
 * Chrome önizleme penceresini açmaz, doğrudan donanım yazıcısına gönderir.
 * 2 veya daha fazla fiş varsa her birini sırayla yazıcıya iletir.
 */
export async function fisiYazdir(fis: FisHtml | FisHtml[], y: YaziciSecimi): Promise<SilentPrintResult> {
  const fisler = Array.isArray(fis) ? fis : [fis];
  if (fisler.length === 0) {
    return { success: true, message: "Yazdırılacak fiş bulunamadı." };
  }

  if (fisler.length === 1) {
    const tekFis = fisler[0];
    const plainText = extractPlainTextFromFis(tekFis);
    return triggerSilentPrint({
      html: tekFis.html,
      text: plainText || undefined,
      printerName: y.printerName ?? null,
      copies: y.copies || 1,
      isPos: y.isPos,
      title: tekFis.baslik,
      allowBrowserFallback: false,
    });
  }

  let sonSonuc: SilentPrintResult = { success: true, message: `${fisler.length} adet fiş başarıyla yazdırıldı.` };
  for (let i = 0; i < fisler.length; i++) {
    const slip = fisler[i];
    const plainText = extractPlainTextFromFis(slip);
    const res = await triggerSilentPrint({
      html: slip.html,
      text: plainText || undefined,
      printerName: y.printerName ?? null,
      copies: y.copies || 1,
      isPos: y.isPos,
      title: slip.baslik || `Fis_${i + 1}`,
      allowBrowserFallback: false,
    });
    if (!res.success) {
      return res;
    }
    sonSonuc = res;
    // Birden çok fişte yazıcının kesim ve kuyruk işlemini rahat yapabilmesi için küçük ara
    if (i < fisler.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return {
    success: true,
    message: `${fisler.length} adet fiş başarıyla yazıcıya gönderildi.`,
  };
}
