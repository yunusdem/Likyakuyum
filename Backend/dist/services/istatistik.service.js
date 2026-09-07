import { IstatistikSqlRepository } from "../models/istatistikSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class IstatistikService {
    static async listIstatistikler(dbContext) {
        return IstatistikSqlRepository.findAll(dbContext);
    }
    static async getIstatistikById(id, dbContext) {
        const item = await IstatistikSqlRepository.findById(id, dbContext);
        if (!item) {
            throw ApiError.notFound(`İstatistik tanımı (ID: ${id}) bulunamadı.`);
        }
        return item;
    }
    static async createIstatistik(input, dbContext) {
        if (!input.kod || !input.kod.trim()) {
            throw ApiError.badRequest("İstatistik kodu zorunludur.");
        }
        if (!input.aciklama || !input.aciklama.trim()) {
            throw ApiError.badRequest("İstatistik açıklaması zorunludur.");
        }
        const trimmedCode = input.kod.trim().slice(0, 20);
        const existing = await IstatistikSqlRepository.findByCode(trimmedCode, dbContext);
        if (existing) {
            throw ApiError.conflict(`"${trimmedCode}" kodlu istatistik tanımı zaten mevcut.`);
        }
        return IstatistikSqlRepository.create({
            ...input,
            kod: trimmedCode,
            aciklama: input.aciklama.trim().slice(0, 100),
        }, dbContext);
    }
    static async updateIstatistik(id, input, dbContext) {
        const existing = await IstatistikSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Güncellenecek istatistik tanımı (ID: ${id}) bulunamadı.`);
        }
        if (!input.kod || !input.kod.trim()) {
            throw ApiError.badRequest("İstatistik kodu zorunludur.");
        }
        if (!input.aciklama || !input.aciklama.trim()) {
            throw ApiError.badRequest("İstatistik açıklaması zorunludur.");
        }
        const trimmedCode = input.kod.trim().slice(0, 20);
        const withCode = await IstatistikSqlRepository.findByCode(trimmedCode, dbContext);
        if (withCode && withCode.id !== Number(id)) {
            throw ApiError.conflict(`"${trimmedCode}" kodlu başka bir istatistik tanımı zaten mevcut.`);
        }
        const updated = await IstatistikSqlRepository.update(id, {
            ...input,
            kod: trimmedCode,
            aciklama: input.aciklama.trim().slice(0, 100),
        }, dbContext);
        if (!updated) {
            throw ApiError.internal("İstatistik bilgileri güncellendi fakat güncel veri okunamadı.");
        }
        return updated;
    }
    static async deleteIstatistik(id, dbContext) {
        const existing = await IstatistikSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Silinecek istatistik tanımı (ID: ${id}) bulunamadı.`);
        }
        return IstatistikSqlRepository.delete(id, dbContext);
    }
}
