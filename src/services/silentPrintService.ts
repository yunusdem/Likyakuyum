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
 * Gönderilen HTML veya Metin verisini önizlemesiz olarak doğrudan varsayılan yazıcıya gönderir.
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
    allowBrowserFallback = false,
  } = options;

  if (!html && !text && !pdfBase64) {
    return {
      success: false,
      message: "Yazdırılacak içerik bulunamadı.",
    };
  }

  const finalText = text || (html ? extractTextFromHtml(html) : "");

  // 1. Doğrudan bu bilgisayara bağlı WebUSB termal fiş yazıcısını dene (Sıfır indirme / sıfır servis)
  if (finalText) {
    try {
      const usbSuccess = await printViaWebUsb(finalText, printerName);
      if (usbSuccess) {
        return {
          success: true,
          message: "Fiş doğrudan bu bilgisayara takılı USB yazıcıya yazdırıldı (İndirmesiz).",
        };
      }
    } catch {}
  }

  const isBrowserChoice =
    Boolean(printerName && (
      printerName.toLowerCase().includes("tarayıcı") ||
      printerName.toLowerCase().includes("browser")
    ));

  // 2. SADECE açıkça allowBrowserFallback === true ve kullanıcı tarayıcı seçtiyse:
  if (allowBrowserFallback && isBrowserChoice && html) {
    try {
      printViaHiddenIframe(html, title, isPos);
      return {
        success: true,
        message: "Fiş bu bilgisayarın tarayıcı yazdırma penceresine gönderildi.",
        fallbackUsed: true,
      };
    } catch (err: any) {
      return {
        success: false,
        message: "Tarayıcı yazdırma hatası: " + err.message,
      };
    }
  }

  const localEndpoints = [
    "http://127.0.0.1:5050/print",
    "http://localhost:5050/print",
    "http://127.0.0.1:25050/api/v1/yazici/print",
  ];

  // 2. Bu bilgisayardaki yerel sessiz yazdırma servisine (Port 5050) doğrudan POST et
  for (const ep of localEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(ep, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html,
          text: finalText,
          pdfBase64,
          printerName,
          copies,
          title,
          isPos,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          message: data.message || "Fiş tanımlı yazıcıya doğrudan gönderildi (Önizlemesiz).",
        };
      }
    } catch {
      // Port çalışmıyorsa diğer endpoint'e geç
    }
  }

  // 3. Yerel servis yanıt vermediyse Likya bulut sunucusu doğrudan yazdırmayı (IP / Ağ Yazıcısı) dene
  try {
    const backendRes = await apiClient.post<{ success: boolean; message: string }>("/yazici/direct-print", {
      printerName,
      documentTitle: title,
      htmlContent: html,
      textContent: finalText,
      isPos,
      copies,
    });
    if (backendRes.data && backendRes.data.success) {
      return {
        success: true,
        message: backendRes.data.message || "Fiş ağ/donanım yazıcısına doğrudan iletildi.",
      };
    }
  } catch {}

  // 4. SADECE kullanıcı veya çağıran kod açıkça izin verdiyse (allowBrowserFallback === true) tarayıcıya düş
  if (allowBrowserFallback && html) {
    try {
      printViaHiddenIframe(html, title, isPos);
      return {
        success: true,
        message: "Yerel yazdırma servisi açık olmadığı için tarayıcı yazdırma motoru kullanıldı.",
        fallbackUsed: true,
      };
    } catch (fallbackErr: any) {
      return {
        success: false,
        message: "Yazdırma başarısız oldu: " + fallbackErr.message,
      };
    }
  }

  // allowBrowserFallback false ise KESİNLİKLE Chrome önizleme penceresi açılmaz, hata bildirilir.
  return {
    success: false,
    message: "Yerel Yazdırma Servisi (Port 5050) veya ağ yazıcısı kapalı olduğu için çıktı alınamadı. Fişi sessiz yazdırmak için lütfen 'likya-yerel-yazici-baslat.bat' servisini başlatın.",
  };
}

/**
 * Gizli iframe ile yazdırma fallback mekanizması
 */
function printViaHiddenIframe(htmlContent: string, title: string, isPos: boolean) {
  let iframe = document.getElementById("likya-silent-print-iframe") as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "likya-silent-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
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
            size: ${isPos ? "auto" : "A4 portrait"};
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
  }, 250);
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
    console.warn("WebUSB yazdırma denemesi başarısız:", err);
    return false;
  }
}
