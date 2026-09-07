import { NumeratorSqlRepository, NumeratorModel, NumeratorInputDto } from "../models/numeratorSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export function parseNumeratorId(id: string): { tur: number; yaziciId: number | null } {
  if (!id) {
    throw ApiError.badRequest("Geçersiz numaratör anahtarı.");
  }
  const parts = id.split("_");
  const tur = parseInt(parts[0], 10);
  if (isNaN(tur)) {
    throw ApiError.badRequest("Geçersiz belge türü.");
  }
  const yaziciId = parts[1] === "null" || parts[1] === "" || parts[1] === undefined ? null : parseInt(parts[1], 10);
  return { tur, yaziciId: isNaN(yaziciId as number) ? null : yaziciId };
}

export class NumeratorService {
  public static async listNumerators(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel[]> {
    return NumeratorSqlRepository.findAll(dbContext);
  }

  public static async getNumeratorById(
    id: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel> {
    const { tur, yaziciId } = parseNumeratorId(id);
    const item = await NumeratorSqlRepository.findByTurAndYazici(tur, yaziciId, dbContext);
    if (!item) {
      throw ApiError.notFound(`Numaratör tanımı bulunamadı.`);
    }
    return item;
  }

  public static async saveNumerator(
    input: NumeratorInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel> {
    const tur = typeof input.tur === "number" ? input.tur : parseInt(String(input.tur), 10);
    if (isNaN(tur)) {
      throw ApiError.badRequest("Belge türü (TUR) zorunludur.");
    }
    const yaziciId =
      input.yaziciId !== undefined && input.yaziciId !== null && String(input.yaziciId) !== "" && parseInt(String(input.yaziciId), 10) !== 0
        ? parseInt(String(input.yaziciId), 10)
        : null;

    return NumeratorSqlRepository.saveViaProcedure(
      {
        ...input,
        tur,
        yaziciId,
        onek: input.onek ? input.onek.trim().slice(0, 50) : null,
      },
      dbContext
    );
  }

  public static async createNumerator(
    input: NumeratorInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel> {
    return NumeratorService.saveNumerator(input, dbContext);
  }

  public static async updateNumerator(
    _id: string,
    input: NumeratorInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<NumeratorModel> {
    return NumeratorService.saveNumerator(input, dbContext);
  }

  public static async deleteNumerator(
    id: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const { tur, yaziciId } = parseNumeratorId(id);
    const existing = await NumeratorSqlRepository.findByTurAndYazici(tur, yaziciId, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek numaratör tanımı bulunamadı.`);
    }

    return NumeratorSqlRepository.delete(tur, yaziciId, dbContext);
  }
}
