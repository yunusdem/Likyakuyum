import { BankaSqlRepository, } from "../models/bankaSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class BankaService {
    // ─── Banka Hesap Kartları ──────────────────────────────────────────────────
    static async listBankalar(filter, dbContext) {
        return BankaSqlRepository.listBankalar(filter, dbContext);
    }
    static async getBankaById(bankaId, dbContext) {
        const item = await BankaSqlRepository.getBankaById(bankaId, dbContext);
        if (!item)
            throw ApiError.notFound("Banka hesabı bulunamadı.");
        return item;
    }
    static async getNextHesapNo(dbContext) {
        return BankaSqlRepository.getNextHesapNo(dbContext);
    }
    static async saveBanka(dto, kullaniciId, dbContext) {
        if (!dto.hesapNo || !dto.hesapNo.trim()) {
            throw ApiError.badRequest("Hesap numarası zorunludur.");
        }
        if (!dto.hesapAdi || !dto.hesapAdi.trim()) {
            throw ApiError.badRequest("Hesap adı zorunludur.");
        }
        return BankaSqlRepository.saveBanka(dto, kullaniciId, dbContext);
    }
    static async deleteBanka(bankaId, kullaniciId, dbContext) {
        return BankaSqlRepository.deleteBanka(bankaId, kullaniciId, dbContext);
    }
    // ─── Banka Hesap Hareketleri ───────────────────────────────────────────────
    static async listHareketler(filter, dbContext) {
        return BankaSqlRepository.listHareketler(filter, dbContext);
    }
    static async getHareketById(bankaHareketId, dbContext) {
        const item = await BankaSqlRepository.getHareketById(bankaHareketId, dbContext);
        if (!item)
            throw ApiError.notFound("Banka hareketi bulunamadı.");
        return item;
    }
    static async saveHareket(dto, kullaniciId, dbContext) {
        if (!dto.bankaId || Number(dto.bankaId) <= 0) {
            throw ApiError.badRequest("Banka hesabı seçilmelidir.");
        }
        if (!dto.satirlar || dto.satirlar.length === 0) {
            throw ApiError.badRequest("En az bir hareket satırı (meblağ / para birimi) girilmelidir.");
        }
        return BankaSqlRepository.saveHareket(dto, kullaniciId, dbContext);
    }
    static async deleteHareket(bankaHareketId, kullaniciId, dbContext) {
        return BankaSqlRepository.deleteHareket(bankaHareketId, kullaniciId, dbContext);
    }
    static async toggleIptalHareket(bankaHareketId, iptal, kullaniciId, dbContext) {
        return BankaSqlRepository.toggleIptalHareket(bankaHareketId, iptal, kullaniciId, dbContext);
    }
    // ─── Lookups ───────────────────────────────────────────────────────────────
    static async getLookups(dbContext) {
        return BankaSqlRepository.getLookups(dbContext);
    }
}
