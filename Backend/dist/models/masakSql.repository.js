import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
/** Kod, ad ve adresi sabit olan standart listeler (ekranda her zaman görünür, silinemez) */
export const MASAK_LISTE_KODLARI = ["A", "B", "C", "3AB"];
/** Büyük harf, rakam ve . _ - karakterleri; 1-10 karakter (kolon VARCHAR(10)) */
export const MASAK_LISTE_KOD_DESENI = /^[A-Z0-9][A-Z0-9._-]{0,9}$/;
export const masakListeKodGecerliMi = (kod) => typeof kod === "string" && MASAK_LISTE_KOD_DESENI.test(kod);
export const masakStandartListeMi = (kod) => MASAK_LISTE_KODLARI.includes(kod);
export class MasakSqlRepository {
    /**
     * TODVZ_MASAK_LISTE ve TODVZ_MASAK_GUNCELLEME tablolarını (ve indekslerini) yoksa oluşturur.
     */
    static async ensureTablesExist(pool) {
        const ddl = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_MASAK_LISTE')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_MASAK_LISTE] (
          [MASAK_ID]            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [LISTE_KOD]           VARCHAR(10)    NOT NULL,
          [LISTE_ADI]           NVARCHAR(200)  NULL,
          [SIRA_NO]             INT            NULL,
          [AD_UNVAN]            NVARCHAR(500)  NOT NULL,
          [AD_UNVAN_NORM]       NVARCHAR(500)  NULL,
          [KAYIT_TIPI]          VARCHAR(10)    NULL,
          [KIMLIK_NO]           NVARCHAR(1000) NULL,
          [TCKN]                VARCHAR(11)    NULL,
          [VKN]                 VARCHAR(10)    NULL,
          [DIGER_ISIMLER]       NVARCHAR(MAX)  NULL,
          [DIGER_ISIMLER_NORM]  NVARCHAR(MAX)  NULL,
          [ORIJINAL_AD]         NVARCHAR(500)  NULL,
          [ESKI_ADI]            NVARCHAR(500)  NULL,
          [GOREVI]              NVARCHAR(500)  NULL,
          [ADRES]               NVARCHAR(MAX)  NULL,
          [UYRUK]               NVARCHAR(200)  NULL,
          [DIGER_UYRUK]         NVARCHAR(300)  NULL,
          [YAPTIRIM_TURU]       NVARCHAR(200)  NULL,
          [ANNE_ADI]            NVARCHAR(150)  NULL,
          [BABA_ADI]            NVARCHAR(150)  NULL,
          [DOGUM_TARIHI]        NVARCHAR(300)  NULL,
          [DOGUM_TARIHI_DT]     DATE           NULL,
          [DOGUM_YERI]          NVARCHAR(300)  NULL,
          [ORGUT]               NVARCHAR(300)  NULL,
          [KURULUS_YAPISI]      NVARCHAR(300)  NULL,
          [LISTEYE_ALINMA]      NVARCHAR(300)  NULL,
          [KARAR_BILGI]         NVARCHAR(300)  NULL,
          [RESMI_GAZETE]        NVARCHAR(300)  NULL,
          [DIGER_BILGILER]      NVARCHAR(MAX)  NULL,
          [EK_BILGI]            NVARCHAR(MAX)  NULL,
          [KAYNAK_URL]          NVARCHAR(1000) NULL,
          [KAYNAK_HASH]         VARCHAR(64)    NULL,
          [GUNCELLEME_ZAMANI]   DATETIME       NOT NULL DEFAULT GETDATE(),
          [AKTIF]               BIT            NOT NULL DEFAULT 1
        );
      END

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_LISTE_LISTE' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_LISTE]'))
        EXEC('CREATE INDEX [IX_TODVZ_MASAK_LISTE_LISTE] ON [dbo].[TODVZ_MASAK_LISTE]([LISTE_KOD], [SIRA_NO])');

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_LISTE_TCKN' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_LISTE]'))
        EXEC('CREATE INDEX [IX_TODVZ_MASAK_LISTE_TCKN] ON [dbo].[TODVZ_MASAK_LISTE]([TCKN])');

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_LISTE_VKN' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_LISTE]'))
        EXEC('CREATE INDEX [IX_TODVZ_MASAK_LISTE_VKN] ON [dbo].[TODVZ_MASAK_LISTE]([VKN])');

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_LISTE_ADNORM' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_LISTE]'))
        EXEC('CREATE INDEX [IX_TODVZ_MASAK_LISTE_ADNORM] ON [dbo].[TODVZ_MASAK_LISTE]([AD_UNVAN_NORM])');

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_MASAK_GUNCELLEME')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_MASAK_GUNCELLEME] (
          [GUNCELLEME_ID]       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [LISTE_KOD]           VARCHAR(10)    NOT NULL,
          [BASLAMA_ZAMANI]      DATETIME       NOT NULL DEFAULT GETDATE(),
          [BITIS_ZAMANI]        DATETIME       NULL,
          [SURE_MS]             INT            NULL,
          [DURUM]               VARCHAR(15)    NOT NULL,
          [KAYIT_SAYISI]        INT            NULL,
          [ONCEKI_KAYIT_SAYISI] INT            NULL,
          [KAYNAK_URL]          NVARCHAR(1000) NULL,
          [KAYNAK_HASH]         VARCHAR(64)    NULL,
          [DOSYA_BOYUTU]        INT            NULL,
          [KULLANICI_ADI]       NVARCHAR(100)  NULL,
          [KULLANICI_ID]        NVARCHAR(50)   NULL,
          [HATA_MESAJI]         NVARCHAR(1000) NULL
        );
      END

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TODVZ_MASAK_GUNCELLEME_LISTE' AND object_id = OBJECT_ID(N'[dbo].[TODVZ_MASAK_GUNCELLEME]'))
        EXEC('CREATE INDEX [IX_TODVZ_MASAK_GUNCELLEME_LISTE] ON [dbo].[TODVZ_MASAK_GUNCELLEME]([LISTE_KOD], [BASLAMA_ZAMANI] DESC)');
    `;
        try {
            await pool.request().batch(ddl);
        }
        catch (error) {
            logger.error("MasakSqlRepository.ensureTablesExist error:", error);
            throw error;
        }
    }
    /**
     * Metni hedef kolon uzunluğuna göre kırpar, boş metni NULL'a çevirir.
     */
    static kes(value, len) {
        if (value === null || value === undefined)
            return null;
        const s = String(value).trim();
        if (!s)
            return null;
        return s.length > len ? s.slice(0, len) : s;
    }
    static formatIso(d) {
        if (!d)
            return null;
        try {
            return new Date(d).toISOString();
        }
        catch {
            return null;
        }
    }
    /**
     * Bir listenin mevcut kayıt sayısı
     */
    static async getKayitSayisi(listeKod, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await MasakSqlRepository.ensureTablesExist(pool);
        const res = await pool
            .request()
            .input("listeKod", sql.VarChar(10), listeKod)
            .query("SELECT COUNT(*) AS [ADET] FROM [dbo].[TODVZ_MASAK_LISTE] WHERE [LISTE_KOD] = @listeKod");
        return res.recordset[0]?.ADET ?? 0;
    }
    /**
     * Liste bazında durum: kayıt sayısı, son güncelleme, son girilen adres.
     *
     * - Standart dört liste her zaman döner; kullanıcının eklediği listeler (veri veya
     *   güncelleme geçmişinde kodu geçen) onların ardından gelir.
     * - Adres olarak EN SON DENENEN güncellemenin adresi döner (başarılı ya da değil):
     *   kullanıcı ekranda ne girdiyse bir sonraki açılışta onu görür. Hiç deneme yoksa
     *   tablodaki verinin adresi kullanılır.
     */
    static async getDurum(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await MasakSqlRepository.ensureTablesExist(pool);
        const dataRes = await pool.request().query(`
      SELECT
        [LISTE_KOD],
        MAX([LISTE_ADI])          AS [LISTE_ADI],
        COUNT(*)                  AS [KAYIT_SAYISI],
        MAX([GUNCELLEME_ZAMANI])  AS [SON_GUNCELLEME],
        MAX([KAYNAK_URL])         AS [KAYNAK_URL],
        MAX([KAYNAK_HASH])        AS [KAYNAK_HASH]
      FROM [dbo].[TODVZ_MASAK_LISTE]
      GROUP BY [LISTE_KOD];
    `);
        const logRes = await pool.request().query(`
      SELECT G.[LISTE_KOD], G.[KAYNAK_URL]
      FROM [dbo].[TODVZ_MASAK_GUNCELLEME] G
      INNER JOIN (
        SELECT [LISTE_KOD], MAX([GUNCELLEME_ID]) AS [SON_ID]
        FROM [dbo].[TODVZ_MASAK_GUNCELLEME]
        GROUP BY [LISTE_KOD]
      ) S ON S.[SON_ID] = G.[GUNCELLEME_ID];
    `);
        const logUrlMap = new Map();
        logRes.recordset.forEach((r) => logUrlMap.set(r.LISTE_KOD, r.KAYNAK_URL));
        const dataMap = new Map();
        dataRes.recordset.forEach((r) => dataMap.set(r.LISTE_KOD, r));
        // Standart kodlar sabit sırayla, ardından kullanıcı tanımlı kodlar alfabetik
        const ozelKodlar = Array.from(new Set([...dataMap.keys(), ...logUrlMap.keys()]))
            .filter((kod) => !masakStandartListeMi(kod))
            .sort((a, b) => a.localeCompare(b, "tr-TR"));
        const kodlar = [...MASAK_LISTE_KODLARI, ...ozelKodlar];
        return kodlar.map((kod) => {
            const row = dataMap.get(kod);
            return {
                listeKod: kod,
                listeAdi: row?.LISTE_ADI ?? null,
                kayitSayisi: row?.KAYIT_SAYISI ?? 0,
                sonGuncelleme: MasakSqlRepository.formatIso(row?.SON_GUNCELLEME ?? null),
                kaynakUrl: logUrlMap.get(kod) ?? row?.KAYNAK_URL ?? null,
                kaynakHash: row?.KAYNAK_HASH ?? null,
            };
        });
    }
    /**
     * Kullanıcı tanımlı bir listeyi tamamen kaldırır: verisi ve güncelleme geçmişi silinir,
     * böylece durum ekranında bir daha görünmez. Standart listeler için çağrılmaz (servis engeller).
     */
    static async deleteListe(listeKod, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await MasakSqlRepository.ensureTablesExist(pool);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const veri = await new sql.Request(tx)
                .input("listeKod", sql.VarChar(10), listeKod)
                .query("DELETE FROM [dbo].[TODVZ_MASAK_LISTE] WHERE [LISTE_KOD] = @listeKod");
            const gecmis = await new sql.Request(tx)
                .input("listeKod", sql.VarChar(10), listeKod)
                .query("DELETE FROM [dbo].[TODVZ_MASAK_GUNCELLEME] WHERE [LISTE_KOD] = @listeKod");
            await tx.commit();
            return {
                silinenKayit: veri.rowsAffected[0] ?? 0,
                silinenGecmis: gecmis.rowsAffected[0] ?? 0,
            };
        }
        catch (error) {
            await tx.rollback();
            throw error;
        }
    }
    /**
     * Bir listenin tüm kayıtlarını yenisiyle değiştirir (tam değişim).
     * DELETE + toplu INSERT tek transaction içinde yapılır; hata olursa hiçbir şey değişmez.
     */
    static async replaceListe(listeKod, kayitlar, meta, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await MasakSqlRepository.ensureTablesExist(pool);
        const zaman = new Date();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            const delReq = new sql.Request(transaction);
            delReq.input("listeKod", sql.VarChar(10), listeKod);
            await delReq.query("DELETE FROM [dbo].[TODVZ_MASAK_LISTE] WHERE [LISTE_KOD] = @listeKod");
            if (kayitlar.length > 0) {
                const table = new sql.Table("[dbo].[TODVZ_MASAK_LISTE]");
                table.create = false;
                table.columns.add("LISTE_KOD", sql.VarChar(10), { nullable: false });
                table.columns.add("LISTE_ADI", sql.NVarChar(200), { nullable: true });
                table.columns.add("SIRA_NO", sql.Int, { nullable: true });
                table.columns.add("AD_UNVAN", sql.NVarChar(500), { nullable: false });
                table.columns.add("AD_UNVAN_NORM", sql.NVarChar(500), { nullable: true });
                table.columns.add("KAYIT_TIPI", sql.VarChar(10), { nullable: true });
                table.columns.add("KIMLIK_NO", sql.NVarChar(1000), { nullable: true });
                table.columns.add("TCKN", sql.VarChar(11), { nullable: true });
                table.columns.add("VKN", sql.VarChar(10), { nullable: true });
                table.columns.add("DIGER_ISIMLER", sql.NVarChar(sql.MAX), { nullable: true });
                table.columns.add("DIGER_ISIMLER_NORM", sql.NVarChar(sql.MAX), { nullable: true });
                table.columns.add("ORIJINAL_AD", sql.NVarChar(500), { nullable: true });
                table.columns.add("ESKI_ADI", sql.NVarChar(500), { nullable: true });
                table.columns.add("GOREVI", sql.NVarChar(500), { nullable: true });
                table.columns.add("ADRES", sql.NVarChar(sql.MAX), { nullable: true });
                table.columns.add("UYRUK", sql.NVarChar(200), { nullable: true });
                table.columns.add("DIGER_UYRUK", sql.NVarChar(300), { nullable: true });
                table.columns.add("YAPTIRIM_TURU", sql.NVarChar(200), { nullable: true });
                table.columns.add("ANNE_ADI", sql.NVarChar(150), { nullable: true });
                table.columns.add("BABA_ADI", sql.NVarChar(150), { nullable: true });
                table.columns.add("DOGUM_TARIHI", sql.NVarChar(300), { nullable: true });
                table.columns.add("DOGUM_TARIHI_DT", sql.Date, { nullable: true });
                table.columns.add("DOGUM_YERI", sql.NVarChar(300), { nullable: true });
                table.columns.add("ORGUT", sql.NVarChar(300), { nullable: true });
                table.columns.add("KURULUS_YAPISI", sql.NVarChar(300), { nullable: true });
                table.columns.add("LISTEYE_ALINMA", sql.NVarChar(300), { nullable: true });
                table.columns.add("KARAR_BILGI", sql.NVarChar(300), { nullable: true });
                table.columns.add("RESMI_GAZETE", sql.NVarChar(300), { nullable: true });
                table.columns.add("DIGER_BILGILER", sql.NVarChar(sql.MAX), { nullable: true });
                table.columns.add("EK_BILGI", sql.NVarChar(sql.MAX), { nullable: true });
                table.columns.add("KAYNAK_URL", sql.NVarChar(1000), { nullable: true });
                table.columns.add("KAYNAK_HASH", sql.VarChar(64), { nullable: true });
                table.columns.add("GUNCELLEME_ZAMANI", sql.DateTime, { nullable: false });
                table.columns.add("AKTIF", sql.Bit, { nullable: false });
                const kes = MasakSqlRepository.kes;
                const listeAdi = kes(meta.listeAdi, 200);
                const kaynakUrl = kes(meta.kaynakUrl, 1000);
                const kaynakHash = kes(meta.kaynakHash, 64);
                for (const k of kayitlar) {
                    table.rows.add(listeKod, kes(k.listeAdi, 200) ?? listeAdi, k.siraNo ?? null, kes(k.adUnvan, 500) ?? "", kes(k.adUnvanNorm, 500), kes(k.kayitTipi, 10), kes(k.kimlikNo, 1000), kes(k.tckn, 11), kes(k.vkn, 10), k.digerIsimler || null, k.digerIsimlerNorm || null, kes(k.orijinalAd, 500), kes(k.eskiAdi, 500), kes(k.gorevi, 500), k.adres || null, kes(k.uyruk, 200), kes(k.digerUyruk, 300), kes(k.yaptirimTuru, 200), kes(k.anneAdi, 150), kes(k.babaAdi, 150), kes(k.dogumTarihi, 300), k.dogumTarihiDt ?? null, kes(k.dogumYeri, 300), kes(k.orgut, 300), kes(k.kurulusYapisi, 300), kes(k.listeyeAlinma, 300), kes(k.kararBilgi, 300), kes(k.resmiGazete, 300), k.digerBilgiler || null, k.ekBilgi || null, kaynakUrl, kaynakHash, zaman, true);
                }
                const bulkReq = new sql.Request(transaction);
                await bulkReq.bulk(table);
            }
            await transaction.commit();
            return kayitlar.length;
        }
        catch (error) {
            try {
                await transaction.rollback();
            }
            catch (rollbackError) {
                logger.error("MasakSqlRepository.replaceListe rollback error:", rollbackError);
            }
            logger.error(`MasakSqlRepository.replaceListe error (${listeKod}):`, error);
            throw error;
        }
    }
    /**
     * Güncelleme denemesini (başarılı/başarısız) geçmiş tablosuna yazar.
     */
    static async logGuncelleme(dto, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await MasakSqlRepository.ensureTablesExist(pool);
        const kes = MasakSqlRepository.kes;
        try {
            const res = await pool
                .request()
                .input("LISTE_KOD", sql.VarChar(10), dto.listeKod)
                .input("BASLAMA_ZAMANI", sql.DateTime, dto.baslamaZamani)
                .input("BITIS_ZAMANI", sql.DateTime, dto.bitisZamani ?? null)
                .input("SURE_MS", sql.Int, dto.sureMs ?? null)
                .input("DURUM", sql.VarChar(15), dto.durum)
                .input("KAYIT_SAYISI", sql.Int, dto.kayitSayisi ?? null)
                .input("ONCEKI_KAYIT_SAYISI", sql.Int, dto.oncekiKayitSayisi ?? null)
                .input("KAYNAK_URL", sql.NVarChar(1000), kes(dto.kaynakUrl, 1000))
                .input("KAYNAK_HASH", sql.VarChar(64), kes(dto.kaynakHash, 64))
                .input("DOSYA_BOYUTU", sql.Int, dto.dosyaBoyutu ?? null)
                .input("KULLANICI_ADI", sql.NVarChar(100), kes(dto.kullaniciAdi, 100))
                .input("KULLANICI_ID", sql.NVarChar(50), kes(dto.kullaniciId, 50))
                .input("HATA_MESAJI", sql.NVarChar(1000), kes(dto.hataMesaji, 1000))
                .query(`
          INSERT INTO [dbo].[TODVZ_MASAK_GUNCELLEME] (
            [LISTE_KOD], [BASLAMA_ZAMANI], [BITIS_ZAMANI], [SURE_MS], [DURUM],
            [KAYIT_SAYISI], [ONCEKI_KAYIT_SAYISI], [KAYNAK_URL], [KAYNAK_HASH],
            [DOSYA_BOYUTU], [KULLANICI_ADI], [KULLANICI_ID], [HATA_MESAJI]
          )
          VALUES (
            @LISTE_KOD, @BASLAMA_ZAMANI, @BITIS_ZAMANI, @SURE_MS, @DURUM,
            @KAYIT_SAYISI, @ONCEKI_KAYIT_SAYISI, @KAYNAK_URL, @KAYNAK_HASH,
            @DOSYA_BOYUTU, @KULLANICI_ADI, @KULLANICI_ID, @HATA_MESAJI
          );
          SELECT CAST(SCOPE_IDENTITY() AS INT) AS [GUNCELLEME_ID];
        `);
            return res.recordset[0]?.GUNCELLEME_ID ?? 0;
        }
        catch (error) {
            // Log yazımı, güncellemenin kendisini bozmamalı
            logger.error("MasakSqlRepository.logGuncelleme error:", error);
            return 0;
        }
    }
    /**
     * Güncelleme geçmişi (en yeniden eskiye)
     */
    static async getGecmis(params = {}, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await MasakSqlRepository.ensureTablesExist(pool);
        const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 500);
        const req = pool.request().input("limit", sql.Int, limit);
        let query = `
      SELECT TOP (@limit) *
      FROM [dbo].[TODVZ_MASAK_GUNCELLEME]
    `;
        if (params.listeKod) {
            req.input("listeKod", sql.VarChar(10), params.listeKod);
            query += " WHERE [LISTE_KOD] = @listeKod";
        }
        query += " ORDER BY [GUNCELLEME_ID] DESC;";
        const res = await req.query(query);
        return res.recordset.map((r) => ({
            guncellemeId: r.GUNCELLEME_ID,
            listeKod: r.LISTE_KOD,
            baslamaZamani: r.BASLAMA_ZAMANI,
            bitisZamani: r.BITIS_ZAMANI,
            sureMs: r.SURE_MS,
            durum: (r.DURUM === "BASARILI" ? "BASARILI" : "HATA"),
            kayitSayisi: r.KAYIT_SAYISI,
            oncekiKayitSayisi: r.ONCEKI_KAYIT_SAYISI,
            kaynakUrl: r.KAYNAK_URL,
            kaynakHash: r.KAYNAK_HASH,
            dosyaBoyutu: r.DOSYA_BOYUTU,
            kullaniciAdi: r.KULLANICI_ADI,
            kullaniciId: r.KULLANICI_ID,
            hataMesaji: r.HATA_MESAJI,
        }));
    }
    /** SELECT * satırını API modeline çevirir */
    static mapKayit(r) {
        let ek = null;
        if (r.EK_BILGI) {
            try {
                ek = JSON.parse(r.EK_BILGI);
            }
            catch {
                ek = null;
            }
        }
        return {
            masakId: r.MASAK_ID,
            listeKod: r.LISTE_KOD,
            listeAdi: r.LISTE_ADI ?? null,
            siraNo: r.SIRA_NO ?? null,
            adUnvan: r.AD_UNVAN,
            adUnvanNorm: r.AD_UNVAN_NORM ?? null,
            kayitTipi: r.KAYIT_TIPI ?? null,
            kimlikNo: r.KIMLIK_NO ?? null,
            tckn: r.TCKN ?? null,
            vkn: r.VKN ?? null,
            digerIsimler: r.DIGER_ISIMLER ?? null,
            orijinalAd: r.ORIJINAL_AD ?? null,
            eskiAdi: r.ESKI_ADI ?? null,
            gorevi: r.GOREVI ?? null,
            adres: r.ADRES ?? null,
            uyruk: r.UYRUK ?? null,
            digerUyruk: r.DIGER_UYRUK ?? null,
            yaptirimTuru: r.YAPTIRIM_TURU ?? null,
            anneAdi: r.ANNE_ADI ?? null,
            babaAdi: r.BABA_ADI ?? null,
            dogumTarihi: r.DOGUM_TARIHI ?? null,
            dogumTarihiDt: r.DOGUM_TARIHI_DT
                ? new Date(r.DOGUM_TARIHI_DT).toISOString().slice(0, 10)
                : null,
            dogumYeri: r.DOGUM_YERI ?? null,
            orgut: r.ORGUT ?? null,
            kurulusYapisi: r.KURULUS_YAPISI ?? null,
            listeyeAlinma: r.LISTEYE_ALINMA ?? null,
            kararBilgi: r.KARAR_BILGI ?? null,
            resmiGazete: r.RESMI_GAZETE ?? null,
            digerBilgiler: r.DIGER_BILGILER ?? null,
            ekBilgi: ek,
            kaynakUrl: r.KAYNAK_URL ?? null,
            guncellemeZamani: MasakSqlRepository.formatIso(r.GUNCELLEME_ZAMANI ?? null),
        };
    }
    /** LIKE kalıbındaki joker karakterleri etkisizleştirir */
    static likeKacir(value) {
        return value.replace(/[\[\]%_]/g, (ch) => `[${ch}]`);
    }
    /**
     * Sayfalı listeleme + arama (MASAK grid ekranı).
     * Normalizasyon servis katmanında yapılır; buraya normalize edilmiş metin gelir.
     */
    static async listele(params, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await MasakSqlRepository.ensureTablesExist(pool);
        const page = Math.max(Number(params.page) || 1, 1);
        const pageSize = Math.min(Math.max(Number(params.pageSize) || 50, 1), 500);
        const kosullar = [];
        const req = pool.request();
        const sayimReq = pool.request();
        const ekle = (isim, tip, deger) => {
            req.input(isim, tip, deger);
            sayimReq.input(isim, tip, deger);
        };
        if (params.listeKod) {
            ekle("listeKod", sql.VarChar(10), params.listeKod);
            kosullar.push("[LISTE_KOD] = @listeKod");
        }
        if (params.qNorm && params.qNorm.trim()) {
            ekle("q", sql.NVarChar(500), `%${MasakSqlRepository.likeKacir(params.qNorm.trim())}%`);
            kosullar.push("([AD_UNVAN_NORM] LIKE @q ESCAPE '[' OR [DIGER_ISIMLER_NORM] LIKE @q ESCAPE '[')");
        }
        if (params.kimlikNo && params.kimlikNo.trim()) {
            const k = params.kimlikNo.trim();
            ekle("kimlikTam", sql.VarChar(20), k);
            ekle("kimlikLike", sql.NVarChar(1000), `%${MasakSqlRepository.likeKacir(k)}%`);
            kosullar.push("([TCKN] = @kimlikTam OR [VKN] = @kimlikTam OR [KIMLIK_NO] LIKE @kimlikLike ESCAPE '[')");
        }
        const where = kosullar.length ? `WHERE ${kosullar.join(" AND ")}` : "";
        const sayimRes = await sayimReq.query(`SELECT COUNT(*) AS [TOPLAM] FROM [dbo].[TODVZ_MASAK_LISTE] ${where};`);
        const toplam = sayimRes.recordset[0]?.TOPLAM ?? 0;
        req.input("offset", sql.Int, (page - 1) * pageSize);
        req.input("limit", sql.Int, pageSize);
        const res = await req.query(`
      SELECT *
      FROM [dbo].[TODVZ_MASAK_LISTE]
      ${where}
      ORDER BY [LISTE_KOD] ASC, ISNULL([SIRA_NO], 999999) ASC, [MASAK_ID] ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `);
        return {
            kayitlar: res.recordset.map((r) => MasakSqlRepository.mapKayit(r)),
            toplam,
            page,
            pageSize,
        };
    }
    /** Tek kaydın tüm alanları (Detay ekranı) */
    static async findById(id, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await MasakSqlRepository.ensureTablesExist(pool);
        const res = await pool
            .request()
            .input("id", sql.Int, id)
            .query("SELECT TOP 1 * FROM [dbo].[TODVZ_MASAK_LISTE] WHERE [MASAK_ID] = @id;");
        if (!res.recordset.length)
            return null;
        return MasakSqlRepository.mapKayit(res.recordset[0]);
    }
    /**
     * Eşleşme sorgusu (fiş / fatura / cari kontrolü).
     * Skor: 100 kimlik tam, 90 ad tam, 70 alias, 50 kelime bazlı.
     */
    static async sorgula(params, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await MasakSqlRepository.ensureTablesExist(pool);
        const kimlik = params.kimlikNo?.trim() || null;
        const adNorm = params.adNorm?.trim() || null;
        const kelimeler = (params.kelimeler || []).filter((k) => k && k.length >= 2).slice(0, 6);
        const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
        if (!kimlik && !adNorm)
            return [];
        const req = pool.request();
        req.input("limit", sql.Int, limit);
        req.input("kimlik", sql.VarChar(20), kimlik);
        req.input("adNorm", sql.NVarChar(500), adNorm);
        req.input("adLike", sql.NVarChar(500), adNorm ? `%${MasakSqlRepository.likeKacir(adNorm)}%` : null);
        const orKosullar = [];
        if (kimlik) {
            orKosullar.push("([TCKN] = @kimlik OR [VKN] = @kimlik)");
        }
        if (adNorm) {
            orKosullar.push("[AD_UNVAN_NORM] = @adNorm");
            orKosullar.push("[DIGER_ISIMLER_NORM] LIKE @adLike ESCAPE '['");
        }
        // Kelime bazlı: sorgudaki tüm kelimeler ad içinde geçiyorsa (sıra fark etmez)
        if (kelimeler.length) {
            const kelimeKosullari = kelimeler.map((kelime, i) => {
                req.input(`w${i}`, sql.NVarChar(200), `%${MasakSqlRepository.likeKacir(kelime)}%`);
                return `[AD_UNVAN_NORM] LIKE @w${i} ESCAPE '['`;
            });
            orKosullar.push(`(${kelimeKosullari.join(" AND ")})`);
        }
        const res = await req.query(`
      SELECT TOP (@limit) *,
        CASE
          WHEN @kimlik IS NOT NULL AND ([TCKN] = @kimlik OR [VKN] = @kimlik) THEN 100
          WHEN @adNorm IS NOT NULL AND [AD_UNVAN_NORM] = @adNorm THEN 90
          WHEN @adLike IS NOT NULL AND [DIGER_ISIMLER_NORM] LIKE @adLike ESCAPE '[' THEN 70
          ELSE 50
        END AS [SKOR]
      FROM [dbo].[TODVZ_MASAK_LISTE]
      WHERE ${orKosullar.join(" OR ")}
      ORDER BY [SKOR] DESC, [LISTE_KOD] ASC, ISNULL([SIRA_NO], 999999) ASC;
    `);
        const dogum = params.dogumTarihiDt
            ? params.dogumTarihiDt.toISOString().slice(0, 10)
            : null;
        return res.recordset.map((r) => {
            const kayit = MasakSqlRepository.mapKayit(r);
            const skor = r.SKOR ?? 50;
            const eslesmeTipi = skor === 100
                ? "KIMLIK_TAM"
                : skor === 90
                    ? "AD_TAM"
                    : skor === 70
                        ? "ALIAS_TAM"
                        : "AD_KELIME";
            return {
                ...kayit,
                skor,
                eslesmeTipi,
                dogumUyumlu: dogum && kayit.dogumTarihiDt ? kayit.dogumTarihiDt === dogum : null,
            };
        });
    }
}
