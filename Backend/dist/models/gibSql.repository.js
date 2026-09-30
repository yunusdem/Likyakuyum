import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.utils.js";
import { logger } from "../utils/logger.js";
/** Şifreli metin tek kolonda: base64(iv):base64(tag):base64(cipher) */
const sifrele = (duz) => {
    const e = encryptSecret(duz);
    return [e.iv, e.tag, e.cipher].map((b) => b.toString("base64")).join(":");
};
const coz = (saklanan) => {
    const [iv, tag, cipher] = String(saklanan ?? "").split(":");
    return decryptSecret(Buffer.from(cipher ?? "", "base64"), Buffer.from(iv ?? "", "base64"), Buffer.from(tag ?? "", "base64"));
};
export class GibSqlRepository {
    static hazir = new Set();
    static async havuz(ctx) {
        const pool = await getDbPool(ctx.dbServer, ctx.dbName);
        const cfg = pool.config || {};
        const anahtar = `${cfg.server ?? ""}:${cfg.database ?? ""}`.toLowerCase();
        if (this.hazir.has(anahtar))
            return pool;
        await pool.request().batch(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_GIB_HESAP')
        CREATE TABLE [dbo].[TODVZ_GIB_HESAP] (
          [HESAP_ID]           INT            NOT NULL PRIMARY KEY CHECK ([HESAP_ID] = 1),
          [KULLANICI_KODU_ENC] NVARCHAR(500)  NOT NULL,
          [SIFRE_ENC]          NVARCHAR(1000) NOT NULL,
          [SON_BASARILI_GIRIS] DATETIME       NULL,
          [SON_HATA]           NVARCHAR(500)  NULL,
          [SON_HATA_TARIHI]    DATETIME       NULL,
          [GUNCELLEYEN]        NVARCHAR(100)  NULL,
          [GUNCELLEME_TARIHI]  DATETIME       NOT NULL DEFAULT GETDATE()
        );
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_GIB_VKN_SORGU')
        CREATE TABLE [dbo].[TODVZ_GIB_VKN_SORGU] (
          [NO]            VARCHAR(11)   NOT NULL PRIMARY KEY,
          [TUR]           VARCHAR(4)    NOT NULL,
          [SONUC]         VARCHAR(10)   NOT NULL,
          [UNVAN]         NVARCHAR(300) NULL,
          [AD]            NVARCHAR(100) NULL,
          [SOYAD]         NVARCHAR(100) NULL,
          [VERGI_DAIRESI] NVARCHAR(150) NULL,
          [SORGU_TARIHI]  DATETIME      NOT NULL DEFAULT GETDATE()
        );
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_GIB_VKN_SORGU_LOG')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_GIB_VKN_SORGU_LOG] (
          [LOG_ID]    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [TARIH]     DATETIME      NOT NULL DEFAULT GETDATE(),
          [KULLANICI] NVARCHAR(100) NULL,
          [NO]        VARCHAR(11)   NOT NULL,
          [SONUC]     VARCHAR(12)   NOT NULL,
          [KAYNAK]    VARCHAR(10)   NULL
        );
        CREATE INDEX [IX_TODVZ_GIB_VKN_SORGU_LOG_TARIH] ON [dbo].[TODVZ_GIB_VKN_SORGU_LOG]([TARIH] DESC);
      END
    `);
        this.hazir.add(anahtar);
        return pool;
    }
    /** Çözülmüş hesap bilgisi; tanımsızsa null. Yalnız sunucu içinde kullanılır. */
    static async hesap(ctx) {
        const pool = await this.havuz(ctx);
        const s = (await pool.request().query(`SELECT KULLANICI_KODU_ENC, SIFRE_ENC FROM dbo.TODVZ_GIB_HESAP WHERE HESAP_ID = 1`)).recordset[0];
        if (!s)
            return null;
        return { kullaniciKodu: coz(s.KULLANICI_KODU_ENC), sifre: coz(s.SIFRE_ENC) };
    }
    static async durum(ctx) {
        const pool = await this.havuz(ctx);
        const s = (await pool.request().query(`
        SELECT KULLANICI_KODU_ENC, SON_BASARILI_GIRIS, SON_HATA, SON_HATA_TARIHI, GUNCELLEYEN, GUNCELLEME_TARIHI
        FROM dbo.TODVZ_GIB_HESAP WHERE HESAP_ID = 1
      `)).recordset[0];
        if (!s) {
            return { tanimli: false, kullaniciKodu: null, sonBasariliGiris: null, sonHata: null, sonHataTarihi: null, guncelleyen: null, guncellemeTarihi: null };
        }
        let kullaniciKodu = null;
        try {
            kullaniciKodu = coz(s.KULLANICI_KODU_ENC);
        }
        catch {
            // anahtar değişmişse ekranda boş görünür; yeniden kaydetmek yeter
        }
        return {
            tanimli: true,
            kullaniciKodu,
            sonBasariliGiris: s.SON_BASARILI_GIRIS ?? null,
            sonHata: s.SON_HATA ?? null,
            sonHataTarihi: s.SON_HATA_TARIHI ?? null,
            guncelleyen: s.GUNCELLEYEN ?? null,
            guncellemeTarihi: s.GUNCELLEME_TARIHI ?? null,
        };
    }
    static async hesapYaz(ctx, kullaniciKodu, sifre, kullanici) {
        const pool = await this.havuz(ctx);
        await pool
            .request()
            .input("kod", sql.NVarChar(500), sifrele(kullaniciKodu))
            .input("sifre", sql.NVarChar(1000), sifrele(sifre))
            .input("kullanici", sql.NVarChar(100), kullanici.slice(0, 100)).query(`
        MERGE dbo.TODVZ_GIB_HESAP AS h
        USING (SELECT 1 AS HESAP_ID) AS k ON h.HESAP_ID = k.HESAP_ID
        WHEN MATCHED THEN UPDATE SET KULLANICI_KODU_ENC = @kod, SIFRE_ENC = @sifre, SON_BASARILI_GIRIS = NULL,
             SON_HATA = NULL, SON_HATA_TARIHI = NULL, GUNCELLEYEN = @kullanici, GUNCELLEME_TARIHI = GETDATE()
        WHEN NOT MATCHED THEN INSERT (HESAP_ID, KULLANICI_KODU_ENC, SIFRE_ENC, GUNCELLEYEN)
             VALUES (1, @kod, @sifre, @kullanici);
      `);
    }
    static async hesapSil(ctx) {
        const pool = await this.havuz(ctx);
        await pool.request().query(`DELETE FROM dbo.TODVZ_GIB_HESAP WHERE HESAP_ID = 1`);
    }
    /** Giriş sonucunu hesaba işler; yazılamazsa asıl işlem bozulmaz. */
    static async girisSonucu(ctx, basarili, hata) {
        try {
            const pool = await this.havuz(ctx);
            if (basarili) {
                await pool.request().query(`UPDATE dbo.TODVZ_GIB_HESAP SET SON_BASARILI_GIRIS = GETDATE(), SON_HATA = NULL, SON_HATA_TARIHI = NULL WHERE HESAP_ID = 1`);
            }
            else {
                await pool
                    .request()
                    .input("hata", sql.NVarChar(500), (hata || "Bilinmeyen hata").slice(0, 500))
                    .query(`UPDATE dbo.TODVZ_GIB_HESAP SET SON_HATA = @hata, SON_HATA_TARIHI = GETDATE() WHERE HESAP_ID = 1`);
            }
        }
        catch (err) {
            logger.error(`[GIB] Giriş sonucu yazılamadı: ${err?.message}`);
        }
    }
    static async onbellekOku(ctx, no) {
        const pool = await this.havuz(ctx);
        const s = (await pool
            .request()
            .input("no", sql.VarChar(11), no)
            .query(`SELECT NO, TUR, SONUC, UNVAN, AD, SOYAD, VERGI_DAIRESI, SORGU_TARIHI FROM dbo.TODVZ_GIB_VKN_SORGU WHERE NO = @no`)).recordset[0];
        if (!s)
            return null;
        return {
            no: s.NO,
            tur: s.TUR,
            sonuc: s.SONUC,
            unvan: s.UNVAN ?? null,
            ad: s.AD ?? null,
            soyad: s.SOYAD ?? null,
            vergiDairesi: s.VERGI_DAIRESI ?? null,
            sorguTarihi: s.SORGU_TARIHI,
        };
    }
    static async onbellekYaz(ctx, k) {
        try {
            const pool = await this.havuz(ctx);
            await pool
                .request()
                .input("no", sql.VarChar(11), k.no)
                .input("tur", sql.VarChar(4), k.tur)
                .input("sonuc", sql.VarChar(10), k.sonuc)
                .input("unvan", sql.NVarChar(300), k.unvan?.slice(0, 300) ?? null)
                .input("ad", sql.NVarChar(100), k.ad?.slice(0, 100) ?? null)
                .input("soyad", sql.NVarChar(100), k.soyad?.slice(0, 100) ?? null)
                .input("vd", sql.NVarChar(150), k.vergiDairesi?.slice(0, 150) ?? null).query(`
          MERGE dbo.TODVZ_GIB_VKN_SORGU AS h
          USING (SELECT @no AS NO) AS k ON h.NO = k.NO
          WHEN MATCHED THEN UPDATE SET TUR = @tur, SONUC = @sonuc, UNVAN = @unvan, AD = @ad, SOYAD = @soyad,
               VERGI_DAIRESI = @vd, SORGU_TARIHI = GETDATE()
          WHEN NOT MATCHED THEN INSERT (NO, TUR, SONUC, UNVAN, AD, SOYAD, VERGI_DAIRESI)
               VALUES (@no, @tur, @sonuc, @unvan, @ad, @soyad, @vd);
        `);
        }
        catch (err) {
            logger.error(`[GIB] Önbelleğe yazılamadı: ${err?.message}`);
        }
    }
    static async sorguLogu(ctx, k) {
        try {
            const pool = await this.havuz(ctx);
            await pool
                .request()
                .input("kullanici", sql.NVarChar(100), (k.kullanici || "").slice(0, 100))
                .input("no", sql.VarChar(11), k.no)
                .input("sonuc", sql.VarChar(12), k.sonuc)
                .input("kaynak", sql.VarChar(10), k.kaynak)
                .query(`INSERT INTO dbo.TODVZ_GIB_VKN_SORGU_LOG (KULLANICI, NO, SONUC, KAYNAK) VALUES (@kullanici, @no, @sonuc, @kaynak)`);
        }
        catch (err) {
            logger.error(`[GIB] Sorgu kaydı yazılamadı: ${err?.message}`);
        }
    }
}
