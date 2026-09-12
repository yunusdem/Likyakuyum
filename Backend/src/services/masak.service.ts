import {
  MasakSqlRepository,
  MasakListeKod,
  masakListeKodGecerliMi,
  masakStandartListeMi,
  MasakListeDurumModel,
  MasakGuncellemeLogModel,
  MasakKayitModel,
  MasakEslesmeModel,
  MasakListeSayfasi,
} from "../models/masakSql.repository.js";
import {
  MASAK_KAYNAKLAR,
  adresGecerliMi,
  indirDosya,
  normalizeMetin,
  parseMasakExcel,
  tarihAyikla,
} from "../utils/masakExcel.util.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export interface MasakKaynakGirdi {
  listeKod: MasakListeKod;
  url?: string | null;
  /** Kullanıcı tanımlı listeler için ekranda girilen liste adı / açıklaması */
  listeAdi?: string | null;
}

const LISTE_KOD_HATA =
  "Geçersiz liste kodu. Büyük harf ve rakamla en fazla 10 karakter olmalıdır (ör. A, B, C, 3AB, D).";

export interface MasakListeSonucu {
  listeKod: MasakListeKod;
  listeAdi: string;
  durum: "basarili" | "hata";
  kayitSayisi: number;
  oncekiKayitSayisi: number;
  sureMs: number;
  kaynakUrl: string;
  hata?: string;
}

export interface MasakGuncellemeRaporu {
  guncellemeZamani: string;
  toplamKayit: number;
  sonuclar: MasakListeSonucu[];
  durum: MasakListeDurumModel[];
}

export interface MasakKullanici {
  kullaniciAdi?: string | null;
  kullaniciId?: string | null;
}

type DbContext = { dbServer?: string; dbName?: string };

export class MasakService {
  /**
   * Aynı anda ikinci bir güncellemeyi engelleyen kilit (sunucu/agent süreci başına).
   * Anahtar: sunucu + veritabanı — farklı işletmeler birbirini bloklamaz.
   */
  private static calisanGuncellemeler = new Set<string>();

  private static kilitAnahtari(dbContext?: DbContext): string {
    return `${(dbContext?.dbServer || "").toLowerCase()}:${(dbContext?.dbName || "").toLowerCase()}`;
  }

  private static listeKodGecerliMi(kod: unknown): kod is MasakListeKod {
    return masakListeKodGecerliMi(kod);
  }

  /**
   * Liste bazında kayıt sayısı, son güncelleme ve son girilen adres.
   * Standart listelerde adres yoksa varsayılan adres döndürülür — adres giriş ekranı
   * her zaman dolu açılır. Kullanıcı tanımlı listeler (standart dördün dışındakiler)
   * `ozel: true` ile işaretlenir.
   */
  public static async getDurum(dbContext?: DbContext): Promise<MasakListeDurumModel[]> {
    const durum = await MasakSqlRepository.getDurum(dbContext);
    return durum.map((d) => ({
      ...d,
      ozel: !masakStandartListeMi(d.listeKod),
      listeAdi: d.listeAdi || MASAK_KAYNAKLAR[d.listeKod]?.listeAdi || null,
      kaynakUrl: d.kaynakUrl || MASAK_KAYNAKLAR[d.listeKod]?.varsayilanUrl || null,
    }));
  }

  /**
   * Kullanıcı tanımlı bir listeyi (verisi + geçmişi) kaldırır.
   * Standart listeler silinemez; yalnızca adresi değiştirilir.
   */
  public static async sil(
    listeKod: unknown,
    dbContext?: DbContext
  ): Promise<{ silinenKayit: number; silinenGecmis: number }> {
    if (!MasakService.listeKodGecerliMi(listeKod)) {
      throw ApiError.badRequest(LISTE_KOD_HATA);
    }
    if (masakStandartListeMi(listeKod)) {
      throw ApiError.badRequest(
        `${listeKod} standart bir MASAK listesidir, silinemez. Gerekirse seçimini kaldırarak güncelleme dışında bırakabilirsiniz.`
      );
    }
    const kilit = MasakService.kilitAnahtari(dbContext);
    if (MasakService.calisanGuncellemeler.has(kilit)) {
      throw ApiError.badRequest(
        "Şu anda bir MASAK güncellemesi sürüyor. Lütfen tamamlanmasını bekleyiniz."
      );
    }
    return MasakSqlRepository.deleteListe(listeKod, dbContext);
  }

  /**
   * Sayfalı listeleme (MASAK grid ekranı). Arama metni yazılırken kullanılan
   * normalizasyonun aynısından geçirilir — "abdullah aymaz" da "ABDULLAH AYMAZ" da bulur.
   */
  public static async listele(
    params: {
      listeKod?: string;
      q?: string;
      kimlikNo?: string;
      page?: number;
      pageSize?: number;
    },
    dbContext?: DbContext
  ): Promise<MasakListeSayfasi> {
    if (params.listeKod && !MasakService.listeKodGecerliMi(params.listeKod)) {
      throw ApiError.badRequest(LISTE_KOD_HATA);
    }

    return MasakSqlRepository.listele(
      {
        listeKod: params.listeKod,
        qNorm: params.q ? normalizeMetin(params.q) : undefined,
        kimlikNo: params.kimlikNo,
        page: params.page,
        pageSize: params.pageSize,
      },
      dbContext
    );
  }

  /** Tek kaydın tüm alanları (Detay) */
  public static async getKayit(
    id: number,
    dbContext?: DbContext
  ): Promise<MasakKayitModel> {
    if (!id || isNaN(id)) {
      throw ApiError.badRequest("Geçerli bir kayıt numarası belirtilmelidir.");
    }
    const kayit = await MasakSqlRepository.findById(id, dbContext);
    if (!kayit) {
      throw ApiError.notFound("MASAK kaydı bulunamadı.");
    }
    return kayit;
  }

  /**
   * Eşleşme sorgusu — fiş / fatura / cari ekranlarının kullanacağı uç.
   * Otomatik blok uygulamaz; eşleşmeyi ve skorunu döner, kararı çağıran taraf verir.
   */
  public static async sorgula(
    params: { ad?: string; kimlikNo?: string; dogumTarihi?: string; limit?: number },
    dbContext?: DbContext
  ): Promise<{
    eslesmeVar: boolean;
    enYuksekSkor: number;
    kayitlar: MasakEslesmeModel[];
  }> {
    const ad = (params.ad || "").trim();
    const kimlikNo = (params.kimlikNo || "").replace(/\s/g, "").trim();

    if (!ad && !kimlikNo) {
      throw ApiError.badRequest("Sorgu için en az bir ad veya kimlik numarası gereklidir.");
    }

    const adNorm = ad ? normalizeMetin(ad) : null;
    const kelimeler = adNorm ? adNorm.split(" ").filter((k) => k.length >= 2) : [];

    const kayitlar = await MasakSqlRepository.sorgula(
      {
        kimlikNo: kimlikNo || null,
        adNorm,
        kelimeler,
        dogumTarihiDt: params.dogumTarihi ? tarihAyikla(params.dogumTarihi) : null,
        limit: params.limit,
      },
      dbContext
    );

    return {
      eslesmeVar: kayitlar.length > 0,
      enYuksekSkor: kayitlar.length ? Math.max(...kayitlar.map((k) => k.skor)) : 0,
      kayitlar,
    };
  }

  public static async getGecmis(
    params: { listeKod?: string; limit?: number },
    dbContext?: DbContext
  ): Promise<MasakGuncellemeLogModel[]> {
    if (params.listeKod && !MasakService.listeKodGecerliMi(params.listeKod)) {
      throw ApiError.badRequest(LISTE_KOD_HATA);
    }
    return MasakSqlRepository.getGecmis(params, dbContext);
  }

  /**
   * Seçilen listeleri indirir, ayrıştırır ve tabloya yazar.
   *
   * - Her liste bağımsızdır: biri hata alsa diğerleri güncellenmeye devam eder.
   * - Bir listenin verisi ancak indirme + ayrıştırma başarılı olduktan sonra,
   *   transaction içinde değiştirilir. Başarısız güncelleme eldeki veriyi bozmaz.
   * - Her deneme (başarılı/başarısız) TODVZ_MASAK_GUNCELLEME'ye yazılır.
   */
  public static async guncelle(
    kaynaklar: MasakKaynakGirdi[] | undefined,
    kullanici?: MasakKullanici,
    dbContext?: DbContext
  ): Promise<MasakGuncellemeRaporu> {
    const kilit = MasakService.kilitAnahtari(dbContext);
    if (MasakService.calisanGuncellemeler.has(kilit)) {
      throw ApiError.badRequest(
        "Şu anda başka bir MASAK güncellemesi sürüyor. Lütfen tamamlanmasını bekleyiniz."
      );
    }

    // Son girilen adresler (ekran boş bıraktıysa veya hiç girdi yoksa buradan tamamlanır)
    const mevcutDurum = await MasakService.getDurum(dbContext);

    // Girdi yoksa: standart dört liste + adresi bilinen kullanıcı tanımlı listeler,
    // hepsi son girilen adresleriyle ("Sorgulama" ekranındaki tek tuşla güncelleme)
    const istenen: MasakKaynakGirdi[] =
      Array.isArray(kaynaklar) && kaynaklar.length > 0
        ? kaynaklar
        : mevcutDurum
            .filter((d) => masakStandartListeMi(d.listeKod) || !!d.kaynakUrl)
            .map((d) => ({ listeKod: d.listeKod }));

    const gorulen = new Set<string>();
    for (const k of istenen) {
      if (!MasakService.listeKodGecerliMi(k?.listeKod)) {
        throw ApiError.badRequest(`Geçersiz liste kodu: "${String(k?.listeKod)}". ${LISTE_KOD_HATA}`);
      }
      if (gorulen.has(k.listeKod)) {
        throw ApiError.badRequest(`${k.listeKod} liste kodu birden fazla kez gönderildi.`);
      }
      gorulen.add(k.listeKod);
      if (k.url && !adresGecerliMi(k.url)) {
        throw ApiError.badRequest(
          `${k.listeKod} listesi için geçersiz adres. Yalnızca https://ms.hmb.gov.tr/ ile başlayan .xlsx adresleri kabul edilir.`
        );
      }
      if (!masakStandartListeMi(k.listeKod) && !(k.url && k.url.trim())) {
        // Yeni tanımlanan listenin adresi başka yerden bilinemez; geçmişte denenmişse oradan alınır
        if (!mevcutDurum.some((d) => d.listeKod === k.listeKod && d.kaynakUrl)) {
          throw ApiError.badRequest(`${k.listeKod} listesi için adres girilmelidir.`);
        }
      }
    }

    MasakService.calisanGuncellemeler.add(kilit);

    try {
      // Adres girilmemişse: son girilen adres → yoksa varsayılan adres
      const sonAdresler = new Map<string, string | null>();
      const sonAdlar = new Map<string, string | null>();
      mevcutDurum.forEach((d) => {
        sonAdresler.set(d.listeKod, d.kaynakUrl);
        sonAdlar.set(d.listeKod, d.listeAdi);
      });

      const sonuclar: MasakListeSonucu[] = [];

      for (const girdi of istenen) {
        const listeKod = girdi.listeKod;
        const tanim = MASAK_KAYNAKLAR[listeKod];
        const url =
          (girdi.url && girdi.url.trim()) ||
          sonAdresler.get(listeKod) ||
          tanim?.varsayilanUrl ||
          "";
        // Ad: ekrandan gelen → daha önce kaydedilen → standart tanım → kodun kendisi
        const listeAdi =
          (girdi.listeAdi && girdi.listeAdi.trim().slice(0, 200)) ||
          sonAdlar.get(listeKod) ||
          tanim?.listeAdi ||
          listeKod;

        const baslama = new Date();
        const t0 = Date.now();
        let oncekiSayi = 0;

        try {
          oncekiSayi = await MasakSqlRepository.getKayitSayisi(listeKod, dbContext);

          const dosya = await indirDosya(url);
          const ayristirma = await parseMasakExcel(dosya.buffer, listeKod, listeAdi);

          const yazilan = await MasakSqlRepository.replaceListe(
            listeKod,
            ayristirma.kayitlar,
            { listeAdi, kaynakUrl: url, kaynakHash: dosya.hash },
            dbContext
          );

          const sureMs = Date.now() - t0;

          if (ayristirma.eslesmeyenBasliklar.length > 0) {
            logger.warn(
              `MASAK ${listeKod}: eşlenemeyen kolon başlıkları → ${ayristirma.eslesmeyenBasliklar.join(" | ")}`
            );
          }

          await MasakSqlRepository.logGuncelleme(
            {
              listeKod,
              baslamaZamani: baslama,
              bitisZamani: new Date(),
              sureMs,
              durum: "BASARILI",
              kayitSayisi: yazilan,
              oncekiKayitSayisi: oncekiSayi,
              kaynakUrl: url,
              kaynakHash: dosya.hash,
              dosyaBoyutu: dosya.boyut,
              kullaniciAdi: kullanici?.kullaniciAdi ?? null,
              kullaniciId: kullanici?.kullaniciId ?? null,
            },
            dbContext
          );

          sonuclar.push({
            listeKod,
            listeAdi,
            durum: "basarili",
            kayitSayisi: yazilan,
            oncekiKayitSayisi: oncekiSayi,
            sureMs,
            kaynakUrl: url,
          });
        } catch (error: any) {
          const sureMs = Date.now() - t0;
          const mesaj = error?.message || "Bilinmeyen hata";

          logger.error(`MASAK ${listeKod} güncellenemedi: ${mesaj}`);

          await MasakSqlRepository.logGuncelleme(
            {
              listeKod,
              baslamaZamani: baslama,
              bitisZamani: new Date(),
              sureMs,
              durum: "HATA",
              kayitSayisi: 0,
              oncekiKayitSayisi: oncekiSayi,
              kaynakUrl: url,
              kullaniciAdi: kullanici?.kullaniciAdi ?? null,
              kullaniciId: kullanici?.kullaniciId ?? null,
              hataMesaji: mesaj,
            },
            dbContext
          );

          sonuclar.push({
            listeKod,
            listeAdi,
            durum: "hata",
            kayitSayisi: 0,
            oncekiKayitSayisi: oncekiSayi,
            sureMs,
            kaynakUrl: url,
            hata: mesaj,
          });
        }
      }

      const durum = await MasakService.getDurum(dbContext);
      const toplamKayit = durum.reduce((t, d) => t + d.kayitSayisi, 0);
      const sonGuncelleme =
        durum
          .map((d) => d.sonGuncelleme)
          .filter((z): z is string => !!z)
          .sort()
          .pop() || new Date().toISOString();

      return {
        guncellemeZamani: sonGuncelleme,
        toplamKayit,
        sonuclar,
        durum,
      };
    } finally {
      MasakService.calisanGuncellemeler.delete(kilit);
    }
  }
}
