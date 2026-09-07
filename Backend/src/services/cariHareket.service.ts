import {
  CariHareketSqlRepository,
  CariHareketModel,
  CariHareketInputDto,
  CariBakiyeSummary,
} from "../models/cariHareketSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export class CariHareketService {
  public static async list(
    filters?: {
      startDate?: string;
      endDate?: string;
      cariKartId?: number;
      vezneId?: number;
      tip?: number;
      hareketTipi?: number;
      search?: string;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel[]> {
    return CariHareketSqlRepository.findAll(filters, dbContext);
  }

  public static async getById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel> {
    const item = await CariHareketSqlRepository.findById(id, dbContext);
    if (!item) {
      throw ApiError.notFound(`Cari hareket (ID: ${id}) bulunamadı.`);
    }
    return item;
  }

  public static async create(
    input: CariHareketInputDto,
    userId: number = 1,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel> {
    if (!input.cariKartId) {
      throw ApiError.badRequest("Cari kart seçimi zorunludur.");
    }
    if (!input.vezneId) {
      throw ApiError.badRequest("Vezne seçimi zorunludur.");
    }
    if (!input.satirlar || input.satirlar.length === 0) {
      throw ApiError.badRequest("En az bir hareket satırı (para birimi ve meblağ) girilmelidir.");
    }

    const validLines = input.satirlar.filter((s) => s.paraId && Number(s.meblag) > 0);
    if (validLines.length === 0) {
      throw ApiError.badRequest("Geçerli bir para birimi ve pozitif bir meblağ girilmelidir.");
    }

    return CariHareketSqlRepository.create(
      {
        ...input,
        satirlar: validLines,
      },
      userId,
      dbContext
    );
  }

  public static async update(
    id: number | string,
    input: CariHareketInputDto,
    userId: number = 1,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel> {
    const existing = await CariHareketSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Güncellenecek cari hareket (ID: ${id}) bulunamadı.`);
    }

    if (!input.cariKartId) {
      throw ApiError.badRequest("Cari kart seçimi zorunludur.");
    }
    if (!input.vezneId) {
      throw ApiError.badRequest("Vezne seçimi zorunludur.");
    }
    if (!input.satirlar || input.satirlar.length === 0) {
      throw ApiError.badRequest("En az bir hareket satırı girilmelidir.");
    }

    const validLines = input.satirlar.filter((s) => s.paraId && Number(s.meblag) > 0);
    if (validLines.length === 0) {
      throw ApiError.badRequest("Geçerli bir para birimi ve pozitif bir meblağ girilmelidir.");
    }

    return CariHareketSqlRepository.update(
      id,
      {
        ...input,
        satirlar: validLines,
      },
      userId,
      dbContext
    );
  }

  public static async delete(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const existing = await CariHareketSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek cari hareket (ID: ${id}) bulunamadı.`);
    }
    return CariHareketSqlRepository.delete(id, dbContext);
  }

  public static async getNavigation(
    currentId?: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ) {
    return CariHareketSqlRepository.getNavigationIds(currentId, dbContext);
  }

  public static async getCariBakiye(
    cariKartId: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariBakiyeSummary> {
    if (!cariKartId) {
      throw ApiError.badRequest("Cari kart ID belirtilmelidir.");
    }
    return CariHareketSqlRepository.getCariBakiye(cariKartId, dbContext);
  }
}
