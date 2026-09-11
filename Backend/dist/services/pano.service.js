import { PanoSqlRepository } from "../models/panoSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class PanoService {
    static async getAllPanos(dbContext) {
        return PanoSqlRepository.findAll(dbContext);
    }
    static async getPanoById(id, dbContext) {
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Geçerli bir Pano ID belirtilmelidir.");
        }
        const pano = await PanoSqlRepository.findById(id, dbContext);
        if (!pano) {
            throw ApiError.notFound("İstenen Pano tanımı bulunamadı.");
        }
        return pano;
    }
    static async savePano(dto, dbContext) {
        if (!dto.panoNo || !dto.panoNo.trim()) {
            throw ApiError.badRequest("Pano No alanı boş bırakılamaz.");
        }
        return PanoSqlRepository.saveViaProcedure(dto, dbContext);
    }
    static async deletePano(id, dbContext) {
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Silinecek Pano ID belirtilmelidir.");
        }
        return PanoSqlRepository.deleteViaProcedure(id, dbContext);
    }
    static async getLiveBoardData(id, dbContext) {
        const targetId = id && !isNaN(id) && id > 0 ? id : 0;
        const liveData = await PanoSqlRepository.getLiveBoardData(targetId, dbContext);
        if (!liveData) {
            throw ApiError.notFound("Canlı Pano verisi bulunamadı.");
        }
        return liveData;
    }
}
