import { VezneSqlRepository, VezneModel, VezneInputDto } from "../models/vezneSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export class VezneService {
  public static async listVezneler(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneModel[]> {
    return VezneSqlRepository.findAll(dbContext);
  }

  public static async getVezneById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneModel> {
    const vezne = await VezneSqlRepository.findById(id, dbContext);
    if (!vezne) {
      throw ApiError.notFound(`Vezne (ID: ${id}) bulunamadı.`);
    }
    return vezne;
  }

  public static async createVezne(
    input: VezneInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneModel> {
    if (!input.kod || !input.kod.trim()) {
      throw ApiError.badRequest("Vezne kodu zorunludur.");
    }
    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Vezne adı zorunludur.");
    }

    const trimmedCode = input.kod.trim().slice(0, 5);
    const existing = await VezneSqlRepository.findByCode(trimmedCode, dbContext);
    if (existing) {
      throw ApiError.conflict(`"${trimmedCode}" kodlu vezne zaten mevcut.`);
    }

    return VezneSqlRepository.create(
      {
        ...input,
        kod: trimmedCode,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );
  }

  public static async updateVezne(
    id: number | string,
    input: VezneInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneModel> {
    const existing = await VezneSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Güncellenecek vezne (ID: ${id}) bulunamadı.`);
    }

    if (input.kod && input.kod.trim()) {
      const trimmedCode = input.kod.trim().slice(0, 5);
      const withCode = await VezneSqlRepository.findByCode(trimmedCode, dbContext);
      if (withCode && withCode.id !== Number(id)) {
        throw ApiError.conflict(`"${trimmedCode}" kodlu başka bir vezne zaten mevcut.`);
      }
    }

    const updated = await VezneSqlRepository.update(
      id,
      {
        ...input,
        kod: (input.kod || existing.kod).trim().slice(0, 5),
        ad: (input.ad || existing.ad).trim().slice(0, 200),
      },
      dbContext
    );

    if (!updated) {
      throw ApiError.internal("Vezne güncellendi ancak güncel veri okunamadı.");
    }

    return updated;
  }

  public static async deleteVezne(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const existing = await VezneSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek vezne (ID: ${id}) bulunamadı.`);
    }

    return VezneSqlRepository.delete(id, dbContext);
  }

  public static async getPrinters(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ id: number; name: string; deviceName?: string }[]> {
    return VezneSqlRepository.getPrinters(dbContext);
  }

  public static async getCurrencies(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ id: number; code: string; name: string }[]> {
    return VezneSqlRepository.getCurrencies(dbContext);
  }
}
