import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.config.js";
import { adminYapilandirildiMi, adminYapilandirmaHatasi } from "../../config/adminDb.config.js";
import { AdminSqlRepository } from "../../models/admin/adminSql.repository.js";
import { AdminOturumSqlRepository } from "../../models/admin/adminOturumSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { AdminBaglam, AdminDto, AdminJwtPayload, AdminKayit } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { sahteSifreDogrula, sifreDogrula, sifreHashle, sifreKuralHatasi } from "../../utils/sifre.utils.js";

export const adminDto = (a: AdminKayit): AdminDto => {
  const { sifreHash: _sifreHash, ...dto } = a;
  return dto;
};

export const adminTokenUret = (payload: Omit<AdminJwtPayload, "iat" | "exp">): string => {
  const options: SignOptions = { expiresIn: env.ADMIN_JWT_EXPIRES_IN as any };
  return jwt.sign(payload, env.ADMIN_JWT_SECRET, options);
};

export const adminTokenDogrula = (token: string): AdminJwtPayload => {
  if (!adminYapilandirildiMi()) throw adminYapilandirmaHatasi();
  const payload = jwt.verify(token, env.ADMIN_JWT_SECRET) as AdminJwtPayload;
  if (payload?.tur !== "ADMIN" || !payload.sid || !payload.adminId) {
    throw ApiError.unauthorized("Geçersiz admin oturumu.");
  }
  return payload;
};

const GIRIS_HATASI = "Kullanıcı adı veya şifre hatalı.";

export class AdminAuthService {
  public static async giris(
    girdi: { kullaniciAdi: string; sifre: string },
    istemci: { ip: string; tarayici: string }
  ): Promise<{ token: string; admin: AdminDto }> {
    const kullaniciAdi = girdi.kullaniciAdi.trim().toLowerCase();
    const admin = await AdminSqlRepository.kullaniciAdiIleBul(kullaniciAdi);

    const reddet = async (neden: string): Promise<never> => {
      await AdminLogSqlRepository.girisLogu({ tur: "ADMIN", kullaniciAdi, basarili: false, redNedeni: neden, ...istemci });
      // Neden istemciye söylenmez: hesabın var olup olmadığı anlaşılmasın.
      throw ApiError.unauthorized(GIRIS_HATASI);
    };

    if (!admin) {
      await sahteSifreDogrula(girdi.sifre);
      return reddet("Admin bulunamadı");
    }
    const sifreDogru = await sifreDogrula(girdi.sifre, admin.sifreHash);
    if (!sifreDogru) return reddet("Şifre hatalı");
    if (admin.durum !== "AKTIF") return reddet("Admin pasif");

    const sid = await AdminOturumSqlRepository.ac(admin.adminId, istemci.ip, istemci.tarayici);
    await AdminSqlRepository.sonGirisYaz(admin.adminId);
    await AdminLogSqlRepository.girisLogu({ tur: "ADMIN", kullaniciAdi, basarili: true, ...istemci });

    const token = adminTokenUret({ tur: "ADMIN", adminId: admin.adminId, kullaniciAdi: admin.kullaniciAdi, sid });
    return { token, admin: adminDto(admin) };
  }

  public static async cikis(sid: string): Promise<void> {
    await AdminOturumSqlRepository.kapat(sid);
  }

  public static async profil(adminId: number): Promise<AdminDto> {
    const admin = await AdminSqlRepository.idIleBul(adminId);
    if (!admin) throw ApiError.unauthorized("Admin bulunamadı.");
    return adminDto(admin);
  }

  /** Adminin kendi şifresini değiştirmesi; ilk girişteki zorunlu şifre belirleme de buradan geçer. */
  public static async sifreDegistir(
    baglam: AdminBaglam,
    girdi: { mevcutSifre: string; yeniSifre: string }
  ): Promise<void> {
    const admin = await AdminSqlRepository.idIleBul(baglam.adminId);
    if (!admin) throw ApiError.unauthorized("Admin bulunamadı.");

    if (!(await sifreDogrula(girdi.mevcutSifre, admin.sifreHash))) {
      throw ApiError.badRequest("Mevcut şifre hatalı.");
    }
    const kuralHatasi = sifreKuralHatasi(girdi.yeniSifre);
    if (kuralHatasi) throw ApiError.badRequest(kuralHatasi);
    if (girdi.yeniSifre === girdi.mevcutSifre) {
      throw ApiError.badRequest("Yeni şifre mevcut şifreyle aynı olamaz.");
    }

    await AdminSqlRepository.sifreGuncelle(admin.adminId, await sifreHashle(girdi.yeniSifre), false);
    // Başka yerde açık kalmış oturum varsa düşsün; bu oturum devam eder.
    await AdminOturumSqlRepository.adminOturumlariniIptalEt(admin.adminId, admin.adminId, baglam.sid);
    await AdminLogSqlRepository.islemLogu({
      adminId: admin.adminId,
      islem: "ADMIN_SIFRE_DEGISTI",
      hedefTur: "ADMIN",
      hedefId: admin.adminId,
    });
  }
}
