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
// Önce .env.local okunur (git'te İZLENMEZ). .env git'te izlendiği için sunucuda "Discard changes" / stash / checkout
// ile sıfırlanabiliyor; sunucuya özel ve gizli ayarlar (ADMIN_*, MERKEZ_GIRIS) bu yüzden .env.local'de durur.
// dotenv var olan değişkeni ezmediği için önce okunan dosya önceliklidir.
for (const envPath of potentialEnvPaths) {
    const localPath = `${envPath}.local`;
    if (fs.existsSync(localPath)) {
        dotenv.config({ path: localPath });
        break;
    }
}
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
    JWT_ACCESS_EXPIRES_IN: z.string().default("30d"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("90d"),
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
    // Ana admin paneli (docs/ADMIN_PANEL_YOL_HARITASI.md). Kod içinde varsayılan şifre/secret YOK:
    // ADMIN_DB_USER, ADMIN_DB_PASSWORD, ADMIN_JWT_SECRET veya ADMIN_DB_ENC_KEY boşsa admin API'si kapalı kalır.
    ADMIN_DB_SERVER: z.string().default("localhost"),
    ADMIN_DB_PORT: z
        .string()
        .default("1433")
        .transform((val) => parseInt(val, 10)),
    ADMIN_DB_NAME: z.string().default("LIKYA_ADMIN"),
    ADMIN_DB_USER: z.string().default(""),
    ADMIN_DB_PASSWORD: z.string().default(""),
    ADMIN_JWT_SECRET: z.string().default(""),
    ADMIN_JWT_EXPIRES_IN: z.string().default("8h"),
    // Firma veritabanı şifrelerini LIKYA_ADMIN içinde şifreli saklamak için (AES-256-GCM). Değişirse kayıtlı şifreler çözülemez.
    ADMIN_DB_ENC_KEY: z.string().default(""),
    // Kullanıcı girişinin merkez (LIKYA_ADMIN) kontrolünden geçmesi. "kapali": giriş eskisi gibi çalışır.
    // "zorunlu": firma kayıtlı/aktif/lisanslı ve kullanıcı merkezde tanımlı olmalı. Tüm firmalar panelde tanımlanıp
    // kullanıcıları içe aktarılmadan "zorunlu" YAPMAYIN; tanımsız firmalar giremez.
    MERKEZ_GIRIS: z.enum(["kapali", "zorunlu"]).default("kapali"),
    // Mail gönderimi (firma e-posta doğrulaması). SMTP_HOST ya da SMTP_FROM boşsa mail özelliği kapalıdır.
    // Değerler sunucudaki Backend/.env.local dosyasına yazılır (git izlemez).
    SMTP_HOST: z.string().default(""),
    SMTP_PORT: z
        .string()
        .default("587")
        .transform((val) => parseInt(val, 10) || 587),
    // true: 465 (doğrudan TLS) · false: 587 / 25 (STARTTLS)
    SMTP_SECURE: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    SMTP_USER: z.string().default(""),
    SMTP_PASSWORD: z.string().default(""),
    // Gönderen: "Likya Kuyum <bilgi@likyakuyum.com>" biçiminde de yazılabilir
    SMTP_FROM: z.string().default(""),
    // Maillerdeki bağlantıların başı (yönetim panelinin dış adresi)
    ADMIN_PANEL_URL: z.string().default("https://admin.likyakuyum.com"),
    ADMIN_ORIGIN: z
        .string()
        .default("http://admin.likyakuyum.com,https://admin.likyakuyum.com,http://localhost:3001,http://127.0.0.1:3001")
        .transform((val) => val.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)),
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
