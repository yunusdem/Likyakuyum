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
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <style>
    @page { size: ${isPos ? "80mm auto" : "A4 portrait"}; margin: 0mm !important; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { width: 100%; margin: 0 !important; padding: 0 !important; background: #ffffff; color: #000000; }
  </style>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  ${html}
</body>
</html>`;
        fs.writeFileSync(htmlFile, "\ufeff" + fullHtml, "utf8");
      }

      const escapedHtmlPath = htmlFile ? htmlFile.replace(/'/g, "''") : "";
      const escapedTextPath = textFile && fs.existsSync(textFile) ? textFile.replace(/'/g, "''") : "";
      const numCopies = Math.max(1, Number(copies) || 1);

      // WebBrowser (HTML/SVG/QR/Logo) öncelikli, anında donanıma basan PowerShell scripti
      const psScript = `
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$target = '${safeTarget}'
$htmlPath = '${escapedHtmlPath}'
$textPath = '${escapedTextPath}'
$copies = ${numCopies}

# 1. Mevcut varsayılan yazıcıyı kayıt defterinden gecikmesiz al
$prev = $null
try {
  $dev = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows' -Name Device -ErrorAction SilentlyContinue).Device
  if ($dev) { $prev = $dev.Split(',')[0] }
} catch {}

# 2. IE / WebBrowser sayfa kenar boşluklarını ve başlık/altbilgileri sıfırla
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

$printedOk = $false

# 3. ÖNCELİK: HTML Varsa WebBrowser ile birebir modaldaki gibi grafik, QR kod, logo ve kutularla bas
if ($htmlPath -and (Test-Path $htmlPath)) {
  try {
    if ($target) {
      try { (New-Object -ComObject WScript.Network).SetDefaultPrinter($target) } catch {}
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
      $printedOk = $true
    }

    $form.Close()
    $form.Dispose()
  } catch {
    $printedOk = $false
  } finally {
    if ($target -and $prev -and $prev -ne $target) {
      try { (New-Object -ComObject WScript.Network).SetDefaultPrinter($prev) } catch {}
    }
  }
}

# 4. YEDEK: HTML yoksa veya basılamadıysa GDI PrintDocument ile bas
if (-not $printedOk -and $textPath -and (Test-Path $textPath)) {
  try {
    Add-Type -AssemblyName System.Drawing
    $script:lines = Get-Content -LiteralPath $textPath -Encoding UTF8
    $script:font = New-Object System.Drawing.Font("Consolas", 8.5, [System.Drawing.FontStyle]::Bold)

    for ($c = 0; $c -lt $copies; $c++) {
      $doc = New-Object System.Drawing.Printing.PrintDocument
      $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
      if ($target) { $doc.PrinterSettings.PrinterName = $target }
      $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
      $doc.OriginAtMargins = $false

      $doc.add_PrintPage({
        param($sender, $ev)
        $g = $ev.Graphics
        $x = 4.0
        $y = 0.0
        $lineHeight = $script:font.GetHeight($g) + 1.5
        foreach ($line in $script:lines) {
          if ($line -ne $null) {
            $g.DrawString($line, $script:font, [System.Drawing.Brushes]::Black, $x, $y)
          }
          $y += $lineHeight
        }
        $ev.HasMorePages = $false
      })
      $doc.Print()
      $doc.Dispose()
    }
    $printedOk = $true
  } catch {}
}

if ($printedOk) {
  Write-Output "SUCCESS: $target"
  exit 0
} else {
  Write-Output "ERROR: Yazdırma başarısız"
  exit 1
}
`;

      try {
        const { stdout } = await runPowerShell(psScript, 10000);
        if (stdout && stdout.includes("SUCCESS")) {
          printed = true;
          console.log(`[printercekmeApp] Yazdırma BAŞARILI: "${targetPrinter || 'Varsayılan'}"`);
        } else if (stdout && stdout.includes("ERROR")) {
          printed = false;
          printErrorMessage = stdout.trim();
        } else {
          printed = true;
        }
      } catch (runErr) {
        console.warn("[printercekmeApp] PowerShell yazdırma hatası:", runErr.message);
        printErrorMessage = runErr.message;
      }

      setTimeout(() => {
        if (htmlFile) { try { fs.unlinkSync(htmlFile); } catch {} }
        if (textFile) { try { fs.unlinkSync(textFile); } catch {} }
      }, 10000);

      if (printed) {
        return {
          success: true,
          message: `Fiş "${targetPrinter || 'Varsayılan Yazıcı'}" cihazına başarıyla gönderildi.`,
          printerName: targetPrinter,
        };
      } else {
        return {
          success: false,
          message: `Yazıcıya gönderilemedi: ${printErrorMessage || "Bilinmeyen hata"}`,
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
});
