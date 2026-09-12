import {
  VezneIzlemeSqlRepository,
  VezneIzlemeSettings,
  VezneIzlemeDataResponse,
} from "../models/vezneIzlemeSql.repository.js";

export class VezneIzlemeService {
  public static async getIzlemeData(dbContext?: {
    dbServer?: string;
    dbName?: string;
  }): Promise<VezneIzlemeDataResponse> {
    return await VezneIzlemeSqlRepository.getIzlemeData(dbContext);
  }

  public static async saveSettings(
    settings: VezneIzlemeSettings,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneIzlemeSettings> {
    return await VezneIzlemeSqlRepository.saveSettings(settings, dbContext);
  }

  public static async updateBakiye(
    vezneId: number,
    paraId: number,
    miktar: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<void> {
    return await VezneIzlemeSqlRepository.updateBakiye(vezneId, paraId, miktar, dbContext);
  }

  public static async updateAllBakiyeler(
    items: { vezneId: number; paraId: number; miktar: number }[],
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<void> {
    return await VezneIzlemeSqlRepository.updateAllBakiyeler(items, dbContext);
  }
}

