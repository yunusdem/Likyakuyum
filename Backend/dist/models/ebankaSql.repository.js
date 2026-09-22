import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
const TOKEN_KOLONLARI = {
    banka: { token: "TOKEN_BANKA_SIFRELI", bitis: "TOKEN_BANKA_BITIS" },
    vpos: { token: "TOKEN_VPOS_SIFRELI", bitis: "TOKEN_VPOS_BITIS" },
};
const tarihMetni = (d) => (d ? new Date(d).toISOString() : null);
export class EBankaSqlRepository {
    static async ensureTables(pool) {
        try {
            await pool.request().batch(`
        IF OBJECT_ID('TODVZ_EBANKA_AYAR', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_AYAR] (
            [AYAR_ID] TINYINT NOT NULL PRIMARY KEY,
            [MOD] VARCHAR(10) NOT NULL DEFAULT 'sahte',
            [APP_KEY] VARCHAR(200) NULL,
            [APP_SECRET_SIFRELI] VARCHAR(1000) NULL,
            [VPOS_APP_KEY] VARCHAR(200) NULL,
            [VPOS_APP_SECRET_SIFRELI] VARCHAR(1000) NULL,
            [AKTARIM_BASLANGIC] DATE NULL,
            [VPOS_BANKA_ID] INT NULL,
            [TOKEN_BANKA_SIFRELI] VARCHAR(MAX) NULL,
            [TOKEN_BANKA_BITIS] DATETIME NULL,
            [TOKEN_VPOS_SIFRELI] VARCHAR(MAX) NULL,
            [TOKEN_VPOS_BITIS] DATETIME NULL,
            [SON_ESITLEME] DATETIME NULL,
            [SON_HAREKET_ID] BIGINT NULL,
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;

        IF OBJECT_ID('TODVZ_EBANKA_LOG', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_LOG] (
            [LOG_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [ZAMAN] DATETIME NOT NULL DEFAULT GETDATE(),
            [ISLEM] VARCHAR(50) NOT NULL,
            [MOD] VARCHAR(10) NOT NULL,
            [BASARILI] BIT NOT NULL,
            [ADET] INT NULL,
            [MESAJ] NVARCHAR(500) NULL,
            [KULLANICI_ID] INT NULL
          );
        END;
      `);
        }
        catch (err) {
            logger.warn(`[EBankaSqlRepository.ensureTables] Warning: ${err.message}`);
        }
    }
    static async pool(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        return pool;
    }
    static async ayarGetir(dbContext) {
        const pool = await this.pool(dbContext);
        const r = (await pool.request().query(`SELECT TOP 1 * FROM TODVZ_EBANKA_AYAR WHERE AYAR_ID = 1`)).recordset[0];
        if (!r)
            return null;
        return {
            mod: r.MOD === "canli" ? "canli" : "sahte",
            appKey: r.APP_KEY ? String(r.APP_KEY).trim() : null,
            appSecretSifreli: r.APP_SECRET_SIFRELI || null,
            vposAppKey: r.VPOS_APP_KEY ? String(r.VPOS_APP_KEY).trim() : null,
            vposAppSecretSifreli: r.VPOS_APP_SECRET_SIFRELI || null,
            aktarimBaslangic: r.AKTARIM_BASLANGIC ? new Date(r.AKTARIM_BASLANGIC).toISOString().slice(0, 10) : null,
            vposBankaId: r.VPOS_BANKA_ID ?? null,
            sonEsitleme: tarihMetni(r.SON_ESITLEME),
            guncellemeZamani: tarihMetni(r.GUNCELLEME_ZAMANI),
        };
    }
    static async ayarKaydet(dto, kullaniciId, dbContext) {
        const pool = await this.pool(dbContext);
        const req = pool.request();
        req.input("MOD", sql.VarChar(10), dto.mod);
        req.input("APP_KEY", sql.VarChar(200), dto.appKey);
        req.input("VPOS_APP_KEY", sql.VarChar(200), dto.vposAppKey);
        req.input("AKTARIM_BASLANGIC", sql.Date, dto.aktarimBaslangic ? new Date(dto.aktarimBaslangic) : null);
        req.input("VPOS_BANKA_ID", sql.Int, dto.vposBankaId);
        req.input("KULLANICI_ID", sql.Int, kullaniciId ?? null);
        req.input("SECRET_DEGISTI", sql.Bit, dto.appSecretSifreli !== undefined ? 1 : 0);
        req.input("APP_SECRET_SIFRELI", sql.VarChar(1000), dto.appSecretSifreli ?? null);
        req.input("VPOS_SECRET_DEGISTI", sql.Bit, dto.vposAppSecretSifreli !== undefined ? 1 : 0);
        req.input("VPOS_APP_SECRET_SIFRELI", sql.VarChar(1000), dto.vposAppSecretSifreli ?? null);
        // Anahtar ya da mod değişince eski token geçersizdir
        await req.query(`
      IF NOT EXISTS (SELECT 1 FROM TODVZ_EBANKA_AYAR WHERE AYAR_ID = 1)
        INSERT INTO TODVZ_EBANKA_AYAR (AYAR_ID) VALUES (1);

      UPDATE TODVZ_EBANKA_AYAR SET
        [MOD] = @MOD,
        APP_KEY = @APP_KEY,
        APP_SECRET_SIFRELI = CASE WHEN @SECRET_DEGISTI = 1 THEN @APP_SECRET_SIFRELI ELSE APP_SECRET_SIFRELI END,
        VPOS_APP_KEY = @VPOS_APP_KEY,
        VPOS_APP_SECRET_SIFRELI = CASE WHEN @VPOS_SECRET_DEGISTI = 1 THEN @VPOS_APP_SECRET_SIFRELI ELSE VPOS_APP_SECRET_SIFRELI END,
        AKTARIM_BASLANGIC = @AKTARIM_BASLANGIC,
        VPOS_BANKA_ID = @VPOS_BANKA_ID,
        TOKEN_BANKA_SIFRELI = NULL, TOKEN_BANKA_BITIS = NULL,
        TOKEN_VPOS_SIFRELI = NULL, TOKEN_VPOS_BITIS = NULL,
        GUNCELLEYEN_ID = @KULLANICI_ID,
        GUNCELLEME_ZAMANI = GETDATE()
      WHERE AYAR_ID = 1;
    `);
    }
    static async tokenGetir(servis, dbContext) {
        const pool = await this.pool(dbContext);
        const k = TOKEN_KOLONLARI[servis];
        const r = (await pool.request().query(`SELECT ${k.token} AS T, ${k.bitis} AS B FROM TODVZ_EBANKA_AYAR WHERE AYAR_ID = 1`)).recordset[0];
        return r?.T && r?.B ? { sifreli: r.T, bitis: new Date(r.B) } : null;
    }
    static async tokenYaz(servis, sifreli, bitis, dbContext) {
        const pool = await this.pool(dbContext);
        const k = TOKEN_KOLONLARI[servis];
        const req = pool.request();
        req.input("T", sql.VarChar(sql.MAX), sifreli);
        req.input("B", sql.DateTime, bitis);
        await req.query(`UPDATE TODVZ_EBANKA_AYAR SET ${k.token} = @T, ${k.bitis} = @B WHERE AYAR_ID = 1`);
    }
    static async logYaz(kayit, dbContext) {
        try {
            const pool = await this.pool(dbContext);
            const req = pool.request();
            req.input("ISLEM", sql.VarChar(50), kayit.islem);
            req.input("MOD", sql.VarChar(10), kayit.mod);
            req.input("BASARILI", sql.Bit, kayit.basarili ? 1 : 0);
            req.input("ADET", sql.Int, kayit.adet ?? null);
            req.input("MESAJ", sql.NVarChar(500), kayit.mesaj ? kayit.mesaj.slice(0, 500) : null);
            req.input("KULLANICI_ID", sql.Int, kayit.kullaniciId ?? null);
            await req.query(`
        INSERT INTO TODVZ_EBANKA_LOG (ISLEM, [MOD], BASARILI, ADET, MESAJ, KULLANICI_ID)
        VALUES (@ISLEM, @MOD, @BASARILI, @ADET, @MESAJ, @KULLANICI_ID)
      `);
        }
        catch (err) {
            logger.warn(`[EBankaSqlRepository.logYaz] ${err.message}`);
        }
    }
    static async logListele(limit, dbContext) {
        const pool = await this.pool(dbContext);
        const req = pool.request();
        req.input("LIMIT", sql.Int, Math.min(Math.max(limit || 50, 1), 500));
        const rows = (await req.query(`SELECT TOP (@LIMIT) * FROM TODVZ_EBANKA_LOG ORDER BY LOG_ID DESC`)).recordset;
        return rows.map((r) => ({
            logId: r.LOG_ID,
            zaman: tarihMetni(r.ZAMAN),
            islem: r.ISLEM,
            mod: r.MOD === "canli" ? "canli" : "sahte",
            basarili: Boolean(r.BASARILI),
            adet: r.ADET ?? null,
            mesaj: r.MESAJ ?? null,
            kullaniciId: r.KULLANICI_ID ?? null,
        }));
    }
}
