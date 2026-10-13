import { CompanySqlRepository } from "../models/companySql.repository.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import fs from "node:fs";
import path from "node:path";
import { altKlasorAdiDenetle, firmaDosyasi, firmaKlasoruOnbellekTemizle, firmaKoku, klasorListele } from "../services/firmaKlasoru.js";
export class CompanyController {
    /**
     * GET /api/v1/company/definitions
     */
    static getDefinitions = asyncHandler(async (req, res) => {
        const dbContext = {
            dbServer: req.user?.dbServer || req.query.dbServer,
            dbName: req.user?.dbName || req.query.dbName,
        };
        const definitions = await CompanySqlRepository.getDefinitions(dbContext);
        return ApiResponse.ok(res, "Firma tanımları başarıyla getirildi.", definitions);
    });
    /**
     * PUT /api/v1/company/definitions
     */
    static updateDefinitions = asyncHandler(async (req, res) => {
        const dbContext = {
            dbServer: req.user?.dbServer || req.body.dbServer,
            dbName: req.user?.dbName || req.body.dbName,
        };
        // Belge Dizini yalnızca firma klasörünün altında bir klasör adıdır (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K7).
        // Kayıtlı eski değer (mutlak yol) değiştirilmeden kaydedilirse diğer alanların kaydı engellenmez.
        if (req.body && "BELGE_DIZINI" in req.body && altKlasorAdiDenetle(req.body.BELGE_DIZINI).gecersiz) {
            const mevcut = await CompanySqlRepository.getDefinitions(dbContext).catch(() => null);
            const eski = String(mevcut?.BELGE_DIZINI ?? "").trim();
            if (String(req.body.BELGE_DIZINI ?? "").trim() !== eski) {
                throw ApiError.badRequest("Belge Dizini yalnızca klasör adı olabilir (örn. Merkez). Sürücü, \\ / : ve .. kullanılamaz; boş bırakılabilir.");
            }
        }
        const updated = await CompanySqlRepository.updateDefinitions(req.body, dbContext);
        firmaKlasoruOnbellekTemizle(dbContext.dbName);
        return ApiResponse.ok(res, "Firma tanımları başarıyla güncellendi.", updated);
    });
    /**
     * GET /api/v1/company/klasor — firmanın dosya klasörü (salt okunur bilgi)
     */
    static getKlasor = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        const bilgi = await firmaKoku(dbContext);
        return ApiResponse.ok(res, "Firma klasörü.", bilgi);
    });
    /**
     * GET /api/v1/company/klasor/liste?yol=Belgeler/2026 — firma klasöründeki bir klasörün içeriği
     */
    static klasorListe = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        return ApiResponse.ok(res, "Klasör içeriği.", await klasorListele(dbContext, String(req.query.yol ?? "")));
    });
    /**
     * GET /api/v1/company/klasor/indir?yol=Belgeler/2026/10/X.pdf — yalnızca kendi firmasının klasöründen (K12)
     */
    static klasorIndir = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        const yol = await firmaDosyasi(dbContext, String(req.query.yol ?? ""));
        const ad = path.basename(yol);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${ad.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(ad)}`);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        const akis = fs.createReadStream(yol);
        akis.on("error", () => res.destroy());
        akis.pipe(res);
    });
}
