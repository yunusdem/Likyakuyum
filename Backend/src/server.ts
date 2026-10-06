import { app } from "./app.js";
import { env } from "./config/env.config.js";
import { connectDatabase } from "./config/database.config.js";
import { logger } from "./utils/logger.js";
import { BulutZamanlayici } from "./services/admin/bulutZamanlayici.js";
import { KurulumBildirim } from "./services/kurulum/kurulumBildirim.js";
import { Guncelleyici } from "./services/kurulum/guncelleyici.js";
import { KurulumLisansService } from "./services/kurulum/kurulumLisans.service.js";
import { kurulumHavuzu } from "./services/kurulum/kurulumDb.js";
import { semaGocUygula } from "./services/semaGoc.service.js";

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
      if (env.KURULUM_MODU) {
        // Kurulum: yeni sürümün şema göçleri kendi veritabanına uygulanır, merkeze bildirim başlar
        kurulumHavuzu()
          .then((pool) => semaGocUygula(pool))
          .then((s) => s.uygulanan.length && logger.info(`[KURULUM] Şema güncellendi: ${s.uygulanan.join(", ")}`))
          .catch((err) => logger.error(`[KURULUM] Şema güncellemesi yapılamadı: ${err?.message}`));
        // Lisans ve bütünlük denetimi açılışta başlasın (ilk kullanıcı isteği beklemesin)
        KurulumLisansService.durum(true).catch(() => undefined);
        Guncelleyici.baslat();
        KurulumBildirim.baslat();
      }
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
