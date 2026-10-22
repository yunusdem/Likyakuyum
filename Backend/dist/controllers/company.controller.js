import { CompanySqlRepository } from "../models/companySql.repository.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import fs from "node:fs";
import path from "node:path";
import { altKlasorAdiDenetle, firmaDosyasi, firmaKlasoruOnbellekTemizle, firmaKoku, klasorListele } from "../services/firmaKlasoru.js";
import { getDbPool } from "../config/mssql.config.js";
import { getAdminPool, adminYapilandirildiMi } from "../config/adminDb.config.js";
import sql from "mssql";
export class CompanyController {
    /**
     * GET /api/v1/company/alanlar
     * Returns list of areas/databases for the active company/customer
     */
    static getAlanlar = asyncHandler(async (req, res) => {
        const dbContext = {
            dbServer: req.user?.dbServer || req.query.dbServer,
            dbName: req.user?.dbName || req.query.dbName,
        };
        const currentDb = (dbContext.dbName || "").trim().toLowerCase();
        const currentFirmaId = req.user?.firmaId;
        const alanListesi = [];
        const eklenenDbSet = new Set();
        // 1. Try to fetch from ADM_FIRMA (merkez veritabanı)
        try {
            if (adminYapilandirildiMi()) {
                const adminPool = await getAdminPool();
                let musteriNo = null;
                if (currentFirmaId) {
                    const curRes = await adminPool
                        .request()
                        .input("fid", sql.Int, currentFirmaId)
                        .query("SELECT MUSTERI_NO FROM dbo.ADM_FIRMA WHERE FIRMA_ID = @fid");
                    musteriNo = curRes.recordset[0]?.MUSTERI_NO || null;
                }
                if (!musteriNo && req.query.musteriNo) {
                    musteriNo = String(req.query.musteriNo).trim().toUpperCase();
                }
                let q = "SELECT FIRMA_ID, FIRMA_KODU, UNVAN, DB_NAME, MUSTERI_NO FROM dbo.ADM_FIRMA WHERE DURUM = 'AKTIF'";
                const reqAdm = adminPool.request();
                if (musteriNo) {
                    q += " AND MUSTERI_NO = @mno";
                    reqAdm.input("mno", sql.VarChar(50), musteriNo);
                }
                const admRes = await reqAdm.query(q);
                for (const row of admRes.recordset) {
                    const dbLower = (row.DB_NAME || "").trim().toLowerCase();
                    if (dbLower) {
                        eklenenDbSet.add(dbLower);
                        alanListesi.push({
                            id: row.FIRMA_ID,
                            kod: (row.FIRMA_KODU || "").trim(),
                            unvan: (row.UNVAN || row.DB_NAME || "").trim(),
                            dbName: (row.DB_NAME || "").trim(),
                            aciklama: dbLower === currentDb ? "Mevcut Alan" : "Çalışma Alanı / Şube",
                        });
                    }
                }
            }
        }
        catch (admErr) {
            // Ignored if ADM_FIRMA is unavailable
        }
        // 2. Query sys.databases on current server instance ONLY if no areas found via ADM_FIRMA (e.g. standalone setup)
        if (alanListesi.length === 0) {
            try {
                const pool = await getDbPool(dbContext.dbServer, dbContext.dbName);
                const sysRes = await pool.request().query("SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE' AND name NOT IN ('master', 'tempdb', 'model', 'msdb', 'LIKYA_ADMIN')");
                for (const r of sysRes.recordset) {
                    const dbName = (r.name || "").trim();
                    const dbLower = dbName.toLowerCase();
                    if (!eklenenDbSet.has(dbLower)) {
                        eklenenDbSet.add(dbLower);
                        let unvan = dbName;
                        try {
                            const checkTanim = await pool.request().query(`SELECT TOP 1 FIRMA_ADI, SUBE_ADI FROM [${dbName}].[dbo].[TODVZ_TANIM]`);
                            if (checkTanim.recordset && checkTanim.recordset.length > 0) {
                                const fAdi = (checkTanim.recordset[0].FIRMA_ADI || "").trim();
                                const sAdi = (checkTanim.recordset[0].SUBE_ADI || "").trim();
                                unvan = [fAdi, sAdi].filter(Boolean).join(" - ") || dbName;
                            }
                        }
                        catch {
                            // Ignored
                        }
                        alanListesi.push({
                            id: dbName,
                            kod: dbName,
                            unvan: unvan,
                            dbName: dbName,
                            aciklama: dbLower === currentDb ? "Mevcut Veritabanı" : "Veritabanı",
                        });
                    }
                }
            }
            catch (sysErr) {
                // Ignored
            }
        }
        return ApiResponse.ok(res, "Alanlar başarıyla listelendi.", alanListesi);
    });
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
