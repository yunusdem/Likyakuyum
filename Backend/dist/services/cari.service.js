import { CariSqlRepository } from "../models/cariSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class CariService {
    static async getLookups(dbContext) {
        return CariSqlRepository.getLookups(dbContext);
    }
    static async listCariKartlar(dbContext) {
        return CariSqlRepository.findAll(dbContext);
    }
    static async getCariKartById(id, dbContext) {
        const item = await CariSqlRepository.findById(id, dbContext);
        if (!item) {
            throw ApiError.notFound(`Cari kart (ID: ${id}) bulunamadı.`);
        }
        return item;
    }
    static async createCariKart(input, dbContext) {
        if (!input.ad || !input.ad.trim()) {
            throw ApiError.badRequest("Cari ünvan / ad bilgisi zorunludur.");
        }
        const trimmedCode = (input.kod || "").trim().slice(0, 20);
        return CariSqlRepository.create({
            ...input,
            kod: trimmedCode,
            ad: input.ad.trim().slice(0, 200),
        }, dbContext);
    }
    static async updateCariKart(id, input, dbContext) {
        const existing = await CariSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Güncellenecek cari kart (ID: ${id}) bulunamadı.`);
        }
        if (!input.ad || !input.ad.trim()) {
            throw ApiError.badRequest("Cari ünvan / ad bilgisi zorunludur.");
        }
        const trimmedCode = (input.kod || "").trim().slice(0, 20);
        const updated = await CariSqlRepository.update(id, {
            ...input,
            kod: trimmedCode,
            ad: input.ad.trim().slice(0, 200),
        }, dbContext);
        if (!updated) {
            throw ApiError.internal("Cari kart güncellendi fakat güncel veri okunamadı.");
        }
        return updated;
    }
    static async deleteCariKart(id, dbContext) {
        const existing = await CariSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Silinecek cari kart (ID: ${id}) bulunamadı.`);
        }
        return CariSqlRepository.delete(id, dbContext);
    }
}
