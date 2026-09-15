import { KasaService } from "../services/kasa.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export class KasaController {
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
    // ─── Hesap Kartları ────────────────────────────────────────────────────────
    static listHesaplar = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const { search, aktif } = req.query;
        const filter = {
            search: search ? String(search) : undefined,
            aktif: aktif !== undefined ? aktif === "true" || aktif === "1" : undefined,
        };
        const data = await KasaService.listHesaplar(filter, dbContext);
        return ApiResponse.ok(res, "Hesap kartları listelendi.", data);
    });
    static getHesapById = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const hesapId = Number(req.params.id);
        const data = await KasaService.getHesapById(hesapId, dbContext);
        return ApiResponse.ok(res, "Hesap kartı getirildi.", data);
    });
    static saveHesap = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const data = await KasaService.saveHesap(req.body, dbContext);
        return ApiResponse.ok(res, "Hesap kartı başarıyla kaydedildi.", data);
    });
    static deleteHesap = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const hesapId = Number(req.params.id);
        await KasaService.deleteHesap(hesapId, dbContext);
        return ApiResponse.ok(res, "Hesap kartı silindi.");
    });
    // ─── Hesap Hareketleri ─────────────────────────────────────────────────────
    static listHareketler = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const { hesapId, vezneId, search, limit } = req.query;
        const filter = {
            hesapId: hesapId ? Number(hesapId) : undefined,
            vezneId: vezneId ? Number(vezneId) : undefined,
            search: search ? String(search) : undefined,
            limit: limit ? Number(limit) : 200,
        };
        const data = await KasaService.listHareketler(filter, dbContext);
        return ApiResponse.ok(res, "Hesap hareketleri listelendi.", data);
    });
    static getHareketById = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const id = Number(req.params.id);
        const data = await KasaService.getHareketById(id, dbContext);
        return ApiResponse.ok(res, "Hesap hareketi getirildi.", data);
    });
    static saveHareket = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const userObj = req.user;
        const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
        const data = await KasaService.saveHareket(req.body, kullaniciId, dbContext);
        return ApiResponse.ok(res, "Hesap hareketi başarıyla kaydedildi.", data);
    });
    static deleteHareket = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const id = Number(req.params.id);
        const userObj = req.user;
        const kullaniciId = Number(userObj?.userId || userObj?.id) || 1;
        const degisiklikTakipVar = Boolean(req.body?.degisiklikTakipVar);
        await KasaService.deleteHareket(id, kullaniciId, degisiklikTakipVar, dbContext);
        return ApiResponse.ok(res, "Hesap hareketi silindi.");
    });
    // ─── Lookups ───────────────────────────────────────────────────────────────
    static getLookups = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const data = await KasaService.getLookups(dbContext);
        return ApiResponse.ok(res, "Kasa lookups listelendi.", data);
    });
    static getUserVezne = asyncHandler(async (req, res) => {
        const dbContext = KasaController.getDbContext(req);
        const userObj = req.user;
        const kullaniciId = Number(req.query.kullaniciId) || Number(userObj?.userId || userObj?.id) || 1;
        const vezneId = await KasaService.getUserVezneId(kullaniciId, dbContext);
        return ApiResponse.ok(res, "Kullanıcı veznesi getirildi.", { vezneId });
    });
}
