import { env } from "../../config/env.config.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { LisansSqlRepository } from "../../models/admin/lisansSql.repository.js";
import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { AyarSqlRepository } from "../../models/admin/ayarSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { getAdminPool } from "../../config/adminDb.config.js";
import sql from "mssql";
import { AdminBaglam, LisansDto } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { LisansVerisi, lisansKoduUret } from "../lisans/lisansKodu.js";
import { MAKINE_KIMLIGI_KURALI } from "../lisans/makineKimligi.js";

/**
 * Panelde kurulum (exe) firmasına çevrimdışı lisans kodu üretme ve iptal (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, K8, K16, K17).
 * Kod, firmanın aktif lisansındaki bitiş/limit, panelde açık modüller ve ayarlardaki iletişim metniyle imzalanır.
 * Aynı lisans için kod yeniden üretilebilir (ör. makine değişti): her üretim yeni seri alır, eski kodlar daha eski sayılır.
 */

export const lisansImzaAcikMi = (): boolean => !!env.LISANS_OZEL_ANAHTAR;

export const iletisimOku = async () => {
  const a = await AyarSqlRepository.tumu();
  return { telefon: a.LISANS_ILETISIM_TELEFON, eposta: a.LISANS_ILETISIM_EPOSTA, metin: a.LISANS_ILETISIM_METIN };
};

/** Lisans satırından imzalı kod üretir (heartbeat ile kendiliğinden indirme de bunu kullanır). */
export const lisansKoduHazirla = async (lisans: LisansDto, firmaKodu: string, makine: string, seri: number): Promise<string> => {
  const veri: LisansVerisi = {
    v: 1,
    firmaKodu,
    firmaId: lisans.firmaId,
    lisansId: lisans.lisansId,
    seri,
    makine,
    baslangic: lisans.baslangic,
    bitis: lisans.bitis,
    kullaniciLimiti: lisans.kullaniciLimiti,
    moduller: await ModulSqlRepository.firmaAcikModulleri(lisans.firmaId),
    urunler: lisans.urunler.length ? lisans.urunler : null,
    iletisim: await iletisimOku(),
    verilme: new Date().toISOString(),
  };
  return lisansKoduUret(veri, env.LISANS_OZEL_ANAHTAR);
};

export class LisansKodService {
  public static async kodUret(
    yapan: AdminBaglam,
    firmaId: number,
    lisansId: number,
    makineKimligi: string
  ): Promise<{ kod: string; lisans: LisansDto }> {
    if (!lisansImzaAcikMi()) {
      throw ApiError.badRequest("Bu sunucuda lisans imza anahtarı tanımlı değil (Backend klasöründe: npm run lisans-anahtar).");
    }
    const makine = makineKimligi.trim().toUpperCase();
    if (!MAKINE_KIMLIGI_KURALI.test(makine)) throw ApiError.badRequest("Makine kimliği XXXX-XXXX-XXXX-XXXX biçiminde olmalıdır.");
    const firma = await FirmaSqlRepository.idIleBul(firmaId);
    if (!firma) throw ApiError.notFound("Firma bulunamadı.");
    if (firma.baglantiModu !== "setup") throw ApiError.badRequest("Lisans kodu yalnız kurulum (exe) firmalarına üretilir.");
    if (firma.durum !== "AKTIF") throw ApiError.badRequest("Firma aktif değil; önce firmayı aktif edin.");
    const lisans = await LisansSqlRepository.getir(lisansId);
    if (!lisans || lisans.firmaId !== firmaId) throw ApiError.notFound("Lisans bulunamadı.");
    if (!lisans.aktif) throw ApiError.badRequest("Yalnız firmanın geçerli (aktif) lisansına kod üretilir.");
    if (lisans.iptal) throw ApiError.badRequest("Bu lisans iptal edilmiş; yeni lisans ekleyin.");

    const seri = await LisansSqlRepository.sonrakiSeri(firmaId);
    const kod = await lisansKoduHazirla(lisans, firma.firmaKodu, makine, seri);
    await LisansSqlRepository.kodYaz(lisansId, kod, makine, seri);

    if (firma.makineKimligi !== makine) {
      const pool = await getAdminPool();
      await pool
        .request()
        .input("id", sql.Int, firmaId)
        .input("makine", sql.VarChar(40), makine)
        .query(`UPDATE dbo.ADM_FIRMA SET MAKINE_KIMLIGI = @makine, MAKINE_KIMLIGI_TARIHI = GETDATE() WHERE FIRMA_ID = @id`);
      await AdminLogSqlRepository.islemLogu({
        adminId: yapan.adminId,
        islem: "MAKINE_KIMLIGI_DEGISTI",
        hedefTur: "FIRMA",
        hedefId: firmaId,
        eski: { makineKimligi: firma.makineKimligi },
        yeni: { makineKimligi: makine },
      });
    }
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "LISANS_KODU_URETILDI",
      hedefTur: "LISANS",
      hedefId: lisansId,
      yeni: { firmaId, makine, seri, bitis: lisans.bitis, kullaniciLimiti: lisans.kullaniciLimiti },
    });
    return { kod, lisans: (await LisansSqlRepository.getir(lisansId))! };
  }

  public static async iptal(yapan: AdminBaglam, firmaId: number, lisansId: number): Promise<LisansDto> {
    const lisans = await LisansSqlRepository.getir(lisansId);
    if (!lisans || lisans.firmaId !== firmaId) throw ApiError.notFound("Lisans bulunamadı.");
    if (lisans.iptal) return lisans;
    await LisansSqlRepository.iptalEt(lisansId, yapan.adminId);
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "LISANS_IPTAL",
      hedefTur: "LISANS",
      hedefId: lisansId,
      yeni: { firmaId, seri: lisans.seriNo, makine: lisans.makineKimligi },
    });
    return (await LisansSqlRepository.getir(lisansId))!;
  }
}
