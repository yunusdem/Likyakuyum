import { AyarSqlRepository } from "../models/ayarSql.repository.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
export class AyarController {
    static async listAyarlar(req, res, next) {
        try {
            const sadeceAktif = req.query.aktif === "true" || req.query.sadeceAktif === "true";
            const dbContext = req.dbContext;
            const ayarlar = await AyarSqlRepository.listAyarlar(sadeceAktif, dbContext);
            return ApiResponse.ok(res, "Ayar tanımları başarıyla listelendi.", ayarlar);
        }
        catch (error) {
            next(error);
        }
    }
    static async getAyarById(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id) || id <= 0) {
                throw ApiError.badRequest("Geçerli bir ayar ID'si belirtilmelidir.");
            }
            const dbContext = req.dbContext;
            const ayar = await AyarSqlRepository.getAyarById(id, dbContext);
            if (!ayar) {
                throw ApiError.notFound("Ayar tanımı bulunamadı.");
            }
            return ApiResponse.ok(res, "Ayar tanımı getirildi.", ayar);
        }
        catch (error) {
            next(error);
        }
    }
    static async saveAyar(req, res, next) {
        try {
            const { ayarId, ayarKodu, ayarAdi, milyem, standartAyar, siraNo, varsayilan, aktif, aciklama } = req.body;
            if (!ayarKodu || !String(ayarKodu).trim()) {
                throw ApiError.badRequest("Ayar kodu zorunludur.");
            }
            if (!ayarAdi || !String(ayarAdi).trim()) {
                throw ApiError.badRequest("Ayar adı zorunludur.");
            }
            if (milyem === undefined || milyem === null || isNaN(Number(milyem)) || Number(milyem) <= 0 || Number(milyem) > 1.0) {
                throw ApiError.badRequest("Geçerli bir milyem değeri girilmelidir (0 ile 1.00000 arası, örn: 0.91600).");
            }
            const userId = req.user?.userId || null;
            const dbContext = req.dbContext;
            const result = await AyarSqlRepository.saveAyar({
                ayarId: ayarId ? Number(ayarId) : null,
                ayarKodu: String(ayarKodu),
                ayarAdi: String(ayarAdi),
                milyem: Number(milyem),
                standartAyar: standartAyar ? Number(standartAyar) : null,
                siraNo: siraNo != null ? Number(siraNo) : 0,
                varsayilan: Boolean(varsayilan),
                aktif: aktif !== undefined ? Boolean(aktif) : true,
                aciklama: aciklama ? String(aciklama) : null,
                kullaniciId: userId,
            }, dbContext);
            return ApiResponse.ok(res, result.yeniKayit ? "Ayar tanımı başarıyla eklendi." : "Ayar tanımı güncellendi.", result);
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteAyar(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id) || id <= 0) {
                throw ApiError.badRequest("Geçerli bir ayar ID'si belirtilmelidir.");
            }
            const dbContext = req.dbContext;
            await AyarSqlRepository.deleteAyar(id, dbContext);
            return ApiResponse.ok(res, "Ayar tanımı başarıyla silindi.", null);
        }
        catch (error) {
            next(error);
        }
    }
}
