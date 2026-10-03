import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { DogrulamaSonucu, PosAdminSqlRepository } from "../../models/admin/posAdminSql.repository.js";
import { PosEntegrasyonSqlRepository } from "../../models/posEntegrasyonSql.repository.js";
import { AdminBaglam } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { sifrele } from "../../utils/kripto.utils.js";
import { PosService } from "../pos/pos.service.js";
import { DbContext, MODELLER, PosEntegrasyon, PosMod } from "../pos/pos.types.js";
import { PosMerkezService } from "../pos/posMerkez.service.js";
import { tokenKimlikTesti } from "../pos/token.surucu.js";
import { firmaDbContextHazirla } from "./firmaBaglanti.service.js";

// Yönetim paneli > POS Entegrasyonu — docs/POS_ENTEGRASYON_YOL_HARITASI.md, 3.5
// Merkezi ayarlar, firma bazında POS modu, doğrulama senaryoları (kabul ölçütü, K27) ve geçici test konsolu.

/**
 * Doğrulama senaryoları. Bir cihaz modelinde hepsi Geçti olunca o model "Doğrulandı" sayılır.
 * beklenen: test konsolundaki denemenin bu senaryoda vermesi gereken sonuç (ekran Geçti / Kaldı önerir; işareti admin koyar).
 */
export const POS_SENARYOLARI: { no: number; ad: string; gecmeSarti: string; beklenen: string | null }[] = [
  { no: 1, ad: "Bağlantı", gecmeSarti: "Kimlik alınıyor, cihaz görünüyor", beklenen: "BAGLANTI" },
  { no: 2, ad: "Tek kart, tam tutar", gecmeSarti: "Onay geldi; banka, onay kodu ve fiş no döndü; bilgi fişi basıldı", beklenen: "ONAY" },
  { no: 3, ad: "Taksitli çekim", gecmeSarti: "Taksit sayısı sonuçta geldi", beklenen: "ONAY" },
  { no: 4, ad: "Nakit + kart", gecmeSarti: "Yalnızca kart tutarı çekildi, tek belgeye bağlandı", beklenen: "ONAY" },
  { no: 5, ad: "İki ayrı kart", gecmeSarti: "İki ayrı onay, tek belge", beklenen: "ONAY" },
  { no: 6, ad: "Kart reddi", gecmeSarti: "Ret döndü, fiş kaydedilmedi", beklenen: "RET" },
  { no: 7, ad: "Cihazdan vazgeçme", gecmeSarti: "İptal döndü", beklenen: "IPTAL" },
  { no: 8, ad: "Cihaz kapalı / internetsiz", gecmeSarti: "Belirsiz'e düştü, elle işaret çalıştı", beklenen: "BELIRSIZ" },
  { no: 9, ad: "Cihaz meşgulken ikinci istek", gecmeSarti: "İkinci istek \"cihaz meşgul\" diye reddedildi", beklenen: "MESGUL" },
  { no: 10, ad: "Aynı istek iki kez gitti", gecmeSarti: "Mükerrer çekim yok, aynı işlem döndü", beklenen: "AYNI" },
  { no: 11, ad: "Sonuç gecikmeli ya da iki kez geldi", gecmeSarti: "Tek kayıt, sonuç bir kez yazıldı", beklenen: null },
  { no: 12, ad: "e-Arşiv ve e-Fatura bilgi fişi", gecmeSarti: "İkisi de doğru başlıkla basıldı", beklenen: "ONAY" },
  { no: 13, ad: "Gün sonu / Z raporu", gecmeSarti: "Programdan tetiklendi (cihaz destekliyorsa)", beklenen: null },
];

const MODEL_ENTEGRASYONU: { model: string; entegrasyon: PosEntegrasyon; ad: string }[] = [
  ...MODELLER.beko.map((model) => ({ model, entegrasyon: "beko" as const, ad: `Beko ${model}` })),
  ...MODELLER.inpos.map((model) => ({ model, entegrasyon: "inpos" as const, ad: `Inpos ${model}` })),
];

const temiz = (v: unknown, azami: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, azami) : null;
};

const adres = (v: unknown, alan: string): string | null => {
  const s = temiz(v, 300);
  if (s && !/^https?:\/\/[^\s]+$/i.test(s)) throw ApiError.badRequest(`${alan} http:// ya da https:// ile başlayan bir adres olmalıdır.`);
  return s ? s.replace(/\/+$/, "") : null;
};

/** POS tabloları merkezde henüz kurulmamış (docs/sql/LIKYA_ADMIN_POS.sql çalıştırılmamış) */
const tabloYok = (err: any): boolean => err?.number === 208 || /Invalid object name/i.test(String(err?.message || ""));
const kurulumHatasi = (): ApiError =>
  ApiError.conflict("POS tabloları merkez veritabanında kurulmamış. Sunucuda docs/sql/LIKYA_ADMIN_POS.sql betiğini çalıştırın.");

const kurulu = async <T>(is: () => Promise<T>): Promise<T> => {
  try {
    return await is();
  } catch (err) {
    throw tabloYok(err) ? kurulumHatasi() : err;
  }
};

// Test konsolu işlemi saniyede bir yoklar; her yoklamada firma bağlantısını yeniden sınamamak için kısa süre saklanır
const BAGLAM_ONBELLEK_MS = 5 * 60 * 1000;
const baglamlar = new Map<number, { ctx: DbContext; zaman: number }>();
const firmaBaglami = async (firmaId: number): Promise<DbContext> => {
  if (!Number.isInteger(firmaId) || firmaId <= 0) throw ApiError.badRequest("Firma seçilmelidir.");
  const kayit = baglamlar.get(firmaId);
  if (kayit && Date.now() - kayit.zaman < BAGLAM_ONBELLEK_MS) return kayit.ctx;
  const ctx = await firmaDbContextHazirla(firmaId);
  baglamlar.set(firmaId, { ctx, zaman: Date.now() });
  return ctx;
};

export class PosAdminService {
  // ─── Merkezi ayarlar ───────────────────────────────────────────────────────

  /** Şifre hiçbir zaman geri dönmez; yalnızca tanımlı olup olmadığı bildirilir. */
  public static async ayarGetir() {
    let a = null;
    let tablolarKurulu = true;
    try {
      a = await PosAdminSqlRepository.ayarGetir();
    } catch (err) {
      if (!tabloYok(err)) throw err;
      tablolarKurulu = false;
    }
    return {
      tablolarKurulu,
      tokenClientId: a?.tokenClientId ?? "",
      tokenClientSecretTanimli: Boolean(a?.tokenClientSecretSifreli),
      tokenAuthUrl: a?.tokenAuthUrl ?? "",
      tokenApiUrl: a?.tokenApiUrl ?? "",
      donusKok: a?.donusKok ?? "",
      inposUygulamaNo: a?.inposUygulamaNo ?? "",
      guncellemeTarihi: a?.guncellemeTarihi ?? null,
    };
  }

  public static async ayarKaydet(yapan: AdminBaglam, g: Record<string, unknown>) {
    const tokenClientId = temiz(g.tokenClientId, 200);
    const secret = temiz(g.tokenClientSecret, 500);
    await kurulu(() =>
      PosAdminSqlRepository.ayarKaydet(
        {
          tokenClientId,
          // Kimlik silindiyse şifresi de silinir; yeni şifre girilmediyse kayıtlı olan korunur
          tokenClientSecretSifreli: !tokenClientId ? null : secret ? sifrele(secret) : undefined,
          tokenAuthUrl: adres(g.tokenAuthUrl, "Token kimlik adresi"),
          tokenApiUrl: adres(g.tokenApiUrl, "Token servis adresi"),
          donusKok: adres(g.donusKok, "Sunucunun dış adresi"),
          inposUygulamaNo: temiz(g.inposUygulamaNo, 50),
        },
        yapan.adminId
      )
    );
    await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "POS_AYAR_DEGISTI", yeni: { tokenClientId, sifreDegisti: Boolean(secret) } });
    return this.ayarGetir();
  }

  // ─── Firma bazında mod ─────────────────────────────────────────────────────

  public static async firmaModu(firmaId: number): Promise<{ mod: PosMod; tablolarKurulu: boolean }> {
    if (!(await FirmaSqlRepository.idIleBul(firmaId))) throw ApiError.notFound("Firma bulunamadı.");
    try {
      return { mod: (await PosAdminSqlRepository.firmaModu(firmaId)) ?? "kapali", tablolarKurulu: true };
    } catch (err) {
      if (!tabloYok(err)) throw err;
      return { mod: "kapali", tablolarKurulu: false };
    }
  }

  public static async firmaModuYaz(yapan: AdminBaglam, firmaId: number, mod: unknown) {
    if (mod !== "kapali" && mod !== "test" && mod !== "canli") throw ApiError.badRequest("POS modu geçersiz.");
    const eski = await this.firmaModu(firmaId);
    await kurulu(() => PosAdminSqlRepository.firmaModuYaz(firmaId, mod, yapan.adminId));
    PosMerkezService.onbellegiTemizle();
    await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "POS_MOD_DEGISTI", hedefTur: "FIRMA", hedefId: firmaId, eski: { mod: eski.mod }, yeni: { mod } });
    return this.firmaModu(firmaId);
  }

  // ─── Doğrulama (kabul ölçütü) ──────────────────────────────────────────────

  public static async dogrulama() {
    const isaretler = await kurulu(() => PosAdminSqlRepository.dogrulamalar());
    return {
      modeller: MODEL_ENTEGRASYONU.map((m) => {
        const senaryolar = POS_SENARYOLARI.map((s) => {
          const i = isaretler.find((x) => x.model === m.model && x.senaryoNo === s.no);
          return { ...s, sonuc: i?.sonuc ?? null, notu: i?.notu ?? null, admin: i?.admin ?? null, tarih: i?.tarih ?? null };
        });
        const gecen = senaryolar.filter((s) => s.sonuc === "GECTI");
        return {
          ...m,
          senaryolar,
          gecenAdet: gecen.length,
          dogrulandi: gecen.length === senaryolar.length,
          // Doğrulanma tarihi: en son Geçti işaretinin tarihi
          dogrulamaTarihi: gecen.length === senaryolar.length ? gecen.map((s) => s.tarih!).sort((a, b) => +new Date(b) - +new Date(a))[0] : null,
        };
      }),
    };
  }

  public static async dogrulamaYaz(yapan: AdminBaglam, g: Record<string, unknown>) {
    const model = MODEL_ENTEGRASYONU.find((m) => m.model === g.model)?.model;
    const senaryo = POS_SENARYOLARI.find((s) => s.no === Number(g.senaryoNo));
    if (!model || !senaryo) throw ApiError.badRequest("Model ya da senaryo geçersiz.");
    const sonuc: DogrulamaSonucu | null = g.sonuc === "GECTI" || g.sonuc === "KALDI" ? g.sonuc : null;
    await kurulu(() => PosAdminSqlRepository.dogrulamaYaz(model, senaryo.no, sonuc, temiz(g.notu, 300), yapan.adminId));
    await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "POS_DOGRULAMA", hedefTur: "POS_MODEL", hedefId: model, yeni: { senaryo: senaryo.no, sonuc } });
    return this.dogrulama();
  }

  // ─── Test konsolu ──────────────────────────────────────────────────────────

  public static async konsolFirmalar() {
    return kurulu(() => PosAdminSqlRepository.acikFirmalar());
  }

  public static async konsolTerminaller(firmaId: number) {
    return PosEntegrasyonSqlRepository.terminalleriListele(await firmaBaglami(firmaId));
  }

  public static async kimlikTesti(): Promise<{ ayrinti: string }> {
    return { ayrinti: await kurulu(() => tokenKimlikTesti()) };
  }

  /** gercek=false → sahte cihaz; gercek=true → firmanın modundan bağımsız, gerçek cihaz servisi. */
  public static async konsolBaglantiTesti(firmaId: number, posTerminalId: number, gercek: boolean) {
    return kurulu(async () => PosService.baglantiTesti(posTerminalId, {}, await firmaBaglami(firmaId), { mod: gercek ? "canli" : "test", firmaId }));
  }

  /**
   * Deneme tahsilatı. Gerçek cihaza gönderilirse kart okutulduğunda PARA ÇEKİLİR; bu yüzden her gerçek deneme
   * işlem kaydına yazılır (K27). Deneme işlemleri firmanın POS İşlemleri ekranında görünmez.
   */
  public static async konsolDeneme(yapan: AdminBaglam, firmaId: number, g: Record<string, unknown>) {
    const gercek = g.gercek === true;
    const ctx = await firmaBaglami(firmaId);
    const islem = await kurulu(() =>
      PosService.baslat(
        { istekKimlik: String(g.istekKimlik || ""), posTerminalId: Number(g.posTerminalId), tutar: Number(g.tutar), belgeTuru: "deneme", belgeNo: temiz(g.belgeNo, 50), belgeTipi: String(g.belgeTipi || "") },
        {},
        null,
        ctx,
        { mod: gercek ? "canli" : "test", firmaId }
      )
    );
    if (gercek) {
      await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "POS_DENEME", hedefTur: "FIRMA", hedefId: firmaId, yeni: { posIslemId: islem.posIslemId, tutar: islem.tutar, cihaz: islem.terminalAd } });
    }
    return islem;
  }

  public static async konsolIslem(firmaId: number, posIslemId: number) {
    return PosService.getir(posIslemId, await firmaBaglami(firmaId));
  }

  public static async konsolIptal(firmaId: number, posIslemId: number) {
    return PosService.iptal(posIslemId, await firmaBaglami(firmaId));
  }

  public static async konsolElle(firmaId: number, posIslemId: number, alindi: boolean) {
    return PosService.elleIsaretle(posIslemId, alindi, null, await firmaBaglami(firmaId));
  }

  public static async log(limit: number) {
    return kurulu(() => PosAdminSqlRepository.logListele(limit));
  }
}
