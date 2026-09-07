import { NumeratorSqlRepository } from "../models/numeratorSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export function parseNumeratorId(id) {
    if (!id) {
        throw ApiError.badRequest("Geçersiz numaratör anahtarı.");
    }
    const parts = id.split("_");
    const tur = parseInt(parts[0], 10);
    if (isNaN(tur)) {
        throw ApiError.badRequest("Geçersiz belge türü.");
    }
    const yaziciId = parts[1] === "null" || parts[1] === "" || parts[1] === undefined ? null : parseInt(parts[1], 10);
    return { tur, yaziciId: isNaN(yaziciId) ? null : yaziciId };
}
export class NumeratorService {
    static async listNumerators(dbContext) {
        return NumeratorSqlRepository.findAll(dbContext);
    }
    static async getNumeratorById(id, dbContext) {
        const { tur, yaziciId } = parseNumeratorId(id);
        const item = await NumeratorSqlRepository.findByTurAndYazici(tur, yaziciId, dbContext);
        if (!item) {
            throw ApiError.notFound(`Numaratör tanımı bulunamadı.`);
        }
        return item;
    }
    static async saveNumerator(input, dbContext) {
        const tur = typeof input.tur === "number" ? input.tur : parseInt(String(input.tur), 10);
        if (isNaN(tur)) {
            throw ApiError.badRequest("Belge türü (TUR) zorunludur.");
        }
        const yaziciId = input.yaziciId !== undefined && input.yaziciId !== null && String(input.yaziciId) !== "" && parseInt(String(input.yaziciId), 10) !== 0
            ? parseInt(String(input.yaziciId), 10)
            : null;
        return NumeratorSqlRepository.saveViaProcedure({
            ...input,
            tur,
            yaziciId,
            onek: input.onek ? input.onek.trim().slice(0, 50) : null,
        }, dbContext);
    }
    static async createNumerator(input, dbContext) {
        return NumeratorService.saveNumerator(input, dbContext);
    }
    static async updateNumerator(_id, input, dbContext) {
        return NumeratorService.saveNumerator(input, dbContext);
    }
    static async deleteNumerator(id, dbContext) {
        const { tur, yaziciId } = parseNumeratorId(id);
        const existing = await NumeratorSqlRepository.findByTurAndYazici(tur, yaziciId, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Silinecek numaratör tanımı bulunamadı.`);
        }
        return NumeratorSqlRepository.delete(tur, yaziciId, dbContext);
    }
}
