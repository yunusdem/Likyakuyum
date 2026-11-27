import sql from "mssql";
import { TicariStokSqlRepository } from "../../models/ticariStokSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
/**
 * Dönem kilidi (karar K7, 26.11.2026 denetimi): "kapanmış" sayılan iki dönemin öncesine yazmak yalnız sistem yöneticisine açıktır.
 *
 *  1) Onaylı sayım: bir kartın onaylı sayımı, sayım anındaki sistem stoğuna göre fark yazar. Sayım tarihinden ÖNCEKİ tarihli bir
 *     belge sonradan eklenir / düzeltilir / silinirse sayım farkı eskir ve stok rafla tutmaz. Yönetici dışındaki kullanıcı için
 *     reddedilir (yönetici bilerek düzeltir; gerekirse sayımı yeniden yapar).
 *  2) Kapanmış vardiya: vardiya kapanınca nakit raporu donar. O vardiyada yazılmış bir fiş sonradan düzeltilir / silinirse vezne
 *     bakiyesi değişir ama hiçbir vardiyanın "beklenen nakdi" değişmez (çekmeceden alınan para görünmez). Yönetici dışındaki
 *     kullanıcı için reddedilir; yönetici yaparsa nakit farkı veznenin AÇIK vardiyasına "önceki vardiya fişi düzeltmesi" olarak işlenir.
 */
const temiz = (v) => String(v ?? "").trim();
const trTarih = (d) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
/** Gövdedeki bütün stok kartı kimlikleri (anahtar adı "...stokKartId" olan sayısal alanlar; satırlar, girdi / çıktı kartları) */
export function govdedekiKartlar(govde, derinlik = 0) {
    const s = new Set();
    const gez = (v, d) => {
        if (!v || typeof v !== "object" || d > 5)
            return;
        if (Array.isArray(v)) {
            for (const x of v.slice(0, 2000))
                gez(x, d + 1);
            return;
        }
        for (const [k, x] of Object.entries(v)) {
            if (/stokkartid$/i.test(k)) {
                const n = Number(x);
                if (Number.isInteger(n) && n > 0)
                    s.add(n);
            }
            else if (x && typeof x === "object")
                gez(x, d + 1);
        }
    };
    gez(govde, derinlik);
    return [...s];
}
export class DonemKilidi {
    /**
     * Onaylı sayım kilidi. `tarih` + `kartIdler`: yazılacak belgenin (yeni ya da düzeltilmiş hâli) tarihi ve kartları;
     * `belge`: var olan belgenin (düzeltme / silme) stok hareketleri — türü ve kimliğiyle okunur. Yönetici için denetim yapılmaz.
     */
    static async sayimDenetle(ctx, g, yonetici) {
        if (yonetici)
            return;
        const kartlar = [...new Set((g.kartIdler || []).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 2000);
        const t = g.tarih ? new Date(String(g.tarih)) : null;
        const tarih = t && !Number.isNaN(t.getTime()) ? t : null;
        if (!(kartlar.length && tarih) && !g.belge)
            return;
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const var_ = await pool.request().query(`SELECT OBJECT_ID('dbo.TODVZ_STOK_SAYIM', 'U') AS V`);
        if (var_.recordset[0]?.V == null)
            return;
        const parcalar = [];
        if (kartlar.length && tarih)
            parcalar.push(`SELECT TOP 1 K.AD, S.TARIH FROM dbo.TODVZ_STOK_SAYIM S JOIN dbo.TODVZ_STOK_SAYIM_SATIR SS ON SS.SAYIM_ID = S.SAYIM_ID
      JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = SS.STOK_KART_ID WHERE S.DURUM = 1 AND SS.STOK_KART_ID IN (${kartlar.join(",")}) AND S.TARIH > @T ORDER BY S.TARIH DESC`);
        if (g.belge)
            parcalar.push(`SELECT TOP 1 K.AD, S.TARIH FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_SAYIM_SATIR SS ON SS.STOK_KART_ID = H.STOK_KART_ID
      JOIN dbo.TODVZ_STOK_SAYIM S ON S.SAYIM_ID = SS.SAYIM_ID AND S.DURUM = 1 AND S.TARIH > H.TARIH JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID
      WHERE H.BELGE_TURU = @BT AND H.BELGE_ID = @BI ORDER BY S.TARIH DESC`);
        for (const q of parcalar) {
            const r = await pool.request().input("T", sql.DateTime, tarih).input("BT", sql.TinyInt, g.belge?.tur ?? 0).input("BI", sql.Int, g.belge?.id ?? 0).query(q);
            const x = r.recordset[0];
            if (x)
                throw ApiError.forbidden(`"${temiz(x.AD)}" için ${trTarih(new Date(x.TARIH))} tarihli onaylı sayım var; bu tarihten önceki belge yalnız sistem yöneticisi tarafından eklenebilir, düzeltilebilir ya da silinebilir.`);
        }
    }
    /** Fiş kapanmış bir vardiyada mı yazılmış + o andaki TL nakit etkisi (satış +, iade −) */
    static async fisVardiyasi(ctx, faturaId) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const v = await pool.request().query(`SELECT OBJECT_ID('dbo.TODVZ_TICARI_VARDIYA', 'U') AS V`);
        const vardiyaVar = v.recordset[0]?.V != null;
        const r = await pool.request().input("F", sql.Int, faturaId).query(`
      SELECT F.VEZNE_ID, RTRIM(F.FATURA_NO) AS NO,
        ${vardiyaVar ? `(SELECT COUNT(*) FROM dbo.TODVZ_TICARI_VARDIYA W WHERE W.VEZNE_ID = F.VEZNE_ID AND W.KAPANIS_ZAMANI IS NOT NULL AND F.EKLEME_ZAMANI >= W.ACILIS_ZAMANI AND F.EKLEME_ZAMANI < W.KAPANIS_ZAMANI)` : "0"} AS KAPALI,
        CASE WHEN F.FATURA_TIPI = 2 THEN -1 ELSE 1 END * ISNULL((SELECT SUM(ISNULL(NULLIF(O.MIKTAR, 0), O.TUTAR)) FROM dbo.TODVZ_FATURA_ODEME O JOIN dbo.TODVZ_PARA P ON P.PARA_ID = O.PARA_ID
          WHERE O.FATURA_ID = F.FATURA_ID AND ISNULL(O.ODEME_ARACI_TURU, 0) = 0 AND ISNULL(O.ISLEME_YERI, 0) = 0 AND RTRIM(UPPER(P.KOD)) IN ('TL', 'TRY')), 0) AS NAKIT
      FROM dbo.TODVZ_FATURA F WHERE F.FATURA_ID = @F`);
        const x = r.recordset[0];
        if (!x)
            return { kapali: false, vezneId: null, nakit: 0, no: "" };
        return { kapali: Number(x.KAPALI) > 0, vezneId: x.VEZNE_ID ?? null, nakit: Math.round((Number(x.NAKIT) || 0) * 100) / 100, no: temiz(x.NO) };
    }
    /** Kapanmış vardiyanın fişi: yönetici değilse 403 */
    static vardiyaDenetle(d, yonetici, islem) {
        if (d.kapali && !yonetici)
            throw ApiError.forbidden(`${d.no || "Fiş"} kapanmış bir vardiyada yazılmış; ${islem} yalnız sistem yöneticisi tarafından yapılabilir.`);
    }
    /**
     * Yönetici kapanmış vardiyanın fişini düzeltti / sildi: nakit farkı (yeni − eski) veznenin açık vardiyasına düzeltme satırı olarak
     * yazılır (açık vardiya yoksa yazılmaz: sıradaki açılışta devir sayımı farkı zaten içerir).
     */
    static async vardiyaDuzeltmesiYaz(ctx, g) {
        const fark = Math.round((g.yeniNakit - g.eskiNakit) * 100) / 100;
        if (!g.vezneId || Math.abs(fark) < 0.005)
            return 0;
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const r = await pool.request().input("V", sql.Int, g.vezneId).input("T", sql.Decimal(18, 2), fark).input("A", sql.NVarChar(200), temiz(g.aciklama).slice(0, 200)).input("K", sql.Int, g.kullaniciId || null).query(`
      IF OBJECT_ID('dbo.TODVZ_TICARI_VARDIYA_DUZELTME', 'U') IS NOT NULL
        INSERT INTO dbo.TODVZ_TICARI_VARDIYA_DUZELTME (VARDIYA_ID, TUTAR, ACIKLAMA, KULLANICI_ID)
        OUTPUT INSERTED.DUZELTME_ID SELECT TOP 1 W.VARDIYA_ID, @T, @A, @K FROM dbo.TODVZ_TICARI_VARDIYA W WHERE W.VEZNE_ID = @V AND W.KAPANIS_ZAMANI IS NULL;`);
        return r.recordset?.length ? fark : 0;
    }
}
