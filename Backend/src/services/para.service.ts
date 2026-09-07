import { ParaSqlRepository, ParaModel, ParaInputDto } from "../models/paraSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export class ParaService {
  public static async listParalar(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<ParaModel[]> {
    return ParaSqlRepository.findAll(dbContext);
  }

  public static async getParaById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<ParaModel> {
    const para = await ParaSqlRepository.findById(id, dbContext);
    if (!para) {
      throw ApiError.notFound(`Ürün / Para birimi (ID: ${id}) bulunamadı.`);
    }
    return para;
  }

  public static async createPara(
    input: ParaInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<ParaModel> {
    if (!input.kod || !input.kod.trim()) {
      throw ApiError.badRequest("Ürün / Para kodu zorunludur.");
    }
    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Ürün / Para adı zorunludur.");
    }

    const trimmedCode = input.kod.trim().slice(0, 5);
    const existing = await ParaSqlRepository.findByCode(trimmedCode, dbContext);
    if (existing) {
      throw ApiError.conflict(`"${trimmedCode}" kodlu ürün / para birimi zaten mevcut.`);
    }

    return ParaSqlRepository.create(
      {
        ...input,
        kod: trimmedCode,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );
  }

  public static async updatePara(
    id: number | string,
    input: ParaInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<ParaModel> {
    const existing = await ParaSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Güncellenecek ürün / para birimi (ID: ${id}) bulunamadı.`);
    }

    if (!input.kod || !input.kod.trim()) {
      throw ApiError.badRequest("Ürün / Para kodu zorunludur.");
    }
    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Ürün / Para adı zorunludur.");
    }

    const trimmedCode = input.kod.trim().slice(0, 5);
    const withCode = await ParaSqlRepository.findByCode(trimmedCode, dbContext);
    if (withCode && withCode.id !== Number(id)) {
      throw ApiError.conflict(`"${trimmedCode}" kodlu başka bir ürün / para birimi zaten mevcut.`);
    }

    const updated = await ParaSqlRepository.update(
      id,
      {
        ...input,
        kod: trimmedCode,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );

    if (!updated) {
      throw ApiError.internal("Ürün bilgileri güncellendi fakat güncel veri okunamadı.");
    }

    return updated;
  }

  public static async deletePara(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const existing = await ParaSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek ürün / para birimi (ID: ${id}) bulunamadı.`);
    }

    return ParaSqlRepository.delete(id, dbContext);
  }
}
