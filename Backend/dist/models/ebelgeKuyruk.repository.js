import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { EbelgeSqlRepository } from "./ebelgeSql.repository.js";
/** Bu süreden uzun ISLENIYOR kalan satır (süreç çöktü) yeniden alınır; ICE çağrıları en çok 120 sn sürer */
const KILIT_DAKIKA = 10;
const satirdan = (r) => {
    let veri = {};
    try {
        veri = r.VERI ? JSON.parse(r.VERI) : {};
    }
    catch {
        veri = {};
    }
    return {
        id: Number(r.ID),
        uuid: r.UUID,
        belgeTuru: r.BELGE_TURU,
        islem: r.ISLEM,
        durum: r.DURUM,
        deneme: Number(r.DENEME) || 0,
        veri,
        kullanici: r.KULLANICI || "kuyruk",
        olusturma: new Date(r.OLUSTURMA_TARIHI),
        sonGonderim: r.SON_GONDERIM ? new Date(r.SON_GONDERIM) : null,
    };
};
export class EbelgeKuyrukRepository {
    static hazirAnahtarlar = new Set();
    static async tabloKur(pool) {
        const cfg = pool.config || {};
        const anahtar = `${cfg.server ?? ""}:${cfg.database ?? ""}`.toLowerCase();
        if (this.hazirAnahtarlar.has(anahtar))
            return;
        await pool.request().batch(`
      IF OBJECT_ID('dbo.TODVZ_EBELGE_KUYRUK', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[TODVZ_EBELGE_KUYRUK] (
          [ID] BIGINT IDENTITY(1,1) NOT NULL,
          [UUID] VARCHAR(60) NOT NULL,
          [BELGE_TURU] VARCHAR(20) NOT NULL,
          [ISLEM] VARCHAR(10) NOT NULL,
          [DURUM] VARCHAR(12) NOT NULL DEFAULT 'BEKLIYOR',
          [DENEME] INT NOT NULL DEFAULT 0,
          [SONRAKI_ISLEM] DATETIME NOT NULL DEFAULT GETDATE(),
          [KILIT_TARIHI] DATETIME NULL,
          [SON_GONDERIM] DATETIME NULL,
          [VERI] NVARCHAR(MAX) NULL,
          [SON_MESAJ] NVARCHAR(1000) NULL,
          [KULLANICI] NVARCHAR(50) NULL,
          [OLUSTURMA_TARIHI] DATETIME NOT NULL DEFAULT GETDATE(),
          [GUNCELLEME_TARIHI] DATETIME NULL,
          CONSTRAINT [PK_TODVZ_EBELGE_KUYRUK] PRIMARY KEY CLUSTERED ([ID] ASC)
        );
        CREATE INDEX [IX_TODVZ_EBELGE_KUYRUK_SIRA] ON [dbo].[TODVZ_EBELGE_KUYRUK] ([DURUM], [SONRAKI_ISLEM]);
        CREATE INDEX [IX_TODVZ_EBELGE_KUYRUK_UUID] ON [dbo].[TODVZ_EBELGE_KUYRUK] ([UUID]);
      END
    `);
        this.hazirAnahtarlar.add(anahtar);
    }
    /** e-Belge tablolarıyla birlikte (giden tablosu da gerekir) kuyruk tablosunu hazırlar */
    static async havuz(ctx) {
        const pool = await EbelgeSqlRepository.havuzAl(ctx);
        await this.tabloKur(pool);
        return pool;
    }
    /** Arka plan işi için: tablo yoksa kurmadan false döner (e-Belge kullanmayan firmaya tablo açılmaz) */
    static async tabloVarMi(ctx) {
        const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
        const r = await pool.request().query(`SELECT OBJECT_ID('dbo.TODVZ_EBELGE_KUYRUK', 'U') AS O`);
        return r.recordset[0]?.O != null;
    }
    /** Arka plan işi için: bekleyen ya da işlenen (zamanı gelmemiş dahil) iş var mı */
    static async bekleyenVarMi(ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().query(`
      SELECT CASE WHEN EXISTS (SELECT 1 FROM [dbo].[TODVZ_EBELGE_KUYRUK] WHERE [DURUM] IN ('BEKLIYOR', 'ISLENIYOR'))
        THEN 1 ELSE 0 END AS [VAR]
    `);
        return r.recordset[0]?.VAR === 1;
    }
    static async ekle(is, ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool
            .request()
            .input("uuid", sql.VarChar(60), is.uuid)
            .input("tur", sql.VarChar(20), is.belgeTuru)
            .input("islem", sql.VarChar(10), is.islem)
            .input("veri", sql.NVarChar(sql.MAX), JSON.stringify(is.veri ?? {}))
            .input("kullanici", sql.NVarChar(50), is.kullanici.slice(0, 50))
            .input("sn", sql.Int, is.sonrakiSn ?? 0).query(`
        INSERT INTO [dbo].[TODVZ_EBELGE_KUYRUK] ([UUID], [BELGE_TURU], [ISLEM], [VERI], [KULLANICI], [SONRAKI_ISLEM])
        OUTPUT inserted.[ID]
        VALUES (@uuid, @tur, @islem, @veri, @kullanici, DATEADD(second, @sn, GETDATE()))
      `);
        return Number(r.recordset[0].ID);
    }
    /**
     * Sırası gelmiş işleri atomik olarak alır (ISLENIYOR yapar). READPAST: başka bir süreç aynı satırı
     * alamaz. Süreç çökmüşse KILIT_DAKIKA sonra satır yeniden alınabilir hale gelir.
     */
    static async al(adet, ctx, id) {
        const pool = await this.havuz(ctx);
        const r = await pool
            .request()
            .input("adet", sql.Int, adet)
            .input("id", sql.BigInt, id ?? null)
            .input("kilit", sql.Int, KILIT_DAKIKA).query(`
        ;WITH sira AS (
          SELECT TOP (@adet) * FROM [dbo].[TODVZ_EBELGE_KUYRUK] WITH (ROWLOCK, UPDLOCK, READPAST)
          WHERE (@id IS NULL OR [ID] = @id)
            AND (([DURUM] = 'BEKLIYOR' AND [SONRAKI_ISLEM] <= GETDATE())
              OR ([DURUM] = 'ISLENIYOR' AND [KILIT_TARIHI] < DATEADD(minute, -@kilit, GETDATE())))
          ORDER BY [SONRAKI_ISLEM], [ID]
        )
        UPDATE sira SET [DURUM] = 'ISLENIYOR', [KILIT_TARIHI] = GETDATE(), [GUNCELLEME_TARIHI] = GETDATE()
        OUTPUT inserted.*
      `);
        return r.recordset.map(satirdan);
    }
    static async bitir(id, durum, mesaj, ctx) {
        const pool = await this.havuz(ctx);
        await pool
            .request()
            .input("id", sql.BigInt, id)
            .input("durum", sql.VarChar(12), durum)
            .input("mesaj", sql.NVarChar(1000), mesaj.slice(0, 1000)).query(`
        UPDATE [dbo].[TODVZ_EBELGE_KUYRUK]
        SET [DURUM] = @durum, [SON_MESAJ] = @mesaj, [KILIT_TARIHI] = NULL, [GUNCELLEME_TARIHI] = GETDATE()
        WHERE [ID] = @id
      `);
    }
    static async ertele(id, saniye, mesaj, ctx) {
        const pool = await this.havuz(ctx);
        await pool
            .request()
            .input("id", sql.BigInt, id)
            .input("sn", sql.Int, saniye)
            .input("mesaj", sql.NVarChar(1000), mesaj.slice(0, 1000)).query(`
        UPDATE [dbo].[TODVZ_EBELGE_KUYRUK]
        SET [DURUM] = 'BEKLIYOR', [SONRAKI_ISLEM] = DATEADD(second, @sn, GETDATE()), [SON_MESAJ] = @mesaj,
            [KILIT_TARIHI] = NULL, [GUNCELLEME_TARIHI] = GETDATE()
        WHERE [ID] = @id
      `);
    }
    /** ICE'ye yazma denemesinden hemen önce: deneme sayısı ve zamanı kalıcı olsun (çökmede de bilinsin) */
    static async denemeYaz(id, ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().input("id", sql.BigInt, id).query(`
      UPDATE [dbo].[TODVZ_EBELGE_KUYRUK]
      SET [DENEME] = [DENEME] + 1, [SON_GONDERIM] = GETDATE(), [GUNCELLEME_TARIHI] = GETDATE()
      OUTPUT inserted.[DENEME]
      WHERE [ID] = @id
    `);
        return Number(r.recordset[0]?.DENEME) || 1;
    }
    /** Belge kesinleşince bekleyen e-posta işleri beklemeden çalışsın */
    static async bekleyenleriOne(uuid, islem, ctx) {
        const pool = await this.havuz(ctx);
        await pool
            .request()
            .input("uuid", sql.VarChar(60), uuid)
            .input("islem", sql.VarChar(10), islem).query(`
        UPDATE [dbo].[TODVZ_EBELGE_KUYRUK] SET [SONRAKI_ISLEM] = GETDATE()
        WHERE [UUID] = @uuid AND [ISLEM] = @islem AND [DURUM] = 'BEKLIYOR'
      `);
    }
    static async durum(id, ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().input("id", sql.BigInt, id).query(`SELECT [DURUM] FROM [dbo].[TODVZ_EBELGE_KUYRUK] WHERE [ID] = @id`);
        return r.recordset[0]?.DURUM ?? null;
    }
    /**
     * Sahipsiz askıdaki giden kayıtları: kuyruk öncesinden kalan ("İşlem sürüyor"da takılanlar) ya da kuyruk
     * satırı yazılamamış olanlar. Hiç kuyruk işi olmayan ve 15 dakikadan eski kayıtlar döner.
     */
    static async sahipsizler(ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().query(`
      SELECT TOP 50 g.[UUID], g.[BELGE_TURU], g.[GONDERIM_DURUMU]
      FROM [dbo].[TODVZ_EBELGE_GIDEN] g
      WHERE g.[GONDERIM_DURUMU] IN ('KUYRUKTA', 'GONDERILIYOR', 'BELIRSIZ', 'ONAYLANIYOR')
        AND ISNULL(g.[GONDERIM_TARIHI], g.[OLUSTURMA_TARIHI]) < DATEADD(minute, -15, GETDATE())
        AND NOT EXISTS (SELECT 1 FROM [dbo].[TODVZ_EBELGE_KUYRUK] k
                        WHERE k.[UUID] = g.[UUID] AND k.[ISLEM] IN ('GONDER', 'ONAY'))
      ORDER BY g.[OLUSTURMA_TARIHI]
    `);
        return r.recordset.map((x) => ({ uuid: x.UUID, belgeTuru: x.BELGE_TURU, durum: x.GONDERIM_DURUMU }));
    }
    /** Uzun süredir değişmeyen bitmiş işler temizlenir (tablo şişmesin) */
    static async temizle(ctx) {
        const pool = await this.havuz(ctx);
        await pool.request().query(`
      DELETE FROM [dbo].[TODVZ_EBELGE_KUYRUK]
      WHERE [DURUM] IN ('TAMAM', 'BASARISIZ') AND ISNULL([GUNCELLEME_TARIHI], [OLUSTURMA_TARIHI]) < DATEADD(day, -90, GETDATE())
    `).catch((e) => logger.warn("e-Belge kuyruk temizliği yapılamadı:", e));
    }
}
