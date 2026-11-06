import { Request, Response } from "express";
import { MobilAuthService } from "../services/mobil/mobilAuth.service.js";
import { MobilFiyatService } from "../services/mobil/mobilFiyat.service.js";
import { MobilHesapService } from "../services/mobil/mobilHesap.service.js";
import { MobilEmirService } from "../services/mobil/mobilEmir.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { istemciIp, istemciTarayici } from "../utils/istemci.utils.js";

/** Mobil cari uçları — /api/v1/mobil (docs/MOBIL_CARI_YOL_HARITASI.md). Cari kimliği yalnız token'dan okunur. */
export class MobilController {
  /** GET /mobil/giris-bilgisi?m= */
  public static girisBilgisi = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Giriş bilgisi.", await MobilAuthService.girisBilgisi(String(req.query.m || "")))
  );

  /** POST /mobil/giris { musteriNo, kullaniciAdi, sifre } */
  public static giris = asyncHandler(async (req: Request, res: Response) => {
    const { musteriNo, kullaniciAdi, sifre } = req.body || {};
    if (!musteriNo || !kullaniciAdi || !sifre) throw ApiError.badRequest("Müşteri no, kullanıcı adı ve şifre gereklidir.");
    const sonuc = await MobilAuthService.giris(
      { musteriNo: String(musteriNo).slice(0, 20), kullaniciAdi: String(kullaniciAdi).slice(0, 50), sifre: String(sifre).slice(0, 200) },
      { ip: istemciIp(req), tarayici: istemciTarayici(req) }
    );
    return ApiResponse.ok(res, "Giriş başarılı.", sonuc);
  });

  /** GET /mobil/ben */
  public static ben = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Oturum.", await MobilAuthService.ben(req.mobil!)));

  /** POST /mobil/sifre { mevcutSifre, yeniSifre } */
  public static sifreDegistir = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Şifreniz değiştirildi.", await MobilAuthService.sifreDegistir(req.mobil!, req.body || {}))
  );

  /** POST /mobil/veritabani { firmaId } */
  public static veritabaniSec = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Veritabanı seçildi.", await MobilAuthService.veritabaniSec(req.mobil!, Number(req.body?.firmaId)))
  );

  /** POST /mobil/cikis */
  public static cikis = asyncHandler(async (req: Request, res: Response) => {
    await MobilAuthService.cikis(req.mobil!);
    return ApiResponse.ok(res, "Çıkış yapıldı.", null);
  });

  /** GET /mobil/fiyatlar — firmanın seçtiği ürünlerin carinin göreceği son fiyatı (K12) */
  public static fiyatlar = asyncHandler(async (req: Request, res: Response) => {
    const m = req.mobil!;
    return ApiResponse.ok(res, "Fiyatlar.", await MobilFiyatService.liste(m.ctx!, m.erisim!.cariKartId));
  });

  /** GET /mobil/bakiye — bakiye, limit, emanet (K10, K15) */
  public static bakiye = asyncHandler(async (req: Request, res: Response) => {
    const m = req.mobil!;
    return ApiResponse.ok(res, "Bakiye.", await MobilHesapService.bakiye(m.ctx!, m.erisim!.cariKartId));
  });

  /** GET /mobil/dokum?bas=YYYY-AA-GG&bit=YYYY-AA-GG */
  public static dokum = asyncHandler(async (req: Request, res: Response) => {
    const m = req.mobil!;
    return ApiResponse.ok(res, "Hesap dökümü.", await MobilHesapService.dokum(m.ctx!, m.erisim!.cariKartId, req.query.bas, req.query.bit));
  });

  /** GET /mobil/belgeler?bas=&bit= — cariye kesilen fişler */
  public static belgeler = asyncHandler(async (req: Request, res: Response) => {
    const m = req.mobil!;
    return ApiResponse.ok(res, "Fişler.", await MobilHesapService.belgeler(m.ctx!, m.erisim!.cariKartId, req.query.bas, req.query.bit));
  });

  /** GET /mobil/belge/:tur/:id.pdf — fişin çıktısı (K16) */
  public static belgePdf = asyncHandler(async (req: Request, res: Response) => {
    const m = req.mobil!;
    const s = await MobilHesapService.belgePdf(m.ctx!, m.erisim!.cariKartId, String(req.params.tur || "").toUpperCase(), Number(req.params.id), req.query.satir === undefined ? undefined : Number(req.query.satir));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(s.ad)}.pdf"`);
    res.setHeader("Content-Length", String(s.pdf.length));
    return res.status(200).end(s.pdf);
  });

  /** GET /mobil/islem — emir ekranı bilgisi (açık mı, tercihler, sınırlar) */
  public static islemBilgisi = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "İşlem bilgisi.", await MobilEmirService.bilgi(req.mobil!))
  );

  /** POST /mobil/emir { urunId, yon: AL|SAT, miktar, tercih, not, gorulenFiyat } */
  public static emirVer = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.created(res, "Emriniz alındı; firma onayına gönderildi.", await MobilEmirService.emirVer(req.mobil!, req.body || {}))
  );

  /** GET /mobil/emirler */
  /** GET /mobil/katalog — Ticari katalog (fiyat yetkisi) */
  public static katalog = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Katalog.", await MobilEmirService.katalog(req.mobil!)));

  /** POST /mobil/siparis { satirlar: [{ stokKartId, miktar, gorulenFiyat }], tercih, not } */
  public static siparisVer = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.created(res, "Siparişiniz alındı; firma onayına gönderildi.", await MobilEmirService.siparisVer(req.mobil!, req.body || {}))
  );

  public static emirlerim = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Emirler.", await MobilEmirService.emirlerim(req.mobil!)));

  /** POST /mobil/emir/:id/iptal */
  public static emirIptal = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Emir iptal edildi.", await MobilEmirService.iptal(req.mobil!, Number(req.params.id)))
  );
}
