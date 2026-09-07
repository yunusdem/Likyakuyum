import { YaziciSqlRepository, YaziciModel, YaziciInputDto } from "../models/yaziciSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export class YaziciService {
  public static async listYazicilar(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel[]> {
    return YaziciSqlRepository.findAll(dbContext);
  }

  public static async getYaziciById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel> {
    const yazici = await YaziciSqlRepository.findById(id, dbContext);
    if (!yazici) {
      throw ApiError.notFound(`Yazıcı (ID: ${id}) bulunamadı.`);
    }
    return yazici;
  }

  public static async createYazici(
    input: YaziciInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel> {
    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Yazıcı tanım adı zorunludur.");
    }

    return YaziciSqlRepository.create(
      {
        ...input,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );
  }

  public static async updateYazici(
    id: number | string,
    input: YaziciInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel> {
    const existing = await YaziciSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Güncellenecek yazıcı (ID: ${id}) bulunamadı.`);
    }

    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Yazıcı tanım adı zorunludur.");
    }

    const updated = await YaziciSqlRepository.update(
      id,
      {
        ...input,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );

    if (!updated) {
      throw ApiError.internal("Yazıcı güncellendi ancak güncel veri okunamadı.");
    }

    return updated;
  }

  public static async deleteYazici(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const existing = await YaziciSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek yazıcı (ID: ${id}) bulunamadı.`);
    }

    return YaziciSqlRepository.delete(id, dbContext);
  }
}
