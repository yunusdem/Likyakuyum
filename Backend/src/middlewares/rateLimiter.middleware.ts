import { Request, Response, NextFunction } from "express";

/**
 * Enterprise ERP Rate Limiting:
 * Kesintisiz, 7/24 yüksek eşzamanlı (high-throughput, multi-user) kurumsal ERP kullanımı için
 * istek sınırlayıcılar tamamen pasifize edilmiştir.
 * Ne kadar çok istek gelirse gelsin hiçbir işlem veya kullanıcı engellenmez.
 */
export const globalRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  next();
};

export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  next();
};

