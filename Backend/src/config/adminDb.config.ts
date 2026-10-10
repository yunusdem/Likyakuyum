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

export const adminYapilandirildiMi = (): boolean =>
  !!env.ADMIN_DB_USER &&
  !!env.ADMIN_DB_PASSWORD &&
  env.ADMIN_JWT_SECRET.length >= MIN_SECRET_UZUNLUGU &&
  env.ADMIN_DB_ENC_KEY.length >= MIN_SECRET_UZUNLUGU;

export const adminYapilandirmaHatasi = (): ApiError =>
  new ApiError(
    HttpStatus.SERVICE_UNAVAILABLE,
    "Admin paneli bu sunucuda yapılandırılmamış (ADMIN_DB_USER, ADMIN_DB_PASSWORD, en az 32 karakterlik ADMIN_JWT_SECRET ve ADMIN_DB_ENC_KEY gerekli)."
  );

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export const getAdminPool = async (): Promise<sql.ConnectionPool> => {
  if (!adminYapilandirildiMi()) throw adminYapilandirmaHatasi();

  if (!poolPromise) {
    const { host, port } = parseServerAndPort(env.ADMIN_DB_SERVER, env.ADMIN_DB_PORT || 1433);
    const config: sql.config = {
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
      .then(async (pool) => {
        pool.on("error", (err) => {
          logger.error("[ADMIN DB] Havuz hatası, bağlantı yenilenecek.", err);
          poolPromise = null;
        });
        await ensureAdminSchema(pool);
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

const ensureAdminSchema = async (pool: sql.ConnectionPool): Promise<void> => {
  try {
    await pool.request().query(`
      IF COL_LENGTH('dbo.ADM_FIRMA', 'SILINME_PLANI') IS NULL
      BEGIN
        ALTER TABLE [dbo].[ADM_FIRMA] ADD
          [SILINME_PLANI]               DATETIME      NULL,
          [SILINME_ISTEYEN_ADMIN_ID]    INT           NULL,
          [SILINDI_TARIHI]              DATETIME      NULL,
          [YEDEK_DOSYA]                 NVARCHAR(400) NULL,
          [YEDEK_TARIHI]                DATETIME      NULL,
          [YEDEK_BOYUT]                 BIGINT        NULL,
          [YEDEK_SILINME_PLANI]         DATETIME      NULL;
      END;

      IF COL_LENGTH('dbo.ADM_FIRMA', 'BILDIRILEN_KULLANICI_SAYISI') IS NULL
      BEGIN
        ALTER TABLE [dbo].[ADM_FIRMA] ADD
          [MAKINE_KIMLIGI]              VARCHAR(40)   NULL,
          [MAKINE_KIMLIGI_TARIHI]       DATETIME      NULL,
          [SURUM]                       VARCHAR(30)   NULL,
          [HEDEF_SURUM]                 VARCHAR(30)   NULL,
          [SON_GORULME]                 DATETIME      NULL,
          [BILDIRILEN_LISANS_DURUMU]    VARCHAR(20)   NULL,
          [BILDIRILEN_KILIT_NEDENI]     VARCHAR(30)   NULL,
          [BILDIRILEN_KULLANICI_SAYISI] INT           NULL,
          [SEMA_SURUMU]                 INT           NULL;
      END;

      IF COL_LENGTH('dbo.ADM_LISANS', 'LISANS_KODU') IS NULL
      BEGIN
        ALTER TABLE [dbo].[ADM_LISANS] ADD
          [LISANS_KODU]                 VARCHAR(4000) NULL,
          [MAKINE_KIMLIGI]              VARCHAR(40)   NULL,
          [SERI_NO]                     INT           NULL,
          [IPTAL]                       BIT           NOT NULL CONSTRAINT [DF_ADM_LISANS_IPTAL] DEFAULT 0,
          [IPTAL_TARIHI]                DATETIME      NULL,
          [IPTAL_EDEN_ADMIN_ID]         INT           NULL,
          [TESLIM]                      VARCHAR(10)   NULL,
          [TESLIM_TARIHI]               DATETIME      NULL;
      END;

      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ADM_SURUM')
      BEGIN
        CREATE TABLE [dbo].[ADM_SURUM] (
          [SURUM]        VARCHAR(30)    NOT NULL PRIMARY KEY,
          [YAYIN_TARIHI] DATETIME       NOT NULL DEFAULT GETDATE(),
          [DOSYA_YOLU]   NVARCHAR(400)  NOT NULL,
          [BOYUT]        BIGINT         NOT NULL,
          [SHA256]       CHAR(64)       NOT NULL,
          [IMZA]         VARCHAR(200)   NOT NULL,
          [SEMA_SURUMU]  INT            NULL,
          [NOTLAR]       NVARCHAR(2000) NULL,
          [AKTIF]        BIT            NOT NULL DEFAULT 1
        );
      END;

      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ADM_AYAR')
      BEGIN
        CREATE TABLE [dbo].[ADM_AYAR] (
          [ANAHTAR]             VARCHAR(60)    NOT NULL PRIMARY KEY,
          [DEGER]               NVARCHAR(2000) NULL,
          [DEGISTIREN_ADMIN_ID] INT            NULL,
          [TARIH]               DATETIME       NOT NULL DEFAULT GETDATE()
        );
      END;
    `);
    logger.info("[ADMIN DB] Şema ve kolon kontrolleri başarıyla doğrulandı / güncellendi.");
  } catch (err: any) {
    logger.warn(`[ADMIN DB] Otomatik şema güncelleme uyarısı: ${err?.message}`);
  }
};

export const closeAdminPool = async (): Promise<void> => {
  if (!poolPromise) return;
  try {
    const pool = await poolPromise;
    await pool.close();
  } catch {
    // bağlantı zaten kurulamamış
  }
  poolPromise = null;
};
