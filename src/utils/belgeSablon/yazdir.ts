import { PrinterService } from "../../services/printerService";
import { yazdirmaBelgesi } from "./htmlCiz";
import type { FisHtml } from "./fisCikti";

export interface YaziciSecimi {
  printerId?: number | null;
  printerName?: string | null;
  copies?: number;
  isPos: boolean;
}

/**
 * Şablondan çizilmiş fişi yazdırır: önce tanımlı yazıcıya doğrudan (sunucu), olmazsa tarayıcının gizli
 * iframe'i (yalnızca fiş basılır, sayfa değil). Önizleme pencerelerinin ortak yazdırma yolu.
 */
export async function fisiYazdir(fis: FisHtml, y: YaziciSecimi): Promise<void> {
  try {
    const res = await PrinterService.directPrint({
      printerId: y.printerId ?? null,
      printerName: y.printerName ?? null,
      documentTitle: fis.baslik,
      htmlContent: fis.html,
      isPos: y.isPos,
      copies: y.copies || 1,
    });
    if (res.success && !res.fallbackToBrowser) return;
  } catch {
    // Tarayıcı yedeğine devam edilir
  }

  let iframe = document.getElementById("sablon-yazdir-iframe") as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "sablon-yazdir-iframe";
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);
  }
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(yazdirmaBelgesi(fis.html, fis.baslik, fis.genislik));
  doc.close();
  const pencere = iframe.contentWindow;
  setTimeout(() => { pencere?.focus(); pencere?.print(); }, 100);
}
