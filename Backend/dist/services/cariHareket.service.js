import { CariHareketSqlRepository, } from "../models/cariHareketSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class CariHareketService {
    static async list(filters, dbContext) {
        return CariHareketSqlRepository.findAll(filters, dbContext);
    }
    static async getById(id, dbContext) {
        const item = await CariHareketSqlRepository.findById(id, dbContext);
        if (!item) {
            throw ApiError.notFound(`Cari hareket (ID: ${id}) bulunamadı.`);
        }
        return item;
    }
    static async create(input, userId = 1, dbContext) {
        if (!input.cariKartId) {
            throw ApiError.badRequest("Cari kart seçimi zorunludur.");
        }
        if (!input.vezneId) {
            throw ApiError.badRequest("Vezne seçimi zorunludur.");
        }
        if (!input.satirlar || input.satirlar.length === 0) {
            throw ApiError.badRequest("En az bir hareket satırı (para birimi ve meblağ) girilmelidir.");
        }
        const validLines = input.satirlar.filter((s) => s.paraId && Number(s.meblag) > 0);
        if (validLines.length === 0) {
            throw ApiError.badRequest("Geçerli bir para birimi ve pozitif bir meblağ girilmelidir.");
        }
        return CariHareketSqlRepository.create({
            ...input,
            satirlar: validLines,
        }, userId, dbContext);
    }
    static async update(id, input, userId = 1, dbContext) {
        const existing = await CariHareketSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Güncellenecek cari hareket (ID: ${id}) bulunamadı.`);
        }
        if (!input.cariKartId) {
            throw ApiError.badRequest("Cari kart seçimi zorunludur.");
        }
        if (!input.vezneId) {
            throw ApiError.badRequest("Vezne seçimi zorunludur.");
        }
        if (!input.satirlar || input.satirlar.length === 0) {
            throw ApiError.badRequest("En az bir hareket satırı girilmelidir.");
        }
        const validLines = input.satirlar.filter((s) => s.paraId && Number(s.meblag) > 0);
        if (validLines.length === 0) {
            throw ApiError.badRequest("Geçerli bir para birimi ve pozitif bir meblağ girilmelidir.");
        }
        return CariHareketSqlRepository.update(id, {
            ...input,
            satirlar: validLines,
        }, userId, dbContext);
    }
    static async delete(id, dbContext) {
        const existing = await CariHareketSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Silinecek cari hareket (ID: ${id}) bulunamadı.`);
        }
        return CariHareketSqlRepository.delete(id, dbContext);
    }
    static async getNavigation(currentId, dbContext) {
        return CariHareketSqlRepository.getNavigationIds(currentId, dbContext);
    }
    static async getCariBakiye(cariKartId, dbContext) {
        if (!cariKartId) {
            throw ApiError.badRequest("Cari kart ID belirtilmelidir.");
        }
        return CariHareketSqlRepository.getCariBakiye(cariKartId, dbContext);
    }
}
