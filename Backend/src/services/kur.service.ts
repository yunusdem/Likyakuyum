import {
  KurSqlRepository,
  KurTablosuModel,
  SaveKurTablosuDto,
} from "../models/kurSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export class KurService {
  public static async getTablo(
    params: {
      tur: number;
      tarih?: string;
      id?: number;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<KurTablosuModel | null> {
    if (params.tur === undefined || isNaN(params.tur)) {
      throw ApiError.badRequest("Geçerli bir kur türü (TUR) belirtilmelidir.");
    }
    return KurSqlRepository.findTablo(params, dbContext);
  }

  public static async saveTablo(
    dto: SaveKurTablosuDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<KurTablosuModel> {
    if (dto.tur === undefined || isNaN(dto.tur)) {
      throw ApiError.badRequest("Geçerli bir kur türü (TUR) belirtilmelidir.");
    }
    return KurSqlRepository.saveViaProcedure(dto, dbContext);
  }

  public static async sakla(
    params: {
      kaynakKurTablosuId: number;
      targetTur?: number;
      zaman?: string;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<KurTablosuModel> {
    if (!params.kaynakKurTablosuId) {
      throw ApiError.badRequest("Saklanacak kaynak kur tablosu seçilmelidir.");
    }
    const targetTur = params.targetTur !== undefined ? params.targetTur : 2;
    return KurSqlRepository.sakla(params.kaynakKurTablosuId, targetTur, params.zaman, dbContext);
  }

  public static async getStoredDates(
    tur: number = 2,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ id: number; tarih: string; zaman: string }[]> {
    return KurSqlRepository.getStoredDates(tur, dbContext);
  }

  public static async deleteTablo(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    if (!id) {
      throw ApiError.badRequest("Silinecek kur tablosu ID belirtilmelidir.");
    }
    return KurSqlRepository.deleteKurTablosu(id, dbContext);
  }

  /**
   * Fetch live / official rates from TCMB XML feed
   */
  public static async fetchTcmbRates(): Promise<
    Record<
      string,
      {
        forexBuying?: number;
        forexSelling?: number;
        banknoteBuying?: number;
        banknoteSelling?: number;
      }
    >
  > {
    try {
      const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`TCMB isteği başarısız: HTTP ${response.status}`);
      }

      const xmlText = await response.text();
      const rates: Record<
        string,
        {
          forexBuying?: number;
          forexSelling?: number;
          banknoteBuying?: number;
          banknoteSelling?: number;
        }
      > = {};

      const currencyRegex = /<Currency\s+CrossOrder="[^"]*"\s+Kod="([^"]+)"\s+CurrencyCode="([^"]+)">([\s\S]*?)<\/Currency>/g;
      let match: RegExpExecArray | null;

      while ((match = currencyRegex.exec(xmlText)) !== null) {
        const code = match[1];
        const content = match[3];

        const parseTag = (tag: string): number | undefined => {
          const m = new RegExp(`<${tag}>([^<]+)<\/${tag}>`).exec(content);
          if (m && m[1] && m[1].trim()) {
            const val = parseFloat(m[1].replace(",", "."));
            return isNaN(val) ? undefined : val;
          }
          return undefined;
        };

        rates[code] = {
          forexBuying: parseTag("ForexBuying"),
          forexSelling: parseTag("ForexSelling"),
          banknoteBuying: parseTag("BanknoteBuying"),
          banknoteSelling: parseTag("BanknoteSelling"),
        };
      }

      return rates;
    } catch (err: any) {
      logger.warn("KurService.fetchTcmbRates error:", err?.message || err);
      // Return empty object on error
      return {};
    }
  }
}
