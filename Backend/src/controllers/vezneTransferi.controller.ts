import { Request, Response } from "express";
import { fisKayitYetkisi, gunSiniri, kayitErisimi, sonrakiGun } from "../services/yetki/fisYetkileri.js";
import { VezneTransferiService } from "../services/vezneTransferi.service.js";
import { VezneTransferOnaySqlRepository } from "../models/vezneTransferOnaySql.repository.js";
import { UserSqlRepository } from "../models/userSql.repository.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { notifyVezneBakiyeDegisti } from "../services/vezneEventService.js";
import { fisDurbunFiltresiOku } from "../utils/fisDurbunFiltre.js";

export class VezneTransferiController {
  private static getDbContext(req: Request) {
    return {
      dbServer:
        req.user?.dbServer ||
        (req.headers["x-db-server"] as string) ||
        (req.query.dbServer as string) ||
        (req.body?.dbServer as string),
      dbName:
        req.user?.dbName ||
        (req.headers["x-db-name"] as string) ||
        (req.query.dbName as string) ||
        (req.body?.dbName as string),
    };
  }

  /**
   * GET /api/v1/vezne-transferi
   */
  public static getTransfers = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const filters = {
      search: req.query.search as string,
      alanVezneId: req.query.alanVezneId ? Number(req.query.alanVezneId) : undefined,
      verenVezneId: req.query.verenVezneId ? Number(req.query.verenVezneId) : undefined,
      // Kullanıcının işlem gösterme sınırı istekteki başlangıçtan sonraysa o geçerli
      startDate: (sonrakiGun(req.query.startDate as string, await gunSiniri(req)) ?? undefined) as string,
      endDate: req.query.endDate as string,
      limit: req.query.limit ? Number(req.query.limit) : 200,
      // Dürbün gelişmiş filtresi (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4)
      durbun: fisDurbunFiltresiOku(req.query as Record<string, unknown>),
    };
    const list = await VezneTransferiService.getTransfers(filters, dbContext);
    return ApiResponse.ok(res, "Vezne transferleri listelendi.", list);
  });

  /**
   * GET /api/v1/vezne-transferi/navigation
   */
  public static getNavigation = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const currentId = req.query.currentId ? Number(req.query.currentId) : null;
    const nav = await VezneTransferiService.getNavigation(currentId, dbContext, await gunSiniri(req));
    return ApiResponse.ok(res, "Gezinme bilgisi getirildi.", nav);
  });

  /**
   * GET /api/v1/vezne-transferi/next-ref
   */
  public static getNextRefNo = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const ref = await VezneTransferiService.getNextRefNo(dbContext);
    return ApiResponse.ok(res, "Sonraki referans numarası üretildi.", { refNo: ref });
  });

  /**
   * GET /api/v1/vezne-transferi/bakiye/:vezneId
   */
  public static getVezneBakiyeler = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const vezneId = Number(req.params.vezneId) || 0;
    const bakiyeler = await VezneTransferiService.getVezneBakiyeler(vezneId, dbContext);
    return ApiResponse.ok(res, "Vezne bakiye listesi getirildi.", bakiyeler);
  });

  /**
   * GET /api/v1/vezne-transferi/:id
   */
  public static getTransferById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const id = Number(req.params.id);
    await kayitErisimi(req, "vezneTransferi", id);
    const item = await VezneTransferiService.getTransferById(id, dbContext);
    if (!item) {
      throw ApiError.notFound("Vezne transfer kaydı bulunamadı.");
    }
    return ApiResponse.ok(res, "Vezne transfer detayları getirildi.", item);
  });

  /**
   * POST /api/v1/vezne-transferi
   */
  public static saveTransfer = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const u = req.user as any;
    const kullaniciId = u?.userId || u?.id || req.body.kullaniciId || 1;
    // Gün sınırı, tarih ve referans numarası yetkisi (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
    const { nolar } = await fisKayitYetkisi(req, "vezneTransferi", req.body?.id, req.body?.tarih);

    const payload = {
      ...req.body,
      ...(nolar && { refNo: nolar.REF_NO ?? null }),
      kullaniciId,
    };
    const saved = await VezneTransferiService.saveTransfer(payload, dbContext);
    notifyVezneBakiyeDegisti({ type: "transfer" });
    return ApiResponse.ok(res, "Vezne transferi başarıyla kaydedildi.", saved);
  });

  /**
   * DELETE /api/v1/vezne-transferi/:id
   */
  public static deleteTransfer = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const id = Number(req.params.id);
    const u = req.user as any;
    const kullaniciId = u?.userId || u?.id || 1;
    const degisiklikTakipVar = req.body?.degisiklikTakipVar || false;

    // "Kendi kayıtları" kullanıcısı mevcut kaydı silemez (ortak alan denetimi 19.11.2026, #24)
    await kayitErisimi(req, "vezneTransferi", id, { isDelete: true });
    await VezneTransferiService.deleteTransfer(id, kullaniciId, degisiklikTakipVar, dbContext);
    notifyVezneBakiyeDegisti({ type: "transfer_delete", id });
    return ApiResponse.ok(res, "Vezne transferi başarıyla silindi.", { id });
  });

  /**
   * POST /api/v1/vezne-transferi/onay-talep
   */
  public static createApprovalRequest = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const u = req.user as any;
    const kullaniciId = Number(u?.userId || u?.id) || 1;
    const { nolar } = await fisKayitYetkisi(req, "vezneTransferi", req.body?.id, req.body?.tarih);

    const dbUser = await UserSqlRepository.findById(String(kullaniciId), dbContext).catch(() => null);
    const onayVezneId = Number(req.body?.onayVezneId || dbUser?.onayAlinacakVezneId || 0);
    if (!onayVezneId || onayVezneId <= 0) {
      throw ApiError.badRequest("Onay alınacak vezne tanımlı değil.");
    }

    const payloadToSave = {
      ...req.body,
      ...(nolar && { refNo: nolar.REF_NO ?? null }),
      kullaniciId,
    };
    delete (payloadToSave as any).onayVezneId;

    const record = await VezneTransferOnaySqlRepository.createRequest(
      {
        talepEdenId: kullaniciId,
        talepEdenAd: dbUser?.fullName || dbUser?.username || u?.username || "Kullanıcı",
        talepEdenVezneId: dbUser?.vezneId ?? null,
        onayVezneId,
        islemTipi: req.body?.id ? "DUZELTME" : "KAYIT",
        transferId: req.body?.id ? Number(req.body.id) : null,
        alanVezneId: Number(req.body?.alanVezneId),
        verenVezneId: Number(req.body?.verenVezneId),
        tarih: String(req.body?.tarih || ""),
        aciklama: String(req.body?.aciklama || ""),
        payloadJson: JSON.stringify(payloadToSave),
      },
      dbContext
    );

    return ApiResponse.ok(res, "Onay talebi gönderildi.", record);
  });

  /**
   * GET /api/v1/vezne-transferi/onay-bekleyenler
   */
  public static getPendingApprovals = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const u = req.user as any;
    const kullaniciId = Number(u?.userId || u?.id) || 0;
    if (!kullaniciId) {
      return ApiResponse.ok(res, "Bekleyen onay yok.", []);
    }
    const dbUser = await UserSqlRepository.findById(String(kullaniciId), dbContext).catch(() => null);
    const userVezneId = Number(dbUser?.vezneId || u?.vezneId || 0);
    if (!userVezneId) {
      return ApiResponse.ok(res, "Bekleyen onay yok.", []);
    }
    const list = await VezneTransferOnaySqlRepository.listPendingForVezne(userVezneId, kullaniciId, dbContext);
    return ApiResponse.ok(res, "Bekleyen onaylar listelendi.", list);
  });

  /**
   * GET /api/v1/vezne-transferi/onay-durum/:onayId
   */
  public static getApprovalStatus = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const onayId = Number(req.params.onayId);
    const rec = await VezneTransferOnaySqlRepository.getById(onayId, dbContext);
    if (!rec) {
      throw ApiError.notFound("Onay talebi bulunamadı.");
    }
    let savedTransfer = null;
    if (rec.durum === "ONAYLANDI" && rec.transferId) {
      savedTransfer = await VezneTransferiService.getTransferById(rec.transferId, dbContext).catch(() => null);
    }
    return ApiResponse.ok(res, "Onay durumu getirildi.", { ...rec, savedTransfer });
  });

  /**
   * POST /api/v1/vezne-transferi/onay-karar/:onayId
   */
  public static decideApproval = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const onayId = Number(req.params.onayId);
    const kararRaw = String(req.body?.karar || "").toUpperCase();
    if (kararRaw !== "ONAYLANDI" && kararRaw !== "REDDEDILDI") {
      throw ApiError.badRequest("Geçersiz karar değeri. ONAYLANDI veya REDDEDILDI olmalıdır.");
    }

    const u = req.user as any;
    const kararVerenId = Number(u?.userId || u?.id) || 1;
    const dbUser = await UserSqlRepository.findById(String(kararVerenId), dbContext).catch(() => null);
    const kararVerenAd = dbUser?.fullName || dbUser?.username || u?.username || "Yetkili";

    const existing = await VezneTransferOnaySqlRepository.getById(onayId, dbContext);
    if (!existing) {
      throw ApiError.notFound("Onay talebi bulunamadı.");
    }
    if (existing.durum !== "BEKLIYOR") {
      return ApiResponse.ok(res, "Bu talep zaten sonuçlandırılmış.", existing);
    }

    let savedTransferId: number | null = existing.transferId;
    if (kararRaw === "ONAYLANDI") {
      const parsedPayload = JSON.parse(existing.payloadJson || "{}");
      const saved = await VezneTransferiService.saveTransfer(parsedPayload, dbContext);
      savedTransferId = saved?.id ?? null;
      notifyVezneBakiyeDegisti({ type: "transfer" });
    }

    const updated = await VezneTransferOnaySqlRepository.updateDecision(
      onayId,
      kararRaw as "ONAYLANDI" | "REDDEDILDI",
      kararVerenId,
      kararVerenAd,
      savedTransferId,
      req.body?.kararNotu || null,
      dbContext
    );

    return ApiResponse.ok(
      res,
      kararRaw === "ONAYLANDI" ? "Vezne transferi onaylandı ve kaydedildi." : "Vezne transferi reddedildi.",
      updated
    );
  });

  /**
   * GET /api/v1/vezne-transferi/onay-sonuclar
   */
  public static getUnseenApprovalResults = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const u = req.user as any;
    const kullaniciId = Number(u?.userId || u?.id) || 0;
    if (!kullaniciId) {
      return ApiResponse.ok(res, "Sonuç yok.", []);
    }
    const list = await VezneTransferOnaySqlRepository.listUnseenResultsForRequester(kullaniciId, dbContext);
    return ApiResponse.ok(res, "Onay sonuçları listelendi.", list);
  });

  /**
   * POST /api/v1/vezne-transferi/onay-goruldu/:onayId
   */
  public static markApprovalSeen = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = VezneTransferiController.getDbContext(req);
    const onayId = Number(req.params.onayId);
    const u = req.user as any;
    const kullaniciId = Number(u?.userId || u?.id) || 0;
    if (kullaniciId && onayId) {
      await VezneTransferOnaySqlRepository.markSeenByRequester(onayId, kullaniciId, dbContext);
    }
    return ApiResponse.ok(res, "Bildirim görüldü olarak işaretlendi.", { onayId });
  });
}
