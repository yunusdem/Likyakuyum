const express = require("express");
const cors = require("cors");
const http = require("http");
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  // Chrome / Web standardı Private Network Access (Yerel ağ / localhost izni)
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(cors({ origin: "*" }));
app.use(express.json());

// ─── Sistem Yazıcılarını Algılama Fonksiyonu ────────────────────────────────
async function getSystemPrinters() {
  const platform = os.platform();
  const printers = [];

  // 1. Windows Ortamı: PowerShell Get-Printer
  if (platform === "win32") {
    try {
      const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Printer | Select-Object Name, Default, PrinterStatus | ConvertTo-Json -Compress"`;
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
      }
    } catch (psErr) {
      console.warn("[printercekmeApp] PowerShell hatası, WMIC fallback deneniyor:", psErr.message);
      // WMIC Fallback
      try {
        const { stdout: wmicOut } = await execAsync(`wmic printer get name,default /format:csv`, { timeout: 6000 });
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
        console.error("[printercekmeApp] WMIC hatası:", wmicErr.message);
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
        // Hem "printer POS_80 is idle" hem de "_123_123_12_12 yazıcısı boşta" desteklenir
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

  return printers;
}

// ─── HTTP Endpoints ─────────────────────────────────────────────────────────

// Sağlık kontrolü
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "printercekmeApp",
    version: "1.0.0",
    platform: os.platform(),
    time: new Date().toISOString(),
  });
});

// Yazıcıları listeleme endpoint'i
app.get(["/api/printers", "/printers"], async (_req, res) => {
  try {
    const list = await getSystemPrinters();
    res.json(list);
  } catch (err) {
    console.error("[printercekmeApp] Hata:", err);
    res.status(500).json({ error: "Yazıcılar okunamadı", message: err.message });
  }
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
        ws.send(JSON.stringify({ type: "PRINTER_LIST", data: list }));
      }
    })
    .catch((err) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
      }
    });

  // İstemciden istek geldiğinde
  ws.on("message", async (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed.action === "getPrinters" || parsed.type === "GET_PRINTERS") {
        const list = await getSystemPrinters();
        ws.send(JSON.stringify({ type: "PRINTER_LIST", data: list }));
      }
    } catch {
      // Mesaj json değilse de yazıcıları döndür
      const list = await getSystemPrinters();
      ws.send(JSON.stringify({ type: "PRINTER_LIST", data: list }));
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
