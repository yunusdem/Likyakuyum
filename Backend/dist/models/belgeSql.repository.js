import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
export const BELGE_DURUMLARI = ["GONDERILMEDI", "GONDERILDI", "HATA", "GONDERILIYOR", "TASLAK", "IPTAL", "KONTROL_GEREKLI"];
const DOVIZ_EVRAK_TURU = 99;
const FATURA_TUR_ADI = { 0: "Fatura", 1: "Fatura", 2: "e-İrsaliye", 3: "e-Gider" };
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
    /**
     * Belge listesi — tüm kaynaklar tek listede (yönetici kararı 14.09.2026):
     * e-Döviz fişleri (`VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI`, iptaller dahil) + fatura / e-İrsaliye / e-Gider
     * (`VODVZ_GONDERIME_HAZIR_E_BELGE`, EVRAK_TURU=0, BELGE_TURU 0–3). Durum, e-Belge Kaynak ekranıyla aynı
     * mantıkla birleşir: giden kutusu (TODVZ_EBELGE_GIDEN) → kaynak işlem kaydı (TODVZ_EBELGE_KAYNAK) → görünümdeki eski durum.
     * `kaynak` boşsa hepsi; `tip` (0 alış / 1 satış) yalnızca döviz fişlerine uygulanır ve seçilince diğer kaynaklar elenir.
     */
    static async fisler(f, ctx) {
        const pool = await this.pool(ctx);
        const boyut = Math.min(Math.max(f.boyut || 50, 1), 200), sayfa = Math.max(f.sayfa || 1, 1);
        const nesneler = await pool.request().query(`
      SELECT OBJECT_ID('dbo.VODVZ_GONDERIME_HAZIR_E_BELGE','V') belgeGorunumu, OBJECT_ID('dbo.TODVZ_EBELGE_KAYNAK','U') kaynakTablosu, OBJECT_ID('dbo.TODVZ_EBELGE_GIDEN','U') gidenTablosu`);
        const n = nesneler.recordset[0] || {};
        const faturaVar = !!n.belgeGorunumu, kaynakVar = !!n.kaynakTablosu, gidenVar = !!n.gidenTablosu;
        const durumFiltre = f.durum && BELGE_DURUMLARI.includes(f.durum) ? f.durum : null;
        const faturaSql = faturaVar ? `
        UNION ALL
        SELECT 0, V.BELGE_ID, V.BELGE_TURU, 'FATURA', RTRIM(V.BELGE_NO), V.TARIH, RTRIM(V.UNVAN),
          NULL, RTRIM(V.PARA_KODU), V.MIKTAR, '', RTRIM(ISNULL(V.ETTN,'')), 0, V.E_BELGE_DURUMU, V.E_BELGE_HATA_ACIKLAMASI
        FROM dbo.VODVZ_GONDERIME_HAZIR_E_BELGE V
        WHERE V.EVRAK_TURU=0 AND V.BELGE_TURU IN (0,1,2,3)` : "";
        const kaynakApply = kaynakVar ? `
      OUTER APPLY (SELECT TOP 1 R.DURUM, R.HATA FROM dbo.TODVZ_EBELGE_KAYNAK R
        WHERE R.ANAHTAR=CONCAT(K.evrakTuru,':',K.belgeId,':',K.belgeTuru)
          OR (K.kaynak='DOVIZ' AND R.ANAHTAR=CONCAT(K.evrakTuru,':',K.belgeId,':',K.belgeTuru,':',K.belgeNo))
        ORDER BY CASE WHEN R.DURUM='HATA' THEN 1 ELSE 0 END, R.TARIH DESC) R` : `
      CROSS APPLY (SELECT CAST(NULL AS varchar(30)) DURUM, CAST(NULL AS nvarchar(2000)) HATA) R`;
        const gidenApply = gidenVar ? `
      OUTER APPLY (SELECT TOP 1 G.GONDERIM_DURUMU, G.ICE_RESPONSE_MESAJ FROM dbo.TODVZ_EBELGE_GIDEN G
        WHERE G.BELGE_NO=K.belgeNo OR G.UUID=NULLIF(K.ettn,'') ORDER BY G.OLUSTURMA_TARIHI DESC) G` : `
      CROSS APPLY (SELECT CAST(NULL AS varchar(30)) GONDERIM_DURUMU, CAST(NULL AS nvarchar(2000)) ICE_RESPONSE_MESAJ) G`;
        const res = await pool.request()
            .input("kaynak", sql.VarChar(10), f.kaynak || null)
            .input("tip", sql.Int, f.tip ?? null)
            .input("durum", sql.VarChar(30), durumFiltre)
            .input("bas", sql.Date, f.baslangic || null).input("bit", sql.Date, f.bitis || null)
            .input("arama", sql.NVarChar(100), f.arama?.trim() ? `%${f.arama.trim()}%` : null)
            .input("atla", sql.Int, (sayfa - 1) * boyut).input("al", sql.Int, boyut).query(`
      ;WITH K AS (
        -- Görünümde yalnızca BELGE_ID, FIS_TIPI, BELGE_NO, TARIH, UNVAN, MIKTAR, PARA_KODU, ETTN, IPTAL, E_BELGE_DURUMU
        -- kolonları garanti (ebelgeKaynak listesiyle aynı). Tutar ve vezne TODVZ_FIS / TODVZ_VEZNE'den okunur.
        SELECT ${DOVIZ_EVRAK_TURU} evrakTuru, D.BELGE_ID belgeId, D.FIS_TIPI belgeTuru, 'DOVIZ' kaynak, RTRIM(D.BELGE_NO) belgeNo, D.TARIH tarih, RTRIM(D.UNVAN) unvan,
          D.MIKTAR miktar, RTRIM(D.PARA_KODU) paraKodu, ISNULL(F.ODEME_TUTARI, F.TOPLAM_TUTAR) tutar, RTRIM(ISNULL(V.KOD,'')) vezne,
          RTRIM(ISNULL(D.ETTN,'')) ettn, ISNULL(D.IPTAL,0) iptal, D.E_BELGE_DURUMU eskiDurum, D.E_BELGE_HATA_ACIKLAMASI eskiHata
        FROM dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI D
        LEFT JOIN dbo.TODVZ_FIS F ON F.FIS_ID=D.BELGE_ID
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID${faturaSql}
      )
      SELECT K.*, G.GONDERIM_DURUMU gonderimDurumu,
        CASE WHEN K.iptal=1 THEN 'IPTAL' ELSE COALESCE(G.GONDERIM_DURUMU, R.DURUM,
          CASE WHEN NULLIF(RTRIM(K.eskiHata),'') IS NOT NULL THEN 'HATA'
               WHEN ISNULL(K.eskiDurum,0)=0 AND (K.kaynak='DOVIZ' OR NULLIF(K.ettn,'') IS NULL) THEN 'GONDERILMEDI'
               ELSE 'KONTROL_GEREKLI' END) END durum,
        COALESCE(G.ICE_RESPONSE_MESAJ, R.HATA, K.eskiHata) hata
      INTO #F
      FROM K${kaynakApply}${gidenApply}
      WHERE (@kaynak IS NULL OR (@kaynak='DOVIZ' AND K.kaynak='DOVIZ')
          OR (@kaynak='FATURA' AND K.kaynak='FATURA' AND K.belgeTuru IN (0,1))
          OR (@kaynak='IRSALIYE' AND K.kaynak='FATURA' AND K.belgeTuru=2)
          OR (@kaynak='GIDER' AND K.kaynak='FATURA' AND K.belgeTuru=3))
        AND (@tip IS NULL OR (K.kaynak='DOVIZ' AND K.belgeTuru=@tip))
        AND (@bas IS NULL OR CAST(K.tarih AS date)>=@bas) AND (@bit IS NULL OR CAST(K.tarih AS date)<=@bit)
        AND (@arama IS NULL OR K.belgeNo LIKE @arama OR K.unvan LIKE @arama OR K.ettn LIKE @arama);
      SELECT COUNT(*) toplam FROM #F WHERE @durum IS NULL OR durum=@durum;
      SELECT * FROM #F WHERE @durum IS NULL OR durum=@durum ORDER BY tarih DESC, belgeId DESC OFFSET @atla ROWS FETCH NEXT @al ROWS ONLY;
      DROP TABLE #F;
    `);
        const sets = res.recordsets;
        const kayitlar = sets[1].map((r) => {
            const doviz = r.kaynak === "DOVIZ";
            const belgeTuru = Number(r.belgeTuru);
            const kaynak = doviz ? "DOVIZ" : belgeTuru === 2 ? "IRSALIYE" : belgeTuru === 3 ? "GIDER" : "FATURA";
            return {
                kaynak, evrakTuru: Number(r.evrakTuru), belgeTuru,
                fisId: Number(r.belgeId), fisTipi: belgeTuru,
                tipAdi: doviz ? (belgeTuru === 1 ? "Satış" : "Alış") : (FATURA_TUR_ADI[belgeTuru] || `Tür ${belgeTuru}`),
                belgeNo: String(r.belgeNo || "").trim(), tarih: r.tarih ? new Date(r.tarih).toISOString() : "", unvan: String(r.unvan || "").trim(),
                miktar: doviz ? Number(r.miktar || 0) : null, paraKodu: String(r.paraKodu || "").trim(), tutar: Number(r.tutar || 0),
                vezne: String(r.vezne || "").trim(), ettn: String(r.ettn || "").trim(), iptal: !!r.iptal,
                durum: String(r.durum || "GONDERILMEDI"), hata: r.hata ? String(r.hata).trim() || null : null,
                gonderimDurumu: r.gonderimDurumu ?? null,
            };
        });
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
