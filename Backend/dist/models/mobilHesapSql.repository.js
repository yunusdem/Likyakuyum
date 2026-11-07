import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { CARI_HAREKET_KOLONLARI, belgeTablolari, cariHareketleriSql } from "../services/rapor/kaynak.js";
/**
 * Mobil hesap dökümü (docs/MOBIL_CARI_YOL_HARITASI.md K15, K16): Cari Ekstre raporunun kaynağıyla aynı (cari hareketler +
 * virman dekontu + bankadan ödenen döviz fişi + sarraf / perakende / ticari fişin cari ödemesi), yalnız tek cari. Emanet
 * alma / verme dekontları bilgi satırıdır, bakiyeyi etkilemez. Sorgular yalnız token'daki cariye bağlanır.
 */
const havuz = (ctx) => getDbPool(ctx.dbServer, ctx.dbName);
export class MobilHesapSqlRepository {
    /** Ekstre kaynakları: dönem öncesi devir (para başına), dönem içi hareketler, dönem içi emanet bilgileri */
    static async dokumKaynaklari(ctx, cariKartId, bas, bit) {
        const pool = await havuz(ctx);
        const d = await belgeTablolari(pool);
        const ch = `;WITH CH (${CARI_HAREKET_KOLONLARI}) AS (
       ${cariHareketleriSql(d)}
      )`;
        const cari = `RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd`;
        const emanet = d.dekont
            ? `
      SELECT ${cari}, CAST(D.CARI_DEKONT_ID AS varchar(20)) fisNo, D.TIP dekontTip, D.TARIH tarih, D.EKLEME_ZAMANI eklemeZamani,
        CONVERT(varchar(5), CASE WHEN CAST(D.TARIH AS time)='00:00' THEN CAST(D.EKLEME_ZAMANI AS time) ELSE CAST(D.TARIH AS time) END, 108) saat,
        RTRIM(ISNULL(D.ACIKLAMA,'')) aciklama, DS.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani, DS.MEBLAG meblag
      FROM dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI DS ON DS.CARI_DEKONT_ID=D.CARI_DEKONT_ID AND DS.TIP=D.TIP
        JOIN dbo.TODVZ_PARA P ON P.PARA_ID=DS.PARA_ID JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=@cari
      WHERE D.TIP IN (0,1) AND D.IPTAL_TARIHI IS NULL AND CAST(D.TARIH AS date) BETWEEN @bas AND @bit
        AND @cari = CASE WHEN D.TIP=0 THEN COALESCE(D.ALACAKLI_ID, D.BORCLU_ID) ELSE COALESCE(D.BORCLU_ID, D.ALACAKLI_ID) END
      ORDER BY D.TARIH, D.EKLEME_ZAMANI, D.CARI_DEKONT_ID, DS.SATIR_NO;`
            : "SELECT TOP 0 1 AS x;";
        const r = await pool.request().input("cari", sql.Int, cariKartId).input("bas", sql.Date, bas).input("bit", sql.Date, bit).query(`
      ${ch}
      SELECT ${cari}, CH.paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani,
        SUM(CASE WHEN CH.tip=0 THEN CH.meblag ELSE 0 END) borc, SUM(CASE WHEN CH.tip=1 THEN CH.meblag ELSE 0 END) alacak
      FROM CH JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CH.paraId JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=CH.cariKartId
      WHERE CH.cariKartId=@cari AND CAST(CH.tarih AS date)<@bas
      GROUP BY C.KOD, C.AD, CH.paraId, P.KOD, P.SIRA_NO, P.HAS_ORANI;
      ${ch}
      SELECT ${cari}, CH.belgeNo fisNo, CH.evrakTipi, CH.hareketId, CH.tarih, CH.eklemeZamani, CH.hareketTipi, CH.tip, 0 onceki,
        CONVERT(varchar(5), CASE WHEN CAST(CH.tarih AS time)='00:00' THEN CAST(CH.eklemeZamani AS time) ELSE CAST(CH.tarih AS time) END, 108) saat,
        CH.aciklama, CH.paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani, CH.meblag
      FROM CH JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CH.paraId JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=CH.cariKartId
      WHERE CH.cariKartId=@cari AND CAST(CH.tarih AS date) BETWEEN @bas AND @bit
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, CH.tarih, CH.eklemeZamani, CH.evrakTipi, CH.hareketId, CH.satirNo;
      ${emanet}`);
        const s = r.recordsets;
        return { devirler: s[0] || [], hareketler: s[1] || [], bilgiler: d.dekont ? s[2] || [] : [] };
    }
    /**
     * Bakiye (para başına, bütün zamanlar): Cari Ekstre ile aynı kaynak — dökümün son bakiyesiyle her zaman aynıdır.
     * net > 0 cari alacaklı (A), < 0 cari borçlu (B).
     */
    static async bakiye(ctx, cariKartId) {
        const pool = await havuz(ctx);
        const d = await belgeTablolari(pool);
        const r = await pool.request().input("cari", sql.Int, cariKartId).query(`
      ;WITH CH (${CARI_HAREKET_KOLONLARI}) AS (
       ${cariHareketleriSql(d)}
      )
      SELECT RTRIM(P.KOD) PARA_KOD, RTRIM(ISNULL(P.AD,'')) PARA_AD, SUM(CASE WHEN CH.tip=1 THEN CH.meblag ELSE -CH.meblag END) NET
      FROM CH JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CH.paraId
      WHERE CH.cariKartId=@cari
      GROUP BY P.KOD, P.AD, P.SIRA_NO
      HAVING ABS(SUM(CASE WHEN CH.tip=1 THEN CH.meblag ELSE -CH.meblag END)) > 0.0000001
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD;`);
        return r.recordset.map((x) => ({ paraKod: x.PARA_KOD, paraAd: x.PARA_AD, net: Number(x.NET) }));
    }
    /** Emanet bakiyesi (para başına): emanet alma − emanet verme (iptal edilmemiş) */
    static async emanetBakiyesi(ctx, cariKartId) {
        const pool = await havuz(ctx);
        const r = await pool.request().input("cari", sql.Int, cariKartId).query(`
      IF OBJECT_ID('dbo.TODVZ_CARI_DEKONT','U') IS NULL BEGIN SELECT TOP 0 '' AS PARA_KOD, '' AS PARA_AD, 0 AS MIKTAR; RETURN; END
      SELECT RTRIM(P.KOD) PARA_KOD, RTRIM(ISNULL(P.AD,'')) PARA_AD, SUM(CASE WHEN D.TIP=0 THEN DS.MEBLAG ELSE -DS.MEBLAG END) MIKTAR
      FROM dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI DS ON DS.CARI_DEKONT_ID=D.CARI_DEKONT_ID AND DS.TIP=D.TIP
        JOIN dbo.TODVZ_PARA P ON P.PARA_ID=DS.PARA_ID
      WHERE D.TIP IN (0,1) AND D.IPTAL_TARIHI IS NULL
        AND @cari = CASE WHEN D.TIP=0 THEN COALESCE(D.ALACAKLI_ID, D.BORCLU_ID) ELSE COALESCE(D.BORCLU_ID, D.ALACAKLI_ID) END
      GROUP BY P.KOD, P.AD, P.SIRA_NO
      HAVING ABS(SUM(CASE WHEN D.TIP=0 THEN DS.MEBLAG ELSE -DS.MEBLAG END)) > 0.0000001
      ORDER BY ISNULL(P.SIRA_NO,99);`);
        return r.recordset.map((x) => ({ paraKod: x.PARA_KOD, paraAd: x.PARA_AD, miktar: Number(x.MIKTAR) }));
    }
    /** Cariye kesilen fişler (sarraf + döviz), tarih aralığında, yeniden eskiye */
    static async belgeler(ctx, cariKartId, bas, bit) {
        const pool = await havuz(ctx);
        const r = await pool.request().input("cari", sql.Int, cariKartId).input("bas", sql.Date, bas).input("bit", sql.Date, bit).query(`
      DECLARE @s bit = CASE WHEN OBJECT_ID('dbo.TODVZ_SARRAF_FISI','U') IS NULL THEN 0 ELSE 1 END;
      DECLARE @ticariVar bit = CASE WHEN OBJECT_ID('dbo.TODVZ_FATURA','U') IS NULL OR COL_LENGTH('dbo.TODVZ_FATURA','FIS_KAYNAGI') IS NULL THEN 0 ELSE 1 END;
      DECLARE @tq nvarchar(max) = N'SELECT ''TICARI'' TUR, FATURA_ID ID, CAST(NULL AS int) SATIR, CAST(NULL AS varchar(20)) PARA_KOD, RTRIM(FATURA_NO) BELGE_NO, TARIH, TARIH ZAMAN, 1 TIP, ISNULL(GENEL_TOPLAM,0) TOPLAM
        FROM dbo.TODVZ_FATURA WHERE CARI_KART_ID=@cari AND ISNULL(FIS_KAYNAGI,0)=1 AND ISNULL(FATURA_TIPI,1)=1 AND CAST(TARIH AS date) BETWEEN @bas AND @bit';
      DECLARE @ticari TABLE (TUR varchar(10), ID int, SATIR int, PARA_KOD varchar(20), BELGE_NO varchar(50), TARIH datetime, ZAMAN datetime, TIP int, TOPLAM float);
      IF @ticariVar = 1 INSERT INTO @ticari EXEC sp_executesql @tq, N'@cari int, @bas date, @bit date', @cari=@cari, @bas=@bas, @bit=@bit;
      SELECT 'DOVIZ' TUR, F.FIS_ID ID, S.SATIR_NO SATIR, RTRIM(P.KOD) PARA_KOD, COALESCE(NULLIF(RTRIM(F.BELGE_NO),''), RTRIM(ISNULL(F.SERI_NO,''))) BELGE_NO, F.TARIH, COALESCE(F.ZAMAN, F.TARIH) ZAMAN, F.TIP, ISNULL(S.TUTAR,0) TOPLAM
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      WHERE F.CARI_KART_ID=@cari AND ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit
      UNION ALL
      SELECT 'SARRAF', SF.SARRAF_FISI_ID, NULL, NULL, RTRIM(ISNULL(SF.FIS_NO,'')), SF.TARIH, COALESCE(SF.SAAT, SF.TARIH), SF.TIP,
        ISNULL((SELECT SUM(ISNULL(S.TUTAR,0)) FROM dbo.TODVZ_SARRAF_FISI_SATIRI S WHERE S.SARRAF_FISI_ID=SF.SARRAF_FISI_ID),0)
      FROM dbo.TODVZ_SARRAF_FISI SF WHERE @s=1 AND SF.CARI_KART_ID=@cari AND CAST(SF.TARIH AS date) BETWEEN @bas AND @bit
      UNION ALL
      SELECT TUR, ID, SATIR, PARA_KOD, BELGE_NO, TARIH, ZAMAN, TIP, TOPLAM FROM @ticari
      ORDER BY TARIH DESC, ID DESC, SATIR;`);
        return r.recordset.map((x) => ({
            tur: x.TUR,
            id: x.ID,
            satir: x.SATIR === null || x.SATIR === undefined ? null : Number(x.SATIR),
            paraKod: x.PARA_KOD ?? null,
            belgeNo: x.BELGE_NO,
            tarih: x.TARIH,
            zaman: x.ZAMAN ?? x.TARIH,
            tip: Number(x.TIP) === 1 ? 1 : 0,
            toplamTl: Number(x.TOPLAM) || 0,
        }));
    }
    /** Fiş bu cariye mi kesilmiş */
    static async belgeSahibiMi(ctx, cariKartId, tur, id) {
        const pool = await havuz(ctx);
        const r = await pool
            .request()
            .input("cari", sql.Int, cariKartId)
            .input("id", sql.Int, id)
            .query(tur === "TICARI"
            ? `SELECT COUNT(*) AS N FROM dbo.TODVZ_FATURA WHERE FATURA_ID=@id AND CARI_KART_ID=@cari AND ISNULL(FIS_KAYNAGI,0)=1`
            : tur === "DOVIZ"
                ? `SELECT COUNT(*) AS N FROM dbo.TODVZ_FIS WHERE FIS_ID=@id AND CARI_KART_ID=@cari AND ISNULL(IPTAL,0)=0`
                : `SELECT COUNT(*) AS N FROM dbo.TODVZ_SARRAF_FISI WHERE SARRAF_FISI_ID=@id AND CARI_KART_ID=@cari`);
        return Number(r.recordset[0].N) > 0;
    }
    /** Döviz fişi satırının e-Döviz belge kimliği (ETTN) */
    static async dovizSatirEttn(ctx, fisId, satir) {
        const pool = await havuz(ctx);
        const r = await pool.request().input("id", sql.Int, fisId).input("satir", sql.Int, satir).query(`SELECT RTRIM(ETTN) AS E FROM dbo.TODVZ_FIS_SATIRI WHERE FIS_ID=@id AND SATIR_NO=@satir`);
        return r.recordset[0]?.E || null;
    }
    /** Sarraf fişi: başlık + satırlar + ödeme satırları (çıktı girdisine çevrilmek üzere) */
    static async sarrafFisi(ctx, id) {
        const pool = await havuz(ctx);
        const r = await pool.request().input("id", sql.Int, id).query(`
      SELECT SF.*, RTRIM(ISNULL(V.KOD,'')) VEZNE_KOD, RTRIM(ISNULL(K.AD,'')) KULLANICI_AD, RTRIM(ISNULL(IL.AD,'')) IL_AD, RTRIM(ISNULL(ILCE.AD,'')) ILCE_AD
      FROM dbo.TODVZ_SARRAF_FISI SF
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=SF.VEZNE_ID
        LEFT JOIN dbo.TODVZ_KULLANICI K ON K.KULLANICI_ID=SF.EKLEYEN_ID
        LEFT JOIN dbo.TODVZ_TABLO_MADDESI IL ON IL.TABLO_MADDESI_ID=SF.IL_ID
        LEFT JOIN dbo.TODVZ_TABLO_MADDESI ILCE ON ILCE.TABLO_MADDESI_ID=SF.ILCE_ID
      WHERE SF.SARRAF_FISI_ID=@id;
      SELECT S.*, RTRIM(ISNULL(P.KOD,'')) URUN_KOD, RTRIM(ISNULL(P.AD,'')) URUN_AD
      FROM dbo.TODVZ_SARRAF_FISI_SATIRI S LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.URUN_ID
      WHERE S.SARRAF_FISI_ID=@id ORDER BY S.SATIR_NO;
      SELECT O.*, RTRIM(ISNULL(P.KOD,'')) PARA_KOD, RTRIM(ISNULL(P.AD,'')) PARA_AD
      FROM dbo.TODVZ_ODEME_SATIRI O LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=O.PARA_ID
      WHERE O.SARRAF_FISI_ID=@id ORDER BY O.SATIR_NO;`).catch(async (e) => {
            // İl / ilçe tablo maddesi tablosu olmayan eski veritabanı: adlar boş
            if (!/TODVZ_TABLO_MADDESI/i.test(String(e?.message)))
                throw e;
            return pool.request().input("id", sql.Int, id).query(`
        SELECT SF.*, RTRIM(ISNULL(V.KOD,'')) VEZNE_KOD, RTRIM(ISNULL(K.AD,'')) KULLANICI_AD, '' IL_AD, '' ILCE_AD
        FROM dbo.TODVZ_SARRAF_FISI SF LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=SF.VEZNE_ID LEFT JOIN dbo.TODVZ_KULLANICI K ON K.KULLANICI_ID=SF.EKLEYEN_ID
        WHERE SF.SARRAF_FISI_ID=@id;
        SELECT S.*, RTRIM(ISNULL(P.KOD,'')) URUN_KOD, RTRIM(ISNULL(P.AD,'')) URUN_AD FROM dbo.TODVZ_SARRAF_FISI_SATIRI S LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.URUN_ID WHERE S.SARRAF_FISI_ID=@id ORDER BY S.SATIR_NO;
        SELECT O.*, RTRIM(ISNULL(P.KOD,'')) PARA_KOD, RTRIM(ISNULL(P.AD,'')) PARA_AD FROM dbo.TODVZ_ODEME_SATIRI O LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=O.PARA_ID WHERE O.SARRAF_FISI_ID=@id ORDER BY O.SATIR_NO;`);
        });
        const s = r.recordsets;
        return { baslik: s[0]?.[0] || null, satirlar: s[1] || [], odemeler: s[2] || [] };
    }
}
