import sql from "mssql";
import { env } from "./env.config.js";
import { parseServerAndPort } from "./mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
/**
 * Ana admin veritabanı (LIKYA_ADMIN) bağlantısı.
 * Firma veritabanlarının dinamik havuzundan (mssql.config.ts) bilinçli olarak ayrıdır:
 * bağlantı bilgisi yalnızca sunucudaki .env'den gelir, istekten/token'dan asla okunmaz.
 */
const MIN_SECRET_UZUNLUGU = 32;
export const adminYapilandirildiMi = () => !!env.ADMIN_DB_USER &&
    !!env.ADMIN_DB_PASSWORD &&
    env.ADMIN_JWT_SECRET.length >= MIN_SECRET_UZUNLUGU &&
    env.ADMIN_DB_ENC_KEY.length >= MIN_SECRET_UZUNLUGU;
export const adminYapilandirmaHatasi = () => new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Admin paneli bu sunucuda yapılandırılmamış (ADMIN_DB_USER, ADMIN_DB_PASSWORD, en az 32 karakterlik ADMIN_JWT_SECRET ve ADMIN_DB_ENC_KEY gerekli).");
let poolPromise = null;
export const getAdminPool = async () => {
    if (!adminYapilandirildiMi())
        throw adminYapilandirmaHatasi();
    if (!poolPromise) {
        const { host, port } = parseServerAndPort(env.ADMIN_DB_SERVER, env.ADMIN_DB_PORT || 1433);
        const config = {
            server: host,
            port,
            database: env.ADMIN_DB_NAME,
            user: env.ADMIN_DB_USER,
            password: env.ADMIN_DB_PASSWORD,
            options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
            pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
            connectionTimeout: 15000,
            requestTimeout: 30000,
        };
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then((pool) => {
            pool.on("error", (err) => {
                logger.error("[ADMIN DB] Havuz hatası, bağlantı yenilenecek.", err);
                poolPromise = null;
            });
            return pool;
        })
            .catch((err) => {
            poolPromise = null;
            logger.error(`[ADMIN DB] ${env.ADMIN_DB_NAME} veritabanına bağlanılamadı: ${err?.message}`);
            throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Admin veritabanına bağlanılamadı.");
        });
    }
    return poolPromise;
};
export const closeAdminPool = async () => {
    if (!poolPromise)
        return;
    try {
        const pool = await poolPromise;
        await pool.close();
    }
    catch {
        // bağlantı zaten kurulamamış
    }
    poolPromise = null;
};
