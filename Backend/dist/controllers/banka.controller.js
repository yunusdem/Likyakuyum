import { BankaService } from "../services/banka.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export class BankaController {
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
    // ─── Banka Hesap Kartları ──────────────────────────────────────────────────
    static listBankalar = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const { search, aktif } = req.query;
        const filter = {
            search: search ? String(search) : undefined,
            aktif: aktif !== undefined ? aktif === "true" || aktif === "1" : undefined,
        };
        const data = await BankaService.listBankalar(filter, dbContext);
        return ApiResponse.ok(res, "Banka hesapları listelendi.", data);
    });
    static getBankaById = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const bankaId = Number(req.params.id);
        const data = await BankaService.getBankaById(bankaId, dbContext);
        return ApiResponse.ok(res, "Banka hesabı getirildi.", data);
    });
    static getNextHesapNo = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const nextNo = await BankaService.getNextHesapNo(dbContext);
        return ApiResponse.ok(res, "Sonraki hesap no üretildi.", { nextNo });
    });
    static saveBanka = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const userObj = req.user;
        const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
        const data = await BankaService.saveBanka(req.body, kullaniciId, dbContext);
        return ApiResponse.ok(res, "Banka hesabı başarıyla kaydedildi.", data);
    });
    static deleteBanka = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const bankaId = Number(req.params.id);
        const userObj = req.user;
        const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
        await BankaService.deleteBanka(bankaId, kullaniciId, dbContext);
        return ApiResponse.ok(res, "Banka hesabı silindi.");
    });
    // ─── Banka Hesap Hareketleri ───────────────────────────────────────────────
    static listHareketler = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const { bankaId, cariKartId, vezneId, islemTipi, baslangicTarihi, bitisTarihi, search, limit } = req.query;
        const filter = {
            bankaId: bankaId ? Number(bankaId) : undefined,
            cariKartId: cariKartId ? Number(cariKartId) : undefined,
            vezneId: vezneId ? Number(vezneId) : undefined,
            islemTipi: islemTipi !== undefined && islemTipi !== "" ? Number(islemTipi) : undefined,
            baslangicTarihi: baslangicTarihi ? String(baslangicTarihi) : undefined,
            bitisTarihi: bitisTarihi ? String(bitisTarihi) : undefined,
            search: search ? String(search) : undefined,
            limit: limit ? Number(limit) : 200,
        };
        const data = await BankaService.listHareketler(filter, dbContext);
        return ApiResponse.ok(res, "Banka hareketleri listelendi.", data);
    });
    static getHareketById = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const id = Number(req.params.id);
        const data = await BankaService.getHareketById(id, dbContext);
        return ApiResponse.ok(res, "Banka hareketi getirildi.", data);
    });
    static saveHareket = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const userObj = req.user;
        const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
        const data = await BankaService.saveHareket(req.body, kullaniciId, dbContext);
        return ApiResponse.ok(res, "Banka hareketi başarıyla kaydedildi.", data);
    });
    static deleteHareket = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const id = Number(req.params.id);
        const userObj = req.user;
        const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
        await BankaService.deleteHareket(id, kullaniciId, dbContext);
        return ApiResponse.ok(res, "Banka hareketi silindi.");
    });
    static toggleIptalHareket = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const id = Number(req.params.id);
        const { iptal } = req.body;
        const userObj = req.user;
        const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
        await BankaService.toggleIptalHareket(id, Boolean(iptal), kullaniciId, dbContext);
        return ApiResponse.ok(res, `Banka hareketi ${iptal ? "iptal edildi" : "aktif hale getirildi"}.`);
    });
    // ─── Lookups ───────────────────────────────────────────────────────────────
    static getLookups = asyncHandler(async (req, res) => {
        const dbContext = BankaController.getDbContext(req);
        const data = await BankaService.getLookups(dbContext);
        return ApiResponse.ok(res, "Banka lookups listelendi.", data);
    });
}
