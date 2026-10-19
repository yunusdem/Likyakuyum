/**
 * Likya Kuyumcu ERP - Yerel Sessiz Yazdırma Servisi (Local Silent Print Agent)
 * 
 * Bu servis kullanıcının yerel bilgisayarında (localhost:5050) çalışarak
 * web uygulamasından (likyakuyum.com / likyaerp.com veya localhost) gönderilen
 * fiş, etiket ve faturaları tarayıcı önizleme penceresi açılmadan doğrudan
 * Windows Denetim Masası yazıcılarından sessizce (silent print) çıkartır.
 * 
 * Özellikler:
 * 1. Port 5050 üzerinde yerel HTTP dinler (localhost için anında erişim).
 * 2. Bulut sunucularına (likyaerp.com, likyakuyum.com) bu bilgisayarın 
 *    tüm Denetim Masası yazıcılarını otomatik senkronize eder (HTTPS Mixed Content engelini çözer).
 * 3. Bulut yazdırma kuyruğunu dinleyerek web sitesinden gönderilen fişleri 
 *    arka planda sessizce donanım yazıcısına iletir.
 */

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5050;

// Cloud sunucu adresleri (Yazıcı listesi ve yazdırma kuyruğu senkronizasyonu)
const CLOUD_ENDPOINTS = [
  "https://www.likyaerp.com/api/v1/yazici",
  "https://likyaerp.com/api/v1/yazici",
  "https://likyakuyum.com/api/v1/yazici",
  "https://www.likyakuyum.com/api/v1/yazici",
  "http://localhost:5000/api/v1/yazici",
  "http://127.0.0.1:5000/api/v1/yazici",
];

// CORS ve Private Network Access Middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Geçici dosyalar klasörü
const TMP_DIR = path.join(os.tmpdir(), "likya-print-temp");
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// ─── Yerel Windows / OS Yazıcılarını Listeleme Fonksiyonu ───────────────────────
export async function getLocalPrinters() {
  const platform = os.platform();
  let printers = [];

  if (platform === "win32") {
    // 1. PowerShell CIM (Win32_Printer)
    const psCommand = `powershell -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer | Select-Object Name, DeviceID, Default, Local, Network, WorkOffline, PortName | ConvertTo-Json -Compress"`;
    try {
      const { stdout } = await execAsync(psCommand);
      if (stdout.trim()) {
        const parsed = JSON.parse(stdout);
        const rawList = Array.isArray(parsed) ? parsed : [parsed];
        printers = rawList
          .filter((p) => p && (p.Name || p.DeviceID))
          .map((p) => {
            const pName = String(p.Name || p.DeviceID).trim();
            const isNet = Boolean(p.Network) || pName.startsWith("\\\\") || /^\d{1,3}\.\d{1,3}/.test(String(p.PortName || ""));
            const isUsb = Boolean(p.PortName && (p.PortName.includes("USB") || p.PortName.includes("DOT4")));
            return {
              name: pName,
              isDefault: Boolean(p.Default),
              isOnline: !Boolean(p.WorkOffline),
              isLocal: Boolean(p.Local),
              isNetwork: isNet,
              isUsb,
              portName: p.PortName || undefined,
            };
          });
      }
    } catch {
      // 2. WMIC Fallback
      try {
        const { stdout } = await execAsync(`wmic printer get name,default,portname /format:csv`);
        const lines = stdout.trim().split(/\r?\n/).slice(1);
        printers = lines
          .map((line) => line.trim().split(","))
          .filter((parts) => parts.length >= 3 && parts[2])
          .map((parts) => ({
            name: parts[2].trim(),
            isDefault: parts[1]?.toLowerCase() === "true",
            portName: parts[3]?.trim() || undefined,
          }));
      } catch {}
    }
  } else {
    // macOS / Linux CUPS
    try {
      const { stdout } = await execAsync("lpstat -p -d");
      const lines = stdout.split("\n");
      let defaultPrinter = "";
      for (const line of lines) {
        if (line.includes("system default destination:")) {
          defaultPrinter = line.split(":")[1]?.trim() || "";
        } else if (line.startsWith("printer ")) {
          const pName = line.split(" ")[1]?.trim();
          if (pName) {
            printers.push({
              name: pName,
              isDefault: pName === defaultPrinter,
            });
          }
        }
      }
    } catch {
      printers = [];
    }
  }

  return printers;
}

// ─── Yazdırma İşini Donanımda Yürütme ──────────────────────────────────────────
export async function executePrintJob(job) {
  const printerName = job.printerName || job.targetDevice;
  const text = job.text || job.textContent;
  const html = job.html || job.htmlContent;
  const pdfBase64 = job.pdfBase64;
  const isPos = Boolean(job.isPos);
  const title = job.title || job.documentTitle || "Likya_Fis";
  const copies = job.copies || 1;

  const timestamp = Date.now();
  const platform = os.platform();

  // HTML içerik varsa öncelikli olarak tarayıcı motoru (Edge headless) ile biçimlendirilmiş olarak yazdır
  if (html) {
    let resolvedWinPrinter = printerName;
    const htmlFile = path.join(TMP_DIR, `print_${timestamp}.html`);
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: ${isPos ? "80mm auto" : "A4 portrait"}; margin: ${isPos ? "0mm" : "5mm"} !important; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { width: 100%; max-width: ${isPos ? "78mm" : "210mm"}; margin: 0 !important; padding: 0 !important; font-family: ${isPos ? "'Courier New', Courier, monospace, Arial, sans-serif" : "Arial, sans-serif"}; font-size: ${isPos ? "11px" : "12px"}; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 2px; }
  </style>
</head>
<body>${html}</body>
</html>`;
    fs.writeFileSync(htmlFile, fullHtml, "utf-8");

    if (platform === "win32") {
      const safeTarget = (printerName || "").replace(/'/g, "''");
      const psCmd = `powershell -NoProfile -Command "$target = '${safeTarget}'; $p = if ($target) { Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $target -or $_.DeviceID -eq $target } | Select-Object -First 1 } else { $null }; if (-not $p -and $target) { $clean = ($target -split '[\\\\/]')[-1]; $p = Get-CimInstance Win32_Printer | Where-Object { $_.Name -like ('*' + $clean + '*') -or $_.DeviceID -like ('*' + $clean + '*') } | Select-Object -First 1 }; $pName = if ($p) { $p.Name } else { (Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1).Name }; if ($pName) { Out-File -FilePath '${htmlFile}.target' -InputObject $pName -Encoding UTF8 }"`;
      await execAsync(psCmd).catch(() => {});

      try {
        if (fs.existsSync(`${htmlFile}.target`)) {
          const t = fs.readFileSync(`${htmlFile}.target`, "utf-8").trim();
          if (t) resolvedWinPrinter = t;
          fs.unlinkSync(`${htmlFile}.target`);
        }
      } catch {}

      // HTML'yi gerçek biçimiyle, önizlemesiz ve hedef yazıcıya bas:
      // Windows'un yerleşik WebBrowser bileşeni (STA PowerShell) ile. Hedef yazıcı geçici olarak
      // varsayılan yapılır, baskı sonrası eski varsayılan geri yüklenir. Üst/alt bilgi kapatılır.
      const psFile = path.join(TMP_DIR, `print_${timestamp}.ps1`);
      const psScript = `
param([string]$HtmlPath, [string]$Printer, [int]$Copies = 1)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$ps = 'HKCU:\\Software\\Microsoft\\Internet Explorer\\PageSetup'
if (-not (Test-Path $ps)) { New-Item -Path $ps -Force | Out-Null }
$oldHeader = (Get-ItemProperty -Path $ps -Name header -ErrorAction SilentlyContinue).header
$oldFooter = (Get-ItemProperty -Path $ps -Name footer -ErrorAction SilentlyContinue).footer
Set-ItemProperty -Path $ps -Name header -Value ''
Set-ItemProperty -Path $ps -Name footer -Value ''
$net = New-Object -ComObject WScript.Network
$prev = (Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1).Name
try {
  if ($Printer) { $net.SetDefaultPrinter($Printer) }
  for ($i = 0; $i -lt [Math]::Max(1, $Copies); $i++) {
    $wb = New-Object System.Windows.Forms.WebBrowser
    $wb.ScriptErrorsSuppressed = $true
    $script:loaded = $false
    $wb.add_DocumentCompleted({ $script:loaded = $true })
    $wb.Navigate($HtmlPath)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while (-not $script:loaded -and $sw.Elapsed.TotalSeconds -lt 10) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 30 }
    $wb.Print()
    $sw.Restart()
    while ($sw.Elapsed.TotalSeconds -lt 2) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 30 }
    $wb.Dispose()
  }
} finally {
  if ($Printer -and $prev -and $prev -ne $Printer) { try { $net.SetDefaultPrinter($prev) } catch {} }
  if ($null -ne $oldHeader) { Set-ItemProperty -Path $ps -Name header -Value $oldHeader }
  if ($null -ne $oldFooter) { Set-ItemProperty -Path $ps -Name footer -Value $oldFooter }
}
`;
      fs.writeFileSync(psFile, "\ufeff" + psScript, "utf-8");
      const printerArg = resolvedWinPrinter ? `-Printer "${resolvedWinPrinter.replace(/"/g, '""')}"` : "";
      let htmlPrinted = false;
      try {
        await execAsync(
          `powershell -NoProfile -STA -ExecutionPolicy Bypass -File "${psFile}" -HtmlPath "${htmlFile}" ${printerArg} -Copies ${Number(copies) || 1}`,
          { timeout: 30000 }
        );
        htmlPrinted = true;
      } catch (err) {
        console.error("[HTML YAZDIRMA HATASI]", err?.message || err);
      }
      setTimeout(() => { try { fs.unlinkSync(psFile); } catch {} }, 4000);

      // Yedek: düz metin olarak hedef yazıcıya gönder (biçimsiz ama çıktı alınır)
      if (!htmlPrinted && text) {
        const textFile = path.join(TMP_DIR, `print_${timestamp}.txt`);
        fs.writeFileSync(textFile, text, "utf-8");
        const target = resolvedWinPrinter ? ` -Name '${resolvedWinPrinter.replace(/'/g, "''")}'` : "";
        await execAsync(
          `powershell -NoProfile -Command "Get-Content -Path '${textFile}' -Raw -Encoding UTF8 | Out-Printer${target}"`
        ).catch(() => {});
        setTimeout(() => { try { fs.unlinkSync(textFile); } catch {} }, 4000);
      }
      if (!htmlPrinted && !text) {
        throw new Error(`"${resolvedWinPrinter || printerName || "varsayılan"}" yazıcısına HTML çıktı gönderilemedi.`);
      }
    } else {
      const cleanTarget = (printerName || "").split(/[\\/]/).pop() || "";
      const dest = cleanTarget ? `-d "${cleanTarget}"` : "";
      await execAsync(`lp ${dest} -o fit-to-page "${htmlFile}" 2>/dev/null || lp -o fit-to-page "${htmlFile}" 2>/dev/null || true`).catch(() => {});
    }

    setTimeout(() => { try { fs.unlinkSync(htmlFile); } catch {} }, 4000);
    return { success: true, mode: "html", printerName: resolvedWinPrinter || printerName };
  }

  if (text) {
    const textFile = path.join(TMP_DIR, `print_${timestamp}.txt`);
    fs.writeFileSync(textFile, text, "utf-8");

    if (platform === "win32") {
      const safeTarget = (printerName || "").replace(/'/g, "''");
      const cmd = `powershell -NoProfile -Command "$target = '${safeTarget}'; $p = if ($target) { Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $target -or $_.DeviceID -eq $target } | Select-Object -First 1 } else { $null }; if (-not $p -and $target) { $clean = ($target -split '[\\\\/]')[-1]; $p = Get-CimInstance Win32_Printer | Where-Object { $_.Name -like ('*' + $clean + '*') -or $_.DeviceID -like ('*' + $clean + '*') } | Select-Object -First 1 }; if ($p) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Path '${textFile}' -Raw -Encoding UTF8 | Out-Printer -Name $p.Name } else { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Path '${textFile}' -Raw -Encoding UTF8 | Out-Printer }"`;
      await execAsync(cmd).catch(() => {});
    } else {
      const cleanTarget = (printerName || "").split(/[\\/]/).pop() || "";
      const dest = cleanTarget ? `-d "${cleanTarget}"` : "";
      await execAsync(`lp ${dest} "${textFile}" 2>/dev/null || lp "${textFile}" 2>/dev/null || true`).catch(() => {});
    }

    setTimeout(() => { try { fs.unlinkSync(textFile); } catch {} }, 4000);
    return { success: true, mode: "text", printerName };
  }

  if (pdfBase64) {
    const pdfFile = path.join(TMP_DIR, `print_${timestamp}.pdf`);
    const buffer = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/, ""), "base64");
    fs.writeFileSync(pdfFile, buffer);

    if (platform === "win32") {
      const safeTarget = (printerName || "").replace(/'/g, "''");
      const cmd = `powershell -NoProfile -Command "$target = '${safeTarget}'; $p = if ($target) { Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $target -or $_.DeviceID -eq $target } | Select-Object -First 1 } else { $null }; if (-not $p -and $target) { $clean = ($target -split '[\\\\/]')[-1]; $p = Get-CimInstance Win32_Printer | Where-Object { $_.Name -like ('*' + $clean + '*') -or $_.DeviceID -like ('*' + $clean + '*') } | Select-Object -First 1 }; if ($p) { Start-Process -FilePath '${pdfFile}' -Verb PrintTo -ArgumentList $p.Name -PassThru | ForEach-Object { Start-Sleep -Seconds 2; Stop-Process -Id $_.Id -Force } } else { Start-Process -FilePath '${pdfFile}' -Verb Print -PassThru | ForEach-Object { Start-Sleep -Seconds 2; Stop-Process -Id $_.Id -Force } }"`;
      await execAsync(cmd).catch(() => {});
    } else {
      const cleanTarget = (printerName || "").split(/[\\/]/).pop() || "";
      const dest = cleanTarget ? `-d "${cleanTarget}"` : "";
      await execAsync(`lp ${dest} "${pdfFile}" 2>/dev/null || lp "${pdfFile}" 2>/dev/null || true`).catch(() => {});
    }

    setTimeout(() => { try { fs.unlinkSync(pdfFile); } catch {} }, 4000);
    return { success: true, mode: "pdf", printerName };
  }

  throw new Error("Yazdırılacak içerik bulunamadı.");
}

// ─── Bulut Sunucularına Senkronizasyon ─────────────────────────────────────────
async function syncPrintersToCloud() {
  try {
    const printers = await getLocalPrinters();
    if (!printers || printers.length === 0) return;

    const payload = {
      computerName: os.hostname(),
      userName: os.userInfo()?.username || "",
      platform: os.platform(),
      printers,
    };

    for (const base of CLOUD_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        await fetch(`${base}/register-client-printers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
      } catch {}
    }
  } catch {}
}

// ─── Bulut Sunucusundan Bekleyen Yazdırma İşlerini Çekme ───────────────────────
async function pollCloudPrintJobs() {
  try {
    const compName = encodeURIComponent(os.hostname());
    for (const base of CLOUD_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${base}/print-jobs?computerName=${compName}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const json = await res.json();
          const jobs = json.data;
          if (Array.isArray(jobs) && jobs.length > 0) {
            for (const job of jobs) {
              console.log(`[BULUT İŞ ALINDI] ${job.targetDevice || job.printerName} yazdırılıyor...`);
              await executePrintJob(job);
              await fetch(`${base}/print-jobs/${job.id}/complete`, {
                method: "POST",
              }).catch(() => {});
            }
          }
        }
      } catch {}
    }
  } catch {}
}

// ─── HTTP Endpoint'leri ───────────────────────────────────────────────────────
app.get(["/status", "/health", "/"], (req, res) => {
  res.json({
    success: true,
    service: "Likya Kuyumcu Yerel Sessiz Yazıcı Servisi",
    status: "online",
    port: PORT,
    platform: os.platform(),
    hostname: os.hostname(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/printers", async (req, res) => {
  try {
    const printers = await getLocalPrinters();
    res.json({
      success: true,
      count: printers.length,
      computerName: os.hostname(),
      userName: os.userInfo()?.username || "",
      printers,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Yazıcı listesi alınamadı: " + (err.message || String(err)),
      printers: [],
    });
  }
});

app.post("/print", async (req, res) => {
  try {
    const result = await executePrintJob(req.body);
    res.json({
      success: true,
      message: "Yazdırma komutu başarıyla iletildi.",
      ...result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Yazdırma hatası: " + (err.message || String(err)),
    });
  }
});

// Sunucuyu başlat
app.listen(PORT, "0.0.0.0", () => {
  console.log("\x1b[32m%s\x1b[0m", "============================================================");
  console.log("\x1b[36m%s\x1b[0m", "   LIKYA KUYUMCU ERP - YEREL SESSIZ YAZDIRMA SERVISI        ");
  console.log("\x1b[32m%s\x1b[0m", "============================================================");
  console.log(` \x1b[33m[DURUM]\x1b[0m        : \x1b[32mAKTIF VE DINLEMEDE (ONLINE)\x1b[0m`);
  console.log(` \x1b[33m[SERVIS PORT]\x1b[0m  : \x1b[37mhttp://localhost:${PORT}\x1b[0m`);
  console.log(` \x1b[33m[BILGISAYAR]\x1b[0m   : \x1b[37m${os.hostname()}\x1b[0m`);
  console.log(` \x1b[33m[BULUT SYNC]\x1b[0m   : \x1b[32mOTOMATIK BULUT SENKRONIZASYONU AKTIF\x1b[0m`);
  console.log("\x1b[32m%s\x1b[0m", "============================================================");
  console.log(" likyakuyum.com / likyaerp.com veya localhost üzerinden");
  console.log(" bu bilgisayara bağlı tüm yazıcılar otomatik algılanır.");
  console.log("\x1b[32m%s\x1b[0m", "============================================================\n");

  // İlk açılışta hemen buluta senkronize et
  syncPrintersToCloud();

  // Her 10 saniyede bir yazıcı listesini bulutla senkronize et
  setInterval(syncPrintersToCloud, 10000);

  // Her 1.5 saniyede bir buluttan bekleyen yazdırma işlerini kontrol et
  setInterval(pollCloudPrintJobs, 1500);
});
