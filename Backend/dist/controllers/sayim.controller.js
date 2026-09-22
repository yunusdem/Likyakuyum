import { SayimSqlRepository } from "../models/sayimSql.repository.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
export class SayimController {
    static async getNextFisNo(req, res, next) {
        try {
            const fisNo = await SayimSqlRepository.getNextFisNo();
            return ApiResponse.ok(res, "Sonraki fiş numarası üretildi.", { fisNo });
        }
        catch (err) {
            next(err);
        }
    }
    static async saveSayimFisi(req, res, next) {
        try {
            const user = req.user;
            const payload = {
                ...req.body,
                kullaniciId: user?.userId || req.body.kullaniciId || null,
            };
            const result = await SayimSqlRepository.saveSayimFisi(payload);
            return ApiResponse.created(res, "Sayım fişi başarıyla kaydedildi.", result);
        }
        catch (err) {
            next(err);
        }
    }
    static async listSayimFisleri(req, res, next) {
        try {
            const limit = Number(req.query.limit || 100);
            const list = await SayimSqlRepository.listSayimFisleri(limit);
            return ApiResponse.ok(res, "Sayım fişleri listelendi.", list);
        }
        catch (err) {
            next(err);
        }
    }
    static async getSayimFisiById(req, res, next) {
        try {
            const idOrNo = req.params.id;
            const slip = await SayimSqlRepository.getSayimFisiById(idOrNo);
            if (!slip) {
                throw new ApiError(404, "Sayım fişi bulunamadı.");
            }
            return ApiResponse.ok(res, "Sayım fişi detayları getirildi.", slip);
        }
        catch (err) {
            next(err);
        }
    }
    static async deleteSayimFisi(req, res, next) {
        try {
            const id = Number(req.params.id);
            await SayimSqlRepository.deleteSayimFisi(id);
            return ApiResponse.ok(res, "Sayım fişi başarıyla silindi.", { deleted: true });
        }
        catch (err) {
            next(err);
        }
    }
}
