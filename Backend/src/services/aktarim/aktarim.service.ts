import crypto from "crypto";
import path from "path";
import sql from "mssql";
import { AyarSqlRepository } from "../../models/admin/ayarSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { KullaniciSqlRepository } from "../../models/admin/kullaniciSql.repository.js";
import { IzlemeSqlRepository } from "../../models/admin/izlemeSql.repository.js";
import { veritabaniHavuzlariniKapat } from "../../config/mssql.config.js";
import { AdminBaglam, FirmaDto } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { FirmaService } from "../admin/firma.service.js";
import { klonHavuzu, klonYapilandirildiMi } from "../admin/klon.service.js";
import { AktarimYukleme, YuklemeBilgisi } from "./aktarimYukleme.js";
import { Engel, IncelemeOzeti, YedekSeti, geciciAc, geciciHazirMi, geciciSil, geciciVarMi, incele, setSec, sunucuAnaSurumu, yedekBasligi, yedekEngelleri } from "./aktarimInceleme.js";
import { AktarimDogrulamaHatasi, AktarimEngeli, AktarimSonucu, aktar, planHazirla } from "./aktarimMotoru.js";
import { AktarimPlani, DOKUNULMAZ_TABLOLAR, SABLON_KALIR_TABLOLARI } from "./aktarimPlani.js";
import { n, q } from "./aktarimSema.js";
import { DogrulamaRaporu, dogrula, veritabanlariniDogrula } from "./aktarimDogrulama.js";
import { CiftRolu, CiftSecenekleri, ciftKontrolleri, digerVeritabaniKurali } from "./aktarimCift.js";
import { ciftSecenekleri, standartEkAdimlar } from "./aktarimCli.js";

/**
 * Admin paneli: firmanın içinden eski programın yedeğini yükleyip aktarma (docs/VERITABANI_TASIMA_YOL_HARITASI.md, K6).
 * Yüklemeler <YEDEK_KLASORU>\Aktarim altında tutulur (SQL Server bu klasörü okuyabilmeli, bölüm 6).
 * İnceleme, aktarım ve doğrulama arka planda iş olarak çalışır; panel işin durumunu sorar. Bir firmada aynı anda tek iş.
 * Sonuçlar yükleme klasöründe JSON (inceleme.json, rapor.json, dogrulama.json) ve işlem kaydında tutulur.
 */

export const aktarimKoku = async (): Promise<string> => path.win32.join(await AyarSqlRepository.oku("YEDEK_KLASORU"), "Aktarim");

const yukleyici = async (): Promise<AktarimYukleme> => new AktarimYukleme(await aktarimKoku());

/** Aktarım yalnız sunucumuzdaki (bulut) ve silinmemiş firmaya yapılır. */
export const aktarilabilirFirma = async (firmaId: number): Promise<FirmaDto> => {
  const firma = await FirmaService.getir(firmaId);
  if (firma.baglantiModu !== "cloud") {
    throw ApiError.badRequest("Panelden veri aktarımı yalnız sunucumuzdaki (bulut) firmalara yapılır. Kurulum (exe) firmalarında programın Kurulum ekranı kullanılır.");
  }
  if (firma.durum === "SILINECEK" || firma.durum === "SILINDI") throw ApiError.badRequest("Firma silinmiş ya da silinmek üzere.");
  return firma;
};

const yuklemeFirmaDenetimi = (b: YuklemeBilgisi, firmaId: number): YuklemeBilgisi => {
  if (b.firmaId !== firmaId) throw ApiError.notFound("Yükleme bu firmaya ait değil.");
  return b;
};

export const geciciDbAdi = (yuklemeId: string): string => `LKY_AKTARIM_${yuklemeId}`;

// ------------------------------------------------------------------ işler

export type IsTuru = "INCELE" | "AKTAR" | "DOGRULA";
export interface AktarimIsi {
  isId: string;
  firmaId: number;
  yuklemeId: string;
  tur: IsTuru;
  durum: "CALISIYOR" | "BITTI" | "HATA";
  adim: string;
  yuzde: number;
  mesaj: string;
  baslangic: string;
  bitis: string | null;
  hata: string | null;
}

const isler = new Map<string, AktarimIsi>();
const calisanFirmalar = new Set<number>();
const AKTARIM_ZAMAN_ASIMI_MS = 4 * 60 * 60 * 1000;

/**
 * ekKilit: çift aktarımında eş firma. Aktarım eşin veritabanına da yazar (yetki, fiş eşlemesi, tetikler); iki taraf aynı anda
 * çalışırsa kilitlenip biri geri alınırdı. Eş de iş bitene kadar meşgul sayılır.
 */
const isBaslat = (firmaId: number, yuklemeId: string, tur: IsTuru, calis: (is: AktarimIsi) => Promise<void>, ekKilit: number[] = []): AktarimIsi => {
  if (calisanFirmalar.has(firmaId)) throw ApiError.conflict("Bu firmada şu anda bir aktarım işi çalışıyor; bitmesini bekleyin.");
  if (ekKilit.some((f) => calisanFirmalar.has(f))) throw ApiError.conflict("Eş firmada şu anda bir aktarım işi çalışıyor; bitmesini bekleyin.");
  for (const f of [firmaId, ...ekKilit]) calisanFirmalar.add(f);
  const is: AktarimIsi = {
    isId: crypto.randomBytes(8).toString("hex"),
    firmaId,
    yuklemeId,
    tur,
    durum: "CALISIYOR",
    adim: "BASLA",
    yuzde: 0,
    mesaj: "Başlatıldı",
    baslangic: new Date().toISOString(),
    bitis: null,
    hata: null,
  };
  isler.set(is.isId, is);
  void (async () => {
    try {
      await calis(is);
      is.durum = "BITTI";
      is.yuzde = 100;
    } catch (err: any) {
      is.durum = "HATA";
      is.hata = String(err?.message || err).slice(0, 1000);
      logger.error(`[AKTARIM] ${tur} firma ${firmaId} / ${yuklemeId}: ${is.hata}`);
    } finally {
      is.bitis = new Date().toISOString();
      for (const f of [firmaId, ...ekKilit]) calisanFirmalar.delete(f);
      // Eski işleri bellekten at (son 50)
      if (isler.size > 50) for (const k of [...isler.keys()].slice(0, isler.size - 50)) isler.delete(k);
    }
  })();
  return is;
};

const ilerle = (is: AktarimIsi, adim: string, yuzde: number, mesaj: string) => Object.assign(is, { adim, yuzde, mesaj });

/** Hazır yüklemenin yedeğini geçici veritabanı olarak açar (zaten açıksa dokunmaz). */
const geciciHazirla = async (pool: sql.ConnectionPool, b: YuklemeBilgisi, is: AktarimIsi): Promise<{ set: YedekSeti; engeller: Engel[]; gecici: string }> => {
  if (b.durum !== "HAZIR" || !b.yedekYolu) throw ApiError.badRequest("Yükleme tamamlanmamış.");
  await sahipsizGecicileriSil(pool, await yukleyici());
  ilerle(is, "BASLIK", 3, "Yedek başlığı okunuyor");
  const setler = await yedekBasligi(pool, b.yedekYolu);
  const engeller = yedekEngelleri(setler, await sunucuAnaSurumu(pool));
  const set = setSec(setler);
  const gecici = geciciDbAdi(b.yuklemeId);
  if (!set || engeller.some((e) => e.seviye === "ENGEL")) return { set: set ?? setler[0], engeller, gecici };
  // Yarım açılmış (giremediğimiz ya da salt okunur olmayan) geçici veritabanı kaldırılıp yeniden açılır
  if ((await geciciVarMi(pool, gecici)) && !(await geciciHazirMi(pool, gecici))) {
    ilerle(is, "AC", 6, "Yarım kalmış geçici veritabanı kaldırılıyor");
    await geciciSil(pool, gecici);
  }
  if (!(await geciciVarMi(pool, gecici))) {
    ilerle(is, "AC", 8, "Yedek geçici olarak açılıyor");
    await geciciAc(pool, b.yedekYolu, gecici, set.position);
  }
  return { set, engeller, gecici };
};

const havuz = () => klonHavuzu("master", { requestTimeoutMs: AKTARIM_ZAMAN_ASIMI_MS });

/** Yüklemesi silinmiş / süresi dolmuş yüklemelerin geçici veritabanlarını kaldırır (işlerin başında, hata yutulur). */
const sahipsizGecicileriSil = async (pool: sql.ConnectionPool, y: AktarimYukleme): Promise<string[]> => {
  const silinen: string[] = [];
  try {
    y.eskileriTemizle();
    const adlar = ((await new sql.Request(pool).query(`SELECT name AS N FROM sys.databases WHERE name LIKE 'LKY[_]AKTARIM[_]%'`)).recordset as any[]).map((x) => String(x.N));
    const calisan = new Set([...isler.values()].filter((i) => i.durum === "CALISIYOR").map((i) => i.yuklemeId));
    for (const ad of adlar) {
      const id = ad.slice("LKY_AKTARIM_".length);
      if (!/^[a-f0-9]{24}$/.test(id) || calisan.has(id)) continue;
      let var_ = true;
      try {
        y.oku(id);
      } catch {
        var_ = false;
      }
      if (!var_) {
        await geciciSil(pool, ad);
        silinen.push(ad);
      }
    }
  } catch (err: any) {
    logger.warn(`[AKTARIM] sahipsiz geçici veritabanı temizliği: ${err?.message}`);
  }
  return silinen;
};

export interface IncelemeSonucu {
  ozet: IncelemeOzeti | null;
  engeller: Engel[];
  plan: { kopyalanacak: number; sablonTemizlenecek: string[]; kurallar: { tablo: string; kolon: string; aciklama: string }[]; bosBirakilan: number } | null;
  firmaDolu: { fis: number; sarrafFisi: number; kullanici: number } | null;
  esAdaylari: { firmaId: number; firmaKodu: string; unvan: string; dbName: string }[];
  onerilenRol: CiftRolu | null;
  zaman: string;
}

export interface AktarimRaporu {
  basarili: boolean;
  hata: string | null;
  engeller: Engel[];
  aktarim: AktarimSonucu | null;
  dogrulama: DogrulamaRaporu | null;
  cift: (Omit<CiftSecenekleri, "kaynakDb"> & { esFirmaId: number }) | null;
  kullaniciEslemesi: number;
  yapan: string;
  zaman: string;
}

const jsonOku = <T>(y: AktarimYukleme, yuklemeId: string, ad: string): T | null => {
  const m = y.dosyaOku(yuklemeId, ad);
  return m ? (JSON.parse(m) as T) : null;
};

/**
 * Yanlış firmaya yedek koruması (simülasyonda bulundu, 17.11.2026): R'nin yedeği A firmasına bırakılınca yalnız genel
 * "firmada fiş var" uyarısı çıkıyordu. Şimdi:
 *  - firmanın VKN'si ile yedekteki VKN farklıysa,
 *  - bu firmaya daha önce FARKLI bir eski veritabanı başarıyla aktarıldıysa,
 *  - bu yedek (aynı eski veritabanı + VKN) daha önce BAŞKA bir firmaya aktarıldıysa
 * YANLIS_FIRMA engeli verilir; yönetici "bu yedeğin bu firmaya ait olduğunu kontrol ettim" (firmaOnay) ile geçebilir.
 */
export const yanlisFirmaSuphesi = (y: AktarimYukleme, firma: FirmaDto, ozet: IncelemeOzeti, yuklemeId: string, firmaKodlari: Map<number, string>): Engel[] => {
  const e: Engel[] = [];
  const db = ozet.yedek.dbAdi.trim().toUpperCase();
  const vkn = (ozet.firma.vkn || "").trim();
  if (firma.vknTckn && vkn && firma.vknTckn.trim() !== vkn) {
    e.push({ kod: "YANLIS_FIRMA", seviye: "ENGEL", mesaj: `Firmanın VKN'si (${firma.vknTckn}) yedekteki VKN'den (${vkn}) farklı. Yedek bu firmaya ait olmayabilir.` });
  }
  for (const b of y.listele()) {
    if (b.yuklemeId === yuklemeId || b.durum !== "HAZIR") continue;
    const r = jsonOku<AktarimRaporu>(y, b.yuklemeId, "rapor.json");
    if (!r?.basarili) continue;
    const ins = jsonOku<IncelemeSonucu>(y, b.yuklemeId, "inceleme.json");
    const eskiDb = (ins?.ozet?.yedek.dbAdi || "").trim().toUpperCase();
    if (!eskiDb) continue;
    const zaman = new Date(r.zaman).toLocaleString("tr-TR");
    if (b.firmaId === firma.firmaId && eskiDb !== db) {
      e.push({
        kod: "YANLIS_FIRMA",
        seviye: "ENGEL",
        mesaj: `Bu firmaya ${zaman} tarihinde ${ins!.ozet!.yedek.dbAdi} aktarıldı; bu yedek ${ozet.yedek.dbAdi}. Yanlış firmaya yüklüyor olabilirsiniz.`,
      });
    }
    if (b.firmaId !== firma.firmaId && eskiDb === db && (ins!.ozet!.firma.vkn || "").trim() === vkn) {
      e.push({
        kod: "YANLIS_FIRMA",
        seviye: "ENGEL",
        mesaj: `Bu yedek (${ozet.yedek.dbAdi}) ${zaman} tarihinde ${firmaKodlari.get(b.firmaId ?? 0) || `#${b.firmaId}`} firmasına aktarıldı. Aynı yedek iki firmaya aktarılmamalı.`,
      });
    }
  }
  return e.filter((x, i) => e.findIndex((z) => z.mesaj === x.mesaj) === i);
};

/**
 * Firma bizim sistemde kullanılmış mı (K22, 17.11.2026 senaryo denetimi). Aktarım firmadaki verileri yedektekilerle DEĞİŞTİRİR:
 *  - CANLI_FIRMA (ENGEL, onayla geçilmez): firmadan bizim sistemle e-belge gönderilmiş → firma canlı; aktarım bizim sistemde girilen
 *    bütün fişleri silerdi. Aktarım işinin başında da yeniden denetlenir.
 *  - FIRMADA_KAYIT (UYARI): yalnız bizim şemada olan tablolarda (perakende fişi, bakiye düzeltme, hızlı satış …) kayıt var. Yeniden
 *    aktarım bu tablolara dokunmaz; silinen fişlere / bakiyeye bağlı olanlar tutarsız kalabilir (geçiş günü kuralı ayrıca kararlaştırılacak).
 */
export const firmaKullanimi = async (pool: sql.ConnectionPool, firmaDb: string, plan: AktarimPlani | null): Promise<Engel[]> => {
  const e: Engel[] = [];
  const tam = (tablo: string) => `${q(firmaDb)}.dbo.${q(tablo)}`;
  const var_ = async (tablo: string, kolon?: string) =>
    (await new sql.Request(pool).query(kolon ? `SELECT COL_LENGTH(${n(`${firmaDb}.dbo.${tablo}`)}, ${n(kolon)}) AS L` : `SELECT OBJECT_ID(${n(`${firmaDb}.dbo.${tablo}`)}) AS L`)).recordset[0].L !== null;
  const say = async (sorgu: string) => Number((await new sql.Request(pool).query(sorgu)).recordset[0].N) || 0;

  if (await var_("TODVZ_EBELGE_GIDEN", "GONDERIM_DURUMU")) {
    // Taslak (deneme) gönderimleri sayılmaz: yalnız gerçekten kesilmiş belgeler firmayı "canlı" yapar
    const taslakDisi = (await var_("TODVZ_EBELGE_GIDEN", "TASLAK_MI")) ? " AND ISNULL(TASLAK_MI, 0) = 0" : "";
    const giden = await say(`SELECT COUNT_BIG(*) AS N FROM ${tam("TODVZ_EBELGE_GIDEN")} WHERE GONDERIM_DURUMU = 'GONDERILDI'${taslakDisi}`);
    if (giden > 0) {
      e.push({
        kod: "CANLI_FIRMA",
        seviye: "ENGEL",
        mesaj: `Bu firmadan bizim sistemle ${giden} e-belge gönderilmiş: firma canlı kullanımda. Aktarım, bizim sistemde girilen bütün kayıtları yedektekilerle değiştirir; bu firmaya aktarım yapılamaz.`,
      });
    }
  }
  if (plan) {
    const haric = new Set([...SABLON_KALIR_TABLOLARI, ...DOKUNULMAZ_TABLOLAR, "TODVZ_EBELGE_KAYNAK"]);
    const kayitlar = plan.tablolar
      .filter((t) => t.islem === "SABLON_KORU" && t.hedefSatir > 0 && !haric.has(t.tablo.toUpperCase()) && !/^(LKY_DESTEK_|YWS_)/i.test(t.tablo))
      .map((t) => ({ tablo: t.tablo, satir: t.hedefSatir }));
    // e-Belge kaynak işaretleri: önceki aktarımın "eski programla gönderildi" kayıtları sayılmaz (onları aktarım kendisi yazar)
    if (await var_("TODVZ_EBELGE_KAYNAK")) {
      const bizim = await say(`SELECT COUNT_BIG(*) AS N FROM ${tam("TODVZ_EBELGE_KAYNAK")} WHERE NOT (DURUM = 'GONDERILDI' AND HATA LIKE N'Eski programla gönderildi%')`);
      if (bizim > 0) kayitlar.push({ tablo: "TODVZ_EBELGE_KAYNAK", satir: bizim });
    }
    if (kayitlar.length) {
      e.push({
        kod: "FIRMADA_KAYIT",
        seviye: "UYARI",
        mesaj: `Firmada bizim sistemde girilmiş kayıtlar var (${kayitlar.map((k) => `${k.tablo} ${k.satir}`).join(", ")}). Aktarım bu tablolara dokunmaz; silinen fişlere ya da bakiyeye bağlı olanlar tutarsız kalabilir. Geçiş gününde yeniden aktarmadan önce bu kayıtlar temizlenmeli.`,
      });
    }
  }
  return e;
};

const firmaKodlari = async (): Promise<Map<number, string>> => new Map((await FirmaService.listele()).map((f) => [f.firmaId, f.firmaKodu]));

export class AktarimService {
  // ---------------------------------------------------------------- yükleme (Faz 1)
  public static async yuklemeBaslat(firmaId: number, girdi: { dosyaAdi: string; boyut: number }): Promise<YuklemeBilgisi> {
    await aktarilabilirFirma(firmaId);
    return (await yukleyici()).baslat({ ...girdi, firmaId });
  }

  public static async parca(firmaId: number, yuklemeId: string, sira: number, veri: Buffer, sha256?: string | null): Promise<{ alinan: number; parcaSayisi: number }> {
    const y = await yukleyici();
    yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
    const b = y.parcaYaz(yuklemeId, sira, veri, sha256);
    return { alinan: b.alinan.length, parcaSayisi: b.parcaSayisi };
  }

  public static async yuklemeBitir(yapan: AdminBaglam, firmaId: number, yuklemeId: string): Promise<YuklemeBilgisi> {
    const y = await yukleyici();
    yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
    const b = await y.bitir(yuklemeId);
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "VERI_AKTARIM_YUKLENDI",
      hedefTur: "FIRMA",
      hedefId: firmaId,
      yeni: { yuklemeId, dosyaAdi: b.dosyaAdi, boyut: b.boyut, yedekBoyutu: b.yedekBoyutu },
    });
    return b;
  }

  public static async yuklemeler(firmaId: number): Promise<(YuklemeBilgisi & { incelendi: boolean; aktarildi: boolean | null; dogrulandi: boolean | null })[]> {
    await FirmaService.getir(firmaId);
    const y = await yukleyici();
    return y.listele(firmaId).map((b) => ({
      ...b,
      incelendi: !!y.dosyaOku(b.yuklemeId, "inceleme.json"),
      aktarildi: jsonOku<AktarimRaporu>(y, b.yuklemeId, "rapor.json")?.basarili ?? null,
      dogrulandi: jsonOku<DogrulamaRaporu>(y, b.yuklemeId, "dogrulama.json")?.basarili ?? null,
    }));
  }

  public static async yuklemeSil(firmaId: number, yuklemeId: string): Promise<void> {
    const y = await yukleyici();
    yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
    if (calisanFirmalar.has(firmaId)) throw ApiError.conflict("Firmada çalışan bir aktarım işi var.");
    // Geçici veritabanı kaldırılamazsa (SQL'e o an ulaşılamadı) yükleme yine silinir: sahipsiz kalan geçici
    // veritabanını sonraki işin başındaki temizlik (sahipsizGecicileriSil) kaldırır
    if (klonYapilandirildiMi()) {
      try {
        const pool = await havuz();
        try {
          await geciciSil(pool, geciciDbAdi(yuklemeId));
        } finally {
          await pool.close().catch(() => undefined);
        }
      } catch (err: any) {
        logger.warn(`[AKTARIM] ${yuklemeId} geçici veritabanı kaldırılamadı (sonraki işte temizlenir): ${err?.message}`);
      }
    }
    y.sil(yuklemeId);
  }

  // ---------------------------------------------------------------- işler
  public static isDurumu(firmaId: number, isId: string): AktarimIsi {
    const is = isler.get(isId);
    if (!is || is.firmaId !== firmaId) throw ApiError.notFound("İş bulunamadı (sunucu yeniden başlamış olabilir); raporu yükleme listesinden açın.");
    return is;
  }

  public static async raporlar(firmaId: number, yuklemeId: string): Promise<{ inceleme: IncelemeSonucu | null; rapor: AktarimRaporu | null; dogrulama: DogrulamaRaporu | null }> {
    const y = await yukleyici();
    yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
    return {
      inceleme: jsonOku<IncelemeSonucu>(y, yuklemeId, "inceleme.json"),
      rapor: jsonOku<AktarimRaporu>(y, yuklemeId, "rapor.json"),
      dogrulama: jsonOku<DogrulamaRaporu>(y, yuklemeId, "dogrulama.json"),
    };
  }

  /** Yedeği açar ve inceler; geçici veritabanı aktarım için açık kalır. */
  public static async inceleBaslat(firmaId: number, yuklemeId: string): Promise<AktarimIsi> {
    if (!klonYapilandirildiMi()) throw ApiError.badRequest("Bu sunucuda veritabanı işlemleri kapalı (klonlama hesabı tanımlı değil).");
    const firma = await aktarilabilirFirma(firmaId);
    const y = await yukleyici();
    const b = yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
    return isBaslat(firmaId, yuklemeId, "INCELE", async (is) => {
      const pool = await havuz();
      try {
        const { set, engeller, gecici } = await geciciHazirla(pool, b, is);
        const sonuc: IncelemeSonucu = { ozet: null, engeller: [...engeller], plan: null, firmaDolu: null, esAdaylari: [], onerilenRol: null, zaman: new Date().toISOString() };
        if (!engeller.some((e) => e.seviye === "ENGEL")) {
          ilerle(is, "INCELE", 40, "Yedek inceleniyor");
          const ozet = await incele(pool, gecici, set);
          sonuc.ozet = ozet;
          sonuc.engeller.push(...ozet.engeller);
          sonuc.engeller.push(...yanlisFirmaSuphesi(y, firma, ozet, yuklemeId, await firmaKodlari()));
          if (ozet.eskiProgram) {
            ilerle(is, "PLAN", 70, "Bizim şemayla eşleme ve kayıp denetimi");
            const { plan, engeller: planEngel } = await planHazirla(pool, gecici, firma.dbName, { degerKurallari: [digerVeritabaniKurali(null)] });
            sonuc.engeller.push(...planEngel);
            sonuc.engeller.push(...(await firmaKullanimi(pool, firma.dbName, plan)));
            sonuc.plan = {
              kopyalanacak: plan.tablolar.filter((t) => t.islem === "KOPYALA").length,
              sablonTemizlenecek: plan.tablolar.filter((t) => t.islem === "SABLON_TEMIZLE").map((t) => t.tablo),
              kurallar: plan.kurallar,
              bosBirakilan: plan.bosBirakilan.length,
            };
            const [d] = (await new sql.Request(pool).query(`
              SELECT (SELECT COUNT_BIG(*) FROM [${firma.dbName.replace(/]/g, "]]")}].dbo.TODVZ_FIS) AS F,
                     (SELECT COUNT_BIG(*) FROM [${firma.dbName.replace(/]/g, "]]")}].dbo.TODVZ_SARRAF_FISI) AS S,
                     (SELECT COUNT_BIG(*) FROM [${firma.dbName.replace(/]/g, "]]")}].dbo.TODVZ_KULLANICI) AS K`)).recordset as any[];
            sonuc.firmaDolu = { fis: Number(d.F), sarrafFisi: Number(d.S), kullanici: Number(d.K) };
            if (ozet.bagliVeritabanlari.length) {
              const tum = await FirmaService.listele();
              sonuc.esAdaylari = tum
                .filter((f) => f.firmaId !== firmaId && f.baglantiModu === "cloud" && f.durum !== "SILINDI" && (!firma.musteriNo || f.musteriNo === firma.musteriNo))
                .map((f) => ({ firmaId: f.firmaId, firmaKodu: f.firmaKodu, unvan: f.unvan, dbName: f.dbName }));
              sonuc.onerilenRol = ozet.alan.fisleriAktarilacak === true ? "CALISMA" : ozet.alan.fisleriAktarilacak === false ? "RESMI" : ozet.eDoviz.logVar ? "RESMI" : "CALISMA";
            }
          }
        }
        y.dosyaYaz(yuklemeId, "inceleme.json", JSON.stringify(sonuc));
        ilerle(is, "BITTI", 100, sonuc.engeller.some((e) => e.seviye === "ENGEL") ? "İnceleme bitti: aktarımı engelleyen durum var" : "İnceleme bitti");
      } finally {
        await pool.close().catch(() => undefined);
      }
    });
  }

  /** Aktarımı başlatır (onay: firma kodu). Firma veritabanındaki veriler yedektekilerle değişir; önce COPY_ONLY yedek alınır. */
  public static async aktarBaslat(
    yapan: AdminBaglam,
    firmaId: number,
    yuklemeId: string,
    girdi: { onay: string; esFirmaId?: number | null; rol?: CiftRolu | null; taslakOnay?: boolean | null; firmaOnay?: boolean | null }
  ): Promise<AktarimIsi> {
    if (!klonYapilandirildiMi()) throw ApiError.badRequest("Bu sunucuda veritabanı işlemleri kapalı (klonlama hesabı tanımlı değil).");
    const firma = await aktarilabilirFirma(firmaId);
    if (String(girdi.onay || "").trim().toUpperCase() !== firma.firmaKodu.toUpperCase()) {
      throw ApiError.badRequest("Onay için firma kodunu doğru yazın.");
    }
    const y = await yukleyici();
    const b = yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
    const inceleme = jsonOku<IncelemeSonucu>(y, yuklemeId, "inceleme.json");
    if (!inceleme) throw ApiError.badRequest("Önce yedeği inceleyin.");
    // Yanlış firmaya yedek: incelemeden sonra başka aktarım olmuş olabilir, yeniden denetlenir
    if (inceleme.ozet) {
      const supheler = yanlisFirmaSuphesi(y, firma, inceleme.ozet, yuklemeId, await firmaKodlari());
      if (supheler.length && !girdi.firmaOnay) {
        throw ApiError.badRequest(`Yedek bu firmaya ait görünmüyor: ${supheler.map((x) => x.mesaj).join(" ")} Kontrol ettiyseniz onay kutusunu işaretleyin.`);
      }
    }
    let esFirma: FirmaDto | null = null;
    if (girdi.esFirmaId) {
      if (girdi.esFirmaId === firmaId) throw ApiError.badRequest("Firma kendisinin eşi olamaz.");
      esFirma = await aktarilabilirFirma(girdi.esFirmaId);
      // K2: R ve A aynı müşteri numarasıyla açılır; başka müşterinin veritabanına tetik/yetki kurulmasın
      if ((firma.musteriNo || "") !== (esFirma.musteriNo || "")) throw ApiError.badRequest("Eş firma aynı müşteri numarasında olmalı.");
    }

    return isBaslat(firmaId, yuklemeId, "AKTAR", async (is) => {
      const pool = await havuz();
      const rapor: AktarimRaporu = {
        basarili: false,
        hata: null,
        engeller: [],
        aktarim: null,
        dogrulama: null,
        cift: null,
        kullaniciEslemesi: 0,
        yapan: yapan.kullaniciAdi,
        zaman: new Date().toISOString(),
      };
      try {
        const { set, engeller, gecici } = await geciciHazirla(pool, b, is);
        rapor.engeller.push(...engeller);
        if (engeller.some((e) => e.seviye === "ENGEL")) throw new Error("Yedek aktarılamaz (engel var).");
        // Canlı firma koruması: inceleme eski olabilir, aktarım anında yeniden bakılır
        const canli = (await firmaKullanimi(pool, firma.dbName, null)).filter((e) => e.seviye === "ENGEL");
        if (canli.length) {
          rapor.engeller.push(...canli);
          throw new Error(canli.map((e) => e.mesaj).join(" "));
        }
        ilerle(is, "INCELE", 10, "Yedek özeti");
        const ozet = await incele(pool, gecici, set);
        const cift = esFirma
          ? ciftSecenekleri(ozet, gecici, firma.dbName, { esHedefDb: esFirma.dbName, rol: girdi.rol ?? null, hedefGirisi: firma.dbUser, esGirisi: esFirma.dbUser })
          : null;
        if (cift && esFirma) rapor.cift = { hedefDb: cift.hedefDb, esHedefDb: cift.esHedefDb, esEskiAdi: cift.esEskiAdi, rol: cift.rol, hedefGirisi: cift.hedefGirisi, esGirisi: cift.esGirisi, esFirmaId: esFirma.firmaId };

        // Firmadaki oturumlar kapatılır, uygulamanın bağlantı havuzları bırakılır
        await IzlemeSqlRepository.oturumlariIptalEt({ firmaId }, yapan.adminId).catch(() => 0);
        await veritabaniHavuzlariniKapat(firma.dbServer, firma.dbName).catch(() => undefined);

        const dogrulamaTutucu: { r: DogrulamaRaporu | null } = { r: null };
        const d = new Date();
        const iki = (x: number) => String(x).padStart(2, "0");
        const damga = `${d.getFullYear()}${iki(d.getMonth() + 1)}${iki(d.getDate())}_${iki(d.getHours())}${iki(d.getMinutes())}${iki(d.getSeconds())}`;
        const onYedek = path.win32.join(await aktarimKoku(), yuklemeId, `once_${damga}.bak`);
        rapor.aktarim = await aktar({
          pool,
          kaynakDb: gecici,
          hedefDb: firma.dbName,
          onYedekYolu: onYedek,
          ilerleme: (a) => ilerle(is, a.adim, 10 + Math.round(a.yuzde * 0.85), a.mesaj),
          planSecenekleri: { degerKurallari: [digerVeritabaniKurali(cift)], taslakOnay: !!girdi.taslakOnay },
          ekAdimlar: (tx) => standartEkAdimlar(tx, gecici, firma.dbName, cift),
          dogrula: async (tx, plan) => {
            dogrulamaTutucu.r = await dogrula(tx, plan, { ekKontroller: (bg) => ciftKontrolleri(bg, { kaynakDb: gecici, hedefDb: firma.dbName, cift }) });
            return dogrulamaTutucu.r as unknown as { basarili: boolean };
          },
        });
        rapor.dogrulama = dogrulamaTutucu.r;
        rapor.basarili = true;
        // Buradan sonrası COMMIT'ten SONRA çalışır: veri yazıldı ve doğrulandı. Aşağıdaki yan adımlardan biri hata verirse
        // iş "hatalı" görünmemeli (yönetici başarılı aktarımı başarısız sanıp yeniden denerdi); hata günlüğe yazılır.
        y.dosyaYaz(yuklemeId, "rapor.json", JSON.stringify(rapor));

        // Merkez kullanıcılarının firma veritabanı kimlikleri ada göre yeniden bağlanır
        ilerle(is, "ESLEME", 97, "Merkez kullanıcı eşlemesi");
        try {
          const kullanicilar = (await new sql.Request(pool).query(`SELECT KULLANICI_ID AS I, RTRIM(AD) AS AD FROM [${firma.dbName.replace(/]/g, "]]")}].dbo.TODVZ_KULLANICI`)).recordset as any[];
          for (const k of kullanicilar) rapor.kullaniciEslemesi += await KullaniciSqlRepository.firmaDbKimligiGuncelle(firmaId, String(k.AD), Number(k.I)).catch(() => 0);
        } catch (err: any) {
          logger.warn(`[AKTARIM] firma ${firmaId}: aktarım tamamlandı, merkez kullanıcı eşlemesi yapılamadı: ${err?.message}`);
        }

        await AdminLogSqlRepository.islemLogu({
          adminId: yapan.adminId,
          islem: "VERI_AKTARILDI",
          hedefTur: "FIRMA",
          hedefId: firmaId,
          yeni: {
            yuklemeId,
            dosyaAdi: b.dosyaAdi,
            eskiDb: ozet.yedek.dbAdi,
            satir: rapor.aktarim.tablolar.reduce((x, t) => x + t.yazilan, 0),
            dogrulamaFark: rapor.dogrulama?.ozet.fark ?? null,
            cift: rapor.cift ? { es: rapor.cift.esHedefDb, rol: rapor.cift.rol } : null,
            onYedek,
          },
        }).catch(() => undefined);
        ilerle(is, "BITTI", 100, rapor.dogrulama?.basarili ? "Aktarım tamamlandı; doğrulama: kaynakla birebir aynı" : "Aktarım tamamlandı");
      } catch (err: any) {
        if (rapor.basarili) {
          // COMMIT'ten sonraki bir yan adım: aktarım geçerli, iş başarılı kalır
          logger.warn(`[AKTARIM] firma ${firmaId}: aktarım tamamlandı, son adımda uyarı: ${err?.message}`);
          ilerle(is, "BITTI", 100, "Aktarım tamamlandı");
          return;
        }
        rapor.hata = String(err?.message || err).slice(0, 1000);
        if (err instanceof AktarimEngeli) rapor.engeller.push(...err.engeller);
        if (err instanceof AktarimDogrulamaHatasi) rapor.dogrulama = err.dogrulama as unknown as DogrulamaRaporu;
        await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "VERI_AKTARIM_HATA", hedefTur: "FIRMA", hedefId: firmaId, yeni: { yuklemeId, hata: rapor.hata } }).catch(() => undefined);
        throw err;
      } finally {
        y.dosyaYaz(yuklemeId, "rapor.json", JSON.stringify(rapor));
        await geciciSil(pool, geciciDbAdi(yuklemeId)).catch(() => undefined);
        await pool.close().catch(() => undefined);
      }
    }, esFirma ? [esFirma.firmaId] : []);
  }

  /** Aktarımdan bağımsız doğrulama: yüklenen yedek ile firma veritabanını yeniden karşılaştırır. */
  public static async dogrulaBaslat(yapan: AdminBaglam, firmaId: number, yuklemeId: string): Promise<AktarimIsi> {
    if (!klonYapilandirildiMi()) throw ApiError.badRequest("Bu sunucuda veritabanı işlemleri kapalı (klonlama hesabı tanımlı değil).");
    const firma = await aktarilabilirFirma(firmaId);
    const y = await yukleyici();
    const b = yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
    return isBaslat(firmaId, yuklemeId, "DOGRULA", async (is) => {
      const pool = await havuz();
      try {
        const { engeller, gecici } = await geciciHazirla(pool, b, is);
        if (engeller.some((e) => e.seviye === "ENGEL")) throw new Error(engeller.map((e) => e.mesaj).join(" | "));
        ilerle(is, "DOGRULA", 30, "Kaynak ile firma veritabanı karşılaştırılıyor");
        const r = await veritabanlariniDogrula(pool, gecici, firma.dbName, { ekKontroller: (bg) => ciftKontrolleri(bg, { kaynakDb: gecici, hedefDb: firma.dbName, cift: null }) });
        y.dosyaYaz(yuklemeId, "dogrulama.json", JSON.stringify(r));
        await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "VERI_AKTARIM_DOGRULANDI", hedefTur: "FIRMA", hedefId: firmaId, yeni: { yuklemeId, basarili: r.basarili, fark: r.ozet.fark } });
        ilerle(is, "BITTI", 100, r.basarili ? "Doğrulama: fark yok" : `Doğrulama: ${r.ozet.fark} fark`);
      } finally {
        await geciciSil(pool, geciciDbAdi(yuklemeId)).catch(() => undefined);
        await pool.close().catch(() => undefined);
      }
    });
  }
}
