import sql from "mssql";
import { env } from "./env.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
/**
 * In-memory registry of server+db credentials learned dynamically from user logins / requests
 */
export const dbCredentialsMap = new Map();
/**
 * Register credentials dynamically for a specific server and database
 */
export const setDbCredentials = (server, database, user, password) => {
    const s = (server && server.trim()) || env.DB_SERVER || "localhost";
    const d = (database && database.trim()) || env.DB_NAME || "R2016_dvz";
    const key = `${s.toLowerCase()}:${d.toLowerCase()}`;
    if (user && user.trim()) {
        dbCredentialsMap.set(key, {
            user: user.trim(),
            password: password !== undefined ? password : "",
        });
    }
};
/**
 * Base MSSQL Configuration Object Template
 */
export const createMssqlConfig = (server, database, user, password) => {
    const targetServer = (server && server.trim()) || env.DB_SERVER || "localhost";
    const targetDb = (database && database.trim()) || env.DB_NAME || "R2016_dvz";
    const key = `${targetServer.toLowerCase()}:${targetDb.toLowerCase()}`;
    const storedCreds = dbCredentialsMap.get(key);
    const finalUser = (user && user.trim()) || storedCreds?.user || env.DB_USER || "SA";
    const finalPassword = password !== undefined && password !== null
        ? password
        : (storedCreds?.password !== undefined
            ? storedCreds.password
            : (env.DB_PASSWORD || ""));
    return {
        server: targetServer,
        port: env.DB_PORT || 1433,
        database: targetDb,
        user: finalUser,
        password: finalPassword,
        options: {
            encrypt: env.DB_ENCRYPT,
            trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
            enableArithAbort: true,
        },
        pool: {
            max: 50,
            min: 2,
            idleTimeoutMillis: 30000,
        },
        connectionTimeout: 8000,
        requestTimeout: 30000,
    };
};
export const mssqlConfig = createMssqlConfig();
/**
 * Multi-tenant Connection Pool Cache (Key: server:database:user:password)
 */
const poolCache = new Map();
/**
 * Generates cache key for given server and database
 */
export const getPoolKey = (server, database) => {
    const s = (server && server.trim()) || env.DB_SERVER || "localhost";
    const d = (database && database.trim()) || env.DB_NAME || "R2016_dvz";
    return `${s.toLowerCase()}:${d.toLowerCase()}`;
};
/**
 * Gets or initializes a MSSQL connection pool dynamically for the specified server, database, and credentials.
 */
export const getDbPool = async (server, database, user, password) => {
    const targetServer = (server && server.trim()) || env.DB_SERVER || "localhost";
    const targetDb = (database && database.trim()) || env.DB_NAME || "R2016_dvz";
    const baseKey = getPoolKey(targetServer, targetDb);
    if (user && user.trim()) {
        setDbCredentials(targetServer, targetDb, user, password);
    }
    const storedCreds = dbCredentialsMap.get(baseKey);
    const finalUser = (user && user.trim()) || storedCreds?.user || env.DB_USER || "SA";
    const finalPassword = password !== undefined && password !== null
        ? password
        : (storedCreds?.password !== undefined
            ? storedCreds.password
            : (env.DB_PASSWORD || ""));
    const fullCacheKey = `${baseKey}:${finalUser}:${finalPassword}`;
    if (!poolCache.has(fullCacheKey)) {
        const config = createMssqlConfig(targetServer, targetDb, finalUser, finalPassword);
        const poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then(async (pool) => {
            logger.info(`✅ MSSQL Havuzu Aktif: [${targetServer} -> ${targetDb} (User: ${finalUser})]`);
            try {
                await pool.request().query(`
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TIODVZ_PARA' AND is_disabled = 0)
              DISABLE TRIGGER [TIODVZ_PARA] ON [dbo].[TODVZ_PARA];
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TUODVZ_PARA' AND is_disabled = 0)
              DISABLE TRIGGER [TUODVZ_PARA] ON [dbo].[TODVZ_PARA];
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TDODVZ_PARA' AND is_disabled = 0)
              DISABLE TRIGGER [TDODVZ_PARA] ON [dbo].[TODVZ_PARA];
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TIODVZ_YAZICI' AND is_disabled = 0)
              DISABLE TRIGGER [TIODVZ_YAZICI] ON [dbo].[TODVZ_YAZICI];
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TUODVZ_YAZICI' AND is_disabled = 0)
              DISABLE TRIGGER [TUODVZ_YAZICI] ON [dbo].[TODVZ_YAZICI];
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TDODVZ_YAZICI' AND is_disabled = 0)
              DISABLE TRIGGER [TDODVZ_YAZICI] ON [dbo].[TODVZ_YAZICI];
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TIODVZ_VEZNE' AND is_disabled = 0)
              DISABLE TRIGGER [TIODVZ_VEZNE] ON [dbo].[TODVZ_VEZNE];
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TUODVZ_VEZNE' AND is_disabled = 0)
              DISABLE TRIGGER [TUODVZ_VEZNE] ON [dbo].[TODVZ_VEZNE];
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TDODVZ_VEZNE' AND is_disabled = 0)
              DISABLE TRIGGER [TDODVZ_VEZNE] ON [dbo].[TODVZ_VEZNE];
          `);
            }
            catch (err) {
                // Ignore if table or trigger does not exist in target database
            }
            return pool;
        })
            .catch((err) => {
            logger.warn(`[Giriş Hatası] Yanlış giriş: [${targetServer} -> ${targetDb}] veritabanına bağlanılamadı. Hata: ${err?.message || err}`);
            poolCache.delete(fullCacheKey);
            throw ApiError.badRequest(`Belirtilen sunucu (${targetServer}) veya veritabanına (${targetDb}) bağlanılamadı. Lütfen sunucu adı, veritabanı adı, kullanıcı adı veya şifreyi kontrol ediniz.`);
        });
        poolCache.set(fullCacheKey, poolPromise);
    }
    return poolCache.get(fullCacheKey);
};
/**
 * Checks database connectivity on startup
 */
export const checkDbConnection = async () => {
    try {
        if (!env.DB_PASSWORD && dbCredentialsMap.size === 0) {
            logger.info("ℹ️ MSSQL bağlantı bilgileri kullanıcı girişinde dinamik olarak alınacaktır.");
            return false;
        }
        const pool = await getDbPool();
        const result = await pool.request().query("SELECT 1 as isAlive");
        return result.recordset.length > 0;
    }
    catch (error) {
        return false;
    }
};
