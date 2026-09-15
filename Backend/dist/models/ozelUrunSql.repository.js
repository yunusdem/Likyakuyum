import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { EtiketNumeratorSqlRepository } from "./etiketNumeratorSql.repository.js";
export class OzelUrunSqlRepository {
    static async ensureTables(pool) {
        try {
            await pool.request().batch(`
        IF OBJECT_ID('TODVZ_OZEL_URUN', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_OZEL_URUN] (
            [OZEL_URUN_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
            [GRUP_KODU] VARCHAR(3) NOT NULL,
            [URUN_NO] INT NOT NULL,
            [BARKOD] VARCHAR(50) NULL,
            [MAMUL_TIPI] VARCHAR(50) NULL,
            [URETICI_FIRMA] VARCHAR(150) NULL,
            [MIKTAR] FLOAT NOT NULL DEFAULT 1.00,
            [MIKTAR_BIRIMI] VARCHAR(20) NOT NULL DEFAULT 'Adet',
            [ORJINAL_KOD] VARCHAR(50) NULL,
            [AYAR] VARCHAR(20) NULL,
            [MODEL_OZELLIK_1] VARCHAR(100) NULL,
            [MODEL_OZELLIK_2] VARCHAR(100) NULL,
            [BANKO] VARCHAR(50) NULL,
            [MALIYET] FLOAT NOT NULL DEFAULT 0,
            [MALIYET_PARA_KODU] VARCHAR(10) NOT NULL DEFAULT 'USD',
            [KAR_YUZDESI] FLOAT NOT NULL DEFAULT 0,
            [SABITLE] BIT NOT NULL DEFAULT 0,
            [SATIS_FIYATI] FLOAT NOT NULL DEFAULT 0,
            [SATIS_PARA_KODU] VARCHAR(10) NOT NULL DEFAULT 'USD',
            [HIZLI_GIRIS] BIT NOT NULL DEFAULT 0,
            [TAS_CINSI] VARCHAR(50) NULL,
            [TAS_MIKTAR] FLOAT NULL,
            [TAS_BIRIM] VARCHAR(20) NOT NULL DEFAULT 'Ct',
            [TAS_RENK] VARCHAR(20) NULL,
            [TAS_SAFLIK] VARCHAR(20) NULL,
            [TAS_ADET] INT NULL,
            [TAS_TUTAR] FLOAT NULL,
            [TAS_TUTAR_BIRIMI] VARCHAR(10) NOT NULL DEFAULT 'USD',
            [SATILDI] BIT NOT NULL DEFAULT 0,
            [RESIM] VARBINARY(MAX) NULL,
            [YAZDIRILDI] BIT NOT NULL DEFAULT 0,
            [YAZDIRILDI_ZAMANI] DATETIME NULL,
            [EKLEYEN_ID] INT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL,
            CONSTRAINT [UQ_TODVZ_OZEL_URUN_GRUP_NO] UNIQUE ([GRUP_KODU], [URUN_NO])
          );
        END;

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_OZEL_URUN')
        BEGIN
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'YAZDIRILDI')
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ADD [YAZDIRILDI] BIT NOT NULL DEFAULT 0;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'YAZDIRILDI_ZAMANI')
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ADD [YAZDIRILDI_ZAMANI] DATETIME NULL;
        END;
      `);
        }
        catch (err) {
            logger.warn(`[OzelUrunSqlRepository.ensureTables] Warning: ${err.message}`);
        }
    }
    static async ensureProcedures(pool) {
        try {
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_OZEL_URUN_KAYDET]
            @OZEL_URUN_ID       INT OUTPUT,
            @TARIH              DATETIME,
            @GRUP_KODU          VARCHAR(50),
            @URUN_NO            INT,
            @BARKOD             VARCHAR(50) = NULL,
            @MAMUL_TIPI         VARCHAR(50) = NULL,
            @URETICI_FIRMA      VARCHAR(150) = NULL,
            @MIKTAR             FLOAT = 1.00,
            @MIKTAR_BIRIMI      VARCHAR(20) = 'Adet',
            @ORJINAL_KOD        VARCHAR(50) = NULL,
            @AYAR               VARCHAR(20) = NULL,
            @MODEL_OZELLIK_1    VARCHAR(100) = NULL,
            @MODEL_OZELLIK_2    VARCHAR(100) = NULL,
            @BANKO              VARCHAR(50) = NULL,
            @MALIYET            FLOAT = 0,
            @MALIYET_PARA_KODU  VARCHAR(10) = 'USD',
            @KAR_YUZDESI        FLOAT = 0,
            @SABITLE            BIT = 0,
            @SATIS_FIYATI       FLOAT = 0,
            @SATIS_PARA_KODU    VARCHAR(10) = 'USD',
            @HIZLI_GIRIS        BIT = 0,
            @TAS_CINSI          VARCHAR(50) = NULL,
            @TAS_MIKTAR         FLOAT = NULL,
            @TAS_BIRIM          VARCHAR(20) = 'Ct',
            @TAS_RENK           VARCHAR(20) = NULL,
            @TAS_SAFLIK         VARCHAR(20) = NULL,
            @TAS_ADET           INT = NULL,
            @TAS_TUTAR          FLOAT = NULL,
            @TAS_TUTAR_BIRIMI   VARCHAR(10) = 'USD',
            @SATILDI            BIT = 0,
            @RESIM              VARBINARY(MAX) = NULL,
            @KULLANICI_ID       INT = NULL,
            @YENI_KAYIT         BIT OUTPUT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @HATA_MESAJI VARCHAR(500);
            DECLARE @SIMDIKI_ZAMAN DATETIME = GETDATE();

            IF (@OZEL_URUN_ID IS NULL OR @OZEL_URUN_ID = 0)
                SET @YENI_KAYIT = 1;
            ELSE
                SET @YENI_KAYIT = 0;

            IF @YENI_KAYIT = 1 AND EXISTS (SELECT 1 FROM dbo.TODVZ_OZEL_URUN WHERE GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO)
            BEGIN
                SET @HATA_MESAJI = RTRIM(@GRUP_KODU) + ' - ' + CAST(@URUN_NO AS VARCHAR(20)) + ' numaralı özel ürün kodu daha önce kaydedilmiş.';
                GOTO UNDO;
            END
            ELSE IF @YENI_KAYIT = 0 AND EXISTS (SELECT 1 FROM dbo.TODVZ_OZEL_URUN WHERE OZEL_URUN_ID <> @OZEL_URUN_ID AND GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO)
            BEGIN
                SET @HATA_MESAJI = RTRIM(@GRUP_KODU) + ' - ' + CAST(@URUN_NO AS VARCHAR(20)) + ' numaralı özel ürün kodu başka bir kayıtta kullanılıyor.';
                GOTO UNDO;
            END

            BEGIN TRAN;

            IF @YENI_KAYIT = 1
            BEGIN
                INSERT INTO dbo.TODVZ_OZEL_URUN (
                    TARIH, GRUP_KODU, URUN_NO, BARKOD, MAMUL_TIPI, URETICI_FIRMA, MIKTAR, MIKTAR_BIRIMI,
                    ORJINAL_KOD, AYAR, MODEL_OZELLIK_1, MODEL_OZELLIK_2, BANKO, MALIYET, MALIYET_PARA_KODU,
                    KAR_YUZDESI, SABITLE, SATIS_FIYATI, SATIS_PARA_KODU, HIZLI_GIRIS, TAS_CINSI, TAS_MIKTAR,
                    TAS_BIRIM, TAS_RENK, TAS_SAFLIK, TAS_ADET, TAS_TUTAR, TAS_TUTAR_BIRIMI, SATILDI, RESIM,
                    EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
                )
                VALUES (
                    ISNULL(@TARIH, @SIMDIKI_ZAMAN), @GRUP_KODU, @URUN_NO, @BARKOD, @MAMUL_TIPI, @URETICI_FIRMA, @MIKTAR, @MIKTAR_BIRIMI,
                    @ORJINAL_KOD, @AYAR, @MODEL_OZELLIK_1, @MODEL_OZELLIK_2, @BANKO, @MALIYET, @MALIYET_PARA_KODU,
                    @KAR_YUZDESI, @SABITLE, @SATIS_FIYATI, @SATIS_PARA_KODU, @HIZLI_GIRIS, @TAS_CINSI, @TAS_MIKTAR,
                    @TAS_BIRIM, @TAS_RENK, @TAS_SAFLIK, @TAS_ADET, @TAS_TUTAR, @TAS_TUTAR_BIRIMI, @SATILDI, @RESIM,
                    @KULLANICI_ID, @SIMDIKI_ZAMAN, @KULLANICI_ID, @SIMDIKI_ZAMAN
                );

                IF @@ERROR <> 0
                BEGIN
                    SET @HATA_MESAJI = 'Özel ürün kaydı eklenemedi.';
                    GOTO UNDO;
                END

                SET @OZEL_URUN_ID = SCOPE_IDENTITY();
            END
            ELSE
            BEGIN
                UPDATE dbo.TODVZ_OZEL_URUN
                SET TARIH = ISNULL(@TARIH, TARIH), GRUP_KODU = @GRUP_KODU, URUN_NO = @URUN_NO, BARKOD = @BARKOD,
                    MAMUL_TIPI = @MAMUL_TIPI, URETICI_FIRMA = @URETICI_FIRMA, MIKTAR = @MIKTAR, MIKTAR_BIRIMI = @MIKTAR_BIRIMI,
                    ORJINAL_KOD = @ORJINAL_KOD, AYAR = @AYAR, MODEL_OZELLIK_1 = @MODEL_OZELLIK_1, MODEL_OZELLIK_2 = @MODEL_OZELLIK_2,
                    BANKO = @BANKO, MALIYET = @MALIYET, MALIYET_PARA_KODU = @MALIYET_PARA_KODU, KAR_YUZDESI = @KAR_YUZDESI,
                    SABITLE = @SABITLE, SATIS_FIYATI = @SATIS_FIYATI, SATIS_PARA_KODU = @SATIS_PARA_KODU, HIZLI_GIRIS = @HIZLI_GIRIS,
                    TAS_CINSI = @TAS_CINSI, TAS_MIKTAR = @TAS_MIKTAR, TAS_BIRIM = @TAS_BIRIM, TAS_RENK = @TAS_RENK,
                    TAS_SAFLIK = @TAS_SAFLIK, TAS_ADET = @TAS_ADET, TAS_TUTAR = @TAS_TUTAR, TAS_TUTAR_BIRIMI = @TAS_TUTAR_BIRIMI,
                    SATILDI = @SATILDI, RESIM = ISNULL(@RESIM, RESIM), GUNCELLEYEN_ID = @KULLANICI_ID, GUNCELLEME_ZAMANI = @SIMDIKI_ZAMAN
                WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

                IF @@ERROR <> 0
                BEGIN
                    SET @HATA_MESAJI = 'Özel ürün kaydı güncellenemedi.';
                    GOTO UNDO;
                END
            END

            COMMIT TRAN;
            RETURN 0;

        UNDO:
            IF @@TRANCOUNT > 0
                ROLLBACK TRAN;
            RAISERROR (@HATA_MESAJI, 16, 1);
            RETURN 1;
        END;
      `);
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_OZEL_URUN_SIL]
            @OZEL_URUN_ID INT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @HATA_MESAJI VARCHAR(500);

            IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_OZEL_URUN WHERE OZEL_URUN_ID = @OZEL_URUN_ID)
            BEGIN
                SET @HATA_MESAJI = 'Silinmek istenen özel ürün kaydı bulunamadı.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            IF EXISTS (SELECT 1 FROM dbo.TODVZ_OZEL_URUN WHERE OZEL_URUN_ID = @OZEL_URUN_ID AND SATILDI = 1)
            BEGIN
                SET @HATA_MESAJI = 'Satışı yapılmış olan özel ürün silinemez.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            DELETE FROM dbo.TODVZ_OZEL_URUN WHERE OZEL_URUN_ID = @OZEL_URUN_ID;

            IF @@ERROR <> 0
            BEGIN
                SET @HATA_MESAJI = 'Özel ürün kaydı silinirken hata oluştu.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            RETURN 0;
        END;
      `);
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_OZEL_URUN_YAZDIRILDI_ISARETLE]
          @OZEL_URUN_ID INT,
          @YAZDIRILDI BIT,
          @KULLANICI_ID INT = NULL
        AS
        BEGIN
          SET NOCOUNT ON;
          UPDATE dbo.TODVZ_OZEL_URUN
            SET YAZDIRILDI = @YAZDIRILDI,
                YAZDIRILDI_ZAMANI = CASE WHEN @YAZDIRILDI = 1 THEN GETDATE() ELSE NULL END,
                GUNCELLEYEN_ID = @KULLANICI_ID,
                GUNCELLEME_ZAMANI = GETDATE()
            WHERE OZEL_URUN_ID = @OZEL_URUN_ID;
          IF @@ERROR<>0
          BEGIN
            RAISERROR ('Yazdırıldı durumu güncellenemedi.', 16, 1);
            RETURN 1;
          END
          RETURN 0;
        END;
      `);
        }
        catch (e) {
            logger.warn("[OzelUrunSqlRepository.ensureProcedures] Warning:", e.message || e);
        }
    }
    static mapRow(r) {
        return {
            ozelUrunId: r.OZEL_URUN_ID,
            tarih: r.TARIH ? new Date(r.TARIH).toISOString() : new Date().toISOString(),
            grupKodu: (r.GRUP_KODU || "").trim(),
            urunNo: r.URUN_NO,
            barkod: r.BARKOD ? r.BARKOD.trim() : null,
            mamulTipi: r.MAMUL_TIPI ? r.MAMUL_TIPI.trim() : null,
            ureticiFirma: r.URETICI_FIRMA ? r.URETICI_FIRMA.trim() : null,
            miktar: Number(r.MIKTAR) || 0,
            miktarBirimi: (r.MIKTAR_BIRIMI || "Adet").trim(),
            orjinalKod: r.ORJINAL_KOD ? r.ORJINAL_KOD.trim() : null,
            ayar: r.AYAR ? r.AYAR.trim() : null,
            modelOzellik1: r.MODEL_OZELLIK_1 ? r.MODEL_OZELLIK_1.trim() : null,
            modelOzellik2: r.MODEL_OZELLIK_2 ? r.MODEL_OZELLIK_2.trim() : null,
            banko: r.BANKO ? r.BANKO.trim() : null,
            maliyet: Number(r.MALIYET) || 0,
            maliyetParaKodu: (r.MALIYET_PARA_KODU || "USD").trim(),
            karYuzdesi: Number(r.KAR_YUZDESI) || 0,
            sabitle: Boolean(r.SABITLE),
            satisFiyati: Number(r.SATIS_FIYATI) || 0,
            satisParaKodu: (r.SATIS_PARA_KODU || "USD").trim(),
            hizliGiris: Boolean(r.HIZLI_GIRIS),
            tasCinsi: r.TAS_CINSI ? r.TAS_CINSI.trim() : null,
            tasMiktar: r.TAS_MIKTAR !== null && r.TAS_MIKTAR !== undefined ? Number(r.TAS_MIKTAR) : null,
            tasBirim: (r.TAS_BIRIM || "Ct").trim(),
            tasRenk: r.TAS_RENK ? r.TAS_RENK.trim() : null,
            tasSaflik: r.TAS_SAFLIK ? r.TAS_SAFLIK.trim() : null,
            tasAdet: r.TAS_ADET !== null && r.TAS_ADET !== undefined ? Number(r.TAS_ADET) : null,
            tasTutar: r.TAS_TUTAR !== null && r.TAS_TUTAR !== undefined ? Number(r.TAS_TUTAR) : null,
            tasTutarBirimi: (r.TAS_TUTAR_BIRIMI || "USD").trim(),
            resim: r.RESIM ? (Buffer.isBuffer(r.RESIM) ? `data:image/jpeg;base64,${r.RESIM.toString("base64")}` : (typeof r.RESIM === "string" ? r.RESIM : null)) : null,
            satildi: Boolean(r.SATILDI),
            yazdirildi: Boolean(r.YAZDIRILDI),
            yazdirildiZamani: r.YAZDIRILDI_ZAMANI ? new Date(r.YAZDIRILDI_ZAMANI).toISOString() : null,
            ekleyenId: r.EKLEYEN_ID,
            eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : null,
            guncelleyenId: r.GUNCELLEYEN_ID,
            guncellemeZamani: r.GUNCELLEME_ZAMANI ? new Date(r.GUNCELLEME_ZAMANI).toISOString() : null,
        };
    }
    static async list(filter, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        await this.ensureProcedures(pool);
        const topLimit = filter?.limit && filter.limit > 0 ? filter.limit : 500;
        let query = `SELECT TOP (${topLimit}) * FROM TODVZ_OZEL_URUN WHERE 1=1`;
        const req = pool.request();
        if (filter?.grupKodu) {
            query += ` AND GRUP_KODU = @GRUP_KODU`;
            req.input("GRUP_KODU", sql.VarChar(50), filter.grupKodu.trim().toUpperCase());
        }
        if (filter?.ureticiFirma) {
            query += ` AND URETICI_FIRMA = @URETICI_FIRMA`;
            req.input("URETICI_FIRMA", sql.VarChar(150), filter.ureticiFirma.trim());
        }
        if (filter?.baslangicTarihi) {
            query += ` AND TARIH >= @BASLANGIC`;
            req.input("BASLANGIC", sql.DateTime, new Date(filter.baslangicTarihi));
        }
        if (filter?.bitisTarihi) {
            query += ` AND TARIH <= @BITIS`;
            req.input("BITIS", sql.DateTime, new Date(filter.bitisTarihi));
        }
        if (filter?.yazdirildi !== undefined) {
            query += ` AND YAZDIRILDI = @YAZDIRILDI`;
            req.input("YAZDIRILDI", sql.Bit, filter.yazdirildi ? 1 : 0);
        }
        if (filter?.satildi !== undefined) {
            query += ` AND SATILDI = @SATILDI`;
            req.input("SATILDI", sql.Bit, filter.satildi ? 1 : 0);
        }
        if (filter?.search && filter.search.trim()) {
            query += ` AND (GRUP_KODU LIKE @SEARCH OR BARKOD LIKE @SEARCH OR MAMUL_TIPI LIKE @SEARCH OR ORJINAL_KOD LIKE @SEARCH OR URETICI_FIRMA LIKE @SEARCH OR TAS_CINSI LIKE @SEARCH)`;
            req.input("SEARCH", sql.VarChar(150), `%${filter.search.trim()}%`);
        }
        query += ` ORDER BY OZEL_URUN_ID DESC`;
        const res = await req.query(query);
        return (res.recordset || []).map((r) => this.mapRow(r));
    }
    static async getById(ozelUrunId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        await this.ensureProcedures(pool);
        const res = await pool
            .request()
            .input("OZEL_URUN_ID", sql.Int, ozelUrunId)
            .query(`SELECT TOP 1 * FROM TODVZ_OZEL_URUN WHERE OZEL_URUN_ID = @OZEL_URUN_ID`);
        if (!res.recordset || res.recordset.length === 0)
            return null;
        return this.mapRow(res.recordset[0]);
    }
    static async getByBarkod(barkod, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        await this.ensureProcedures(pool);
        const res = await pool
            .request()
            .input("BARKOD", sql.VarChar(50), barkod.trim())
            .query(`SELECT TOP 1 * FROM TODVZ_OZEL_URUN WHERE BARKOD = @BARKOD`);
        if (!res.recordset || res.recordset.length === 0)
            return null;
        return this.mapRow(res.recordset[0]);
    }
    static async save(dto, kullaniciId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        await this.ensureProcedures(pool);
        let resimBuffer = null;
        if (dto.resim && typeof dto.resim === "string") {
            const matches = dto.resim.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches[2]) {
                resimBuffer = Buffer.from(matches[2], "base64");
            }
            else {
                try {
                    resimBuffer = Buffer.from(dto.resim, "base64");
                }
                catch {
                    resimBuffer = null;
                }
            }
        }
        const targetId = dto.ozelUrunId && Number(dto.ozelUrunId) > 0 ? Number(dto.ozelUrunId) : null;
        const req = pool.request();
        req.output("OZEL_URUN_ID", sql.Int, targetId);
        req.input("TARIH", sql.DateTime, dto.tarih ? new Date(dto.tarih) : new Date());
        req.input("GRUP_KODU", sql.VarChar(50), (dto.grupKodu || "").trim().toUpperCase());
        req.input("URUN_NO", sql.Int, Number(dto.urunNo));
        req.input("BARKOD", sql.VarChar(50), dto.barkod ? dto.barkod.trim() : null);
        req.input("MAMUL_TIPI", sql.VarChar(50), dto.mamulTipi ? dto.mamulTipi.trim() : null);
        req.input("URETICI_FIRMA", sql.VarChar(150), dto.ureticiFirma ? dto.ureticiFirma.trim() : null);
        req.input("MIKTAR", sql.Float, dto.miktar !== undefined ? Number(dto.miktar) : 1);
        req.input("MIKTAR_BIRIMI", sql.VarChar(20), dto.miktarBirimi || "Adet");
        req.input("ORJINAL_KOD", sql.VarChar(50), dto.orjinalKod ? dto.orjinalKod.trim() : null);
        req.input("AYAR", sql.VarChar(20), dto.ayar ? dto.ayar.trim() : null);
        req.input("MODEL_OZELLIK_1", sql.VarChar(100), dto.modelOzellik1 ? dto.modelOzellik1.trim() : null);
        req.input("MODEL_OZELLIK_2", sql.VarChar(100), dto.modelOzellik2 ? dto.modelOzellik2.trim() : null);
        req.input("BANKO", sql.VarChar(50), dto.banko ? dto.banko.trim() : null);
        req.input("MALIYET", sql.Float, Number(dto.maliyet) || 0);
        req.input("MALIYET_PARA_KODU", sql.VarChar(10), dto.maliyetParaKodu || "USD");
        req.input("KAR_YUZDESI", sql.Float, Number(dto.karYuzdesi) || 0);
        req.input("SABITLE", sql.Bit, dto.sabitle ? 1 : 0);
        req.input("SATIS_FIYATI", sql.Float, Number(dto.satisFiyati) || 0);
        req.input("SATIS_PARA_KODU", sql.VarChar(10), dto.satisParaKodu || "USD");
        req.input("HIZLI_GIRIS", sql.Bit, dto.hizliGiris ? 1 : 0);
        req.input("TAS_CINSI", sql.VarChar(50), dto.tasCinsi ? dto.tasCinsi.trim() : null);
        req.input("TAS_MIKTAR", sql.Float, dto.tasMiktar ?? null);
        req.input("TAS_BIRIM", sql.VarChar(20), dto.tasBirim || "Ct");
        req.input("TAS_RENK", sql.VarChar(20), dto.tasRenk ? dto.tasRenk.trim() : null);
        req.input("TAS_SAFLIK", sql.VarChar(20), dto.tasSaflik ? dto.tasSaflik.trim() : null);
        req.input("TAS_ADET", sql.Int, dto.tasAdet ?? null);
        req.input("TAS_TUTAR", sql.Float, dto.tasTutar ?? null);
        req.input("TAS_TUTAR_BIRIMI", sql.VarChar(10), dto.tasTutarBirimi || "USD");
        req.input("SATILDI", sql.Bit, dto.satildi ? 1 : 0);
        req.input("RESIM", sql.VarBinary(sql.MAX), resimBuffer);
        req.input("KULLANICI_ID", sql.Int, kullaniciId || null);
        req.output("YENI_KAYIT", sql.Bit);
        let result = null;
        try {
            result = await req.execute("SODVZ_OZEL_URUN_KAYDET");
        }
        catch (err) {
            logger.error("[OzelUrunSqlRepository.save] Error:", err);
            throw ApiError.badRequest(err.message || "Özel ürün kaydedilemedi.");
        }
        let savedId = Number(result?.output?.OZEL_URUN_ID) || Number(req.parameters.OZEL_URUN_ID?.value) || targetId;
        if (!savedId) {
            const lookup = await pool.request()
                .input("GRUP_KODU", sql.VarChar(50), (dto.grupKodu || "").trim().toUpperCase())
                .input("URUN_NO", sql.Int, Number(dto.urunNo))
                .query("SELECT TOP 1 OZEL_URUN_ID FROM dbo.TODVZ_OZEL_URUN WHERE GRUP_KODU = @GRUP_KODU AND URUN_NO = @URUN_NO ORDER BY OZEL_URUN_ID DESC");
            if (lookup.recordset && lookup.recordset.length > 0) {
                savedId = Number(lookup.recordset[0].OZEL_URUN_ID);
            }
        }
        if (!savedId)
            throw ApiError.internal("Özel ürün kaydedildi ancak kimlik bilgisi alınamadı.");
        const saved = await this.getById(savedId, dbContext);
        if (!saved)
            throw ApiError.internal("Özel ürün kaydedildi ancak okunamadı.");
        return saved;
    }
    static async remove(ozelUrunId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        await this.ensureProcedures(pool);
        try {
            const req = pool.request();
            req.input("OZEL_URUN_ID", sql.Int, ozelUrunId);
            await req.execute("SODVZ_OZEL_URUN_SIL");
            return true;
        }
        catch (err) {
            logger.error(`[OzelUrunSqlRepository.remove(${ozelUrunId})] Error:`, err);
            throw ApiError.badRequest(err.message || "Özel ürün silinemedi.");
        }
    }
    static async markYazdirildi(ids, yazdirildi, kullaniciId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        await this.ensureProcedures(pool);
        for (const id of ids) {
            const req = pool.request();
            req.input("OZEL_URUN_ID", sql.Int, id);
            req.input("YAZDIRILDI", sql.Bit, yazdirildi ? 1 : 0);
            req.input("KULLANICI_ID", sql.Int, kullaniciId || null);
            await req.execute("SODVZ_OZEL_URUN_YAZDIRILDI_ISARETLE");
        }
    }
    static async getNextUrunNo(grupKodu, uzunluk = 5, dbContext) {
        return EtiketNumeratorSqlRepository.getNextNo(1, grupKodu, uzunluk, dbContext);
    }
    static async getDistinctGrupKodlari(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const res = await pool.request().query(`SELECT DISTINCT GRUP_KODU FROM TODVZ_OZEL_URUN ORDER BY GRUP_KODU ASC`);
        return (res.recordset || []).map((r) => (r.GRUP_KODU || "").trim()).filter(Boolean);
    }
    static async getDistinctUreticiFirmalar(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const res = await pool.request().query(`SELECT DISTINCT URETICI_FIRMA FROM TODVZ_OZEL_URUN WHERE URETICI_FIRMA IS NOT NULL AND URETICI_FIRMA <> '' ORDER BY URETICI_FIRMA ASC`);
        return (res.recordset || []).map((r) => (r.URETICI_FIRMA || "").trim()).filter(Boolean);
    }
}
