import { CariSqlRepository, CariKartModel, CariKartInputDto } from "../models/cariSql.repository.js";
import { CariFotografSqlRepository, CariFotografModel } from "../models/cariFotografSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

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

    try {
      const foto = await CariFotografSqlRepository.getByCariKartId(item.id, dbContext);
      if (foto) {
        item.fotograf = foto;
        item.fotografId = foto.fotografId;
      }
    } catch (fotoErr) {
      logger.warn(`[CariService.getCariKartById] Fotoğraf getirme uyarısı: ${fotoErr}`);
    }

    return item;
  }

  public static async createCariKart(
    input: CariKartInputDto,
    dbContext?: { dbServer?: string; dbName?: string },
    kullaniciId?: number
  ): Promise<CariKartModel> {
    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Cari ünvan / ad bilgisi zorunludur.");
    }

    const trimmedCode = (input.kod || "").trim().slice(0, 20);

    const created = await CariSqlRepository.create(
      {
        ...input,
        kod: trimmedCode,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );

    // Eğer oluşturma sırasında kimlik/pasaport/vergi levhası fotoğrafı iletilmişse SQL Server'a kaydet
    if (input.fotografData && input.fotografData.base64 && created.id) {
      try {
        const foto = await CariFotografSqlRepository.saveFotograf(
          {
            cariKartId: created.id,
            base64: input.fotografData.base64,
            belgeTuru: input.fotografData.belgeTuru ?? input.kimlikBelgeTuru ?? 0,
            dosyaAdi: input.fotografData.dosyaAdi,
            mimeTipi: input.fotografData.mimeTipi,
          },
          kullaniciId,
          dbContext
        );
        created.fotograf = foto;
        created.fotografId = foto.fotografId;
      } catch (fotoErr: any) {
        logger.error(`[CariService.createCariKart] Fotoğraf kaydetme hatası: ${fotoErr.message}`);
      }
    }

    return created;
  }

  public static async updateCariKart(
    id: number | string,
    input: CariKartInputDto,
    dbContext?: { dbServer?: string; dbName?: string },
    kullaniciId?: number
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

    // Eğer güncelleme sırasında yeni fotoğraf iletilmişse SQL Server'a kaydet
    if (input.fotografData && input.fotografData.base64) {
      try {
        const foto = await CariFotografSqlRepository.saveFotograf(
          {
            cariKartId: Number(id),
            base64: input.fotografData.base64,
            belgeTuru: input.fotografData.belgeTuru ?? input.kimlikBelgeTuru ?? 0,
            dosyaAdi: input.fotografData.dosyaAdi,
            mimeTipi: input.fotografData.mimeTipi,
          },
          kullaniciId,
          dbContext
        );
        updated.fotograf = foto;
        updated.fotografId = foto.fotografId;
      } catch (fotoErr: any) {
        logger.error(`[CariService.updateCariKart] Fotoğraf güncelleme hatası: ${fotoErr.message}`);
      }
    } else {
      try {
        const foto = await CariFotografSqlRepository.getByCariKartId(Number(id), dbContext);
        if (foto) {
          updated.fotograf = foto;
          updated.fotografId = foto.fotografId;
        }
      } catch {}
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

    // İlişkili fotoğrafı temizle
    try {
      await CariFotografSqlRepository.deleteFotograf(id, undefined, dbContext);
    } catch {}

    return CariSqlRepository.delete(id, dbContext);
  }

  // ─── Fotoğraf Özel Metodları (TODVZ_FOTOGRAF & SODVZ_FOTOGRAF_KAYDET) ───────

  public static async getCariFotograf(
    cariKartId: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariFotografModel | null> {
    return CariFotografSqlRepository.getByCariKartId(cariKartId, dbContext);
  }

  public static async getAllCariFotograflar(
    cariKartId: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariFotografModel[]> {
    return CariFotografSqlRepository.getAllByCariKartId(cariKartId, dbContext);
  }

  public static async saveCariFotograf(
    cariKartId: number | string,
    data: { base64: string; belgeTuru?: number; dosyaAdi?: string; mimeTipi?: string },
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariFotografModel> {
    return CariFotografSqlRepository.saveFotograf(
      {
        cariKartId: Number(cariKartId),
        base64: data.base64,
        belgeTuru: data.belgeTuru,
        dosyaAdi: data.dosyaAdi,
        mimeTipi: data.mimeTipi,
      },
      kullaniciId,
      dbContext
    );
  }

  public static async deleteCariFotograf(
    cariKartId: number | string,
    fotografId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return CariFotografSqlRepository.deleteFotograf(cariKartId, fotografId, dbContext);
  }
}
