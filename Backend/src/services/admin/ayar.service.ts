import { AYAR_ANAHTARLARI, AyarAnahtari, AyarSqlRepository } from "../../models/admin/ayarSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { AdminBaglam } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { lisansImzaAcikMi } from "./lisansKod.service.js";
import { klonYapilandirildiMi } from "./klon.service.js";

/** Panel > Ayarlar: lisans kilit ekranındaki iletişim bilgisi ve klasörler (K17). */
export class AyarService {
  public static async getir() {
    return {
      ayarlar: await AyarSqlRepository.tumu(),
      durum: { lisansImzaAcik: lisansImzaAcikMi(), klonAcik: klonYapilandirildiMi() },
    };
  }

  public static async kaydet(yapan: AdminBaglam, girdi: Partial<Record<AyarAnahtari, string>>) {
    const eski = await AyarSqlRepository.tumu();
    const degisen: Record<string, { eski: string; yeni: string }> = {};
    for (const k of AYAR_ANAHTARLARI) {
      const v = girdi[k];
      if (v === undefined) continue;
      const yeni = String(v).trim();
      if ((k === "YEDEK_KLASORU" || k === "SURUM_KLASORU") && !/^[A-Za-z]:\\/.test(yeni)) {
        throw ApiError.badRequest(`${k}: tam klasör yolu yazın (ör. C:\\LikyaYedek).`);
      }
      if (k === "SABLON_YEDEK_DOSYASI" && !/^[A-Za-z]:\\.+\.bak$/i.test(yeni)) {
        throw ApiError.badRequest("Şablon yedek dosyası .bak uzantılı tam yol olmalıdır.");
      }
      if (yeni !== eski[k]) {
        await AyarSqlRepository.yaz(k, yeni, yapan.adminId);
        degisen[k] = { eski: eski[k], yeni };
      }
    }
    if (Object.keys(degisen).length) {
      await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "AYAR_DEGISTI", hedefTur: "AYAR", yeni: degisen });
    }
    return this.getir();
  }
}
