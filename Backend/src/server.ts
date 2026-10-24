import fs from "fs";
import { app } from "./app.js";
import { env } from "./config/env.config.js";
import { connectDatabase } from "./config/database.config.js";
import { logger } from "./utils/logger.js";
import { BulutZamanlayici } from "./services/admin/bulutZamanlayici.js";
import { DestekZamanlayici } from "./services/destek/destekZamanlayici.js";
import { DagitimService } from "./services/admin/dagitim.service.js";
import { DestekKurulumService } from "./services/destek/destekKurulum.service.js";
import { KurulumBildirim } from "./services/kurulum/kurulumBildirim.js";
import { Guncelleyici } from "./services/kurulum/guncelleyici.js";
import { KurulumLisansService } from "./services/kurulum/kurulumLisans.service.js";
import { kurulumHavuzu } from "./services/kurulum/kurulumDb.js";
import { GocDosyasiHatasi, semaGocUygula } from "./services/semaGoc.service.js";
import { gocDurumu, gocuCalistir } from "./services/kurulum/gocDurumu.js";
import { veriYolu } from "./services/kurulum/firmaDosyasi.js";
import { KurulumYedek } from "./services/kurulum/kurulumYedek.js";

// Process Exception Handlers
process.on("uncaughtException", (error: Error) => {
  logger.error("💥 Kritik Yakalanmamış Hata (Uncaught Exception)! Sunucu durduruluyor...", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any) => {
  logger.error("💥 Kritik Reddedilmiş Promise (Unhandled Rejection)!", reason);
});

const startServer = async () => {
  try {
    // 1. Initialize Database
    await connectDatabase();

    // 2. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Kuyumcu ERP Backend Server çalışıyor: http://localhost:${env.PORT}`);
      logger.info(`📡 API Endpointleri: http://localhost:${env.PORT}${env.API_PREFIX}`);
      logger.info(`🩺 Sağlık Kontrolü (Health): http://localhost:${env.PORT}${env.API_PREFIX}/health`);
      logger.info(`🌍 Ortam: ${env.NODE_ENV.toUpperCase()}`);
      BulutZamanlayici.baslat();
      DestekZamanlayici.baslat();
      // Yeniden başlatma sırasında yarım kalan dağıtım izlemesi sürsün (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md)
      DagitimService.baslat_acilis();
      if (env.KURULUM_MODU) {
        // Kurulum: yeni sürümün şema göçleri kendi veritabanına uygulanır, merkeze bildirim başlar. Göç bitene kadar API
        // istekleri bekletilir, sağlık ucu 503 döner (services/kurulum/gocDurumu.ts)
        void gocuCalistir(
          async () => semaGocUygula(await kurulumHavuzu()),
          (err) => err instanceof GocDosyasiHatasi
        ).then((s) => {
          if (s?.uygulanan.length) logger.info(`[KURULUM] Şema güncellendi: ${s.uygulanan.join(", ")}`);
          const g = gocDurumu();
          if (g.durum === "hata") logger.error(`[KURULUM] Şema güncellemesi yapılamadı: ${g.mesaj}`);
        });
        // Lisans ve bütünlük denetimi açılışta başlasın (ilk kullanıcı isteği beklemesin)
        KurulumLisansService.durum(true).catch(() => undefined);
        Guncelleyici.baslat();
        KurulumBildirim.baslat();
        DestekKurulumService.baslat();
        KurulumYedek.baslat();
      }
    });

    // Port dolu / izin yok: nedeni günlüğe yazılıp çıkılır (kurulumda görev 5 dakikada bir yeniden dener). Winston
    // dosyaya yazamadan süreç kapanabildiği için kurulumda veri klasörüne eşzamanlı da yazılır.
    server.on("error", (err: NodeJS.ErrnoException) => {
      const mesaj =
        err.code === "EADDRINUSE"
          ? `${env.PORT} numaralı port başka bir program tarafından kullanılıyor; sunucu açılamadı.`
          : `Sunucu ${env.PORT} numaralı portu dinleyemedi: ${err.message}`;
      logger.error(`❌ ${mesaj}`);
      if (env.KURULUM_MODU) {
        try {
          fs.mkdirSync(veriYolu("log"), { recursive: true });
          fs.appendFileSync(veriYolu("log/baslatma-hatasi.log"), `${new Date().toISOString()} ${mesaj}\n`, "utf8");
        } catch {
          /* yazılamazsa da çıkılır */
        }
      }
      process.exit(1);
    });

    // Graceful Shutdown Signals
    const gracefulShutdown = (signal: string) => {
      logger.warn(`🛑 ${signal} sinyali alındı. Sunucu güvenli bir şekilde kapatılıyor...`);
      server.close(() => {
        logger.info("👋 HTTP Sunucusu kapatıldı.");
        process.exit(0);
      });

      // Force close after 10s if hanging
      setTimeout(() => {
        logger.error("⚠️ Sunucu zorla kapatılıyor (Timeout).");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("❌ Sunucu başlatılamadı:", error);
    process.exit(1);
  }
};

startServer();
