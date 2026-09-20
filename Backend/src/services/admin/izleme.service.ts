import { IzlemeSqlRepository } from "../../models/admin/izlemeSql.repository.js";
import { AdminOturumSqlRepository } from "../../models/admin/adminOturumSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { AdminBaglam } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { OturumService } from "../oturum.service.js";

/** Son kaç dakika içinde işlem yapan oturum "çevrimiçi" sayılır */
export const CEVRIMICI_DAKIKA = 5;

export class IzlemeService {
  public static async cevrimici() {
    return { dakika: CEVRIMICI_DAKIKA, oturumlar: await IzlemeSqlRepository.cevrimici(CEVRIMICI_DAKIKA) };
  }

  public static girisLoglari = IzlemeSqlRepository.girisLoglari;
  public static islemLoglari = IzlemeSqlRepository.islemLoglari;

  /** Tek bir oturumu kapatır; kullanıcı bir sonraki isteğinde giriş ekranına düşer. */
  public static async oturumuKapat(yapan: AdminBaglam, sid: string): Promise<void> {
    if (sid.toLowerCase() === yapan.sid.toLowerCase()) throw ApiError.badRequest("Kendi oturumunuzu 'Çıkış' ile kapatın.");
    let kapanan = await IzlemeSqlRepository.oturumlariIptalEt({ sid }, yapan.adminId);
    if (kapanan === 0) kapanan = await AdminOturumSqlRepository.sidIleIptalEt(sid, yapan.adminId);
    if (kapanan === 0) throw ApiError.notFound("Açık oturum bulunamadı.");
    OturumService.onbellegiTemizle();
    await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "OTURUM_KAPATILDI", hedefTur: "OTURUM", hedefId: sid });
  }

  public static async firmaOturumlariniKapat(yapan: AdminBaglam, firmaId: number): Promise<{ kapanan: number }> {
    if (!(await FirmaSqlRepository.idIleBul(firmaId))) throw ApiError.notFound("Firma bulunamadı.");
    const kapanan = await IzlemeSqlRepository.oturumlariIptalEt({ firmaId }, yapan.adminId);
    OturumService.onbellegiTemizle();
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "OTURUM_KAPATILDI",
      hedefTur: "FIRMA",
      hedefId: firmaId,
      yeni: { kapanan },
    });
    return { kapanan };
  }
}
