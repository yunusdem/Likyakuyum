import sql from "mssql";
import crypto from "crypto";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
export class CariDekontSqlRepository {
    /**
     * Ensures necessary tables and stored procedures exist in the current database
     */
    static async ensureTablesAndProceduresExist(pool) {
        try {
            // 1. TODVZ_CARI_DEKONT table
            await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_CARI_DEKONT')
        BEGIN
          CREATE TABLE [dbo].[TODVZ_CARI_DEKONT] (
            [CARI_DEKONT_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY CLUSTERED,
            [TIP] TINYINT NOT NULL DEFAULT 0,
            [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
            [ACIKLAMA] VARCHAR(100) NULL,
            [KUR_CINSI] TINYINT NOT NULL DEFAULT 0,
            [BORCLU_ID] INT NOT NULL DEFAULT 0,
            [ALACAKLI_ID] INT NOT NULL DEFAULT 0,
            [EKLEYEN_ID] INT NOT NULL DEFAULT 1,
            [GUNCELLEYEN_ID] INT NOT NULL DEFAULT 1,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [VEZNE_ID] INT NOT NULL DEFAULT 1,
            [SATIR_DURUMU] TINYINT NOT NULL DEFAULT 0,
            [EVRAK_TURU] TINYINT NOT NULL DEFAULT 0,
            [VADE] DATETIME NULL,
            [IPTAL_TARIHI] DATETIME NULL,
            [ONCEKI_ID] INT NULL
          );
        END
      `);
            // 2. TODVZ_CARI_DEKONT_SATIRI table
            await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_CARI_DEKONT_SATIRI')
        BEGIN
          CREATE TABLE [dbo].[TODVZ_CARI_DEKONT_SATIRI] (
            [CARI_DEKONT_ID] INT NOT NULL,
            [TIP] TINYINT NOT NULL DEFAULT 0,
            [SATIR_NO] INT NOT NULL DEFAULT 1,
            [PARA_ID] INT NOT NULL DEFAULT 0,
            [MEBLAG] FLOAT NOT NULL DEFAULT 0,
            [KUR] FLOAT NOT NULL DEFAULT 1.0,
            [GISE_KURU] FLOAT NOT NULL DEFAULT 1.0
          );
          CREATE INDEX [IX_TODVZ_CARI_DEKONT_SATIRI_ID] ON [dbo].[TODVZ_CARI_DEKONT_SATIRI] ([CARI_DEKONT_ID]);
        END
      `);
            // 3. Staging table TODVZ_ISKELE_CARI_DEKONT_SATIR
            await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_ISKELE_CARI_DEKONT_SATIR')
        BEGIN
          CREATE TABLE [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] (
            [GUID] VARCHAR(50) NOT NULL,
            [TIP] TINYINT NOT NULL DEFAULT 0,
            [SATIR_NO] INT NOT NULL DEFAULT 1,
            [PARA_ID] INT NOT NULL DEFAULT 0,
            [MEBLAG] FLOAT NOT NULL DEFAULT 0,
            [KUR] FLOAT NOT NULL DEFAULT 1.0,
            [GISE_KURU] FLOAT NOT NULL DEFAULT 1.0
          );
          CREATE INDEX [IX_TODVZ_ISKELE_GUID] ON [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] ([GUID]);
        END
      `);
            // 4. Stored Procedure SODVZ_CARI_DEKONT_SIL
            await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'SODVZ_CARI_DEKONT_SIL')
        BEGIN
          EXEC('
            CREATE PROCEDURE [dbo].[SODVZ_CARI_DEKONT_SIL]
              @CARI_DEKONT_ID INT,
              @KULLANICI_ID INT = 1,
              @DEGISIKLIK_TAKIP_VAR BIT = 1
            AS
            BEGIN
              SET NOCOUNT ON;
              DECLARE @HATA_MESAJI VARCHAR(250)
              BEGIN TRAN
              BEGIN TRY
                DELETE FROM TODVZ_CARI_DEKONT_SATIRI WHERE CARI_DEKONT_ID = @CARI_DEKONT_ID
                DELETE FROM TODVZ_CARI_DEKONT WHERE CARI_DEKONT_ID = @CARI_DEKONT_ID
                COMMIT TRAN
                RETURN 0
              END TRY
              BEGIN CATCH
                ROLLBACK TRAN
                SET @HATA_MESAJI = ERROR_MESSAGE()
                RAISERROR(@HATA_MESAJI, 16, 1)
                RETURN 1
              END CATCH
            END
          ')
        END
      `);
            // 5. Stored Procedure SODVZ_CARI_DEKONT_KAYDET
            await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'SODVZ_CARI_DEKONT_KAYDET')
        BEGIN
          EXEC('
            CREATE PROCEDURE [dbo].[SODVZ_CARI_DEKONT_KAYDET]
              @CARI_DEKONT_ID INT OUTPUT,
              @TIP TINYINT,
              @TARIH DATETIME,
              @ACIKLAMA VARCHAR(100) = NULL,
              @KUR_CINSI TINYINT = 0,
              @BORCLU_ID INT,
              @ALACAKLI_ID INT,
              @KULLANICI_ID INT = 1,
              @VEZNE_ID INT = 1,
              @DEGISIKLIK_TAKIP_VAR BIT = 1,
              @SATIR_DURUMU TINYINT = 0,
              @EVRAK_TURU TINYINT = 0,
              @VADE DATETIME = NULL,
              @IPTAL_TARIHI DATETIME = NULL,
              @ONCEKI_ID INT = NULL,
              @GUID VARCHAR(50)
            AS
            BEGIN
              SET NOCOUNT ON;
              DECLARE @ZAMAN DATETIME = GETDATE();
              BEGIN TRAN
              BEGIN TRY
                IF @CARI_DEKONT_ID IS NULL OR @CARI_DEKONT_ID = 0
                BEGIN
                  INSERT INTO TODVZ_CARI_DEKONT(
                    TIP, TARIH, ACIKLAMA, KUR_CINSI, BORCLU_ID, ALACAKLI_ID,
                    SATIR_DURUMU, EVRAK_TURU, VADE, IPTAL_TARIHI,
                    EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI,
                    VEZNE_ID, ONCEKI_ID
                  )
                  VALUES(
                    @TIP, @TARIH, @ACIKLAMA, @KUR_CINSI, @BORCLU_ID, @ALACAKLI_ID,
                    @SATIR_DURUMU, @EVRAK_TURU, @VADE, @IPTAL_TARIHI,
                    @KULLANICI_ID, @ZAMAN, @KULLANICI_ID, @ZAMAN,
                    @VEZNE_ID, @ONCEKI_ID
                  );
                  SELECT @CARI_DEKONT_ID = SCOPE_IDENTITY();
                END
                ELSE
                BEGIN
                  UPDATE TODVZ_CARI_DEKONT
                  SET TIP = @TIP,
                      TARIH = @TARIH,
                      ACIKLAMA = @ACIKLAMA,
                      KUR_CINSI = @KUR_CINSI,
                      BORCLU_ID = @BORCLU_ID,
                      ALACAKLI_ID = @ALACAKLI_ID,
                      SATIR_DURUMU = @SATIR_DURUMU,
                      EVRAK_TURU = @EVRAK_TURU,
                      VADE = @VADE,
                      IPTAL_TARIHI = @IPTAL_TARIHI,
                      GUNCELLEYEN_ID = @KULLANICI_ID,
                      GUNCELLEME_ZAMANI = @ZAMAN,
                      VEZNE_ID = @VEZNE_ID
                  WHERE CARI_DEKONT_ID = @CARI_DEKONT_ID;
                END

                DELETE FROM TODVZ_CARI_DEKONT_SATIRI WHERE CARI_DEKONT_ID = @CARI_DEKONT_ID;

                INSERT INTO TODVZ_CARI_DEKONT_SATIRI(CARI_DEKONT_ID, TIP, SATIR_NO, PARA_ID, MEBLAG, KUR, GISE_KURU)
                SELECT @CARI_DEKONT_ID, TIP, SATIR_NO, PARA_ID, MEBLAG, KUR, GISE_KURU
                FROM TODVZ_ISKELE_CARI_DEKONT_SATIR
                WHERE GUID = @GUID;

                DELETE FROM TODVZ_ISKELE_CARI_DEKONT_SATIR WHERE GUID = @GUID;

                COMMIT TRAN;
                RETURN 0;
              END TRY
              BEGIN CATCH
                ROLLBACK TRAN;
                DELETE FROM TODVZ_ISKELE_CARI_DEKONT_SATIR WHERE GUID = @GUID;
                DECLARE @ERR VARCHAR(250) = ERROR_MESSAGE();
                RAISERROR(@ERR, 16, 1);
                RETURN 1;
              END CATCH
            END
          ')
        END
      `);
        }
        catch (err) {
            logger.warn("CariDekontSqlRepository.ensureTablesAndProceduresExist warning:", err);
        }
    }
    /**
     * Save or Update Cari Dekont via Stored Procedure SODVZ_CARI_DEKONT_KAYDET
     */
    static async saveViaProcedure(dto, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await CariDekontSqlRepository.ensureTablesAndProceduresExist(pool);
        const isUpdate = dto.cariDekontId !== undefined && dto.cariDekontId !== null && Number(dto.cariDekontId) > 0;
        const targetDekontId = isUpdate ? Number(dto.cariDekontId) : null;
        const guid = crypto.randomUUID();
        const tip = dto.tip === 1 ? 1 : 0;
        const parseDate = (d) => {
            if (!d)
                return new Date();
            const dt = new Date(d);
            return isNaN(dt.getTime()) ? new Date() : dt;
        };
        const tarihDate = parseDate(dto.tarih);
        const vadeDate = dto.vade ? parseDate(dto.vade) : null;
        const iptalTarihiDate = dto.iptalTarihi ? parseDate(dto.iptalTarihi) : null;
        // Filter valid lines
        const validLines = (dto.satirlar || []).filter((l) => l.paraId > 0 && Number(l.meblag) > 0);
        if (validLines.length === 0) {
            throw ApiError.badRequest("Lütfen en az bir geçerli miktar içeren dekont satırı giriniz.");
        }
        // Step 1: Insert rows into staging table TODVZ_ISKELE_CARI_DEKONT_SATIR
        try {
            for (let i = 0; i < validLines.length; i++) {
                const line = validLines[i];
                const lineSeq = line.satirNo !== undefined && line.satirNo > 0 ? line.satirNo : i + 1;
                const lineTip = line.tip !== undefined ? Number(line.tip) : tip;
                const meblag = Number(line.meblag) || 0;
                const kur = Number(line.kur) || 1.0;
                const giseKuru = Number(line.giseKuru) || 1.0;
                await pool
                    .request()
                    .input("guid", sql.VarChar(50), guid)
                    .input("tip", sql.TinyInt, lineTip)
                    .input("satirNo", sql.Int, lineSeq)
                    .input("paraId", sql.Int, line.paraId)
                    .input("meblag", sql.Float, meblag)
                    .input("kur", sql.Float, kur)
                    .input("giseKuru", sql.Float, giseKuru)
                    .query(`
            INSERT INTO [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] (GUID, TIP, SATIR_NO, PARA_ID, MEBLAG, KUR, GISE_KURU)
            VALUES (@guid, @tip, @satirNo, @paraId, @meblag, @kur, @giseKuru)
          `);
            }
        }
        catch (insertErr) {
            await pool.request().input("guid", sql.VarChar(50), guid).query("DELETE FROM [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] WHERE GUID = @guid");
            throw ApiError.badRequest("Dekont satırları iskeleye eklenemedi: " + (insertErr?.message || insertErr));
        }
        // Step 2: Execute Stored Procedure SODVZ_CARI_DEKONT_KAYDET
        const procReq = pool.request();
        procReq.output("CARI_DEKONT_ID", sql.Int, targetDekontId);
        procReq.input("TIP", sql.TinyInt, tip);
        procReq.input("TARIH", sql.DateTime, tarihDate);
        procReq.input("ACIKLAMA", sql.VarChar(100), (dto.aciklama || "").substring(0, 100));
        procReq.input("KUR_CINSI", sql.TinyInt, dto.kurCinsi ?? 0);
        procReq.input("BORCLU_ID", sql.Int, dto.borcluId);
        procReq.input("ALACAKLI_ID", sql.Int, dto.alacakliId);
        procReq.input("KULLANICI_ID", sql.Int, dto.kullaniciId || 1);
        procReq.input("VEZNE_ID", sql.Int, dto.vezneId || 1);
        procReq.input("DEGISIKLIK_TAKIP_VAR", sql.Bit, dto.degisiklikTakipVar !== undefined ? (dto.degisiklikTakipVar ? 1 : 0) : 1);
        procReq.input("SATIR_DURUMU", sql.TinyInt, dto.satirDurumu ?? 0);
        procReq.input("EVRAK_TURU", sql.TinyInt, dto.evrakTuru ?? 0);
        procReq.input("VADE", sql.DateTime, vadeDate);
        procReq.input("IPTAL_TARIHI", sql.DateTime, iptalTarihiDate);
        procReq.input("ONCEKI_ID", sql.Int, dto.oncekiId ?? null);
        procReq.input("GUID", sql.VarChar(50), guid);
        try {
            await procReq.execute("SODVZ_CARI_DEKONT_KAYDET");
        }
        catch (procErr) {
            // Clean up staging on error if procedure rollback missed it
            try {
                await pool.request().input("guid", sql.VarChar(50), guid).query("DELETE FROM [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] WHERE GUID = @guid");
            }
            catch { }
            logger.error("SODVZ_CARI_DEKONT_KAYDET execution error:", procErr);
            throw ApiError.badRequest("Cari dekont kaydedilemedi: " + (procErr?.message || procErr));
        }
        const outId = procReq.parameters.CARI_DEKONT_ID?.value;
        let savedDekontId = outId && Number(outId) > 0 ? Number(outId) : (targetDekontId || 0);
        if (!savedDekontId) {
            // Fallback query for newly inserted ID
            const fallbackRes = await pool.request().query(`
        SELECT TOP 1 [CARI_DEKONT_ID] AS [ID] FROM [dbo].[TODVZ_CARI_DEKONT] ORDER BY [CARI_DEKONT_ID] DESC
      `);
            if (fallbackRes.recordset.length > 0 && fallbackRes.recordset[0].ID > 0) {
                savedDekontId = fallbackRes.recordset[0].ID;
            }
        }
        const result = await CariDekontSqlRepository.findById(savedDekontId, dbContext);
        if (!result) {
            throw ApiError.internal("Cari dekont kaydedildi ancak okunamadı.");
        }
        return result;
    }
    /**
     * Delete Cari Dekont via Stored Procedure SODVZ_CARI_DEKONT_SIL
     */
    static async deleteViaProcedure(id, kullaniciId = 1, degisiklikTakipVar = true, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await CariDekontSqlRepository.ensureTablesAndProceduresExist(pool);
        const procReq = pool.request();
        procReq.input("CARI_DEKONT_ID", sql.Int, id);
        procReq.input("KULLANICI_ID", sql.Int, kullaniciId || 1);
        procReq.input("DEGISIKLIK_TAKIP_VAR", sql.Bit, degisiklikTakipVar ? 1 : 0);
        try {
            await procReq.execute("SODVZ_CARI_DEKONT_SIL");
        }
        catch (procErr) {
            logger.error("SODVZ_CARI_DEKONT_SIL execution error:", procErr);
            throw ApiError.badRequest("Cari dekont silinemedi: " + (procErr?.message || procErr));
        }
    }
    /**
     * Find single Cari Dekont by ID with lines
     */
    static async findById(id, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await CariDekontSqlRepository.ensureTablesAndProceduresExist(pool);
        const headerRes = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`
        SELECT 
          D.*,
          ISNULL(CB.KOD, '') AS [BORCLU_KOD],
          ISNULL(CB.AD, '') AS [BORCLU_AD],
          ISNULL(CA.KOD, '') AS [ALACAKLI_KOD],
          ISNULL(CA.AD, '') AS [ALACAKLI_AD],
          ISNULL(V.KOD, '') AS [VEZNE_KOD],
          ISNULL(V.AD, '') AS [VEZNE_AD]
        FROM [dbo].[TODVZ_CARI_DEKONT] D
        LEFT JOIN [dbo].[TODVZ_CARI_KART] CB ON D.BORCLU_ID = CB.CARI_KART_ID
        LEFT JOIN [dbo].[TODVZ_CARI_KART] CA ON D.ALACAKLI_ID = CA.CARI_KART_ID
        LEFT JOIN [dbo].[TODVZ_VEZNE] V ON D.VEZNE_ID = V.VEZNE_ID
        WHERE D.CARI_DEKONT_ID = @id
      `);
        if (headerRes.recordset.length === 0)
            return null;
        const h = headerRes.recordset[0];
        const linesRes = await pool
            .request()
            .input("dekontId", sql.Int, id)
            .query(`
        SELECT 
          S.*,
          ISNULL(P.KOD, '') AS [PARA_KOD],
          ISNULL(P.AD, '') AS [PARA_AD],
          ISNULL(P.HAS_ORANI, 1.0) AS [HAS_ORANI]
        FROM [dbo].[TODVZ_CARI_DEKONT_SATIRI] S
        LEFT JOIN [dbo].[TODVZ_PARA] P ON S.PARA_ID = P.PARA_ID
        WHERE S.CARI_DEKONT_ID = @dekontId
        ORDER BY S.SATIR_NO ASC
      `);
        let toplamMiktar = 0;
        let toplamHas = 0;
        let toplamTutar = 0;
        const satirlar = linesRes.recordset.map((line) => {
            const miktar = line.MEBLAG ?? 0;
            const hasOrani = Number(line.HAS_ORANI) || 1.0;
            const hasMiktar = Number((miktar * hasOrani).toFixed(3));
            const kur = line.KUR ?? 1.0;
            const giseKuru = line.GISE_KURU ?? 1.0;
            const tutar = Number((hasMiktar * kur).toFixed(2));
            toplamMiktar += miktar;
            toplamHas += hasMiktar;
            toplamTutar += tutar;
            return {
                satirNo: line.SATIR_NO,
                tip: line.TIP,
                paraId: line.PARA_ID,
                paraKodu: line.PARA_KOD || "",
                paraAdi: line.PARA_AD || "",
                hasOrani,
                meblag: miktar,
                hasMiktar,
                kur,
                giseKuru,
                tutar,
            };
        });
        return {
            cariDekontId: h.CARI_DEKONT_ID,
            dekontNo: `DK-${String(h.CARI_DEKONT_ID).padStart(6, "0")}`,
            tip: h.TIP,
            tipLabel: h.TIP === 0 ? "Emanet Alma (Giriş)" : "Emanet Verme (Çıkış)",
            tarih: h.TARIH ? new Date(h.TARIH).toISOString().split("T")[0] : "",
            aciklama: h.ACIKLAMA || "",
            kurCinsi: h.KUR_CINSI ?? 0,
            borcluId: h.BORCLU_ID,
            borcluKod: h.BORCLU_KOD || "",
            borcluAd: h.BORCLU_AD || "",
            alacakliId: h.ALACAKLI_ID,
            alacakliKod: h.ALACAKLI_KOD || "",
            alacakliAd: h.ALACAKLI_AD || "",
            kullaniciId: h.EKLEYEN_ID,
            ekleyenAd: h.EKLEYEN_AD || "",
            vezneId: h.VEZNE_ID,
            vezneKod: h.VEZNE_KOD || "",
            vezneAd: h.VEZNE_AD || "",
            satirDurumu: h.SATIR_DURUMU ?? 0,
            evrakTuru: h.EVRAK_TURU ?? 0,
            vade: h.VADE ? new Date(h.VADE).toISOString().split("T")[0] : null,
            iptalTarihi: h.IPTAL_TARIHI ? new Date(h.IPTAL_TARIHI).toISOString().split("T")[0] : null,
            oncekiId: h.ONCEKI_ID ?? null,
            eklemeZamani: h.EKLEME_ZAMANI ? new Date(h.EKLEME_ZAMANI).toISOString() : "",
            guncellemeZamani: h.GUNCELLEME_ZAMANI ? new Date(h.GUNCELLEME_ZAMANI).toISOString() : "",
            toplamMiktar: Number(toplamMiktar.toFixed(2)),
            toplamHas: Number(toplamHas.toFixed(3)),
            toplamTutar: Number(toplamTutar.toFixed(2)),
            satirlar,
        };
    }
    /**
     * Search / List Cari Dekonts for Dürbün lookup modal
     */
    static async findAll(filter, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await CariDekontSqlRepository.ensureTablesAndProceduresExist(pool);
        const limit = Math.min(Number(filter?.limit) || 100, 250);
        const req = pool.request();
        req.input("limit", sql.Int, limit);
        let whereClauses = [];
        if (filter?.tip !== undefined && filter?.tip !== null && filter.tip >= 0) {
            req.input("tip", sql.TinyInt, filter.tip);
            whereClauses.push("D.TIP = @tip");
        }
        if (filter?.vezneId) {
            req.input("vezneId", sql.Int, filter.vezneId);
            whereClauses.push("D.VEZNE_ID = @vezneId");
        }
        if (filter?.search && filter.search.trim()) {
            req.input("search", sql.VarChar(100), `%${filter.search.trim()}%`);
            whereClauses.push(`(
        CAST(D.CARI_DEKONT_ID AS VARCHAR) LIKE @search OR
        D.ACIKLAMA LIKE @search OR
        ISNULL(CB.KOD, '') LIKE @search OR
        ISNULL(CB.AD, '') LIKE @search OR
        ISNULL(CA.KOD, '') LIKE @search OR
        ISNULL(CA.AD, '') LIKE @search
      )`);
        }
        const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
        const query = `
      SELECT TOP (@limit)
        D.CARI_DEKONT_ID,
        D.TIP,
        D.TARIH,
        ISNULL(D.ACIKLAMA, '') AS [ACIKLAMA],
        D.VEZNE_ID,
        CASE WHEN D.TIP = 0 THEN ISNULL(CA.KOD, ISNULL(CB.KOD, '')) ELSE ISNULL(CB.KOD, ISNULL(CA.KOD, '')) END AS [CARI_KOD],
        CASE WHEN D.TIP = 0 THEN ISNULL(CA.AD, ISNULL(CB.AD, '')) ELSE ISNULL(CB.AD, ISNULL(CA.AD, '')) END AS [CARI_AD],
        ISNULL(V.KOD, '') AS [VEZNE_KOD],
        ISNULL(V.AD, '') AS [VEZNE_AD],
        ISNULL(SUM_SATIR.KALEM_SAYISI, 0) AS [KALEM_SAYISI],
        ISNULL(SUM_SATIR.TOPLAM_MIKTAR, 0) AS [TOPLAM_MIKTAR]
      FROM [dbo].[TODVZ_CARI_DEKONT] D
      LEFT JOIN [dbo].[TODVZ_CARI_KART] CB ON D.BORCLU_ID = CB.CARI_KART_ID
      LEFT JOIN [dbo].[TODVZ_CARI_KART] CA ON D.ALACAKLI_ID = CA.CARI_KART_ID
      LEFT JOIN [dbo].[TODVZ_VEZNE] V ON D.VEZNE_ID = V.VEZNE_ID
      LEFT JOIN (
        SELECT 
          CARI_DEKONT_ID,
          COUNT(*) AS [KALEM_SAYISI],
          SUM(MEBLAG) AS [TOPLAM_MIKTAR]
        FROM [dbo].[TODVZ_CARI_DEKONT_SATIRI]
        GROUP BY CARI_DEKONT_ID
      ) SUM_SATIR ON D.CARI_DEKONT_ID = SUM_SATIR.CARI_DEKONT_ID
      ${whereSql}
      ORDER BY D.CARI_DEKONT_ID DESC
    `;
        const res = await req.query(query);
        return res.recordset.map((r) => ({
            cariDekontId: r.CARI_DEKONT_ID,
            dekontNo: `DK-${String(r.CARI_DEKONT_ID).padStart(6, "0")}`,
            tip: r.TIP,
            tipLabel: r.TIP === 0 ? "Emanet Alma (Giriş)" : "Emanet Verme (Çıkış)",
            tarih: r.TARIH ? new Date(r.TARIH).toISOString().split("T")[0] : "",
            cariKod: r.CARI_KOD || "",
            cariAd: r.CARI_AD || "",
            vezneKod: r.VEZNE_KOD || "",
            vezneAd: r.VEZNE_AD || "",
            aciklama: r.ACIKLAMA || "",
            kalemSayisi: r.KALEM_SAYISI || 0,
            toplamMiktar: Number((r.TOPLAM_MIKTAR || 0).toFixed(2)),
        }));
    }
}
