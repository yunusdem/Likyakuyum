import path from "path";
import winston from "winston";
import { env } from "../config/env.config.js";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const customFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true })
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        customFormat
      ),
    }),
  ],
});

// Kurulum (exe): program arka planda (Görev Zamanlayıcı) çalışır, konsol görünmez; loglar veri klasörüne de yazılır
if (env.KURULUM_MODU) {
  logger.add(
    new winston.transports.File({
      filename: path.join(env.VERI_KLASORU, "log", "likya.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
      format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), customFormat),
    })
  );
}
