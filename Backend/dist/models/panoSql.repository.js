import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
/**
 * Converts Delphi BGR integer color to CSS Hex color string (#RRGGBB)
 */
export function delphiColorToHex(colorVal) {
    if (colorVal === undefined || colorVal === null || colorVal === "")
        return "#000000";
    const str = String(colorVal).trim();
    if (str.startsWith("#"))
        return str;
    const num = parseInt(str, 10);
    if (isNaN(num) || num < 0)
        return "#000000";
    const r = num & 0xff;
    const g = (num >> 8) & 0xff;
    const b = (num >> 16) & 0xff;
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
/**
 * Converts CSS Hex color string (#RRGGBB) to Delphi BGR integer color
 */
export function hexToDelphiColor(hex) {
    if (!hex || !hex.startsWith("#"))
        return 0;
    const clean = hex.replace("#", "").trim();
    if (clean.length !== 6)
        return 0;
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return r + (g << 8) + (b << 16);
}
export class PanoSqlRepository {
    /**
     * Ensure TODVZ_PANO, TODVZ_PANO_SATIRI tables and procedures SODVZ_PANO_TANIMI_KAYDET & SODVZ_PANO_TANIMI_SIL exist.
     * Dynamically alters existing tables if columns like SIRA_NO, GORUNUR, CARPAN are missing.
     */
    static async ensureTablesAndProceduresExist(pool) {
        const script = `
      -- 1. Ensure TODVZ_PANO table and columns exist
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_PANO')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_PANO] (
          [PANO_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [PANO_NO] VARCHAR(50) NULL,
          [YENILEME_ARALIGI] INT NULL DEFAULT 5,
          [FIRMA_ADI] VARCHAR(250) NULL,
          [PARA_BASLIGI] VARCHAR(250) NULL,
          [ALIS_KURU_BASLIGI] VARCHAR(250) NULL,
          [SATIS_KURU_BASLIGI] VARCHAR(250) NULL,
          [FIRMA_ADI_OZELLIKLERI] VARCHAR(250) NULL,
          [TARIH_SAAT_OZELLIKLERI] VARCHAR(250) NULL,
          [BASLIK_OZELLIKLERI] VARCHAR(250) NULL,
          [SATIR_OZELLIKLERI] VARCHAR(250) NULL,
          [ZEMIN_RENGI] INT NULL DEFAULT 0,
          [BOSLUK_SAYISI] INT NULL DEFAULT 0,
          [HTML_DOSYA_ADI] VARCHAR(250) NULL DEFAULT 'Pano_Dikey.html',
          [KOD_ALANI_GENISLIGI] INT NULL DEFAULT 60,
          [KUR_ALANI_GENISLIGI] INT NULL DEFAULT 40
        );
      END
      ELSE
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'PANO_NO')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [PANO_NO] VARCHAR(50) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'YENILEME_ARALIGI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [YENILEME_ARALIGI] INT NULL DEFAULT 5;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'FIRMA_ADI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [FIRMA_ADI] VARCHAR(250) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'PARA_BASLIGI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [PARA_BASLIGI] VARCHAR(250) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'ALIS_KURU_BASLIGI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [ALIS_KURU_BASLIGI] VARCHAR(250) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'SATIS_KURU_BASLIGI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [SATIS_KURU_BASLIGI] VARCHAR(250) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'FIRMA_ADI_OZELLIKLERI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [FIRMA_ADI_OZELLIKLERI] VARCHAR(250) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'TARIH_SAAT_OZELLIKLERI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [TARIH_SAAT_OZELLIKLERI] VARCHAR(250) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'BASLIK_OZELLIKLERI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [BASLIK_OZELLIKLERI] VARCHAR(250) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'SATIR_OZELLIKLERI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [SATIR_OZELLIKLERI] VARCHAR(250) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'ZEMIN_RENGI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [ZEMIN_RENGI] INT NULL DEFAULT 0;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'BOSLUK_SAYISI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [BOSLUK_SAYISI] INT NULL DEFAULT 0;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'HTML_DOSYA_ADI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [HTML_DOSYA_ADI] VARCHAR(250) NULL DEFAULT 'Pano_Dikey.html';
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'KOD_ALANI_GENISLIGI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [KOD_ALANI_GENISLIGI] INT NULL DEFAULT 60;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO]') AND name = 'KUR_ALANI_GENISLIGI')
          ALTER TABLE [dbo].[TODVZ_PANO] ADD [KUR_ALANI_GENISLIGI] INT NULL DEFAULT 40;
      END

      -- 2. Ensure TODVZ_PANO_SATIRI table and columns exist
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_PANO_SATIRI')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_PANO_SATIRI] (
          [PANO_ID] INT NOT NULL,
          [PARA_ID] INT NOT NULL,
          [SATIR_NO] INT NOT NULL DEFAULT 0,
          [GORUNECEK_AD] VARCHAR(100) NULL,
          [SIRA_NO] INT NOT NULL DEFAULT 0,
          [GORUNUR] BIT NOT NULL DEFAULT 1,
          [CARPAN] FLOAT NOT NULL DEFAULT 1.0,
          CONSTRAINT [PK_TODVZ_PANO_SATIRI] PRIMARY KEY CLUSTERED ([PANO_ID] ASC, [PARA_ID] ASC)
        );
      END
      ELSE
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO_SATIRI]') AND name = 'SATIR_NO')
          ALTER TABLE [dbo].[TODVZ_PANO_SATIRI] ADD [SATIR_NO] INT NOT NULL DEFAULT 0;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO_SATIRI]') AND name = 'GORUNECEK_AD')
          ALTER TABLE [dbo].[TODVZ_PANO_SATIRI] ADD [GORUNECEK_AD] VARCHAR(100) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO_SATIRI]') AND name = 'SIRA_NO')
          ALTER TABLE [dbo].[TODVZ_PANO_SATIRI] ADD [SIRA_NO] INT NOT NULL DEFAULT 0;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO_SATIRI]') AND name = 'GORUNUR')
          ALTER TABLE [dbo].[TODVZ_PANO_SATIRI] ADD [GORUNUR] BIT NOT NULL DEFAULT 1;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TODVZ_PANO_SATIRI]') AND name = 'CARPAN')
          ALTER TABLE [dbo].[TODVZ_PANO_SATIRI] ADD [CARPAN] FLOAT NOT NULL DEFAULT 1.0;
      END

      -- 3. Procedure SODVZ_PANO_TANIMI_SIL
      EXEC('
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_PANO_TANIMI_SIL]
          @PANO_ID INT
        AS
        BEGIN
          SET NOCOUNT ON;
          DECLARE @HATA_MESAJI VARCHAR(250)
          DELETE FROM TODVZ_PANO_SATIRI WHERE PANO_ID = @PANO_ID
          DELETE FROM TODVZ_PANO WHERE PANO_ID = @PANO_ID
          IF @@ERROR <> 0 SET @HATA_MESAJI = ''Pano tanımı silinemedi''
          IF @HATA_MESAJI IS NULL RETURN 0
          RAISERROR (@HATA_MESAJI,16,1)
          RETURN 1
        END
      ');

      -- 4. Procedure SODVZ_PANO_TANIMI_KAYDET
      EXEC('
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_PANO_TANIMI_KAYDET]
          @PANO_ID INT OUTPUT,
          @PANO_NO VARCHAR(50) = NULL,
          @YENILEME_ARALIGI INT = 5,
          @FIRMA_ADI VARCHAR(250) = NULL,
          @PARA_BASLIGI VARCHAR(250) = NULL,
          @ALIS_KURU_BASLIGI VARCHAR(250) = NULL,
          @SATIS_KURU_BASLIGI VARCHAR(250) = NULL,
          @FIRMA_ADI_OZELLIKLERI VARCHAR(250) = NULL,
          @TARIH_SAAT_OZELLIKLERI VARCHAR(250) = NULL,
          @BASLIK_OZELLIKLERI VARCHAR(250) = NULL,
          @SATIR_OZELLIKLERI VARCHAR(250) = NULL,
          @ZEMIN_RENGI INT = 0,
          @BOSLUK_SAYISI INT = 0,
          @HTML_DOSYA_ADI VARCHAR(250) = NULL,
          @KOD_ALANI_GENISLIGI INT = 60,
          @KUR_ALANI_GENISLIGI INT = 40
        AS
        BEGIN
          SET NOCOUNT ON;
          DECLARE @HATA_MESAJI VARCHAR(250)
          IF @PANO_ID IS NULL OR @PANO_ID <= 0
          BEGIN
            INSERT INTO TODVZ_PANO(PANO_NO, YENILEME_ARALIGI, FIRMA_ADI, PARA_BASLIGI, ALIS_KURU_BASLIGI, SATIS_KURU_BASLIGI, FIRMA_ADI_OZELLIKLERI, TARIH_SAAT_OZELLIKLERI, BASLIK_OZELLIKLERI, SATIR_OZELLIKLERI, ZEMIN_RENGI, BOSLUK_SAYISI, HTML_DOSYA_ADI, KOD_ALANI_GENISLIGI, KUR_ALANI_GENISLIGI)
            VALUES(@PANO_NO, @YENILEME_ARALIGI, @FIRMA_ADI, @PARA_BASLIGI, @ALIS_KURU_BASLIGI, @SATIS_KURU_BASLIGI, @FIRMA_ADI_OZELLIKLERI, @TARIH_SAAT_OZELLIKLERI, @BASLIK_OZELLIKLERI, @SATIR_OZELLIKLERI, @ZEMIN_RENGI, @BOSLUK_SAYISI, @HTML_DOSYA_ADI, @KOD_ALANI_GENISLIGI, @KUR_ALANI_GENISLIGI)
            SET @PANO_ID = SCOPE_IDENTITY()
            IF @@ERROR<>0 SET @HATA_MESAJI = ''Pano tanımı kaydedilemedi''
          END
          ELSE BEGIN
            UPDATE TODVZ_PANO
              SET PANO_NO = @PANO_NO,
                  YENILEME_ARALIGI = @YENILEME_ARALIGI,
                  FIRMA_ADI = @FIRMA_ADI,
                  PARA_BASLIGI = @PARA_BASLIGI,
                  ALIS_KURU_BASLIGI = @ALIS_KURU_BASLIGI,
                  SATIS_KURU_BASLIGI = @SATIS_KURU_BASLIGI,
                  FIRMA_ADI_OZELLIKLERI = @FIRMA_ADI_OZELLIKLERI,
                  TARIH_SAAT_OZELLIKLERI = @TARIH_SAAT_OZELLIKLERI,
                  BASLIK_OZELLIKLERI = @BASLIK_OZELLIKLERI,
                  SATIR_OZELLIKLERI = @SATIR_OZELLIKLERI,
                  ZEMIN_RENGI = @ZEMIN_RENGI,
                  BOSLUK_SAYISI = @BOSLUK_SAYISI,
                  HTML_DOSYA_ADI = @HTML_DOSYA_ADI,
                  KOD_ALANI_GENISLIGI = @KOD_ALANI_GENISLIGI,
                  KUR_ALANI_GENISLIGI = @KUR_ALANI_GENISLIGI
            WHERE PANO_ID = @PANO_ID
            IF @@ERROR<>0 SET @HATA_MESAJI = ''Pano tanımı kaydedilemedi''
          END
          IF @HATA_MESAJI IS NULL RETURN 0
          RAISERROR (@HATA_MESAJI,16,1)
          RETURN 1
        END
      ');
    `;
        try {
            await pool.request().query(script);
        }
        catch (err) {
            logger.warn("PanoSqlRepository.ensureTablesAndProceduresExist warning:", err);
        }
    }
    /**
     * Fetch all Pano definitions summary.
     * Automatically seeds initial "PANO_01" if database table TODVZ_PANO is empty.
     */
    static async findAll(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await PanoSqlRepository.ensureTablesAndProceduresExist(pool);
        const res = await pool
            .request()
            .query("SELECT * FROM [dbo].[TODVZ_PANO] ORDER BY [PANO_ID] ASC");
        if (res.recordset.length === 0) {
            // Seed default pano definition
            const defaultPano = await PanoSqlRepository.saveViaProcedure({
                panoNo: "PANO_01",
                yenilemeAraligi: 5,
                firmaAdi: "KESKİNLER DÖVİZ SINIRLI YETKİLİ MÜESSESE A.Ş.",
                paraBasligi: "DÖVİZ",
                alisKuruBasligi: "WE BUY - ALIŞ",
                satisKuruBasligi: "WE SELL - SATIŞ",
                firmaAdiOzellikleri: "font:Outfit, sans-serif;size:24;bold:1;color:#ffffff;bgColor:transparent",
                tarihSaatOzellikleri: "font:Inter, sans-serif;size:14;bold:1;color:#fbbf24;bgColor:transparent",
                baslikOzellikleri: "font:Inter, sans-serif;size:16;bold:1;color:#60a5fa;bgColor:transparent",
                satirOzellikleri: "font:Fira Code, monospace;size:18;bold:1;color:#ffffff;bgColor:transparent",
                zeminRengi: "#0f172a",
                boslukSayisi: 10,
                htmlDosyaAdi: "Pano_Dikey.html",
                kodAlaniGenisligi: 60,
                kurAlaniGenisligi: 40,
            }, dbContext);
            return [defaultPano];
        }
        const panos = [];
        for (const r of res.recordset) {
            const full = await PanoSqlRepository.findById(r.PANO_ID, dbContext);
            if (full)
                panos.push(full);
        }
        return panos;
    }
    /**
     * Fetch single Pano definition with currency lines
     */
    static async findById(id, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await PanoSqlRepository.ensureTablesAndProceduresExist(pool);
        const headerRes = await pool
            .request()
            .input("id", sql.Int, id)
            .query("SELECT TOP 1 * FROM [dbo].[TODVZ_PANO] WHERE [PANO_ID] = @id");
        if (headerRes.recordset.length === 0)
            return null;
        const r = headerRes.recordset[0];
        // Query columns of TODVZ_PANO_SATIRI to build compatible SELECT query
        const colCheck = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_PANO_SATIRI'
    `);
        const existingCols = new Set(colCheck.recordset.map((c) => c.COLUMN_NAME.toUpperCase()));
        const siraExpr = existingCols.has("SIRA_NO") && existingCols.has("SATIR_NO")
            ? "ISNULL(PS.[SIRA_NO], ISNULL(PS.[SATIR_NO], 0))"
            : existingCols.has("SIRA_NO")
                ? "ISNULL(PS.[SIRA_NO], 0)"
                : existingCols.has("SATIR_NO")
                    ? "ISNULL(PS.[SATIR_NO], 0)"
                    : "0";
        const gorAdExpr = existingCols.has("GORUNECEK_AD") ? "PS.[GORUNECEK_AD]" : "NULL";
        const gorExpr = existingCols.has("GORUNUR") ? "PS.[GORUNUR]" : "1";
        const carpanExpr = existingCols.has("CARPAN") ? "PS.[CARPAN]" : "1.0";
        // Fetch lines joined with TODVZ_PARA, excluding TL / TRY base currency
        const linesRes = await pool
            .request()
            .input("panoId", sql.Int, id)
            .query(`
        SELECT 
          PS.[PANO_ID],
          PS.[PARA_ID],
          ${gorAdExpr} AS [GORUNECEK_AD],
          ${siraExpr} AS [SIRA_NO],
          ${gorExpr} AS [GORUNUR],
          ${carpanExpr} AS [CARPAN],
          LTRIM(RTRIM(ISNULL(P.[KOD], ''))) AS [PARA_KOD],
          LTRIM(RTRIM(ISNULL(P.[AD], ''))) AS [PARA_AD]
        FROM [dbo].[TODVZ_PANO_SATIRI] PS
        INNER JOIN [dbo].[TODVZ_PARA] P ON PS.[PARA_ID] = P.[PARA_ID]
        WHERE PS.[PANO_ID] = @panoId
          AND UPPER(LTRIM(RTRIM(ISNULL(P.[KOD], '')))) NOT IN ('TL', 'TRY', 'TL.', 'YTL', 'TRL')
        ORDER BY [SIRA_NO] ASC, PS.[PARA_ID] ASC
      `);
        let satirlar = linesRes.recordset.map((line) => ({
            paraId: line.PARA_ID,
            kod: line.PARA_KOD || "",
            ad: line.PARA_AD || "",
            gorunecekAd: line.GORUNECEK_AD || line.PARA_AD || "",
            siraNo: line.SIRA_NO ?? 0,
            gorunur: Boolean(line.GORUNUR),
            carpan: line.CARPAN ?? 1.0,
        }));
        // If satirlar is empty, automatically populate with currencies from TODVZ_PARA (excluding TL/TRY)
        if (satirlar.length === 0) {
            try {
                const defaultParaRes = await pool.request().query(`
          SELECT [PARA_ID], LTRIM(RTRIM(ISNULL([KOD], ''))) AS [KOD], LTRIM(RTRIM(ISNULL([AD], ''))) AS [AD]
          FROM [dbo].[TODVZ_PARA]
          WHERE UPPER(LTRIM(RTRIM(ISNULL([KOD], '')))) NOT IN ('TL', 'TRY', 'TL.', 'YTL', 'TRL')
          ORDER BY ISNULL([SIRA_NO], 999) ASC, [PARA_ID] ASC
        `);
                satirlar = defaultParaRes.recordset.map((p, idx) => ({
                    paraId: p.PARA_ID,
                    kod: p.KOD,
                    ad: p.AD,
                    gorunecekAd: `${p.KOD} - ${p.AD}`,
                    siraNo: idx + 1,
                    gorunur: true,
                    carpan: 1.0,
                }));
            }
            catch (paraErr) {
                logger.warn("PanoSqlRepository.findById defaultParaRes fallback warning:", paraErr);
            }
        }
        return {
            panoId: r.PANO_ID,
            panoNo: r.PANO_NO || "",
            yenilemeAraligi: r.YENILEME_ARALIGI ?? 5,
            firmaAdi: r.FIRMA_ADI || "",
            paraBasligi: r.PARA_BASLIGI || "",
            alisKuruBasligi: r.ALIS_KURU_BASLIGI || "",
            satisKuruBasligi: r.SATIS_KURU_BASLIGI || "",
            firmaAdiOzellikleri: r.FIRMA_ADI_OZELLIKLERI || "",
            tarihSaatOzellikleri: r.TARIH_SAAT_OZELLIKLERI || "",
            baslikOzellikleri: r.BASLIK_OZELLIKLERI || "",
            satirOzellikleri: r.SATIR_OZELLIKLERI || "",
            zeminRengi: delphiColorToHex(r.ZEMIN_RENGI),
            boslukSayisi: r.BOSLUK_SAYISI ?? 0,
            htmlDosyaAdi: r.HTML_DOSYA_ADI || "Pano_Dikey.html",
            kodAlaniGenisligi: r.KOD_ALANI_GENISLIGI ?? 60,
            kurAlaniGenisligi: r.KUR_ALANI_GENISLIGI ?? 40,
            satirlar,
        };
    }
    /**
     * Save or Update Pano definition via procedure SODVZ_PANO_TANIMI_KAYDET
     */
    static async saveViaProcedure(dto, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await PanoSqlRepository.ensureTablesAndProceduresExist(pool);
        const targetPanoId = dto.panoId && Number(dto.panoId) > 0 ? Number(dto.panoId) : null;
        const procReq = pool.request();
        procReq.output("PANO_ID", sql.Int, targetPanoId);
        procReq.input("PANO_NO", sql.VarChar(50), dto.panoNo || "");
        procReq.input("YENILEME_ARALIGI", sql.Int, dto.yenilemeAraligi ?? 5);
        procReq.input("FIRMA_ADI", sql.VarChar(250), dto.firmaAdi || "");
        procReq.input("PARA_BASLIGI", sql.VarChar(250), dto.paraBasligi || "");
        procReq.input("ALIS_KURU_BASLIGI", sql.VarChar(250), dto.alisKuruBasligi || "");
        procReq.input("SATIS_KURU_BASLIGI", sql.VarChar(250), dto.satisKuruBasligi || "");
        procReq.input("FIRMA_ADI_OZELLIKLERI", sql.VarChar(250), dto.firmaAdiOzellikleri || "");
        procReq.input("TARIH_SAAT_OZELLIKLERI", sql.VarChar(250), dto.tarihSaatOzellikleri || "");
        procReq.input("BASLIK_OZELLIKLERI", sql.VarChar(250), dto.baslikOzellikleri || "");
        procReq.input("SATIR_OZELLIKLERI", sql.VarChar(250), dto.satirOzellikleri || "");
        // Safely handle ZEMIN_RENGI whether parameter is INT or VARCHAR
        const colorInt = hexToDelphiColor(dto.zeminRengi);
        procReq.input("ZEMIN_RENGI", sql.Int, colorInt);
        procReq.input("BOSLUK_SAYISI", sql.Int, dto.boslukSayisi ?? 0);
        procReq.input("HTML_DOSYA_ADI", sql.VarChar(250), dto.htmlDosyaAdi || "Pano_Dikey.html");
        procReq.input("KOD_ALANI_GENISLIGI", sql.Int, dto.kodAlaniGenisligi ?? 60);
        procReq.input("KUR_ALANI_GENISLIGI", sql.Int, dto.kurAlaniGenisligi ?? 40);
        try {
            await procReq.execute("SODVZ_PANO_TANIMI_KAYDET");
        }
        catch (procErr) {
            if (procErr?.message && procErr.message.includes("converting")) {
                const fallbackReq = pool.request();
                fallbackReq.output("PANO_ID", sql.Int, targetPanoId);
                fallbackReq.input("PANO_NO", sql.VarChar(50), dto.panoNo || "");
                fallbackReq.input("YENILEME_ARALIGI", sql.Int, dto.yenilemeAraligi ?? 5);
                fallbackReq.input("FIRMA_ADI", sql.VarChar(250), dto.firmaAdi || "");
                fallbackReq.input("PARA_BASLIGI", sql.VarChar(250), dto.paraBasligi || "");
                fallbackReq.input("ALIS_KURU_BASLIGI", sql.VarChar(250), dto.alisKuruBasligi || "");
                fallbackReq.input("SATIS_KURU_BASLIGI", sql.VarChar(250), dto.satisKuruBasligi || "");
                fallbackReq.input("FIRMA_ADI_OZELLIKLERI", sql.VarChar(250), dto.firmaAdiOzellikleri || "");
                fallbackReq.input("TARIH_SAAT_OZELLIKLERI", sql.VarChar(250), dto.tarihSaatOzellikleri || "");
                fallbackReq.input("BASLIK_OZELLIKLERI", sql.VarChar(250), dto.baslikOzellikleri || "");
                fallbackReq.input("SATIR_OZELLIKLERI", sql.VarChar(250), dto.satirOzellikleri || "");
                fallbackReq.input("ZEMIN_RENGI", sql.VarChar(50), dto.zeminRengi || "#000000");
                fallbackReq.input("BOSLUK_SAYISI", sql.Int, dto.boslukSayisi ?? 0);
                fallbackReq.input("HTML_DOSYA_ADI", sql.VarChar(250), dto.htmlDosyaAdi || "Pano_Dikey.html");
                fallbackReq.input("KOD_ALANI_GENISLIGI", sql.Int, dto.kodAlaniGenisligi ?? 60);
                fallbackReq.input("KUR_ALANI_GENISLIGI", sql.Int, dto.kurAlaniGenisligi ?? 40);
                await fallbackReq.execute("SODVZ_PANO_TANIMI_KAYDET");
                procReq.parameters.PANO_ID = fallbackReq.parameters.PANO_ID;
            }
            else {
                throw procErr;
            }
        }
        const outId = procReq.parameters.PANO_ID?.value;
        const savedPanoId = outId && Number(outId) > 0 ? Number(outId) : (targetPanoId || 0);
        if (!savedPanoId) {
            throw ApiError.internal("Pano tanımı kaydedildi fakat PANO_ID alınamadı.");
        }
        // Process lines in TODVZ_PANO_SATIRI
        if (dto.satirlar !== undefined) {
            // 1. Deduplicate by paraId to prevent primary key collision
            const seenParaIds = new Set();
            const uniqueLines = [];
            for (const line of dto.satirlar) {
                if (!line.paraId || seenParaIds.has(line.paraId))
                    continue;
                seenParaIds.add(line.paraId);
                uniqueLines.push(line);
            }
            // 2. Discover available columns in TODVZ_PANO_SATIRI (e.g. SATIR_NO, SIRA_NO)
            const colCheck = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_PANO_SATIRI'
      `);
            const existingCols = new Set(colCheck.recordset.map((c) => c.COLUMN_NAME.toUpperCase()));
            const transaction = new sql.Transaction(pool);
            try {
                await transaction.begin();
                // Delete existing lines for this pano
                const delReq = new sql.Request(transaction);
                delReq.input("panoId", sql.Int, savedPanoId);
                await delReq.query("DELETE FROM [dbo].[TODVZ_PANO_SATIRI] WHERE [PANO_ID] = @panoId");
                // Insert new lines supplying all non-null required columns dynamically
                let index = 1;
                for (const line of uniqueLines) {
                    const seq = line.siraNo !== undefined && line.siraNo > 0 ? line.siraNo : index++;
                    const insReq = new sql.Request(transaction);
                    insReq.input("panoId", sql.Int, savedPanoId);
                    insReq.input("paraId", sql.Int, line.paraId);
                    const colList = ["[PANO_ID]", "[PARA_ID]"];
                    const valList = ["@panoId", "@paraId"];
                    // SATIR_NO column
                    if (existingCols.has("SATIR_NO")) {
                        colList.push("[SATIR_NO]");
                        valList.push("@satirNo");
                        insReq.input("satirNo", sql.Int, seq);
                    }
                    // SIRA_NO column
                    if (existingCols.has("SIRA_NO")) {
                        colList.push("[SIRA_NO]");
                        valList.push("@siraNo");
                        insReq.input("siraNo", sql.Int, seq);
                    }
                    // GORUNECEK_AD column
                    if (existingCols.has("GORUNECEK_AD")) {
                        colList.push("[GORUNECEK_AD]");
                        valList.push("@gorunecekAd");
                        insReq.input("gorunecekAd", sql.VarChar(100), line.gorunecekAd || null);
                    }
                    // GORUNUR column
                    if (existingCols.has("GORUNUR")) {
                        colList.push("[GORUNUR]");
                        valList.push("@gorunur");
                        insReq.input("gorunur", sql.Bit, line.gorunur !== undefined ? (line.gorunur ? 1 : 0) : 1);
                    }
                    // CARPAN column
                    if (existingCols.has("CARPAN")) {
                        colList.push("[CARPAN]");
                        valList.push("@carpan");
                        insReq.input("carpan", sql.Float, line.carpan ?? 1.0);
                    }
                    await insReq.query(`
            INSERT INTO [dbo].[TODVZ_PANO_SATIRI] (${colList.join(", ")})
            VALUES (${valList.join(", ")})
          `);
                }
                await transaction.commit();
            }
            catch (err) {
                await transaction.rollback();
                logger.error("PanoSqlRepository.saveViaProcedure lines save error:", err);
                throw ApiError.badRequest("Pano satırları kaydedilemedi: " + (err?.message || err));
            }
        }
        const result = await PanoSqlRepository.findById(savedPanoId, dbContext);
        if (!result) {
            throw ApiError.internal("Pano tanımı kaydedildi ancak okunamadı.");
        }
        return result;
    }
    /**
     * Delete Pano definition via procedure SODVZ_PANO_TANIMI_SIL
     */
    static async deleteViaProcedure(id, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await PanoSqlRepository.ensureTablesAndProceduresExist(pool);
        const procReq = pool.request();
        procReq.input("PANO_ID", sql.Int, id);
        await procReq.execute("SODVZ_PANO_TANIMI_SIL");
        return true;
    }
    /**
     * Get Live Board display data: Pano definition joined with live currency rates from TODVZ_KUR
     */
    static async getLiveBoardData(panoId, dbContext) {
        let targetId = panoId;
        if (!targetId || targetId <= 0) {
            const allPanos = await PanoSqlRepository.findAll(dbContext);
            if (allPanos.length > 0)
                targetId = allPanos[0].panoId;
            else
                return null;
        }
        const pano = await PanoSqlRepository.findById(targetId, dbContext);
        if (!pano)
            return null;
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        // Fetch current live rates from latest TODVZ_KUR_TABLOSU (TUR = 0 preferred Gişe Kuru, fallback latest)
        const ratesRes = await pool.query(`
      SELECT 
        K.[PARA_ID],
        ISNULL(NULLIF(K.[DOVIZ_ALIS], 0), K.[EFEKTIF_ALIS]) AS [ALIS],
        ISNULL(NULLIF(K.[DOVIZ_SATIS], 0), K.[EFEKTIF_SATIS]) AS [SATIS]
      FROM [dbo].[TODVZ_KUR_TABLOSU] KT
      INNER JOIN [dbo].[TODVZ_KUR] K ON KT.[KUR_TABLOSU_ID] = K.[KUR_TABLOSU_ID]
      WHERE KT.[KUR_TABLOSU_ID] = (
        SELECT TOP 1 [KUR_TABLOSU_ID] 
        FROM [dbo].[TODVZ_KUR_TABLOSU] 
        ORDER BY CASE WHEN [TUR] = 0 THEN 0 ELSE 1 END ASC, [ZAMAN] DESC, [KUR_TABLOSU_ID] DESC
      )
      AND K.[PARA_ID] NOT IN (
        SELECT [PARA_ID] FROM [dbo].[TODVZ_PARA] WHERE UPPER(LTRIM(RTRIM(ISNULL([KOD],'')))) IN ('TL','TRY','TL.','YTL','TRL')
      )
    `);
        const ratesMap = new Map();
        for (const r of ratesRes.recordset) {
            ratesMap.set(r.PARA_ID, {
                alis: r.ALIS,
                satis: r.SATIS,
            });
        }
        // Filter out TL / TRY from satirlar and assign live rates
        pano.satirlar = pano.satirlar
            .filter((s) => !["TL", "TRY", "TL.", "YTL", "TRL"].includes((s.kod || "").trim().toUpperCase()))
            .map((line) => {
            const live = ratesMap.get(line.paraId);
            const alisVal = live?.alis !== null && live?.alis !== undefined && !isNaN(Number(live.alis)) ? Number(live.alis) : null;
            const satisVal = live?.satis !== null && live?.satis !== undefined && !isNaN(Number(live.satis)) ? Number(live.satis) : null;
            const multiplier = line.carpan && line.carpan > 0 ? line.carpan : 1.0;
            return {
                ...line,
                dovizAlis: alisVal !== null ? alisVal * multiplier : null,
                dovizSatis: satisVal !== null ? satisVal * multiplier : null,
            };
        });
        return pano;
    }
}
