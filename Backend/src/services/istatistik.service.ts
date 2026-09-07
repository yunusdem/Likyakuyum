import { IstatistikSqlRepository, IstatistikModel, IstatistikInputDto } from "../models/istatistikSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export class IstatistikService {
  public static async listIstatistikler(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IstatistikModel[]> {
    return IstatistikSqlRepository.findAll(dbContext);
  }

  public static async getIstatistikById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IstatistikModel> {
    const item = await IstatistikSqlRepository.findById(id, dbContext);
    if (!item) {
      throw ApiError.notFound(`İstatistik tanımı (ID: ${id}) bulunamadı.`);
    }
    return item;
  }

  public static async createIstatistik(
    input: IstatistikInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IstatistikModel> {
    if (!input.kod || !input.kod.trim()) {
      throw ApiError.badRequest("İstatistik kodu zorunludur.");
    }
    if (!input.aciklama || !input.aciklama.trim()) {
      throw ApiError.badRequest("İstatistik açıklaması zorunludur.");
    }

    const trimmedCode = input.kod.trim().slice(0, 20);
    const existing = await IstatistikSqlRepository.findByCode(trimmedCode, dbContext);
    if (existing) {
      throw ApiError.conflict(`"${trimmedCode}" kodlu istatistik tanımı zaten mevcut.`);
    }

    return IstatistikSqlRepository.create(
      {
        ...input,
        kod: trimmedCode,
        aciklama: input.aciklama.trim().slice(0, 100),
      },
      dbContext
    );
  }

  public static async updateIstatistik(
    id: number | string,
    input: IstatistikInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<IstatistikModel> {
    const existing = await IstatistikSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Güncellenecek istatistik tanımı (ID: ${id}) bulunamadı.`);
    }

    if (!input.kod || !input.kod.trim()) {
      throw ApiError.badRequest("İstatistik kodu zorunludur.");
    }
    if (!input.aciklama || !input.aciklama.trim()) {
      throw ApiError.badRequest("İstatistik açıklaması zorunludur.");
    }

    const trimmedCode = input.kod.trim().slice(0, 20);
    const withCode = await IstatistikSqlRepository.findByCode(trimmedCode, dbContext);
    if (withCode && withCode.id !== Number(id)) {
      throw ApiError.conflict(`"${trimmedCode}" kodlu başka bir istatistik tanımı zaten mevcut.`);
    }

    const updated = await IstatistikSqlRepository.update(
      id,
      {
        ...input,
        kod: trimmedCode,
        aciklama: input.aciklama.trim().slice(0, 100),
      },
      dbContext
    );

    if (!updated) {
      throw ApiError.internal("İstatistik bilgileri güncellendi fakat güncel veri okunamadı.");
    }

    return updated;
  }

  public static async deleteIstatistik(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const existing = await IstatistikSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek istatistik tanımı (ID: ${id}) bulunamadı.`);
    }

    return IstatistikSqlRepository.delete(id, dbContext);
  }
}
