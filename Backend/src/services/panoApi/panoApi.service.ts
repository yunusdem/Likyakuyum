import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { PanoAnahtarKaydi, PanoAnahtarSqlRepository } from "../../models/admin/panoAnahtarSql.repository.js";
import { PanoModel, PanoSqlRepository } from "../../models/panoSql.repository.js";
import { logger } from "../../utils/logger.js";
import { firmaDbContextHazirla } from "../admin/firmaBaglanti.service.js";
import { firmaEngeli } from "../merkezGiris.service.js";
import { guncellemeZamani, PanoApiVerisi, PanoGorunumu, satirKur } from "./panoBicim.js";

/**
 * Pano Entegrasyonu açık uçlarının çekirdeği (docs/PANO_API_YOL_HARITASI.md). Anahtar → firma → firma DB'sindeki pano
 * tanımı + komisyonlu Kur Tablosu (PanoSqlRepository.getLiveBoardData ile aynı kaynak, P1). Pano başına önbellek (P6),
 * sayaçlar bellekte toplanıp 60 sn'de bir yazılır (P10). Firma/modül durumu 403 (P7).
 */

export const PANO_API_MODULU = "kur:kur/pano-entegrasyonu";
export const ANAHTAR_DESENI = /^[a-z0-9]{32}$/;

/** Açık uçların hata kodları: 404 ANAHTAR_YOK / PANO_YOK, 403 KAPALI, 503 BAGLANTI */
export class PanoApiHatasi extends Error {
  constructor(
    public readonly durum: 404 | 403 | 503,
    public readonly kod: "ANAHTAR_YOK" | "PANO_YOK" | "KAPALI" | "BAGLANTI",
    mesaj: string
  ) {
    super(mesaj);
  }
}

export interface PanoApiSonucu {
  veri: PanoApiVerisi;
  gorunum: PanoGorunumu;
  kayit: PanoAnahtarKaydi;
}

const ANAHTAR_ONBELLEK_MS = 30_000;
const SAYAC_YAZMA_MS = 60_000;

interface AnahtarOnbellegi {
  zaman: number;
  kayit: PanoAnahtarKaydi | null;
  /** Firma dondurulmuş / modül kapalı → 403 gerekçesi; null = açık */
  engel: string | null;
}

const anahtarOnbellegi = new Map<string, AnahtarOnbellegi>();
/**
 * Doğrulanmış firma bağlantısı (firmaDbContextHazirla: bağlantı sınanır, havuzun gerçekten o veritabanına bağlandığı
 * denetlenir). MerkezGirisService.firmaBaglantisi KULLANILMAZ: bağlantı kurulamayınca .env'deki veritabanına düşer,
 * başka firmanın panosu yayınlanırdı. 5 dk tutulur; hata olunca düşer.
 */
const BAGLANTI_ONBELLEK_MS = 5 * 60_000;
const baglantiOnbellegi = new Map<number, { zaman: number; ctx: { dbServer: string; dbName: string } }>();
const veriOnbellegi = new Map<string, { zaman: number; sonuc: PanoApiSonucu }>();
const sayaclar = new Map<number, { adet: number; son: Date }>();
let sayacZamanlayici: NodeJS.Timeout | null = null;

const simdi = () => Date.now();

const panoAdi = (p: PanoModel, unvan: string): string => (p.firmaAdi || "").trim() || unvan;

const gorunumu = (p: PanoModel): PanoGorunumu => ({
  paraBasligi: p.paraBasligi || "",
  alisKuruBasligi: p.alisKuruBasligi || "",
  satisKuruBasligi: p.satisKuruBasligi || "",
  firmaAdiOzellikleri: p.firmaAdiOzellikleri || "",
  tarihSaatOzellikleri: p.tarihSaatOzellikleri || "",
  baslikOzellikleri: p.baslikOzellikleri || "",
  satirOzellikleri: p.satirOzellikleri || "",
  zeminRengi: p.zeminRengi || "",
  kodAlaniGenisligi: Number(p.kodAlaniGenisligi) || 0,
  kurAlaniGenisligi: Number(p.kurAlaniGenisligi) || 0,
});

export class PanoApiService {
  /** Anahtar üretildi / iptal edildi / süre değişti: o adresin bütün önbelleği düşer (eski adres anında kapanır) */
  public static onbellegiDusur(anahtar: string | null | undefined): void {
    if (!anahtar) return;
    anahtarOnbellegi.delete(anahtar);
    veriOnbellegi.delete(anahtar);
  }

  public static tumOnbellegiTemizle(): void {
    anahtarOnbellegi.clear();
    veriOnbellegi.clear();
  }

  /** Pano verisini pano başına önbellek süresiyle döndürür; her çağrı sayaca yazılır (önbellekten dönse de) */
  public static async getir(anahtar: string): Promise<PanoApiSonucu> {
    const { kayit, engel } = await PanoApiService.anahtarBilgisi(anahtar);
    if (!kayit) throw new PanoApiHatasi(404, "ANAHTAR_YOK", "Anahtar tanımlı değil.");
    if (kayit.durum !== "AKTIF") throw new PanoApiHatasi(403, "KAPALI", "Anahtar iptal edilmiş.");
    if (engel) throw new PanoApiHatasi(403, "KAPALI", engel);

    PanoApiService.say(kayit.anahtarId);

    const onbellek = veriOnbellegi.get(anahtar);
    if (onbellek && simdi() - onbellek.zaman < kayit.onbellekSn * 1000) return onbellek.sonuc;

    const sonuc = await PanoApiService.veriyiOku(kayit);
    veriOnbellegi.set(anahtar, { zaman: simdi(), sonuc });
    return sonuc;
  }

  /** Anahtar kaydı + firma/modül engeli, 30 sn önbellekli (her saniye admin DB'ye gidilmesin) */
  private static async anahtarBilgisi(anahtar: string): Promise<AnahtarOnbellegi> {
    const o = anahtarOnbellegi.get(anahtar);
    if (o && simdi() - o.zaman < ANAHTAR_ONBELLEK_MS) return o;

    let kayit: PanoAnahtarKaydi | null = null;
    let engel: string | null = null;
    try {
      kayit = ANAHTAR_DESENI.test(anahtar) ? await PanoAnahtarSqlRepository.anahtarlaBul(anahtar) : null;
      if (kayit && kayit.durum === "AKTIF") engel = await PanoApiService.firmaEngeli(kayit.firmaId);
    } catch (err: any) {
      logger.error(`[PANO-API] Anahtar okunamadı: ${err?.message}`);
      throw new PanoApiHatasi(503, "BAGLANTI", "Sunucu şu an yanıt veremiyor.");
    }
    const yeni = { zaman: simdi(), kayit, engel };
    anahtarOnbellegi.set(anahtar, yeni);
    return yeni;
  }

  /** Firma AKTIF ve lisansı sürüyor mu, modül firmaya açık mı. null = engel yok */
  public static async firmaEngeli(firmaId: number): Promise<string | null> {
    const firma = await FirmaSqlRepository.idIleBul(firmaId);
    if (!firma) return "Firma bulunamadı.";
    const kod = firmaEngeli(firma);
    if (kod) return kod === "LISANS_BITTI" ? "Firmanın lisans süresi dolmuş." : "Firma hesabı kullanımda değil.";
    const moduller = await ModulSqlRepository.firmaAcikModulleri(firmaId);
    if (moduller !== null && !moduller.includes(PANO_API_MODULU)) return "Pano Entegrasyonu modülü bu firmaya açık değil.";
    return null;
  }

  private static async veriyiOku(kayit: PanoAnahtarKaydi): Promise<PanoApiSonucu> {
    let pano: PanoModel | null;
    let unvan = "";
    try {
      const ctx = await PanoApiService.firmaBaglantisi(kayit.firmaId);
      unvan = (await FirmaSqlRepository.idIleBul(kayit.firmaId))?.unvan || "";
      pano = await PanoSqlRepository.getLiveBoardData(kayit.panoId, ctx);
    } catch (err: any) {
      baglantiOnbellegi.delete(kayit.firmaId);
      logger.error(`[PANO-API] Firma ${kayit.firmaId} pano ${kayit.panoId} okunamadı: ${err?.message}`);
      throw new PanoApiHatasi(503, "BAGLANTI", "Firma verisine şu an ulaşılamıyor.");
    }
    if (!pano) throw new PanoApiHatasi(404, "PANO_YOK", "Pano tanımı silinmiş.");

    const satirlar = pano.satirlar
      .filter((s) => s.gorunur !== false)
      .map((s) => satirKur(s.kod, s.gorunecekAd || s.ad, s.dovizAlis, s.dovizSatis));
    return {
      veri: { firma: panoAdi(pano, unvan), pano: (pano.panoNo || "").trim() || String(pano.panoId), guncelleme: guncellemeZamani(), satirlar },
      gorunum: gorunumu(pano),
      kayit,
    };
  }

  private static async firmaBaglantisi(firmaId: number): Promise<{ dbServer: string; dbName: string }> {
    const o = baglantiOnbellegi.get(firmaId);
    if (o && simdi() - o.zaman < BAGLANTI_ONBELLEK_MS) return o.ctx;
    const ctx = await firmaDbContextHazirla(firmaId);
    baglantiOnbellegi.set(firmaId, { zaman: simdi(), ctx });
    return ctx;
  }

  // ------------------------------------------------------------------------------------------- sayaçlar ---

  private static say(anahtarId: number): void {
    const s = sayaclar.get(anahtarId);
    if (s) {
      s.adet += 1;
      s.son = new Date();
    } else sayaclar.set(anahtarId, { adet: 1, son: new Date() });
    if (!sayacZamanlayici) {
      sayacZamanlayici = setInterval(() => void PanoApiService.sayaclariYaz(), SAYAC_YAZMA_MS);
      sayacZamanlayici.unref();
    }
  }

  /** Bellekteki sayaçları veritabanına yazar (zamanlayıcı, iptal/yenileme ve kapanışta) */
  public static async sayaclariYaz(): Promise<void> {
    if (!sayaclar.size) return;
    const liste = [...sayaclar.entries()].map(([anahtarId, s]) => ({ anahtarId, adet: s.adet, son: s.son }));
    sayaclar.clear();
    try {
      await PanoAnahtarSqlRepository.sayacYaz(liste);
    } catch (err: any) {
      logger.warn(`[PANO-API] Sayaç yazılamadı: ${err?.message}`);
      for (const s of liste) {
        const v = sayaclar.get(s.anahtarId);
        if (v) {
          v.adet += s.adet;
          if (s.son > v.son) v.son = s.son;
        } else sayaclar.set(s.anahtarId, { adet: s.adet, son: s.son });
      }
    }
  }

  /** Bellekte bekleyen (henüz yazılmamış) sayaç; ekranlarda kayıtlıya eklenir */
  public static bekleyenSayac(anahtarId: number): { adet: number; son: Date } | null {
    const s = sayaclar.get(anahtarId);
    return s ? { adet: s.adet, son: s.son } : null;
  }
}

process.once("beforeExit", () => void PanoApiService.sayaclariYaz());
