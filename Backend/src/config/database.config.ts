import { logger } from "../utils/logger.js";
import { checkDbConnection } from "./mssql.config.js";

/**
 * Enterprise Database Connection Configuration
 * Veritabanı bağlantısı kullanıcı girişinde dinamik olarak kurulmaktadır.
 * Açılışta sessiz başlar, gereksiz bağlantı uyarısı basmaz.
 */
export const connectDatabase = async (): Promise<void> => {
  // Dynamic per-user connection on login
};

