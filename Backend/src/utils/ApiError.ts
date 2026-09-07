import { HttpStatus, HttpStatusCode } from "../constants/httpStatusCodes.js";

export class ApiError extends Error {
  public statusCode: HttpStatusCode;
  public errors?: any;
  public isOperational: boolean;

  constructor(
    statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    message: string = "Sunucu tarafında bir hata oluştu",
    errors?: any,
    isOperational: boolean = true,
    stack: string = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public static badRequest(message: string = "Geçersiz istek parametreleri", errors?: any): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, message, errors);
  }

  public static unauthorized(message: string = "Yetkisiz erişim"): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, message);
  }

  public static forbidden(message: string = "Bu kaynağa erişim yetkiniz yok"): ApiError {
    return new ApiError(HttpStatus.FORBIDDEN, message);
  }

  public static notFound(message: string = "İstenen kaynak bulunamadı"): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, message);
  }

  public static conflict(message: string = "Kayıt çakışması meydana geldi"): ApiError {
    return new ApiError(HttpStatus.CONFLICT, message);
  }

  public static unprocessable(message: string = "İstek işlenemedi", errors?: any): ApiError {
    return new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, message, errors);
  }

  public static internal(message: string = "Sunucu hatası oluştu", errors?: any): ApiError {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, message, errors, false);
  }
}
