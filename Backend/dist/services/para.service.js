import { ParaSqlRepository } from "../models/paraSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class ParaService {
    static async listParalar(dbContext) {
        return ParaSqlRepository.findAll(dbContext);
    }
    static async getParaById(id, dbContext) {
        const para = await ParaSqlRepository.findById(id, dbContext);
        if (!para) {
            throw ApiError.notFound(`Ürün / Para birimi (ID: ${id}) bulunamadı.`);
        }
        return para;
    }
    static async createPara(input, dbContext) {
        if (!input.kod || !input.kod.trim()) {
            throw ApiError.badRequest("Ürün / Para kodu zorunludur.");
        }
        if (!input.ad || !input.ad.trim()) {
            throw ApiError.badRequest("Ürün / Para adı zorunludur.");
        }
        const trimmedCode = input.kod.trim().slice(0, 5);
        const existing = await ParaSqlRepository.findByCode(trimmedCode, dbContext);
        if (existing) {
            throw ApiError.conflict(`"${trimmedCode}" kodlu ürün / para birimi zaten mevcut.`);
        }
        return ParaSqlRepository.create({
            ...input,
            kod: trimmedCode,
            ad: input.ad.trim().slice(0, 200),
        }, dbContext);
    }
    static async updatePara(id, input, dbContext) {
        const existing = await ParaSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Güncellenecek ürün / para birimi (ID: ${id}) bulunamadı.`);
        }
        if (!input.kod || !input.kod.trim()) {
            throw ApiError.badRequest("Ürün / Para kodu zorunludur.");
        }
        if (!input.ad || !input.ad.trim()) {
            throw ApiError.badRequest("Ürün / Para adı zorunludur.");
        }
        const trimmedCode = input.kod.trim().slice(0, 5);
        const withCode = await ParaSqlRepository.findByCode(trimmedCode, dbContext);
        if (withCode && withCode.id !== Number(id)) {
            throw ApiError.conflict(`"${trimmedCode}" kodlu başka bir ürün / para birimi zaten mevcut.`);
        }
        const updated = await ParaSqlRepository.update(id, {
            ...input,
            kod: trimmedCode,
            ad: input.ad.trim().slice(0, 200),
        }, dbContext);
        if (!updated) {
            throw ApiError.internal("Ürün bilgileri güncellendi fakat güncel veri okunamadı.");
        }
        return updated;
    }
    static async deletePara(id, dbContext) {
        const existing = await ParaSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Silinecek ürün / para birimi (ID: ${id}) bulunamadı.`);
        }
        return ParaSqlRepository.delete(id, dbContext);
    }
}
