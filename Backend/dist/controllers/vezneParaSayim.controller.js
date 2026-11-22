import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { VezneParaSayimSqlRepository } from "../models/vezneParaSayimSql.repository.js";
/** Oturumdaki firmanın veritabanı (jeton / firma kaydı; eski jetonda auth ara katmanının da okuduğu başlık) */
const baglam = (req) => ({
    dbServer: req.user?.dbServer || req.headers["x-db-server"] || undefined,
    dbName: req.user?.dbName || req.headers["x-db-name"] || undefined,
});
export class VezneParaSayimController {
    static saveSayim = asyncHandler(async (req, res) => {
        const payload = req.body;
        if (!payload.vezneId || Number(payload.vezneId) <= 0) {
            throw ApiError.badRequest("Geçerli bir vezne seçilmelidir.");
        }
        const authUser = req.user;
        if (authUser && !payload.kullaniciId) {
            payload.kullaniciId = authUser.id || authUser.userId;
            payload.kullaniciAdi = authUser.fullName || authUser.username;
        }
        const result = await VezneParaSayimSqlRepository.saveSayim(payload, baglam(req));
        return ApiResponse.created(res, "Vezne kasa sayımı başarıyla kaydedildi.", result);
    });
    static getSonSayim = asyncHandler(async (req, res) => {
        const vezneId = parseInt(req.params.vezneId, 10);
        if (isNaN(vezneId) || vezneId <= 0) {
            throw ApiError.badRequest("Geçerli bir vezne ID girilmelidir.");
        }
        const sonSayim = await VezneParaSayimSqlRepository.getSonSayimByVezne(vezneId, baglam(req));
        return ApiResponse.ok(res, "Son vezne sayımı getirildi.", sonSayim);
    });
    static getGecmisSayimlar = asyncHandler(async (req, res) => {
        const vezneId = req.params.vezneId ? parseInt(req.params.vezneId, 10) : 0;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
        const list = await VezneParaSayimSqlRepository.getGecmisSayimlar(vezneId, limit, baglam(req));
        return ApiResponse.ok(res, "Geçmiş vezne sayımları listelendi.", list);
    });
    static getSayimById = asyncHandler(async (req, res) => {
        const sayimId = parseInt(req.params.id, 10);
        if (isNaN(sayimId) || sayimId <= 0) {
            throw ApiError.badRequest("Geçersiz sayım ID.");
        }
        const sayim = await VezneParaSayimSqlRepository.getSayimById(sayimId, baglam(req));
        if (!sayim) {
            throw ApiError.notFound("Sayım kaydı bulunamadı.");
        }
        return ApiResponse.ok(res, "Sayım kaydı detayları getirildi.", sayim);
    });
    static deleteSayim = asyncHandler(async (req, res) => {
        const sayimId = parseInt(req.params.id, 10);
        if (isNaN(sayimId) || sayimId <= 0) {
            throw ApiError.badRequest("Geçersiz sayım ID.");
        }
        await VezneParaSayimSqlRepository.deleteSayim(sayimId, baglam(req));
        return ApiResponse.ok(res, "Sayım kaydı silindi.", { sayimId });
    });
}
