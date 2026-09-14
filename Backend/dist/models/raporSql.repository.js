import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { BelgeSqlRepository } from "./belgeSql.repository.js";
/**
 * Rapor modülü veri erişimi. Şablon meta'sı `TODVZ_BELGE_SABLON` (TUR='RAPOR') tablosunda;
 * yoksa 9 rapor kaydı eklenir. Rapor verisi `services/rapor/raporVeri.ts` sorgularından (yalnızca SELECT).
 */
export const RAPOR_SEED = [
    { kod: "CARBAK1", ad: "Cari Bakiye Raporu", kagit: "A4" },
    { kod: "CAREKS1", ad: "Cari Ekstre", kagit: "A4" },
    { kod: "CARHAR1", ad: "Cari Hareket Listesi", kagit: "A4-yatay" },
    { kod: "CARKRT1", ad: "Cari Kart Listesi", kagit: "A4-yatay" },
    { kod: "VEZBAK1", ad: "Vezne Bakiye Raporu (Tarih Bazlı)", kagit: "A4" },
    { kod: "VEZHAR1", ad: "Vezne Hareket Listesi", kagit: "A4-yatay" },
    { kod: "VERKOM1", ad: "Vergiler ve Komisyon", kagit: "A4-yatay" },
    { kod: "KARZAR1", ad: "Kâr / Zarar Faaliyet Analizi", kagit: "A4-yatay" },
    { kod: "FIRVAR1", ad: "Firma Varlıkları Raporu", kagit: "A4" },
];
const ARAMA_UST_SINIR = 10;
export class RaporSqlRepository {
    static hazirlanan = new Set();
    static async pool(ctx) {
        const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
        const anahtar = `${ctx?.dbServer || ""}|${ctx?.dbName || ""}`;
        if (!this.hazirlanan.has(anahtar)) {
            await BelgeSqlRepository.ensureTablesExist(pool);
            await this.seed(pool);
            await this.aramaTablosu(pool);
            this.hazirlanan.add(anahtar);
        }
        return pool;
    }
    static async seed(pool) {
        try {
            const degerler = RAPOR_SEED.map(r => `('${r.kod}', N'${r.ad.replace(/'/g, "''")}', 'RAPOR', NULL, 'rapor/${r.kod}.json', '${r.kagit}', 1, 1)`).join(",\n");
            await pool.request().query(`
        ;WITH S(KOD, AD, TUR, FIS_TIPI, DUZEN_DOSYASI, KAGIT, VARSAYILAN, AKTIF) AS (SELECT * FROM (VALUES ${degerler}) V(KOD, AD, TUR, FIS_TIPI, DUZEN_DOSYASI, KAGIT, VARSAYILAN, AKTIF))
        INSERT INTO dbo.TODVZ_BELGE_SABLON (KOD, AD, TUR, FIS_TIPI, DUZEN_DOSYASI, KAGIT, VARSAYILAN, AKTIF)
        SELECT S.KOD, S.AD, S.TUR, S.FIS_TIPI, S.DUZEN_DOSYASI, S.KAGIT, S.VARSAYILAN, S.AKTIF FROM S
        WHERE NOT EXISTS (SELECT 1 FROM dbo.TODVZ_BELGE_SABLON B WHERE B.KOD=S.KOD);`);
        }
        catch (e) {
            logger.error("RaporSqlRepository.seed hatası:", e);
            throw e;
        }
    }
    /** Kayıtlı rapor aramaları (yönetici kararı 14.09.2026: sunucuda, kullanıcı × rapor bazlı, son 10). */
    static async aramaTablosu(pool) {
        await pool.request().query(`
      IF OBJECT_ID('dbo.TODVZ_RAPOR_ARAMA','U') IS NULL
      BEGIN TRY
        CREATE TABLE dbo.TODVZ_RAPOR_ARAMA (
          ARAMA_ID     int IDENTITY(1,1) NOT NULL PRIMARY KEY,
          KULLANICI    nvarchar(100) NOT NULL,
          RAPOR_KOD    varchar(20)   NOT NULL,
          OZET         nvarchar(400) NOT NULL DEFAULT '',
          PARAMETRELER nvarchar(max) NOT NULL,
          ZAMAN        datetime2     NOT NULL DEFAULT SYSDATETIME()
        );
        CREATE INDEX IX_TODVZ_RAPOR_ARAMA ON dbo.TODVZ_RAPOR_ARAMA (KULLANICI, RAPOR_KOD, ZAMAN DESC);
      END TRY BEGIN CATCH IF ERROR_NUMBER() NOT IN (2714, 1913) THROW; END CATCH;`);
    }
    static aramaSatiri(r) {
        let parametreler = {};
        try {
            parametreler = JSON.parse(String(r.PARAMETRELER || "{}")) || {};
        }
        catch {
            parametreler = {};
        }
        return { aramaId: Number(r.ARAMA_ID), raporKod: String(r.RAPOR_KOD).trim(), ozet: String(r.OZET || "").trim(), parametreler, zaman: r.ZAMAN ? new Date(r.ZAMAN).toISOString() : "" };
    }
    static async aramalar(kullanici, raporKod, ctx) {
        const pool = await this.pool(ctx);
        const res = await pool.request().input("k", sql.NVarChar(100), kullanici).input("r", sql.VarChar(20), raporKod)
            .query(`SELECT TOP (${ARAMA_UST_SINIR}) * FROM dbo.TODVZ_RAPOR_ARAMA WHERE KULLANICI=@k AND RAPOR_KOD=@r ORDER BY ZAMAN DESC, ARAMA_ID DESC`);
        return res.recordset.map(this.aramaSatiri);
    }
    /** Aynı parametre kümesi varsa zamanı yenilenir; yoksa eklenir; kullanıcı × rapor için en eski kayıtlar 10'un üstünde silinir. */
    static async aramaKaydet(kullanici, raporKod, parametreler, ozet, ctx) {
        const pool = await this.pool(ctx);
        const temiz = {};
        for (const k of Object.keys(parametreler).sort()) {
            const v = parametreler[k];
            if (v !== undefined && v !== null && v !== "")
                temiz[k] = v;
        }
        const json = JSON.stringify(temiz);
        const res = await pool.request().input("k", sql.NVarChar(100), kullanici).input("r", sql.VarChar(20), raporKod)
            .input("o", sql.NVarChar(400), ozet.slice(0, 400)).input("p", sql.NVarChar(sql.MAX), json).query(`
      DECLARE @id int = (SELECT TOP 1 ARAMA_ID FROM dbo.TODVZ_RAPOR_ARAMA WHERE KULLANICI=@k AND RAPOR_KOD=@r AND PARAMETRELER=@p ORDER BY ZAMAN DESC);
      IF @id IS NULL BEGIN
        INSERT INTO dbo.TODVZ_RAPOR_ARAMA (KULLANICI, RAPOR_KOD, OZET, PARAMETRELER) VALUES (@k, @r, @o, @p);
        SET @id = SCOPE_IDENTITY();
      END ELSE UPDATE dbo.TODVZ_RAPOR_ARAMA SET ZAMAN=SYSDATETIME(), OZET=@o WHERE ARAMA_ID=@id;
      DELETE FROM dbo.TODVZ_RAPOR_ARAMA WHERE KULLANICI=@k AND RAPOR_KOD=@r AND ARAMA_ID NOT IN (
        SELECT TOP (${ARAMA_UST_SINIR}) ARAMA_ID FROM dbo.TODVZ_RAPOR_ARAMA WHERE KULLANICI=@k AND RAPOR_KOD=@r ORDER BY ZAMAN DESC, ARAMA_ID DESC);
      SELECT * FROM dbo.TODVZ_RAPOR_ARAMA WHERE ARAMA_ID=@id;`);
        return this.aramaSatiri(res.recordset[0]);
    }
    /** aramaId verilmezse kullanıcının o rapordaki tüm aramaları silinir. Yalnızca kendi kayıtları. */
    static async aramaSil(kullanici, raporKod, aramaId, ctx) {
        const pool = await this.pool(ctx);
        const res = await pool.request().input("k", sql.NVarChar(100), kullanici).input("r", sql.VarChar(20), raporKod).input("id", sql.Int, aramaId ?? null)
            .query(`DELETE FROM dbo.TODVZ_RAPOR_ARAMA WHERE KULLANICI=@k AND RAPOR_KOD=@r AND (@id IS NULL OR ARAMA_ID=@id); SELECT @@ROWCOUNT adet;`);
        return Number(res.recordset[0]?.adet || 0);
    }
    static async sablonlar(ctx) {
        const pool = await this.pool(ctx);
        const res = await pool.request().query(`SELECT KOD kod, AD ad, KAGIT kagit, DUZEN_DOSYASI duzenDosyasi FROM dbo.TODVZ_BELGE_SABLON WHERE TUR='RAPOR' AND AKTIF=1 ORDER BY SABLON_ID`);
        return res.recordset.map((r) => ({ kod: String(r.kod).trim(), ad: String(r.ad).trim(), kagit: String(r.kagit).trim(), duzenDosyasi: String(r.duzenDosyasi).trim() }));
    }
}
