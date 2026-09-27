import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { CariSqlRepository } from "../models/cariSql.repository.js";
import { CariService } from "../services/cari.service.js";
import { TabloMaddesiSqlRepository } from "../models/tabloMaddesiSql.repository.js";
export class TanimlarController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body?.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body?.dbName,
        };
    }
    /**
     * GET /api/v1/tanimlar/tablo-maddesi?tur=11&q=
     */
    static getTabloMaddeleri = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const tur = Number(req.query.tur);
        const search = req.query.q ? String(req.query.q) : undefined;
        if (isNaN(tur)) {
            throw ApiError.badRequest("Geçerli bir 'tur' parametresi belirtilmelidir.");
        }
        const list = await TabloMaddesiSqlRepository.listByTur(tur, search, dbContext);
        return ApiResponse.ok(res, "Tablo maddeleri listelendi.", list);
    });
    /**
     * POST /api/v1/tanimlar/tablo-maddesi
     */
    static saveTabloMaddesi = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const { id, tur, ad, kod } = req.body;
        if (tur === undefined || isNaN(Number(tur))) {
            throw ApiError.badRequest("Geçerli bir 'tur' belirtilmelidir.");
        }
        if (!ad || !String(ad).trim()) {
            throw ApiError.badRequest("Tanım adı zorunludur.");
        }
        const result = await TabloMaddesiSqlRepository.save({
            id: id ? Number(id) : null,
            tur: Number(tur),
            ad: String(ad).trim(),
            kod: kod ? String(kod).trim() : null,
        }, dbContext);
        return ApiResponse.ok(res, "Tablo maddesi kaydedildi.", result);
    });
    /**
     * DELETE /api/v1/tanimlar/tablo-maddesi/:id
     */
    static deleteTabloMaddesi = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Geçerli bir ID belirtilmelidir.");
        }
        await TabloMaddesiSqlRepository.delete(id, dbContext);
        return ApiResponse.ok(res, "Tablo maddesi silindi.", { id });
    });
    /**
     * GET /api/v1/tanimlar/ulkeler
     */
    static getUlkeler = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const lookups = await CariSqlRepository.getLookups(dbContext);
        return ApiResponse.ok(res, "Ülkeler listelendi.", lookups.ulkeList || []);
    });
    /**
     * GET /api/v1/tanimlar/uyruklar
     * (TODVZ_TABLO_MADDESI or TODVZ_ULKE)
     */
    static getUyruklar = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const lookups = await CariSqlRepository.getLookups(dbContext);
        return ApiResponse.ok(res, "Uyruklar listelendi.", lookups.ulkeList || []);
    });
    /**
     * GET /api/v1/tanimlar/iller
     * TODVZ_TABLO_MADDESI (TUR = 3)
     */
    static getIller = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const lookups = await CariSqlRepository.getLookups(dbContext);
        return ApiResponse.ok(res, "İller listelendi.", lookups.ilList || []);
    });
    /**
     * GET /api/v1/tanimlar/ilceler?ilId=
     * TODVZ_TABLO_MADDESI (TUR = 2) — canlı veritabanında doğrulandı (11.09.2026).
     */
    static getIlceler = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const lookups = await CariSqlRepository.getLookups(dbContext);
        let list = lookups.ilceList || [];
        const ilId = req.query.ilId ? Number(req.query.ilId) : null;
        if (ilId) {
            list = list.filter((x) => x.ustId === ilId || !x.ustId || x.ustId === 0);
        }
        return ApiResponse.ok(res, "İlçeler listelendi.", list);
    });
    /**
     * GET /api/v1/tanimlar/posta-kodlari
     * TODVZ_TABLO_MADDESI (TUR = 4) — canlı veritabanında doğrulandı (11.09.2026);
     * bu TUR şu an bu veritabanında boş (referans satırı girilmemiş).
     */
    static getPostaKodlari = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const lookups = await CariSqlRepository.getLookups(dbContext);
        return ApiResponse.ok(res, "Posta kodları listelendi.", lookups.postaKoduList || []);
    });
    /**
     * GET /api/v1/tanimlar/vergi-daireleri
     * TODVZ_TABLO_MADDESI (TUR = 0)
     */
    static getVergiDaireleri = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const lookups = await CariSqlRepository.getLookups(dbContext);
        return ApiResponse.ok(res, "Vergi daireleri listelendi.", lookups.vergiDairesiList || []);
    });
    /**
     * GET /api/v1/tanimlar/meslekler
     * TODVZ_TABLO_MADDESI (TUR = 9)
     */
    static getMeslekler = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const lookups = await CariSqlRepository.getLookups(dbContext);
        return ApiResponse.ok(res, "Meslekler listelendi.", lookups.meslekList || []);
    });
    /**
     * GET /api/v1/tanimlar/banka-hesaplari
     * Cari kartlar (Banka olanlar veya tüm cari kartlar)
     */
    static getBankaHesaplari = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const cariler = await CariService.listCariKartlar(dbContext);
        return ApiResponse.ok(res, "Banka hesapları listelendi.", cariler || []);
    });
    /**
     * GET /api/v1/tanimlar/hukuki-yapilar
     * TODVZ_TABLO_MADDESI
     */
    static getHukukiYapilar = asyncHandler(async (req, res) => {
        const dbContext = TanimlarController.getDbContext(req);
        const lookups = await CariSqlRepository.getLookups(dbContext);
        return ApiResponse.ok(res, "Hukuki yapılar listelendi.", lookups.hukukiYapiList || []);
    });
}
