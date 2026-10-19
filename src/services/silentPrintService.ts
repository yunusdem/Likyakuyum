/**
 * Likya Kuyumcu ERP - Sessiz Yazdırma İstemcisi (Silent Print Service Client)
 * 
 * Tarayıcının yazdırma önizleme penceresini (print preview) açmadan,
 * F10 kısayolu ile doğrudan arka planda çalışan yerel servise (localhost:5050)
 * HTTP POST göndererek anında sessiz çıktı almayı sağlar.
 */
import { apiClient } from "./apiClient";

export interface SilentPrintOptions {
  html?: string;
  text?: string;
  pdfBase64?: string;
  printerName?: string | null;
  copies?: number;
  title?: string;
  isPos?: boolean;
  allowBrowserFallback?: boolean;
}

export interface SilentPrintResult {
  success: boolean;
  message: string;
  fallbackUsed?: boolean;
}

export const LOCAL_PRINT_URL = "http://127.0.0.1:9100/print";
export const LOCAL_STATUS_URL = "http://127.0.0.1:9100/status";

/**
 * Yerel yazdırma servislerinin (Port 9100 PrinterAgent / printercekmeApp veya Port 5050)
 * çalışıp çalışmadığını kontrol eder. Öncelik 9100'dedir.
 */
export async function checkLocalPrintServiceOnline(): Promise<number | null> {
  const ports = [9100, 5050];
  for (const port of ports) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://127.0.0.1:${port}/status`, {
        method: "GET",
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);
      if (res && res.ok) return port;
    } catch {}

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        method: "GET",
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);
      if (res && res.ok) return port;
    } catch {}
  }
  return null;
}

/**
 * Modern Chromium Web Printing API (submitPrintJob) ile önizlemesiz doğrudan yazdırma
 */
async function printViaWebPrintingApi(html: string, printerName?: string | null, title?: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && "printing" in navigator && typeof (navigator as any).printing?.getPrinters === "function") {
      const printers = await (navigator as any).printing.getPrinters();
      if (Array.isArray(printers) && printers.length > 0) {
        let target = printers[0];
        if (printerName) {
          const pLower = printerName.toLowerCase();
          const match = printers.find((p: any) => {
            const name = (p.cachedAttributes?.().printerName || p.name || p.id || "").toLowerCase();
            return name && (name.includes(pLower) || pLower.includes(name));
          });
          if (match) target = match;
        }
        if (target && typeof target.submitPrintJob === "function") {
          const blob = new Blob([html], { type: "text/html" });
          await target.submitPrintJob(title || "Likya_Fis", blob, {});
          return true;
        }
      }
    }
  } catch (e) {
    console.debug("Web Printing API submitPrintJob atlandı:", e);
  }
  return false;
}

/**
 * Gönderilen HTML veya Metin verisini doğrudan yazıcıya gönderir.
 * Tarayıcı önizleme penceresini açmaz, arka plandaki yerel yazıcı servisine iletir.
 */
export async function triggerSilentPrint(options: SilentPrintOptions): Promise<SilentPrintResult> {
  const {
    html,
    text,
    pdfBase64,
    printerName = null,
    copies = 1,
    title = "Likya_Fis",
    isPos = true,
  } = options;

  if (!html && !text && !pdfBase64) {
    return {
      success: false,
      message: "Yazdırılacak içerik bulunamadı.",
    };
  }

  // 1. Yerel PrinterAgent (Port 9100 veya 5050) üzerinden doğrudan sessiz yazdırma
  const ports = [9100, 5050];
  let lastError = "";

  for (const port of ports) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`http://127.0.0.1:${port}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html,
          text,
          printerName,
          targetDevice: printerName,
          copies,
          isPos,
          title,
        }),
        signal: controller.signal,
      }).catch((e) => {
        lastError = e?.message || "Bağlantı kurulamadı";
        return null;
      });

      clearTimeout(timeoutId);

      if (res) {
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.success !== false) {
            return {
              success: true,
              message: data.message || `Fiş "${printerName || 'Tanımlı Yazıcı'}" cihazına başarıyla gönderildi.`,
            };
          } else {
            lastError = data.message || "Yazdırma servisi hata döndürdü.";
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          lastError = errData.message || `Servis HTTP ${res.status} hatası döndürdü.`;
        }
      }
    } catch (err: any) {
      lastError = err?.message || "Servis isteği başarısız.";
    }
  }

  // 2. Servise ulaşılamadıysa veya yazdırma başarısız olduysa:
  // Tarayıcı önizleme penceresini açmadan, kullanıcıya bildirim olarak hata döndürülür.
  return {
    success: false,
    message: lastError
      ? `Yazıcı servisine ulaşılamadı (${lastError}). Lütfen PrinterAgent.exe uygulamasının açık olduğunu kontrol ediniz.`
      : "Yazıcı servisine (PrinterAgent.exe) ulaşılamadı. Lütfen PrinterAgent uygulamasının açık olduğunu kontrol ediniz.",
  };
}

/**
 * Gizli iframe ile yazdırma mekanizması (Kurulumsuz Chromium ve Kiosk baskı)
 */
function printViaHiddenIframe(htmlContent: string, title: string, isPos: boolean) {
  let iframe = document.getElementById("likya-silent-print-iframe") as HTMLIFrameElement;
  if (iframe) {
    try {
      document.body.removeChild(iframe);
    } catch {}
  }

  iframe = document.createElement("iframe");
  iframe.id = "likya-silent-print-iframe";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: ${isPos ? "80mm auto" : "A4 portrait"};
            margin: ${isPos ? "0mm" : "5mm"} !important;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: 100%;
            max-width: ${isPos ? "78mm" : "210mm"};
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff;
            font-family: ${isPos ? "'Consolas', 'Segoe UI Mono', monospace" : "Arial, Helvetica, sans-serif"};
            color: #000000;
            font-weight: 600;
            font-size: ${isPos ? "12px" : "12px"};
            -webkit-font-smoothing: antialiased;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th, td {
            padding: 2px;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Iframe print error:", e);
    }
  }, 100);
}

/**
 * HTML içinden okunabilir temiz metin çıkarır (Out-Printer ve termal donanım yazı tipi için yedek)
 */
function extractTextFromHtml(html: string): string {
  try {
    if (typeof window === "undefined" || !window.DOMParser) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    const elements = doc.querySelectorAll("div, p, tr, h1, h2, h3, h4, h5, h6");
    if (elements.length > 0) {
      const lines: string[] = [];
      elements.forEach((el) => {
        const t = (el.textContent || "").trim();
        if (t && !lines.includes(t)) {
          lines.push(t);
        }
      });
      return lines.join("\r\n");
    }
    return (doc.body.textContent || "").replace(/\n\s*\n/g, "\n").trim();
  } catch {
    return "";
  }
}


