import {
  KasaHesapSqlRepository,
  HesapModel,
  SaveHesapDto,
  HesapHareketiModel,
  SaveHesapHareketiDto,
} from "../models/kasaHesapSql.repository.js";
import { SarrafFisSqlRepository } from "../models/sarrafFisSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export class KasaService {
  // ─── Hesap Kartları ────────────────────────────────────────────────────────
  public static async listHesaplar(
    filter?: { search?: string; aktif?: boolean },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapModel[]> {
    return KasaHesapSqlRepository.listHesaplar(filter, dbContext);
  }

  public static async getHesapById(
    hesapId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapModel> {
    const item = await KasaHesapSqlRepository.getHesapById(hesapId, dbContext);
    if (!item) throw ApiError.notFound("Hesap kartı bulunamadı.");
    return item;
  }

  public static async saveHesap(
    dto: SaveHesapDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapModel> {
    if (!dto.ad || !dto.ad.trim()) {
      throw ApiError.badRequest("Hesap adı zorunludur.");
    }
    return KasaHesapSqlRepository.saveHesap(dto, dbContext);
  }

  public static async deleteHesap(
    hesapId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return KasaHesapSqlRepository.deleteHesap(hesapId, dbContext);
  }

  // ─── Hesap Hareketleri ─────────────────────────────────────────────────────
  public static async listHareketler(
    filter?: { hesapId?: number; vezneId?: number; search?: string; limit?: number },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapHareketiModel[]> {
    return KasaHesapSqlRepository.listHareketler(filter, dbContext);
  }

  public static async getHareketById(
    hesapHareketiId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapHareketiModel> {
    const item = await KasaHesapSqlRepository.getHareketById(hesapHareketiId, dbContext);
    if (!item) throw ApiError.notFound("Hesap hareketi bulunamadı.");
    return item;
  }

  public static async saveHareket(
    dto: SaveHesapHareketiDto,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<HesapHareketiModel> {
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

  public static async deleteHareket(
    hesapHareketiId: number,
    kullaniciId?: number,
    degisiklikTakipVar?: boolean,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return KasaHesapSqlRepository.deleteHareket(hesapHareketiId, kullaniciId, degisiklikTakipVar, dbContext);
  }

  // ─── Lookups ───────────────────────────────────────────────────────────────
  public static async getLookups(dbContext?: { dbServer?: string; dbName?: string }) {
    return KasaHesapSqlRepository.getLookups(dbContext);
  }

  public static async getUserVezneId(
    kullaniciId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<number | null> {
    return SarrafFisSqlRepository.getUserVezneId(kullaniciId, dbContext);
  }
}
