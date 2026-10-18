import { fisKayitYetkisi, gunSiniri, kayitErisimi, sonrakiGun } from "../services/yetki/fisYetkileri.js";
import { VezneTransferiService } from "../services/vezneTransferi.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { notifyVezneBakiyeDegisti } from "../services/vezneEventService.js";
export class VezneTransferiController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer ||
                req.headers["x-db-server"] ||
                req.query.dbServer ||
                req.body?.dbServer,
            dbName: req.user?.dbName ||
                req.headers["x-db-name"] ||
                req.query.dbName ||
                req.body?.dbName,
        };
    }
    /**
     * GET /api/v1/vezne-transferi
     */
    static getTransfers = asyncHandler(async (req, res) => {
        const dbContext = VezneTransferiController.getDbContext(req);
        const filters = {
            search: req.query.search,
            alanVezneId: req.query.alanVezneId ? Number(req.query.alanVezneId) : undefined,
            verenVezneId: req.query.verenVezneId ? Number(req.query.verenVezneId) : undefined,
            // Kullanıcının işlem gösterme sınırı istekteki başlangıçtan sonraysa o geçerli
            startDate: (sonrakiGun(req.query.startDate, await gunSiniri(req)) ?? undefined),
            endDate: req.query.endDate,
            limit: req.query.limit ? Number(req.query.limit) : 200,
        };
        const list = await VezneTransferiService.getTransfers(filters, dbContext);
        return ApiResponse.ok(res, "Vezne transferleri listelendi.", list);
    });
    /**
     * GET /api/v1/vezne-transferi/navigation
     */
    static getNavigation = asyncHandler(async (req, res) => {
        const dbContext = VezneTransferiController.getDbContext(req);
        const currentId = req.query.currentId ? Number(req.query.currentId) : null;
        const nav = await VezneTransferiService.getNavigation(currentId, dbContext, await gunSiniri(req));
        return ApiResponse.ok(res, "Gezinme bilgisi getirildi.", nav);
    });
    /**
     * GET /api/v1/vezne-transferi/next-ref
     */
    static getNextRefNo = asyncHandler(async (req, res) => {
        const dbContext = VezneTransferiController.getDbContext(req);
        const ref = await VezneTransferiService.getNextRefNo(dbContext);
        return ApiResponse.ok(res, "Sonraki referans numarası üretildi.", { refNo: ref });
    });
    /**
     * GET /api/v1/vezne-transferi/bakiye/:vezneId
     */
    static getVezneBakiyeler = asyncHandler(async (req, res) => {
        const dbContext = VezneTransferiController.getDbContext(req);
        const vezneId = Number(req.params.vezneId) || 0;
        const bakiyeler = await VezneTransferiService.getVezneBakiyeler(vezneId, dbContext);
        return ApiResponse.ok(res, "Vezne bakiye listesi getirildi.", bakiyeler);
    });
    /**
     * GET /api/v1/vezne-transferi/:id
     */
    static getTransferById = asyncHandler(async (req, res) => {
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
    static saveTransfer = asyncHandler(async (req, res) => {
        const dbContext = VezneTransferiController.getDbContext(req);
        const u = req.user;
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
    static deleteTransfer = asyncHandler(async (req, res) => {
        const dbContext = VezneTransferiController.getDbContext(req);
        const id = Number(req.params.id);
        const u = req.user;
        const kullaniciId = u?.userId || u?.id || 1;
        const degisiklikTakipVar = req.body?.degisiklikTakipVar || false;
        await kayitErisimi(req, "vezneTransferi", id);
        await VezneTransferiService.deleteTransfer(id, kullaniciId, degisiklikTakipVar, dbContext);
        notifyVezneBakiyeDegisti({ type: "transfer_delete", id });
        return ApiResponse.ok(res, "Vezne transferi başarıyla silindi.", { id });
    });
}
