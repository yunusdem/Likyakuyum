import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
export class MenuSqlRepository {
    static ensuredPools = new WeakSet();
    static async ensureTablesAndProcs(pool) {
        if (this.ensuredPools.has(pool))
            return;
        try {
            // 1. TODVZ_MENU Tablosu
            await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_MENU')
        BEGIN
          CREATE TABLE [dbo].[TODVZ_MENU] (
            [MENU_ID]           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [MENU_KODU]         VARCHAR(50) NULL,
            [MENU_ADI]          VARCHAR(250) NOT NULL,
            [ACIKLAMA]          VARCHAR(500) NULL,
            [SIRA_NO]           INT NOT NULL DEFAULT 0,
            [AKTIF]             BIT NOT NULL DEFAULT 1,
            [EKLEYEN_ID]        INT NULL,
            [EKLEME_ZAMANI]     DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID]    INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN')
        BEGIN
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_ALTIN_URUN' AND COLUMN_NAME = 'MENU_ID')
          BEGIN
            ALTER TABLE [dbo].[TODVZ_ALTIN_URUN] ADD [MENU_ID] INT NULL;
          END;
        END;

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_OZEL_URUN')
        BEGIN
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_OZEL_URUN' AND COLUMN_NAME = 'MENU_ID')
          BEGIN
            ALTER TABLE [dbo].[TODVZ_OZEL_URUN] ADD [MENU_ID] INT NULL;
          END;
        END;
      `);
            // 2. SODVZ_MENU_KAYIT
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_MENU_KAYIT]
            @MENU_ID           INT = NULL OUTPUT,
            @MENU_KODU         VARCHAR(50) = NULL,
            @MENU_ADI          VARCHAR(250),
            @ACIKLAMA          VARCHAR(500) = NULL,
            @SIRA_NO           INT = 0,
            @AKTIF             BIT = 1,
            @KULLANICI_ID      INT = NULL
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @SIMDIKI_ZAMAN DATETIME = GETDATE();

            IF (@MENU_ID IS NULL OR @MENU_ID = 0)
            BEGIN
                INSERT INTO dbo.TODVZ_MENU (
                    MENU_KODU, MENU_ADI, ACIKLAMA, SIRA_NO, AKTIF,
                    EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
                )
                VALUES (
                    @MENU_KODU, @MENU_ADI, @ACIKLAMA, ISNULL(@SIRA_NO, 0), ISNULL(@AKTIF, 1),
                    @KULLANICI_ID, @SIMDIKI_ZAMAN, @KULLANICI_ID, @SIMDIKI_ZAMAN
                );
                SET @MENU_ID = SCOPE_IDENTITY();
            END
            ELSE
            BEGIN
                UPDATE dbo.TODVZ_MENU
                SET MENU_KODU = @MENU_KODU,
                    MENU_ADI = @MENU_ADI,
                    ACIKLAMA = @ACIKLAMA,
                    SIRA_NO = ISNULL(@SIRA_NO, SIRA_NO),
                    AKTIF = ISNULL(@AKTIF, AKTIF),
                    GUNCELLEYEN_ID = @KULLANICI_ID,
                    GUNCELLEME_ZAMANI = @SIMDIKI_ZAMAN
                WHERE MENU_ID = @MENU_ID;
            END

            RETURN 0;
        END;
      `);
            // 3. SODVZ_MENU_SIL
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_MENU_SIL]
            @MENU_ID INT
        AS
        BEGIN
            SET NOCOUNT ON;

            UPDATE dbo.TODVZ_ALTIN_URUN SET MENU_ID = NULL WHERE MENU_ID = @MENU_ID;
            UPDATE dbo.TODVZ_OZEL_URUN SET MENU_ID = NULL WHERE MENU_ID = @MENU_ID;

            DELETE FROM dbo.TODVZ_MENU WHERE MENU_ID = @MENU_ID;

            RETURN 0;
        END;
      `);
            // 4. SODVZ_MENU_LISTE
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_MENU_LISTE]
            @AKTIF_FILTRE BIT = NULL
        AS
        BEGIN
            SET NOCOUNT ON;

            SELECT 
                m.MENU_ID,
                m.MENU_KODU,
                m.MENU_ADI,
                m.ACIKLAMA,
                m.SIRA_NO,
                m.AKTIF,
                m.EKLEME_ZAMANI,
                m.GUNCELLEME_ZAMANI,
                (
                    (SELECT COUNT(*) FROM dbo.TODVZ_ALTIN_URUN a WHERE a.MENU_ID = m.MENU_ID AND a.KATALOG = 1) +
                    (SELECT COUNT(*) FROM dbo.TODVZ_OZEL_URUN o WHERE o.MENU_ID = m.MENU_ID AND o.KATALOG = 1)
                ) AS URUN_SAYISI
            FROM dbo.TODVZ_MENU m
            WHERE (@AKTIF_FILTRE IS NULL OR m.AKTIF = @AKTIF_FILTRE)
            ORDER BY m.SIRA_NO ASC, m.MENU_ADI ASC;

            RETURN 0;
        END;
      `);
            // 5. SODVZ_MENU_KATALOG_URUNLERI
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE [dbo].[SODVZ_MENU_KATALOG_URUNLERI]
            @MENU_ID INT = NULL
        AS
        BEGIN
            SET NOCOUNT ON;

            SELECT 
                'altin' AS URUN_TIPI,
                a.ALTIN_URUN_ID AS URUN_ID,
                a.BARKOD,
                a.GRUP_KODU,
                a.URUN_NO,
                a.AYAR,
                a.MODEL,
                a.URETICI_FIRMA,
                a.MIKTAR,
                'Gr' AS MIKTAR_BIRIMI,
                a.SATIS_FIYATI,
                a.SATIS_PARA_KODU,
                a.MENU_ID,
                m.MENU_ADI,
                a.KATALOG,
                a.KONSINYE,
                a.SATILDI,
                a.EKLEME_ZAMANI,
                (
                    SELECT r.RESIM_ID, r.DOSYA_YOLU, r.DOSYA_ADI, r.RESIM_DATA
                    FROM dbo.TODVZ_URUN_RESIM r
                    WHERE r.TIP = 0 AND r.ISLEM_ID = a.ALTIN_URUN_ID
                    ORDER BY r.RESIM_ID ASC
                    FOR JSON PATH
                ) AS RESIMLER_JSON
            FROM dbo.TODVZ_ALTIN_URUN a
            LEFT JOIN dbo.TODVZ_MENU m ON a.MENU_ID = m.MENU_ID
            WHERE a.KATALOG = 1 AND a.SATILDI = 0
              AND (@MENU_ID IS NULL OR @MENU_ID = 0 OR a.MENU_ID = @MENU_ID)

            UNION ALL

            SELECT 
                'ozel' AS URUN_TIPI,
                o.OZEL_URUN_ID AS URUN_ID,
                o.BARKOD,
                o.GRUP_KODU,
                o.URUN_NO,
                o.AYAR,
                COALESCE(o.MODEL_OZELLIK_1, o.MODEL_OZELLIK_2, o.MAMUL_TIPI) AS MODEL,
                o.URETICI_FIRMA,
                o.MIKTAR,
                ISNULL(o.MIKTAR_BIRIMI, 'Adet') AS MIKTAR_BIRIMI,
                o.SATIS_FIYATI,
                o.SATIS_PARA_KODU,
                o.MENU_ID,
                m.MENU_ADI,
                o.KATALOG,
                o.KONSINYE,
                o.SATILDI,
                o.EKLEME_ZAMANI,
                (
                    SELECT r.RESIM_ID, r.DOSYA_YOLU, r.DOSYA_ADI, r.RESIM_DATA
                    FROM dbo.TODVZ_URUN_RESIM r
                    WHERE r.TIP = 1 AND r.ISLEM_ID = o.OZEL_URUN_ID
                    ORDER BY r.RESIM_ID ASC
                    FOR JSON PATH
                ) AS RESIMLER_JSON
            FROM dbo.TODVZ_OZEL_URUN o
            LEFT JOIN dbo.TODVZ_MENU m ON o.MENU_ID = m.MENU_ID
            WHERE o.KATALOG = 1 AND o.SATILDI = 0
              AND (@MENU_ID IS NULL OR @MENU_ID = 0 OR o.MENU_ID = @MENU_ID)

            ORDER BY EKLEME_ZAMANI DESC;

            RETURN 0;
        END;
      `);
            // 6. Seed defaults if empty
            await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_MENU)
        BEGIN
          INSERT INTO dbo.TODVZ_MENU (MENU_ADI, ACIKLAMA, SIRA_NO, AKTIF)
          VALUES 
            ('Vitrin Menüsü', 'Mağaza vitrini ve TV ekranı için seçkin ürünler', 1, 1),
            ('Yeni Sezon Koleksiyonu', 'Yeni gelen tasarım altın ve pırlanta ürünleri', 2, 1),
            ('Özel Tasarımlar', 'Sipariş ve özel atölye serisi', 3, 1);
        END;
      `);
            this.ensuredPools.add(pool);
        }
        catch (err) {
            logger.warn("[MenuSqlRepository.ensureTablesAndProcs] Warning: " + (err.message || err));
        }
    }
    static async listMenus(aktifFiltre, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTablesAndProcs(pool);
        const req = pool.request();
        if (aktifFiltre !== undefined) {
            req.input("AKTIF_FILTRE", sql.Bit, aktifFiltre ? 1 : 0);
        }
        else {
            req.input("AKTIF_FILTRE", sql.Bit, null);
        }
        const result = await req.execute("dbo.SODVZ_MENU_LISTE");
        return (result.recordset || []).map((r) => ({
            menuId: r.MENU_ID,
            menuKodu: r.MENU_KODU ? String(r.MENU_KODU).trim() : null,
            menuAdi: String(r.MENU_ADI || "").trim(),
            aciklama: r.ACIKLAMA ? String(r.ACIKLAMA).trim() : null,
            siraNo: Number(r.SIRA_NO) || 0,
            aktif: Boolean(r.AKTIF),
            eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : undefined,
            guncellemeZamani: r.GUNCELLEME_ZAMANI ? new Date(r.GUNCELLEME_ZAMANI).toISOString() : null,
            urunSayisi: Number(r.URUN_SAYISI) || 0,
        }));
    }
    static async saveMenu(dto, dbContext) {
        if (!dto.menuAdi || !dto.menuAdi.trim()) {
            throw ApiError.badRequest("Menü adı zorunludur.");
        }
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTablesAndProcs(pool);
        const req = pool.request();
        req.output("MENU_ID", sql.Int);
        req.input("MENU_ID", sql.Int, dto.menuId && dto.menuId > 0 ? dto.menuId : null);
        req.input("MENU_KODU", sql.VarChar(50), dto.menuKodu ? dto.menuKodu.trim() : null);
        req.input("MENU_ADI", sql.VarChar(250), dto.menuAdi.trim());
        req.input("ACIKLAMA", sql.VarChar(500), dto.aciklama ? dto.aciklama.trim() : null);
        req.input("SIRA_NO", sql.Int, dto.siraNo !== undefined ? Number(dto.siraNo) : 0);
        req.input("AKTIF", sql.Bit, dto.aktif !== false ? 1 : 0);
        req.input("KULLANICI_ID", sql.Int, dto.kullaniciId || null);
        const res = await req.execute("dbo.SODVZ_MENU_KAYIT");
        const menuId = res.output.MENU_ID || dto.menuId;
        return {
            menuId,
            menuKodu: dto.menuKodu ? dto.menuKodu.trim() : null,
            menuAdi: dto.menuAdi.trim(),
            aciklama: dto.aciklama ? dto.aciklama.trim() : null,
            siraNo: dto.siraNo || 0,
            aktif: dto.aktif !== false,
        };
    }
    static async deleteMenu(menuId, dbContext) {
        if (!menuId || menuId <= 0) {
            throw ApiError.badRequest("Geçersiz menü ID.");
        }
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTablesAndProcs(pool);
        const req = pool.request();
        req.input("MENU_ID", sql.Int, menuId);
        await req.execute("dbo.SODVZ_MENU_SIL");
        return true;
    }
    static async getKatalogUrunleri(menuId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTablesAndProcs(pool);
        const req = pool.request();
        req.input("MENU_ID", sql.Int, menuId && menuId > 0 ? menuId : null);
        const result = await req.execute("dbo.SODVZ_MENU_KATALOG_URUNLERI");
        return (result.recordset || []).map((r) => {
            let resimler = [];
            if (r.RESIMLER_JSON) {
                try {
                    resimler = JSON.parse(r.RESIMLER_JSON);
                }
                catch {
                    resimler = [];
                }
            }
            return {
                urunTipi: r.URUN_TIPI === "ozel" ? "ozel" : "altin",
                urunId: Number(r.URUN_ID),
                barkod: r.BARKOD ? String(r.BARKOD).trim() : null,
                grupKodu: String(r.GRUP_KODU || "").trim(),
                urunNo: Number(r.URUN_NO),
                ayar: r.AYAR ? String(r.AYAR).trim() : null,
                model: r.MODEL ? String(r.MODEL).trim() : null,
                ureticiFirma: r.URETICI_FIRMA ? String(r.URETICI_FIRMA).trim() : null,
                miktar: Number(r.MIKTAR) || 0,
                miktarBirimi: String(r.MIKTAR_BIRIMI || (r.URUN_TIPI === "ozel" ? "Adet" : "Gr")).trim(),
                satisFiyati: Number(r.SATIS_FIYATI) || 0,
                satisParaKodu: String(r.SATIS_PARA_KODU || "TL").trim(),
                menuId: r.MENU_ID !== null && r.MENU_ID !== undefined ? Number(r.MENU_ID) : null,
                menuAdi: r.MENU_ADI ? String(r.MENU_ADI).trim() : null,
                katalog: Boolean(r.KATALOG),
                konsinye: Boolean(r.KONSINYE),
                satildi: Boolean(r.SATILDI),
                eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : new Date().toISOString(),
                resimler: resimler.map((img) => ({
                    resimId: Number(img.RESIM_ID || img.resimId),
                    dosyaYolu: String(img.DOSYA_YOLU || img.dosyaYolu || ""),
                    dosyaAdi: String(img.DOSYA_ADI || img.dosyaAdi || "urun.jpg"),
                    resimData: img.RESIM_DATA || img.resimData || null,
                })),
            };
        });
    }
}
