import { SarrafFisSqlRepository } from "../models/sarrafFisSql.repository.js";
export class SarrafFisService {
    static async getUrunler(dbContext) { return SarrafFisSqlRepository.getUrunler(dbContext); }
    static async getVezneBakiye(vezneId, dbContext) { return SarrafFisSqlRepository.getVezneBakiye(vezneId, dbContext); }
    static async getFisList(filters, dbContext) { return SarrafFisSqlRepository.getFisList(filters, dbContext); }
    static async getFisById(id, dbContext) { return SarrafFisSqlRepository.getFisById(id, dbContext); }
    static async saveFis(dto, dbContext) { return SarrafFisSqlRepository.saveFis(dto, dbContext); }
    static async deleteFis(id, kullaniciId, dbContext) { return SarrafFisSqlRepository.deleteFis(id, kullaniciId, dbContext); }
    static async saveDetay(dto, dbContext) { return SarrafFisSqlRepository.saveDetay(dto, dbContext); }
    static async getUserVezneId(kullaniciId, dbContext) { return SarrafFisSqlRepository.getUserVezneId(kullaniciId, dbContext); }
}
