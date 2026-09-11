import {
  DovizFisSqlRepository,
  DovizFisModel,
  SaveDovizFisDto,
} from "../models/dovizFisSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export class DovizFisService {
  public static async getFisList(
    filter?: { search?: string; tip?: number; vezneId?: number; limit?: number },
    dbContext?: { dbServer?: string; dbName?: string }
  ) {
    return DovizFisSqlRepository.findAll(filter, dbContext);
  }

  public static async getFisById(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<DovizFisModel> {
    if (!id || isNaN(id)) {
      throw ApiError.badRequest("Geçerli bir Fiş ID belirtilmelidir.");
    }
    const item = await DovizFisSqlRepository.findById(id, dbContext);
    if (!item) {
      throw ApiError.notFound("İstenen Döviz Fişi kaydı bulunamadı.");
    }
    return item;
  }

  public static async saveFis(
    dto: SaveDovizFisDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<DovizFisModel> {
    if (!dto.satirlar || dto.satirlar.length === 0) {
      throw ApiError.badRequest("Fiş kaydı için en az bir döviz kalemi girilmelidir.");
    }
    return DovizFisSqlRepository.saveViaProcedure(dto, dbContext);
  }

  public static async deleteFis(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string },
    kullaniciId?: number
  ): Promise<boolean> {
    if (!id || isNaN(id)) {
      throw ApiError.badRequest("Silinecek Fiş ID belirtilmelidir.");
    }
    return DovizFisSqlRepository.deleteFis(id, dbContext, kullaniciId);
  }

  public static async getVezneBakiye(
    vezneId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ) {
    return DovizFisSqlRepository.getVezneBakiye(vezneId, dbContext);
  }
}
