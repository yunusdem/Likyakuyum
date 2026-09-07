import express from "express";
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
    // 1. Security HTTP Headers
    app.use(helmet());
    // 2. CORS Handling (Frontend origin & credentials)
    app.use(corsMiddleware);
    // 3. Request Parsers
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    app.use(cookieParser());
    // 4. Rate Limiting & HTTP Logging
    app.use(globalRateLimiter);
    app.use(requestLoggerMiddleware);
    // 5. Root & Health Check Endpoint
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
