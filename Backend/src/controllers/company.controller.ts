import { Request, Response } from "express";
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
  public static getAlanlar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.headers["x-db-server"] as string) || "localhost",
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.headers["x-db-name"] as string) || "R2016_dvz",
    };
    const currentDb = (dbContext.dbName || "").trim().toLowerCase();
    const currentFirmaId = req.user?.firmaId || (req.query.firmaId ? Number(req.query.firmaId) : undefined);

    const alanListesi: Array<{
      id: string | number;
      kod: string;
      unvan: string;
      dbName: string;
      aciklama?: string;
    }> = [];

    const eklenenDbSet = new Set<string>();

    // 1. Try to fetch from ADM_FIRMA (merkez veritabanı)
    try {
      if (adminYapilandirildiMi()) {
        const adminPool = await getAdminPool();
        let musteriNo: string | null = null;
        let matchedFirma: { firmaId: number; firmaKodu: string; unvan: string; dbName: string; musteriNo: string | null } | null = null;

        if (currentFirmaId) {
          const curRes = await adminPool
            .request()
            .input("fid", sql.Int, currentFirmaId)
            .query("SELECT FIRMA_ID, FIRMA_KODU, UNVAN, DB_NAME, MUSTERI_NO FROM dbo.ADM_FIRMA WHERE FIRMA_ID = @fid");
          if (curRes.recordset.length > 0) {
            matchedFirma = {
              firmaId: curRes.recordset[0].FIRMA_ID,
              firmaKodu: curRes.recordset[0].FIRMA_KODU,
              unvan: curRes.recordset[0].UNVAN,
              dbName: curRes.recordset[0].DB_NAME,
              musteriNo: curRes.recordset[0].MUSTERI_NO || null,
            };
            musteriNo = matchedFirma.musteriNo;
          }
        }

        if (!musteriNo && currentDb) {
          const curDbRes = await adminPool
            .request()
            .input("dbname", sql.NVarChar(128), currentDb)
            .query("SELECT FIRMA_ID, FIRMA_KODU, UNVAN, DB_NAME, MUSTERI_NO FROM dbo.ADM_FIRMA WHERE LOWER(DB_NAME) = LOWER(@dbname)");
          if (curDbRes.recordset.length > 0) {
            matchedFirma = {
              firmaId: curDbRes.recordset[0].FIRMA_ID,
              firmaKodu: curDbRes.recordset[0].FIRMA_KODU,
              unvan: curDbRes.recordset[0].UNVAN,
              dbName: curDbRes.recordset[0].DB_NAME,
              musteriNo: curDbRes.recordset[0].MUSTERI_NO || null,
            };
            musteriNo = matchedFirma.musteriNo;
          }
        }

        if (!musteriNo && req.query.musteriNo) {
          musteriNo = String(req.query.musteriNo).trim().toUpperCase();
        }

        // SADECE ve SADECE bu müşteriye ait olan veritabanları listelenir
        if (musteriNo) {
          const admRes = await adminPool
            .request()
            .input("mno", sql.VarChar(50), musteriNo)
            .query(
              "SELECT FIRMA_ID, FIRMA_KODU, UNVAN, DB_NAME, MUSTERI_NO FROM dbo.ADM_FIRMA WHERE MUSTERI_NO = @mno AND DURUM IN ('AKTIF', 'DONDURULMUS') AND BAGLANTI_MODU <> 'setup' ORDER BY UNVAN, DB_NAME"
            );

          for (const row of admRes.recordset) {
            const dbLower = (row.DB_NAME || "").trim().toLowerCase();
            if (dbLower && !eklenenDbSet.has(dbLower)) {
              eklenenDbSet.add(dbLower);
              alanListesi.push({
                id: row.FIRMA_ID,
                kod: (row.FIRMA_KODU || row.DB_NAME || "").trim(),
                unvan: (row.UNVAN || row.DB_NAME || "").trim(),
                dbName: (row.DB_NAME || "").trim(),
                aciklama: dbLower === currentDb ? "Mevcut Alan" : "Çalışma Alanı / Şube",
              });
            }
          }
        } else if (matchedFirma) {
          // Müşteri no bağlı değilse ama firma ADM_FIRMA'da varsa sadece o firmanın kendi veritabanını ekle
          const dbLower = (matchedFirma.dbName || "").trim().toLowerCase();
          if (dbLower && !eklenenDbSet.has(dbLower)) {
            eklenenDbSet.add(dbLower);
            alanListesi.push({
              id: matchedFirma.firmaId,
              kod: (matchedFirma.firmaKodu || matchedFirma.dbName || "").trim(),
              unvan: (matchedFirma.unvan || matchedFirma.dbName || "").trim(),
              dbName: (matchedFirma.dbName || "").trim(),
              aciklama: "Mevcut Alan",
            });
          }
        }
      }
    } catch (admErr: any) {
      // Ignored if ADM_FIRMA is unavailable
    }

    // 2. ADM_FIRMA'dan sonuç çıkmadıysa (bağımsız tekil kurulum) sadece mevcut aktif veritabanını ekle.
    // ASLA tüm SQL Server veritabanlarını (sys.databases) dökme!
    if (alanListesi.length === 0 && dbContext.dbName) {
      const dbRaw = dbContext.dbName.trim();
      let unvan = dbRaw;
      try {
        const pool = await getDbPool(dbContext.dbServer, dbContext.dbName);
        const checkTanim = await pool.request().query(
          "SELECT TOP 1 FIRMA_ADI, SUBE_ADI FROM dbo.TODVZ_TANIM"
        );
        if (checkTanim.recordset && checkTanim.recordset.length > 0) {
          const fAdi = (checkTanim.recordset[0].FIRMA_ADI || "").trim();
          const sAdi = (checkTanim.recordset[0].SUBE_ADI || "").trim();
          unvan = [fAdi, sAdi].filter(Boolean).join(" - ") || dbRaw;
        }
      } catch {
        // Ignored
      }

      alanListesi.push({
        id: dbRaw,
        kod: dbRaw,
        unvan: unvan,
        dbName: dbRaw,
        aciklama: "Mevcut Veritabanı",
      });
    }

    return ApiResponse.ok(res, "Alanlar başarıyla listelendi.", alanListesi);
  });

  /**
   * GET /api/v1/company/definitions
   */
  public static getDefinitions = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = {
      dbServer: req.user?.dbServer || (req.query.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string),
    };

    const definitions = await CompanySqlRepository.getDefinitions(dbContext);

    return ApiResponse.ok(res, "Firma tanımları başarıyla getirildi.", definitions);
  });

  /**
   * PUT /api/v1/company/definitions
   */
  public static updateDefinitions = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = {
      dbServer: req.user?.dbServer || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.body.dbName as string),
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
  public static getKlasor = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    const bilgi = await firmaKoku(dbContext);
    return ApiResponse.ok(res, "Firma klasörü.", bilgi);
  });

  /**
   * GET /api/v1/company/klasor/liste?yol=Belgeler/2026 — firma klasöründeki bir klasörün içeriği
   */
  public static klasorListe = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    return ApiResponse.ok(res, "Klasör içeriği.", await klasorListele(dbContext, String(req.query.yol ?? "")));
  });

  /**
   * GET /api/v1/company/klasor/indir?yol=Belgeler/2026/10/X.pdf — yalnızca kendi firmasının klasöründen (K12)
   */
  public static klasorIndir = asyncHandler(async (req: Request, res: Response) => {
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
