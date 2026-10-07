import { env } from "../config/env.config.js";
import { ApiError } from "../utils/ApiError.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { KurulumLisansService } from "../services/kurulum/kurulumLisans.service.js";
/**
 * Kurulum (exe) modunda lisans kilidi: lisans geçersiz / süresi dolmuş / saat geri alınmışsa tüm API 423 döner,
 * istemci kilit penceresini (neden + iletişim + Lisans Yükle) gösterir. Bulut modunda hiçbir şey yapmaz.
 */
const SERBEST = [/^\/health(\/|$)/, /^\/sistem(\/|$)/, /^\/auth\/lisans-(durum|yukle)$/];
export const lisansKapisi = (req, res, next) => {
    if (!env.KURULUM_MODU)
        return next();
    if (SERBEST.some((r) => r.test(req.path)))
        return next();
    KurulumLisansService.durum()
        .then((d) => {
        if (d.durum !== "KILITLI")
            return next();
        next(new ApiError(HttpStatus.LOCKED, d.mesaj || "Program kilitli.", {
            kod: "LISANS_KILIT",
            neden: d.neden,
            makineKimligi: d.makineKimligi,
            iletisim: d.iletisim,
        }));
    })
        .catch(next);
};
