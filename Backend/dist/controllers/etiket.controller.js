import { EtiketService } from "../services/etiket.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export class EtiketController {
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
    static getKullaniciId(req) {
        const userObj = req.user;
        return Number(userObj?.userId || userObj?.id) || 1;
    }
    // ─── Altın Ürün ────────────────────────────────────────────────────────────
    static listAltinUrun = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const { search, grupKodu, ureticiFirma, baslangicTarihi, bitisTarihi, yazdirildi, satildi, limit } = req.query;
        const filter = {
            search: search ? String(search) : undefined,
            grupKodu: grupKodu ? String(grupKodu) : undefined,
            ureticiFirma: ureticiFirma ? String(ureticiFirma) : undefined,
            baslangicTarihi: baslangicTarihi ? String(baslangicTarihi) : undefined,
            bitisTarihi: bitisTarihi ? String(bitisTarihi) : undefined,
            yazdirildi: yazdirildi !== undefined ? yazdirildi === "true" || yazdirildi === "1" : undefined,
            satildi: satildi !== undefined ? satildi === "true" || satildi === "1" : undefined,
            limit: limit ? Number(limit) : 500,
        };
        const data = await EtiketService.listAltinUrun(filter, dbContext);
        return ApiResponse.ok(res, "Altın ürünler listelendi.", data);
    });
    static getAltinUrunById = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.getAltinUrunById(Number(req.params.id), dbContext);
        return ApiResponse.ok(res, "Altın ürün getirildi.", data);
    });
    static getAltinUrunByBarkod = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.getAltinUrunByBarkod(String(req.params.barkod), dbContext);
        return ApiResponse.ok(res, "Altın ürün getirildi.", data);
    });
    static saveAltinUrun = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.saveAltinUrun(req.body, EtiketController.getKullaniciId(req), dbContext);
        return ApiResponse.ok(res, "Altın ürün başarıyla kaydedildi.", data);
    });
    static deleteAltinUrun = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        await EtiketService.removeAltinUrun(Number(req.params.id), dbContext);
        return ApiResponse.ok(res, "Altın ürün silindi.");
    });
    static markAltinUrunYazdirildi = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const { ids, yazdirildi } = req.body;
        const idList = Array.isArray(ids) ? ids.map((x) => Number(x)) : [];
        await EtiketService.markAltinUrunYazdirildi(idList, Boolean(yazdirildi), EtiketController.getKullaniciId(req), dbContext);
        return ApiResponse.ok(res, "Yazdırıldı durumu güncellendi.");
    });
    static getNextAltinUrunNo = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const { grupKodu, uzunluk } = req.query;
        const data = await EtiketService.getNextAltinUrunNo(String(grupKodu || ""), uzunluk ? Number(uzunluk) : 5, dbContext);
        return ApiResponse.ok(res, "Sıradaki ürün numarası üretildi.", data);
    });
    // ─── Özel Ürün ─────────────────────────────────────────────────────────────
    static listOzelUrun = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const { search, grupKodu, ureticiFirma, baslangicTarihi, bitisTarihi, yazdirildi, satildi, limit } = req.query;
        const filter = {
            search: search ? String(search) : undefined,
            grupKodu: grupKodu ? String(grupKodu) : undefined,
            ureticiFirma: ureticiFirma ? String(ureticiFirma) : undefined,
            baslangicTarihi: baslangicTarihi ? String(baslangicTarihi) : undefined,
            bitisTarihi: bitisTarihi ? String(bitisTarihi) : undefined,
            yazdirildi: yazdirildi !== undefined ? yazdirildi === "true" || yazdirildi === "1" : undefined,
            satildi: satildi !== undefined ? satildi === "true" || satildi === "1" : undefined,
            limit: limit ? Number(limit) : 500,
        };
        const data = await EtiketService.listOzelUrun(filter, dbContext);
        return ApiResponse.ok(res, "Özel ürünler listelendi.", data);
    });
    static getOzelUrunById = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.getOzelUrunById(Number(req.params.id), dbContext);
        return ApiResponse.ok(res, "Özel ürün getirildi.", data);
    });
    static getOzelUrunByBarkod = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.getOzelUrunByBarkod(String(req.params.barkod), dbContext);
        return ApiResponse.ok(res, "Özel ürün getirildi.", data);
    });
    static saveOzelUrun = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.saveOzelUrun(req.body, EtiketController.getKullaniciId(req), dbContext);
        return ApiResponse.ok(res, "Özel ürün başarıyla kaydedildi.", data);
    });
    static deleteOzelUrun = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        await EtiketService.removeOzelUrun(Number(req.params.id), dbContext);
        return ApiResponse.ok(res, "Özel ürün silindi.");
    });
    static markOzelUrunYazdirildi = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const { ids, yazdirildi } = req.body;
        const idList = Array.isArray(ids) ? ids.map((x) => Number(x)) : [];
        await EtiketService.markOzelUrunYazdirildi(idList, Boolean(yazdirildi), EtiketController.getKullaniciId(req), dbContext);
        return ApiResponse.ok(res, "Yazdırıldı durumu güncellendi.");
    });
    static getNextOzelUrunNo = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const { grupKodu, uzunluk } = req.query;
        const data = await EtiketService.getNextOzelUrunNo(String(grupKodu || ""), uzunluk ? Number(uzunluk) : 5, dbContext);
        return ApiResponse.ok(res, "Sıradaki özel ürün numarası üretildi.", data);
    });
    // ─── Ortak Lookup'lar ──────────────────────────────────────────────────────
    static getGrupKodlari = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.getGrupKodlari(dbContext);
        return ApiResponse.ok(res, "Grup kodları listelendi.", data);
    });
    static getUreticiFirmalar = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.getUreticiFirmalar(dbContext);
        return ApiResponse.ok(res, "Üretici firmalar listelendi.", data);
    });
    // ─── Etiket Şablonları ─────────────────────────────────────────────────────
    static listSablon = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const { etiketTipi } = req.query;
        const data = await EtiketService.listSablon({ etiketTipi: etiketTipi !== undefined && etiketTipi !== "" ? Number(etiketTipi) : undefined }, dbContext);
        return ApiResponse.ok(res, "Etiket şablonları listelendi.", data);
    });
    static getSablonById = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.getSablonById(Number(req.params.id), dbContext);
        return ApiResponse.ok(res, "Etiket şablonu getirildi.", data);
    });
    static saveSablon = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        const data = await EtiketService.saveSablon(req.body, EtiketController.getKullaniciId(req), dbContext);
        return ApiResponse.ok(res, "Etiket şablonu başarıyla kaydedildi.", data);
    });
    static deleteSablon = asyncHandler(async (req, res) => {
        const dbContext = EtiketController.getDbContext(req);
        await EtiketService.removeSablon(Number(req.params.id), dbContext);
        return ApiResponse.ok(res, "Etiket şablonu silindi.");
    });
}
