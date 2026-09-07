import { VezneSqlRepository } from "../models/vezneSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class VezneService {
    static async listVezneler(dbContext) {
        return VezneSqlRepository.findAll(dbContext);
    }
    static async getVezneById(id, dbContext) {
        const vezne = await VezneSqlRepository.findById(id, dbContext);
        if (!vezne) {
            throw ApiError.notFound(`Vezne (ID: ${id}) bulunamadı.`);
        }
        return vezne;
    }
    static async createVezne(input, dbContext) {
        if (!input.kod || !input.kod.trim()) {
            throw ApiError.badRequest("Vezne kodu zorunludur.");
        }
        if (!input.ad || !input.ad.trim()) {
            throw ApiError.badRequest("Vezne adı zorunludur.");
        }
        const trimmedCode = input.kod.trim().slice(0, 5);
        const existing = await VezneSqlRepository.findByCode(trimmedCode, dbContext);
        if (existing) {
            throw ApiError.conflict(`"${trimmedCode}" kodlu vezne zaten mevcut.`);
        }
        return VezneSqlRepository.create({
            ...input,
            kod: trimmedCode,
            ad: input.ad.trim().slice(0, 200),
        }, dbContext);
    }
    static async updateVezne(id, input, dbContext) {
        const existing = await VezneSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Güncellenecek vezne (ID: ${id}) bulunamadı.`);
        }
        if (input.kod && input.kod.trim()) {
            const trimmedCode = input.kod.trim().slice(0, 5);
            const withCode = await VezneSqlRepository.findByCode(trimmedCode, dbContext);
            if (withCode && withCode.id !== Number(id)) {
                throw ApiError.conflict(`"${trimmedCode}" kodlu başka bir vezne zaten mevcut.`);
            }
        }
        const updated = await VezneSqlRepository.update(id, {
            ...input,
            kod: (input.kod || existing.kod).trim().slice(0, 5),
            ad: (input.ad || existing.ad).trim().slice(0, 200),
        }, dbContext);
        if (!updated) {
            throw ApiError.internal("Vezne güncellendi ancak güncel veri okunamadı.");
        }
        return updated;
    }
    static async deleteVezne(id, dbContext) {
        const existing = await VezneSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Silinecek vezne (ID: ${id}) bulunamadı.`);
        }
        return VezneSqlRepository.delete(id, dbContext);
    }
    static async getPrinters(dbContext) {
        return VezneSqlRepository.getPrinters(dbContext);
    }
    static async getCurrencies(dbContext) {
        return VezneSqlRepository.getCurrencies(dbContext);
    }
}
