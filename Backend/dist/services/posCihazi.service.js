import { PosCihaziSqlRepository, } from "../models/posCihaziSql.repository.js";
export class PosCihaziService {
    static getPosCihazlari(dbContext) {
        return PosCihaziSqlRepository.getAll(dbContext);
    }
    static getPosCihaziById(id, dbContext) {
        return PosCihaziSqlRepository.getById(id, dbContext);
    }
    static getPosCihaziBakiye(id, dbContext) {
        return PosCihaziSqlRepository.getBakiye(id, dbContext);
    }
    static getNextPosKod(dbContext) {
        return PosCihaziSqlRepository.getNextPosKod(dbContext);
    }
    static savePosCihazi(dto, dbContext) {
        return PosCihaziSqlRepository.save(dto, dbContext);
    }
    static deletePosCihazi(id, dbContext) {
        return PosCihaziSqlRepository.delete(id, dbContext);
    }
}
