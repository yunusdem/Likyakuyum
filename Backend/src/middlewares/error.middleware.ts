import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ApiError } from "../utils/ApiError.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { env } from "../config/env.config.js";
import { logger } from "../utils/logger.js";
import { IApiErrorResponse } from "../types/api.types.js";

/**
 * Maps raw SQL Server error codes/messages into user-friendly, actionable Turkish guidance.
 */
function parseMssqlError(err: any): string | null {
  const msg = String(err?.message || "");

  // 1. Duplicate key / Unique constraint
  if (msg.includes("Violation of UNIQUE KEY constraint") || msg.includes("Cannot insert duplicate key")) {
    return "⚠️ Benzersiz Kayıt Uyarısı: Belirtilen numaratör/tanım kodu sistemde güncellenmektedir. Lütfen tekrar kaydediniz.";
  }

  // 2. Foreign key conflict
  if (msg.includes("FOREIGN KEY constraint")) {
    const match = msg.match(/column '([^']+)'/i) || msg.match(/constraint "([^"]+)"/i);
    const colName = match ? match[1] : "";
    return `⚠️ Bağlantılı Kayıt Hatası (${colName}): Seçilen bağlantılı ID veritabanında bulunamadı. Lütfen listeden geçerli bir seçenek belirleyiniz.`;
  }

  // 3. Check constraint
  if (msg.includes("CHECK constraint")) {
    return "⚠️ Veri Kuralı Uyarısı: Girilen değerler sistemin doğrulama kurallarına uymuyor. Lütfen alanları kontrol ediniz.";
  }

  // 4. Data truncation / Max length
  if (msg.includes("String or binary data would be truncated")) {
    return "⚠️ Karakter Sınırı Aşıldı: Girdiğiniz metinlerden biri izin verilen maksimum uzunluğu aşıyor. Lütfen metin uzunluklarını kısaltınız.";
  }

  // 5. Type conversion
  if (msg.includes("Conversion failed when converting")) {
    return "⚠️ Veri Tipi Hatası: Sayı veya tarih beklenen bir alana geçersiz formatta veri girildi. Lütfen biçimi düzeltiniz.";
  }

  // 6. Invalid date format
  if (msg.includes("date") && msg.includes("out-of-range")) {
    return "⚠️ Tarih Formatı Hatası: Girilen tarih geçerli aralıkta değil. Lütfen YYYY-AA-GG biçiminde geçerli bir tarih giriniz.";
  }

  return null;
}

/**
 * 404 Not Found Middleware for unhandled endpoints
 */
export const notFoundMiddleware = (req: Request, res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Endpoint bulunamadı - ${req.method} ${req.originalUrl}`));
};

/**
 * Global Error Handler Middleware
 * Formats all errors into a standardized JSON response with clean, user-friendly guidance
 */
export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
  let message = err.message || "Sunucu tarafında bir işlem hatası oluştu.";
  let errors = err.errors || undefined;

  // Intercept raw SQL Server errors and convert to clear Turkish guidance
  const friendlySqlMessage = parseMssqlError(err);
  if (friendlySqlMessage) {
    message = friendlySqlMessage;
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      statusCode = HttpStatus.BAD_REQUEST;
    }
  }

  // Log the error cleanly
  if (req.originalUrl.includes("/auth/login")) {
    logger.warn(`[Giriş] Yanlış giriş`);
  } else if (statusCode >= 500) {
    logger.error(`[500 Server Error] ${req.method} ${req.originalUrl}`, err);
  } else {
    logger.warn(`[${statusCode} Client Error] ${req.method} ${req.originalUrl} - ${message}`);
  }

  const responsePayload: IApiErrorResponse = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(!req.originalUrl.includes("/auth/login") && env.NODE_ENV === "development" && { stack: err.stack }),
  };

  res.status(statusCode).json(responsePayload);
};
