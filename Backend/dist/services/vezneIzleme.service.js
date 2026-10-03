import { VezneIzlemeSqlRepository, } from "../models/vezneIzlemeSql.repository.js";
export class VezneIzlemeService {
    static async getIzlemeData(dbContext) {
        return await VezneIzlemeSqlRepository.getIzlemeData(dbContext);
    }
    static async saveSettings(settings, dbContext) {
        return await VezneIzlemeSqlRepository.saveSettings(settings, dbContext);
    }
    static async updateBakiye(vezneId, paraId, miktar, dbContext, kullaniciId) {
        return await VezneIzlemeSqlRepository.updateBakiye(vezneId, paraId, miktar, dbContext, kullaniciId);
    }
    static async updateAllBakiyeler(items, dbContext, kullaniciId) {
        return await VezneIzlemeSqlRepository.updateAllBakiyeler(items, dbContext, kullaniciId);
    }
}
