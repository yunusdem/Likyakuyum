import {
  BankaSqlRepository,
  BankaHesapModel,
  SaveBankaHesapDto,
  BankaHareketModel,
  SaveBankaHareketDto,
} from "../models/bankaSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export class BankaService {
  // ─── Banka Hesap Kartları ──────────────────────────────────────────────────
  public static async listBankalar(
    filter?: { search?: string; aktif?: boolean },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHesapModel[]> {
    return BankaSqlRepository.listBankalar(filter, dbContext);
  }

  public static async getBankaById(
    bankaId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHesapModel> {
    const item = await BankaSqlRepository.getBankaById(bankaId, dbContext);
    if (!item) throw ApiError.notFound("Banka hesabı bulunamadı.");
    return item;
  }

  public static async getNextHesapNo(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<string> {
    return BankaSqlRepository.getNextHesapNo(dbContext);
  }

  public static async saveBanka(
    dto: SaveBankaHesapDto,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHesapModel> {
    if (!dto.hesapNo || !dto.hesapNo.trim()) {
      throw ApiError.badRequest("Hesap numarası zorunludur.");
    }
    if (!dto.hesapAdi || !dto.hesapAdi.trim()) {
      throw ApiError.badRequest("Hesap adı zorunludur.");
    }
    return BankaSqlRepository.saveBanka(dto, kullaniciId, dbContext);
  }

  public static async deleteBanka(
    bankaId: number,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return BankaSqlRepository.deleteBanka(bankaId, kullaniciId, dbContext);
  }

  // ─── Banka Hesap Hareketleri ───────────────────────────────────────────────
  public static async listHareketler(
    filter?: {
      bankaId?: number;
      cariKartId?: number;
      vezneId?: number;
      islemTipi?: number;
      baslangicTarihi?: string;
      bitisTarihi?: string;
      search?: string;
      limit?: number;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHareketModel[]> {
    return BankaSqlRepository.listHareketler(filter, dbContext);
  }

  public static async getHareketById(
    bankaHareketId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHareketModel> {
    const item = await BankaSqlRepository.getHareketById(bankaHareketId, dbContext);
    if (!item) throw ApiError.notFound("Banka hareketi bulunamadı.");
    return item;
  }

  public static async saveHareket(
    dto: SaveBankaHareketDto,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHareketModel> {
    if (!dto.bankaId || Number(dto.bankaId) <= 0) {
      throw ApiError.badRequest("Banka hesabı seçilmelidir.");
    }
    if (!dto.satirlar || dto.satirlar.length === 0) {
      throw ApiError.badRequest("En az bir hareket satırı (meblağ / para birimi) girilmelidir.");
    }
    return BankaSqlRepository.saveHareket(dto, kullaniciId, dbContext);
  }

  public static async deleteHareket(
    bankaHareketId: number,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return BankaSqlRepository.deleteHareket(bankaHareketId, kullaniciId, dbContext);
  }

  public static async toggleIptalHareket(
    bankaHareketId: number,
    iptal: boolean,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return BankaSqlRepository.toggleIptalHareket(bankaHareketId, iptal, kullaniciId, dbContext);
  }

  // ─── Lookups ───────────────────────────────────────────────────────────────
  public static async getLookups(dbContext?: { dbServer?: string; dbName?: string }) {
    return BankaSqlRepository.getLookups(dbContext);
  }
}
