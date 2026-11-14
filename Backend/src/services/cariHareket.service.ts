import {
  CariHareketSqlRepository,
  CariHareketModel,
  CariHareketInputDto,
  CariBakiyeSummary,
} from "../models/cariHareketSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { FisDurbunFiltre, bellekteSuz, gunEkle } from "../utils/fisDurbunFiltre.js";

export class CariHareketService {
  public static async list(
    filters?: {
      startDate?: string;
      endDate?: string;
      cariKartId?: number;
      vezneId?: number;
      tip?: number;
      hareketTipi?: number;
      search?: string;
      onlyCariHareket?: boolean;
      kaynak?: string;
      onlyOwnRecords?: boolean;
      userId?: number;
      userVezneId?: number;
      cariSinirlamaTipi?: number;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel[]> {
    return CariHareketSqlRepository.findAll(filters, dbContext);
  }

  /**
   * Dürbün (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4, §5). Liste birden çok kaynağın (cari hareket, sarraf / döviz /
   * perakende fişi) birleşimi; tarih, vezne ve Borç / Alacak SQL'e gider, ürün (para), tutar (satır meblağı), cari ve belge no
   * (kayıt no / açıklamadaki fiş no) bellekte aynı filtreyle süzülür. Bitiş günü SQL'e bir gün geniş verilip bellekte kırpılır
   * (findAll bitişi yerel 23:59'a çeker, sürücü UTC gönderdiği için gün sonundaki kayıtlar kaçardı).
   */
  public static async durbunListesi(
    filters: Parameters<typeof CariHareketService.list>[0] & {},
    durbun: FisDurbunFiltre,
    limit: number | undefined,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel[]> {
    const f = { ...filters };
    if (durbun.tarihBas) f.startDate = [f.startDate ? String(f.startDate).slice(0, 10) : "", durbun.tarihBas].filter(Boolean).sort().pop();
    if (durbun.tarihBit) f.endDate = gunEkle(durbun.tarihBit, 1);
    if (durbun.vezneId) f.vezneId = durbun.vezneId;
    if (durbun.tip === "0" || durbun.tip === "1") f.tip = Number(durbun.tip);
    const liste = await CariHareketSqlRepository.findAll(f, dbContext);
    const suzulmus = bellekteSuz(liste, durbun, {
      tarih: (x) => x.tarih,
      vezne: (x) => [x.vezneId],
      urunler: (x) => (x.satirlar || []).map((s) => s.paraId),
      tip: (x) => x.tip,
      cari: (x) => [x.cariKod, x.cariAd],
      tutarlar: (x) => (x.satirlar || []).map((s) => Math.abs(Number(s.meblag) || 0)),
      belgeNo: (x) => [x.id, x.aciklama],
    });
    return limit && limit > 0 ? suzulmus.slice(0, limit) : suzulmus;
  }

  public static async getById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel> {
    const item = await CariHareketSqlRepository.findById(id, dbContext);
    if (!item) {
      throw ApiError.notFound(`Cari hareket (ID: ${id}) bulunamadı.`);
    }
    return item;
  }

  public static async create(
    input: CariHareketInputDto,
    userId: number = 1,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel> {
    if (!input.cariKartId) {
      throw ApiError.badRequest("Cari kart seçimi zorunludur.");
    }
    if (!input.vezneId) {
      throw ApiError.badRequest("Vezne seçimi zorunludur.");
    }
    if (!input.satirlar || input.satirlar.length === 0) {
      throw ApiError.badRequest("En az bir hareket satırı (para birimi ve meblağ) girilmelidir.");
    }

    const validLines = input.satirlar.filter((s) => s.paraId && Number(s.meblag) > 0);
    if (validLines.length === 0) {
      throw ApiError.badRequest("Geçerli bir para birimi ve pozitif bir meblağ girilmelidir.");
    }

    return CariHareketSqlRepository.create(
      {
        ...input,
        satirlar: validLines,
      },
      userId,
      dbContext
    );
  }

  public static async update(
    id: number | string,
    input: CariHareketInputDto,
    userId: number = 1,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel> {
    const existing = await CariHareketSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Güncellenecek cari hareket (ID: ${id}) bulunamadı.`);
    }

    if (!input.cariKartId) {
      throw ApiError.badRequest("Cari kart seçimi zorunludur.");
    }
    if (!input.vezneId) {
      throw ApiError.badRequest("Vezne seçimi zorunludur.");
    }
    if (!input.satirlar || input.satirlar.length === 0) {
      throw ApiError.badRequest("En az bir hareket satırı girilmelidir.");
    }

    const validLines = input.satirlar.filter((s) => s.paraId && Number(s.meblag) > 0);
    if (validLines.length === 0) {
      throw ApiError.badRequest("Geçerli bir para birimi ve pozitif bir meblağ girilmelidir.");
    }

    return CariHareketSqlRepository.update(
      id,
      {
        ...input,
        satirlar: validLines,
      },
      userId,
      dbContext
    );
  }

  public static async delete(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const existing = await CariHareketSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek cari hareket (ID: ${id}) bulunamadı.`);
    }
    return CariHareketSqlRepository.delete(id, dbContext);
  }

  public static async getNavigation(
    currentId?: number | string,
    dbContext?: { dbServer?: string; dbName?: string },
    baslangic?: string | null,
    userFilter?: { userId: number; userVezneId?: number }
  ) {
    return CariHareketSqlRepository.getNavigationIds(currentId, dbContext, baslangic, userFilter);
  }

  public static async getCariBakiye(
    cariKartId: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariBakiyeSummary> {
    if (!cariKartId) {
      throw ApiError.badRequest("Cari kart ID belirtilmelidir.");
    }
    return CariHareketSqlRepository.getCariBakiye(cariKartId, dbContext);
  }
}
