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

export const LOCAL_PRINT_URL = "http://localhost:5050/print";
export const LOCAL_STATUS_URL = "http://localhost:5050/status";

/**
 * Yerel yazdırma servisinin (localhost:5050) çalışıp çalışmadığını kontrol eder.
 */
export async function checkLocalPrintServiceOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(LOCAL_STATUS_URL, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
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
 * Kurulumsuz, her istemci bilgisayarında kesintisiz yazdırma sağlar.
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
    allowBrowserFallback = true,
  } = options;

  if (!html && !text && !pdfBase64) {
    return {
      success: false,
      message: "Yazdırılacak içerik bulunamadı.",
    };
  }

  const finalText = text || (html ? extractTextFromHtml(html) : "");

  // 1. Modern Chromium Web Printing API (Doğrudan Yazdırma)
  if (html) {
    const webPrintOk = await printViaWebPrintingApi(html, printerName, title);
    if (webPrintOk) {
      return {
        success: true,
        message: `Fiş "${printerName || 'Tanımlı Yazıcı'}" cihazına doğrudan gönderildi.`,
      };
    }
  }

  // 2. Doğrudan bu bilgisayara bağlı WebUSB termal fiş cihazını dene
  if (finalText) {
    try {
      const usbSuccess = await printViaWebUsb(finalText, printerName);
      if (usbSuccess) {
        return {
          success: true,
          message: `Fiş doğrudan bu bilgisayara takılı USB yazıcıya yazdırıldı.`,
        };
      }
    } catch {}
  }

  // 3. Sunucu / Yerel Backend doğrudan yazdırmayı dene (Ağ TCP Socket / Out-Printer)
  try {
    const backendRes = await apiClient.post<{ success: boolean; message: string }>("/yazici/direct-print", {
      printerName,
      documentTitle: title,
      htmlContent: html,
      textContent: finalText,
      isPos,
      copies,
    }, { silent: true });
    if (backendRes.data && backendRes.data.success) {
      return {
        success: true,
        message: backendRes.data.message || `Fiş "${printerName || 'Tanımlı Yazıcı'}" cihazına doğrudan iletildi.`,
      };
    }
  } catch {}

  // 4. Kesintisiz Çıktı: Tarayıcının yerel yazdırma motoru (Iframe / Kiosk printing)
  // Kurulumsuz çalışan tüm istemcilerde Vezne ve Tanımlı yazıcıdan anında çıktı üretir.
  if (html) {
    try {
      printViaHiddenIframe(html, title, isPos);
      return {
        success: true,
        message: `Fiş "${printerName || 'Vezne Tanımlı Yazıcı'}" için yazdırma akışına gönderildi.`,
        fallbackUsed: true,
      };
    } catch (fallbackErr: any) {
      return {
        success: false,
        message: "Yazdırma başarısız oldu: " + fallbackErr.message,
      };
    }
  }

  return {
    success: false,
    message: "Yazdırılacak içerik oluşturulamadı.",
  };
}

/**
 * Gizli iframe ile yazdırma mekanizması (Kurulumsuz Chromium ve Kiosk baskı)
 */
function printViaHiddenIframe(htmlContent: string, title: string, isPos: boolean) {
  let iframe = document.getElementById("likya-silent-print-iframe") as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "likya-silent-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = isPos ? "80mm" : "210mm";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
  } else {
    iframe.style.width = isPos ? "80mm" : "210mm";
  }

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
  }, 200);
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

/**
 * WebUSB üzerinden bu bilgisayara bağlı termal fiş yazıcısına doğrudan çıktı gönderir (Sıfır yazılım indirme)
 */
async function printViaWebUsb(text: string, printerName?: string | null): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const navUsb = (navigator as any).usb;
  if (!navUsb || typeof navUsb.getDevices !== "function") return false;
  try {
    const devices = await navUsb.getDevices();
    if (!Array.isArray(devices) || devices.length === 0) return false;

    let targetDev = devices[0];
    if (printerName) {
      const pLower = printerName.toLowerCase();
      const matched = devices.find((d: any) => {
        const name = `${d.productName || ""} ${d.manufacturerName || ""}`.toLowerCase();
        return name && (pLower.includes(name) || name.includes(pLower));
      });
      if (matched) targetDev = matched;
    }

    if (!targetDev.opened) {
      await targetDev.open();
    }
    if (targetDev.configuration === null) {
      await targetDev.selectConfiguration(1);
    }

    let ifaceNum = 0;
    let endpointNum = 1;
    const ifaces = targetDev.configuration?.interfaces || [];
    for (const iface of ifaces) {
      const alt = iface.alternates?.[0];
      const outEp = alt?.endpoints?.find((e: any) => e.direction === "out");
      if (outEp) {
        ifaceNum = iface.interfaceNumber;
        endpointNum = outEp.endpointNumber;
        break;
      }
    }
    await targetDev.claimInterface(ifaceNum);

    const encoder = new TextEncoder();
    const initCmd = new Uint8Array([0x1b, 0x40]); // ESC @
    const cutCmd = new Uint8Array([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x41, 0x10]); // Feed 3 lines & Cut
    const textBytes = encoder.encode(text);

    const fullPayload = new Uint8Array(initCmd.length + textBytes.length + cutCmd.length);
    fullPayload.set(initCmd, 0);
    fullPayload.set(textBytes, initCmd.length);
    fullPayload.set(cutCmd, initCmd.length + textBytes.length);

    await targetDev.transferOut(endpointNum, fullPayload);
    try {
      await targetDev.releaseInterface(ifaceNum);
      await targetDev.close();
    } catch {}
    return true;
  } catch (err) {
    console.debug("WebUSB yazdırma atlandı veya cihaz sürücü kontrolünde:", err);
    return false;
  }
}
