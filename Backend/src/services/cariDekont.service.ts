import {
  CariDekontSqlRepository,
  CariDekontModel,
  SaveCariDekontDto,
} from "../models/cariDekontSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export class CariDekontService {
  public static async getDekontList(
    filter?: { search?: string; tip?: number; vezneId?: number; limit?: number },
    dbContext?: { dbServer?: string; dbName?: string }
  ) {
    return CariDekontSqlRepository.findAll(filter, dbContext);
  }

  public static async getDekontById(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariDekontModel> {
    if (!id || isNaN(id)) {
      throw ApiError.badRequest("Geçerli bir Dekont ID belirtilmelidir.");
    }
    const item = await CariDekontSqlRepository.findById(id, dbContext);
    if (!item) {
      throw ApiError.notFound("İstenen Cari Dekont kaydı bulunamadı.");
    }
    return item;
  }

  public static async saveDekont(
    dto: SaveCariDekontDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariDekontModel> {
    if (!dto.borcluId && !dto.alacakliId) {
      throw ApiError.badRequest("Dekont için Cari Hesap seçimi zorunludur.");
    }
    if (!dto.satirlar || dto.satirlar.length === 0) {
      throw ApiError.badRequest("Dekont için en az bir kalem girilmelidir.");
    }
    return CariDekontSqlRepository.saveViaProcedure(dto, dbContext);
  }

  public static async deleteDekont(
    id: number,
    kullaniciId: number = 1,
    degisiklikTakipVar: boolean = true,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    if (!id || isNaN(id)) {
      throw ApiError.badRequest("Silinecek Dekont ID belirtilmelidir.");
    }
    await CariDekontSqlRepository.deleteViaProcedure(id, kullaniciId, degisiklikTakipVar, dbContext);
    return true;
  }
}
