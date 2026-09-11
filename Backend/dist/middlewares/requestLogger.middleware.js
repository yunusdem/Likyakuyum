import morgan from "morgan";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.config.js";
const stream = {
    write: (message) => logger.http(message.trim()),
};
const format = env.NODE_ENV === "development" ? "dev" : "combined";
export const requestLoggerMiddleware = morgan(format, {
    stream,
    skip: (req) => Boolean(req.url && (req.url.includes("/health") || req.url.includes("/favicon.ico"))),
});
