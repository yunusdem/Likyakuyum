import { KurSqlRepository, } from "../models/kurSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
export class KurService {
    static async getTablo(params, dbContext) {
        if (params.tur === undefined || isNaN(params.tur)) {
            throw ApiError.badRequest("Geçerli bir kur türü (TUR) belirtilmelidir.");
        }
        return KurSqlRepository.findTablo(params, dbContext);
    }
    static async saveTablo(dto, dbContext) {
        if (dto.tur === undefined || isNaN(dto.tur)) {
            throw ApiError.badRequest("Geçerli bir kur türü (TUR) belirtilmelidir.");
        }
        return KurSqlRepository.saveViaProcedure(dto, dbContext);
    }
    static async sakla(params, dbContext) {
        if (!params.kaynakKurTablosuId) {
            throw ApiError.badRequest("Saklanacak kaynak kur tablosu seçilmelidir.");
        }
        const targetTur = params.targetTur !== undefined ? params.targetTur : 2;
        return KurSqlRepository.sakla(params.kaynakKurTablosuId, targetTur, params.zaman, dbContext);
    }
    static async getStoredDates(tur = 2, dbContext) {
        return KurSqlRepository.getStoredDates(tur, dbContext);
    }
    static async deleteTablo(id, dbContext) {
        if (!id) {
            throw ApiError.badRequest("Silinecek kur tablosu ID belirtilmelidir.");
        }
        return KurSqlRepository.deleteKurTablosu(id, dbContext);
    }
    /**
     * Fetch live / official rates from TCMB XML feed
     */
    static async fetchTcmbRates() {
        try {
            const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                throw new Error(`TCMB isteği başarısız: HTTP ${response.status}`);
            }
            const xmlText = await response.text();
            const rates = {};
            const currencyRegex = /<Currency\s+CrossOrder="[^"]*"\s+Kod="([^"]+)"\s+CurrencyCode="([^"]+)">([\s\S]*?)<\/Currency>/g;
            let match;
            while ((match = currencyRegex.exec(xmlText)) !== null) {
                const code = match[1];
                const content = match[3];
                const parseTag = (tag) => {
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
        }
        catch (err) {
            logger.warn("KurService.fetchTcmbRates error:", err?.message || err);
            // Return empty object on error
            return {};
        }
    }
}
