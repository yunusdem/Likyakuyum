import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { mobilEmirGuid } from "../services/mobil/mobilFisYuku.js";
import { TicariStokSqlRepository } from "./ticariStokSql.repository.js";
import { IskontoSqlRepository } from "./iskontoSql.repository.js";
/**
 * Mobil emir onayı — firma veritabanı okumaları ve emir durum geçişleri (docs/MOBIL_CARI_YOL_HARITASI.md K31).
 * Onay iki aşamalıdır: emir önce "ISLENIYOR" olarak üstlenilir (aynı emri iki personel aynı anda fişe çeviremez, süre SQL
 * saatiyle denetlenir), fiş kaydedilince "ONAYLANDI"; fiş kaydı hata verirse emir yeniden "BEKLIYOR" olur.
 */
const havuz = (ctx) => getDbPool(ctx.dbServer, ctx.dbName);
const s = (v) => (v === null || v === undefined ? null : String(v).trim() || null);
const n = (v) => (v === null || v === undefined ? null : Number(v));
export class MobilOnaySqlRepository {
    static async fisCarisi(ctx, cariKartId) {
        const r = await (await havuz(ctx)).request().input("id", sql.Int, cariKartId).query(`
      SELECT CARI_KART_ID, KOD, AD, KISILIK_TIPI, VERGI_KIMLIK_NO, ADRES, TELEFON, EPOSTA, E_FATURA_POSTA_KUTUSU, VERGI_DAIRESI_ID, IL_ID, ILCE_ID, HUKUKI_YAPI_ID
      FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID = @id`);
        const x = r.recordset[0];
        if (!x)
            return null;
        return {
            cariKartId: x.CARI_KART_ID,
            kod: s(x.KOD) || "",
            ad: s(x.AD) || "",
            kisilikTipi: n(x.KISILIK_TIPI),
            vergiKimlikNo: s(x.VERGI_KIMLIK_NO),
            adres: s(x.ADRES),
            telefon: s(x.TELEFON),
            eposta: s(x.EPOSTA),
            eFaturaPosta: s(x.E_FATURA_POSTA_KUTUSU),
            vergiDairesiId: n(x.VERGI_DAIRESI_ID),
            ilId: n(x.IL_ID),
            ilceId: n(x.ILCE_ID),
            hukukiYapiId: n(x.HUKUKI_YAPI_ID),
        };
    }
    static async fisUrunleri(ctx, idler) {
        if (!idler.length)
            return [];
        const r = await (await havuz(ctx))
            .request()
            .query(`SELECT PARA_ID, KOD, AD, URUN_TIPI, HAS_ORANI, HAS_ALIS_KATSAYISI, HAS_SATIS_KATSAYISI FROM dbo.TODVZ_PARA WHERE PARA_ID IN (${idler.map((i) => Number(i)).filter(Number.isInteger).join(",")})`);
        return r.recordset.map((x) => ({
            urunId: x.PARA_ID,
            kod: s(x.KOD) || "",
            ad: s(x.AD) || "",
            urunTipi: n(x.URUN_TIPI),
            hasOrani: n(x.HAS_ORANI),
            hasAlisKatsayisi: n(x.HAS_ALIS_KATSAYISI),
            hasSatisKatsayisi: n(x.HAS_SATIS_KATSAYISI),
        }));
    }
    /** Fiş ortamı: TL / HAS para, has kuru (fiş tipine göre), istatistik (oranlar), KMV şekli, vezne / kullanıcı adları */
    static async ortam(ctx, tip, vezneId, kullaniciId) {
        const r = await (await havuz(ctx))
            .request()
            .input("tip", sql.Int, tip)
            .input("vezne", sql.Int, vezneId)
            .input("kullanici", sql.Int, kullaniciId).query(`
      SELECT TOP 1 PARA_ID, RTRIM(AD) AD FROM dbo.TODVZ_PARA WHERE UPPER(RTRIM(KOD)) IN ('TL','TRY','TRL','YTL') ORDER BY PARA_ID;
      SELECT TOP 1 PARA_ID, RTRIM(AD) AD FROM dbo.TODVZ_PARA WHERE UPPER(RTRIM(KOD)) IN ('HAS','HAS ALTIN','HASALTIN') ORDER BY PARA_ID;
      DECLARE @t int = (SELECT TOP 1 KUR_TABLOSU_ID FROM dbo.TODVZ_KUR_TABLOSU WHERE TUR = 0 ORDER BY ZAMAN DESC, KUR_TABLOSU_ID DESC);
      SELECT TOP 1 CASE WHEN @tip = 1 THEN ISNULL(NULLIF(K.EFEKTIF_SATIS,0), K.DOVIZ_SATIS) ELSE ISNULL(NULLIF(K.EFEKTIF_ALIS,0), K.DOVIZ_ALIS) END AS KUR
      FROM dbo.TODVZ_KUR K JOIN dbo.TODVZ_PARA P ON P.PARA_ID = K.PARA_ID
      WHERE K.KUR_TABLOSU_ID = @t AND UPPER(RTRIM(P.KOD)) IN ('HAS','HAS ALTIN','HASALTIN');
      DECLARE @ist int = (SELECT TOP 1 CASE WHEN @tip = 1 THEN SATIS_ISTATISTIK_ID ELSE ALIS_ISTATISTIK_ID END FROM dbo.TODVZ_TANIM);
      SELECT TOP 1 ISTATISTIK_ID, RTRIM(KOD) KOD, BMV_ORANI, KMV_ORANI, KOMISYON_ORANI FROM dbo.TODVZ_ISTATISTIK
      WHERE ISTATISTIK_ID = @ist OR (@ist IS NULL AND (FIS_TIPI = @tip OR FIS_TIPI = 2))
      ORDER BY CASE WHEN ISTATISTIK_ID = @ist THEN 0 ELSE 1 END, ISTATISTIK_ID;
      SELECT TOP 1 ISNULL(KMV_UYGULAMA_SEKLI, 3) AS KMV FROM dbo.TODVZ_TANIM;
      SELECT RTRIM(KOD) KOD, RTRIM(AD) AD FROM dbo.TODVZ_VEZNE WHERE VEZNE_ID = @vezne;
      SELECT RTRIM(AD) AD FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @kullanici;`);
        const k = r.recordsets;
        const ist = k[3]?.[0];
        const kmv = Number(k[4]?.[0]?.KMV);
        return {
            tl: k[0]?.[0] ? { paraId: k[0][0].PARA_ID, ad: k[0][0].AD } : null,
            has: k[1]?.[0] ? { paraId: k[1][0].PARA_ID, ad: k[1][0].AD } : null,
            hasKuru: Number(k[2]?.[0]?.KUR) || 0,
            istatistik: ist ? { id: ist.ISTATISTIK_ID, kod: ist.KOD, bmvOrani: n(ist.BMV_ORANI), kmvOrani: n(ist.KMV_ORANI), komisyonOrani: n(ist.KOMISYON_ORANI) } : null,
            kmvSekli: (kmv === 1 || kmv === 2 || kmv === 3 ? kmv : 3),
            vezne: k[5]?.[0] ? `${k[5][0].KOD} ${k[5][0].AD}`.trim() : null,
            kullanici: k[6]?.[0]?.AD ?? null,
        };
    }
    /** Döviz fişi banka hesabı seçenekleri: bankanın cari kartı (Hızlı Satış ile aynı liste) */
    static async dovizBankalari(ctx) {
        const r = await (await havuz(ctx)).request().query(`
      SELECT CARI_KART_ID AS id, RTRIM(KOD) + ' ' + RTRIM(AD) AS ad FROM dbo.TODVZ_CARI_KART WHERE KOD LIKE '102%' OR AD LIKE '%BANK%' ORDER BY KOD`);
        return r.recordset;
    }
    static async posCihazlari(ctx) {
        const r = await (await havuz(ctx)).request().query(`
      IF OBJECT_ID('dbo.TODVZ_POS_CIHAZI','U') IS NULL BEGIN SELECT TOP 0 0 AS id, '' AS ad; RETURN; END
      SELECT POS_CIHAZI_ID AS id, RTRIM(ISNULL(KOD,'')) + ' ' + RTRIM(ISNULL(AD,'')) AS ad FROM dbo.TODVZ_POS_CIHAZI ORDER BY KOD`);
        return r.recordset;
    }
    /** Ticari fiş alıcısı: cari kartı + il / ilçe / vergi dairesi adları (eski tablolarda TODVZ_TABLO_MADDESI kimliği) */
    static async ticariAlici(ctx, cariKartId) {
        const c = await this.fisCarisi(ctx, cariKartId);
        if (!c)
            return null;
        const r = await (await havuz(ctx)).request().input("il", sql.Int, c.ilId).input("ilce", sql.Int, c.ilceId).input("vd", sql.Int, c.vergiDairesiId).query(`
      IF OBJECT_ID('dbo.TODVZ_TABLO_MADDESI', 'U') IS NULL SELECT NULL AS IL, NULL AS ILCE, NULL AS VD
      ELSE SELECT (SELECT TOP 1 RTRIM(AD) FROM dbo.TODVZ_TABLO_MADDESI WHERE TABLO_MADDESI_ID = @il) AS IL,
                  (SELECT TOP 1 RTRIM(AD) FROM dbo.TODVZ_TABLO_MADDESI WHERE TABLO_MADDESI_ID = @ilce) AS ILCE,
                  (SELECT TOP 1 RTRIM(AD) FROM dbo.TODVZ_TABLO_MADDESI WHERE TABLO_MADDESI_ID = @vd) AS VD`);
        const x = r.recordset[0] || {};
        return { ...c, il: s(x.IL), ilce: s(x.ILCE), vergiDairesiAdi: s(x.VD) };
    }
    /** Ticari siparişin kartları: KDV oranı ve o anki stok bakiyesi (personel görür) */
    static async ticariKartlar(ctx, idler) {
        if (!idler.length)
            return [];
        const l = await TicariStokSqlRepository.kartlar({ idler }, ctx);
        return l.map((k) => ({ stokKartId: k.stokKartId, kdvOrani: Number(k.kdvOrani) || 0, bakiye: Number(k.bakiye) || 0, ad: k.ad, kod: k.kod, birim: k.birim || "Adet" }));
    }
    /** Sarraf fişi kaydı TODVZ_ISKONTO'ya bakar; tablo İskonto ekranı ilk açılınca kurulur — o ekranı hiç açmamış firmada da onay çalışsın */
    static async sarrafOnHazirlik(ctx) {
        await IskontoSqlRepository.ensureSchema(await havuz(ctx));
    }
    /**
     * Bu emir için daha önce yazılmış ama emre bağlanamamış fiş (kayıt yordamı fişi yazıp sonraki adımda hata verdiyse): aynı emre
     * ikinci fiş kesilmesin. Sarraf: satır açıklaması "Mobil emir #N"; döviz: emirden türeyen GUID (mobilEmirGuid). İkisi de
     * aynı cari + yön ve hiçbir emre bağlı değil.
     */
    static async yarimKalanFis(ctx, tur, k) {
        const q = (await havuz(ctx))
            .request()
            .input("aciklama", sql.VarChar(100), `Mobil emir #${k.emirId}`)
            .input("cari", sql.Int, k.cariKartId)
            .input("guid", sql.UniqueIdentifier, mobilEmirGuid(k.emirId))
            .input("tip", sql.Int, k.tip);
        const r = tur === "SARRAF"
            ? await q.query(`
            SELECT TOP 1 F.SARRAF_FISI_ID AS ID, RTRIM(F.FIS_NO) AS NO
            FROM dbo.TODVZ_SARRAF_FISI F
            WHERE F.CARI_KART_ID = @cari AND F.TIP = @tip
              AND EXISTS (SELECT 1 FROM dbo.TODVZ_SARRAF_FISI_SATIRI S WHERE S.SARRAF_FISI_ID = F.SARRAF_FISI_ID AND RTRIM(S.ACIKLAMA) = @aciklama)
              AND NOT EXISTS (SELECT 1 FROM dbo.LKY_MOBIL_EMIR E WHERE E.FIS_TURU = 'SARRAF' AND E.FIS_ID = F.SARRAF_FISI_ID)
            ORDER BY F.SARRAF_FISI_ID DESC`)
            : await q.query(`
            SELECT TOP 1 F.FIS_ID AS ID, RTRIM(COALESCE(NULLIF(RTRIM(F.BELGE_NO), ''), F.SERI_NO)) AS NO
            FROM dbo.TODVZ_FIS F
            WHERE F.GUID = @guid AND F.CARI_KART_ID = @cari AND F.TIP = @tip
              AND NOT EXISTS (SELECT 1 FROM dbo.LKY_MOBIL_EMIR E WHERE E.FIS_TURU = 'DOVIZ' AND E.FIS_ID = F.FIS_ID)
            ORDER BY F.FIS_ID DESC`);
        const x = r.recordset[0];
        return x ? { fisId: Number(x.ID), fisNo: x.NO ? String(x.NO).trim() || null : null } : null;
    }
    /** Emri üstlen: bekliyor ve süresi geçmemişse ISLENIYOR yap. Başarılıysa true. */
    static async ustlen(ctx, emirId, kullaniciId, kullaniciAdi) {
        const r = await (await havuz(ctx))
            .request()
            .input("id", sql.Int, emirId)
            .input("kid", sql.Int, kullaniciId)
            .input("kad", sql.NVarChar(100), kullaniciAdi)
            .query(`UPDATE dbo.LKY_MOBIL_EMIR SET DURUM = 'ISLENIYOR', ISLEYEN_KULLANICI_ID = @kid, ISLEYEN_KULLANICI_ADI = @kad
              OUTPUT inserted.EMIR_ID
              WHERE EMIR_ID = @id AND DURUM = 'BEKLIYOR' AND GECERLILIK_BITIS > DATEADD(HOUR, 3, GETUTCDATE());`);
        return r.recordset.length > 0;
    }
    /** Fiş kaydedilemedi: emir yeniden bekliyor (süresi geçtiyse zamanlayıcı düşürür) */
    static async birak(ctx, emirId) {
        await (await havuz(ctx))
            .request()
            .input("id", sql.Int, emirId)
            .query(`UPDATE dbo.LKY_MOBIL_EMIR SET DURUM = 'BEKLIYOR', ISLEYEN_KULLANICI_ID = NULL, ISLEYEN_KULLANICI_ADI = NULL WHERE EMIR_ID = @id AND DURUM = 'ISLENIYOR'`);
    }
    static async tamamla(ctx, emirId, v) {
        await (await havuz(ctx))
            .request()
            .input("id", sql.Int, emirId)
            .input("odeme", sql.VarChar(20), v.odemeSekli)
            .input("tur", sql.VarChar(20), v.fisTuru)
            .input("fisId", sql.Int, v.fisId)
            .input("fisNo", sql.VarChar(40), v.fisNo)
            .query(`UPDATE dbo.LKY_MOBIL_EMIR SET DURUM = 'ONAYLANDI', ISLEM_TARIHI = DATEADD(HOUR, 3, GETUTCDATE()), ODEME_SEKLI = @odeme, FIS_TURU = @tur, FIS_ID = @fisId, FIS_NO = @fisNo
              WHERE EMIR_ID = @id AND DURUM = 'ISLENIYOR'`);
    }
    static async reddet(ctx, emirId, kullaniciId, kullaniciAdi, neden) {
        const r = await (await havuz(ctx))
            .request()
            .input("id", sql.Int, emirId)
            .input("kid", sql.Int, kullaniciId)
            .input("kad", sql.NVarChar(100), kullaniciAdi)
            .input("neden", sql.NVarChar(300), neden)
            .query(`UPDATE dbo.LKY_MOBIL_EMIR SET DURUM = 'REDDEDILDI', ISLEM_TARIHI = DATEADD(HOUR, 3, GETUTCDATE()), ISLEYEN_KULLANICI_ID = @kid, ISLEYEN_KULLANICI_ADI = @kad, RED_NEDENI = @neden
              OUTPUT inserted.EMIR_ID
              WHERE EMIR_ID = @id AND DURUM = 'BEKLIYOR';`);
        return r.recordset.length > 0;
    }
}
