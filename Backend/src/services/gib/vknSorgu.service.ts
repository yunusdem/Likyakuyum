import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { DbContext, GibHesapDurumu, GibSqlRepository, VknOnbellekKaydi } from "../../models/gibSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { isEncryptionConfigured } from "../../utils/crypto.utils.js";
import { logger } from "../../utils/logger.js";
import { NoTuru, noTemizle, noTuru } from "../../utils/vknKontrol.js";
import { EbelgeService } from "../ebelge.service.js";
import { EarsivPortalClient, GibPortalHatasi } from "./earsivPortal.client.js";

/**
 * VKN/TCKN → unvan / ad / soyad / vergi dairesi (docs/GIB_VKN_SORGU_YOL_HARITASI.md).
 * Her firma kendi GİB hesabıyla sorgular (K- Ayarlar → GİB Sorgu Ayarları); hesap, önbellek ve kayıt firma veritabanındadır.
 * Sıra: kontrol hanesi → önbellek → GİB e-Arşiv Portalı → ICE (yalnız e-Fatura mükellefi unvanı).
 */

const BULUNDU_OMRU_GUN = 30;
// Kaydı yeni açılan mükellef bir gün sonra tekrar sorulabilsin
const KAYIT_YOK_OMRU_GUN = 1;

export type VknSorguKaynagi = "GIB" | "ONBELLEK" | "ICE";

export interface VknSorguSonucu {
  no: string;
  tur: NoTuru;
  sonuc: "BULUNDU" | "KAYIT_YOK";
  unvan: string | null;
  ad: string | null;
  soyad: string | null;
  vergiDairesi: string | null;
  kaynak: VknSorguKaynagi;
  sorguTarihi: string;
  /** ICE yedeğinden gelince: vergi dairesi yok, GİB'e ulaşılamadı bilgisi */
  uyari: string | null;
}

const gunOnce = (gun: number) => Date.now() - gun * 86_400_000;

/** Veritabanındaki DATETIME'lar (GETDATE, yerel saat) mssql'den UTC gibi okunur; yeni sorgunun zamanı da aynı biçimde verilir. */
const simdiDbBicimi = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString();

export const onbellekTazeMi = (k: Pick<VknOnbellekKaydi, "sonuc" | "sorguTarihi">): boolean =>
  new Date(k.sorguTarihi).getTime() >= gunOnce(k.sonuc === "BULUNDU" ? BULUNDU_OMRU_GUN : KAYIT_YOK_OMRU_GUN);

const sifrelemeKontrol = () => {
  if (!isEncryptionConfigured()) {
    throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Sunucuda şifreleme anahtarı (EBELGE_ENC_KEY) tanımlı değil; GİB hesabı saklanamaz.");
  }
};

export class VknSorguService {
  public static async sorgula(girdi: string, ctx: DbContext, kullanici: string): Promise<VknSorguSonucu> {
    const no = noTemizle(girdi);
    const tur = noTuru(no);
    if (!tur) {
      throw ApiError.badRequest(
        no.length === 10 || no.length === 11
          ? "Geçersiz numara: kontrol hanesi tutmuyor, numarayı kontrol edin."
          : "Geçersiz numara: VKN 10, TCKN 11 haneli olmalıdır."
      );
    }

    const log = (sonuc: "BULUNDU" | "KAYIT_YOK" | "HATA", kaynak: VknSorguKaynagi | null) =>
      GibSqlRepository.sorguLogu(ctx, { kullanici, no, sonuc, kaynak });

    let gibHatasi: string | null = null;
    let hesapVar = false;

    try {
      const onbellek = await GibSqlRepository.onbellekOku(ctx, no);
      if (onbellek && onbellekTazeMi(onbellek)) {
        await log(onbellek.sonuc, "ONBELLEK");
        return { ...onbellek, tur, kaynak: "ONBELLEK", sorguTarihi: new Date(onbellek.sorguTarihi).toISOString(), uyari: null };
      }

      const hesap = await GibSqlRepository.hesap(ctx);
      hesapVar = !!hesap;
      if (hesap) {
        const bilgi = await EarsivPortalClient.kisiGetir(hesap, no);
        await GibSqlRepository.girisSonucu(ctx, true);
        const sonuc = bilgi.unvan || bilgi.ad || bilgi.soyad ? "BULUNDU" : "KAYIT_YOK";
        const kayit = { no, tur, sonuc, ...bilgi } as const;
        await GibSqlRepository.onbellekYaz(ctx, kayit);
        await log(sonuc, "GIB");
        return { ...kayit, kaynak: "GIB", sorguTarihi: simdiDbBicimi(), uyari: null };
      }
    } catch (err: any) {
      if (err instanceof GibPortalHatasi) {
        gibHatasi = err.message;
        await GibSqlRepository.girisSonucu(ctx, false, err.message);
      } else {
        gibHatasi = err instanceof ApiError ? err.message : "Sorgu yapılamadı.";
        logger.error(`[GIB] VKN sorgusu hatası: ${err?.message}`);
      }
    }

    // Yedek: ICE'deki GİB e-Fatura kayıtlı kullanıcı listesi (yalnız unvan)
    try {
      const m = await EbelgeService.mukellefSorgula(no, kullanici, ctx);
      const unvan = m.kullanicilar.map((k: any) => String(k?.Title ?? "").trim()).find(Boolean);
      if (m.mukellefMi && unvan) {
        await log("BULUNDU", "ICE");
        return {
          no, tur, sonuc: "BULUNDU", unvan, ad: null, soyad: null, vergiDairesi: null, kaynak: "ICE",
          sorguTarihi: simdiDbBicimi(),
          uyari: hesapVar
            ? "GİB'e ulaşılamadı; unvan e-Fatura listesinden alındı, vergi dairesini elle girin."
            : "GİB hesabı tanımlı değil; unvan e-Fatura listesinden alındı, vergi dairesini elle girin.",
        };
      }
    } catch (err: any) {
      logger.warn(`[GIB] ICE yedeği çalışmadı: ${err?.message}`);
    }

    await log("HATA", null);
    const neden = gibHatasi
      ? `GİB'e şu an ulaşılamıyor: ${gibHatasi}`
      : !hesapVar
        ? "GİB hesabı tanımlı değil (K- Ayarlar → GİB Sorgu Ayarları)."
        : "Sorgu yapılamadı.";
    throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, `${neden} Bilgileri elle girin.`);
  }

  /* ---------------------------------------------------------------- firmanın GİB hesabı (şifre hiçbir zaman dönmez) */

  public static hesapDurumu(ctx: DbContext): Promise<GibHesapDurumu> {
    return GibSqlRepository.durum(ctx);
  }

  public static async hesapKaydet(ctx: DbContext, kullaniciKodu: string, sifre: string, kullanici: string): Promise<GibHesapDurumu> {
    const kod = String(kullaniciKodu ?? "").trim();
    if (!kod || kod.length > 50) throw ApiError.badRequest("Kullanıcı kodu zorunludur (en çok 50 karakter).");
    if (!sifre || String(sifre).length > 100) throw ApiError.badRequest("Şifre zorunludur (en çok 100 karakter).");
    sifrelemeKontrol();
    const eski = await GibSqlRepository.hesap(ctx).catch(() => null);
    await GibSqlRepository.hesapYaz(ctx, kod, String(sifre), kullanici);
    EarsivPortalClient.oturumuBirak(eski);
    return GibSqlRepository.durum(ctx);
  }

  public static async hesapSil(ctx: DbContext): Promise<GibHesapDurumu> {
    const eski = await GibSqlRepository.hesap(ctx).catch(() => null);
    await GibSqlRepository.hesapSil(ctx);
    EarsivPortalClient.oturumuBirak(eski);
    return GibSqlRepository.durum(ctx);
  }

  /** "Bağlantıyı Dene": giriş + çıkış; sonuç hesaba işlenir. */
  public static async hesapDene(ctx: DbContext): Promise<GibHesapDurumu> {
    sifrelemeKontrol();
    const hesap = await GibSqlRepository.hesap(ctx);
    if (!hesap) throw ApiError.badRequest("Önce GİB kullanıcı kodu ve şifresini kaydedin.");
    try {
      await EarsivPortalClient.girisDene(hesap);
    } catch (err: any) {
      const mesaj = err instanceof GibPortalHatasi ? err.message : "GİB portalına giriş denenemedi.";
      await GibSqlRepository.girisSonucu(ctx, false, mesaj);
      throw new ApiError(
        err instanceof GibPortalHatasi && err.tur === "GIRIS" ? HttpStatus.BAD_REQUEST : HttpStatus.SERVICE_UNAVAILABLE,
        `GİB girişi başarısız: ${mesaj}`
      );
    }
    await GibSqlRepository.girisSonucu(ctx, true);
    return GibSqlRepository.durum(ctx);
  }
}
