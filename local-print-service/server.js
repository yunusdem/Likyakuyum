/**
 * Likya Kuyumcu ERP - Yerel Sessiz Yazdırma Servisi (Local Silent Print Agent)
 * 
 * Bu servis kullanıcının yerel bilgisayarında (localhost:5050) çalışarak
 * web uygulamasından gönderilen fiş, etiket ve faturaları tarayıcı
 * önizleme penceresi (print preview) açılmadan doğrudan varsayılan veya
 * seçilen yazıcıdan anında sessizce (silent print) çıkartır.
 * 
 * Port: 5050
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

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Geçici dosyalar klasörü
const TMP_DIR = path.join(os.tmpdir(), "likya-print-temp");
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// ─── 1. Durum / Health Check ────────────────────────────────────────────────
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

// ─── 2. Sistemdeki Yazıcıları Listele (GET /printers) ────────────────────────
app.get("/printers", async (req, res) => {
  try {
    const platform = os.platform();
    let printers = [];

    if (platform === "win32") {
      // Windows PowerShell ile yazıcı listesi
      const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, DeviceID, Default, Local, Network, WorkOffline | ConvertTo-Json"`;
      try {
        const { stdout } = await execAsync(psCommand);
        if (stdout.trim()) {
          const parsed = JSON.parse(stdout);
          const rawList = Array.isArray(parsed) ? parsed : [parsed];
          printers = rawList.map((p) => ({
            name: p.Name || p.DeviceID,
            isDefault: Boolean(p.Default),
            isOnline: !Boolean(p.WorkOffline),
            isLocal: Boolean(p.Local),
            isNetwork: Boolean(p.Network),
          }));
        }
      } catch (err) {
        // Fallback wmic
        const { stdout } = await execAsync(`wmic printer get name,default /format:csv`);
        const lines = stdout.trim().split("\n").slice(1);
        printers = lines
          .map((line) => line.trim().split(","))
          .filter((parts) => parts.length >= 3 && parts[2])
          .map((parts) => ({
            name: parts[2].trim(),
            isDefault: parts[1]?.toLowerCase() === "true",
          }));
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
        printers = [{ name: "Default_Printer", isDefault: true }];
      }
    }

    res.json({
      success: true,
      count: printers.length,
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

// ─── 3. Sessiz Yazdırma Endpoint'i (POST /print) ─────────────────────────────
app.post("/print", async (req, res) => {
  const {
    html,
    text,
    pdfBase64,
    printerName,
    copies = 1,
    title = "Likya_Fis",
    isPos = true,
  } = req.body;

  if (!html && !text && !pdfBase64) {
    return res.status(400).json({
      success: false,
      message: "Yazdırılacak içerik (html, text veya pdfBase64) belirtilmelidir.",
    });
  }

  const timestamp = Date.now();
  const platform = os.platform();

  try {
    // ── DURUM A: Düz Metin / ESC-POS / ZPL Yazdırma ──
    if (text) {
      const textFile = path.join(TMP_DIR, `print_${timestamp}.txt`);
      fs.writeFileSync(textFile, text, "utf-8");

      if (platform === "win32") {
        let cmd = "";
        if (printerName) {
          cmd = `powershell -NoProfile -Command "Get-Content -Path '${textFile}' -Raw | Out-Printer -Name '${printerName}'"`;
        } else {
          cmd = `powershell -NoProfile -Command "Get-Content -Path '${textFile}' -Raw | Out-Printer"`;
        }
        await execAsync(cmd);
      } else {
        const dest = printerName ? `-d "${printerName}"` : "";
        await execAsync(`lp ${dest} "${textFile}"`);
      }

      // Temizlik
      setTimeout(() => {
        try { fs.unlinkSync(textFile); } catch {}
      }, 5000);

      return res.json({
        success: true,
        message: "Metin çıktısı varsayılan yazıcıya başarıyla gönderildi.",
        mode: "text",
        printerName: printerName || "Varsayılan",
      });
    }

    // ── DURUM B: Base64 PDF Yazdırma ──
    if (pdfBase64) {
      const pdfFile = path.join(TMP_DIR, `print_${timestamp}.pdf`);
      const buffer = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/, ""), "base64");
      fs.writeFileSync(pdfFile, buffer);

      if (platform === "win32") {
        // PDF-to-Printer / Sumatra / Acrobat veya PowerShell
        let cmd = "";
        if (printerName) {
          cmd = `powershell -NoProfile -Command "Start-Process -FilePath '${pdfFile}' -Verb PrintTo -ArgumentList '${printerName}' -PassThru | ForEach-Object { Start-Sleep -Seconds 2; Stop-Process -Id $_.Id -Force }"`;
        } else {
          cmd = `powershell -NoProfile -Command "Start-Process -FilePath '${pdfFile}' -Verb Print -PassThru | ForEach-Object { Start-Sleep -Seconds 2; Stop-Process -Id $_.Id -Force }"`;
        }
        await execAsync(cmd);
      } else {
        const dest = printerName ? `-d "${printerName}"` : "";
        await execAsync(`lp ${dest} "${pdfFile}"`);
      }

      setTimeout(() => {
        try { fs.unlinkSync(pdfFile); } catch {}
      }, 5000);

      return res.json({
        success: true,
        message: "PDF çıktısı varsayılan yazıcıya başarıyla gönderildi.",
        mode: "pdf",
        printerName: printerName || "Varsayılan",
      });
    }

    // ── DURUM C: HTML İçeriği Sessiz Yazdırma ──
    if (html) {
      const htmlFile = path.join(TMP_DIR, `print_${timestamp}.html`);
      
      // Standart tam teşekküllü HTML sarmalayıcı
      const fullHtml = `<!DOCTYPE html>
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
  ${html}
</body>
</html>`;

      fs.writeFileSync(htmlFile, fullHtml, "utf-8");

      if (platform === "win32") {
        // Windows Edge Headless veya mshtml PrintHTML veya PowerShell
        // Edge headless ile PDF'e çevirip veya doğrudan yazıcıya gönderme:
        const edgePaths = [
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
        ];
        
        let browserExe = edgePaths.find((p) => fs.existsSync(p));

        if (browserExe) {
          const printerParam = printerName ? `--kiosk-printer-device="${printerName}"` : "";
          const cmd = `"${browserExe}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-printer ${printerParam} "${htmlFile}"`;
          try {
            await execAsync(cmd, { timeout: 10000 });
          } catch {
            // Alternatif mshtml.dll yazdırma
            await execAsync(`rundll32.exe mshtml.dll,PrintHTML "${htmlFile}"`);
          }
        } else {
          // Fallback mshtml.dll
          await execAsync(`rundll32.exe mshtml.dll,PrintHTML "${htmlFile}"`);
        }
      } else if (platform === "darwin") {
        // macOS: CUPS lp / lpr
        // HTML'i text veya CUPS filtresi ile yazdırma
        const dest = printerName ? `-d "${printerName}"` : "";
        try {
          // macOS Safari / cups html to print
          await execAsync(`lp ${dest} -o fit-to-page "${htmlFile}"`);
        } catch {
          await execAsync(`lpr ${dest ? `-P "${printerName}"` : ""} "${htmlFile}"`);
        }
      } else {
        // Linux CUPS
        const dest = printerName ? `-d "${printerName}"` : "";
        await execAsync(`lp ${dest} "${htmlFile}"`);
      }

      setTimeout(() => {
        try { fs.unlinkSync(htmlFile); } catch {}
      }, 5000);

      return res.json({
        success: true,
        message: "Fiş / Belge çıktısı varsayılan yazıcıya önizlemesiz olarak doğrudan gönderildi.",
        mode: "html",
        printerName: printerName || "Varsayılan",
      });
    }

  } catch (err) {
    console.error("[Sessiz Yazdırma Hatası]:", err);
    return res.status(500).json({
      success: false,
      message: "Yazıcıya gönderilirken hata oluştu: " + (err.message || String(err)),
    });
  }
});

// Sunucuyu başlat
app.listen(PORT, "0.0.0.0", () => {
  console.clear();
  console.log("\x1b[32m%s\x1b[0m", "============================================================");
  console.log("\x1b[36m%s\x1b[0m", "   LIKYA KUYUMCU ERP - SESSIZ YAZDIRMA SERVISI (LOCAL PRINT)  ");
  console.log("\x1b[32m%s\x1b[0m", "============================================================");
  console.log(` \x1b[33m[DURUM]\x1b[0m        : \x1b[32mAKTIF VE DINLEMEDE (ONLINE)\x1b[0m`);
  console.log(` \x1b[33m[SERVIS PORT]\x1b[0m  : \x1b[37mhttp://localhost:${PORT}\x1b[0m`);
  console.log(` \x1b[33m[ENDPOINT]\x1b[0m     : \x1b[37mPOST http://localhost:${PORT}/print\x1b[0m`);
  console.log(` \x1b[33m[ISLETIM SISTEMI]\x1b[0m: \x1b[37m${os.platform()} (${os.arch()})\x1b[0m`);
  console.log("\x1b[32m%s\x1b[0m", "============================================================");
  console.log(" F10 tuşuna basıldığında tarayıcı önizleme penceresi AÇILMADAN");
  console.log(" fiş ve etiketler doğrudan varsayılan yazıcıdan çıkartılır.");
  console.log("\x1b[32m%s\x1b[0m", "============================================================");
  console.log(" Çıkmak için Ctrl + C tuşlarına basabilirsiniz.\n");
});
