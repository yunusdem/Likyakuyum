import { Request, Response } from "express";
import { adminYapilandirildiMi } from "../config/adminDb.config.js";
import { setDbCredentials } from "../config/mssql.config.js";
import { PosAdminSqlRepository } from "../models/admin/posAdminSql.repository.js";
import { MerkezGirisService } from "../services/merkezGiris.service.js";
import { PosService } from "../services/pos/pos.service.js";
import { PosMerkezService, PosOturum } from "../services/pos/posMerkez.service.js";
import { inposSonucuCoz, inposWebhookYetkili } from "../services/pos/inpos.surucu.js";
import { tokenSonucuCoz } from "../services/pos/token.surucu.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";

// POS cihazı entegrasyonu — docs/POS_ENTEGRASYON_YOL_HARITASI.md

export class PosController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.headers["x-db-server"] as string),
      dbName: req.user?.dbName || (req.headers["x-db-name"] as string),
    };
  }

  private static oturum(req: Request): PosOturum {
    return { firmaId: req.user?.firmaId, ...PosController.getDbContext(req) };
  }

  private static kullaniciId(req: Request): number | null {
    const u = req.user as any;
    return Number(u?.userId || u?.id) || null;
  }

  public static durum = asyncHandler(async (req: Request, res: Response) => {
    const vezneId = Number(req.query.vezneId) || null;
    return ApiResponse.ok(res, "POS durumu getirildi.", await PosService.durum(PosController.oturum(req), vezneId, PosController.getDbContext(req)));
  });

  // ─── Cihaz tanımları ───────────────────────────────────────────────────────
  public static tanimlar = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS cihazları getirildi.", await PosService.tanimlar(PosController.oturum(req), PosController.getDbContext(req)));
  });

  public static terminalKaydet = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS cihazı kaydedildi.", await PosService.terminalKaydet(req.body || {}, PosController.getDbContext(req)));
  });

  public static terminalSil = asyncHandler(async (req: Request, res: Response) => {
    await PosService.terminalSil(Number(req.params.id), PosController.getDbContext(req));
    return ApiResponse.ok(res, "POS cihazı silindi.");
  });

  public static baglantiTesti = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosService.baglantiTesti(Number(req.params.id), PosController.oturum(req), PosController.getDbContext(req));
    return ApiResponse.ok(res, "Bağlantı denendi.", data);
  });

  public static gunSonu = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosService.gunSonu(Number(req.params.id), PosController.oturum(req), PosController.getDbContext(req));
    return ApiResponse.ok(res, "Gün sonu istendi.", data);
  });

  public static bankaEslemeleriniYaz = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Banka eşlemeleri kaydedildi.", await PosService.bankaEslemeleriniYaz(req.body?.eslemeler, PosController.getDbContext(req)));
  });

  // ─── Tahsilat ──────────────────────────────────────────────────────────────
  public static baslat = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosService.baslat(req.body || {}, PosController.oturum(req), PosController.kullaniciId(req), PosController.getDbContext(req));
    return ApiResponse.ok(res, "Tahsilat cihaza gönderildi.", data);
  });

  /** Fiş başına tek sipariş (Inpos bulut): aynı fişin bütün POS satırları birlikte gönderilir. */
  public static baslatToplu = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosService.baslatToplu(req.body || {}, PosController.oturum(req), PosController.kullaniciId(req), PosController.getDbContext(req));
    return ApiResponse.ok(res, "Tahsilat cihaza gönderildi.", data);
  });

  public static elleAlindi = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosService.elleAlindi(req.body || {}, PosController.oturum(req), PosController.kullaniciId(req), PosController.getDbContext(req));
    return ApiResponse.ok(res, "Tahsilat alındı olarak işaretlendi.", data);
  });

  public static getir = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS işlemi getirildi.", await PosService.getir(Number(req.params.id), PosController.getDbContext(req)));
  });

  public static iptal = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "POS işlemi iptal edildi.", await PosService.iptal(Number(req.params.id), PosController.getDbContext(req)));
  });

  public static elleIsaretle = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosService.elleIsaretle(Number(req.params.id), req.body?.alindi === true, PosController.kullaniciId(req), PosController.getDbContext(req));
    return ApiResponse.ok(res, "İşaret kaydedildi.", data);
  });

  public static iadeIsaretle = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosService.iadeIsaretle(Number(req.params.id), req.body?.iadeDurumu, PosController.kullaniciId(req), PosController.getDbContext(req));
    return ApiResponse.ok(res, "İade işareti kaydedildi.", data);
  });

  public static belgeyeBagla = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Tahsilatlar fişe bağlandı.", await PosService.belgeyeBagla(req.body || {}, PosController.getDbContext(req)));
  });

  public static belgeIslemleri = asyncHandler(async (req: Request, res: Response) => {
    const data = await PosService.belgeIslemleri(String(req.query.belgeTuru || ""), Number(req.query.belgeId), PosController.getDbContext(req));
    return ApiResponse.ok(res, "Fişin POS işlemleri getirildi.", data);
  });

  public static liste = asyncHandler(async (req: Request, res: Response) => {
    const yaz = (v: unknown) => (v ? String(v) : undefined);
    const data = await PosService.liste(
      {
        baslangic: yaz(req.query.baslangic),
        bitis: yaz(req.query.bitis),
        durum: yaz(req.query.durum),
        posTerminalId: Number(req.query.posTerminalId) || undefined,
        arama: yaz(req.query.arama)?.trim().slice(0, 100),
        sayfa: Number(req.query.sayfa) || 1,
        sayfaBoyutu: Number(req.query.sayfaBoyutu) || 100,
      },
      PosController.oturum(req),
      PosController.getDbContext(req)
    );
    return ApiResponse.ok(res, "POS işlemleri listelendi.", data);
  });

  /**
   * Token'ın sonuç bildirimi (oturumsuz). Adres her işlem için imzalıdır: imza tutmazsa hiçbir kayda dokunulmaz.
   * Token yeniden denemesin diye, işlenemeyen bildirimde de 200 dönülür; ayrıntı merkezdeki POS günlüğündedir.
   */
  public static tokenDonus = asyncHandler(async (req: Request, res: Response) => {
    const firmaId = Number(req.params.firmaId);
    const posIslemId = Number(req.params.islemId);
    // Admin veritabanı yapılandırılmamış sunucuda imza anahtarı da yoktur: bildirim hiç kabul edilmez
    const gecerli =
      adminYapilandirildiMi() && Number.isInteger(firmaId) && Number.isInteger(posIslemId) && PosMerkezService.donusImzasiGecerli(firmaId, posIslemId, String(req.params.imza));
    if (!gecerli) {
      await PosAdminSqlRepository.logYaz({ tur: "DONUS", ozet: "Token bildirimi: imza geçersiz, yok sayıldı", yanit: req.body, basarili: false });
      return res.status(404).json({ success: false, message: "Bulunamadı." });
    }

    let ozet = `Token bildirimi: ${req.body?.operation || "?"} (işlem ${posIslemId})`;
    let basarili = true;
    try {
      const sonuc = tokenSonucuCoz(req.body);
      if (sonuc) {
        const b = await MerkezGirisService.firmaBaglantisi(firmaId);
        setDbCredentials(b.dbServer, b.dbName, b.dbUser, b.dbSifre);
        await PosService.disaridanSonuc(posIslemId, sonuc, { dbServer: b.dbServer, dbName: b.dbName });
        ozet += ` → ${sonuc.fisIptali ? "FİŞ İPTALİ" : sonuc.durum}`;
      }
    } catch (err: any) {
      basarili = false;
      ozet += ` → işlenemedi: ${err?.message || err}`;
      logger.error(`[POS] ${ozet}`);
    }
    await PosAdminSqlRepository.logYaz({ tur: "DONUS", firmaId, ozet, yanit: req.body, basarili });
    return res.status(200).json({ success: true });
  });

  /**
   * Inpos'un sipariş durum bildirimi (oturumsuz; Basic Auth, kullanıcı adı / şifre yönetim panelinde). Adres tektir:
   * siparişin firması merkezdeki sipariş kaydından bulunur. Bilinmeyen sipariş ya da işlenemeyen bildirimde kayda
   * dokunulmaz; Inpos yeniden denemesin diye 200 dönülür, ayrıntı merkezdeki POS günlüğündedir.
   */
  public static inposDonus = asyncHandler(async (req: Request, res: Response) => {
    if (!adminYapilandirildiMi() || !(await inposWebhookYetkili(req.headers.authorization))) {
      await PosAdminSqlRepository.logYaz({ tur: "DONUS", ozet: "Inpos bildirimi: kimlik geçersiz, yok sayıldı", yanit: req.body, basarili: false });
      res.setHeader("WWW-Authenticate", 'Basic realm="pos-donus"');
      return res.status(401).json({ success: false, message: "Yetkisiz." });
    }
    const govde = req.body || {};
    const ref = govde.id ? String(govde.id) : "";
    const durum = String(govde.status || "?");
    let ozet = `Inpos bildirimi: ${durum} (sipariş ${ref || "?"})`;
    let basarili = true;
    let firmaId: number | null = null;
    try {
      firmaId = ref ? await PosAdminSqlRepository.sepetFirmasi("inpos", ref) : null;
      if (!firmaId) {
        ozet += " → sipariş bilinmiyor, yok sayıldı";
      } else {
        const sonuc = inposSonucuCoz(govde);
        if (sonuc) {
          const b = await MerkezGirisService.firmaBaglantisi(firmaId);
          setDbCredentials(b.dbServer, b.dbName, b.dbUser, b.dbSifre);
          const n = await PosService.disaridanGrupSonuc(ref, sonuc, { dbServer: b.dbServer, dbName: b.dbName });
          ozet += ` → ${sonuc.durum} (${n} satır)`;
        }
      }
    } catch (err: any) {
      basarili = false;
      ozet += ` → işlenemedi: ${err?.message || err}`;
      logger.error(`[POS] ${ozet}`);
    }
    await PosAdminSqlRepository.logYaz({ tur: "DONUS", firmaId, ozet, yanit: govde, basarili });
    // Inpos "Sipariş Durum Güncelleme" cevabında sipariş detayını bekler; elimizdekini yankılarız
    return res.status(200).json({ id: ref, no: Number(govde.no) || 0, name: "", status: govde.status || "", createdAt: new Date().toISOString() });
  });
}
