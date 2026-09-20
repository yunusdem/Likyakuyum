import { AdminSqlRepository, benzersizIhlalMi } from "../../models/admin/adminSql.repository.js";
import { AdminOturumSqlRepository } from "../../models/admin/adminOturumSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { AdminBaglam, AdminDto, AdminDurum, AZAMI_AKTIF_ADMIN } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { geciciSifreUret, sifreHashle } from "../../utils/sifre.utils.js";
import { adminDto } from "./adminAuth.service.js";

/** Adminlerin birbirini yönetmesi. Tüm adminler tam yetkilidir; silme yoktur, pasife alma vardır. */
export class AdminYonetimService {
  public static async listele(): Promise<{ adminler: AdminDto[]; azamiAktif: number }> {
    const adminler = await AdminSqlRepository.listele();
    return { adminler: adminler.map(adminDto), azamiAktif: AZAMI_AKTIF_ADMIN };
  }

  /** Yeni admin açar; geçici şifre yalnızca bu yanıtta, bir kez döner. */
  public static async ekle(
    yapan: AdminBaglam,
    girdi: { kullaniciAdi: string; adSoyad: string }
  ): Promise<{ admin: AdminDto; geciciSifre: string }> {
    // Kullanıcı adları küçük harfle saklanır (şema kuralı ASCII olduğundan toLowerCase dilden bağımsızdır)
    const kullaniciAdi = girdi.kullaniciAdi.trim().toLowerCase();
    const adSoyad = girdi.adSoyad.trim();
    const geciciSifre = geciciSifreUret();

    let adminId: number | null;
    try {
      adminId = await AdminSqlRepository.ekle({
        kullaniciAdi,
        adSoyad,
        sifreHash: await sifreHashle(geciciSifre),
        olusturanAdminId: yapan.adminId,
      });
    } catch (err) {
      if (benzersizIhlalMi(err)) throw ApiError.conflict("Bu kullanıcı adıyla bir admin zaten var.");
      throw err;
    }
    if (adminId === null) {
      throw ApiError.conflict(
        `En fazla ${AZAMI_AKTIF_ADMIN} aktif admin olabilir. Yeni admin açmak için önce birini pasife alın.`
      );
    }

    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "ADMIN_EKLENDI",
      hedefTur: "ADMIN",
      hedefId: adminId,
      yeni: { kullaniciAdi, adSoyad },
    });

    const admin = await AdminSqlRepository.idIleBul(adminId);
    return { admin: adminDto(admin!), geciciSifre };
  }

  public static async guncelle(
    yapan: AdminBaglam,
    adminId: number,
    girdi: { adSoyad?: string; durum?: AdminDurum }
  ): Promise<AdminDto> {
    const hedef = await AdminSqlRepository.idIleBul(adminId);
    if (!hedef) throw ApiError.notFound("Admin bulunamadı.");

    if (girdi.adSoyad !== undefined && girdi.adSoyad.trim() !== hedef.adSoyad) {
      await AdminSqlRepository.adSoyadGuncelle(adminId, girdi.adSoyad.trim());
      await AdminLogSqlRepository.islemLogu({
        adminId: yapan.adminId,
        islem: "ADMIN_GUNCELLENDI",
        hedefTur: "ADMIN",
        hedefId: adminId,
        eski: { adSoyad: hedef.adSoyad },
        yeni: { adSoyad: girdi.adSoyad.trim() },
      });
    }

    if (girdi.durum !== undefined && girdi.durum !== hedef.durum) {
      if (adminId === yapan.adminId) {
        throw ApiError.badRequest("Kendi hesabınızın durumunu değiştiremezsiniz.");
      }
      const sonuc = await AdminSqlRepository.durumDegistir(adminId, girdi.durum);
      if (sonuc === "YOK") throw ApiError.notFound("Admin bulunamadı.");
      if (sonuc === "LIMIT") {
        throw ApiError.conflict(`En fazla ${AZAMI_AKTIF_ADMIN} aktif admin olabilir.`);
      }
      if (sonuc === "SON_AKTIF") throw ApiError.conflict("Son aktif admin pasife alınamaz.");

      if (girdi.durum === "PASIF") {
        await AdminOturumSqlRepository.adminOturumlariniIptalEt(adminId, yapan.adminId);
      }
      await AdminLogSqlRepository.islemLogu({
        adminId: yapan.adminId,
        islem: "ADMIN_DURUM",
        hedefTur: "ADMIN",
        hedefId: adminId,
        eski: { durum: hedef.durum },
        yeni: { durum: girdi.durum },
      });
    }

    return adminDto((await AdminSqlRepository.idIleBul(adminId))!);
  }

  /** Başka bir adminin şifresini sıfırlar; geçici şifre bir kez döner, hedefin oturumları düşer. */
  public static async sifreSifirla(yapan: AdminBaglam, adminId: number): Promise<{ geciciSifre: string }> {
    if (adminId === yapan.adminId) {
      throw ApiError.badRequest("Kendi şifrenizi 'Şifre Değiştir' ekranından değiştirin.");
    }
    const hedef = await AdminSqlRepository.idIleBul(adminId);
    if (!hedef) throw ApiError.notFound("Admin bulunamadı.");

    const geciciSifre = geciciSifreUret();
    await AdminSqlRepository.sifreGuncelle(adminId, await sifreHashle(geciciSifre), true);
    await AdminOturumSqlRepository.adminOturumlariniIptalEt(adminId, yapan.adminId);
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "ADMIN_SIFRE_SIFIRLANDI",
      hedefTur: "ADMIN",
      hedefId: adminId,
    });
    return { geciciSifre };
  }
}
