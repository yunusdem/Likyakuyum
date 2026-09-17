import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
export class AyarSqlRepository {
    static isInitialized = false;
    /**
     * Ensures TODVZ_AYAR table, default records, and stored procedures exist in database
     */
    static async ensureSchema(pool) {
        if (this.isInitialized)
            return;
        try {
            // 1. TODVZ_AYAR Table Creation & Seed Data
            await pool.request().query(`
        IF OBJECT_ID('dbo.TODVZ_AYAR', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.TODVZ_AYAR (
                AYAR_ID           INT IDENTITY(1,1) NOT NULL,
                AYAR_KODU         VARCHAR(20)       NOT NULL,
                AYAR_ADI          VARCHAR(100)      NOT NULL,
                MILYEM            DECIMAL(8, 5)     NOT NULL,
                STANDART_AYAR     INT               NOT NULL,
                SIRA_NO           INT               NOT NULL DEFAULT (0),
                VARSAYILAN        BIT               NOT NULL DEFAULT (0),
                AKTIF             BIT               NOT NULL DEFAULT (1),
                ACIKLAMA          VARCHAR(250)      NULL,
                EKLEYEN_ID        INT               NULL,
                EKLEME_ZAMANI     DATETIME          NOT NULL DEFAULT (GETDATE()),
                GUNCELLEYEN_ID    INT               NULL,
                GUNCELLEME_ZAMANI DATETIME          NULL,

                CONSTRAINT PK_TODVZ_AYAR PRIMARY KEY CLUSTERED (AYAR_ID),
                CONSTRAINT UK_TODVZ_AYAR_KOD UNIQUE NONCLUSTERED (AYAR_KODU)
            );
        END;

        -- Varsayılan Kuyumculuk Ayar ve Milyem Verileri
        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_AYAR WHERE AYAR_KODU = '24')
            INSERT INTO dbo.TODVZ_AYAR (AYAR_KODU, AYAR_ADI, MILYEM, STANDART_AYAR, SIRA_NO, VARSAYILAN) 
            VALUES ('24', '24 Ayar (Has)', 1.00000, 24, 1, 0);

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_AYAR WHERE AYAR_KODU = '22 FANTAZI')
            INSERT INTO dbo.TODVZ_AYAR (AYAR_KODU, AYAR_ADI, MILYEM, STANDART_AYAR, SIRA_NO, VARSAYILAN) 
            VALUES ('22 FANTAZI', '22 Ayar Fantazi', 0.91600, 22, 2, 1);

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_AYAR WHERE AYAR_KODU = '22')
            INSERT INTO dbo.TODVZ_AYAR (AYAR_KODU, AYAR_ADI, MILYEM, STANDART_AYAR, SIRA_NO, VARSAYILAN) 
            VALUES ('22', '22 Ayar Bilezik', 0.91600, 22, 3, 0);

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_AYAR WHERE AYAR_KODU = '18')
            INSERT INTO dbo.TODVZ_AYAR (AYAR_KODU, AYAR_ADI, MILYEM, STANDART_AYAR, SIRA_NO, VARSAYILAN) 
            VALUES ('18', '18 Ayar', 0.75000, 18, 4, 0);

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_AYAR WHERE AYAR_KODU = '14')
            INSERT INTO dbo.TODVZ_AYAR (AYAR_KODU, AYAR_ADI, MILYEM, STANDART_AYAR, SIRA_NO, VARSAYILAN) 
            VALUES ('14', '14 Ayar', 0.58500, 14, 5, 0);

        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_AYAR WHERE AYAR_KODU = '8')
            INSERT INTO dbo.TODVZ_AYAR (AYAR_KODU, AYAR_ADI, MILYEM, STANDART_AYAR, SIRA_NO, VARSAYILAN) 
            VALUES ('8', '8 Ayar', 0.33300, 8, 6, 0);
      `);
            // 2. Stored Procedure: SODVZ_AYAR_LISTELE
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_AYAR_LISTELE
            @SADECE_AKTIF BIT = 1
        AS
        BEGIN
            SET NOCOUNT ON;

            SELECT 
                AYAR_ID,
                AYAR_KODU,
                AYAR_ADI,
                MILYEM,
                STANDART_AYAR,
                SIRA_NO,
                VARSAYILAN,
                AKTIF,
                ACIKLAMA
            FROM dbo.TODVZ_AYAR
            WHERE (@SADECE_AKTIF = 0 OR AKTIF = 1)
            ORDER BY SIRA_NO ASC, AYAR_ID ASC;
        END;
      `);
            // 3. Stored Procedure: SODVZ_AYAR_KAYDET
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_AYAR_KAYDET
            @AYAR_ID          INT OUTPUT,
            @AYAR_KODU        VARCHAR(20),
            @AYAR_ADI         VARCHAR(100),
            @MILYEM           DECIMAL(8, 5),
            @STANDART_AYAR    INT = NULL,
            @SIRA_NO          INT = 0,
            @VARSAYILAN       BIT = 0,
            @AKTIF            BIT = 1,
            @ACIKLAMA         VARCHAR(250) = NULL,
            @KULLANICI_ID     INT = NULL,
            @YENI_KAYIT       BIT = 0 OUTPUT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @HATA_MESAJI VARCHAR(500);
            DECLARE @SIMDIKI_ZAMAN DATETIME = GETDATE();

            SET @AYAR_KODU = UPPER(LTRIM(RTRIM(@AYAR_KODU)));

            IF (@AYAR_KODU IS NULL OR @AYAR_KODU = '')
            BEGIN
                RAISERROR ('Ayar kodu boş geçilemez.', 16, 1);
                RETURN 1;
            END

            IF (@MILYEM IS NULL OR @MILYEM <= 0 OR @MILYEM > 1.00000)
            BEGIN
                RAISERROR ('Milyem değeri 0 ile 1.00000 arasında geçerli bir değer olmalıdır (Örn: 0.58500).', 16, 1);
                RETURN 1;
            END

            IF (@STANDART_AYAR IS NULL OR @STANDART_AYAR = 0)
            BEGIN
                SET @STANDART_AYAR = TRY_CAST(LEFT(@AYAR_KODU, 2) AS INT);
                IF @STANDART_AYAR IS NULL
                    SET @STANDART_AYAR = CAST(ROUND(@MILYEM * 24, 0) AS INT);
            END

            IF (@AYAR_ID IS NULL OR @AYAR_ID = 0)
                SET @YENI_KAYIT = 1;
            ELSE
                SET @YENI_KAYIT = 0;

            -- Mükerrer Kontrolü
            IF @YENI_KAYIT = 1 AND EXISTS (SELECT 1 FROM dbo.TODVZ_AYAR WHERE AYAR_KODU = @AYAR_KODU)
            BEGIN
                SET @HATA_MESAJI = RTRIM(@AYAR_KODU) + ' ayar kodu zaten sistemde kayıtlı.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            IF @YENI_KAYIT = 0 AND EXISTS (SELECT 1 FROM dbo.TODVZ_AYAR WHERE AYAR_KODU = @AYAR_KODU AND AYAR_ID <> @AYAR_ID)
            BEGIN
                SET @HATA_MESAJI = RTRIM(@AYAR_KODU) + ' ayar kodu başka bir ayar tanımında kullanılıyor.';
                RAISERROR (@HATA_MESAJI, 16, 1);
                RETURN 1;
            END

            BEGIN TRAN;

            -- Eğer bu ayar varsayılan yapıldıysa diğer kayıtların varsayılan durumunu sıfırla
            IF @VARSAYILAN = 1
            BEGIN
                UPDATE dbo.TODVZ_AYAR 
                SET VARSAYILAN = 0 
                WHERE AYAR_ID <> ISNULL(@AYAR_ID, 0);
            END

            IF @YENI_KAYIT = 1
            BEGIN
                INSERT INTO dbo.TODVZ_AYAR (
                    AYAR_KODU,
                    AYAR_ADI,
                    MILYEM,
                    STANDART_AYAR,
                    SIRA_NO,
                    VARSAYILAN,
                    AKTIF,
                    ACIKLAMA,
                    EKLEYEN_ID,
                    EKLEME_ZAMANI,
                    GUNCELLEYEN_ID,
                    GUNCELLEME_ZAMANI
                )
                VALUES (
                    @AYAR_KODU,
                    @AYAR_ADI,
                    @MILYEM,
                    @STANDART_AYAR,
                    @SIRA_NO,
                    @VARSAYILAN,
                    @AKTIF,
                    @ACIKLAMA,
                    @KULLANICI_ID,
                    @SIMDIKI_ZAMAN,
                    @KULLANICI_ID,
                    @SIMDIKI_ZAMAN
                );

                IF @@ERROR <> 0
                BEGIN
                    ROLLBACK TRAN;
                    RAISERROR ('Ayar tanımı kaydedilemedi.', 16, 1);
                    RETURN 1;
                END

                SET @AYAR_ID = SCOPE_IDENTITY();
            END
            ELSE
            BEGIN
                UPDATE dbo.TODVZ_AYAR
                SET AYAR_KODU         = @AYAR_KODU,
                    AYAR_ADI          = @AYAR_ADI,
                    MILYEM            = @MILYEM,
                    STANDART_AYAR     = @STANDART_AYAR,
                    SIRA_NO           = @SIRA_NO,
                    VARSAYILAN        = @VARSAYILAN,
                    AKTIF             = @AKTIF,
                    ACIKLAMA          = @ACIKLAMA,
                    GUNCELLEYEN_ID    = @KULLANICI_ID,
                    GUNCELLEME_ZAMANI = @SIMDIKI_ZAMAN
                WHERE AYAR_ID = @AYAR_ID;

                IF @@ERROR <> 0
                BEGIN
                    ROLLBACK TRAN;
                    RAISERROR ('Ayar tanımı güncellenemedi.', 16, 1);
                    RETURN 1;
                END
            END

            COMMIT TRAN;
            RETURN 0;
        END;
      `);
            // 4. Stored Procedure: SODVZ_AYAR_SIL
            await pool.request().query(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_AYAR_SIL
            @AYAR_ID INT
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @AYAR_KODU VARCHAR(20);

            SELECT @AYAR_KODU = AYAR_KODU 
            FROM dbo.TODVZ_AYAR 
            WHERE AYAR_ID = @AYAR_ID;

            IF @AYAR_KODU IS NULL
            BEGIN
                RAISERROR ('Silinmek istenen ayar tanımı bulunamadı.', 16, 1);
                RETURN 1;
            END

            -- Stok veya hareketlerde kullanılıyor mu kontrolü
            IF (OBJECT_ID('dbo.TODVZ_ALTIN_URUN', 'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.TODVZ_ALTIN_URUN WHERE AYAR = @AYAR_KODU))
               OR (OBJECT_ID('dbo.TODVZ_OZEL_URUN', 'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.TODVZ_OZEL_URUN WHERE AYAR = @AYAR_KODU))
            BEGIN
                RAISERROR ('Bu ayar koduna ait kayıtlı altın veya özel ürün stokları bulunduğundan silinemez.', 16, 1);
                RETURN 1;
            END

            DELETE FROM dbo.TODVZ_AYAR WHERE AYAR_ID = @AYAR_ID;
            RETURN 0;
        END;
      `);
            this.isInitialized = true;
            logger.info("TODVZ_AYAR schema and procedures initialized successfully.");
        }
        catch (err) {
            logger.error("Error initializing TODVZ_AYAR schema:", err);
        }
    }
    /**
     * Lists ayarlar using SODVZ_AYAR_LISTELE procedure
     */
    static async listAyarlar(sadeceAktif = false, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await this.ensureSchema(pool);
            const request = pool.request();
            request.input("SADECE_AKTIF", sql.Bit, sadeceAktif ? 1 : 0);
            const result = await request.execute("SODVZ_AYAR_LISTELE");
            const rows = result.recordset || [];
            return rows.map((r) => ({
                ayarId: r.AYAR_ID,
                ayarKodu: (r.AYAR_KODU || "").trim(),
                ayarAdi: (r.AYAR_ADI || "").trim(),
                milyem: Number(r.MILYEM) || 0,
                standartAyar: Number(r.STANDART_AYAR) || 0,
                siraNo: Number(r.SIRA_NO) || 0,
                varsayilan: Boolean(r.VARSAYILAN),
                aktif: Boolean(r.AKTIF),
                aciklama: r.ACIKLAMA || null,
            }));
        }
        catch (error) {
            logger.error("Error listing ayarlar:", error);
            throw ApiError.internal(`Ayar tanımları listelenirken hata oluştu: ${error.message}`);
        }
    }
    /**
     * Gets single ayar by ID
     */
    static async getAyarById(ayarId, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await this.ensureSchema(pool);
            const result = await pool
                .request()
                .input("AYAR_ID", sql.Int, ayarId)
                .query("SELECT * FROM dbo.TODVZ_AYAR WHERE AYAR_ID = @AYAR_ID");
            if (!result.recordset || result.recordset.length === 0) {
                return null;
            }
            const r = result.recordset[0];
            return {
                ayarId: r.AYAR_ID,
                ayarKodu: (r.AYAR_KODU || "").trim(),
                ayarAdi: (r.AYAR_ADI || "").trim(),
                milyem: Number(r.MILYEM) || 0,
                standartAyar: Number(r.STANDART_AYAR) || 0,
                siraNo: Number(r.SIRA_NO) || 0,
                varsayilan: Boolean(r.VARSAYILAN),
                aktif: Boolean(r.AKTIF),
                aciklama: r.ACIKLAMA || null,
            };
        }
        catch (error) {
            logger.error(`Error fetching ayar by ID ${ayarId}:`, error);
            throw ApiError.internal(`Ayar tanımı getirilirken hata oluştu: ${error.message}`);
        }
    }
    /**
     * Inserts or updates ayar using SODVZ_AYAR_KAYDET procedure
     */
    static async saveAyar(dto, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await this.ensureSchema(pool);
            const request = pool.request();
            request.output("AYAR_ID", sql.Int, dto.ayarId || null);
            request.input("AYAR_KODU", sql.VarChar(20), dto.ayarKodu.trim().toUpperCase());
            request.input("AYAR_ADI", sql.VarChar(100), dto.ayarAdi.trim());
            request.input("MILYEM", sql.Decimal(8, 5), Number(dto.milyem));
            request.input("STANDART_AYAR", sql.Int, dto.standartAyar ? Number(dto.standartAyar) : null);
            request.input("SIRA_NO", sql.Int, dto.siraNo != null ? Number(dto.siraNo) : 0);
            request.input("VARSAYILAN", sql.Bit, dto.varsayilan ? 1 : 0);
            request.input("AKTIF", sql.Bit, dto.aktif !== false ? 1 : 0);
            request.input("ACIKLAMA", sql.VarChar(250), dto.aciklama ? dto.aciklama.trim() : null);
            request.input("KULLANICI_ID", sql.Int, dto.kullaniciId ? Number(dto.kullaniciId) : null);
            request.output("YENI_KAYIT", sql.Bit);
            const result = await request.execute("SODVZ_AYAR_KAYDET");
            const generatedId = result.output.AYAR_ID || dto.ayarId;
            const isNew = Boolean(result.output.YENI_KAYIT);
            return {
                ayarId: Number(generatedId),
                yeniKayit: isNew,
            };
        }
        catch (error) {
            logger.error("Error saving ayar:", error);
            throw ApiError.badRequest(error.message || "Ayar kaydedilemedi.");
        }
    }
    /**
     * Deletes ayar using SODVZ_AYAR_SIL procedure
     */
    static async deleteAyar(ayarId, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            await this.ensureSchema(pool);
            const request = pool.request();
            request.input("AYAR_ID", sql.Int, ayarId);
            await request.execute("SODVZ_AYAR_SIL");
            return true;
        }
        catch (error) {
            logger.error(`Error deleting ayar ID ${ayarId}:`, error);
            throw ApiError.badRequest(error.message || "Ayar silinemedi.");
        }
    }
}
