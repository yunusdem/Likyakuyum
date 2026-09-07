import { CariSqlRepository, CariKartModel, CariKartInputDto } from "../models/cariSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export class CariService {
  public static async getLookups(
    dbContext?: { dbServer?: string; dbName?: string }
  ) {
    return CariSqlRepository.getLookups(dbContext);
  }

  public static async listCariKartlar(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariKartModel[]> {

    return CariSqlRepository.findAll(dbContext);
  }

  public static async getCariKartById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariKartModel> {
    const item = await CariSqlRepository.findById(id, dbContext);
    if (!item) {
      throw ApiError.notFound(`Cari kart (ID: ${id}) bulunamadı.`);
    }
    return item;
  }

  public static async createCariKart(
    input: CariKartInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariKartModel> {
    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Cari ünvan / ad bilgisi zorunludur.");
    }

    const trimmedCode = (input.kod || "").trim().slice(0, 20);

    return CariSqlRepository.create(
      {
        ...input,
        kod: trimmedCode,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );
  }

  public static async updateCariKart(
    id: number | string,
    input: CariKartInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariKartModel> {
    const existing = await CariSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Güncellenecek cari kart (ID: ${id}) bulunamadı.`);
    }

    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Cari ünvan / ad bilgisi zorunludur.");
    }

    const trimmedCode = (input.kod || "").trim().slice(0, 20);

    const updated = await CariSqlRepository.update(
      id,
      {
        ...input,
        kod: trimmedCode,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );

    if (!updated) {
      throw ApiError.internal("Cari kart güncellendi fakat güncel veri okunamadı.");
    }

    return updated;
  }

  public static async deleteCariKart(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const existing = await CariSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek cari kart (ID: ${id}) bulunamadı.`);
    }

    return CariSqlRepository.delete(id, dbContext);
  }
}
