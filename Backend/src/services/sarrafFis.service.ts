import { SarrafFisSqlRepository, SaveSarrafFisDto, SaveSarrafFisDetayDto } from "../models/sarrafFisSql.repository.js";

export class SarrafFisService {
  static async getUrunler(dbContext?: { dbServer?: string; dbName?: string }) { return SarrafFisSqlRepository.getUrunler(dbContext); }
  static async getVezneBakiye(vezneId: number, dbContext?: { dbServer?: string; dbName?: string }) { return SarrafFisSqlRepository.getVezneBakiye(vezneId, dbContext); }
  static async getFisList(filters: { search?: string; tip?: number; vezneId?: number; limit?: number }, dbContext?: { dbServer?: string; dbName?: string }) { return SarrafFisSqlRepository.getFisList(filters, dbContext); }
  static async getFisById(id: number, dbContext?: { dbServer?: string; dbName?: string }) { return SarrafFisSqlRepository.getFisById(id, dbContext); }
  static async saveFis(dto: SaveSarrafFisDto, dbContext?: { dbServer?: string; dbName?: string }) { return SarrafFisSqlRepository.saveFis(dto, dbContext); }
  static async deleteFis(id: number, kullaniciId: number, dbContext?: { dbServer?: string; dbName?: string }) { return SarrafFisSqlRepository.deleteFis(id, kullaniciId, dbContext); }
  static async saveDetay(dto: SaveSarrafFisDetayDto, dbContext?: { dbServer?: string; dbName?: string }) { return SarrafFisSqlRepository.saveDetay(dto, dbContext); }
  static async getUserVezneId(kullaniciId: number, dbContext?: { dbServer?: string; dbName?: string }) { return SarrafFisSqlRepository.getUserVezneId(kullaniciId, dbContext); }
}
