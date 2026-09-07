import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/token.utils.js";
import { UserRoleType } from "../constants/roles.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { setDbCredentials } from "../config/mssql.config.js";

/**
 * Middleware to authenticate requests via JWT Bearer token in Authorization header or cookie.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      // In development mode, auto-provide default admin user context if no token is supplied
      if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
        req.user = {
          userId: "1",
          username: "admin",
          role: "admin",
          cashierCode: "00",
          dbServer: process.env.DB_SERVER || "localhost",
          dbName: process.env.DB_NAME || "R2016_dvz",
        };
        return next();
      }

      throw ApiError.unauthorized("Kimlik doğrulama tokenı bulunamadı. Lütfen giriş yapınız.");
    }


    const decoded = verifyAccessToken(token);
    req.user = decoded;
    req.accessToken = token;

    // Header ve token üzerinden veritabanı bilgilerini havuza kaydet
    const srv = decoded.dbServer || (req.headers["x-db-server"] as string) || "localhost";
    const db = decoded.dbName || (req.headers["x-db-name"] as string) || "R2016_dvz";
    const u = decoded.dbUser || (req.headers["x-db-user"] as string) || "SA";
    const p = decoded.dbPassword !== undefined ? decoded.dbPassword : (req.headers["x-db-password"] as string);

    if (srv && db && u) {
      setDbCredentials(srv, db, u, p);
    }

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      next(ApiError.unauthorized("Oturum süreniz doldu, lütfen tekrar giriş yapın veya token yenileyin."));
    } else if (error.name === "JsonWebTokenError") {
      next(ApiError.unauthorized("Geçersiz kimlik doğrulama tokenı."));
    } else {
      next(error);
    }
  }
};

/**
 * Middleware to authorize access based on user role(s).
 */
export const authorizeRoles = (...allowedRoles: UserRoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized(ResponseMessages.UNAUTHORIZED));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Yetkisiz işlem: Bu kaynağa erişim yetkiniz (${req.user.role}) bulunmamaktadır.`
        )
      );
    }

    next();
  };
};
