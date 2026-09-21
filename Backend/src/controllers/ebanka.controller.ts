import { Request, Response } from "express";
import { EBankaService } from "../services/ebanka.service.js";
import { EBankaAktarimService } from "../services/ebankaAktarim.service.js";
import { EBankaDenetimService } from "../services/ebankaDenetim.service.js";
import { EBankaEsitlemeService } from "../services/ebankaEsitleme.service.js";
import { EBankaPosService } from "../services/ebankaPos.service.js";
import { EBankaVposService } from "../services/ebankaVpos.service.js";
import { DONUS_SAYFASI, EBankaVposOdemeService } from "../services/ebankaVposOdeme.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export class EBankaController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.headers["x-db-server"] as string),
      dbName: req.user?.dbName || (req.headers["x-db-name"] as string),
    };
  }

  private static kullaniciId(req: Request): number | undefined {
    const u = req.user as any;
    return Number(u?.userId || u?.id) || undefined;
  }

  // ─── Ayarlar ───────────────────────────────────────────────────────────────
  public static ayarGetir = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaService.ayarGetir(EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "e-Banka ayarları getirildi.", data);
  });

  public static ayarKaydet = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaService.ayarKaydet(req.body || {}, EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "e-Banka ayarları kaydedildi.", data);
  });

  public static baglantiTesti = asyncHandler(async (req: Request, res: Response) => {
    const servis = req.body?.servis === "vpos" ? "vpos" : "banka";
    const data = await EBankaService.baglantiTesti(servis, EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Bağlantı başarılı.", data);
  });

  public static logListele = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaService.logListele(Number(req.query.limit) || 50, EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "İşlem günlüğü listelendi.", data);
  });

  // ─── Sistem denetimi ───────────────────────────────────────────────────────
  public static denetim = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Sistem denetimi tamamlandı.", await EBankaDenetimService.denetle(EBankaController.getDbContext(req)));
  });

  public static denemeFisi = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaDenetimService.denemeFisi(Number(req.body?.bankaId), EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, data.basarili ? "Deneme fişi kesildi ve silindi." : "Deneme fişi adımlarında sorun var.", data);
  });

  // ─── Eşitleme ──────────────────────────────────────────────────────────────
  public static esitle = asyncHandler(async (req: Request, res: Response) => {
    const { baslangic, bitis } = req.body || {};
    const data = await EBankaEsitlemeService.esitle({ baslangic, bitis }, EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Eşitleme tamamlandı.", data);
  });

  // ─── Özet / Hesaplar / Hareketler ──────────────────────────────────────────
  public static ozet = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "e-Banka özeti getirildi.", await EBankaService.ozet(EBankaController.getDbContext(req)));
  });

  public static hesaplariListele = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Hesaplar listelendi.", await EBankaService.hesaplariListele(EBankaController.getDbContext(req)));
  });

  public static hesapEsle = asyncHandler(async (req: Request, res: Response) => {
    const bankaId = req.body?.bankaId ? Number(req.body.bankaId) : null;
    const data = await EBankaService.hesapEsle(Number(req.params.id), bankaId, EBankaController.getDbContext(req));
    return ApiResponse.ok(res, bankaId ? "Hesap eşlendi." : "Hesap eşlemesi kaldırıldı.", data);
  });

  public static hareketleriListele = asyncHandler(async (req: Request, res: Response) => {
    const q = req.query;
    const say = (v: unknown) => (v !== undefined && v !== "" ? Number(v) : undefined);
    const yaz = (v: unknown) => (v ? String(v) : undefined);
    const data = await EBankaService.hareketleriListele(
      {
        baslangic: yaz(q.baslangic),
        bitis: yaz(q.bitis),
        vomsisHesapId: say(q.vomsisHesapId),
        vomsisBankaId: say(q.vomsisBankaId),
        tipKodu: yaz(q.tipKodu),
        tur: yaz(q.tur),
        aktarimDurumu: say(q.aktarimDurumu),
        arama: yaz(q.arama),
        sayfa: say(q.sayfa),
        sayfaBoyutu: say(q.sayfaBoyutu),
      },
      EBankaController.getDbContext(req)
    );
    return ApiResponse.ok(res, "Hareketler listelendi.", data);
  });

  public static hareketGetir = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Hareket getirildi.", await EBankaService.hareketGetir(Number(req.params.id), EBankaController.getDbContext(req)));
  });

  // ─── Aktarım / Bekleyenler ─────────────────────────────────────────────────
  public static bekleyenler = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Bekleyenler listelendi.", await EBankaAktarimService.bekleyenler(EBankaController.getDbContext(req)));
  });

  public static aktarimCalistir = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaAktarimService.calistir(EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Otomatik aktarım tamamlandı.", data);
  });

  public static elleAktar = asyncHandler(async (req: Request, res: Response) => {
    const { cariKartId, kur } = req.body || {};
    const data = await EBankaAktarimService.elleAktar(Number(req.params.id), { cariKartId, kur }, EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Hareket banka fişine aktarıldı.", data);
  });

  public static aktarimDurumu = asyncHandler(async (req: Request, res: Response) => {
    const { vomsisIdler, aktarilmayacak } = req.body || {};
    const data = await EBankaAktarimService.durumDegistir(vomsisIdler, Boolean(aktarilmayacak), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Hareket durumu güncellendi.", data);
  });

  public static tipKurallari = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Hareket tipi kuralları listelendi.", await EBankaAktarimService.tipKurallari(EBankaController.getDbContext(req)));
  });

  public static tipKuraliKaydet = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaAktarimService.tipKuraliKaydet(String(req.params.tipKodu), req.body || {}, EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Hareket tipi kuralı kaydedildi.", data);
  });

  public static cariAra = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Cariler listelendi.", await EBankaAktarimService.cariAra(String(req.query.arama || ""), EBankaController.getDbContext(req)));
  });

  // ─── Fiziksel POS ──────────────────────────────────────────────────────────
  private static posFiltre(req: Request) {
    const q = req.query;
    const say = (v: unknown) => (v !== undefined && v !== "" ? Number(v) : undefined);
    const yaz = (v: unknown) => (v ? String(v) : undefined);
    return {
      baslangic: yaz(q.baslangic),
      bitis: yaz(q.bitis),
      vomsisTerminalId: say(q.vomsisTerminalId),
      fisDurumu: yaz(q.fisDurumu),
      arama: yaz(q.arama),
      sayfa: say(q.sayfa),
      sayfaBoyutu: say(q.sayfaBoyutu),
    };
  }

  public static posOzet = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS terminalleri listelendi.", await EBankaPosService.ozet(EBankaController.getDbContext(req)));
  });

  public static posEsitle = asyncHandler(async (req: Request, res: Response) => {
    const { baslangic, bitis } = req.body || {};
    const data = await EBankaPosService.esitle({ baslangic, bitis }, EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "POS eşitlemesi tamamlandı.", data);
  });

  public static posHareketleri = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaPosService.hareketleriListele(EBankaController.posFiltre(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "POS hareketleri listelendi.", data);
  });

  public static posExcel = asyncHandler(async (req: Request, res: Response) => {
    const dosya = await EBankaPosService.excel(EBankaController.posFiltre(req), EBankaController.getDbContext(req));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="pos-hareketleri.xlsx"`);
    res.setHeader("Content-Length", String(dosya.length));
    res.setHeader("Cache-Control", "no-store");
    res.end(dosya);
  });

  public static posFisKes = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaPosService.fisKes(req.body || {}, EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Banka fişi oluşturuldu.", data);
  });

  // ─── Sanal POS: ödeme linkleri / işlemler ──────────────────────────────────
  public static vposLinkler = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Ödeme linkleri listelendi.", await EBankaVposService.linkleriListele(EBankaController.getDbContext(req)));
  });

  public static vposLinkOlustur = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaVposService.linkOlustur(req.body || {}, EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Ödeme linki oluşturuldu.", data);
  });

  public static vposLinkleriGuncelle = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaVposService.linkleriGuncelle(EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Ödeme linkleri güncellendi.", data);
  });

  public static vposLinkSil = asyncHandler(async (req: Request, res: Response) => {
    await EBankaVposService.linkSil(String(req.params.uid), EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Ödeme linki silindi.");
  });

  public static vposCariIletisim = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Cari bilgisi getirildi.", await EBankaVposService.cariIletisim(Number(req.params.id), EBankaController.getDbContext(req)));
  });

  public static vposIslemler = asyncHandler(async (req: Request, res: Response) => {
    const yaz = (v: unknown) => (v ? String(v) : undefined);
    const data = await EBankaVposService.islemleriListele({ baslangic: yaz(req.query.baslangic), bitis: yaz(req.query.bitis), arama: yaz(req.query.arama) }, EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Sanal POS işlemleri listelendi.", data);
  });

  public static vposIslemleriGuncelle = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaVposService.islemleriGuncelle(EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Sanal POS işlemleri güncellendi.", data);
  });

  public static vposIslemDetayi = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "İşlem detayı getirildi.", await EBankaVposService.islemDetayi(String(req.params.ref), EBankaController.getDbContext(req)));
  });

  public static vposIptalIade = asyncHandler(async (req: Request, res: Response) => {
    const { tur, tutar } = req.body || {};
    const data = await EBankaVposService.iptalIade(String(req.params.ref), { tur, tutar }, EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, tur === "cancel" ? "İşlem iptal edildi." : "İade yapıldı.", data);
  });

  public static vposMusteriler = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Vomsis müşterileri listelendi.", await EBankaVposService.vomsisMusterileri(EBankaController.getDbContext(req)));
  });

  // ─── Sanal POS: kartla ödeme (3D Secure) ───────────────────────────────────
  public static vposTaksitler = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Taksit tablosu getirildi.", await EBankaVposOdemeService.taksitTablosu(EBankaController.getDbContext(req)));
  });

  public static vposBin = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Kart bilgisi getirildi.", await EBankaVposOdemeService.binSorgula(req.body?.bin, EBankaController.getDbContext(req)));
  });

  public static vposOdemeBaslat = asyncHandler(async (req: Request, res: Response) => {
    const ip = (req.ip || req.socket?.remoteAddress || "").replace(/^::ffff:/, "") || "127.0.0.1";
    const data = await EBankaVposOdemeService.odemeBaslat(req.body || {}, ip, EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    res.setHeader("Cache-Control", "no-store");
    return ApiResponse.ok(res, "Ödeme 3D Secure doğrulamasına gönderildi.", data);
  });

  public static vposOdemeSonucu = asyncHandler(async (req: Request, res: Response) => {
    const data = await EBankaVposOdemeService.sonuc(String(req.params.ref), EBankaController.kullaniciId(req), EBankaController.getDbContext(req));
    return ApiResponse.ok(res, "Ödeme sonucu getirildi.", data);
  });

  /** Bankanın 3D sonrası müşteriyi yolladığı sayfa. Oturum gerektirmez, gelen veriyi okumaz; sonuç ekrandan Vomsis'e sorularak öğrenilir. */
  public static vposDonus = (_req: Request, res: Response) => {
    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(DONUS_SAYFASI);
  };

  public static hareketTipleri = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Hareket tipleri listelendi.", await EBankaService.hareketTipleri(EBankaController.getDbContext(req)));
  });
}
