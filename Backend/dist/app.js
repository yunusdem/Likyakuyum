import express from "express";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.config.js";
import { corsMiddleware } from "./config/cors.config.js";
import { globalRateLimiter } from "./middlewares/rateLimiter.middleware.js";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.middleware.js";
import { notFoundMiddleware, errorHandlerMiddleware } from "./middlewares/error.middleware.js";
import apiRouter from "./routes/index.js";
export const createApp = () => {
    const app = express();
    // 1. Security HTTP Headers (kurulumda arayüz de buradan sunulur: canlıdaki IIS gibi CSP uygulanmaz)
    app.use(helmet(env.KURULUM_MODU ? { contentSecurityPolicy: false } : undefined));
    // 2. CORS Handling (Frontend origin & credentials)
    app.use(corsMiddleware);
    // 3. Request Parsers
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ extended: true, limit: "50mb" }));
    app.use(cookieParser());
    // Static uploads directory
    app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
    // 4. Rate Limiting & HTTP Logging
    app.use(globalRateLimiter);
    app.use(requestLoggerMiddleware);
    // 5. Kurulum (exe): arayüz aynı adresten sunulur (tarayıcı kısayolu http://localhost:5000)
    const arayuz = env.KURULUM_MODU && env.ARAYUZ_KLASORU ? path.resolve(env.ARAYUZ_KLASORU) : "";
    if (arayuz && fs.existsSync(path.join(arayuz, "index.html"))) {
        app.use(express.static(arayuz, { index: "index.html", maxAge: "1h" }));
        app.get(/^(?!\/api\/|\/uploads\/).*/, (req, res) => res.sendFile(path.join(arayuz, "index.html")));
    }
    // Root & Health Check Endpoint
    app.get("/", (req, res) => {
        res.json({
            name: "Kuyumcu ERP SaaS Backend API",
            version: "1.0.0",
            status: "running",
            documentation: `${env.API_PREFIX}/health`,
        });
    });
    // 6. Mount Main API Routes
    app.use(env.API_PREFIX, apiRouter);
    // 7. 404 Not Found Middleware
    app.use(notFoundMiddleware);
    // 8. Global Error Handler Middleware
    app.use(errorHandlerMiddleware);
    return app;
};
export const app = createApp();
