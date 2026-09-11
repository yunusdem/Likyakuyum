import { DovizFisSqlRepository, } from "../models/dovizFisSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class DovizFisService {
    static async getFisList(filter, dbContext) {
        return DovizFisSqlRepository.findAll(filter, dbContext);
    }
    static async getFisById(id, dbContext) {
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Geçerli bir Fiş ID belirtilmelidir.");
        }
        const item = await DovizFisSqlRepository.findById(id, dbContext);
        if (!item) {
            throw ApiError.notFound("İstenen Döviz Fişi kaydı bulunamadı.");
        }
        return item;
    }
    static async saveFis(dto, dbContext) {
        if (!dto.satirlar || dto.satirlar.length === 0) {
            throw ApiError.badRequest("Fiş kaydı için en az bir döviz kalemi girilmelidir.");
        }
        return DovizFisSqlRepository.saveViaProcedure(dto, dbContext);
    }
    static async deleteFis(id, dbContext, kullaniciId) {
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Silinecek Fiş ID belirtilmelidir.");
        }
        return DovizFisSqlRepository.deleteFis(id, dbContext, kullaniciId);
    }
    static async getVezneBakiye(vezneId, dbContext) {
        return DovizFisSqlRepository.getVezneBakiye(vezneId, dbContext);
    }
}
