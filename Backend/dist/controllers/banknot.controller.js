import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { BanknotSqlRepository } from "../models/banknotSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class BanknotController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body?.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body?.dbName,
        };
    }
    /**
     * GET /api/v1/banknot/currencies
     */
    static getCurrencies = asyncHandler(async (req, res) => {
        const dbContext = BanknotController.getDbContext(req);
        const currencies = await BanknotSqlRepository.getCurrencies(dbContext);
        return ApiResponse.ok(res, "Para birimleri ve banknot sayıları getirildi.", currencies);
    });
    /**
     * POST /api/v1/banknot/create-currency
     */
    static createCurrency = asyncHandler(async (req, res) => {
        const dbContext = BanknotController.getDbContext(req);
        const { kod, ad } = req.body;
        if (!kod || !ad) {
            throw ApiError.badRequest("Para kodu (kod) ve para adı (ad) zorunludur.");
        }
        const created = await BanknotSqlRepository.createCurrency(kod, ad, dbContext);
        return ApiResponse.created(res, "Para birimi başarıyla oluşturuldu.", created);
    });
    /**
     * GET /api/v1/banknot/:paraId
     */
    static getBanknotlarByParaId = asyncHandler(async (req, res) => {
        const dbContext = BanknotController.getDbContext(req);
        const paraId = Number(req.params.paraId);
        if (!paraId || isNaN(paraId)) {
            throw ApiError.badRequest("Geçerli bir Para ID parametresi girilmelidir.");
        }
        const banknotlar = await BanknotSqlRepository.getBanknotlarByParaId(paraId, dbContext);
        return ApiResponse.ok(res, "Banknot tanımları listelendi.", banknotlar);
    });
    /**
     * POST /api/v1/banknot/:paraId
     */
    static saveBanknotlar = asyncHandler(async (req, res) => {
        const dbContext = BanknotController.getDbContext(req);
        const paraId = Number(req.params.paraId);
        if (!paraId || isNaN(paraId)) {
            throw ApiError.badRequest("Geçerli bir Para ID parametresi girilmelidir.");
        }
        const banknotlar = req.body.banknotlar || req.body;
        if (!Array.isArray(banknotlar)) {
            throw ApiError.badRequest("Banknot listesi dizi (array) formatında olmalıdır.");
        }
        const saved = await BanknotSqlRepository.saveBanknotlar(paraId, banknotlar, dbContext);
        return ApiResponse.ok(res, "Banknot tanımları başarıyla kaydedildi.", saved);
    });
    /**
     * DELETE /api/v1/banknot/:paraId
     */
    static deleteBanknotlar = asyncHandler(async (req, res) => {
        const dbContext = BanknotController.getDbContext(req);
        const paraId = Number(req.params.paraId);
        if (!paraId || isNaN(paraId)) {
            throw ApiError.badRequest("Geçerli bir Para ID parametresi girilmelidir.");
        }
        await BanknotSqlRepository.deleteBanknotlar(paraId, dbContext);
        return ApiResponse.ok(res, "Banknot tanımları temizlendi.", { paraId });
    });
    /**
     * GET /api/v1/banknot/currency-usage/:paraId
     * Checks where this currency is used (pano, vezne, bakiye, fiş)
     */
    static getCurrencyUsage = asyncHandler(async (req, res) => {
        const dbContext = BanknotController.getDbContext(req);
        const paraId = Number(req.params.paraId);
        if (!paraId || isNaN(paraId)) {
            throw ApiError.badRequest("Geçerli bir Para ID parametresi girilmelidir.");
        }
        const usage = await BanknotSqlRepository.getCurrencyUsage(paraId, dbContext);
        return ApiResponse.ok(res, "Para birimi kullanım durumu getirildi.", usage);
    });
    /**
     * DELETE /api/v1/banknot/currency/:paraId
     * Deletes the currency completely from TODVZ_PARA along with its banknotes
     */
    static deleteCurrency = asyncHandler(async (req, res) => {
        const dbContext = BanknotController.getDbContext(req);
        const paraId = Number(req.params.paraId);
        if (!paraId || isNaN(paraId)) {
            throw ApiError.badRequest("Geçerli bir Para ID parametresi girilmelidir.");
        }
        const isForce = req.query.force === "true" || req.body?.force === true;
        await BanknotSqlRepository.deleteCurrency(paraId, { force: isForce }, dbContext);
        return ApiResponse.ok(res, "Para birimi ve banknotları veritabanından başarıyla silindi.", { paraId });
    });
}
