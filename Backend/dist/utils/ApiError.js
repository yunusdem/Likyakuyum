import { HttpStatus } from "../constants/httpStatusCodes.js";
export class ApiError extends Error {
    statusCode;
    errors;
    isOperational;
    constructor(statusCode = HttpStatus.INTERNAL_SERVER_ERROR, message = "Sunucu tarafında bir hata oluştu", errors, isOperational = true, stack = "") {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = isOperational;
        if (stack) {
            this.stack = stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    static badRequest(message = "Geçersiz istek parametreleri", errors) {
        return new ApiError(HttpStatus.BAD_REQUEST, message, errors);
    }
    static unauthorized(message = "Yetkisiz erişim") {
        return new ApiError(HttpStatus.UNAUTHORIZED, message);
    }
    static forbidden(message = "Bu kaynağa erişim yetkiniz yok") {
        return new ApiError(HttpStatus.FORBIDDEN, message);
    }
    static notFound(message = "İstenen kaynak bulunamadı") {
        return new ApiError(HttpStatus.NOT_FOUND, message);
    }
    static conflict(message = "Kayıt çakışması meydana geldi") {
        return new ApiError(HttpStatus.CONFLICT, message);
    }
    static unprocessable(message = "İstek işlenemedi", errors) {
        return new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, message, errors);
    }
    static internal(message = "Sunucu hatası oluştu", errors) {
        return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, message, errors, false);
    }
}
