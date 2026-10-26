const express = require("express");
const cors = require("cors");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const CURRENT_VERSION = "1.0.8";
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { exec, spawn } = require("child_process");
const os = require("os");
const util = require("util");

const execAsync = util.promisify(exec);

// Windows ortamında IE11/Edge ve varsayılan yazıcı ayarlarını başlangıçta kayıt defterine uygula
function initWindowsPrinterRegistry() {
  if (os.platform() !== "win32") return;
  const regCmds = [
    // Windows 10/11'de "Varsayılan yazıcımı Windows yönetsin" özelliğini kapat (Yazıcı seçimini kalıcı kıl)
    'reg add "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows" /v "LegacyDefaultPrinterMode" /t REG_DWORD /d 1 /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\Main\\FeatureControl\\FEATURE_BROWSER_EMULATION" /v "powershell.exe" /t REG_DWORD /d 11001 /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\Main\\FeatureControl\\FEATURE_BROWSER_EMULATION" /v "PrinterAgent.exe" /t REG_DWORD /d 11001 /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\Main\\FeatureControl\\FEATURE_BROWSER_EMULATION" /v "node.exe" /t REG_DWORD /d 11001 /f',
    'reg add "HKCU\\Software\\Wow6432Node\\Microsoft\\Internet Explorer\\Main\\FeatureControl\\FEATURE_BROWSER_EMULATION" /v "powershell.exe" /t REG_DWORD /d 11001 /f',
    'reg add "HKCU\\Software\\Wow6432Node\\Microsoft\\Internet Explorer\\Main\\FeatureControl\\FEATURE_BROWSER_EMULATION" /v "PrinterAgent.exe" /t REG_DWORD /d 11001 /f',
    'reg add "HKCU\\Software\\Wow6432Node\\Microsoft\\Internet Explorer\\Main\\FeatureControl\\FEATURE_BROWSER_EMULATION" /v "node.exe" /t REG_DWORD /d 11001 /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\PageSetup" /v "header" /t REG_SZ /d "" /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\PageSetup" /v "footer" /t REG_SZ /d "" /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\PageSetup" /v "margin_left" /t REG_SZ /d "0" /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\PageSetup" /v "margin_right" /t REG_SZ /d "0" /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\PageSetup" /v "margin_top" /t REG_SZ /d "0" /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\PageSetup" /v "margin_bottom" /t REG_SZ /d "0" /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\PageSetup" /v "Shrink_To_Fit" /t REG_SZ /d "no" /f',
    'reg add "HKCU\\Software\\Microsoft\\Internet Explorer\\PageSetup" /v "Print_Background" /t REG_SZ /d "yes" /f',
  ];
  for (const cmd of regCmds) {
    try {
      exec(cmd, { windowsHide: true }, () => {});
    } catch {}
  }
}
initWindowsPrinterRegistry();

// PowerShell scriptlerini Base64 Unicode (-EncodedCommand) ile güvenle ve asılı kalmadan çalıştıran fonksiyon
function runPowerShell(script, timeoutMs = 12000) {
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

// Global yazıcı durum önbelleği (PowerShell Get-Printer gecikmesini 0 ms'ye indirir)
const printerCache = {
  list: [],
  lastUpdated: 0,
};

// ─── Sistem Yazıcılarını Algılama Fonksiyonu ────────────────────────────────
async function getSystemPrinters(forceRefresh = false) {
  // Önbellek geçerliyse (son 60 saniye içinde taranmışsa) PowerShell çalıştırmadan anında döndür (0 ms)
  const now = Date.now();
  if (!forceRefresh && printerCache.list && printerCache.list.length > 0 && (now - printerCache.lastUpdated < 60000)) {
    return printerCache.list;
  }

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

// ─── Otomatik Güncelleme Motoru (Auto-Updater) ───────────────────────────────
function downloadFile(urlStr, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error("Çok fazla yönlendirme"));

    let client = http;
    try {
      if (urlStr.startsWith("https:")) client = https;
    } catch {}

    const req = client.get(urlStr, { timeout: 45000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith("http")) {
          const parsed = new URL(urlStr);
          redirectUrl = new URL(redirectUrl, parsed.origin).href;
        }
        res.resume();
        return downloadFile(redirectUrl, destPath, maxRedirects - 1).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`İndirme başarısız, HTTP ${res.statusCode}`));
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close(() => resolve(destPath));
      });

      fileStream.on("error", (err) => {
        try { fs.unlinkSync(destPath); } catch {}
        reject(err);
      });
    });

    req.on("error", (err) => {
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      try { fs.unlinkSync(destPath); } catch {}
      reject(new Error("İndirme zaman aşımına uğradı"));
    });
  });
}

function fetchJson(urlStr, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith("https") ? https : http;
    const req = client.get(urlStr, { timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith("http")) {
          const parsed = new URL(urlStr);
          redirectUrl = new URL(redirectUrl, parsed.origin).href;
        }
        res.resume();
        return fetchJson(redirectUrl, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let rawData = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { rawData += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(rawData));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function isNewerVersion(remote, local) {
  const parse = (v) => String(v || "").replace(/[^0-9.]/g, "").split(".").map(Number);
  const r = parse(remote);
  const l = parse(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

let isUpdating = false;

async function performSelfUpdate(downloadUrl, targetVersion = "") {
  if (isUpdating) {
    return { success: false, message: "Güncelleme zaten devam ediyor, lütfen bekleyiniz." };
  }
  isUpdating = true;

  const currentExec = process.pkg ? process.execPath : process.argv[1];
  console.log(`[printercekmeApp] Otomatik güncelleme isteği alındı. Sürüm: ${targetVersion || 'Son Sürüm'}, URL: ${downloadUrl}, Mevcut Dosya: ${currentExec}`);

  if (!process.pkg && !currentExec.endsWith(".exe")) {
    console.log("[printercekmeApp] Geliştirme (node) ortamında çalışıyor, ikili dosya değişimi atlandı.");
    isUpdating = false;
    return { success: true, message: "Geliştirme ortamında çalışıldığı için exe değişimi simüle edildi." };
  }

  const systemDrive = process.env.SystemDrive || "C:";
  const tmpFolder = os.platform() === "win32"
    ? path.join(systemDrive, "ProgramData", "LikyaPrintTemp")
    : path.join(os.tmpdir(), "likya-print-temp");

  if (!fs.existsSync(tmpFolder)) {
    try { fs.mkdirSync(tmpFolder, { recursive: true }); } catch {}
  }

  const updateNewExe = path.join(tmpFolder, `PrinterAgent_new_${Date.now()}.exe`);

  try {
    console.log(`[printercekmeApp] Yeni sürüm indiriliyor: ${downloadUrl} -> ${updateNewExe}`);
    await downloadFile(downloadUrl, updateNewExe);

    const stats = fs.statSync(updateNewExe);
    if (stats.size < 5 * 1024 * 1024) {
      throw new Error(`İndirilen dosya boyutu beklenenden küçük (${Math.round(stats.size / 1024)} KB), güncelleme iptal edildi.`);
    }

    if (os.platform() === "win32") {
      const fd = fs.openSync(updateNewExe, "r");
      const buffer = Buffer.alloc(2);
      fs.readSync(fd, buffer, 0, 2, 0);
      fs.closeSync(fd);
      if (buffer.toString("ascii") !== "MZ") {
        throw new Error("İndirilen dosya geçerli bir Windows çalıştırılabilir dosyası (.exe) değil.");
      }
    }

    console.log(`[printercekmeApp] Yeni sürüm doğrulandı (${(stats.size / (1024 * 1024)).toFixed(1)} MB). Değiştirme ve yeniden başlatma hazırlanıyor...`);

    if (os.platform() === "win32") {
      const batPath = path.join(tmpFolder, `likya_updater_${Date.now()}.bat`);
      const batContent = `@echo off
chcp 65001 >nul
set OLD_EXE="${currentExec}"
set NEW_EXE="${updateNewExe}"

echo Güncelleme uygulanıyor, lütfen bekleyiniz...
timeout /t 2 /nobreak >nul

:retry_delete
del %OLD_EXE% >nul 2>&1
if exist %OLD_EXE% (
    timeout /t 1 /nobreak >nul
    goto retry_delete
)

move /y %NEW_EXE% %OLD_EXE% >nul 2>&1
start "" %OLD_EXE%

del "%~f0" >nul 2>&1
exit
`;
      fs.writeFileSync(batPath, batContent, "utf8");

      const updaterProc = spawn("cmd.exe", ["/c", batPath], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      updaterProc.unref();

      console.log("[printercekmeApp] Güncelleyici batch scripti başlatıldı, eski süreç kapatılıyor...");
      setTimeout(() => {
        process.exit(0);
      }, 800);

      return {
        success: true,
        message: "Yeni sürüm başarıyla indirildi. Uygulama kendini 2 saniye içinde güncelleyip yeniden başlatacaktır.",
      };
    } else {
      fs.copyFileSync(updateNewExe, currentExec);
      fs.chmodSync(currentExec, 0o755);
      const child = spawn(currentExec, [], { detached: true, stdio: "ignore" });
      child.unref();
      setTimeout(() => process.exit(0), 800);
      return { success: true, message: "Güncelleme uygulandı ve yeniden başlatılıyor." };
    }
  } catch (err) {
    isUpdating = false;
    console.error("[printercekmeApp] Otomatik güncelleme hatası:", err);
    try { if (fs.existsSync(updateNewExe)) fs.unlinkSync(updateNewExe); } catch {}
    return { success: false, message: `Güncelleme başarısız: ${err.message}` };
  }
}

const REMOTE_VERSION_ENDPOINTS = [
  "https://likyakuyum.com/printer-version.json",
  "https://likyaerp.com/printer-version.json",
];

async function checkRemoteUpdates() {
  if (!process.pkg && !process.execPath.endsWith(".exe")) {
    return;
  }

  for (const endpoint of REMOTE_VERSION_ENDPOINTS) {
    try {
      const data = await fetchJson(endpoint, 6000);
      if (data && data.version && isNewerVersion(data.version, CURRENT_VERSION)) {
        console.log(`[printercekmeApp] Yeni sürüm tespit edildi: v${data.version} (Mevcut: v${CURRENT_VERSION}). Otomatik güncelleniyor...`);
        let downloadUrl = data.downloadUrl || "/PrinterAgent.exe";
        if (!downloadUrl.startsWith("http")) {
          const parsed = new URL(endpoint);
          downloadUrl = new URL(downloadUrl, parsed.origin).href;
        }
        await performSelfUpdate(downloadUrl, data.version);
        return;
      }
    } catch {}
  }
}

// Uygulama açıldıktan 8 saniye sonra ve her 20 dakikada bir otomatik kontrol
setTimeout(() => {
  checkRemoteUpdates().catch(() => {});
  setInterval(() => {
    checkRemoteUpdates().catch(() => {});
  }, 20 * 60 * 1000);
}, 8000);



// ─── HTTP Endpoints ─────────────────────────────────────────────────────────

// Sağlık kontrolü
app.get(["/health", "/status", "/api/version", "/version"], (_req, res) => {
  res.json({
    status: "ok",
    service: "printercekmeApp",
    version: CURRENT_VERSION,
    platform: os.platform(),
    execPath: process.pkg ? process.execPath : process.argv[1],
    time: new Date().toISOString(),
  });
});

app.post(["/api/update", "/update"], async (req, res) => {
  const { downloadUrl, version } = req.body || {};
  const url = downloadUrl || "https://likyakuyum.com/PrinterAgent.exe";
  const result = await performSelfUpdate(url, version);
  res.json(result);
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

// Windows üzerinde kurulu Chromium (Edge veya Chrome) yürütülebilir dosyasını bulur
function findChromiumPath() {
  if (os.platform() !== "win32") return null;
  const sysDrive = process.env.SystemDrive || "C:";
  const candidates = [
    path.join(process.env["ProgramFiles(x86)"] || `${sysDrive}\\Program Files (x86)`, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles"] || `${sysDrive}\\Program Files`, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles"] || `${sysDrive}\\Program Files`, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || `${sysDrive}\\Program Files (x86)`, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["LOCALAPPDATA"] || `${sysDrive}\\Users\\Default\\AppData\\Local`, "Google", "Chrome", "Application", "chrome.exe"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return null;
}

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
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class NativeSpool {
    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool SetDefaultPrinter(string Name);
}
"@ -ErrorAction SilentlyContinue
} catch {}

try {
  Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows' -Name 'LegacyDefaultPrinterMode' -Value 1 -ErrorAction SilentlyContinue
} catch {}

$target = '${safeTarget}'
$installed = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters
$matched = $null
foreach ($p in $installed) {
  if ($p.Equals($target, [System.StringComparison]::OrdinalIgnoreCase)) { $matched = $p; break }
}
if (-not $matched) {
  foreach ($p in $installed) {
    if ($p.IndexOf($target, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or $target.IndexOf($p, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
      $matched = $p; break
    }
  }
}
if ($matched) {
  try { [NativeSpool]::SetDefaultPrinter($matched) | Out-Null } catch {
    (New-Object -ComObject WScript.Network).SetDefaultPrinter($matched)
  }
  Write-Output "SUCCESS: $matched"
} else {
  Write-Output "NOT_FOUND"
}
`;
      const { stdout } = await execAsync(`"${psPath}" -NoProfile -NonInteractive -Command "${psCmd.replace(/\r?\n/g, ' ')}"`, { timeout: 4000 });
      console.log(`[printercekmeApp] Varsayılan yazıcı "${printerName}" ayarlandı. Çıktı: ${stdout.trim()}`);
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
// Mükerrer yazdırmayı önleyen geçici önbellek (aynı jobId veya içerik 10 saniye içinde tekrar basılmaz)
const recentPrintJobs = new Map();

async function executePrintJob(job) {
  const { html, text, printerName, targetDevice, isPos = true, copies = 1, title = "Likya_Fis", jobId = "" } = job || {};

  if (!html && !text) {
    return { success: false, message: "Yazdırılacak içerik (html veya text) bulunamadı." };
  }

  const targetPrinter = (printerName || targetDevice || "").trim();
  const platform = os.platform();
  const timestamp = Date.now();

  // Deduplication Kontrolü: 10 saniye içinde aynı istek tekrar geldiyse mükerrer basımı engelle
  for (const [k, t] of recentPrintJobs.entries()) {
    if (timestamp - t > 15000) recentPrintJobs.delete(k);
  }

  if (jobId && recentPrintJobs.has(jobId)) {
    console.log(`[printercekmeApp] ⚠️ Mükerrer yazdırma isteği engellendi (JobId: ${jobId})`);
    return { success: true, message: "Fiş zaten yazdırılıyor (mükerrer istek engellendi)." };
  }

  const contentSig = `${targetPrinter}__${title}__${(text || "").trim().slice(0, 100)}__${(html || "").length}`;
  if (contentSig.length > 20 && recentPrintJobs.has(contentSig) && (timestamp - recentPrintJobs.get(contentSig) < 6000)) {
    console.log(`[printercekmeApp] ⚠️ Mükerrer yazdırma isteği engellendi (İçerik İmzası: ${contentSig.slice(0, 40)}...)`);
    return { success: true, message: "Fiş zaten yazdırılıyor (mükerrer istek engellendi)." };
  }

  if (jobId) recentPrintJobs.set(jobId, timestamp);
  recentPrintJobs.set(contentSig, timestamp);

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
      let pngFile = "";
      if (html) {
        htmlFile = path.join(tmpDir, `print_${timestamp}.html`);
        const isFullDoc = html.trim().startsWith("<!DOCTYPE") || html.trim().startsWith("<html");

        const printStyle = `
  <style>
    @page {
      margin: 0mm !important;
      size: ${isPos ? "80mm auto" : "A4 portrait"};
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
      width: 304px !important;
      max-width: 304px !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      text-align: left !important;
    }
    .belge-sablon {
      margin: 0 auto !important;
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
      text-align: left !important;
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

        // Edge/Chromium ile piksel piksel birebir önizleme görüntüsü oluştur (Google Chrome kalitesi)
        const chromiumPath = findChromiumPath();
        if (chromiumPath && isPos) {
          try {
            pngFile = path.join(tmpDir, `print_${timestamp}.png`);
            const fileUrl = "file:///" + path.resolve(htmlFile).replace(/\\/g, "/");
            const fastChromiumFlags = [
              "--headless=new",
              "--disable-gpu",
              "--no-sandbox",
              "--allow-file-access-from-files",
              "--hide-scrollbars",
              "--window-size=304,1600",
              "--disable-extensions",
              "--disable-background-networking",
              "--disable-background-timer-throttling",
              "--disable-backgrounding-occluded-windows",
              "--disable-breakpad",
              "--disable-component-update",
              "--disable-default-apps",
              "--disable-dev-shm-usage",
              "--disable-domain-reliability",
              "--disable-features=AudioServiceOutOfProcess",
              "--disable-hang-monitor",
              "--disable-ipc-flooding-protection",
              "--disable-popup-blocking",
              "--disable-prompt-on-repost",
              "--disable-renderer-backgrounding",
              "--disable-sync",
              "--disable-translate",
              "--metrics-recording-only",
              "--no-first-run",
              "--no-default-browser-check",
              "--mute-audio",
              "--disable-software-rasterizer",
              "--run-all-compositor-stages-before-draw",
              "--virtual-time-budget=200",
            ].join(" ");
            const renderCmd = `"${chromiumPath}" ${fastChromiumFlags} --screenshot="${pngFile}" "${fileUrl}"`;
            try {
              await execAsync(renderCmd, { timeout: 4000 });
            } catch {
              const fallbackCmd = `"${chromiumPath}" --headless --disable-gpu --no-sandbox --allow-file-access-from-files --hide-scrollbars --window-size=304,1600 --screenshot="${pngFile}" "${fileUrl}"`;
              await execAsync(fallbackCmd, { timeout: 4000 });
            }
            if (!fs.existsSync(pngFile) || fs.statSync(pngFile).size < 1000) {
              pngFile = "";
            }
          } catch {
            pngFile = "";
          }
        }
      }

      const escapedHtmlPath = htmlFile ? htmlFile.replace(/'/g, "''") : "";
      const escapedTextPath = textFile && fs.existsSync(textFile) ? textFile.replace(/'/g, "''") : "";
      const escapedPngPath = pngFile && fs.existsSync(pngFile) ? pngFile.replace(/'/g, "''") : "";
      const numCopies = Math.max(1, Number(copies) || 1);

      console.log(`[printercekmeApp] Yerel yazdırma işlemi başlatılıyor: "${targetPrinter || 'Varsayılan'}" (PNG: ${Boolean(pngFile)})`);

      // Windows Doğrudan GDI ve Spooler Yazdırma Scripti (Yüksek Hızlı Motor)
      const psScript = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

# Parametreler
$rawTarget = '${safeTarget}'
$htmlPath = '${escapedHtmlPath}'
$textPath = '${escapedTextPath}'
$pngPath = '${escapedPngPath}'
$copies = ${numCopies}
$isPos = ${isPos ? "$true" : "$false"}

# 1. Hızlı Doğrudan Hedef Yazıcı Doğrulaması (Ağ taraması yapmadan < 1ms)
$exactPrinter = $null
if ($rawTarget -and $rawTarget.Trim() -ne '') {
  try {
    $quickDoc = New-Object System.Drawing.Printing.PrintDocument
    $quickDoc.PrinterSettings.PrinterName = $rawTarget
    if ($quickDoc.PrinterSettings.IsValid) {
      $exactPrinter = $rawTarget
    }
  } catch {}
}

# 2. Eğer hedef doğrudan doğrulanmadıysa sistem yazıcılarını tara
if (-not $exactPrinter) {
  $installed = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters

  function Clean-PName($str) {
    if (-not $str) { return "" }
    $s = $str -replace '\\s*\\([0-9]+\\s*yönlendirildi\\)', ''
    $s = $s -replace '\\s*\\(yönlendirildi\\s*[0-9]+\\)', ''
    $s = $s -replace '\\s*\\([^\\)]*redirected[^\\)]*\\)', ''
    $s = $s -replace '\\s*\\([^\\)]*session[^\\)]*\\)', ''
    $s = $s -replace '[^a-zA-Z0-9]', ''
    return $s.ToLower().Trim()
  }

  function Test-IsVirtual($str) {
    if (-not $str) { return $true }
    $low = $str.ToLower()
    $virts = @("onenote", "pdf", "xps", "fax", "document writer", "root print queue", "anydesk", "teamviewer")
    foreach ($v in $virts) {
      if ($low.IndexOf($v) -ge 0) { return $true }
    }
    return $false
  }

  function Test-IsPos($str) {
    if (-not $str) { return $false }
    if (Test-IsVirtual $str) { return $false }
    $low = $str.ToLower()
    $posKeys = @("pos", "thermal", "termal", "receipt", "fis", "fiş", "80", "58", "xp-", "xprinter", "epson", "bixolon", "hprt", "rp80", "rp-80", "citizen", "star", "sam4s", "zj-", "argox", "zebra", "tsc", "godex", "kuveyt", "hugin", "inter")
    foreach ($k in $posKeys) {
      if ($low.IndexOf($k) -ge 0) { return $true }
    }
    return $false
  }

  if ($rawTarget -and $rawTarget.Trim() -ne '') {
    foreach ($p in $installed) {
      if ($p.Equals($rawTarget, [System.StringComparison]::OrdinalIgnoreCase)) {
        $exactPrinter = $p
        break
      }
    }
    if (-not $exactPrinter) {
      foreach ($p in $installed) {
        if (-not (Test-IsVirtual $p)) {
          if ($p.IndexOf($rawTarget, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or $rawTarget.IndexOf($p, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $exactPrinter = $p
            break
          }
        }
      }
    }
    if (-not $exactPrinter) {
      $cleanRaw = Clean-PName $rawTarget
      if ($cleanRaw.Length -ge 3) {
        foreach ($p in $installed) {
          if (-not (Test-IsVirtual $p)) {
            $cleanP = Clean-PName $p
            if ($cleanP -eq $cleanRaw -or $cleanP.IndexOf($cleanRaw) -ge 0 -or $cleanRaw.IndexOf($cleanP) -ge 0) {
              $exactPrinter = $p
              break
            }
          }
        }
      }
    }
  }

  # POS cihazlarını tara
  if ((-not $exactPrinter -or (Test-IsVirtual $exactPrinter)) -and $isPos) {
    foreach ($p in $installed) {
      if (Test-IsPos $p) {
        $exactPrinter = $p
        break
      }
    }
  }

  # İlk fiziksel yazıcıyı seç
  if (-not $exactPrinter) {
    foreach ($p in $installed) {
      if (-not (Test-IsVirtual $p)) {
        $exactPrinter = $p
        break
      }
    }
  }

  if (-not $exactPrinter -or (Test-IsVirtual $exactPrinter)) {
    $allPrintersStr = ($installed -join ', ')
    Write-Output "ERROR: Hedef yazıcı ('$rawTarget') bu bilgisayarda bulunamadı ve fiziksel yazıcı algılanamadı. Sistemdeki yazıcılar: [$allPrintersStr]"
    exit 1
  }
}

# 3. Gerekirse Varsayılan Yazıcı Yap (Eğer zaten varsayılansa bekleme yapma)
try {
  $currentDef = (New-Object System.Drawing.Printing.PrinterSettings).PrinterName
  if ($currentDef -ne $exactPrinter) {
    (New-Object -ComObject WScript.Network).SetDefaultPrinter($exactPrinter)
  }
} catch {}

$spooledSuccess = $false

# 4. YÖNTEM 1: GDI PrintDocument (Chromium PNG veya Metin çıktısı ile doğrudan donanıma baskı)
try {
  $doc = New-Object System.Drawing.Printing.PrintDocument
  $doc.PrinterSettings.PrinterName = $exactPrinter
  if ($doc.PrinterSettings.IsValid) {
    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
    $doc.OriginAtMargins = $false
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)

    if ($pngPath -and (Test-Path $pngPath)) {
      # Chromium ile render edilmiş birebir fiş görseli (Logo, Çizgi, QR, Bold)
      $script:pngImg = [System.Drawing.Image]::FromFile($pngPath)
      $doc.add_PrintPage({
        param($s, $ev)
        $g = $ev.Graphics
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        # 80mm fiş genişliğine göre orantılı çiz (tam oturacak şekilde)
        $targetW = $ev.PageBounds.Width
        if ($targetW -le 50 -or $targetW -gt 400) { $targetW = 285 }
        $scale = $targetW / $script:pngImg.Width
        $targetH = [int]($script:pngImg.Height * $scale)
        $leftOffset = [Math]::Max(0, [int](($ev.PageBounds.Width - $targetW) / 2))

        $g.DrawImage($script:pngImg, $leftOffset, 0, $targetW, $targetH)
        $ev.HasMorePages = $false
      })
      for ($c = 0; $c -lt $copies; $c++) {
        $doc.Print()
      }
      $script:pngImg.Dispose()
      $doc.Dispose()
      $spooledSuccess = $true
    } elseif ($textPath -and (Test-Path $textPath)) {
      # GDI Doğrudan Metin Baskısı
      $script:lines = [System.IO.File]::ReadAllLines($textPath, [System.Text.Encoding]::UTF8)
      if ($script:lines.Count -gt 0) {
        $script:font = New-Object System.Drawing.Font("Consolas", 8.5, [System.Drawing.FontStyle]::Bold)
        $script:brush = [System.Drawing.Brushes]::Black
        $script:lineIdx = 0
        $doc.add_PrintPage({
          param($sender, $ev)
          $g = $ev.Graphics
          $lineHeight = $script:font.GetHeight($g) + 1.2
          $y = 8.0
          $x = 14.0
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
        $spooledSuccess = $true
      }
    }
  }
} catch {
  Write-Warning ("GDI PrintDocument hatası: " + $_.Exception.Message)
}

# 5. YÖNTEM 2 (Yedek): Sadece GDI başarısız olursa Raw Spooler Doğrudan ESC/POS Gönderimi
if (-not $spooledSuccess -and $textPath -and (Test-Path $textPath) -and $isPos) {
  try {
    try {
      Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Likya_Fis";
        di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                    Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
                    int dwWritten = 0;
                    bool success = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return success;
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return false;
    }
}
"@ -ErrorAction SilentlyContinue
    } catch {}

    $rawStr = [System.IO.File]::ReadAllText($textPath, [System.Text.Encoding]::UTF8)
    if ($rawStr) {
      # ESC/POS Initialize (ESC @) + Türkçe Windows-1254/CP857 Kod Sayfası + Metin + Kağıt Kesme (GS V 1)
      $initBytes = [byte[]]@(0x1B, 0x40, 0x1B, 0x74, 0x12)
      $bodyBytes = [System.Text.Encoding]::GetEncoding(1254).GetBytes($rawStr + "\`r\`n\`r\`n\`r\`n\`r\`n")
      $cutBytes = [byte[]]@(0x1D, 0x56, 0x01)
      $allBytes = $initBytes + $bodyBytes + $cutBytes
      for ($c = 0; $c -lt $copies; $c++) {
        $spooledSuccess = [RawPrinter]::SendBytesToPrinter($exactPrinter, $allBytes)
      }
    }
  } catch {}
}

if ($spooledSuccess) {
  Write-Output "SUCCESS: $exactPrinter"
  exit 0
}

Write-Output "ERROR: '$exactPrinter' yazıcısına yazdırma komutu gönderilemedi."
exit 1
`;

      try {
        const { stdout, stderr } = await runPowerShell(psScript, 12000);
        const combined = (stdout || "") + "\n" + (stderr || "");
        if (combined.includes("SUCCESS")) {
          printed = true;
          const matchName = combined.match(/SUCCESS:\s*(.+)/)?.[1]?.trim() || targetPrinter;
          console.log(`[printercekmeApp] Yazdırma BAŞARILI: "${matchName || 'Varsayılan'}"`);
          return {
            success: true,
            message: `Fiş "${matchName || targetPrinter || 'Varsayılan Yazıcı'}" cihazına başarıyla gönderildi.`,
            printerName: matchName || targetPrinter,
          };
        } else if (combined.includes("ERROR")) {
          printed = false;
          printErrorMessage = combined.match(/ERROR:\s*(.+)/)?.[1]?.trim() || stderr.trim() || stdout.trim() || "Yazıcı hatası";
          console.warn(`[printercekmeApp] Yazdırma BAŞARISIZ: ${printErrorMessage}`);
          return {
            success: false,
            message: printErrorMessage,
          };
        } else {
          printed = false;
          printErrorMessage = stderr ? stderr.trim() : (stdout ? stdout.trim() : "Yazıcıdan yanıt alınamadı.");
          console.warn(`[printercekmeApp] Beklenmeyen çıktı: ${printErrorMessage}`);
          return {
            success: false,
            message: printErrorMessage,
          };
        }
      } catch (runErr) {
        console.warn("[printercekmeApp] PowerShell yazdırma hatası:", runErr.message);
        printErrorMessage = runErr.message;
        return {
          success: false,
          message: printErrorMessage,
        };
      } finally {
        setTimeout(() => {
          if (htmlFile) { try { fs.unlinkSync(htmlFile); } catch {} }
          if (textFile) { try { fs.unlinkSync(textFile); } catch {} }
          if (pngFile) { try { fs.unlinkSync(pngFile); } catch {} }
        }, 5000);
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

  // İlk bağlantıda sürüm bilgisini bildir
  try {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        action: "agent_info",
        service: "printercekmeApp",
        version: CURRENT_VERSION,
        platform: os.platform(),
      }));
    }
  } catch {}

  let isPrinting = false;

  const sendPrinters = async (force = false) => {
    try {
      // Önbellekte liste varsa HEMEN ANINDA gönder (PowerShell beklemesi 0 ms)
      if (printerCache.list && printerCache.list.length > 0 && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(printerCache.list));
      }
      // Yazdırma işlemi devam ediyorsa veya önbellek yeniyse gereksiz arka plan taraması yapma
      const now = Date.now();
      if (!isPrinting && (force || !printerCache.list || printerCache.list.length === 0 || (now - printerCache.lastUpdated >= 60000))) {
        const list = await getSystemPrinters(force);
        if (ws.readyState === ws.OPEN && !isPrinting) {
          ws.send(JSON.stringify(list || []));
        }
      }
    } catch (err) {
      if (ws.readyState === ws.OPEN && !isPrinting && (!printerCache.list || printerCache.list.length === 0)) {
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
        if (msg.action === "update" || msg.type === "UPDATE") {
          console.log(`[printercekmeApp] WebSocket üzerinden güncelleme komutu alındı: ${msg.downloadUrl || 'Varsayılan URL'}`);
          const url = msg.downloadUrl || "https://likyakuyum.com/PrinterAgent.exe";
          const updateRes = await performSelfUpdate(url, msg.version);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: "update_result", ...updateRes }));
          }
          return;
        }

        if (msg.action === "get_version" || msg.action === "version") {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: "agent_info", version: CURRENT_VERSION, service: "printercekmeApp" }));
          }
          return;
        }

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
  console.log(`🖨️  printercekmeApp - Yerel Yazıcı Köprüsü Aktif! (v${CURRENT_VERSION})`);
  console.log(`📡 HTTP Endpoint : http://${HOST}:${PORT}/api/printers`);
  console.log(`🔌 WebSocket     : ws://${HOST}:${PORT}`);
  console.log(`💻 İşletim Sistemi: ${os.platform()} (${os.arch()})`);
  console.log(`🔄 Otomatik Güncelleme: Aktif (v${CURRENT_VERSION} - likyakuyum.com / likyaerp.com)`);
  console.log(`================================================================`);
  // Başlangıçta yazıcı listesini ve durumlarını arka planda ısıt (cache warm-up)
  getSystemPrinters().catch(() => {});
});
