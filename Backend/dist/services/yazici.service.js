import { YaziciSqlRepository } from "../models/yaziciSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class YaziciService {
    static async listYazicilar(dbContext) {
        return YaziciSqlRepository.findAll(dbContext);
    }
    static async getYaziciById(id, dbContext) {
        const yazici = await YaziciSqlRepository.findById(id, dbContext);
        if (!yazici) {
            throw ApiError.notFound(`Yazıcı (ID: ${id}) bulunamadı.`);
        }
        return yazici;
    }
    static async createYazici(input, dbContext) {
        if (!input.ad || !input.ad.trim()) {
            throw ApiError.badRequest("Yazıcı tanım adı zorunludur.");
        }
        return YaziciSqlRepository.create({
            ...input,
            ad: input.ad.trim().slice(0, 200),
        }, dbContext);
    }
    static async updateYazici(id, input, dbContext) {
        const existing = await YaziciSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Güncellenecek yazıcı (ID: ${id}) bulunamadı.`);
        }
        if (!input.ad || !input.ad.trim()) {
            throw ApiError.badRequest("Yazıcı tanım adı zorunludur.");
        }
        const updated = await YaziciSqlRepository.update(id, {
            ...input,
            ad: input.ad.trim().slice(0, 200),
        }, dbContext);
        if (!updated) {
            throw ApiError.internal("Yazıcı güncellendi ancak güncel veri okunamadı.");
        }
        return updated;
    }
    static async deleteYazici(id, dbContext) {
        const existing = await YaziciSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Silinecek yazıcı (ID: ${id}) bulunamadı.`);
        }
        return YaziciSqlRepository.delete(id, dbContext);
    }
}
