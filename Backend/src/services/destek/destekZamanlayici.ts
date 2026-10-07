import { adminYapilandirildiMi } from "../../config/adminDb.config.js";
import { env } from "../../config/env.config.js";
import { logger } from "../../utils/logger.js";
import { bugunTr } from "../../utils/zaman.utils.js";
import { DestekOlay } from "./destekOlay.js";

/**
 * Destek zamanlayıcısı (yol haritası §5): merkez sunucuda 10 dakikada bir uyanır, günde bir kez lisans taraması yapar
 * (30 / 7 gün kala ve bitince; lisans başına bir kez). Kurulum (exe) modunda ve admin DB yokken çalışmaz.
 */
const KONTROL_ARALIGI_MS = 10 * 60 * 1000;
const ILK_GECIKME_MS = 45_000;

let zamanlayici: NodeJS.Timeout | null = null;
let sonTaramaGunu = "";
let calisiyor = false;

export class DestekZamanlayici {
  /** Bir tur; `zorla` yalnız testler içindir. */
  public static async tur(zorla = false): Promise<number | null> {
    if (calisiyor) return null;
    const gun = bugunTr();
    if (!zorla && sonTaramaGunu === gun) return null;
    calisiyor = true;
    try {
      const n = await DestekOlay.lisansTaramasi();
      sonTaramaGunu = gun;
      if (n) logger.info(`[DESTEK] Lisans taraması: ${n} bildirim yazıldı.`);
      return n;
    } catch (err: any) {
      logger.error(`[DESTEK] Lisans taraması yarıda kaldı: ${err?.message}`);
      return null;
    } finally {
      calisiyor = false;
    }
  }

  public static baslat(): void {
    if (env.KURULUM_MODU || !adminYapilandirildiMi() || zamanlayici) return;
    setTimeout(() => void this.tur(), ILK_GECIKME_MS).unref();
    zamanlayici = setInterval(() => void this.tur(), KONTROL_ARALIGI_MS);
    zamanlayici.unref();
  }

  public static durdur(): void {
    if (zamanlayici) clearInterval(zamanlayici);
    zamanlayici = null;
  }
}
