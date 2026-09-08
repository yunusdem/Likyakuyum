/**
 * Likya Kuyumcu ERP - Yerel SQL Köprüsü (Local Bridge Agent)
 * 
 * Bu servis kullanıcının kendi bilgisayarında çalışarak likyakuyum.com
 * web uygulamasının kullanıcının yerel MSSQL veritabanına bağlanmasını sağlar.
 * 
 * Port: 25050
 * Hedef MSSQL: localhost / 127.0.0.1:1433
 */

import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Agent çalışma ortam değişkenleri
process.env.PORT = process.env.PORT || "25050";
process.env.DB_SERVER = process.env.DB_SERVER || "127.0.0.1";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const backendPath = path.resolve(__dirname, "../Backend/dist/app.js");

try {
  const { app } = await import(`file://${backendPath}`);
  const PORT = Number(process.env.PORT);

  const server = http.createServer((req, res) => {
    // Agent status endpoint with CORS
    if (req.url === "/api/v1/agent-status" || req.url === "/agent-status") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Content-Type", "application/json");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
      res.writeHead(200);
      return res.end(
        JSON.stringify({
          success: true,
          agent: "Likya Kuyumcu Yerel SQL Köprüsü",
          status: "online",
          port: PORT,
          timestamp: new Date().toISOString(),
        })
      );
    }
    app(req, res);
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.clear();
    console.log("\x1b[32m%s\x1b[0m", "============================================================");
    console.log("\x1b[36m%s\x1b[0m", "   LIKYA KUYUMCU ERP - YEREL SQL KOPRUSU (LOCAL AGENT)      ");
    console.log("\x1b[32m%s\x1b[0m", "============================================================");
    console.log(` \x1b[33m[DURUM]\x1b[0m      : \x1b[32mAKTİF VE HAZIR (ONLINE)\x1b[0m`);
    console.log(` \x1b[33m[KÖPRÜ PORT]\x1b[0m : \x1b[37m${PORT}\x1b[0m`);
    console.log(` \x1b[33m[YEREL SQL]\x1b[0m  : \x1b[37m127.0.0.1:1433 (localhost)\x1b[0m`);
    console.log(` \x1b[33m[WEB ADRESİ]\x1b[0m : \x1b[34mhttp://likyakuyum.com\x1b[0m`);
    console.log("\x1b[32m%s\x1b[0m", "============================================================");
    console.log(" Bu konsol penceresini açık tuttuğunuz sürece web sitesi");
    console.log(" bilgisayarınızdaki yerel veritabanına güvenle bağlanabilir.");
    console.log("\x1b[32m%s\x1b[0m", "============================================================");
    console.log(" Çıkmak için Ctrl + C tuşlarına basabilirsiniz.\n");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\x1b[31m[HATA] Port ${PORT} zaten başka bir program tarafından kullanılıyor!\x1b[0m`);
      console.error("Lütfen açık olan diğer agent penceresini kapatıp tekrar deneyiniz.");
    } else {
      console.error("[HATA] Agent başlatılamadı:", err);
    }
  });

} catch (err) {
  console.error("\x1b[31m[Kritik Hata] Backend modülü yüklenemedi:\x1b[0m", err);
  console.error("Lütfen önce 'npm run build' komutunun çalıştırıldığından emin olun.");
  process.exit(1);
}
