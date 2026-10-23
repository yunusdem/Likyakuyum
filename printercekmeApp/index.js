const express = require("express");
const cors = require("cors");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { exec, spawn } = require("child_process");
const os = require("os");
const util = require("util");

const execAsync = util.promisify(exec);

// PowerShell scriptlerini Base64 Unicode (-EncodedCommand) ile güvenle ve asılı kalmadan çalıştıran fonksiyon
function runPowerShell(script, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
    // PowerShell -EncodedCommand UTF-16LE Base64 bekler
    const b64 = Buffer.from(script, "utf16le").toString("base64");

    const ps = spawn(psPath, ["-NoProfile", "-NonInteractive", "-STA", "-EncodedCommand", b64], {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try { ps.kill(); } catch {}
      reject(new Error("PowerShell işlem zaman aşımına uğradı."));
    }, timeoutMs);

    ps.stdout.on("data", (d) => { stdout += d.toString("utf8"); });
    ps.stderr.on("data", (d) => { stderr += d.toString("utf8"); });

    ps.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    ps.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

const app = express();
const PORT = process.env.PORT || 9100;
const HOST = "0.0.0.0";

// ─── CORS ve Chrome Private Network Access Ayarları ─────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "*");
  // Chrome / Web standardı Private Network Access (Yerel ağ / localhost izni)
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ─── Sistem Yazıcılarını Algılama Fonksiyonu ────────────────────────────────
async function getSystemPrinters() {
  const printers = [];

  try {
    const platform = os.platform();

    // 1. Windows Ortamı: Get-Printer -> Get-CimInstance -> .NET PrinterSettings
    if (platform === "win32") {
      const systemRoot = process.env.SystemRoot || "C:\\Windows";
      const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;

      // 1. Aşama: PowerShell Get-Printer (Temiz -NoProfile -Command, Bypass bayrağı olmadan)
      let psSuccess = false;
      try {
        const psCommand = `"${psPath}" -NoProfile -NonInteractive -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Printer | Select-Object Name, Default, PrinterStatus | ConvertTo-Json -Compress"`;
        const { stdout } = await execAsync(psCommand, { encoding: "utf8", timeout: 8000 });
        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of list) {
            if (!item) continue;
            const name = String(item.Name || "").trim();
            if (!name) continue;
            const isDef = Boolean(item.Default);
            let statusText = "Hazır";
            if (item.PrinterStatus === 1 || item.PrinterStatus === "Paused") statusText = "Duraklatıldı";
            else if (item.PrinterStatus === 2 || item.PrinterStatus === "Error") statusText = "Hata";
            else if (item.PrinterStatus === 7 || item.PrinterStatus === "Offline") statusText = "Çevrimdışı";

            printers.push({
              name,
              isDefault: isDef,
              status: statusText,
            });
          }
          if (printers.length > 0) {
            psSuccess = true;
          }
        }
      } catch (psErr) {
        console.warn("[printercekmeApp] Get-Printer çağrısı başarısız, CIM fallback deneniyor:", psErr.message);
      }

      // 2. Aşama: Get-CimInstance Fallback
      if (!psSuccess || printers.length === 0) {
        try {
          const cimCmd = `"${psPath}" -NoProfile -NonInteractive -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer | Select-Object Name, Default | ConvertTo-Json -Compress"`;
          const { stdout: cimOut } = await execAsync(cimCmd, { encoding: "utf8", timeout: 6000 });
          if (cimOut && cimOut.trim()) {
            const parsed = JSON.parse(cimOut.trim());
            const list = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of list) {
              if (!item) continue;
              const name = String(item.Name || "").trim();
              if (name && !printers.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
                printers.push({
                  name,
                  isDefault: Boolean(item.Default),
                  status: "Hazır",
                });
              }
            }
            if (printers.length > 0) psSuccess = true;
          }
        } catch (cimErr) {
          console.warn("[printercekmeApp] CIM fallback hatası:", cimErr.message);
        }
      }

      // 3. Aşama: .NET InstalledPrinters Fallback (Hafif ve evrensel)
      if (printers.length === 0) {
        try {
          const netCmd = `"${psPath}" -NoProfile -NonInteractive -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [System.Drawing.Printing.PrinterSettings]::InstalledPrinters | ConvertTo-Json -Compress"`;
          const { stdout: netOut } = await execAsync(netCmd, { encoding: "utf8", timeout: 5000 });
          if (netOut && netOut.trim()) {
            const parsed = JSON.parse(netOut.trim());
            const list = Array.isArray(parsed) ? parsed : [parsed];
            for (const name of list) {
              const cleanName = String(name || "").trim();
              if (cleanName && !printers.some((p) => p.name.toLowerCase() === cleanName.toLowerCase())) {
                printers.push({
                  name: cleanName,
                  isDefault: false,
                  status: "Hazır",
                });
              }
            }
          }
        } catch (netErr) {
          console.warn("[printercekmeApp] .NET fallback hatası:", netErr.message);
        }
      }
    } else {
      // 2. macOS / Linux Ortamı: lpstat -p, lpstat -a ve lpstat -d
      try {
        let defaultPrinter = "";
        try {
          const { stdout: defOut } = await execAsync("lpstat -d", { timeout: 4000 });
          const defMatch = defOut.match(/(?:system default destination|varsayılan hedef):\s*([^\s]+)/i);
          if (defMatch && defMatch[1]) {
            defaultPrinter = defMatch[1].trim();
          }
        } catch {}

        const { stdout } = await execAsync("lpstat -p", { timeout: 6000 });
        const lines = stdout.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const cleanLine = trimmed.replace(/^printer\s+/i, "");
          const parts = cleanLine.split(/[\s,]+/);
          const name = parts[0]?.trim();
          if (name) {
            const lower = trimmed.toLowerCase();
            let statusText = "Hazır";
            if (lower.includes("disabled") || lower.includes("devre dışı")) statusText = "Devre Dışı";
            else if (lower.includes("offline") || lower.includes("çevrimdışı")) statusText = "Çevrimdışı";
            else if (lower.includes("printing") || lower.includes("yazdırıyor")) statusText = "Yazdırıyor";

            const isDef = defaultPrinter && defaultPrinter.toLowerCase() === name.toLowerCase();
            if (!printers.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
              printers.push({
                name,
                isDefault: Boolean(isDef),
                status: statusText,
              });
            }
          }
        }
      } catch (unixErr) {
        console.warn("[printercekmeApp] lpstat hatası:", unixErr.message);
      }
    }

    // Varsayılan olanları en başa, sonra alfabetik sırala
    printers.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name, "tr");
    });
  } catch (globalErr) {
    console.error("[printercekmeApp] getSystemPrinters genel yakalama:", globalErr.message);
  }

  printerCache.list = printers;
  printerCache.lastUpdated = Date.now();
  return printers;
}

// ─── HTTP Endpoints ─────────────────────────────────────────────────────────

// Sağlık kontrolü
app.get(["/health", "/status"], (_req, res) => {
  res.json({
    status: "ok",
    service: "printercekmeApp",
    version: "1.0.0",
    platform: os.platform(),
    time: new Date().toISOString(),
  });
});

// Yazıcıları listeleme endpoint'i (Hata verse bile 500 dönmeyip daima [] veya listeyi döner)
app.get(["/api/printers", "/printers"], async (_req, res) => {
  try {
    const list = await getSystemPrinters();
    res.json(list || []);
  } catch (err) {
    console.error("[printercekmeApp] API Hata:", err);
    res.json([]);
  }
});

// Windows varsayılan yazıcısını ayarlama endpoint'i (Tarayıcı çıktısının doğru yazıcıya gitmesini sağlar)
app.post(["/api/set-default", "/set-default"], async (req, res) => {
  const { printerName } = req.body || {};
  if (!printerName) {
    return res.json({ success: false, message: "printerName belirtilmedi." });
  }

  const platform = os.platform();
  if (platform === "win32") {
    try {
      const systemRoot = process.env.SystemRoot || "C:\\Windows";
      const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
      const safeTarget = printerName.replace(/'/g, "''");
      const psCmd = `
$target = '${safeTarget}';
$p = Get-Printer | Where-Object { $_.Name -like ('*' + $target + '*') } | Select-Object -First 1;
if (-not $p) { $p = Get-Printer | Where-Object { $_.Name -eq $target } | Select-Object -First 1 };
if ($p) {
  (New-Object -ComObject WScript.Network).SetDefaultPrinter($p.Name)
}
`;
      await execAsync(`"${psPath}" -NoProfile -NonInteractive -Command "${psCmd.replace(/\r?\n/g, ' ')}"`, { timeout: 4000 });
      console.log(`[printercekmeApp] Varsayılan yazıcı "${printerName}" olarak ayarlandı.`);
      return res.json({ success: true, printerName });
    } catch (err) {
      console.warn("[printercekmeApp] Varsayılan yazıcı ayarlama hatası:", err.message);
      return res.json({ success: false, error: err.message });
    }
  }

  return res.json({ success: true, printerName });
});

// ─── Hızlı Tarayıcı ve Yazıcı Yolu Belirleme (PowerShell Gecikmesini Sıfırlamak İçin) ───
let cachedEdgePath = null;
function findEdgePath() {
  if (cachedEdgePath && fs.existsSync(cachedEdgePath)) return cachedEdgePath;
  const candidates = [
    `${process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)"}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env.ProgramFiles || "C:\\Program Files"}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env.LocalAppData || ""}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      cachedEdgePath = c;
      return c;
    }
  }
  return null;
}

let cachedChromePath = null;
function findChromePath() {
  if (cachedChromePath && fs.existsSync(cachedChromePath)) return cachedChromePath;
  const candidates = [
    `${process.env.ProgramFiles || "C:\\Program Files"}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)"}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LocalAppData || ""}\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      cachedChromePath = c;
      return c;
    }
  }
  return null;
}

// Global yazıcı durum önbelleği (PowerShell Get-Printer gecikmesini sıfırlar)
const printerCache = {
  list: [],
  lastUpdated: 0,
};

// Node.js üzerinden doğrudan Chromium (Edge/Chrome) headless ile ultra hızlı baskı (<400ms)
function printDirectWithBrowser(browserPath, printerName, htmlPath, copies = 1) {
  return new Promise((resolve) => {
    const numCopies = Math.max(1, Number(copies) || 1);
    let copiesDone = 0;

    const printNext = () => {
      const args = [
        "--headless",
        "--disable-gpu",
        printerName ? `--print-to-printer=${printerName}` : "--print-to-default-printer",
        htmlPath,
      ];

      const child = spawn(browserPath, args, {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      });

      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          try { child.kill(); } catch {}
          resolve({ success: false, message: "Tarayıcı yazdırma işlemi zaman aşımına uğradı." });
        }
      }, 5000);

      child.on("close", () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);

        copiesDone++;
        if (copiesDone < numCopies) {
          printNext();
        } else {
          resolve({
            success: true,
            message: `Fiş "${printerName || 'Tanımlı Yazıcı'}" cihazına başarıyla gönderildi.`,
            printerName,
          });
        }
      });

      child.on("error", (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({ success: false, message: err.message });
      });
    };

    printNext();
  });
}

// HTML'den temiz düz metin çıkaran yardımcı fonksiyon
function extractTextFromHtmlSimple(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

// ─── Doğrudan Sessiz Yazdırma İşi (Windows & macOS/Linux) ─────────────────────
async function executePrintJob(job) {
  const { html, text, printerName, targetDevice, isPos = true, copies = 1, title = "Likya_Fis" } = job || {};

  if (!html && !text) {
    return { success: false, message: "Yazdırılacak içerik (html veya text) bulunamadı." };
  }

  const targetPrinter = (printerName || targetDevice || "").trim();
  const platform = os.platform();
  const timestamp = Date.now();

  // Windows'ta kullanıcı adındaki boşluklardan ("Yusuf ARAS") etkilenmemek için C:\ProgramData kullan
  let tmpDir = "";
  if (platform === "win32") {
    const systemDrive = process.env.SystemDrive || "C:";
    tmpDir = path.join(systemDrive, "ProgramData", "LikyaPrintTemp");
  } else {
    tmpDir = path.join(os.tmpdir(), "likya-print-temp");
  }

  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  } catch {
    tmpDir = path.join(os.tmpdir(), "likya-print-temp");
    try { if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true }); } catch {}
  }

  console.log(`[printercekmeApp] Yazdırma isteği alındı. Hedef Yazıcı: "${targetPrinter || 'Varsayılan'}", isPos: ${isPos}, Kopya: ${copies}`);

  try {
    if (platform === "win32") {
      const safeTarget = targetPrinter.replace(/'/g, "''").replace(/"/g, '""');

      let printed = false;
      let printErrorMessage = "";

      // Dosyaları hazırla
      const textContent = text || (html ? extractTextFromHtmlSimple(html) : "");
      const textFile = path.join(tmpDir, `print_${timestamp}.txt`);
      if (textContent) {
        fs.writeFileSync(textFile, "\ufeff" + textContent, "utf8");
      }

      let htmlFile = "";
      if (html) {
        htmlFile = path.join(tmpDir, `print_${timestamp}.html`);
        const isFullDoc = html.trim().startsWith("<!DOCTYPE") || html.trim().startsWith("<html");

        const printStyle = `
  <style>
    @page {
      margin: 0 !important;
      size: ${isPos ? "auto" : "A4 portrait"};
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
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
      transform: scale(0.96);
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
  </style>`;

        let fullHtml = "";
        if (isFullDoc) {
          if (html.includes("</head>")) {
            fullHtml = html.replace("</head>", `${printStyle}</head>`);
          } else {
            fullHtml = printStyle + html;
          }
        } else {
          fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  ${printStyle}
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  ${isPos ? `<div class="pos-print-root">${html}</div>` : html}
</body>
</html>`;
        }
        fs.writeFileSync(htmlFile, "\ufeff" + fullHtml, "utf8");
      }

      const escapedHtmlPath = htmlFile ? htmlFile.replace(/'/g, "''") : "";
      const escapedTextPath = textFile && fs.existsSync(textFile) ? textFile.replace(/'/g, "''") : "";
      const numCopies = Math.max(1, Number(copies) || 1);

      // ─── 1. AŞAMA: Ultra Hızlı Doğrudan Tarayıcı Baskısı (Edge / Chrome) ───
      // Node.js üzerinden doğrudan Chromium spawn edilir, PowerShell cold-start ve Get-Printer sorgu gecikmesi (3-5 sn) tamamen sıfırlanır!
      const browserPath = findEdgePath() || findChromePath();
      if (browserPath && htmlFile) {
        let resolvedTarget = targetPrinter;
        if (targetPrinter && printerCache.list.length > 0) {
          const match = printerCache.list.find((p) => p.name.toLowerCase() === targetPrinter.toLowerCase()) ||
                        printerCache.list.find((p) => p.name.toLowerCase().includes(targetPrinter.toLowerCase()) || targetPrinter.toLowerCase().includes(p.name.toLowerCase()));
          if (match) {
            if (match.status === "Çevrimdışı") {
              return {
                success: false,
                message: `'${match.name}' yazıcısı Çevrimdışı (Offline) veya bağlı değil. Lütfen USB/Ağ kablosunu kontrol ediniz.`,
              };
            }
            if (match.status === "Hata") {
              return {
                success: false,
                message: `'${match.name}' yazıcısında donanım hatası var (kağıt bitmiş veya kapak açık olabilir).`,
              };
            }
            if (match.status === "Duraklatıldı") {
              return {
                success: false,
                message: `'${match.name}' yazıcısı duraklatılmış durumda. Lütfen Windows Yazıcılar menüsünden sürdürünüz.`,
              };
            }
            resolvedTarget = match.name;
          }
        }

        console.log(`[printercekmeApp] Ultra hızlı doğrudan Chromium baskısı başlatılıyor: "${resolvedTarget || 'Varsayılan'}"`);
        const directResult = await printDirectWithBrowser(browserPath, resolvedTarget, htmlFile, numCopies);
        if (directResult && directResult.success) {
          console.log(`[printercekmeApp] Yazdırma BAŞARILI (Anında): "${resolvedTarget || 'Varsayılan'}"`);
          setTimeout(() => {
            try { fs.unlinkSync(htmlFile); } catch {}
            if (textFile) { try { fs.unlinkSync(textFile); } catch {} }
          }, 3000);
          return directResult;
        } else {
          console.warn("[printercekmeApp] Doğrudan tarayıcı baskısı başarısız oldu, PowerShell yedek akışına geçiliyor:", directResult?.message);
        }
      }

      // ─── 2. AŞAMA: PowerShell Yedek Akışı ───
      // Doğrudan hedef yazıcıya basan, durumu denetleyen, 1:1 grafik/logo/karekod destekli PowerShell scripti
      const psScript = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

$rawTarget = '${safeTarget}'
$htmlPath = '${escapedHtmlPath}'
$textPath = '${escapedTextPath}'
$copies = ${numCopies}
$isPos = ${isPos ? "$true" : "$false"}

# 1. Hedef Yazıcıyı Doğrula
$printer = $null
if ($rawTarget -and $rawTarget.Trim() -ne '') {
  $printer = Get-Printer -Name $rawTarget -ErrorAction SilentlyContinue
  if (-not $printer) {
    $printer = Get-Printer | Where-Object { 
      $_.Name.Equals($rawTarget, [System.StringComparison]::OrdinalIgnoreCase) -or
      $_.Name.ToLower().Contains($rawTarget.ToLower()) -or
      $rawTarget.ToLower().Contains($_.Name.ToLower())
    } | Select-Object -First 1
  }
} else {
  $printer = Get-Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1
}

if (-not $printer) {
  Write-Output "ERROR: '$rawTarget' adında bir yazıcı Windows sisteminde yüklü veya tanımlı değil. Lütfen Yazıcı Tanımlarından geçerli bir yazıcı seçiniz."
  exit 1
}

$printerName = $printer.Name

# 2. Donanım ve Çevrimdışı Durum Denetimi
if ($printer.PrinterStatus -eq 7 -or $printer.PrinterStatus -eq 'Offline' -or ($printer.WorkOffline -eq $true)) {
  Write-Output "ERROR: '$printerName' yazıcısı Çevrimdışı (Offline) veya bilgisayara bağlı değil. Lütfen USB/Ağ kablosunu ve yazıcının açık olduğunu kontrol ediniz."
  exit 1
}

if ($printer.PrinterStatus -eq 2 -or $printer.PrinterStatus -eq 'Error') {
  Write-Output "ERROR: '$printerName' yazıcısında donanım hatası var (kağıt bitmiş veya yazıcı kapağı açık olabilir)."
  exit 1
}

if ($printer.PrinterStatus -eq 1 -or $printer.PrinterStatus -eq 'Paused') {
  Write-Output "ERROR: '$printerName' yazıcısı duraklatılmış (paused) durumda. Lütfen Windows Yazıcılar menüsünden yazdırmayı sürdürünüz."
  exit 1
}

# 3. YAZDIRMA İŞLEMİ (Birebir F9 önizlemesi: HTML/SVG/Logo/Karekod ile doğrudan hedef yazıcıya)
try {
  $printed = $false

  if ($htmlPath -and (Test-Path $htmlPath)) {
    # 3.1. ÖNCELİK: Microsoft Edge Headless (Modern Chromium - anında, arka planda, birebir logo & karekod)
    $edgePath = "\${env:ProgramFiles(x86)}\\Microsoft\\Edge\\Application\\msedge.exe"
    if (-not (Test-Path $edgePath)) {
      $edgePath = "\${env:ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe"
    }

    if (Test-Path $edgePath) {
      for ($c = 0; $c -lt $copies; $c++) {
        $p = Start-Process -FilePath $edgePath -ArgumentList "--headless --disable-gpu --print-to-printer=\`"$printerName\`" \`"$htmlPath\`"" -Wait -PassThru -WindowStyle Hidden
      }
      $printed = $true
      Write-Output "SUCCESS: $printerName"
      exit 0
    }

    # 3.2. YEDEK 1: Google Chrome Headless (Edge yoksa)
    $chromePath = "\${env:ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe"
    if (-not (Test-Path $chromePath)) {
      $chromePath = "\${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe"
    }
    if (Test-Path $chromePath) {
      for ($c = 0; $c -lt $copies; $c++) {
        $p = Start-Process -FilePath $chromePath -ArgumentList "--headless --disable-gpu --print-to-printer=\`"$printerName\`" \`"$htmlPath\`"" -Wait -PassThru -WindowStyle Hidden
      }
      $printed = $true
      Write-Output "SUCCESS: $printerName"
      exit 0
    }

    # 3.3. YEDEK 2: WebBrowser Formu (Chromium bulunamayan eski sistemler için grafik/HTML baskı)
    try {
      Add-Type -AssemblyName System.Windows.Forms

      $prev = $null
      try {
        $dev = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows' -Name Device -ErrorAction SilentlyContinue).Device
        if ($dev) { $prev = $dev.Split(',')[0] }
      } catch {}

      try {
        $ps = 'HKCU:\\Software\\Microsoft\\Internet Explorer\\PageSetup'
        if (-not (Test-Path $ps)) { New-Item -Path $ps -Force | Out-Null }
        Set-ItemProperty -Path $ps -Name header -Value '' -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $ps -Name footer -Value '' -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $ps -Name margin_left -Value '0' -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $ps -Name margin_right -Value '0' -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $ps -Name margin_top -Value '0' -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $ps -Name margin_bottom -Value '0' -ErrorAction SilentlyContinue
      } catch {}

      if ($printerName) {
        try { (New-Object -ComObject WScript.Network).SetDefaultPrinter($printerName) } catch {}
      }

      $form = New-Object System.Windows.Forms.Form
      $form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
      $form.ShowInTaskbar = $false
      $form.Width = 100
      $form.Height = 100

      $wb = New-Object System.Windows.Forms.WebBrowser
      $wb.ScriptErrorsSuppressed = $true
      $form.Controls.Add($wb)
      $form.Show()

      $script:ready = $false
      $wb.add_DocumentCompleted({
        param($s, $e)
        $script:ready = $true
      })

      $wb.Navigate((New-Object System.Uri $htmlPath).AbsoluteUri)

      $sw = [Diagnostics.Stopwatch]::StartNew()
      while (-not $script:ready -and $sw.Elapsed.TotalSeconds -lt 4) {
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 30
      }

      if ($script:ready) {
        for ($c = 0; $c -lt $copies; $c++) {
          $wb.Print()
          $sw.Restart()
          while ($sw.Elapsed.TotalSeconds -lt 1.5) {
            [System.Windows.Forms.Application]::DoEvents()
            Start-Sleep -Milliseconds 40
          }
        }
        $printed = $true
      }

      $form.Close()
      $form.Dispose()

      if ($prev -and $prev -ne $printerName) {
        try { (New-Object -ComObject WScript.Network).SetDefaultPrinter($prev) } catch {}
      }

      if ($printed) {
        Write-Output "SUCCESS: $printerName"
        exit 0
      }
    } catch {}
  }

  # 3.4. SON ÇARE YEDEK: HTML basılamadıysa GDI PrintDocument ile düz metin bas
  if (-not $printed -and $textPath -and (Test-Path $textPath)) {
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $printerName
    if ($doc.PrinterSettings.IsValid) {
      $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
      $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
      $doc.OriginAtMargins = $false

      $script:lines = [System.IO.File]::ReadAllLines($textPath, [System.Text.Encoding]::UTF8)
      if ($script:lines.Count -gt 0) {
        $script:font = New-Object System.Drawing.Font("Consolas", 8.5, [System.Drawing.FontStyle]::Bold)
        $script:brush = [System.Drawing.Brushes]::Black
        if ($isPos) {
          $calcHeight = [Math]::Max(250, [int]($script:lines.Count * 14) + 100)
          $doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("CustomReceipt", 315, $calcHeight)
        }
        $script:lineIdx = 0
        $doc.add_PrintPage({
          param($sender, $ev)
          $g = $ev.Graphics
          $lineHeight = $script:font.GetHeight($g) + 1.2
          $y = 6.0
          $x = 4.0
          while ($script:lineIdx -lt $script:lines.Count) {
            $curLine = $script:lines[$script:lineIdx]
            if ($curLine -ne $null) {
              $g.DrawString($curLine, $script:font, $script:brush, $x, $y)
            }
            $y += $lineHeight
            $script:lineIdx++
          }
          $ev.HasMorePages = $false
        })
        for ($c = 0; $c -lt $copies; $c++) {
          $script:lineIdx = 0
          $doc.Print()
        }
        $doc.Dispose()
        $script:font.Dispose()
        Write-Output "SUCCESS: $printerName"
        exit 0
      }
    }
  }

  Write-Output "ERROR: Yazdırma işlemi gerçekleştirilemedi."
  exit 1
} catch {
  Write-Output "ERROR: Yazdırma işlemi sırasında hata oluştu: $($_.Exception.Message)"
  exit 1
}
`;

      try {
        const { stdout } = await runPowerShell(psScript, 8000);
        if (stdout && stdout.includes("SUCCESS")) {
          printed = true;
          const matchName = stdout.match(/SUCCESS:\s*(.+)/)?.[1]?.trim() || targetPrinter;
          console.log(`[printercekmeApp] Yazdırma BAŞARILI: "${matchName || 'Varsayılan'}"`);
        } else if (stdout && stdout.includes("ERROR")) {
          printed = false;
          printErrorMessage = stdout.match(/ERROR:\s*(.+)/)?.[1]?.trim() || stdout.trim();
          console.warn(`[printercekmeApp] Yazdırma BAŞARISIZ: ${printErrorMessage}`);
        } else {
          printed = false;
          printErrorMessage = stdout ? stdout.trim() : "Yazıcıdan yanıt alınamadı.";
          console.warn(`[printercekmeApp] Beklenmeyen çıktı: ${printErrorMessage}`);
        }
      } catch (runErr) {
        console.warn("[printercekmeApp] PowerShell yazdırma hatası:", runErr.message);
        printErrorMessage = runErr.message;
      }

      setTimeout(() => {
        if (htmlFile) { try { fs.unlinkSync(htmlFile); } catch {} }
        if (textFile) { try { fs.unlinkSync(textFile); } catch {} }
      }, 5000);

      if (printed) {
        return {
          success: true,
          message: `Fiş "${targetPrinter || 'Varsayılan Yazıcı'}" cihazına başarıyla gönderildi.`,
          printerName: targetPrinter,
        };
      } else {
        return {
          success: false,
          message: printErrorMessage || "Yazıcıya gönderilemedi.",
        };
      }
    } else {
      // macOS / Linux Ortamı
      const targetArg = targetPrinter ? `-d "${targetPrinter.split(/[\\/]/).pop()}"` : "";
      const textContent = text || (html ? extractTextFromHtmlSimple(html) : "");
      const tmpFile = path.join(tmpDir, `print_${timestamp}.${html ? "html" : "txt"}`);
      fs.writeFileSync(tmpFile, html || textContent, "utf8");

      await execAsync(`lp ${targetArg} -n ${Number(copies) || 1} "${tmpFile}"`, { timeout: 10000 });
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 6000);

      return {
        success: true,
        message: `Fiş "${targetPrinter || 'Varsayılan Yazıcı'}" cihazına başarıyla gönderildi.`,
        printerName: targetPrinter,
      };
    }
  } catch (err) {
    console.error("[printercekmeApp] Yazdırma hatası:", err);
    return { success: false, message: `Yazıcı hatası: ${err.message}` };
  }
}

// ─── HTTP Endpoints ─────────────────────────────────────────────────────────
app.post(["/api/print", "/print"], async (req, res) => {
  const result = await executePrintJob(req.body);
  if (result.success) {
    return res.json(result);
  } else {
    return res.status(500).json(result);
  }
});

// ─── HTTP & WebSocket Sunucusu ──────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("[printercekmeApp] Yeni WebSocket istemcisi bağlandı.");

  let isPrinting = false;

  const sendPrinters = async () => {
    try {
      const list = await getSystemPrinters();
      if (ws.readyState === ws.OPEN && !isPrinting) {
        // İstemcinin beklediği doğrudan JSON yazıcı listesi
        ws.send(JSON.stringify(list || []));
      }
    } catch (err) {
      if (ws.readyState === ws.OPEN && !isPrinting) {
        ws.send(JSON.stringify([]));
      }
    }
  };

  // 1. ÖNCELİKLE MESAJ DİNLENİR (Bağlantı anında gönderilen print isteğini ASLA kaçırmamak için!)
  ws.on("message", async (data) => {
    try {
      const text = data ? (Buffer.isBuffer(data) ? data.toString("utf8") : String(data)).trim() : "";
      if (text.startsWith("{")) {
        const msg = JSON.parse(text);
        if (msg.action === "print" || msg.type === "PRINT") {
          isPrinting = true;
          console.log(`[printercekmeApp] WebSocket üzerinden yazdırma komutu alındı: "${msg.printerName || msg.targetDevice || 'Varsayılan'}"`);
          const result = await executePrintJob(msg);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: "print_result", ...result }));
          }
          return;
        }
      }
    } catch (msgErr) {
      console.warn("[printercekmeApp] Gelen mesaj ayrıştırılamadı:", msgErr.message);
    }
    await sendPrinters();
  });

  ws.on("close", () => {
    console.log("[printercekmeApp] WebSocket istemcisi ayrıldı.");
  });

  // 2. İlk yazıcı listesini arka planda asenkron gönder (await etmeden, listener aktifken)
  sendPrinters();
});

server.listen(PORT, HOST, () => {
  console.log(`================================================================`);
  console.log(`🖨️  printercekmeApp - Yerel Yazıcı Köprüsü Aktif!`);
  console.log(`📡 HTTP Endpoint : http://${HOST}:${PORT}/api/printers`);
  console.log(`🔌 WebSocket     : ws://${HOST}:${PORT}`);
  console.log(`💻 İşletim Sistemi: ${os.platform()} (${os.arch()})`);
  console.log(`================================================================`);
  // Başlangıçta yazıcı listesini ve durumlarını arka planda ısıt (cache warm-up)
  getSystemPrinters().catch(() => {});
});
