import { logger } from "../utils/logger.js";
import { checkDbConnection } from "./mssql.config.js";
/**
 * Enterprise Database Connection Configuration
 * Initializes MSSQL Connection for TODVZ_KULLANICI and enterprise tables
 */
export const connectDatabase = async () => {
    try {
        const isConnected = await checkDbConnection();
        if (isConnected) {
            logger.info("📦 MSSQL Veritabanı bağlantısı başarıyla başlatıldı (R2016_dvz Active).");
        }
        else {
            logger.warn("⚠️ MSSQL veritabanı çevrimdışı veya bağlanılamadı. Lütfen SQL Server servisinin çalıştığından emin olun.");
        }
    }
    catch (error) {
        logger.error("❌ Veritabanı bağlantı hatası:", error);
    }
};
