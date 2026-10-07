import { env } from "../../config/env.config.js";
import { getDbPool, setDbCredentials } from "../../config/mssql.config.js";
/** Kurulum modunda tek firma veritabanı: bağlantı yalnız .env'den gelir (istekten/token'dan asla). */
export const kurulumDbContext = () => ({
    dbServer: env.KURULUM_DB_SERVER,
    dbName: env.KURULUM_DB_NAME,
});
export const kurulumBaglantisiniKaydet = () => {
    setDbCredentials(env.KURULUM_DB_SERVER, env.KURULUM_DB_NAME, env.KURULUM_DB_USER, env.KURULUM_DB_PASSWORD);
};
export const kurulumHavuzu = async () => {
    kurulumBaglantisiniKaydet();
    return getDbPool(env.KURULUM_DB_SERVER, env.KURULUM_DB_NAME, env.KURULUM_DB_USER, env.KURULUM_DB_PASSWORD);
};
