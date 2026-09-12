import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
/**
 * Belge modülü veri erişimi.
 * - `TODVZ_BELGE_SABLON`: şablon meta'sı (yoksa oluşturulur, ALFIS1/STFIS1 eklenir).
 * - Fiş verisi yalnızca OKUNUR: `VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI` + `VODVZ_E_DOVIZ_BELGESI_XSLT`
 *   (e-Döviz gönderiminin okuduğu görünümlerle aynı; ICE'ye gidenle aynı veri).
 */
export class BelgeSqlRepository {
    static hazirlanan = new Set();
    static async pool(ctx) {
        const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
        const anahtar = `${ctx?.dbServer || ""}|${ctx?.dbName || ""}`;
        if (!this.hazirlanan.has(anahtar)) {
            await this.ensureTablesExist(pool);
            this.hazirlanan.add(anahtar);
        }
        return pool;
    }
    static async ensureTablesExist(pool) {
        try {
            await pool.request().query(`
        IF OBJECT_ID('dbo.TODVZ_BELGE_SABLON','U') IS NULL
        BEGIN TRY
          CREATE TABLE dbo.TODVZ_BELGE_SABLON (
            SABLON_ID     int IDENTITY(1,1) NOT NULL PRIMARY KEY,
            KOD           varchar(20)   NOT NULL UNIQUE,
            AD            nvarchar(100) NOT NULL,
            TUR           varchar(10)   NOT NULL,
            FIS_TIPI      tinyint       NULL,
            DUZEN_DOSYASI varchar(100)  NOT NULL,
            KAGIT         varchar(10)   NOT NULL DEFAULT 'A4',
            VARSAYILAN    bit           NOT NULL DEFAULT 0,
            AKTIF         bit           NOT NULL DEFAULT 1,
            ARSIV_DIZINI  nvarchar(200) NULL,
            EKLEME_ZAMANI datetime2     NOT NULL DEFAULT SYSDATETIME()
          );
        END TRY BEGIN CATCH IF ERROR_NUMBER() <> 2714 THROW; END CATCH;
        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_BELGE_SABLON WHERE KOD='ALFIS1')
          INSERT INTO dbo.TODVZ_BELGE_SABLON (KOD,AD,TUR,FIS_TIPI,DUZEN_DOSYASI,KAGIT,VARSAYILAN,AKTIF)
          VALUES ('ALFIS1',N'Alış Fişi','BELGE',0,'belge/ALFIS1.json','A4',1,1);
        IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_BELGE_SABLON WHERE KOD='STFIS1')
          INSERT INTO dbo.TODVZ_BELGE_SABLON (KOD,AD,TUR,FIS_TIPI,DUZEN_DOSYASI,KAGIT,VARSAYILAN,AKTIF)
          VALUES ('STFIS1',N'Satış Fişi','BELGE',1,'belge/STFIS1.json','A4',1,1);
        IF OBJECT_ID('dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI','V') IS NULL
          THROW 50002, 'Döviz fişi görünümü (VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI) bu veritabanında bulunamadı.', 1;
      `);
        }
        catch (e) {
            logger.error("BelgeSqlRepository.ensureTablesExist hatası:", e);
            throw e;
        }
    }
    static sablonMap(r) {
        return { sablonId: r.SABLON_ID, kod: String(r.KOD).trim(), ad: String(r.AD || "").trim(), tur: r.TUR, fisTipi: r.FIS_TIPI ?? null,
            duzenDosyasi: String(r.DUZEN_DOSYASI).trim(), kagit: String(r.KAGIT || "A4").trim(), varsayilan: !!r.VARSAYILAN, aktif: !!r.AKTIF,
            arsivDizini: r.ARSIV_DIZINI ? String(r.ARSIV_DIZINI).trim() || null : null };
    }
    static async sablonlar(tur, ctx) {
        const pool = await this.pool(ctx);
        const res = await pool.request().input("tur", sql.VarChar(10), tur || null)
            .query(`SELECT * FROM dbo.TODVZ_BELGE_SABLON WHERE AKTIF=1 AND (@tur IS NULL OR TUR=@tur) ORDER BY TUR, FIS_TIPI, VARSAYILAN DESC, KOD`);
        return res.recordset.map(this.sablonMap);
    }
    static async sablonBul(kod, ctx) {
        const pool = await this.pool(ctx);
        const res = await pool.request().input("kod", sql.VarChar(20), kod.trim().toUpperCase())
            .query(`SELECT TOP 1 * FROM dbo.TODVZ_BELGE_SABLON WHERE KOD=@kod`);
        if (!res.recordset[0])
            throw ApiError.notFound(`Şablon bulunamadı: ${kod}`);
        const s = this.sablonMap(res.recordset[0]);
        if (!s.aktif)
            throw ApiError.badRequest(`Şablon pasif: ${kod}`);
        return s;
    }
    static async varsayilanSablon(fisTipi, ctx) {
        const pool = await this.pool(ctx);
        const res = await pool.request().input("tip", sql.TinyInt, fisTipi)
            .query(`SELECT TOP 1 * FROM dbo.TODVZ_BELGE_SABLON WHERE TUR='BELGE' AND AKTIF=1 AND FIS_TIPI=@tip ORDER BY VARSAYILAN DESC, SABLON_ID`);
        if (!res.recordset[0])
            throw ApiError.notFound(`${fisTipi === 1 ? "Satış" : "Alış"} fişi için aktif şablon yok.`);
        return this.sablonMap(res.recordset[0]);
    }
    /**
     * Fişi FIS_ID veya belge numarasıyla (DIA2026…/DIS2026…) bulur; iptal fiş de döner
     * (önizlemede İPTAL filigranı basılır). Belge içeriği XSLT görünümünden tamamlanır.
     */
    static async fisDetay(p, ctx) {
        if (!p.fisId && !p.belgeNo)
            throw ApiError.badRequest("fisId veya belgeNo verilmelidir.");
        const pool = await this.pool(ctx);
        const res = await pool.request()
            .input("id", sql.Int, p.fisId || null)
            .input("no", sql.VarChar(40), p.belgeNo?.trim().toUpperCase() || null).query(`
      -- FIS_* kolonları: XSLT görünümünde tutar/vezne yoksa belgeVeri bunlara düşer.
      SELECT TOP 2 D.*, RTRIM(I.KOD) AS ISTATISTIK_KOD, I.FIS_TIPI AS ISTATISTIK_FIS_TIPI,
        RTRIM(VZ.KOD) AS FIS_VEZNE_KODU, F.ODEME_TUTARI AS FIS_ODEME_TUTARI, F.TOPLAM_TUTAR AS FIS_TOPLAM_TUTAR
      FROM dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI D
      LEFT JOIN dbo.TODVZ_FIS F ON F.FIS_ID=D.BELGE_ID
      LEFT JOIN dbo.TODVZ_VEZNE VZ ON VZ.VEZNE_ID=F.VEZNE_ID
      LEFT JOIN dbo.TODVZ_ISTATISTIK I ON I.ISTATISTIK_ID=F.ISTATISTIK_ID
      WHERE (@id IS NULL OR D.BELGE_ID=@id) AND (@no IS NULL OR RTRIM(D.BELGE_NO)=@no);
    `);
        const basliklar = res.recordset;
        if (basliklar.length === 0)
            throw ApiError.notFound(`Döviz fişi bulunamadı (${p.belgeNo || "fiş " + p.fisId}).`);
        if (basliklar.length > 1)
            throw ApiError.conflict("Birden fazla fiş eşleşti; belge numarasıyla arayın.");
        const baslik = basliklar[0];
        let detay = {};
        try {
            const x = await pool.request().input("id", sql.Int, baslik.BELGE_ID).input("no", sql.VarChar(40), String(baslik.BELGE_NO || "").trim()).query(`
        SELECT TOP 1 X.* FROM dbo.VODVZ_E_DOVIZ_BELGESI_XSLT X WHERE X.FIS_ID=@id AND RTRIM(X.ID)=@no`);
            detay = x.recordset[0] || {};
        }
        catch (e) {
            logger.warn("Belge: XSLT görünümü okunamadı, yalnızca başlık kullanılıyor.", e);
        }
        return { ...detay, ...baslik };
    }
    static async fisler(f, ctx) {
        const pool = await this.pool(ctx);
        const boyut = Math.min(Math.max(f.boyut || 50, 1), 200), sayfa = Math.max(f.sayfa || 1, 1);
        const res = await pool.request()
            .input("tip", sql.Int, f.tip ?? null)
            .input("bas", sql.Date, f.baslangic || null).input("bit", sql.Date, f.bitis || null)
            .input("arama", sql.NVarChar(100), f.arama?.trim() ? `%${f.arama.trim()}%` : null)
            .input("atla", sql.Int, (sayfa - 1) * boyut).input("al", sql.Int, boyut).query(`
      -- Görünümde yalnızca BELGE_ID, FIS_TIPI, BELGE_NO, TARIH, UNVAN, MIKTAR, PARA_KODU, ETTN, IPTAL, E_BELGE_DURUMU
      -- kolonları garanti (ebelgeKaynak listesiyle aynı). Tutar ve vezne TODVZ_FIS / TODVZ_VEZNE'den okunur.
      SELECT D.BELGE_ID fisId, D.FIS_TIPI fisTipi, RTRIM(D.BELGE_NO) belgeNo, D.TARIH tarih, RTRIM(D.UNVAN) unvan,
        D.MIKTAR miktar, RTRIM(D.PARA_KODU) paraKodu, ISNULL(F.ODEME_TUTARI, F.TOPLAM_TUTAR) tutar, RTRIM(ISNULL(V.KOD,'')) vezne,
        RTRIM(ISNULL(D.ETTN,'')) ettn, ISNULL(D.IPTAL,0) iptal, G.GONDERIM_DURUMU gonderimDurumu
      INTO #F
      FROM dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI D
      LEFT JOIN dbo.TODVZ_FIS F ON F.FIS_ID=D.BELGE_ID
      LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      OUTER APPLY (SELECT TOP 1 G.GONDERIM_DURUMU FROM dbo.TODVZ_EBELGE_GIDEN G
        WHERE G.BELGE_NO=RTRIM(D.BELGE_NO) OR G.UUID=NULLIF(RTRIM(D.ETTN),'') ORDER BY G.OLUSTURMA_TARIHI DESC) G
      WHERE (@tip IS NULL OR D.FIS_TIPI=@tip)
        AND (@bas IS NULL OR CAST(D.TARIH AS date)>=@bas) AND (@bit IS NULL OR CAST(D.TARIH AS date)<=@bit)
        AND (@arama IS NULL OR D.BELGE_NO LIKE @arama OR D.UNVAN LIKE @arama OR D.ETTN LIKE @arama);
      SELECT COUNT(*) toplam FROM #F;
      SELECT * FROM #F ORDER BY tarih DESC, fisId DESC OFFSET @atla ROWS FETCH NEXT @al ROWS ONLY;
      DROP TABLE #F;
    `);
        const sets = res.recordsets;
        const kayitlar = sets[1].map((r) => ({ ...r, tipAdi: Number(r.fisTipi) === 1 ? "Satış" : "Alış",
            tarih: r.tarih ? new Date(r.tarih).toISOString() : "", miktar: Number(r.miktar || 0), tutar: Number(r.tutar || 0), iptal: !!r.iptal }));
        return { toplam: Number(sets[0][0]?.toplam || 0), sayfa, boyut, kayitlar };
    }
    /** Firma tanımındaki belge dizini (arşiv kökü için ikinci öncelik). */
    static async firmaBelgeDizini(ctx) {
        try {
            const pool = await this.pool(ctx);
            const res = await pool.request().query(`SELECT TOP 1 LTRIM(RTRIM(ISNULL([BELGE_DIZINI],''))) dizin FROM [dbo].[TODVZ_TANIM]`);
            return res.recordset[0]?.dizin || null;
        }
        catch (e) {
            logger.warn("Belge: TODVZ_TANIM.BELGE_DIZINI okunamadı.", e);
            return null;
        }
    }
}
