import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import { DbBaglam, TicariStokSqlRepository } from "../models/ticariStokSql.repository.js";
import { TicariGirisSqlRepository } from "../models/ticariGirisSql.repository.js";
import { TicariSatisSqlRepository } from "../models/ticariSatisSql.repository.js";
import { excelOnizle, excelYukle, ornekExcel } from "../services/ticari/ticariExcel.js";

/** Ticari İşlemler uçları (docs/TICARI_ISLEMLER_YOL_HARITASI.md). Yönetim uçları: sistem yöneticisi ya da yetkili kullanıcı (T21). */

const baglam = (req: Request): DbBaglam => ({ dbServer: req.user?.dbServer, dbName: req.user?.dbName });
const kullanici = (req: Request): number | undefined => {
  const u = req.user as any;
  const id = Number(u?.userId ?? u?.id);
  return Number.isFinite(id) && id > 0 ? id : undefined;
};
const yoneticiMi = (req: Request) => (req.user as any)?.role === "admin";
const sayiVeyaNull = (v: unknown): number | null => (v === undefined || v === null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const metin = (v: unknown): string | null => (v === undefined || v === null || String(v).trim() === "" ? null : String(v));
const kimlik = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest("Geçersiz kayıt numarası.");
  return id;
};

type Isleyici = (req: Request, res: Response) => Promise<unknown>;
const sar = (f: Isleyici) => (req: Request, res: Response, next: NextFunction) => {
  f(req, res).then((v) => { if (!res.headersSent) res.json({ success: true, data: v }); }).catch(next);
};

/** Yönetim ekranları için yetki kapısı */
export const ticariYonetim = (req: Request, _res: Response, next: NextFunction) => {
  TicariStokSqlRepository.yonetebilirMi(kullanici(req), yoneticiMi(req), baglam(req))
    .then((ok) => (ok ? next() : next(ApiError.forbidden("Bu işlem için stok yönetim yetkiniz yok. Sistem yöneticisi Ticari İşlemler › Stok Ayarları'ndan yetki verebilir."))))
    .catch(next);
};

/** Ayar ve yetki listesi yalnız sistem yöneticisinde */
export const ticariSistemYoneticisi = (req: Request, _res: Response, next: NextFunction) =>
  yoneticiMi(req) ? next() : next(ApiError.forbidden("Stok ayarlarını yalnız sistem yöneticisi değiştirebilir."));

export const TicariController = {
  yetki: sar(async (req) => ({
    yonetebilir: await TicariStokSqlRepository.yonetebilirMi(kullanici(req), yoneticiMi(req), baglam(req)),
    sistemYoneticisi: yoneticiMi(req),
  })),

  ayarlar: sar(async (req) => TicariStokSqlRepository.ayarlar(baglam(req))),
  ayarKaydet: sar(async (req) => TicariStokSqlRepository.ayarKaydet(req.body || {}, kullanici(req), baglam(req))),

  gruplar: sar(async (req) => TicariStokSqlRepository.gruplar(baglam(req))),
  grupKaydet: sar(async (req) => TicariStokSqlRepository.grupKaydet({ ...(req.body || {}), stokGrupId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
  grupSil: sar(async (req) => TicariStokSqlRepository.grupSil(kimlik(req), baglam(req))),

  kartlar: sar(async (req) => TicariStokSqlRepository.kartlar({
    arama: metin(req.query.arama) ?? undefined,
    grupId: sayiVeyaNull(req.query.grupId),
    aktif: req.query.aktif === "1" ? true : req.query.aktif === "0" ? false : null,
    limit: sayiVeyaNull(req.query.limit) ?? undefined,
  }, baglam(req))),
  kart: sar(async (req) => {
    const k = await TicariStokSqlRepository.kart(kimlik(req), baglam(req), true);
    if (!k) throw ApiError.notFound("Stok kartı bulunamadı.");
    return k;
  }),
  kartBul: sar(async (req) => {
    const k = await TicariStokSqlRepository.kartBul(String(req.params.deger || ""), baglam(req));
    if (!k) throw ApiError.notFound(`"${req.params.deger}" barkodlu ya da kodlu stok kartı bulunamadı.`);
    return k;
  }),
  kartKaydet: sar(async (req) => TicariStokSqlRepository.kartKaydet({ ...(req.body || {}), stokKartId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
  kartSil: sar(async (req) => TicariStokSqlRepository.kartSil(kimlik(req), baglam(req))),

  excelOrnek: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const b = await ornekExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="stok_kartlari_ornek.xlsx"`);
      res.send(b);
    } catch (e) {
      next(e);
    }
  },
  excelOnizle: sar(async (req) => excelOnizle(dosyaOku(req), baglam(req))),
  excelYukle: sar(async (req) => excelYukle(dosyaOku(req), kullanici(req), baglam(req))),

  girisSiraNo: sar(async (req) => ({ fisNo: await TicariGirisSqlRepository.siradakiNo(baglam(req)) })),
  girisListe: sar(async (req) => TicariGirisSqlRepository.liste({
    baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis), cariKartId: sayiVeyaNull(req.query.cariKartId), arama: metin(req.query.arama),
  }, baglam(req))),
  girisGetir: sar(async (req) => {
    const f = await TicariGirisSqlRepository.getir(kimlik(req), baglam(req));
    if (!f) throw ApiError.notFound("Stok giriş fişi bulunamadı.");
    return f;
  }),
  girisKaydet: sar(async (req) => TicariGirisSqlRepository.kaydet({ ...(req.body || {}), stokGirisId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
  girisSil: sar(async (req) => TicariGirisSqlRepository.sil(kimlik(req), req.query.onay === "1", baglam(req))),

  satisSiraNo: sar(async (req) => ({ faturaNo: await TicariSatisSqlRepository.siradakiNo(metin(req.query.senaryo), baglam(req)) })),
  satisListe: sar(async (req) => TicariSatisSqlRepository.liste({
    baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis), arama: metin(req.query.arama),
    eBelgeDurumu: sayiVeyaNull(req.query.eBelgeDurumu), stokKartId: sayiVeyaNull(req.query.stokKartId),
  }, baglam(req))),
  satisKimlikler: sar(async (req) => TicariSatisSqlRepository.kimlikler(baglam(req))),
  satisGetir: sar(async (req) => {
    const f = await TicariSatisSqlRepository.getir(kimlik(req), baglam(req));
    if (!f) throw ApiError.notFound("Satış fişi bulunamadı.");
    return f;
  }),
  satisKaydet: sar(async (req) => TicariSatisSqlRepository.kaydet({ ...(req.body || {}), faturaId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
  satisSil: sar(async (req) => TicariSatisSqlRepository.sil(kimlik(req), baglam(req))),

  stokDurum: sar(async (req) => TicariStokSqlRepository.stokDurum({
    tarih: metin(req.query.tarih), grupId: sayiVeyaNull(req.query.grupId), arama: metin(req.query.arama),
    yalnizEksik: req.query.yalnizEksik === "1", pasifler: req.query.pasifler === "1",
  }, baglam(req))),
  hareketler: sar(async (req) => TicariStokSqlRepository.hareketler({
    stokKartId: sayiVeyaNull(req.query.stokKartId), baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis),
    belgeTuru: sayiVeyaNull(req.query.belgeTuru), grupId: sayiVeyaNull(req.query.grupId),
  }, baglam(req))),
};

function dosyaOku(req: Request): Buffer {
  const ham = String(req.body?.dosya || "");
  const b64 = ham.includes(",") ? ham.slice(ham.indexOf(",") + 1) : ham;
  if (!b64) throw ApiError.badRequest("Dosya seçilmedi.");
  const b = Buffer.from(b64, "base64");
  if (!b.length) throw ApiError.badRequest("Dosya boş.");
  if (b.length > 15 * 1024 * 1024) throw ApiError.badRequest("Dosya 15 MB'tan büyük olamaz.");
  return b;
}
