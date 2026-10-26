import { CariService } from "../services/cari.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { kullaniciYetkisi } from "../services/yetki/kullaniciYetkisi.js";
export class CariController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body.dbName,
        };
    }
    /**
     * GET /api/v1/cari/lookups
     */
    static getLookups = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const lookups = await CariService.getLookups(dbContext);
        return ApiResponse.ok(res, "Cari lookup listeleri getirildi.", lookups);
    });
    /**
     * GET /api/v1/cari
     */
    static listCariKartlar = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const list = await CariService.listCariKartlar(dbContext);
        // "Cari bakiye görebilir" yetkisi yoksa bakiye alanları gönderilmez (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
        if (!(await kullaniciYetkisi(req)).cariBakiye) {
            const gizli = list.map(({ borcBakiye, alacakBakiye, netBakiye, bakiyeYon, hasBakiye, hasYon, bakiyeOzet, ...k }) => k);
            return ApiResponse.ok(res, "Cari kartlar başarıyla listelendi.", gizli);
        }
        return ApiResponse.ok(res, "Cari kartlar başarıyla listelendi.", list);
    });
    /**
     * GET /api/v1/cari/:id
     */
    static getCariKartById = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const item = await CariService.getCariKartById(req.params.id, dbContext);
        return ApiResponse.ok(res, "Cari kart detayı getirildi.", item);
    });
    /**
     * POST /api/v1/cari
     */
    static createCariKart = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const kullaniciId = req.user?.userId ? Number(req.user.userId) : undefined;
        const created = await CariService.createCariKart(req.body, dbContext, kullaniciId);
        return ApiResponse.created(res, "Cari kart başarıyla oluşturuldu.", created);
    });
    /**
     * PUT /api/v1/cari/:id
     */
    static updateCariKart = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const kullaniciId = req.user?.userId ? Number(req.user.userId) : undefined;
        const updated = await CariService.updateCariKart(req.params.id, req.body, dbContext, kullaniciId);
        return ApiResponse.ok(res, "Cari kart başarıyla güncellendi.", updated);
    });
    /**
     * DELETE /api/v1/cari/:id
     */
    static deleteCariKart = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        await CariService.deleteCariKart(req.params.id, dbContext);
        return ApiResponse.ok(res, "Cari kart başarıyla silindi.", { id: req.params.id });
    });
    // ─── Fotoğraf Endpoints ───────────────────────────────────────────────────
    /**
     * GET /api/v1/cari/:id/fotograf
     */
    static getCariFotograf = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const foto = await CariService.getCariFotograf(req.params.id, dbContext);
        return ApiResponse.ok(res, "Cari fotoğrafı getirildi.", foto);
    });
    /**
     * POST /api/v1/cari/:id/fotograf
     */
    static saveCariFotograf = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        const kullaniciId = req.user?.userId ? Number(req.user.userId) : undefined;
        const foto = await CariService.saveCariFotograf(req.params.id, req.body, kullaniciId, dbContext);
        return ApiResponse.ok(res, "Cari fotoğrafı başarıyla kaydedildi.", foto);
    });
    /**
     * DELETE /api/v1/cari/:id/fotograf
     */
    static deleteCariFotograf = asyncHandler(async (req, res) => {
        const dbContext = CariController.getDbContext(req);
        await CariService.deleteCariFotograf(req.params.id, dbContext);
        return ApiResponse.ok(res, "Cari fotoğrafı başarıyla silindi.");
    });
}
