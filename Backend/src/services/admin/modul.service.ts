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
  // e-Banka (Vomsis): F- Banka altındaki açılır grup, ayrı açılıp kapatılır (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E9).
  // Grup kodu başlıktan türer: başlık "F- e-Banka" → "D- e-Banka" olunca kod da değişti. Eski kod, ayarı o kodla
  // kayıtlı firmalar için durur.
  "/ebanka": ["banka:#d-e-banka", "banka:#f-e-banka"],
  // POS cihazı entegrasyonu: tanım ve işlem ekranları F- Banka altındadır; fiş ekranları da tahsilat için kullanır
  "/pos": ["banka", "ust:banka", "vezne", "perakende", "ust:sarraf", "ust:perakende", "yonetici"],
  "/cari-hareket": ["cari", "ust:c-hareket", "raporlar", "vezne"],
  "/cari-dekont": ["cari", "ust:c-hareket", "raporlar"],
  "/e-belge": ["ebelge", "ust:e-belge", "vezne", "perakende", "ayarlar"],
  "/masak": ["ust:masak", "vezne", "cari", "perakende", "raporlar"],
  "/etiket": ["etiket", "ust:fiyat", "perakende"],
  "/rapor": ["raporlar", "vezne", "kasa", "kur", "cari", "yonetici", "banka", "ust:masak", "etiket"],
};

// Ağaç kuralı saf dosyada (paket hesabı da kullanır); eski içe aktarmalar için buradan da verilir
export { modulleriDuzenle } from "./modulAgaci.js";
import { modulleriDuzenle } from "./modulAgaci.js";

const ONBELLEK_MS = 60_000;
const onbellek = new Map<string, { moduller: string[] | null; zaman: number }>();

// Paket servisi bu servisi içe aktarır; döngü olmasın diye ters yönde çağrı anında yüklenir
const paketServisi = async () => (await import("./paket.service.js")).PaketService;

export interface FirmaModulAyari {
  kisitsiz: boolean;
  acik: string[];
  /** Aktif lisanstaki ürünler (docs/LISANS_URUN_PAKETLERI.md); boş = ürünsüz, eski usul elle ayar */
  urunler: string[];
  /** Ürünlü firmada paketlerin verdiği liste ve elle istisnalar; ürünsüzde boş */
  taban: string[];
  ek: string[];
  cikar: string[];
  /** Paket tabloları kurulu mu */
  paketKurulu: boolean;
}

export class ModulService {
  public static onbellegiTemizle(): void {
    onbellek.clear();
  }

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
      await (await paketServisi()).katalogDegisti(yapan.adminId);
      onbellek.clear();
    }
    return ModulSqlRepository.katalog();
  }

  /** Panel için: firmanın ayarı. kisitsiz=true → hiç ayar yapılmamış, her şey açık. */
  public static async firmaAyari(firmaId: number): Promise<FirmaModulAyari> {
    if (!(await FirmaSqlRepository.idIleBul(firmaId))) throw ApiError.notFound("Firma bulunamadı.");
    const acik = await ModulSqlRepository.firmaAcikModulleri(firmaId);
    const urun = await (await paketServisi()).firmaUrunAyari(firmaId);
    return {
      kisitsiz: acik === null,
      acik: acik ?? [],
      urunler: urun?.urunler ?? [],
      taban: urun?.taban ?? [],
      ek: urun?.ek ?? [],
      cikar: urun?.cikar ?? [],
      paketKurulu: urun !== null,
    };
  }

  public static async firmaAyariniYaz(
    yapan: AdminBaglam,
    firmaId: number,
    girdi: { kisitsiz?: boolean; acik?: string[]; paketeDon?: boolean }
  ): Promise<FirmaModulAyari> {
    const eski = await this.firmaAyari(firmaId);

    if (eski.urunler.length > 0) {
      // Ürünlü firma: tikler paket tabanına göre istisna olarak saklanır (paket değişse de korunur)
      const paket = await paketServisi();
      if (girdi.kisitsiz) throw ApiError.badRequest("Ürün seçili firmada modüller paketten gelir; kısıtlama kapatılamaz. Lisanstan ERP'yi seçin.");
      if (girdi.paketeDon) await paket.paketeDon(firmaId, eski.urunler, yapan.adminId);
      else await paket.firmaIstenenListe(firmaId, eski.urunler, girdi.acik ?? [], yapan.adminId);
    } else if (girdi.paketeDon) {
      throw ApiError.badRequest("Bu firmanın lisansında ürün seçili değil.");
    } else if (girdi.kisitsiz) {
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
