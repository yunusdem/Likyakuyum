import { adminYapilandirildiMi } from "../../config/adminDb.config.js";
import { BulutSqlRepository } from "../../models/admin/bulutSql.repository.js";
import { logger } from "../../utils/logger.js";
import { trZaman } from "../../utils/zaman.utils.js";
import { klonYapilandirildiMi } from "./klon.service.js";
import { SilmeService } from "./silme.service.js";
import { YedekService } from "./yedek.service.js";
/**
 * Bulut firmaların gece işleri (yalnız klonlama hesabı tanımlı ana sunucuda çalışır):
 * - Türkiye saatiyle 02:00-05:00 arasında, son yedeği 7 günden eski her bulut firması yedeklenir (haftalık, tek dosya).
 * - Aynı pencerede bekleme süresi dolan silmeler uygulanır ve saklama süresi dolan eski yedekler temizlenir.
 * Sunucu o gece kapalıysa iş, açık olduğu ilk gece yapılır.
 */
export const YEDEK_ARALIK_GUN = 7;
const KONTROL_ARALIGI_MS = 10 * 60 * 1000;
export const geceIsPenceresi = (z) => z.saat >= 2 && z.saat < 5;
let zamanlayici = null;
let calisiyor = false;
let sonSilmeGunu = "";
export class BulutZamanlayici {
    /** Bir tur: pencere dışındaysa hiçbir şey yapmaz. `zorla` yalnız testler içindir. */
    static async tur(zorla = false) {
        if (calisiyor)
            return null;
        const z = trZaman();
        if (!zorla && !geceIsPenceresi(z))
            return null;
        calisiyor = true;
        try {
            let silme;
            if (zorla || sonSilmeGunu !== z.gun) {
                silme = await SilmeService.gunlukIs();
                sonSilmeGunu = z.gun;
            }
            let yedeklenen = 0;
            let yedekHatasi = 0;
            for (const f of await BulutSqlRepository.yedeklenecekler(YEDEK_ARALIK_GUN)) {
                if (!zorla && !geceIsPenceresi(trZaman()))
                    break; // pencere kapandıysa kalanlar ertesi gece
                try {
                    await YedekService.yedekle(null, f.firmaId);
                    yedeklenen++;
                }
                catch {
                    yedekHatasi++; // ayrıntı işlem kaydında (YEDEK_ALINAMADI)
                }
            }
            if (yedeklenen || yedekHatasi || silme) {
                logger.info(`[BULUT] Gece işi: ${yedeklenen} yedek, ${yedekHatasi} hata, silme: ${JSON.stringify(silme ?? null)}`);
            }
            return { yedeklenen, yedekHatasi, silme };
        }
        catch (err) {
            logger.error(`[BULUT] Gece işi yarıda kaldı: ${err?.message}`);
            return null;
        }
        finally {
            calisiyor = false;
        }
    }
    static baslat() {
        if (zamanlayici)
            return;
        if (!klonYapilandirildiMi() || !adminYapilandirildiMi()) {
            logger.info("[BULUT] Klonlama hesabı veya admin veritabanı tanımlı değil; gece yedek/silme işi kapalı.");
            return;
        }
        zamanlayici = setInterval(() => void this.tur(), KONTROL_ARALIGI_MS);
        zamanlayici.unref();
        setTimeout(() => void this.tur(), 60_000).unref();
        logger.info("[BULUT] Gece yedek/silme zamanlayıcısı açık (Türkiye saatiyle 02:00-05:00).");
    }
}
