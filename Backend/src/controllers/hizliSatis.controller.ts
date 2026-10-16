import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import { AliciKaydi, DbBaglam, HizliSatisSqlRepository as H } from "../models/hizliSatisSql.repository.js";
import { VknSorguService } from "../services/gib/vknSorgu.service.js";
import { noTemizle, noTuru } from "../utils/vknKontrol.js";
import { modulAcikMi, modulKapaliHatasi } from "../middlewares/modul.middleware.js";
import { kullaniciYetkisi } from "../services/yetki/kullaniciYetkisi.js";
import { HIZLI_SATIS_MODUL_KODU, MODUL_ADI, modulGecerliMi } from "../services/hizliSatis/hizliSatisKural.js";

/** Hızlı Satış uçları (docs/HIZLI_SATIS_YOL_HARITASI.md). Düzen ve ayarları yalnız sistem yöneticisi değiştirir (H6). */

const baglam = (req: Request): DbBaglam => ({ dbServer: req.user?.dbServer, dbName: req.user?.dbName });
const kullanici = (req: Request): number | undefined => {
  const u = req.user as any;
  const id = Number(u?.userId ?? u?.id);
  return Number.isFinite(id) && id > 0 ? id : undefined;
};
/**
 * Sistem yöneticisi: jetondaki rolden değil kullanıcı kartından (services/yetki/kullaniciYetkisi.ts, istek başına bir okuma).
 * Yöneticiliği kaldırılan kullanıcı jetonu geçerli kaldıkça düzen/ayar değiştirebiliyor, bütün veznelerin sepetlerini görüyordu.
 */
const yoneticiMi = async (req: Request): Promise<boolean> => (await kullaniciYetkisi(req)).yonetici;
const kimlikNo = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest("Geçersiz kayıt numarası.");
  return id;
};
/** Bekleyen sepet erişimi: kasiyerin kartında vezne tanımlıysa istekteki vezne yok sayılır (başka veznenin sepetleri görülmesin) */
const erisim = async (req: Request) => {
  const yonetici = await yoneticiMi(req);
  const kartVeznesi = yonetici ? null : await H.kullaniciVeznesi(kullanici(req), baglam(req));
  return { vezneId: kartVeznesi ?? (Number(req.query.vezneId) || null), kullaniciId: kullanici(req), yonetici };
};

/**
 * /hizli-satis öneki Firma Tanımları (fatura sınırı) için her firmada açıktır; modüle özel uçlar (düzen, fiş işareti,
 * fişler, bekleyen sepet) o modülün hızlı satışı firmanın lisansında açık mı diye ayrıca bakar. Geçersiz modül adını
 * depo katmanı reddeder.
 */
const modulLisansta = async (req: Request, modul: unknown) => {
  if (!modulGecerliMi(modul)) return;
  if (!(await modulAcikMi(req, [HIZLI_SATIS_MODUL_KODU[modul]]))) {
    throw modulKapaliHatasi(`${MODUL_ADI[modul]} hızlı satışı hesabınıza açık değil.`);
  }
};

/** Ayarlar (Fiyat/İndirim yetkisi, fatura sınırı) ve alıcı sorgusu (GİB'e gidebilir): en az bir modülün hızlı satışı açık olmalı */
const hizliSatisLisansta = async (req: Request) => {
  if (!(await modulAcikMi(req, Object.values(HIZLI_SATIS_MODUL_KODU)))) throw modulKapaliHatasi("Hızlı satış hesabınıza açık değil.");
};

type Isleyici = (req: Request, res: Response) => Promise<unknown>;
const sar = (f: Isleyici) => (req: Request, res: Response, next: NextFunction) => {
  f(req, res).then((v) => { if (!res.headersSent) res.json({ success: true, data: v }); }).catch(next);
};

export const hizliSatisYonetici = (req: Request, _res: Response, next: NextFunction) => {
  yoneticiMi(req)
    .then((ok) => next(ok ? undefined : ApiError.forbidden("Hızlı satış düzenini ve ayarlarını yalnız sistem yöneticisi değiştirebilir.")))
    .catch(next);
};

export const HizliSatisController = {
  /** Ekran açılışı: Fiyat/İndirim yetkisi, fatura sınırı */
  yetki: sar(async (req) => {
    const yonetici = await yoneticiMi(req);
    return {
      fiyatYetkisi: await H.fiyatYetkisi(kullanici(req), yonetici, baglam(req)),
      sistemYoneticisi: yonetici,
      faturaSiniri: await H.faturaSiniri(baglam(req)),
    };
  }),

  duzen: sar(async (req) => {
    await modulLisansta(req, req.params.modul);
    return H.duzen(req.params.modul, baglam(req), req.query.resim !== "0");
  }),
  duzenKaydet: sar(async (req) => {
    await modulLisansta(req, req.params.modul);
    return H.duzenKaydet(req.params.modul, req.body || {}, kullanici(req), baglam(req));
  }),

  ayarlar: sar(async (req) => {
    await hizliSatisLisansta(req);
    return H.ayarlar(baglam(req));
  }),
  ayarKaydet: sar(async (req) => {
    await hizliSatisLisansta(req);
    return H.ayarKaydet(req.body || {}, kullanici(req), baglam(req));
  }),

  /**
   * TCKN/VKN ile alıcı (H13): önce firmanın kendi kayıtları, bulunamazsa GİB sorgusu (merkezi/firma GİB hesabı).
   * GİB'e ulaşılamazsa hata değil, { kaynak: null, mesaj } döner; ekran bilgileri elle aldırır.
   */
  alici: sar(async (req) => {
    await hizliSatisLisansta(req);
    const no = noTemizle(String(req.params.no || ""));
    if (!noTuru(no)) throw ApiError.badRequest(no.length === 10 || no.length === 11 ? "Geçersiz numara: kontrol hanesi tutmuyor." : "VKN 10, TCKN 11 haneli olmalıdır.");
    const yerel = await H.aliciBul(no, baglam(req));
    if (yerel) return yerel;
    try {
      const g = await VknSorguService.sorgula(no, baglam(req), (req.user as any)?.username || String(kullanici(req) ?? "bilinmiyor"));
      if (g.sonuc !== "BULUNDU") return { kaynak: null, mesaj: "Bu numara GİB'de kayıtlı değil. Bilgileri elle girin." };
      const unvan = (g.unvan || [g.ad, g.soyad].filter(Boolean).join(" ")).trim();
      const k: AliciKaydi = {
        kaynak: "gib", cariKartId: null, cariKod: null, unvan, vknTckn: no, adres: "", il: "", ilce: "",
        vergiDairesi: g.vergiDairesi || "", telefon: "", eposta: "", mukellef: false, uyari: g.uyari,
      };
      return k;
    } catch (e: any) {
      return { kaynak: null, mesaj: e?.message || "GİB sorgusu yapılamadı. Bilgileri elle girin." };
    }
  }),

  isaretle: sar(async (req) => {
    await modulLisansta(req, req.body?.modul);
    await H.fisIsaretle(req.body?.modul, req.body?.fisId, kullanici(req), baglam(req));
    return { tamam: true };
  }),
  bekleyenler: sar(async (req) => {
    await modulLisansta(req, req.params.modul);
    return H.bekleyenler(req.params.modul, { ...(await erisim(req)), tumu: req.query.tumu === "1" }, baglam(req));
  }),
  // Kimlikle gelen uçlar da sepetin modülünün lisansta açık olmasını ister (liste ucu kapalı modülde 403 veriyordu,
  // kimliği bilinen sepet ise geri çağrılıp silinebiliyordu)
  bekleyenGetir: sar(async (req) => {
    const sepet = await H.bekleyenGetir(kimlikNo(req), await erisim(req), baglam(req));
    await modulLisansta(req, sepet.modul);
    return sepet;
  }),
  bekleyenKaydet: sar(async (req) => {
    await modulLisansta(req, req.body?.modul);
    const e = await erisim(req);
    return H.bekleyenKaydet({ ...(req.body || {}), vezneId: e.yonetici ? req.body?.vezneId : e.vezneId ?? req.body?.vezneId }, kullanici(req), baglam(req));
  }),
  bekleyenSil: sar(async (req) => {
    await H.bekleyenSil(kimlikNo(req), await erisim(req), baglam(req), (m) => modulLisansta(req, m));
    return { tamam: true };
  }),
  fisler: sar(async (req) => {
    await modulLisansta(req, req.params.modul);
    // Kullanıcının işlem gösterme sınırı istenen gün sayısından kısaysa o geçerli
    const y = await kullaniciYetkisi(req);
    const gun = !y.yonetici && y.gosterimGunu > 0 ? Math.min(Math.max(1, Number(req.query.gun) || 1), y.gosterimGunu) : req.query.gun;
    return H.fisler(req.params.modul, gun, baglam(req));
  }),
  isaretliler: sar(async (req) => {
    await modulLisansta(req, req.body?.modul);
    const idler = Array.isArray(req.body?.fisIdler) ? req.body.fisIdler : [];
    return [...(await H.isaretliler(req.body?.modul, idler, baglam(req)))];
  }),
};
