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

export const TARGET_PRINTER_AGENT_VERSION = "1.0.5";

/**
 * İki semver sürümünü karşılaştırır (örn: "1.0.1" > "1.0.0").
 */
export function isNewerVersion(v1: string, v2: string): boolean {
  const p1 = String(v1 || "").replace(/[^0-9.]/g, "").split(".").map(Number);
  const p2 = String(v2 || "").replace(/[^0-9.]/g, "").split(".").map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false;
}

function showPrinterAgentUpdateToast(oldVer: string, newVer: string): void {
  if (typeof document === "undefined") return;
  const existing = document.getElementById("likya-printer-agent-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "likya-printer-agent-toast";
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #0f172a;
    color: #f8fafc;
    border: 1px solid rgba(56, 189, 248, 0.4);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.2);
    border-radius: 12px;
    padding: 14px 18px;
    z-index: 9999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 380px;
    transition: all 0.3s ease;
  `;

  toast.innerHTML = `
    <div style="width:28px;height:28px;border-radius:8px;background:rgba(56,189,248,0.15);display:flex;align-items:center;justify-content:center;color:#38bdf8;font-size:16px;flex-shrink:0;">
      🖨️
    </div>
    <div style="flex:1;">
      <div style="font-weight:600;color:#ffffff;margin-bottom:2px;">Yazıcı Köprüsü Güncelleniyor</div>
      <div style="color:#94a3b8;font-size:12px;line-height:1.3;">v${oldVer || '1.0.0'} &rarr; v${newVer} otomatik kuruluyor...</div>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    try {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 400);
    } catch {}
  }, 6000);
}

function showPrinterAgentUpdatedSuccessToast(version: string): void {
  if (typeof document === "undefined") return;
  const existing = document.getElementById("likya-printer-agent-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "likya-printer-agent-toast";
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #0f172a;
    color: #f8fafc;
    border: 1px solid rgba(34, 197, 94, 0.4);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(34, 197, 94, 0.25);
    border-radius: 12px;
    padding: 14px 18px;
    z-index: 9999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 380px;
    transition: all 0.3s ease;
  `;

  toast.innerHTML = `
    <div style="width:28px;height:28px;border-radius:8px;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;color:#22c55e;font-size:16px;flex-shrink:0;">
      ✅
    </div>
    <div style="flex:1;">
      <div style="font-weight:600;color:#ffffff;margin-bottom:2px;">Yazıcı Köprüsü Güncellendi</div>
      <div style="color:#86efac;font-size:12px;line-height:1.3;">v${version} başarıyla yüklendi ve aktif edildi.</div>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    try {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 400);
    } catch {}
  }, 5000);
}

let lastUpdateCheckTime = 0;
let isUpdatingAgent = false;

/**
 * Bilgisayarda çalışan yerel PrinterAgent.exe'nin sürümünü denetler.
 * Yeni bir sürüm varsa sunucudan (likyakuyum.com / likyaerp.com veya aktif siteden)
 * exe'yi otomatik olarak indirip kendisini güncellemesini sağlar.
 */
export async function checkAndAutoUpdatePrinterAgent(): Promise<{ updated: boolean; currentVersion?: string; targetVersion?: string }> {
  if (typeof window === "undefined" || isUpdatingAgent) {
    return { updated: false };
  }

  const now = Date.now();
  if (now - lastUpdateCheckTime < 45000) {
    return { updated: false };
  }
  lastUpdateCheckTime = now;

  let currentAgentVer = "";
  const origin = window.location.origin;
  const downloadUrl = `${origin}/PrinterAgent.exe`;

  // 1. HTTP /health veya /status üzerinden sürüm sorgula
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch("http://127.0.0.1:9100/health", { signal: ctrl.signal }).catch(() => null);
    clearTimeout(t);
    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data && data.version) {
        currentAgentVer = data.version;
      }
    }
  } catch {}

  // 2. HTTP yanıt vermezse WebSocket üzerinden sürüm dene
  if (!currentAgentVer && typeof WebSocket !== "undefined") {
    try {
      currentAgentVer = await new Promise<string>((resolve) => {
        const ws = new WebSocket("ws://127.0.0.1:9100");
        const tm = setTimeout(() => { try { ws.close(); } catch {} resolve(""); }, 1200);
        ws.onmessage = (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (parsed && (parsed.action === "agent_info" || parsed.version)) {
              clearTimeout(tm);
              ws.close();
              resolve(parsed.version);
            }
          } catch {}
        };
        ws.onerror = () => { clearTimeout(tm); resolve(""); };
      });
    } catch {}
  }

  if (!currentAgentVer) {
    return { updated: false };
  }

  // Sürüm kontrolü
  if (isNewerVersion(TARGET_PRINTER_AGENT_VERSION, currentAgentVer)) {
    console.log(`[silentPrintService] PrinterAgent.exe güncellemesi tespit edildi: v${currentAgentVer} -> v${TARGET_PRINTER_AGENT_VERSION}`);
    isUpdatingAgent = true;

    showPrinterAgentUpdateToast(currentAgentVer, TARGET_PRINTER_AGENT_VERSION);

    // Güncelleme komutunu gönder (Önce WebSocket, sonra HTTP)
    let triggered = false;
    if (typeof WebSocket !== "undefined") {
      try {
        triggered = await new Promise<boolean>((resolve) => {
          const ws = new WebSocket("ws://127.0.0.1:9100");
          const tm = setTimeout(() => { try { ws.close(); } catch {} resolve(false); }, 4000);
          ws.onopen = () => {
            ws.send(JSON.stringify({
              action: "update",
              downloadUrl,
              version: TARGET_PRINTER_AGENT_VERSION,
            }));
          };
          ws.onmessage = (e) => {
            try {
              const d = JSON.parse(e.data);
              if (d && (d.action === "update_result" || d.success !== undefined)) {
                clearTimeout(tm);
                ws.close();
                resolve(Boolean(d.success));
              }
            } catch {}
          };
          ws.onerror = () => { clearTimeout(tm); resolve(false); };
        });
      } catch {}
    }

    if (!triggered) {
      try {
        const res = await fetch("http://127.0.0.1:9100/api/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ downloadUrl, version: TARGET_PRINTER_AGENT_VERSION }),
        }).catch(() => null);
        if (res && res.ok) triggered = true;
      } catch {}
    }

    // Uygulama yeniden başlatıldıktan sonra yeni sürümü teyit et ve ekranda başarı bildirimi göster
    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      pollCount++;
      try {
        const chk = await fetch("http://127.0.0.1:9100/health", { cache: "no-store" }).catch(() => null);
        if (chk && chk.ok) {
          const dt = await chk.json().catch(() => ({}));
          if (dt && dt.version === TARGET_PRINTER_AGENT_VERSION) {
            clearInterval(pollInterval);
            isUpdatingAgent = false;
            showPrinterAgentUpdatedSuccessToast(TARGET_PRINTER_AGENT_VERSION);
            return;
          }
        }
      } catch {}

      if (pollCount > 10) {
        clearInterval(pollInterval);
        isUpdatingAgent = false;
      }
    }, 1200);

    return { updated: true, currentVersion: currentAgentVer, targetVersion: TARGET_PRINTER_AGENT_VERSION };
  }

  return { updated: false, currentVersion: currentAgentVer };
}

/**
 * Yerel yazdırma servislerinin (Port 9100 PrinterAgent / printercekmeApp veya Port 5050)
 * çalışıp çalışmadığını kontrol eder. Öncelik 9100'dedir.
 */
export async function checkLocalPrintServiceOnline(): Promise<number | null> {
  // Arka planda güncelleme kontrolünü tetikle
  checkAndAutoUpdatePrinterAgent().catch(() => {});

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
 * WebSocket (ws://127.0.0.1:9100 ve ws://localhost:9100) üzerinden doğrudan sessiz yazdırma.
 * Canlı HTTPS siteler yerel WebSocket bağlantılarını engellemediğinden
 * Mixed Content / Private Network Access hatası olmadan doğrudan çalışır.
 */
async function printViaWebSocket(options: SilentPrintOptions): Promise<SilentPrintResult | null> {
  if (typeof WebSocket === "undefined") return null;

  const tryConnect = (wsUrl: string): Promise<SilentPrintResult | null> => {
    return new Promise((resolve) => {
      let resolved = false;
      let ws: WebSocket | null = null;

      const finish = (result: SilentPrintResult | null) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (ws) {
            try { ws.close(); } catch {}
          }
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        finish(null);
      }, 4000);

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          try {
            ws?.send(
              JSON.stringify({
                action: "print",
                html: options.html,
                text: options.text,
                printerName: options.printerName,
                targetDevice: options.printerName,
                copies: options.copies || 1,
                isPos: options.isPos !== false,
                title: options.title || "Likya_Fis",
              })
            );
          } catch {
            finish(null);
          }
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && (parsed.action === "print_result" || parsed.success !== undefined)) {
              finish({
                success: parsed.success !== false,
                message: parsed.message || (parsed.success ? "Fiş yazıcıya başarıyla gönderildi." : "Yazdırma hatası."),
              });
            }
          } catch {}
        };

        ws.onerror = () => finish(null);
      } catch {
        finish(null);
      }
    });
  };

  // Önce 127.0.0.1, ardından localhost adresini dene
  const res1 = await tryConnect("ws://127.0.0.1:9100");
  if (res1) return res1;

  const res2 = await tryConnect("ws://localhost:9100");
  if (res2) return res2;

  return null;
}

/**
 * Yazdırma işlemi devam ederken ekranda dönen yüklenme ikonunu (spinner overlay) gösterir.
 */
function showPrintLoadingOverlay(printerName?: string | null): void {
  if (typeof document === "undefined") return;

  hidePrintLoadingOverlay();

  if (!document.getElementById("likya-print-spinner-style")) {
    const style = document.createElement("style");
    style.id = "likya-print-spinner-style";
    style.innerHTML = `
      @keyframes likyaPrintSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes likyaPrintPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement("div");
  overlay.id = "likya-print-loading-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 99999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    pointer-events: all;
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    background: #ffffff;
    border-radius: 16px;
    padding: 24px 32px;
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-width: 280px;
    max-width: 90vw;
  `;

  const spinnerContainer = document.createElement("div");
  spinnerContainer.style.cssText = `
    width: 56px;
    height: 56px;
    position: relative;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const spinner = document.createElement("div");
  spinner.style.cssText = `
    width: 52px;
    height: 52px;
    border: 4px solid #e2e8f0;
    border-top: 4px solid #0284c7;
    border-right: 4px solid #0284c7;
    border-radius: 50%;
    animation: likyaPrintSpin 0.8s linear infinite;
  `;

  const icon = document.createElement("div");
  icon.style.cssText = `
    position: absolute;
    font-size: 22px;
    line-height: 1;
  `;
  icon.innerHTML = "🖨️";

  spinnerContainer.appendChild(spinner);
  spinnerContainer.appendChild(icon);

  const titleEl = document.createElement("div");
  titleEl.style.cssText = `
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;
    letter-spacing: -0.2px;
  `;
  titleEl.innerText = "Yazıcıya Gönderiliyor...";

  const descEl = document.createElement("div");
  descEl.style.cssText = `
    font-size: 13px;
    color: #64748b;
    max-width: 280px;
    line-height: 1.4;
    animation: likyaPrintPulse 1.6s ease-in-out infinite;
  `;
  const pName = printerName ? `"${printerName}"` : "Tanımlı Yazıcı";
  descEl.innerText = `${pName} çıktısı hazırlanıyor, lütfen bekleyiniz...`;

  card.appendChild(spinnerContainer);
  card.appendChild(titleEl);
  card.appendChild(descEl);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

/**
 * Ekranda gösterilen yüklenme spinner overlay'ini temizler.
 */
function hidePrintLoadingOverlay(): void {
  if (typeof document === "undefined") return;
  const overlay = document.getElementById("likya-print-loading-overlay");
  if (overlay) {
    try {
      overlay.remove();
    } catch {
      overlay.parentNode?.removeChild(overlay);
    }
  }
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

  // Arka planda ajan sürümünü kontrol et ve gerekiyorsa otomatik güncelle
  checkAndAutoUpdatePrinterAgent().catch(() => {});

  // Yazıcıya gönderim süresince ekranda dönen yüklenme ikonu gösterilir
  showPrintLoadingOverlay(printerName);

  try {
    // 1. Öncelik: Yerel WebSocket (ws://127.0.0.1:9100 ve ws://localhost:9100) — Canlı HTTPS ortamlarında Mixed Content'e takılmaz!
    try {
      const wsResult = await printViaWebSocket(options);
      if (wsResult) {
        return wsResult;
      }
    } catch (wsErr) {
      console.warn("[triggerSilentPrint] WebSocket yazdırma denenirken hata:", wsErr);
    }

    // 2. Yedek: Yerel HTTP POST (Port 9100 ve Port 5050 - 127.0.0.1 & localhost)
    const candidateUrls = [
      "http://127.0.0.1:9100/print",
      "http://127.0.0.1:9100/api/print",
      "http://localhost:9100/print",
      "http://localhost:9100/api/print",
      "http://127.0.0.1:5050/print",
    ];

    let lastError = "";

    for (const url of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
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

    // 3. Servise ulaşılamadıysa ve tarayıcı yedeğine izin verilmişse:
    if (options.allowBrowserFallback && html) {
      printViaHiddenIframe(html, title, isPos);
      return {
        success: true,
        message: "Yerel yazıcı servisine ulaşılamadığı için tarayıcı yazdırma akışı başlatıldı.",
        fallbackUsed: true,
      };
    }

    // Servise ulaşılamadıysa veya yazdırma başarısız olduysa:
    return {
      success: false,
      message: lastError
        ? `Yazıcı servisine ulaşılamadı (${lastError}). Lütfen PrinterAgent.exe uygulamasının açık olduğunu kontrol ediniz.`
        : "Yazıcı servisine (PrinterAgent.exe) ulaşılamadı. Lütfen PrinterAgent uygulamasının açık olduğunu kontrol ediniz.",
    };
  } finally {
    // Yazdırma işlemi bittiğinde (başarılı veya hatalı) yüklenme ikonunu kaldır
    hidePrintLoadingOverlay();
  }
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
            size: ${isPos ? "auto" : "A4 portrait"};
            margin: ${isPos ? "0mm" : "5mm"} !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-font-smoothing: antialiased;
          }
          ${isPos ? `
          .pos-print-root {
            width: 100%;
            max-width: 80mm;
            margin: 0 auto !important;
            padding: 0 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
            box-sizing: border-box !important;
          }
          .belge-sablon {
            margin: 0 auto !important;
            transform: scale(0.95);
            transform-origin: top center;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
          }
          ` : `
          .belge-sablon {
            margin: 0 auto !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
          }
          `}
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th, td {
            padding: 2px;
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#ffffff;">
        ${isPos ? `<div class="pos-print-root">${htmlContent}</div>` : htmlContent}
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


