// Sürekli açık (warm) Headless Edge/Chrome CDP (Chrome DevTools Protocol) görsel motoru.
// Her fişte sıfırdan tarayıcı ve profil açmak (~2-4 sn) yerine, arka planda tek bir tarayıcı
// oturumunu sıcak tutar ve her 80mm POS / A4 HTML'ini ~40-150 ms içinde birebir PNG'ye çevirir.
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const { spawn } = require("child_process");
const WebSocket = require("ws");

const A4_GEN_PX = 794;
const A4_YUK_PX = 1123;
const A4_OLCEK = 2;
const A4_EN_COK_SAYFA = 5;

class WarmCdpRenderer {
  constructor() {
    this.chromiumPath = null;
    this.proc = null;
    this.port = 0;
    this.ws = null;
    this.frameId = null;
    this.msgId = 1;
    this.pending = new Map();
    this.startingPromise = null;
    this.renderCount = 0;
    this.profileDir = "";
    this.shuttingDown = false;
  }

  _getProfileDir() {
    if (this.profileDir) return this.profileDir;
    const base =
      os.platform() === "win32"
        ? path.join(process.env.SystemDrive || "C:", "ProgramData", "LikyaPrintTemp")
        : path.join(os.tmpdir(), "likya-print-temp");
    this.profileDir = path.join(base, "cdp_warm_profile");
    try {
      if (!fs.existsSync(this.profileDir)) {
        fs.mkdirSync(this.profileDir, { recursive: true });
      }
    } catch {
      this.profileDir = path.join(os.tmpdir(), "likya-cdp-warm-profile");
      try {
        if (!fs.existsSync(this.profileDir)) {
          fs.mkdirSync(this.profileDir, { recursive: true });
        }
      } catch {}
    }
    return this.profileDir;
  }

  isReady() {
    return Boolean(
      this.proc &&
        !this.proc.killed &&
        this.proc.exitCode === null &&
        this.ws &&
        this.ws.readyState === WebSocket.OPEN &&
        this.frameId
    );
  }

  _cleanupPending(reason) {
    for (const [, p] of this.pending.entries()) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
    this.pending.clear();
  }

  _resetConnection() {
    this._cleanupPending("CDP bağlantısı kapandı");
    if (this.ws) {
      try { this.ws.removeAllListeners(); } catch {}
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.frameId = null;
  }

  shutdown() {
    this.shuttingDown = true;
    this._resetConnection();
    if (this.proc) {
      try { this.proc.kill(); } catch {}
      this.proc = null;
    }
    this.port = 0;
  }

  _send(method, params = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("CDP WebSocket açık değil"));
      }
      const id = this.msgId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP zaman aşımı: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  _httpGetJson(urlStr, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
      const req = http.get(urlStr, { timeout: timeoutMs }, (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("HTTP timeout")); });
    });
  }

  async ensureStarted(chromiumPath) {
    if (this.shuttingDown) return false;
    if (chromiumPath) this.chromiumPath = chromiumPath;
    if (!this.chromiumPath) return false;
    if (this.isReady()) return true;
    if (this.startingPromise) return this.startingPromise;

    this.startingPromise = this._startInternal()
      .then((ok) => {
        this.startingPromise = null;
        return ok;
      })
      .catch(() => {
        this.startingPromise = null;
        return false;
      });
    return this.startingPromise;
  }

  async _startInternal() {
    this._resetConnection();
    if (this.proc) {
      try { this.proc.kill(); } catch {}
      this.proc = null;
    }

    const profDir = this._getProfileDir();
    // Eski DevToolsActivePort dosyasını temizle ki eski portu okumayalım
    const activePortFile = path.join(profDir, "DevToolsActivePort");
    try { if (fs.existsSync(activePortFile)) fs.unlinkSync(activePortFile); } catch {}

    const args = [
      "--headless=new",
      `--user-data-dir=${profDir}`,
      "--remote-debugging-port=0",
      "--remote-allow-origins=*",
      "--disable-gpu",
      "--no-sandbox",
      "--allow-file-access-from-files",
      "--hide-scrollbars",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      "--mute-audio",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "about:blank",
    ];

    const port = await new Promise((resolve) => {
      let resolved = false;
      const done = (p) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          clearInterval(poll);
          resolve(p);
        }
      };

      const child = spawn(this.chromiumPath, args, {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      });
      this.proc = child;

      let errBuf = "";
      child.stderr.on("data", (chunk) => {
        errBuf += chunk.toString("utf8");
        const m = errBuf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//i);
        if (m && m[1]) {
          done(Number(m[1]));
        }
      });

      child.on("exit", () => {
        this._resetConnection();
        if (this.proc === child) this.proc = null;
        done(0);
      });
      child.on("error", () => {
        done(0);
      });

      // Fallback: DevToolsActivePort dosyasını da dinle
      const poll = setInterval(() => {
        try {
          if (fs.existsSync(activePortFile)) {
            const txt = fs.readFileSync(activePortFile, "utf8").trim();
            const firstLine = txt.split(/\r?\n/)[0];
            const p = Number(firstLine);
            if (p > 0) done(p);
          }
        } catch {}
      }, 60);

      const timeout = setTimeout(() => done(0), 7000);
    });

    if (!port) {
      if (this.proc) {
        try { this.proc.kill(); } catch {}
        this.proc = null;
      }
      return false;
    }

    this.port = port;

    // Sayfa hedefinin (page target) WebSocket URL'ini al
    let pageWsUrl = "";
    for (let i = 0; i < 15; i++) {
      try {
        const targets = await this._httpGetJson(`http://127.0.0.1:${port}/json/list`, 1000);
        if (Array.isArray(targets)) {
          const pageTarget = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
          if (pageTarget) {
            pageWsUrl = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 80));
    }

    if (!pageWsUrl) {
      if (this.proc) {
        try { this.proc.kill(); } catch {}
        this.proc = null;
      }
      return false;
    }

    // CDP WebSocket bağlantısını kur
    const wsConnected = await new Promise((resolve) => {
      let done = false;
      const finish = (ok) => {
        if (!done) {
          done = true;
          clearTimeout(t);
          resolve(ok);
        }
      };
      const t = setTimeout(() => finish(false), 3000);
      const ws = new WebSocket(pageWsUrl, { maxPayload: 64 * 1024 * 1024 });
      this.ws = ws;

      ws.on("open", () => finish(true));
      ws.on("error", () => finish(false));
      ws.on("close", () => {
        this._cleanupPending("CDP WebSocket kapandı");
        this.ws = null;
        this.frameId = null;
      });
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString("utf8"));
          if (msg.id && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            clearTimeout(p.timer);
            if (msg.error) {
              p.reject(new Error(msg.error.message || "CDP hatası"));
            } else {
              p.resolve(msg.result);
            }
          }
        } catch {}
      });
    });

    if (!wsConnected) {
      this._resetConnection();
      return false;
    }

    try {
      await this._send("Page.enable");
      const tree = await this._send("Page.getFrameTree");
      this.frameId = tree?.frameTree?.frame?.id || null;
      if (!this.frameId) return false;
      console.log(`[cdpRenderer] Sıcak Chromium hazır (port: ${port}).`);
      return true;
    } catch (e) {
      this._resetConnection();
      return false;
    }
  }

  async _waitImagesAndFonts() {
    try {
      await this._send(
        "Runtime.evaluate",
        {
          expression: `(async () => {
            try {
              const imgs = Array.from(document.images || []);
              await Promise.all(imgs.map(img => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise(res => {
                  const t = setTimeout(res, 1200);
                  img.onload = () => { clearTimeout(t); res(); };
                  img.onerror = () => { clearTimeout(t); res(); };
                });
              }));
              if (document.fonts && document.fonts.ready) {
                await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 300))]);
              }
              await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            } catch {}
            return true;
          })()`,
          awaitPromise: true,
          returnByValue: true,
        },
        3000
      );
    } catch {}
  }

  /**
   * 80mm POS HTML içeriğini birebir 304 x calculatedHeight @ 2x PNG'ye çevirir.
   * @returns {Promise<boolean>}
   */
  async renderPosPng(chromiumPath, fullHtml, height, pngFile) {
    try {
      const ok = await this.ensureStarted(chromiumPath);
      if (!ok) return false;

      await this._send("Emulation.setDeviceMetricsOverride", {
        width: 304,
        height,
        deviceScaleFactor: 2,
        mobile: false,
      });

      await this._send("Page.setDocumentContent", {
        frameId: this.frameId,
        html: fullHtml,
      });

      await this._waitImagesAndFonts();

      const shot = await this._send(
        "Page.captureScreenshot",
        {
          format: "png",
          fromSurface: true,
        },
        6000
      );

      if (!shot || !shot.data) return false;
      const buf = Buffer.from(shot.data, "base64");
      if (buf.length < 1000) return false;
      fs.writeFileSync(pngFile, buf);

      this.renderCount++;
      // Bellek şişmesini önlemek için arka planda hafif temizlik
      if (this.renderCount % 40 === 0) {
        this._send("Page.setDocumentContent", { frameId: this.frameId, html: "<!DOCTYPE html><html><body></body></html>" }).catch(() => {});
      }
      return true;
    } catch (err) {
      console.warn("[cdpRenderer] POS render hatası (yeniden başlatılacak):", err.message);
      this._resetConnection();
      return false;
    }
  }

  /**
   * A4 HTML içeriğini tek oturumda sayfa sayısını ölçerek alt alta A4 PNG'ye çevirir.
   * @returns {Promise<{ png: string, sayfa: number } | null>}
   */
  async renderA4Png(chromiumPath, fullHtml, pngFile) {
    try {
      const ok = await this.ensureStarted(chromiumPath);
      if (!ok) return null;

      await this._send("Emulation.setDeviceMetricsOverride", {
        width: A4_GEN_PX,
        height: A4_YUK_PX,
        deviceScaleFactor: A4_OLCEK,
        mobile: false,
      });

      await this._send("Page.setDocumentContent", {
        frameId: this.frameId,
        html: fullHtml,
      });

      await this._waitImagesAndFonts();

      // Sayfa sayısını mevcut algoritma ile birebir aynı şekilde (PDF sayfa nesnelerinden) ölç
      let sayfa = 1;
      try {
        const pdfRes = await this._send(
          "Page.printToPDF",
          {
            displayHeaderFooter: false,
            printBackground: true,
            preferCSSPageSize: true,
          },
          8000
        );
        if (pdfRes && pdfRes.data) {
          const pdfLatin = Buffer.from(pdfRes.data, "base64").toString("latin1");
          const n = (pdfLatin.match(/\/Type\s*\/Page[^s]/g) || []).length;
          if (n > 0) sayfa = Math.min(A4_EN_COK_SAYFA, n);
        }
      } catch {}

      if (sayfa > 1) {
        await this._send("Emulation.setDeviceMetricsOverride", {
          width: A4_GEN_PX,
          height: A4_YUK_PX * sayfa,
          deviceScaleFactor: A4_OLCEK,
          mobile: false,
        });
        await new Promise((r) => setTimeout(r, 20));
      }

      const shot = await this._send(
        "Page.captureScreenshot",
        {
          format: "png",
          fromSurface: true,
        },
        10000
      );

      if (!shot || !shot.data) return null;
      const buf = Buffer.from(shot.data, "base64");
      if (buf.length < 1000) return null;
      fs.writeFileSync(pngFile, buf);

      this.renderCount++;
      return { png: pngFile, sayfa };
    } catch (err) {
      console.warn("[cdpRenderer] A4 render hatası (yeniden başlatılacak):", err.message);
      this._resetConnection();
      return null;
    }
  }
}

module.exports = new WarmCdpRenderer();
