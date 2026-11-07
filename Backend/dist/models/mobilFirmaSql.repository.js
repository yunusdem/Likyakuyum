import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { ApiError } from "../utils/ApiError.js";
import { BOS_CARI_AYAR, VARSAYILAN_AYAR } from "../services/mobil/mobilKural.js";
const havuz = (ctx) => getDbPool(ctx.dbServer, ctx.dbName);
const cariOzet = (r) => ({
    cariKartId: r.CARI_KART_ID,
    kod: String(r.KOD ?? "").trim(),
    ad: String(r.AD ?? "").trim(),
    eposta: r.EPOSTA ? String(r.EPOSTA).trim() || null : null,
    telefon: r.TELEFON ? String(r.TELEFON).trim() || null : null,
    vergiKimlikNo: r.VERGI_KIMLIK_NO ? String(r.VERGI_KIMLIK_NO).trim() || null : null,
    bakiyeSiniri: r.CARI_BAKIYE_SINIRI === null || r.CARI_BAKIYE_SINIRI === undefined ? null : Number(r.CARI_BAKIYE_SINIRI),
});
const sayi = (v) => (v === null || v === undefined ? null : Number(v));
const bit = (v) => (v === null || v === undefined ? null : !!v);
export class MobilFirmaSqlRepository {
    /** Göç 024 bu veritabanında uygulanmış mı */
    static async semaVarMi(ctx) {
        const r = await (await havuz(ctx)).request().query(`SELECT CAST(CASE WHEN OBJECT_ID('dbo.LKY_MOBIL_AYAR') IS NOT NULL AND OBJECT_ID('dbo.LKY_MOBIL_EMIR_SATIRI') IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS V`);
        return !!r.recordset[0].V;
    }
    static async semaGerekli(ctx) {
        if (!(await this.semaVarMi(ctx)))
            throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Mobil tabloları bu veritabanında yok (göç 024 uygulanmamış).", { kod: "MOBIL_GOC_YOK" });
    }
    // ------------------------------------------------------------------ Cari kart ---
    static async cari(ctx, cariKartId) {
        const r = await (await havuz(ctx))
            .request()
            .input("id", sql.Int, cariKartId)
            .query(`SELECT CARI_KART_ID, KOD, AD, EPOSTA, TELEFON, VERGI_KIMLIK_NO, CARI_BAKIYE_SINIRI FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID = @id`);
        return r.recordset[0] ? cariOzet(r.recordset[0]) : null;
    }
    /** Karşı veritabanında cari arama (K25): kod, ad ya da vergi/kimlik no */
    static async cariAra(ctx, aranan, adet = 30) {
        const q = aranan.trim();
        const r = await (await havuz(ctx))
            .request()
            .input("q", sql.NVarChar(100), `%${q}%`)
            .input("bas", sql.NVarChar(100), `${q}%`)
            .input("adet", sql.Int, adet)
            .query(`SELECT TOP (@adet) CARI_KART_ID, KOD, AD, EPOSTA, TELEFON, VERGI_KIMLIK_NO, CARI_BAKIYE_SINIRI FROM dbo.TODVZ_CARI_KART
              WHERE (@q = N'%%' OR KOD LIKE @bas OR AD LIKE @q OR VERGI_KIMLIK_NO LIKE @bas)
              ORDER BY CASE WHEN KOD LIKE @bas THEN 0 ELSE 1 END, AD`);
        return r.recordset.map(cariOzet);
    }
    static async vezneVarMi(ctx, vezneId) {
        const r = await (await havuz(ctx)).request().input("id", sql.Int, vezneId).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_VEZNE WHERE VEZNE_ID = @id`);
        return Number(r.recordset[0].N) > 0;
    }
    static async kullaniciVarMi(ctx, kullaniciId) {
        const r = await (await havuz(ctx)).request().input("id", sql.Int, kullaniciId).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @id`);
        return Number(r.recordset[0].N) > 0;
    }
    // ------------------------------------------------------------------ Firma ayarı ---
    static async ayar(ctx) {
        await this.semaGerekli(ctx);
        const r = await (await havuz(ctx)).request().query(`SELECT * FROM dbo.LKY_MOBIL_AYAR WHERE ID = 1`);
        const x = r.recordset[0];
        if (!x)
            return { ...VARSAYILAN_AYAR, tercihler: [...VARSAYILAN_AYAR.tercihler] };
        return {
            emirAcik: !!x.EMIR_ACIK,
            vezneId: sayi(x.VEZNE_ID),
            kullaniciId: sayi(x.KULLANICI_ID),
            bildirimEposta: String(x.BILDIRIM_EPOSTA ?? "").split(",").map((s) => s.trim()).filter(Boolean),
            fiyatGecerlilikSn: Number(x.FIYAT_GECERLILIK_SN) || VARSAYILAN_AYAR.fiyatGecerlilikSn,
            calismaBaslangic: x.CALISMA_BASLANGIC ? String(x.CALISMA_BASLANGIC).trim() : null,
            calismaBitis: x.CALISMA_BITIS ? String(x.CALISMA_BITIS).trim() : null,
            calismaGunleri: String(x.CALISMA_GUNLERI ?? VARSAYILAN_AYAR.calismaGunleri).trim(),
            islemEnAzTl: sayi(x.ISLEM_EN_AZ_TL),
            islemEnCokTl: sayi(x.ISLEM_EN_COK_TL),
            gunlukLimitTl: sayi(x.GUNLUK_LIMIT_TL),
            bakiyeSiniriUygula: !!x.BAKIYE_SINIRI_UYGULA,
            tercihler: String(x.TERCIHLER ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        };
    }
    static async ayarYaz(ctx, a, kim) {
        await this.semaGerekli(ctx);
        await (await havuz(ctx))
            .request()
            .input("emir", sql.Bit, a.emirAcik)
            .input("vezne", sql.Int, a.vezneId)
            .input("kullanici", sql.Int, a.kullaniciId)
            .input("eposta", sql.NVarChar(500), a.bildirimEposta.join(",") || null)
            .input("sure", sql.Int, a.fiyatGecerlilikSn)
            .input("bas", sql.Char(5), a.calismaBaslangic)
            .input("bit", sql.Char(5), a.calismaBitis)
            .input("gun", sql.Char(7), a.calismaGunleri)
            .input("enAz", sql.Decimal(18, 2), a.islemEnAzTl)
            .input("enCok", sql.Decimal(18, 2), a.islemEnCokTl)
            .input("gunluk", sql.Decimal(18, 2), a.gunlukLimitTl)
            .input("bakiye", sql.Bit, a.bakiyeSiniriUygula)
            .input("tercih", sql.VarChar(100), a.tercihler.join(","))
            .input("kim", sql.NVarChar(100), kim).query(`
        MERGE dbo.LKY_MOBIL_AYAR WITH (HOLDLOCK) AS h USING (SELECT CAST(1 AS tinyint) AS ID) AS k ON h.ID = k.ID
        WHEN MATCHED THEN UPDATE SET EMIR_ACIK = @emir, VEZNE_ID = @vezne, KULLANICI_ID = @kullanici, BILDIRIM_EPOSTA = @eposta,
          FIYAT_GECERLILIK_SN = @sure, CALISMA_BASLANGIC = @bas, CALISMA_BITIS = @bit, CALISMA_GUNLERI = @gun, ISLEM_EN_AZ_TL = @enAz,
          ISLEM_EN_COK_TL = @enCok, GUNLUK_LIMIT_TL = @gunluk, BAKIYE_SINIRI_UYGULA = @bakiye, TERCIHLER = @tercih,
          GUNCELLEYEN = @kim, GUNCELLEME_TARIHI = GETDATE()
        WHEN NOT MATCHED THEN INSERT (ID, EMIR_ACIK, VEZNE_ID, KULLANICI_ID, BILDIRIM_EPOSTA, FIYAT_GECERLILIK_SN, CALISMA_BASLANGIC, CALISMA_BITIS,
          CALISMA_GUNLERI, ISLEM_EN_AZ_TL, ISLEM_EN_COK_TL, GUNLUK_LIMIT_TL, BAKIYE_SINIRI_UYGULA, TERCIHLER, GUNCELLEYEN, GUNCELLEME_TARIHI)
          VALUES (1, @emir, @vezne, @kullanici, @eposta, @sure, @bas, @bit, @gun, @enAz, @enCok, @gunluk, @bakiye, @tercih, @kim, GETDATE());`);
    }
    // ------------------------------------------------------------------ Cari ayarı (K20) ---
    static async cariAyar(ctx, cariKartId) {
        await this.semaGerekli(ctx);
        const r = await (await havuz(ctx)).request().input("id", sql.Int, cariKartId).query(`SELECT * FROM dbo.LKY_MOBIL_CARI_AYAR WHERE CARI_KART_ID = @id`);
        const x = r.recordset[0];
        if (!x)
            return { ...BOS_CARI_AYAR };
        return {
            emirAcik: bit(x.EMIR_ACIK),
            islemEnAzTl: sayi(x.ISLEM_EN_AZ_TL),
            islemEnCokTl: sayi(x.ISLEM_EN_COK_TL),
            gunlukLimitTl: sayi(x.GUNLUK_LIMIT_TL),
            bakiyeSiniriUygula: bit(x.BAKIYE_SINIRI_UYGULA),
            calismaBaslangic: x.CALISMA_BASLANGIC ? String(x.CALISMA_BASLANGIC).trim() : null,
            calismaBitis: x.CALISMA_BITIS ? String(x.CALISMA_BITIS).trim() : null,
            fiyatGecerlilikSn: sayi(x.FIYAT_GECERLILIK_SN),
        };
    }
    static async cariAyarYaz(ctx, cariKartId, a, kim) {
        await this.semaGerekli(ctx);
        await (await havuz(ctx))
            .request()
            .input("id", sql.Int, cariKartId)
            .input("emir", sql.Bit, a.emirAcik)
            .input("enAz", sql.Decimal(18, 2), a.islemEnAzTl)
            .input("enCok", sql.Decimal(18, 2), a.islemEnCokTl)
            .input("gunluk", sql.Decimal(18, 2), a.gunlukLimitTl)
            .input("bakiye", sql.Bit, a.bakiyeSiniriUygula)
            .input("bas", sql.Char(5), a.calismaBaslangic)
            .input("bit", sql.Char(5), a.calismaBitis)
            .input("sure", sql.Int, a.fiyatGecerlilikSn)
            .input("kim", sql.NVarChar(100), kim).query(`
        MERGE dbo.LKY_MOBIL_CARI_AYAR WITH (HOLDLOCK) AS h USING (SELECT @id AS CARI_KART_ID) AS k ON h.CARI_KART_ID = k.CARI_KART_ID
        WHEN MATCHED THEN UPDATE SET EMIR_ACIK = @emir, ISLEM_EN_AZ_TL = @enAz, ISLEM_EN_COK_TL = @enCok, GUNLUK_LIMIT_TL = @gunluk,
          BAKIYE_SINIRI_UYGULA = @bakiye, CALISMA_BASLANGIC = @bas, CALISMA_BITIS = @bit, FIYAT_GECERLILIK_SN = @sure,
          GUNCELLEYEN = @kim, GUNCELLEME_TARIHI = GETDATE()
        WHEN NOT MATCHED THEN INSERT (CARI_KART_ID, EMIR_ACIK, ISLEM_EN_AZ_TL, ISLEM_EN_COK_TL, GUNLUK_LIMIT_TL, BAKIYE_SINIRI_UYGULA,
          CALISMA_BASLANGIC, CALISMA_BITIS, FIYAT_GECERLILIK_SN, GUNCELLEYEN, GUNCELLEME_TARIHI)
          VALUES (@id, @emir, @enAz, @enCok, @gunluk, @bakiye, @bas, @bit, @sure, @kim, GETDATE());`);
    }
    // ------------------------------------------------------------------ Ürünler ve fiyat (Faz 4) ---
    /** Döviz / altın / gümüş / ziynet ürünleri (TL hariç) ve mobilde görünüp görünmediği */
    static async paraUrunleri(ctx) {
        await this.semaGerekli(ctx);
        const r = await (await havuz(ctx)).request().query(`
      SELECT P.PARA_ID, P.KOD, P.AD, P.URUN_TIPI, P.BIRIM, P.SIRA_NO, U.SIRA AS MOBIL_SIRA
      FROM dbo.TODVZ_PARA P
      LEFT JOIN dbo.LKY_MOBIL_URUN U ON U.TUR = 'PARA' AND U.URUN_ID = P.PARA_ID
      WHERE UPPER(LTRIM(RTRIM(ISNULL(P.KOD, '')))) NOT IN ('TL', 'TRY', 'TL.', 'YTL', 'TRL')
      ORDER BY CASE WHEN U.SIRA IS NULL THEN 1 ELSE 0 END, U.SIRA, P.SIRA_NO, P.PARA_ID`);
        return r.recordset.map((x) => ({
            urunId: x.PARA_ID,
            kod: String(x.KOD ?? "").trim(),
            ad: String(x.AD ?? "").trim(),
            urunTipi: x.URUN_TIPI === null || x.URUN_TIPI === undefined ? null : Number(x.URUN_TIPI),
            birim: x.BIRIM === null || x.BIRIM === undefined ? null : Number(x.BIRIM),
            secili: x.MOBIL_SIRA !== null && x.MOBIL_SIRA !== undefined,
            sira: x.MOBIL_SIRA ?? null,
        }));
    }
    /** Mobilde görünen ürünleri (verilen sırayla) yazar; listede olmayanlar kalkar */
    /** Mobil katalogdaki stok kartları (sırasıyla). Ticari tabloları burada kurulmaz: seçim yoksa boş döner. */
    static async stokSecimi(ctx) {
        await this.semaGerekli(ctx);
        const r = await (await havuz(ctx)).request().query(`SELECT URUN_ID FROM dbo.LKY_MOBIL_URUN WHERE TUR = 'STOK' ORDER BY SIRA, URUN_ID`);
        return r.recordset.map((x) => Number(x.URUN_ID));
    }
    static async urunSecimiYaz(ctx, tur, urunIdleri) {
        await this.semaGerekli(ctx);
        const pool = await havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx).input("tur", sql.VarChar(10), tur).query(`DELETE FROM dbo.LKY_MOBIL_URUN WHERE TUR = @tur`);
            let sira = 1;
            for (const id of urunIdleri) {
                await new sql.Request(tx)
                    .input("tur", sql.VarChar(10), tur)
                    .input("id", sql.Int, id)
                    .input("sira", sql.Int, sira++)
                    .query(`INSERT INTO dbo.LKY_MOBIL_URUN (TUR, URUN_ID, SIRA) VALUES (@tur, @id, @sira)`);
            }
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
    }
    /**
     * Anlık Fiyat Listesi'nin son kaydı (TUR 0 gişe kuru; fişlerin ve LED panonun kullandığı tablo). Altınlar listede F12 ile
     * hesaplanıp kaydedildiği için burada ayrıca hesaplanmaz. Efektif (komisyonlu) fiyat; yoksa döviz kuru.
     */
    static async sonFiyatlar(ctx) {
        const r = await (await havuz(ctx)).request().query(`
      DECLARE @id int = (SELECT TOP 1 KUR_TABLOSU_ID FROM dbo.TODVZ_KUR_TABLOSU WHERE TUR = 0 ORDER BY ZAMAN DESC, KUR_TABLOSU_ID DESC);
      SELECT (SELECT ZAMAN FROM dbo.TODVZ_KUR_TABLOSU WHERE KUR_TABLOSU_ID = @id) AS ZAMAN;
      SELECT PARA_ID,
             ISNULL(NULLIF(EFEKTIF_ALIS, 0), NULLIF(DOVIZ_ALIS, 0)) AS ALIS,
             ISNULL(NULLIF(EFEKTIF_SATIS, 0), NULLIF(DOVIZ_SATIS, 0)) AS SATIS
      FROM dbo.TODVZ_KUR WHERE KUR_TABLOSU_ID = @id;`);
        const setler = r.recordsets;
        const fiyatlar = new Map();
        for (const x of setler[1] || []) {
            fiyatlar.set(Number(x.PARA_ID), { alis: x.ALIS === null ? null : Number(x.ALIS), satis: x.SATIS === null ? null : Number(x.SATIS) });
        }
        return { zaman: setler[0]?.[0]?.ZAMAN ?? null, fiyatlar };
    }
    /** Kur küsurat sayısı (firma tanımı; yoksa 6) */
    static async kurOndalik(ctx) {
        const r = await (await havuz(ctx))
            .request()
            .query(`SELECT TOP 1 CASE WHEN COL_LENGTH('dbo.TODVZ_TANIM', 'KUR_KURUS_SAYISI') IS NULL THEN 6 ELSE NULL END AS V`);
        if (r.recordset[0]?.V === 6)
            return 6;
        const t = await (await havuz(ctx)).request().query(`SELECT TOP 1 KUR_KURUS_SAYISI AS K FROM dbo.TODVZ_TANIM`);
        const k = Number(t.recordset[0]?.K);
        return Number.isInteger(k) && k >= 0 && k <= 8 ? k : 6;
    }
    static async cariMakaslari(ctx, cariKartId, tur = "PARA") {
        await this.semaGerekli(ctx);
        const r = await (await havuz(ctx))
            .request()
            .input("id", sql.Int, cariKartId)
            .input("tur", sql.VarChar(10), tur)
            .query(`SELECT URUN_ID, ALIS_TIP, ALIS_DEGER, SATIS_TIP, SATIS_DEGER FROM dbo.LKY_MOBIL_CARI_MAKAS WHERE CARI_KART_ID = @id AND TUR = @tur`);
        const m = new Map();
        for (const x of r.recordset)
            m.set(Number(x.URUN_ID), {
                alisTip: String(x.ALIS_TIP).trim() === "T" ? "T" : "Y",
                alisDeger: Number(x.ALIS_DEGER) || 0,
                satisTip: String(x.SATIS_TIP).trim() === "T" ? "T" : "Y",
                satisDeger: Number(x.SATIS_DEGER) || 0,
            });
        return m;
    }
    /** Cari makasları: boş makas satırı silinir, diğerleri yazılır (tek işlem) */
    static async cariMakasYaz(ctx, cariKartId, tur, satirlar) {
        await this.semaGerekli(ctx);
        const pool = await havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx)
                .input("id", sql.Int, cariKartId)
                .input("tur", sql.VarChar(10), tur)
                .query(`DELETE FROM dbo.LKY_MOBIL_CARI_MAKAS WHERE CARI_KART_ID = @id AND TUR = @tur`);
            for (const s of satirlar) {
                if (!s.makas.alisDeger && !s.makas.satisDeger)
                    continue;
                await new sql.Request(tx)
                    .input("id", sql.Int, cariKartId)
                    .input("tur", sql.VarChar(10), tur)
                    .input("urun", sql.Int, s.urunId)
                    .input("at", sql.Char(1), s.makas.alisTip)
                    .input("ad", sql.Decimal(18, 6), s.makas.alisDeger)
                    .input("st", sql.Char(1), s.makas.satisTip)
                    .input("sd", sql.Decimal(18, 6), s.makas.satisDeger)
                    .query(`INSERT INTO dbo.LKY_MOBIL_CARI_MAKAS (CARI_KART_ID, TUR, URUN_ID, ALIS_TIP, ALIS_DEGER, SATIS_TIP, SATIS_DEGER)
                  VALUES (@id, @tur, @urun, @at, @ad, @st, @sd)`);
            }
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
    }
}
