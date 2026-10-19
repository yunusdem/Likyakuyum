/**
 * Likya Kuyumcu ERP - Sessiz Yazdırma İstemcisi (Silent Print Service Client)
 * 
 * Tarayıcının yazdırma önizleme penceresini (print preview) açmadan,
 * F10 kısayolu ile doğrudan arka planda çalışan yerel servise (localhost:5050)
 * HTTP POST göndererek anında sessiz çıktı almayı sağlar.
 */

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

  const isBrowserChoice =
    Boolean(printerName && (
      printerName.toLowerCase().includes("tarayıcı") ||
      printerName.toLowerCase().includes("browser") ||
      printerName.toLowerCase().includes("varsayılan")
    ));

  // 1. Eğer doğrudan "Tarayıcı / Windows Varsayılan Yazıcısı" seçildiyse:
  if (isBrowserChoice && html) {
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

  // 2. Yerel sessiz yazdırma servisine (localhost:5050) doğrudan POST et
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(LOCAL_PRINT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        text,
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
    // Port 5050 çalışmıyorsa sessizce yakala
  }

  // 3. Yerel servis kapalıysa ve HTML varsa kullanıcıyı engellememek için tarayıcı yazdırmasına düş
  if (html) {
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

  return {
    success: false,
    message: "Yerel Yazdırma Servisi (localhost:5050) çalışmıyor. Fiş yazdırmak için 'likya-yerel-yazici-baslat.bat' dosyasını başlatabilir veya tarayıcı yazıcısını seçebilirsiniz.",
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
            font-family: ${isPos ? "'Courier New', Courier, monospace, Arial, sans-serif" : "Arial, Helvetica, sans-serif"};
            color: #000000;
            font-size: ${isPos ? "11px" : "12px"};
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
