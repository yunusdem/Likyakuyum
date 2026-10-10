import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { PaketSqlRepository, PaketSatiri } from "../../models/admin/paketSql.repository.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { AdminBaglam, ModulKaydi } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { ModulService } from "./modul.service.js";
import {
  ayniUrunler,
  farkHesapla,
  firmaModulleriHesapla,
  istisnaCikar,
  paketTabani,
  ustleriyle,
} from "./paketHesap.js";

/**
 * Lisans ürün paketleri (docs/LISANS_URUN_PAKETLERI.md). Ürün seçimi yeni bir kısıt değildir: firmanın modül ayarını
 * (ADM_FIRMA_MODUL) çekirdek + seçili paketler + elle istisnalardan hesaplayıp yazar. Menü, API koruması ve exe lisans
 * kodu eskisi gibi ADM_FIRMA_MODUL'den okur.
 */

const kurulumHatasi = (): ApiError =>
  ApiError.conflict("Ürün paketi tabloları merkez veritabanında kurulmamış. Sunucuda docs/sql/LIKYA_ADMIN_URUN_PAKET.sql betiğini çalıştırın.");

const semaGerekli = async () => {
  if (!(await PaketSqlRepository.semaVarMi())) throw kurulumHatasi();
};

const katalogGerekli = async (): Promise<ModulKaydi[]> => {
  const katalog = await ModulSqlRepository.katalog();
  if (katalog.length === 0) throw ApiError.badRequest("Modül kataloğu boş. Sayfayı yenileyip tekrar deneyin.");
  return katalog;
};

export interface PaketDto extends Omit<PaketSatiri, "moduller"> {
  moduller: string[];
  /** Bu paketi aktif lisansında kullanan firma sayısı (ERP firmaları ERP dışındaki paketlere bağlı sayılmaz) */
  firmaSayisi: number;
  /** Bunlardan kurulum (exe) firması olanlar: değişiklik için yeni lisans kodu gerekir */
  kurulumFirmaSayisi: number;
}

export interface FirmaUrunAyari {
  urunler: string[];
  /** Paketlerin verdiği liste (istisnasız) */
  taban: string[];
  ek: string[];
  cikar: string[];
}

/** Paketteki değişiklikten etkilenen firma: ürünleri bu paketi içeren (çekirdekse tüm ürünlü) ve ERP olmayan firma. */
const paketeBagliMi = (paket: PaketSatiri, urunler: string[]): boolean =>
  !urunler.includes("erp") && (paket.cekirdek ? urunler.length > 0 : urunler.includes(paket.paketKodu));

export class PaketService {
  public static async liste(): Promise<{ kurulu: boolean; paketler: PaketDto[] }> {
    if (!(await PaketSqlRepository.semaVarMi())) return { kurulu: false, paketler: [] };
    const [paketler, firmalar] = await Promise.all([PaketSqlRepository.paketler(), PaketSqlRepository.urunluFirmalar()]);
    return {
      kurulu: true,
      paketler: paketler.map((p) => {
        const bagli = firmalar.filter((f) => (p.hepsi ? f.urunler.includes(p.paketKodu) : paketeBagliMi(p, f.urunler)));
        return { ...p, firmaSayisi: bagli.length, kurulumFirmaSayisi: bagli.filter((f) => f.baglantiModu === "setup").length };
      }),
    };
  }

  /** Firmalar listesindeki rozetler: firmaId → ürünler */
  public static async firmaUrunHaritasi(): Promise<Record<number, string[]>> {
    const firmalar = await PaketSqlRepository.urunluFirmalar();
    return Object.fromEntries(firmalar.map((f) => [f.firmaId, f.urunler]));
  }

  /**
   * Panel, menüden ürettiği ilk içeriği gönderir; yalnız henüz hiç doldurulmamış paketlere yazılır (sonraki çağrılar
   * hiçbir şeyi değiştirmez). Katalogda olmayan kodlar atılır.
   */
  public static async ilkIcerik(yapan: AdminBaglam, icerik: Record<string, string[]>): Promise<{ kurulu: boolean; paketler: PaketDto[] }> {
    await semaGerekli();
    const katalog = await katalogGerekli();
    const gecerli = new Set(katalog.map((m) => m.modulKodu));
    const yazilan: string[] = [];
    for (const p of await PaketSqlRepository.paketler()) {
      if (p.ilkIcerik || p.hepsi || !icerik[p.paketKodu]) continue;
      const kodlar = [...ustleriyle(katalog, icerik[p.paketKodu].filter((k) => gecerli.has(k)))];
      if (await PaketSqlRepository.paketIcerikYaz(p.paketKodu, kodlar, yapan.adminId, true)) yazilan.push(`${p.paketKodu}:${kodlar.length}`);
    }
    if (yazilan.length) await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "PAKET_ILK_ICERIK", yeni: { yazilan } });
    return this.liste();
  }

  /**
   * Paket içeriğini değiştirir. uygula=true: bu paketi kullanan firmaların modülleri yeni içerikle yeniden hesaplanır
   * (elle istisnalar korunur). uygula=false: firmaların bugünkü modülleri aynen kalır — fark, o firmalara istisna
   * olarak yazılır; yeni içerik yalnız bundan sonra ürün seçilen lisanslarda geçerli olur.
   */
  public static async paketYaz(
    yapan: AdminBaglam,
    paketKodu: string,
    girdi: { moduller: string[]; uygula: boolean }
  ): Promise<{ paket: PaketDto; etkilenenFirma: number; kurulumFirmalari: string[] }> {
    await semaGerekli();
    const katalog = await katalogGerekli();
    const paketler = await PaketSqlRepository.paketler();
    const paket = paketler.find((p) => p.paketKodu === paketKodu);
    if (!paket) throw ApiError.notFound("Paket bulunamadı.");
    if (paket.hepsi) throw ApiError.badRequest(`${paket.ad} tüm sayfaları kapsar; içeriği düzenlenmez.`);

    const gecerli = new Set(katalog.map((m) => m.modulKodu));
    const yeniKodlar = [...ustleriyle(katalog, girdi.moduller.filter((k) => gecerli.has(k)))];
    const yeniPaketler = paketler.map((p) => (p.paketKodu === paketKodu ? { ...p, moduller: yeniKodlar } : p));

    const firmalar = (await PaketSqlRepository.urunluFirmalar()).filter((f) => paketeBagliMi(paket, f.urunler));

    // uygula=false: önce her firmanın bugünkü son listesi, yeni tabana göre istisnaya çevrilir (son liste değişmez)
    if (!girdi.uygula) {
      for (const f of firmalar) {
        const simdiki = (await ModulSqlRepository.firmaAcikModulleri(f.firmaId)) ?? katalog.map((m) => m.modulKodu);
        const yeniTaban = paketTabani(katalog, yeniPaketler, f.urunler);
        const { ek, cikar } = istisnaCikar(katalog, yeniTaban, simdiki);
        await PaketSqlRepository.istisnalariYaz(f.firmaId, ek, cikar, yapan.adminId);
      }
    }

    await PaketSqlRepository.paketIcerikYaz(paketKodu, yeniKodlar, yapan.adminId);

    if (girdi.uygula) {
      for (const f of firmalar) await this.firmayiHesapla(f.firmaId, f.urunler, yapan.adminId, katalog, yeniPaketler);
    }
    ModulService.onbellegiTemizle();

    const eski = new Set(paket.moduller);
    const yeni = new Set(yeniKodlar);
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "PAKET_DEGISTI",
      hedefTur: "PAKET",
      hedefId: paketKodu,
      yeni: {
        eklenen: yeniKodlar.filter((k) => !eski.has(k)),
        cikarilan: paket.moduller.filter((k) => !yeni.has(k)),
        uygula: girdi.uygula,
        firmalar: firmalar.map((f) => f.firmaKodu),
      },
    });

    const liste = await this.liste();
    return {
      paket: liste.paketler.find((p) => p.paketKodu === paketKodu)!,
      etkilenenFirma: firmalar.length,
      kurulumFirmalari: girdi.uygula ? firmalar.filter((f) => f.baglantiModu === "setup").map((f) => f.firmaKodu) : [],
    };
  }

  /** Firma Detay › Modüller: ürünler, paket tabanı ve istisnalar (ürünsüz firmada urunler boş). */
  public static async firmaUrunAyari(firmaId: number): Promise<FirmaUrunAyari | null> {
    if (!(await PaketSqlRepository.semaVarMi())) return null;
    const urunler = await PaketSqlRepository.firmaUrunleri(firmaId);
    if (urunler.length === 0) return { urunler, taban: [], ek: [], cikar: [] };
    const [katalog, paketler, istisna] = await Promise.all([
      ModulSqlRepository.katalog(),
      PaketSqlRepository.paketler(),
      PaketSqlRepository.istisnalar(firmaId),
    ]);
    return { urunler, taban: paketTabani(katalog, paketler, urunler), ...istisna };
  }

  /** Ürünlü firmanın son listesini hesaplar ve ADM_FIRMA_MODUL'e yazar. */
  public static async firmayiHesapla(
    firmaId: number,
    urunler: string[],
    adminId: number,
    katalog?: ModulKaydi[],
    paketler?: PaketSatiri[]
  ): Promise<string[]> {
    const k = katalog ?? (await katalogGerekli());
    const p = paketler ?? (await PaketSqlRepository.paketler());
    const son = firmaModulleriHesapla(k, paketTabani(k, p, urunler), await PaketSqlRepository.istisnalar(firmaId));
    await ModulSqlRepository.firmaModulleriniYaz(firmaId, son, adminId);
    return son;
  }

  /** Modüller sekmesinde ürünlü firmanın tik değişikliği: istenen liste istisnaya çevrilip saklanır. */
  public static async firmaIstenenListe(firmaId: number, urunler: string[], istenen: string[], adminId: number): Promise<void> {
    const katalog = await katalogGerekli();
    const paketler = await PaketSqlRepository.paketler();
    const { ek, cikar } = istisnaCikar(katalog, paketTabani(katalog, paketler, urunler), istenen);
    await PaketSqlRepository.istisnalariYaz(firmaId, ek, cikar, adminId);
    await this.firmayiHesapla(firmaId, urunler, adminId, katalog, paketler);
  }

  /** "Pakete dön": istisnaları siler. */
  public static async paketeDon(firmaId: number, urunler: string[], adminId: number): Promise<void> {
    await PaketSqlRepository.istisnalariYaz(firmaId, [], [], adminId);
    await this.firmayiHesapla(firmaId, urunler, adminId);
  }

  /** Ürünler geçerli mi? Çekirdek seçilmez; bilinmeyen kod reddedilir. */
  public static async urunleriDenetle(urunler: string[]): Promise<string[]> {
    const tekil = [...new Set(urunler.map((u) => u.trim()).filter(Boolean))];
    if (tekil.length === 0) return [];
    await semaGerekli();
    const paketler = await PaketSqlRepository.paketler();
    const bilinmeyen = tekil.filter((u) => !paketler.some((p) => p.paketKodu === u && !p.cekirdek));
    if (bilinmeyen.length) throw ApiError.badRequest(`Bilinmeyen ürün: ${bilinmeyen.join(", ")}`);
    return paketler.filter((p) => tekil.includes(p.paketKodu)).map((p) => p.paketKodu); // paket sırasıyla
  }

  /** PAKET_ADI metni: "Likya.Kuyum + Likya.Connector" */
  public static async paketAdi(urunler: string[]): Promise<string | null> {
    if (urunler.length === 0) return null;
    const paketler = await PaketSqlRepository.paketler();
    return paketler.filter((p) => urunler.includes(p.paketKodu)).map((p) => p.ad).join(" + ").slice(0, 100);
  }

  /** Lisans penceresinde kayıttan önce: seçilen ürünlerle firmada açılacak / kapanacak sayfalar. */
  public static async onizleme(firmaId: number, urunlerGirdi: string[]) {
    await semaGerekli();
    if (!(await FirmaSqlRepository.idIleBul(firmaId))) throw ApiError.notFound("Firma bulunamadı.");
    const urunler = await this.urunleriDenetle(urunlerGirdi);
    const katalog = await katalogGerekli();
    const simdiki = await ModulSqlRepository.firmaAcikModulleri(firmaId);
    const eskiUrunler = await PaketSqlRepository.firmaUrunleri(firmaId);
    if (urunler.length === 0 || ayniUrunler(eskiUrunler, urunler)) {
      return { degisiyor: false, acilacak: [], kapanacak: [], kisitsizdi: simdiki === null };
    }
    const paketler = await PaketSqlRepository.paketler();
    // Ürünsüzden ürünlüye geçişte eski elle ayar istisna sayılmaz (taban + boş istisna); ürün değişiminde istisnalar korunur
    const istisna = eskiUrunler.length ? await PaketSqlRepository.istisnalar(firmaId) : { ek: [], cikar: [] };
    const yeni = firmaModulleriHesapla(katalog, paketTabani(katalog, paketler, urunler), istisna);
    const { acilacak, kapanacak } = farkHesapla(katalog, simdiki, yeni);
    // Başlık tek başına belirsiz olabilir ("A- Özet", aynı sayfa iki menüde): bağlı olduğu grupla yazılır
    const harfsiz = (t: string) => t.replace(/^[A-ZÇĞİÖŞÜ]{1,2}-\s*/, "");
    const basliklar = new Map(katalog.map((m) => [m.modulKodu, m.baslik]));
    const sade = (m: ModulKaydi) => ({
      modulKodu: m.modulKodu,
      baslik: m.ustKodu ? `${harfsiz(basliklar.get(m.ustKodu) || "")} › ${harfsiz(m.baslik)}` : harfsiz(m.baslik),
      ustKodu: m.ustKodu,
    });
    return { degisiyor: true, acilacak: acilacak.map(sade), kapanacak: kapanacak.map(sade), kisitsizdi: simdiki === null };
  }

  /**
   * Yeni lisans kaydedildikten sonra (FirmaService.lisansEkle). Ürünler aynıysa (salt uzatma) modüllere dokunulmaz.
   * Ürün seçilmişse firmanın modülleri yeniden hesaplanır; ürünsüze dönülürse modüller olduğu gibi kalır, istisnalar silinir.
   */
  public static async lisansUrunleriniUygula(
    yapan: AdminBaglam,
    firmaId: number,
    lisansId: number,
    eskiUrunler: string[],
    yeniUrunler: string[]
  ): Promise<{ moduller: "AYNI" | "HESAPLANDI" | "URUNSUZ" }> {
    await PaketSqlRepository.lisansUrunleriniYaz(lisansId, yeniUrunler);
    if (ayniUrunler(eskiUrunler, yeniUrunler)) return { moduller: "AYNI" };
    if (yeniUrunler.length === 0) {
      await PaketSqlRepository.istisnalariYaz(firmaId, [], [], yapan.adminId);
      return { moduller: "URUNSUZ" };
    }
    if (eskiUrunler.length === 0) await PaketSqlRepository.istisnalariYaz(firmaId, [], [], yapan.adminId);
    const eski = await ModulSqlRepository.firmaAcikModulleri(firmaId);
    const son = await this.firmayiHesapla(firmaId, yeniUrunler, yapan.adminId);
    ModulService.onbellegiTemizle();
    const eskiKume = new Set(eski ?? []);
    const sonKume = new Set(son);
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "MODUL_DEGISTI",
      hedefTur: "FIRMA",
      hedefId: firmaId,
      eski: { kisitsiz: eski === null, urunler: eskiUrunler },
      yeni: {
        urunler: yeniUrunler,
        acilan: eski === null ? [] : son.filter((k) => !eskiKume.has(k)),
        kapanan: (eski ?? []).filter((k) => !sonKume.has(k)),
      },
    });
    return { moduller: "HESAPLANDI" };
  }

  /** Katalog değişince (menüye sayfa eklendi / kalktı): ERP ("hepsi") firmaları yeni sayfayı açık görsün. */
  public static async katalogDegisti(adminId: number): Promise<void> {
    if (!(await PaketSqlRepository.semaVarMi())) return;
    const firmalar = (await PaketSqlRepository.urunluFirmalar()).filter((f) => f.urunler.includes("erp"));
    if (firmalar.length === 0) return;
    const katalog = await ModulSqlRepository.katalog();
    const paketler = await PaketSqlRepository.paketler();
    for (const f of firmalar) await this.firmayiHesapla(f.firmaId, f.urunler, adminId, katalog, paketler);
  }
}
