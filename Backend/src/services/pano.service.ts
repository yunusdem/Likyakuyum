import { PanoSqlRepository, PanoModel, SavePanoDto } from "../models/panoSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export class PanoService {
  public static async getAllPanos(dbContext?: { dbServer?: string; dbName?: string }): Promise<PanoModel[]> {
    return PanoSqlRepository.findAll(dbContext);
  }

  public static async getPanoById(id: number, dbContext?: { dbServer?: string; dbName?: string }): Promise<PanoModel> {
    if (!id || isNaN(id)) {
      throw ApiError.badRequest("Geçerli bir Pano ID belirtilmelidir.");
    }
    const pano = await PanoSqlRepository.findById(id, dbContext);
    if (!pano) {
      throw ApiError.notFound("İstenen Pano tanımı bulunamadı.");
    }
    return pano;
  }

  public static async savePano(dto: SavePanoDto, dbContext?: { dbServer?: string; dbName?: string }): Promise<PanoModel> {
    if (!dto.panoNo || !dto.panoNo.trim()) {
      throw ApiError.badRequest("Pano No alanı boş bırakılamaz.");
    }
    return PanoSqlRepository.saveViaProcedure(dto, dbContext);
  }

  public static async deletePano(id: number, dbContext?: { dbServer?: string; dbName?: string }): Promise<boolean> {
    if (!id || isNaN(id)) {
      throw ApiError.badRequest("Silinecek Pano ID belirtilmelidir.");
    }
    return PanoSqlRepository.deleteViaProcedure(id, dbContext);
  }

  public static async getLiveBoardData(id?: number, dbContext?: { dbServer?: string; dbName?: string }): Promise<PanoModel> {
    const targetId = id && !isNaN(id) && id > 0 ? id : 0;
    const liveData = await PanoSqlRepository.getLiveBoardData(targetId, dbContext);
    if (!liveData) {
      throw ApiError.notFound("Canlı Pano verisi bulunamadı.");
    }
    return liveData;
  }
}
