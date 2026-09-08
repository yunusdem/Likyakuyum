import dotenv from "dotenv";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multi-path dotenv loader for Windows Server / PM2 resilience
const potentialEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "Backend", ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, ".env"),
];

for (const envPath of potentialEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
// Fallback in case none matched explicitly
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default("5000")
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PREFIX: z.string().default("/api/v1"),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000,http://localhost:5173,http://likyakuyum.com,https://likyakuyum.com,*")
    .transform((val) => val.split(",").map((s) => s.trim())),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, "JWT_ACCESS_SECRET must be at least 16 characters long")
    .default("kuyumcu_erp_super_secret_access_jwt_key_2026_!@#$"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET must be at least 16 characters long")
    .default("kuyumcu_erp_super_secret_refresh_jwt_key_2026_!@#$"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX: z
    .string()
    .default("999999999")
    .transform((val) => parseInt(val, 10)),
  LOG_LEVEL: z.string().default("info"),
  // MSSQL Database Config (Dynamic - provided by user at login)
  DB_SERVER: z.string().default("localhost"),
  DB_PORT: z
    .string()
    .default("1433")
    .transform((val) => parseInt(val, 10)),
  DB_NAME: z.string().default(""),
  DB_USER: z.string().default(""),
  DB_PASSWORD: z.string().default(""),
  DB_ENCRYPT: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  DB_TRUST_SERVER_CERTIFICATE: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
});


const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.warn("⚠️ Bazı ortam değişkenleri okunamadı, güvenli varsayılanlar uygulanıyor:", result.error.format());
    // Fallback: parse with empty object to use all defaults
    const fallbackResult = envSchema.safeParse({});
    if (fallbackResult.success) {
      return fallbackResult.data;
    }
    console.error("❌ Kritik hata: Geçersiz ortam değişkenleri:");
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type EnvConfig = z.infer<typeof envSchema>;
