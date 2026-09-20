import { KullaniciSqlRepository } from "../../models/admin/kullaniciSql.repository.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { benzersizIhlalMi } from "../../models/admin/adminSql.repository.js";
import { UserSqlRepository } from "../../models/userSql.repository.js";
import { UserService } from "../user.service.js";
import {
  AdminBaglam,
  ESKI_SIFRE_ISARETI,
  KullaniciDurum,
  MerkezKullanici,
  MerkezKullaniciDto,
} from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { geciciSifreUret, sifreHashle } from "../../utils/sifre.utils.js";
import { hashPassword } from "../../utils/password.utils.js";
import { logger } from "../../utils/logger.js";
import { firmaDbContextHazirla, firmaDbIleCalistir } from "./firmaBaglanti.service.js";
import { IzlemeSqlRepository } from "../../models/admin/izlemeSql.repository.js";
import { OturumService } from "../oturum.service.js";

const dto = (k: MerkezKullanici): MerkezKullaniciDto => {
  const { sifreHash, ...gerisi } = k;
  return { ...gerisi, sifreTasindi: sifreHash !== ESKI_SIFRE_ISARETI };
};

const limitHatasi = (hata: "LIMIT" | "LISANS_YOK"): ApiError =>
  ApiError.conflict(
    hata === "LIMIT"
      ? "Firmanın lisansındaki kullanıcı limiti dolu. Önce lisanstaki limiti artırın."
      : "Firmaya lisans tanımlı değil."
  );

/** Yönetim panelinden firma kullanıcılarının yönetimi (ADM_KULLANICI + firma veritabanındaki TODVZ_KULLANICI). */
export class KullaniciService {
  public static async tumu(): Promise<MerkezKullaniciDto[]> {
    return (await KullaniciSqlRepository.tumu()).map(dto);
  }

  public static async firmaKullanicilari(firmaId: number): Promise<MerkezKullaniciDto[]> {
    return (await KullaniciSqlRepository.firmaKullanicilari(firmaId)).map(dto);
  }

  /**
   * Yeni kullanıcı: firma veritabanında TODVZ_KULLANICI satırı (varsayılan yetkilerle) + merkezde hesap.
   * Aynı adda satır firma veritabanında zaten varsa yenisi açılmaz, o satıra bağlanılır.
   * Geçici şifre yalnızca bu yanıtta, bir kez döner. Lisans tanımlıysa kullanıcı limiti admin için de geçerlidir.
   */
  public static async ekle(
    yapan: AdminBaglam,
    firmaId: number,
    girdi: { kullaniciAdi: string; adSoyad?: string | null; firmaYoneticisi?: boolean }
  ): Promise<{ kullanici: MerkezKullaniciDto; geciciSifre: string }> {
    const firma = await FirmaSqlRepository.idIleBul(firmaId);
    if (!firma) throw ApiError.notFound("Firma bulunamadı.");
    const kullaniciAdi = girdi.kullaniciAdi.trim();
    const firmaYoneticisi = !!girdi.firmaYoneticisi;

    if (await KullaniciSqlRepository.adIleBul(firmaId, kullaniciAdi)) {
      throw ApiError.conflict("Bu firmada aynı kullanıcı adıyla bir hesap zaten var.");
    }
    if (firma.aktifLisans && firma.kullaniciSayisi >= firma.aktifLisans.kullaniciLimiti) throw limitHatasi("LIMIT");

    const geciciSifre = geciciSifreUret();
    const dbContext = await firmaDbContextHazirla(firmaId);

    let dbKullanici = await UserSqlRepository.findByUsername(kullaniciAdi, dbContext);
    const dbdeYeniAcildi = !dbKullanici;
    if (dbKullanici) {
      await UserSqlRepository.updatePassword(dbKullanici.id, await hashPassword(geciciSifre), dbContext);
    } else {
      const yeni = await UserService.createUser(
        {
          username: kullaniciAdi,
          fullName: girdi.adSoyad?.trim() || kullaniciAdi,
          password: geciciSifre,
          isSysAdmin: firmaYoneticisi,
          role: firmaYoneticisi ? "admin" : "cashier",
        } as any,
        dbContext
      );
      dbKullanici = await UserSqlRepository.findById(yeni.id, dbContext);
    }

    const geriAl = async () => {
      if (!dbdeYeniAcildi || !dbKullanici) return;
      try {
        await UserSqlRepository.delete(dbKullanici.id, dbContext);
      } catch (err: any) {
        logger.error(`[ADMIN] Yarım kalan kullanıcı geri alınamadı (${kullaniciAdi}): ${err?.message}`);
      }
    };

    let kullaniciId: number;
    try {
      const sonuc = await KullaniciSqlRepository.ekle(
        {
          firmaId,
          kullaniciAdi,
          adSoyad: girdi.adSoyad?.trim() || null,
          sifreHash: await sifreHashle(geciciSifre),
          sifreDegismeli: true,
          firmaYoneticisi,
          firmaDbKullaniciId: dbKullanici ? Number(dbKullanici.id) : null,
          olusturan: `ADMIN:${yapan.kullaniciAdi}`,
        },
        !!firma.aktifLisans
      );
      if ("hata" in sonuc) {
        await geriAl();
        throw limitHatasi(sonuc.hata);
      }
      kullaniciId = sonuc.kullaniciId;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      await geriAl();
      if (benzersizIhlalMi(err)) throw ApiError.conflict("Bu firmada aynı kullanıcı adıyla bir hesap zaten var.");
      throw err;
    }

    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "KULLANICI_ACILDI",
      hedefTur: "KULLANICI",
      hedefId: kullaniciId,
      yeni: { firmaId, kullaniciAdi, firmaYoneticisi, mevcutSatiraBaglandi: !dbdeYeniAcildi },
    });
    return { kullanici: dto((await KullaniciSqlRepository.idIleBul(kullaniciId))!), geciciSifre };
  }

  public static async guncelle(
    yapan: AdminBaglam,
    kullaniciId: number,
    girdi: { adSoyad?: string | null; firmaYoneticisi?: boolean; durum?: KullaniciDurum }
  ): Promise<MerkezKullaniciDto> {
    const eski = await KullaniciSqlRepository.idIleBul(kullaniciId);
    if (!eski) throw ApiError.notFound("Kullanıcı bulunamadı.");

    const adSoyad = girdi.adSoyad === undefined ? eski.adSoyad : girdi.adSoyad?.trim() || null;
    const firmaYoneticisi = girdi.firmaYoneticisi ?? eski.firmaYoneticisi;
    if (adSoyad !== eski.adSoyad || firmaYoneticisi !== eski.firmaYoneticisi) {
      await KullaniciSqlRepository.bilgiGuncelle(kullaniciId, { adSoyad, firmaYoneticisi });
      await AdminLogSqlRepository.islemLogu({
        adminId: yapan.adminId,
        islem: "KULLANICI_GUNCELLENDI",
        hedefTur: "KULLANICI",
        hedefId: kullaniciId,
        eski: { adSoyad: eski.adSoyad, firmaYoneticisi: eski.firmaYoneticisi },
        yeni: { adSoyad, firmaYoneticisi },
      });
    }

    if (girdi.durum !== undefined && girdi.durum !== eski.durum) {
      if ((await KullaniciSqlRepository.durumDegistir(kullaniciId, girdi.durum)) === "LIMIT") throw limitHatasi("LIMIT");
      if (girdi.durum === "PASIF") await IzlemeSqlRepository.oturumlariIptalEt({ kullaniciId }, yapan.adminId);
      OturumService.onbellegiTemizle();
      await AdminLogSqlRepository.islemLogu({
        adminId: yapan.adminId,
        islem: "KULLANICI_DURUM",
        hedefTur: "KULLANICI",
        hedefId: kullaniciId,
        eski: { durum: eski.durum },
        yeni: { durum: girdi.durum },
      });
    }
    return dto((await KullaniciSqlRepository.idIleBul(kullaniciId))!);
  }

  /**
   * Geçici şifre üretir (bir kez döner), kullanıcı ilk girişte değiştirmek zorunda kalır. Firma veritabanındaki
   * SIFRE alanı da eşitlenmeye çalışılır; veritabanına ulaşılamazsa sıfırlama yine geçerlidir (giriş merkezden doğrulanır).
   */
  public static async sifreSifirla(
    yapan: AdminBaglam,
    kullaniciId: number
  ): Promise<{ geciciSifre: string; firmaDbEsitlendi: boolean }> {
    const hedef = await KullaniciSqlRepository.idIleBul(kullaniciId);
    if (!hedef) throw ApiError.notFound("Kullanıcı bulunamadı.");

    const geciciSifre = geciciSifreUret();
    await KullaniciSqlRepository.sifreGuncelle(kullaniciId, await sifreHashle(geciciSifre), true);
    await IzlemeSqlRepository.oturumlariIptalEt({ kullaniciId }, yapan.adminId);
    OturumService.onbellegiTemizle();

    let firmaDbEsitlendi = false;
    try {
      const dbContext = await firmaDbContextHazirla(hedef.firmaId);
      const dbKullanici = await UserSqlRepository.findByUsername(hedef.kullaniciAdi, dbContext);
      if (dbKullanici) {
        firmaDbEsitlendi = await UserSqlRepository.updatePassword(dbKullanici.id, await hashPassword(geciciSifre), dbContext);
      }
    } catch (err: any) {
      logger.warn(`[ADMIN] Şifre sıfırlandı ancak firma veritabanı eşitlenemedi (${hedef.kullaniciAdi}): ${err?.message}`);
    }

    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "KULLANICI_SIFRE_SIFIRLANDI",
      hedefTur: "KULLANICI",
      hedefId: kullaniciId,
      yeni: { firmaDbEsitlendi },
    });
    return { geciciSifre, firmaDbEsitlendi };
  }

  /**
   * Firma veritabanındaki TODVZ_KULLANICI kayıtlarını merkeze alır. Şifreler OKUNMAZ: hesap "eski şifre" işaretiyle
   * açılır, kullanıcı ilk girişinde mevcut şifresiyle doğrulanır ve şifresi o anda bcrypt ile merkeze taşınır.
   * Tekrar çalıştırılabilir; merkezde olanlar atlanır. Mevcut kullanıcılar lisans limitine takılmadan aktarılır.
   */
  public static async iceAktar(
    yapan: AdminBaglam,
    firmaId: number
  ): Promise<{ eklenen: string[]; zatenVar: number; atlanan: number }> {
    if (!(await FirmaSqlRepository.idIleBul(firmaId))) throw ApiError.notFound("Firma bulunamadı.");

    let satirlar: { KULLANICI_ID: number; AD: string | null; SISTEM_YONETICISI: unknown }[];
    try {
      satirlar = await firmaDbIleCalistir(firmaId, async (pool) => {
        const res = await pool
          .request()
          .query(`SELECT KULLANICI_ID, AD, SISTEM_YONETICISI FROM dbo.TODVZ_KULLANICI ORDER BY KULLANICI_ID`);
        return res.recordset as any[];
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw ApiError.badRequest(`Firma veritabanı okunamadı: ${String(err?.message || err).slice(0, 300)}`);
    }

    const mevcut = new Set((await KullaniciSqlRepository.firmaKullanicilari(firmaId)).map((k) => k.kullaniciAdi));
    const eklenen: string[] = [];
    let zatenVar = 0;
    let atlanan = 0;

    for (const s of satirlar) {
      const ad = (s.AD || "").trim();
      if (!ad) {
        atlanan++;
        continue;
      }
      if (mevcut.has(ad)) {
        zatenVar++;
        continue;
      }
      const v = s.SISTEM_YONETICISI;
      try {
        await KullaniciSqlRepository.ekle(
          {
            firmaId,
            kullaniciAdi: ad,
            adSoyad: null,
            sifreHash: ESKI_SIFRE_ISARETI,
            sifreDegismeli: false,
            firmaYoneticisi: v === true || v === 1 || v === "1" || v === "true",
            firmaDbKullaniciId: s.KULLANICI_ID,
            olusturan: "ICE_AKTARIM",
          },
          false
        );
        mevcut.add(ad);
        eklenen.push(ad);
      } catch (err) {
        // Sıralama kuralı iki adı aynı sayıyorsa (ör. büyük/küçük harf) ikincisi atlanır
        if (benzersizIhlalMi(err)) zatenVar++;
        else throw err;
      }
    }

    if (eklenen.length > 0) {
      await AdminLogSqlRepository.islemLogu({
        adminId: yapan.adminId,
        islem: "KULLANICI_ICE_AKTARILDI",
        hedefTur: "FIRMA",
        hedefId: firmaId,
        yeni: { eklenen },
      });
    }
    return { eklenen, zatenVar, atlanan };
  }
}
