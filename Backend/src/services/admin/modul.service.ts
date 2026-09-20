import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { AdminBaglam, ModulKaydi } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { firmaDbAnahtari } from "./firmaBaglanti.service.js";

/**
 * API öneklerini kullanan modüller. Bir önek, listesindeki modüllerden EN AZ BİRİ firmaya açıksa çalışır.
 * Listeler bilinçli olarak geniştir: bir ekran başka modülün API'sini de kullanabilir (ör. fiş ekranları MASAK
 * sorgusu ve e-Belge üretir, menülerdeki rapor maddeleri /rapor'u kullanır). Açık bir ekranı bozmamak, kapalı bir
 * API'yi gereğinden sıkı tutmaktan önceliklidir; asıl görünürlük kısıtı menü + sayfa korumasındadır.
 * Her yerde kullanılan arama/tanım uçları (auth, users, company, ayar, tanimlar, para, kur, pano, cari, vezne,
 * yazici, numerator, istatistik, banknot, belge) burada yoktur → kısıtlanmaz.
 */
export const API_MODULLERI: Record<string, string[]> = {
  "/doviz-fis": ["vezne", "ust:doviz", "yonetici"],
  "/sarraf-fis": ["vezne", "ust:sarraf", "yonetici"],
  "/vezne-transferi": ["vezne", "yonetici"],
  "/vezne-izleme": ["vezne", "ust:vezne-izleme", "yonetici"],
  "/perakende": ["perakende", "vezne", "ust:perakende"],
  "/kasa": ["kasa", "raporlar", "yonetici"],
  "/banka": ["banka", "ust:banka", "kasa", "raporlar"],
  "/cari-hareket": ["cari", "ust:c-hareket", "raporlar", "vezne"],
  "/cari-dekont": ["cari", "ust:c-hareket", "raporlar"],
  "/e-belge": ["ebelge", "ust:e-belge", "vezne", "perakende", "ayarlar"],
  "/masak": ["ust:masak", "vezne", "cari", "perakende", "raporlar"],
  "/etiket": ["etiket", "ust:fiyat", "perakende"],
  "/rapor": ["raporlar", "vezne", "kasa", "kur", "cari", "yonetici", "banka", "ust:masak"],
};

/**
 * Ağaç kuralları: ana modül kapalıysa altındakiler de kapalıdır; alt öğesi olan bir ana modülün hiçbir alt öğesi
 * açık değilse ana modül de kapalıdır. Katalogda olmayan kodlar atılır.
 */
export const modulleriDuzenle = (katalog: ModulKaydi[], istenen: string[]): string[] => {
  const gecerli = new Set(katalog.map((m) => m.modulKodu));
  const acik = new Set(istenen.filter((k) => gecerli.has(k)));
  const ust = new Map(katalog.map((m) => [m.modulKodu, m.ustKodu]));

  // Üstü kapalı olanı kapat (ağaç derinliği kadar tekrarla)
  for (let degisti = true; degisti; ) {
    degisti = false;
    for (const kod of [...acik]) {
      const u = ust.get(kod);
      if (u && !acik.has(u)) {
        acik.delete(kod);
        degisti = true;
      }
    }
  }
  // Alt öğesi olup hiçbiri açık olmayan düğümü kapat (yapraklardan yukarı)
  for (let degisti = true; degisti; ) {
    degisti = false;
    for (const m of katalog) {
      if (!acik.has(m.modulKodu)) continue;
      const cocuklar = katalog.filter((c) => c.ustKodu === m.modulKodu);
      if (cocuklar.length > 0 && !cocuklar.some((c) => acik.has(c.modulKodu))) {
        acik.delete(m.modulKodu);
        degisti = true;
      }
    }
  }
  return [...acik];
};

const ONBELLEK_MS = 60_000;
const onbellek = new Map<string, { moduller: string[] | null; zaman: number }>();

export class ModulService {
  public static katalog(): Promise<ModulKaydi[]> {
    return ModulSqlRepository.katalog();
  }

  /** Yönetim paneli, kullanıcı uygulamasının menü tanımından ürettiği kataloğu buraya gönderir (aynı repo, aynı sürüm). */
  public static async katalogEsitle(yapan: AdminBaglam, moduller: ModulKaydi[]): Promise<ModulKaydi[]> {
    const kodlar = new Set(moduller.map((m) => m.modulKodu));
    if (kodlar.size !== moduller.length) throw ApiError.badRequest("Katalogda yinelenen modül kodu var.");
    if (moduller.some((m) => m.ustKodu && !kodlar.has(m.ustKodu))) throw ApiError.badRequest("Katalogda üst modülü olmayan kayıt var.");

    const sonuc = await ModulSqlRepository.katalogEsitle(moduller);
    if (sonuc.eklenen > 0 || sonuc.silinen > 0) {
      onbellek.clear();
      await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "MODUL_KATALOG_ESITLENDI", yeni: sonuc });
    }
    return ModulSqlRepository.katalog();
  }

  /** Panel için: firmanın ayarı. kisitsiz=true → hiç ayar yapılmamış, her şey açık. */
  public static async firmaAyari(firmaId: number): Promise<{ kisitsiz: boolean; acik: string[] }> {
    if (!(await FirmaSqlRepository.idIleBul(firmaId))) throw ApiError.notFound("Firma bulunamadı.");
    const acik = await ModulSqlRepository.firmaAcikModulleri(firmaId);
    return { kisitsiz: acik === null, acik: acik ?? [] };
  }

  public static async firmaAyariniYaz(
    yapan: AdminBaglam,
    firmaId: number,
    girdi: { kisitsiz?: boolean; acik?: string[] }
  ): Promise<{ kisitsiz: boolean; acik: string[] }> {
    const eski = await this.firmaAyari(firmaId);

    if (girdi.kisitsiz) {
      await ModulSqlRepository.firmaModulleriniSifirla(firmaId);
    } else {
      const katalog = await ModulSqlRepository.katalog();
      if (katalog.length === 0) throw ApiError.badRequest("Modül kataloğu boş. Sayfayı yenileyip tekrar deneyin.");
      await ModulSqlRepository.firmaModulleriniYaz(firmaId, modulleriDuzenle(katalog, girdi.acik ?? []), yapan.adminId);
    }
    onbellek.clear();

    const yeni = await this.firmaAyari(firmaId);
    const eskiKume = new Set(eski.acik);
    const yeniKume = new Set(yeni.acik);
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "MODUL_DEGISTI",
      hedefTur: "FIRMA",
      hedefId: firmaId,
      eski: { kisitsiz: eski.kisitsiz },
      yeni: {
        kisitsiz: yeni.kisitsiz,
        acilan: yeni.acik.filter((k) => !eskiKume.has(k)),
        kapanan: eski.acik.filter((k) => !yeniKume.has(k)),
      },
    });
    return yeni;
  }

  /** Oturumdaki sunucu+veritabanına göre firmanın açık modülleri (60 sn önbellekli). Firma bulunamazsa null. */
  public static async oturumModulleri(dbServer: string, dbName: string): Promise<string[] | null> {
    const { anahtar } = firmaDbAnahtari(dbServer, dbName);
    const kayit = onbellek.get(anahtar);
    if (kayit && Date.now() - kayit.zaman < ONBELLEK_MS) return kayit.moduller;

    const firma = await FirmaSqlRepository.anahtarIleBul(anahtar);
    const moduller = firma ? await ModulSqlRepository.firmaAcikModulleri(firma.firmaId) : null;
    onbellek.set(anahtar, { moduller, zaman: Date.now() });
    return moduller;
  }
}
