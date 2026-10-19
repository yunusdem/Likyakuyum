const express = require("express");
const cors = require("cors");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { exec } = require("child_process");
const os = require("os");
const util = require("util");

const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 9100;
const HOST = "127.0.0.1";

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

    // 1. Windows Ortamı: PowerShell -> Registry -> WMIC
    if (platform === "win32") {
      const systemRoot = process.env.SystemRoot || "C:\\Windows";
      const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
      const regPath = `${systemRoot}\\System32\\reg.exe`;
      const wmicPath = `${systemRoot}\\System32\\wbem\\wmic.exe`;

      // 1. Aşama: Tam yoldan PowerShell Get-Printer
      let psSuccess = false;
      try {
        const psCommand = `"${psPath}" -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Printer | Select-Object Name, Default, PrinterStatus | ConvertTo-Json -Compress"`;
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
        console.warn("[printercekmeApp] PowerShell çağrısı başarısız, Registry fallback deneniyor:", psErr.message);
      }

      // 2. Aşama: Windows Registry (Kayıt Defteri) Fallback
      // reg.exe her Windows makinesinde C:\Windows\System32\reg.exe konumunda mevcuttur
      if (!psSuccess || printers.length === 0) {
        try {
          console.log("[printercekmeApp] Windows Registry (reg.exe) üzerinden yazıcılar taranıyor...");
          let defaultPrinter = "";
          try {
            const { stdout: defOut } = await execAsync(
              `"${regPath}" query "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows" /v Device`,
              { timeout: 3000 }
            );
            const defMatch = defOut.match(/Device\s+REG_SZ\s+([^,]+)/i);
            if (defMatch && defMatch[1]) {
              defaultPrinter = defMatch[1].trim();
            }
          } catch {}

          const { stdout: regOut } = await execAsync(
            `"${regPath}" query "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Devices"`,
            { timeout: 4000 }
          );
          const lines = regOut.split(/\r?\n/);
          for (const line of lines) {
            const match = line.match(/^\s*(.+?)\s+REG_SZ\s+/i);
            if (match && match[1]) {
              const name = match[1].trim();
              if (name && !printers.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
                const isDef = Boolean(defaultPrinter && defaultPrinter.toLowerCase() === name.toLowerCase());
                printers.push({
                  name,
                  isDefault: isDef,
                  status: "Hazır",
                });
              }
            }
          }
        } catch (regErr) {
          console.warn("[printercekmeApp] Windows Registry hatası:", regErr.message);
        }
      }

      // 3. Aşama: WMIC Fallback (Eğer hala bulunamadıysa)
      if (printers.length === 0) {
        try {
          console.log("[printercekmeApp] WMIC fallback deneniyor...");
          const { stdout: wmicOut } = await execAsync(`"${wmicPath}" printer get name,default /format:csv`, { timeout: 5000 });
          const lines = wmicOut.trim().split(/\r?\n/).slice(1);
          for (const line of lines) {
            const parts = line.trim().split(",");
            if (parts.length >= 3) {
              const isDef = parts[1]?.trim().toUpperCase() === "TRUE";
              const name = parts[2]?.trim();
              if (name && !printers.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
                printers.push({
                  name,
                  isDefault: isDef,
                  status: "Hazır",
                });
              }
            }
          }
        } catch (wmicErr) {
          console.warn("[printercekmeApp] WMIC hatası:", wmicErr.message);
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
      await execAsync(`"${psPath}" -NoProfile -ExecutionPolicy Bypass -Command "${psCmd.replace(/\r?\n/g, ' ')}"`, { timeout: 4000 });
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

// ─── Doğrudan Sessiz Yazdırma Endpoint'i (/print ve /api/print) ───────────────
app.post(["/api/print", "/print"], async (req, res) => {
  const { html, text, printerName, targetDevice, isPos = true, copies = 1, title = "Likya_Fis" } = req.body || {};

  if (!html && !text) {
    return res.status(400).json({ success: false, message: "Yazdırılacak içerik (html veya text) bulunamadı." });
  }

  const targetPrinter = (printerName || targetDevice || "").trim();
  const platform = os.platform();
  const timestamp = Date.now();
  const tmpDir = path.join(os.tmpdir(), "likya-print-temp");

  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  } catch {}

  console.log(`[printercekmeApp] Yazdırma isteği alındı. Hedef Yazıcı: "${targetPrinter || 'Varsayılan'}", isPos: ${isPos}, Kopya: ${copies}`);

  try {
    if (platform === "win32") {
      const systemRoot = process.env.SystemRoot || "C:\\Windows";
      const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
      const safeTarget = targetPrinter.replace(/'/g, "''").replace(/"/g, '""');

      const textContent = text || (html ? extractTextFromHtmlSimple(html) : "");
      const textFile = path.join(tmpDir, `print_${timestamp}.txt`);
      fs.writeFileSync(textFile, textContent, "utf8");

      let printed = false;

      // 1. Aşama: HTML varsa ve Edge kuruluysa headless sessiz yazdırma
      if (html) {
        const htmlFile = path.join(tmpDir, `print_${timestamp}.html`);
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
        fs.writeFileSync(htmlFile, fullHtml, "utf8");

        const edgePaths = [
          `${process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)"}\\Microsoft\\Edge\\Application\\msedge.exe`,
          `${process.env.ProgramFiles || "C:\\Program Files"}\\Microsoft\\Edge\\Application\\msedge.exe`,
          `${systemRoot}\\System32\\msedge.exe`,
        ];
        const edgeExe = edgePaths.find((p) => {
          try { return fs.existsSync(p); } catch { return false; }
        });

        if (edgeExe) {
          try {
            const printArg = safeTarget ? `--print-to-printer="${safeTarget}"` : "--print-to-printer";
            for (let c = 0; c < Math.max(1, Number(copies) || 1); c++) {
              await execAsync(`"${edgeExe}" --headless --disable-gpu ${printArg} "${htmlFile}"`, { timeout: 20000 });
            }
            printed = true;
          } catch (edgeErr) {
            console.warn("[printercekmeApp] Edge headless yazdırma hatası, Out-Printer fallback deneniyor:", edgeErr.message);
          }
        }
        setTimeout(() => { try { fs.unlinkSync(htmlFile); } catch {} }, 8000);
      }

      // 2. Aşama: Edge yoksa veya başarısız olduysa PowerShell Out-Printer ile sessizce bas
      if (!printed && textContent) {
        const psPrintScript = `
$target = '${safeTarget}';
$p = if ($target) { Get-Printer | Where-Object { $_.Name -like ('*' + $target + '*') } | Select-Object -First 1 } else { $null };
if (-not $p -and $target) { $p = Get-Printer | Where-Object { $_.Name -eq $target } | Select-Object -First 1 };
$pName = if ($p) { $p.Name } else { (Get-Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1).Name };
for ($i = 0; $i -lt ${Math.max(1, Number(copies) || 1)}; $i++) {
  if ($pName) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
    Get-Content -Path '${textFile.replace(/'/g, "''")}' -Raw -Encoding UTF8 | Out-Printer -Name $pName
  } else {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
    Get-Content -Path '${textFile.replace(/'/g, "''")}' -Raw -Encoding UTF8 | Out-Printer
  }
}
`;
        await execAsync(`"${psPath}" -NoProfile -ExecutionPolicy Bypass -Command "${psPrintScript.replace(/\r?\n/g, ' ')}"`, { timeout: 20000 });
        printed = true;
      }

      setTimeout(() => { try { fs.unlinkSync(textFile); } catch {} }, 8000);

      if (printed) {
        return res.json({
          success: true,
          message: `Fiş "${targetPrinter || 'Varsayılan Yazıcı'}" cihazına başarıyla gönderildi.`,
          printerName: targetPrinter,
        });
      }
    } else {
      // macOS / Linux Ortamı
      const targetArg = targetPrinter ? `-d "${targetPrinter.split(/[\\/]/).pop()}"` : "";
      const textContent = text || (html ? extractTextFromHtmlSimple(html) : "");
      const tmpFile = path.join(tmpDir, `print_${timestamp}.${html ? "html" : "txt"}`);
      fs.writeFileSync(tmpFile, html || textContent, "utf8");

      await execAsync(`lp ${targetArg} -n ${Number(copies) || 1} "${tmpFile}"`, { timeout: 10000 });
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 6000);

      return res.json({
        success: true,
        message: `Fiş "${targetPrinter || 'Varsayılan Yazıcı'}" cihazına başarıyla gönderildi.`,
        printerName: targetPrinter,
      });
    }
  } catch (err) {
    console.error("[printercekmeApp] Yazdırma hatası:", err);
    return res.status(500).json({ success: false, message: `Yazıcı hatası: ${err.message}` });
  }

  return res.json({ success: true, message: `Fiş "${targetPrinter || 'Varsayılan Yazıcı'}" cihazına iletildi.` });
});

// ─── HTTP & WebSocket Sunucusu ──────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("[printercekmeApp] Yeni WebSocket istemcisi bağlandı.");

  // Bağlanır bağlanmaz güncel listeyi gönder
  getSystemPrinters()
    .then((list) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "PRINTER_LIST", data: list || [] }));
      }
    })
    .catch((err) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "PRINTER_LIST", data: [] }));
      }
    });

  // İstemciden istek geldiğinde
  ws.on("message", async (msg) => {
    try {
      const list = await getSystemPrinters();
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "PRINTER_LIST", data: list || [] }));
      }
    } catch {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "PRINTER_LIST", data: [] }));
      }
    }
  });

  ws.on("close", () => {
    console.log("[printercekmeApp] WebSocket istemcisi ayrıldı.");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`================================================================`);
  console.log(`🖨️  printercekmeApp - Yerel Yazıcı Köprüsü Aktif!`);
  console.log(`📡 HTTP Endpoint : http://${HOST}:${PORT}/api/printers`);
  console.log(`🔌 WebSocket     : ws://${HOST}:${PORT}`);
  console.log(`💻 İşletim Sistemi: ${os.platform()} (${os.arch()})`);
  console.log(`================================================================`);
});
