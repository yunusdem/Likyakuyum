import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { GibHesapDurumu, GibSqlRepository } from "../../models/admin/gibSql.repository.js";
import { AdminBaglam } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { EarsivPortalClient, GibPortalHatasi } from "../gib/earsivPortal.client.js";

/** Merkezi GİB hesabı: admin panelinden bir kez girilir, bütün firmalar VKN sorgusunda kullanır. Şifre hiçbir zaman geri dönmez. */
export class GibHesapService {
  public static durum(): Promise<GibHesapDurumu> {
    return GibSqlRepository.durum();
  }

  public static async kaydet(yapan: AdminBaglam, kullaniciKodu: string, sifre: string): Promise<GibHesapDurumu> {
    const eski = await GibSqlRepository.durum();
    await GibSqlRepository.hesapYaz(kullaniciKodu, sifre, yapan.adminId);
    EarsivPortalClient.oturumuBirak();
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "GIB_HESAP_DEGISTI",
      hedefTur: "GIB_HESAP",
      hedefId: 1,
      eski: eski.tanimli ? { kullaniciKodu: eski.kullaniciKodu } : null,
      yeni: { kullaniciKodu },
    });
    return GibSqlRepository.durum();
  }

  public static async sil(yapan: AdminBaglam): Promise<GibHesapDurumu> {
    const eski = await GibSqlRepository.durum();
    await GibSqlRepository.hesapSil();
    EarsivPortalClient.oturumuBirak();
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "GIB_HESAP_DEGISTI",
      hedefTur: "GIB_HESAP",
      hedefId: 1,
      eski: eski.tanimli ? { kullaniciKodu: eski.kullaniciKodu } : null,
      yeni: null,
    });
    return GibSqlRepository.durum();
  }

  /** "Bağlantıyı Dene": giriş + çıkış; sonuç hesaba işlenir. */
  public static async dene(): Promise<GibHesapDurumu> {
    const hesap = await GibSqlRepository.hesap();
    if (!hesap) throw ApiError.badRequest("Önce GİB kullanıcı kodu ve şifresini kaydedin.");
    try {
      await EarsivPortalClient.girisDene(hesap);
    } catch (err: any) {
      const mesaj = err instanceof GibPortalHatasi ? err.message : "GİB portalına giriş denenemedi.";
      await GibSqlRepository.girisSonucu(false, mesaj);
      throw new ApiError(
        err instanceof GibPortalHatasi && err.tur === "GIRIS" ? HttpStatus.BAD_REQUEST : HttpStatus.SERVICE_UNAVAILABLE,
        `GİB girişi başarısız: ${mesaj}`
      );
    }
    await GibSqlRepository.girisSonucu(true);
    return GibSqlRepository.durum();
  }
}
