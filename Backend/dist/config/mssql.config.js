import sql from "mssql";
import { env } from "./env.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
/**
 * Parses server address and port from inputs like:
 * - "88.245.10.20,1433" (SQL Server comma notation)
 * - "88.245.10.20:1433" (Colon notation)
 * - "localhost" -> "127.0.0.1"
 * - "myserver.com" -> default port (1433)
 */
export const parseServerAndPort = (serverInput, defaultPort = 1433) => {
    if (!serverInput || !serverInput.trim()) {
        return { host: "127.0.0.1", port: defaultPort };
    }
    const raw = serverInput.trim();
    if (raw.toLowerCase() === "localhost") {
        return { host: "127.0.0.1", port: defaultPort };
    }
    let host = raw;
    let port = defaultPort;
    // SQL Server comma notation (örn: "88.245.10.20,1433")
    if (raw.includes(",")) {
        const parts = raw.split(",");
        host = parts[0].trim();
        const p = Number(parts[1]?.trim());
        if (!isNaN(p) && p > 0) {
            port = p;
        }
    }
    else if (raw.includes(":") && !raw.includes("::")) {
        // Colon notation (örn: "88.245.10.20:1433")
        const parts = raw.split(":");
        host = parts[0].trim();
        const p = Number(parts[1]?.trim());
        if (!isNaN(p) && p > 0) {
            port = p;
        }
    }
    if (host.toLowerCase() === "localhost") {
        host = "127.0.0.1";
    }
    return { host, port };
};
/**
 * Normalizes database server address.
 * Converts 'localhost' to '127.0.0.1' to prevent IPv6 / DNS resolution issues on Windows Server.
 */
export const normalizeServerName = (server) => {
    return parseServerAndPort(server).host;
};
/**
 * In-memory registry of server+db credentials learned dynamically from user logins / requests
 */
export const dbCredentialsMap = new Map();
/**
 * Register credentials dynamically for a specific server and database
 */
export const setDbCredentials = (server, database, user, password) => {
    const { host: s, port } = parseServerAndPort(server || env.DB_SERVER, Number(env.DB_PORT) || 1433);
    const d = (database && database.trim()) || env.DB_NAME || "R2016_dvz";
    const keyWithPort = `${s.toLowerCase()}:${port}:${d.toLowerCase()}`;
    const keyWithoutPort = `${s.toLowerCase()}:${d.toLowerCase()}`;
    if (user && user.trim()) {
        const credPassword = password !== undefined && password !== null && String(password).trim() !== ""
            ? password
            : (env.DB_PASSWORD || "");
        const creds = {
            user: user.trim(),
            password: credPassword,
        };
        dbCredentialsMap.set(keyWithPort, creds);
        dbCredentialsMap.set(keyWithoutPort, creds);
        if (s === "127.0.0.1") {
            dbCredentialsMap.set(`localhost:${port}:${d.toLowerCase()}`, creds);
            dbCredentialsMap.set(`localhost:${d.toLowerCase()}`, creds);
        }
    }
};
/**
 * Base MSSQL Configuration Object Template
 */
export const createMssqlConfig = (server, database, user, password) => {
    const { host: targetServer, port: targetPort } = parseServerAndPort(server || env.DB_SERVER, Number(env.DB_PORT) || 1433);
    const targetDb = (database && database.trim()) || env.DB_NAME || "R2016_dvz";
    const keyWithPort = `${targetServer.toLowerCase()}:${targetPort}:${targetDb.toLowerCase()}`;
    const keyWithoutPort = `${targetServer.toLowerCase()}:${targetDb.toLowerCase()}`;
    const storedCreds = dbCredentialsMap.get(keyWithPort) ||
        dbCredentialsMap.get(keyWithoutPort) ||
        dbCredentialsMap.get(`localhost:${targetDb.toLowerCase()}`);
    const finalUser = (user && user.trim()) || storedCreds?.user || env.DB_USER || "SA";
    const finalPassword = password !== undefined && password !== null && String(password).trim() !== ""
        ? password
        : (storedCreds?.password
            ? storedCreds.password
            : (env.DB_PASSWORD || ""));
    return {
        server: targetServer,
        port: targetPort,
        database: targetDb,
        user: finalUser,
        password: finalPassword,
        options: {
            encrypt: false,
            trustServerCertificate: true,
            enableArithAbort: true,
        },
        pool: {
            max: 50,
            min: 2,
            idleTimeoutMillis: 30000,
        },
        connectionTimeout: 15000,
        requestTimeout: 30000,
    };
};
export const mssqlConfig = createMssqlConfig();
/**
 * Multi-tenant Connection Pool Cache (Key: server:port:database:user:password)
 */
const poolCache = new Map();
/**
 * Generates cache key for given server and database
 */
export const getPoolKey = (server, database) => {
    const { host, port } = parseServerAndPort(server || env.DB_SERVER, Number(env.DB_PORT) || 1433);
    const d = (database && database.trim()) || env.DB_NAME || "R2016_dvz";
    return `${host.toLowerCase()}:${port}:${d.toLowerCase()}`;
};
/**
 * Gets or initializes a MSSQL connection pool dynamically for the specified server, database, and credentials.
 */
export const getDbPool = async (server, database, user, password) => {
    const { host: targetServer, port: targetPort } = parseServerAndPort(server || env.DB_SERVER, Number(env.DB_PORT) || 1433);
    const targetDb = (database && database.trim()) || env.DB_NAME || "R2016_dvz";
    const baseKey = `${targetServer.toLowerCase()}:${targetPort}:${targetDb.toLowerCase()}`;
    if (user && user.trim()) {
        setDbCredentials(server, targetDb, user, password);
    }
    const storedCreds = dbCredentialsMap.get(baseKey) ||
        dbCredentialsMap.get(`${targetServer.toLowerCase()}:${targetDb.toLowerCase()}`) ||
        dbCredentialsMap.get(`localhost:${targetDb.toLowerCase()}`);
    const finalUser = (user && user.trim()) || storedCreds?.user || env.DB_USER || "SA";
    const finalPassword = password !== undefined && password !== null && String(password).trim() !== ""
        ? password
        : (storedCreds?.password
            ? storedCreds.password
            : (env.DB_PASSWORD || ""));
    const fullCacheKey = `${baseKey}:${finalUser}:${finalPassword}`;
    if (!poolCache.has(fullCacheKey)) {
        const poolPromise = (async () => {
            let activeConfig = createMssqlConfig(server, targetDb, finalUser, finalPassword);
            let pool;
            try {
                pool = await new sql.ConnectionPool(activeConfig).connect();
            }
            catch (err) {
                // Ağ / DNS / Soket hatası durumunda 127.0.0.1 <-> localhost fallback dene
                const isNetworkErr = err?.code === "ESOCKET" ||
                    err?.code === "ETIMEOUT" ||
                    err?.code === "ECONNREFUSED" ||
                    err?.message?.includes("Failed to connect") ||
                    err?.message?.includes("getaddrinfo");
                if (isNetworkErr) {
                    const fallbackHost = targetServer === "127.0.0.1" ? "localhost" : "127.0.0.1";
                    try {
                        activeConfig = { ...activeConfig, server: fallbackHost };
                        pool = await new sql.ConnectionPool(activeConfig).connect();
                    }
                    catch (fallbackErr) {
                        logger.warn("⚠️ MSSQL veritabanı çevrimdışı veya bağlanılamadı. Lütfen SQL Server servisinin çalıştığından emin olun.");
                        poolCache.delete(fullCacheKey);
                        throw ApiError.badRequest(`Belirtilen sunucu (${server || targetServer}) veya veritabanına (${targetDb}) ulaşılamadı. Lütfen SQL Server servisinin ve TCP/IP portunun (1433) açık olduğundan emin olunuz.`);
                    }
                }
                else {
                    logger.warn("⚠️ MSSQL veritabanı çevrimdışı veya bağlanılamadı. Lütfen SQL Server servisinin çalıştığından emin olun.");
                    poolCache.delete(fullCacheKey);
                    if (err?.message?.includes("Login failed for user")) {
                        throw ApiError.badRequest(`Veritabanı bağlantısı başarılı ancak veritabanı kullanıcısı doğrulanamadı: '${finalUser}' kullanıcısı için şifre hatalı. Lütfen 'Diğer Alanlar'dan SQL kullanıcı adı ve şifrenizi kontrol ediniz.`);
                    }
                    throw ApiError.badRequest(`Belirtilen sunucu (${server || targetServer}) veya veritabanına (${targetDb}) bağlanılamadı. Hata: ${err?.message || "Bilinmeyen SQL hatası"}`);
                }
            }
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
            catch (triggerErr) {
                // Ignore trigger errors if table/trigger doesn't exist
            }
            return pool;
        })();
        poolCache.set(fullCacheKey, poolPromise);
    }
    return poolCache.get(fullCacheKey);
};
/**
 * Checks database connectivity on startup (Silent)
 */
export const checkDbConnection = async () => {
    return false;
};
