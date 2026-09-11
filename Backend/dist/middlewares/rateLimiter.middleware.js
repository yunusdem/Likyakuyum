/**
 * Enterprise ERP Rate Limiting:
 * Kesintisiz, 7/24 yüksek eşzamanlı (high-throughput, multi-user) kurumsal ERP kullanımı için
 * istek sınırlayıcılar tamamen pasifize edilmiştir.
 * Ne kadar çok istek gelirse gelsin hiçbir işlem veya kullanıcı engellenmez.
 */
export const globalRateLimiter = (req, res, next) => {
    next();
};
export const authRateLimiter = (req, res, next) => {
    next();
};
