import { CariDekontSqlRepository, } from "../models/cariDekontSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class CariDekontService {
    static async getDekontList(filter, dbContext) {
        return CariDekontSqlRepository.findAll(filter, dbContext);
    }
    static async getDekontById(id, dbContext) {
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Geçerli bir Dekont ID belirtilmelidir.");
        }
        const item = await CariDekontSqlRepository.findById(id, dbContext);
        if (!item) {
            throw ApiError.notFound("İstenen Cari Dekont kaydı bulunamadı.");
        }
        return item;
    }
    static async saveDekont(dto, dbContext) {
        if (!dto.borcluId && !dto.alacakliId) {
            throw ApiError.badRequest("Dekont için Cari Hesap seçimi zorunludur.");
        }
        if (!dto.satirlar || dto.satirlar.length === 0) {
            throw ApiError.badRequest("Dekont için en az bir kalem girilmelidir.");
        }
        return CariDekontSqlRepository.saveViaProcedure(dto, dbContext);
    }
    static async deleteDekont(id, kullaniciId = 1, degisiklikTakipVar = true, dbContext) {
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Silinecek Dekont ID belirtilmelidir.");
        }
        await CariDekontSqlRepository.deleteViaProcedure(id, kullaniciId, degisiklikTakipVar, dbContext);
        return true;
    }
}
