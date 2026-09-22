import { env } from "../config/env.config.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { API_MODULLERI, ModulService } from "../services/admin/modul.service.js";
import { ApiError } from "../utils/ApiError.js";
/**
 * Firma bazlı modül kısıtı (docs/ADMIN_PANEL_YOL_HARITASI.md, Faz 4). authenticate'ten SONRA çalışır.
 * MERKEZ_GIRIS kapalıyken ve modül ayarı hiç yapılmamış firmada hiçbir şeyi kısıtlamaz.
 * apiOnek, API_MODULLERI'ndeki anahtardır: o listedeki modüllerden biri firmaya açıksa istek geçer.
 */
export const modulKapisi = (apiOnek) => {
    const kodlar = API_MODULLERI[apiOnek] || [];
    return async (req, res, next) => {
        try {
            if (env.MERKEZ_GIRIS !== "zorunlu" || kodlar.length === 0)
                return next();
            const { dbServer, dbName } = req.user || {};
            if (!dbServer || !dbName)
                return next();
            const acik = await ModulService.oturumModulleri(dbServer, dbName);
            if (acik === null || kodlar.some((k) => acik.includes(k)))
                return next();
            next(new ApiError(HttpStatus.FORBIDDEN, "Bu modül hesabınıza açık değil.", { kod: "MODUL_KAPALI" }));
        }
        catch (err) {
            next(err);
        }
    };
};
