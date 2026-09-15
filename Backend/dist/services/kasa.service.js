import { KasaHesapSqlRepository, } from "../models/kasaHesapSql.repository.js";
import { SarrafFisSqlRepository } from "../models/sarrafFisSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class KasaService {
    // ─── Hesap Kartları ────────────────────────────────────────────────────────
    static async listHesaplar(filter, dbContext) {
        return KasaHesapSqlRepository.listHesaplar(filter, dbContext);
    }
    static async getHesapById(hesapId, dbContext) {
        const item = await KasaHesapSqlRepository.getHesapById(hesapId, dbContext);
        if (!item)
            throw ApiError.notFound("Hesap kartı bulunamadı.");
        return item;
    }
    static async saveHesap(dto, dbContext) {
        if (!dto.ad || !dto.ad.trim()) {
            throw ApiError.badRequest("Hesap adı zorunludur.");
        }
        return KasaHesapSqlRepository.saveHesap(dto, dbContext);
    }
    static async deleteHesap(hesapId, dbContext) {
        return KasaHesapSqlRepository.deleteHesap(hesapId, dbContext);
    }
    // ─── Hesap Hareketleri ─────────────────────────────────────────────────────
    static async listHareketler(filter, dbContext) {
        return KasaHesapSqlRepository.listHareketler(filter, dbContext);
    }
    static async getHareketById(hesapHareketiId, dbContext) {
        const item = await KasaHesapSqlRepository.getHareketById(hesapHareketiId, dbContext);
        if (!item)
            throw ApiError.notFound("Hesap hareketi bulunamadı.");
        return item;
    }
    static async saveHareket(dto, kullaniciId, dbContext) {
        if (!dto.hesapId || Number(dto.hesapId) <= 0) {
            throw ApiError.badRequest("Lütfen bir hesap kartı seçiniz.");
        }
        if (!dto.vezneId || Number(dto.vezneId) <= 0) {
            throw ApiError.badRequest("Lütfen çıkış yapılacak vezneyi seçiniz.");
        }
        if (!dto.paraId || Number(dto.paraId) <= 0) {
            throw ApiError.badRequest("Lütfen para/gramaj birimini seçiniz.");
        }
        if (!dto.meblag || Number(dto.meblag) <= 0) {
            throw ApiError.badRequest("Lütfen geçerli bir gramaj/meblağ giriniz.");
        }
        return KasaHesapSqlRepository.saveHareket(dto, kullaniciId, dbContext);
    }
    static async deleteHareket(hesapHareketiId, kullaniciId, degisiklikTakipVar, dbContext) {
        return KasaHesapSqlRepository.deleteHareket(hesapHareketiId, kullaniciId, degisiklikTakipVar, dbContext);
    }
    // ─── Lookups ───────────────────────────────────────────────────────────────
    static async getLookups(dbContext) {
        return KasaHesapSqlRepository.getLookups(dbContext);
    }
    static async getUserVezneId(kullaniciId, dbContext) {
        return SarrafFisSqlRepository.getUserVezneId(kullaniciId, dbContext);
    }
}
