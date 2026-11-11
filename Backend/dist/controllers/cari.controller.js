import { CariService } from "../services/cari.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
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
        const yetki = await kullaniciYetkisi(req);
        const isSysAdmin = !!(req.user?.role === "admin" || req.user?.isSysAdmin || yetki.yonetici);
        const filter = {
            userId: req.user?.userId ? Number(req.user.userId) : undefined,
            cariSinirlamaTipi: yetki.cariSinirlamaTipi,
            isSysAdmin,
        };
        const list = await CariService.listCariKartlar(dbContext, filter);
        // "Cari bakiye görebilir" yetkisi yoksa bakiye alanları gönderilmez (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
        if (!yetki.cariBakiye) {
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
        const yetki = await kullaniciYetkisi(req);
        const isSysAdmin = !!(req.user?.role === "admin" || req.user?.isSysAdmin || yetki.yonetici);
        const cariId = Number(req.params.id);
        // Cari sınırlama kontrolü
        if (!isSysAdmin && yetki.cariSinirlamaTipi && yetki.cariSinirlamaTipi > 0) {
            const atananlar = yetki.atananCariIdler || [];
            const iceriyor = atananlar.includes(cariId);
            if (yetki.cariSinirlamaTipi === 1 && !iceriyor) {
                throw ApiError.forbidden("Bu cari kartı görme yetkiniz bulunmamaktadır (İzin verilen cariler sınırlaması).");
            }
            if (yetki.cariSinirlamaTipi === 2 && iceriyor) {
                throw ApiError.forbidden("Bu cari kartı görme yetkiniz bulunmamaktadır (Yasaklanan cariler sınırlaması).");
            }
        }
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
        const fotos = await CariService.getAllCariFotograflar(req.params.id, dbContext);
        const primary = fotos.length > 0 ? fotos[0] : null;
        return ApiResponse.ok(res, "Cari fotoğrafları getirildi.", {
            fotograf: primary,
            fotograflar: fotos,
            // Doğrudan primary özelliklerini de döndürerek geriye dönük tam uyumluluk sağla
            ...(primary || {}),
        });
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
        const fotografId = req.query.fotografId ? Number(req.query.fotografId) : undefined;
        await CariService.deleteCariFotograf(req.params.id, fotografId, dbContext);
        return ApiResponse.ok(res, "Cari fotoğrafı başarıyla silindi.");
    });
}
