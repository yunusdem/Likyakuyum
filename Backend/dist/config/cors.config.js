import cors from "cors";
import { env } from "./env.config.js";
export const corsOptions = {
    origin: (origin, callback) => {
        // 1. Allow requests with no origin (like mobile apps, curl, Postman, SSR, proxy)
        if (!origin)
            return callback(null, true);
        const allowedOrigins = env.CORS_ORIGIN;
        // 2. If wildcard or explicit match in CORS_ORIGIN
        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // 3. Automatically allow likyakuyum.com and any subdomains (HTTP & HTTPS, any port)
        if (/^https?:\/\/([a-zA-Z0-9-]+\.)*likyakuyum\.com(:\d+)?$/i.test(origin)) {
            return callback(null, true);
        }
        // 4. Automatically allow localhost / 127.0.0.1 on any port
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
            return callback(null, true);
        }
        // 5. Automatically allow private IP ranges (LAN deployments)
        if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(origin)) {
            return callback(null, true);
        }
        // 6. Production web fallback: reflect origin to prevent 500 error crashes
        return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "*",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "x-db-server",
        "x-db-name",
        "x-db-user",
        "x-db-password",
        "X-Db-Server",
        "X-Db-Name",
        "X-Db-User",
        "X-Db-Password",
    ],
    exposedHeaders: [
        "Content-Range",
        "X-Content-Range",
        "Authorization",
        "x-db-server",
        "x-db-name",
        "x-db-user",
        "x-db-password",
    ],
    maxAge: 86400, // 24 hours
};
export const corsMiddleware = cors(corsOptions);
