import { env } from "../../config/env.config.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { LisansSqlRepository, aktivasyonKolonlariVarMi } from "../../models/admin/lisansSql.repository.js";
import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { AyarSqlRepository } from "../../models/admin/ayarSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { getAdminPool } from "../../config/adminDb.config.js";
import sql from "mssql";
import { AdminBaglam, FirmaDto, LisansDto } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { LisansVerisi, lisansKoduUret } from "../lisans/lisansKodu.js";
import { MAKINE_KIMLIGI_KURALI } from "../lisans/makineKimligi.js";
import { aktivasyonAnahtariUret } from "../lisans/aktivasyonAnahtari.js";

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

export const KISITSIZ_KOD_HATASI =
  "Bu kurulum firmasının sayfa (modül) ayarı yapılmamış; kısıtsız lisans kodu üretilmez. Lisansa ürün seçin ya da Modüller sekmesinden açık sayfaları belirleyin.";

/**
 * Lisans koduna girecek veri. Modül listesi: firmada açık olanlardan katalogda (ADM_MODUL) bulunanlar, sıralı — menüden
 * kalkmış eski kodlar kodu büyütüyor (elle yüklemede sınır) ve exe'de eski kodun API'sini açık tutuyordu. Kurulum
 * firmasında modül ayarı yoksa (null = kısıtsız) kod üretilmez: çevrimdışı müşteride bitişe kadar geri alınamıyordu.
 */
export const lisansVerisiHazirla = async (lisans: LisansDto, firmaKodu: string, makine: string | null, seri: number): Promise<LisansVerisi> => {
  const acik = await ModulSqlRepository.firmaAcikModulleri(lisans.firmaId);
  if (acik === null) throw ApiError.badRequest(KISITSIZ_KOD_HATASI);
  const katalog = new Set((await ModulSqlRepository.katalog()).map((m) => m.modulKodu));
  const moduller = [...new Set(katalog.size ? acik.filter((k) => katalog.has(k)) : acik)].sort();
  return {
    v: 1,
    firmaKodu,
    firmaId: lisans.firmaId,
    lisansId: lisans.lisansId,
    seri,
    makine,
    baslangic: lisans.baslangic,
    bitis: lisans.bitis,
    kullaniciLimiti: lisans.kullaniciLimiti,
    moduller,
    urunler: lisans.urunler.length ? [...lisans.urunler].sort() : null,
    iletisim: await iletisimOku(),
    verilme: new Date().toISOString(),
  };
};

/** Lisans satırından imzalı kod üretir (heartbeat ile kendiliğinden indirme de bunu kullanır). */
export const lisansKoduHazirla = async (lisans: LisansDto, firmaKodu: string, makine: string, seri: number): Promise<string> =>
  lisansKoduUret(await lisansVerisiHazirla(lisans, firmaKodu, makine, seri), env.LISANS_OZEL_ANAHTAR);

/** Kodun kurulumu bağlayan içeriği (seri, makine, verilme hariç); sıra farkı içerik farkı sayılmaz */
const icerikAnahtari = (v: Partial<LisansVerisi> | null | undefined): string =>
  JSON.stringify({
    moduller: Array.isArray(v?.moduller) ? [...v!.moduller].sort() : null,
    urunler: Array.isArray(v?.urunler) && v!.urunler.length ? [...v!.urunler].sort() : null,
    kullaniciLimiti: Number(v?.kullaniciLimiti) || 0,
    baslangic: String(v?.baslangic ?? ""),
    bitis: String(v?.bitis ?? ""),
    iletisim: { telefon: v?.iletisim?.telefon ?? "", eposta: v?.iletisim?.eposta ?? "", metin: v?.iletisim?.metin ?? "" },
  });

/**
 * Son üretilen kod lisansın ve firmanın bugünkü haliyle aynı mı (modüller, ürünler, kullanıcı limiti, tarihler, iletişim).
 * Değilse bildirimde yeni seriyle kod üretilir: panelde modül/ürün/limit değişince kod önceden yalnız lisans uzatmasında
 * yenileniyordu. Kod okunamazsa güncel değil sayılır; modül ayarı yoksa hata fırlatır (KISITSIZ_KOD_HATASI).
 */
export const lisansKoduGuncelMi = async (kod: string, lisans: LisansDto, firmaKodu: string): Promise<boolean> => {
  let eski: Partial<LisansVerisi> | null = null;
  try {
    eski = JSON.parse(Buffer.from(String(kod).split(".")[1] || "", "base64url").toString("utf8"));
  } catch {
    return false;
  }
  const simdi = await lisansVerisiHazirla(lisans, firmaKodu, eski?.makine ?? null, 0);
  return icerikAnahtari(eski) === icerikAnahtari(simdi);
};

/**
 * Lisansa yeni seriyle bu makine için kod üretir, firmanın lisanslı makinesini bu makine yapar (heartbeat kodu yalnız
 * ona yeniler) ve günlüğe yazar. Panelden elle üretme ve aktivasyon anahtarı ortak kullanır (adminId null = kurulum).
 */
const makineyeBagla = async (
  adminId: number | null,
  firma: Pick<FirmaDto, "firmaId" | "firmaKodu" | "makineKimligi">,
  lisans: LisansDto,
  makine: string,
  kaynak: "PANEL" | "AKTIVASYON"
): Promise<string> => {
  const seri = await LisansSqlRepository.sonrakiSeri(firma.firmaId);
  const kod = await lisansKoduHazirla(lisans, firma.firmaKodu, makine, seri);
  await LisansSqlRepository.kodYaz(lisans.lisansId, kod, makine, seri);

  if (firma.makineKimligi !== makine) {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, firma.firmaId)
      .input("makine", sql.VarChar(40), makine)
      .query(`UPDATE dbo.ADM_FIRMA SET MAKINE_KIMLIGI = @makine, MAKINE_KIMLIGI_TARIHI = GETDATE() WHERE FIRMA_ID = @id`);
    await AdminLogSqlRepository.islemLogu({
      adminId,
      islem: "MAKINE_KIMLIGI_DEGISTI",
      hedefTur: "FIRMA",
      hedefId: firma.firmaId,
      eski: { makineKimligi: firma.makineKimligi },
      yeni: { makineKimligi: makine, kaynak },
    });
  }
  await AdminLogSqlRepository.islemLogu({
    adminId,
    islem: "LISANS_KODU_URETILDI",
    hedefTur: "LISANS",
    hedefId: lisans.lisansId,
    yeni: { firmaId: firma.firmaId, makine, seri, bitis: lisans.bitis, kullaniciLimiti: lisans.kullaniciLimiti, kaynak },
  });
  return kod;
};

/** Kod üretilebilecek lisans mı (aktif, iptal edilmemiş, firması aktif kurulum firması) */
const lisansKodaUygun = (firma: FirmaDto, lisans: LisansDto | null, firmaId: number): LisansDto => {
  if (firma.baglantiModu !== "setup") throw ApiError.badRequest("Lisans kodu yalnız kurulum (exe) firmalarına üretilir.");
  if (firma.durum !== "AKTIF") throw ApiError.badRequest("Firma aktif değil; önce firmayı aktif edin.");
  if (!lisans || lisans.firmaId !== firmaId) throw ApiError.notFound("Lisans bulunamadı.");
  if (!lisans.aktif) throw ApiError.badRequest("Yalnız firmanın geçerli (aktif) lisansına kod üretilir.");
  if (lisans.iptal) throw ApiError.badRequest("Bu lisans iptal edilmiş; yeni lisans ekleyin.");
  return lisans;
};

const imzaAnahtariOlmali = () => {
  if (!lisansImzaAcikMi()) {
    throw ApiError.badRequest("Bu sunucuda lisans imza anahtarı tanımlı değil (Backend klasöründe: npm run lisans-anahtar).");
  }
};

const BASKA_MAKINEDE = "Bu aktivasyon anahtarı başka bir bilgisayarda kullanılmış. Bilgisayar değiştiyse yeni anahtar için bizimle iletişime geçin.";

export class LisansKodService {
  public static async kodUret(
    yapan: AdminBaglam,
    firmaId: number,
    lisansId: number,
    makineKimligi: string
  ): Promise<{ kod: string; lisans: LisansDto }> {
    imzaAnahtariOlmali();
    const makine = makineKimligi.trim().toUpperCase();
    if (!MAKINE_KIMLIGI_KURALI.test(makine)) throw ApiError.badRequest("Makine kimliği XXXX-XXXX-XXXX-XXXX biçiminde olmalıdır.");
    const firma = await FirmaSqlRepository.idIleBul(firmaId);
    if (!firma) throw ApiError.notFound("Firma bulunamadı.");
    const lisans = lisansKodaUygun(firma, await LisansSqlRepository.getir(lisansId), firmaId);

    const kod = await makineyeBagla(yapan.adminId, firma, lisans, makine, "PANEL");
    return { kod, lisans: (await LisansSqlRepository.getir(lisansId))! };
  }

  /** Panel: lisansa yeni rastgele aktivasyon anahtarı (A1, A4); öncekini geçersiz kılar. */
  public static async aktivasyonAnahtariUret(yapan: AdminBaglam, firmaId: number, lisansId: number): Promise<LisansDto> {
    imzaAnahtariOlmali();
    if (!(await aktivasyonKolonlariVarMi())) {
      throw ApiError.badRequest("Aktivasyon anahtarı kolonları veritabanında yok (SSMS: docs/sql/LIKYA_ADMIN_BULUT_KURULUM.sql, aktivasyon bloğu).");
    }
    const firma = await FirmaSqlRepository.idIleBul(firmaId);
    if (!firma) throw ApiError.notFound("Firma bulunamadı.");
    const lisans = lisansKodaUygun(firma, await LisansSqlRepository.getir(lisansId), firmaId);
    await LisansSqlRepository.aktivasyonAnahtariYaz(lisansId, aktivasyonAnahtariUret());
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "AKTIVASYON_ANAHTARI_URETILDI",
      hedefTur: "LISANS",
      hedefId: lisansId,
      eski: lisans.aktivasyonAnahtari ? { kullanildi: !!lisans.aktivasyonTarihi, makine: lisans.aktivasyonMakine } : undefined,
      yeni: { firmaId },
    });
    return (await LisansSqlRepository.getir(lisansId))!;
  }

  /**
   * Kurulum: anahtarla etkinleştirme (A3, A4). Firma kurulum anahtarıyla doğrulanmış gelir. Anahtar yalnız bu firmanın
   * lisanslarında aranır; ilk kullanan makineye bağlanır, aynı makine tekrar yazarsa yeniden kod alır.
   */
  public static async aktiflestir(firma: FirmaDto, anahtar: string, makine: string): Promise<string> {
    imzaAnahtariOlmali();
    const lisans = await LisansSqlRepository.aktivasyonAnahtariIleBul(firma.firmaId, anahtar);
    if (!lisans) throw ApiError.badRequest("Aktivasyon anahtarı geçersiz. Anahtarı kontrol edip tekrar yazın.");
    if (lisans.iptal || !lisans.aktif) throw ApiError.badRequest("Bu aktivasyon anahtarı artık geçerli değil. Lütfen bizimle iletişime geçin.");
    if (firma.durum !== "AKTIF") throw ApiError.badRequest("Firma kaydı aktif değil. Lütfen bizimle iletişime geçin.");
    if (lisans.aktivasyonMakine && lisans.aktivasyonMakine !== makine) throw ApiError.badRequest(BASKA_MAKINEDE);
    if (!(await LisansSqlRepository.aktivasyonAnahtariKullan(lisans.lisansId, anahtar, makine))) throw ApiError.badRequest(BASKA_MAKINEDE);
    const kod = await makineyeBagla(null, firma, lisans, makine, "AKTIVASYON");
    await LisansSqlRepository.teslimYaz(lisans.lisansId);
    return kod;
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
