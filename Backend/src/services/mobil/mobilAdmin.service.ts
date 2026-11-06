import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { MobilSqlRepository } from "../../models/admin/mobilSql.repository.js";
import { AdminBaglam } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { acikcaAcikMi } from "../admin/modulAgaci.js";
import { MOBIL_MODUL, kisaAdUret, limitDusurmeHatasi } from "./mobilKural.js";

/** Yönetim paneli › Firma › Mobil sekmesi (docs/MOBIL_CARI_YOL_HARITASI.md K7, K11, K26, V1). */

export interface MobilFirmaOzeti {
  semaVar: boolean;
  modulAcik: boolean;
  kullaniciLimiti: number;
  kullanilan: number;
  kisaAd: string | null;
  gorunenKisaAd: string;
  musteriNo: string | null;
}

export class MobilAdminService {
  public static async ozet(firmaId: number): Promise<MobilFirmaOzeti> {
    const firma = await FirmaSqlRepository.idIleBul(firmaId);
    if (!firma) throw ApiError.notFound("Firma bulunamadı.");
    const modulAcik = acikcaAcikMi(await ModulSqlRepository.firmaAcikModulleri(firmaId), MOBIL_MODUL);
    const temel = { modulAcik, musteriNo: firma.musteriNo ?? null };
    if (!(await MobilSqlRepository.semaVarMi()))
      return { ...temel, semaVar: false, kullaniciLimiti: 0, kullanilan: 0, kisaAd: null, gorunenKisaAd: kisaAdUret(firma.unvan) };
    const a = await MobilSqlRepository.firmaAyari(firmaId);
    return {
      ...temel,
      semaVar: true,
      kullaniciLimiti: a.kullaniciLimiti,
      kullanilan: await MobilSqlRepository.firmaErisimSayisi(firmaId),
      kisaAd: a.kisaAd,
      gorunenKisaAd: kisaAdUret(firma.unvan, a.kisaAd),
    };
  }

  /** Firma › Mobil sekmesi: kullanıcılar (sınıra sayılanlar önce) + son mobil girişler (Faz 9) */
  public static async kullanim(firmaId: number, adet?: number) {
    const firma = await FirmaSqlRepository.idIleBul(firmaId);
    if (!firma) throw ApiError.notFound("Firma bulunamadı.");
    if (!(await MobilSqlRepository.semaVarMi())) return { kullanicilar: [], girisler: [], ozet: { aktif: 0, pasif: 0, kilitli: 0, hicGirmedi: 0 } };
    const [kullanicilar, girisler] = await Promise.all([
      MobilSqlRepository.firmaKullanicilari(firmaId),
      MobilSqlRepository.firmaGirisleri(firmaId, firma.musteriNo ?? null, adet),
    ]);
    return {
      kullanicilar,
      girisler,
      ozet: {
        aktif: kullanicilar.filter((k) => k.aktif).length,
        pasif: kullanicilar.filter((k) => !k.aktif).length,
        kilitli: kullanicilar.filter((k) => k.kilitli).length,
        hicGirmedi: kullanicilar.filter((k) => k.aktif && !k.sonGiris).length,
      },
    };
  }

  public static async yaz(yapan: AdminBaglam, firmaId: number, girdi: { kullaniciLimiti: number; kisaAd?: string | null }): Promise<MobilFirmaOzeti> {
    const eski = await this.ozet(firmaId);
    if (!eski.semaVar) await MobilSqlRepository.semaGerekli();
    const hata = limitDusurmeHatasi(girdi.kullaniciLimiti, eski.kullanilan);
    if (hata) throw ApiError.badRequest(hata);
    const kisaAd = String(girdi.kisaAd ?? "").trim() || null;
    await MobilSqlRepository.firmaAyariYaz(firmaId, { kullaniciLimiti: girdi.kullaniciLimiti, kisaAd }, yapan.adminId);
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "MOBIL_AYAR_DEGISTI",
      hedefTur: "FIRMA",
      hedefId: firmaId,
      eski: { kullaniciLimiti: eski.kullaniciLimiti, kisaAd: eski.kisaAd },
      yeni: { kullaniciLimiti: girdi.kullaniciLimiti, kisaAd },
    });
    return this.ozet(firmaId);
  }
}
