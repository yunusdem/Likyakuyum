import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import { AliciKaydi, DbBaglam, HizliSatisSqlRepository as H } from "../models/hizliSatisSql.repository.js";
import { VknSorguService } from "../services/gib/vknSorgu.service.js";
import { noTemizle, noTuru } from "../utils/vknKontrol.js";

/** Hızlı Satış uçları (docs/HIZLI_SATIS_YOL_HARITASI.md). Düzen ve ayarları yalnız sistem yöneticisi değiştirir (H6). */

const baglam = (req: Request): DbBaglam => ({ dbServer: req.user?.dbServer, dbName: req.user?.dbName });
const kullanici = (req: Request): number | undefined => {
  const u = req.user as any;
  const id = Number(u?.userId ?? u?.id);
  return Number.isFinite(id) && id > 0 ? id : undefined;
};
const yoneticiMi = (req: Request) => (req.user as any)?.role === "admin";
const kimlikNo = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest("Geçersiz kayıt numarası.");
  return id;
};
/** Bekleyen sepet erişimi: kasiyerin kartında vezne tanımlıysa istekteki vezne yok sayılır (başka veznenin sepetleri görülmesin) */
const erisim = async (req: Request) => {
  const yonetici = yoneticiMi(req);
  const kartVeznesi = yonetici ? null : await H.kullaniciVeznesi(kullanici(req), baglam(req));
  return { vezneId: kartVeznesi ?? (Number(req.query.vezneId) || null), kullaniciId: kullanici(req), yonetici };
};

type Isleyici = (req: Request, res: Response) => Promise<unknown>;
const sar = (f: Isleyici) => (req: Request, res: Response, next: NextFunction) => {
  f(req, res).then((v) => { if (!res.headersSent) res.json({ success: true, data: v }); }).catch(next);
};

export const hizliSatisYonetici = (req: Request, _res: Response, next: NextFunction) =>
  yoneticiMi(req) ? next() : next(ApiError.forbidden("Hızlı satış düzenini ve ayarlarını yalnız sistem yöneticisi değiştirebilir."));

export const HizliSatisController = {
  /** Ekran açılışı: Fiyat/İndirim yetkisi, fatura sınırı */
  yetki: sar(async (req) => ({
    fiyatYetkisi: await H.fiyatYetkisi(kullanici(req), yoneticiMi(req), baglam(req)),
    sistemYoneticisi: yoneticiMi(req),
    faturaSiniri: await H.faturaSiniri(baglam(req)),
  })),

  duzen: sar(async (req) => H.duzen(req.params.modul, baglam(req), req.query.resim !== "0")),
  duzenKaydet: sar(async (req) => H.duzenKaydet(req.params.modul, req.body || {}, kullanici(req), baglam(req))),

  ayarlar: sar(async (req) => H.ayarlar(baglam(req))),
  ayarKaydet: sar(async (req) => H.ayarKaydet(req.body || {}, kullanici(req), baglam(req))),

  /**
   * TCKN/VKN ile alıcı (H13): önce firmanın kendi kayıtları, bulunamazsa GİB sorgusu (merkezi/firma GİB hesabı).
   * GİB'e ulaşılamazsa hata değil, { kaynak: null, mesaj } döner; ekran bilgileri elle aldırır.
   */
  alici: sar(async (req) => {
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
    await H.fisIsaretle(req.body?.modul, req.body?.fisId, kullanici(req), baglam(req));
    return { tamam: true };
  }),
  bekleyenler: sar(async (req) => H.bekleyenler(req.params.modul, { ...(await erisim(req)), tumu: req.query.tumu === "1" }, baglam(req))),
  bekleyenGetir: sar(async (req) => H.bekleyenGetir(kimlikNo(req), await erisim(req), baglam(req))),
  bekleyenKaydet: sar(async (req) => {
    const e = await erisim(req);
    return H.bekleyenKaydet({ ...(req.body || {}), vezneId: e.yonetici ? req.body?.vezneId : e.vezneId ?? req.body?.vezneId }, kullanici(req), baglam(req));
  }),
  bekleyenSil: sar(async (req) => {
    await H.bekleyenSil(kimlikNo(req), await erisim(req), baglam(req));
    return { tamam: true };
  }),
  fisler: sar(async (req) => H.fisler(req.params.modul, req.query.gun, baglam(req))),
  isaretliler: sar(async (req) => {
    const idler = Array.isArray(req.body?.fisIdler) ? req.body.fisIdler : [];
    return [...(await H.isaretliler(req.body?.modul, idler, baglam(req)))];
  }),
};
