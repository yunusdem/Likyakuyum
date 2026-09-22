import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { IskontoSqlRepository } from "../models/iskontoSql.repository.js";
export class IskontoController {
    static getDbContext(req) {
        return {
            dbServer: req.headers["x-db-server"] ||
                req.user?.dbServer ||
                req.query.dbServer ||
                req.body?.dbServer,
            dbName: req.headers["x-db-name"] ||
                req.user?.dbName ||
                req.query.dbName ||
                req.body?.dbName,
        };
    }
    /**
     * GET /api/v1/iskonto
     */
    static listIskontolar = asyncHandler(async (req, res) => {
        const dbContext = IskontoController.getDbContext(req);
        const search = req.query.search;
        const aktifQuery = req.query.aktif;
        let aktif = undefined;
        if (aktifQuery === "true" || aktifQuery === "1")
            aktif = true;
        else if (aktifQuery === "false" || aktifQuery === "0")
            aktif = false;
        const list = await IskontoSqlRepository.listIskontolar({ search, aktif }, dbContext);
        return ApiResponse.ok(res, "İskonto tanımları listelendi.", list);
    });
    /**
     * GET /api/v1/iskonto/:id
     */
    static getIskontoById = asyncHandler(async (req, res) => {
        const dbContext = IskontoController.getDbContext(req);
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Geçersiz iskonto ID.");
        }
        const item = await IskontoSqlRepository.getIskontoById(id, dbContext);
        if (!item) {
            throw ApiError.notFound("İskonto tanımı bulunamadı.");
        }
        return ApiResponse.ok(res, "İskonto tanımı getirildi.", item);
    });
    /**
     * POST /api/v1/iskonto
     */
    static saveIskonto = asyncHandler(async (req, res) => {
        const dbContext = IskontoController.getDbContext(req);
        const { iskontoId, tanim, kod, iskontoTipi, oran, tutar, hasTutar, minTutar, maxIskontoTutari, aktif, aciklama, } = req.body;
        if (!tanim || !String(tanim).trim()) {
            throw ApiError.badRequest("İskonto tanımı boş bırakılamaz.");
        }
        const saved = await IskontoSqlRepository.saveIskonto({
            iskontoId: iskontoId ? Number(iskontoId) : null,
            tanim: String(tanim).trim(),
            kod: kod ? String(kod).trim() : null,
            iskontoTipi: iskontoTipi !== undefined && iskontoTipi !== null ? Number(iskontoTipi) : null,
            oran: oran !== undefined && oran !== null && oran !== "" ? Number(oran) : null,
            tutar: tutar !== undefined && tutar !== null && tutar !== "" ? Number(tutar) : null,
            hasTutar: hasTutar !== undefined && hasTutar !== null && hasTutar !== "" ? Number(hasTutar) : null,
            minTutar: minTutar !== undefined && minTutar !== null && minTutar !== "" ? Number(minTutar) : null,
            maxIskontoTutari: maxIskontoTutari !== undefined && maxIskontoTutari !== null && maxIskontoTutari !== "" ? Number(maxIskontoTutari) : null,
            aktif: aktif !== undefined ? Boolean(aktif) : true,
            aciklama: aciklama ? String(aciklama).trim() : null,
        }, dbContext);
        return ApiResponse.ok(res, "İskonto tanımı başarıyla kaydedildi.", saved);
    });
    /**
     * DELETE /api/v1/iskonto/:id
     */
    static deleteIskonto = asyncHandler(async (req, res) => {
        const dbContext = IskontoController.getDbContext(req);
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Geçersiz iskonto ID.");
        }
        const kaliciSil = req.query.kalici !== "false" && req.query.kalici !== "0";
        await IskontoSqlRepository.deleteIskonto(id, kaliciSil, dbContext);
        return ApiResponse.ok(res, "İskonto tanımı başarıyla silindi.");
    });
}
