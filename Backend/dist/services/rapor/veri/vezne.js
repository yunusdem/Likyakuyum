import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import { aralikOzeti, filtreler, kurCoz, ozetEk, paraKumesi, sinirla } from "../raporOrtak.js";
/** Kur sapması: fiş kuru ile o andaki gişe kuru arasındaki fark ve yüzdesi. Gişe kuru yoksa (0) sapma hesaplanmaz. Saf fonksiyon. */
export function kurSapmasi(fisKuru, giseKuru, miktar) {
    const f = Number(fisKuru) || 0, g = Number(giseKuru) || 0;
    if (!g)
        return { fark: 0, sapmaYuzde: 0, tlEtkisi: 0, giseVar: false };
    const fark = f - g;
    return { fark, sapmaYuzde: (fark / g) * 100, tlEtkisi: fark * (Number(miktar) || 0), giseVar: true };
}
export const VEZNE_SORGULARI = {
    /** Vezne bakiye raporu (anlık) — TODVZ_VEZNE_BAKIYE tablosundan; Döviz Fişi ekranının gösterdiği bakiye */
    async VEZANL1(pool, p, t) {
        const kur = await kurCoz(pool, p);
        const req = pool.request();
        const f = filtreler(req, p, { vezne: "V" });
        const sira = p.siralama === "ad" ? "P.AD" : "ISNULL(P.SIRA_NO,99), P.KOD";
        const res = await req.query(`
      SELECT B.VEZNE_ID vezneId, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, B.PARA_ID paraId,
        RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(B.MIKTAR,0) miktar
      FROM dbo.TODVZ_VEZNE_BAKIYE B LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=B.VEZNE_ID LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=B.PARA_ID
      WHERE ABS(ISNULL(B.MIKTAR,0))>0.000001 ${f}
      ORDER BY V.KOD, ${sira};`);
        const paraSet = await paraKumesi(pool, p);
        const satirlar = res.recordset.filter((r) => !paraSet || paraSet.has(Number(r.paraId))).map((r) => {
            const id = Number(r.paraId), m = Number(r.miktar) || 0, k = kur.kurlar.get(id) ?? 0, ks = kur.satisKurlari.get(id) ?? 0;
            return { ...r, miktar: m, kur: k, tlKarsiligi: m * k, kurSatis: ks, tlSatis: m * ks, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` };
        });
        return sinirla(satirlar, t, `Anlık bakiye${ozetEk(p) || " · Tüm vezneler"} · ${kur.aciklama}`, `Anlık bakiye tablosundan (her kayıtta güncellenen vezne bakiyesi) okunur; Döviz Fişi ekranındaki bakiyeyle aynıdır. Geçmiş bir tarih için "Vezne Bakiye Raporu (Tarih Bazlı)" kullanılır; o rapor hareketlerden hesapladığı için küçük farklar olabilir. ${kur.aciklama}.`);
    },
    /**
     * Kur kontrolü — eski VODVZR_KUR_KONTROLU karşılığı (kolonları canlıda doğrulandı 17.09.2026: TARIH, PARA, ALIS_MIKTARI, ALIS_TUTARI,
     * SATIS_MIKTARI, SATIS_TUTARI, KULLANICI_ADI, VEZNE_ADI): gün × para × vezne × kullanıcı bazında alış ve satışın miktarı, tutarı ve ortalama kuru.
     */
    async KURKON2(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
        const ayrinti = p.birlestir !== "gun"; // "gun": vezne ve kullanıcı ayrımı olmadan yalnız gün × para
        const res = await req.query(`
      SELECT CAST(F.TARIH AS date) gun, RTRIM(P.KOD) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo,
        ${ayrinti ? "RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(U.AD,'')) kullanici," : "'' vezneKod, '' kullanici,"}
        SUM(CASE WHEN F.TIP=0 THEN S.MIKTAR ELSE 0 END) alisMiktar, SUM(CASE WHEN F.TIP=0 THEN S.TUTAR ELSE 0 END) alisTutar,
        SUM(CASE WHEN F.TIP=1 THEN S.MIKTAR ELSE 0 END) satisMiktar, SUM(CASE WHEN F.TIP=1 THEN S.TUTAR ELSE 0 END) satisTutar
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit ${f}
      GROUP BY CAST(F.TARIH AS date), P.KOD, P.AD, P.SIRA_NO${ayrinti ? ", V.KOD, U.AD" : ""}
      ORDER BY CAST(F.TARIH AS date), ISNULL(P.SIRA_NO,99), P.KOD${ayrinti ? ", V.KOD, U.AD" : ""};`);
        const satirlar = res.recordset.map((r) => {
            const am = Number(r.alisMiktar) || 0, at = Number(r.alisTutar) || 0, sm = Number(r.satisMiktar) || 0, st = Number(r.satisTutar) || 0;
            const oa = am ? at / am : 0, os = sm ? st / sm : 0;
            return { ...r, alisMiktar: am, alisTutar: at, ortAlisKuru: oa, satisMiktar: sm, satisTutar: st, ortSatisKuru: os, makas: oa && os ? os - oa : 0,
                gunBaslik: new Date(r.gun).toLocaleDateString("tr-TR", { timeZone: "UTC" }) };
        });
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"} · ${ayrinti ? "vezne ve kullanıcı ayrıntılı" : "gün × para"}`, "Ortalama kur = tutar / miktar. Makas = ortalama satış kuru − ortalama alış kuru (aynı satırda hem alış hem satış varsa). TL satırlarında kur 1'dir. İptal fişler hariçtir; cari dekontlar kapsam dışıdır.");
    },
    /** Kur sapma raporu (eski VODVZR_KUR_SAPMA_RAPORU karşılığı) — fiş satırındaki kur ile kayıt anındaki gişe kurunun karşılaştırması; sapma eşiği üstündekiler */
    async KURKON1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
            .input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
        const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
        const res = await req.query(`
      SELECT F.FIS_ID fisId, ISNULL(F.ZAMAN,F.TARIH) zaman, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, F.TIP tipKod,
        RTRIM(ISNULL(F.SERI_NO,''))+RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan, RTRIM(P.KOD) paraKod,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.GISE_KURU,0) giseKuru, RTRIM(ISNULL(U.AD,'')) kaydeden
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY V.KOD, ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
        const esik = Number(p.sapma) || 0;
        let gisesiz = 0;
        const satirlar = res.recordset.map((r) => {
            const s = kurSapmasi(r.kur, r.giseKuru, r.miktar);
            if (!s.giseVar)
                gisesiz++;
            return { ...r, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış", miktar: Number(r.miktar), kur: Number(r.kur), giseKuru: Number(r.giseKuru),
                fark: s.fark, sapmaYuzde: s.sapmaYuzde, tlEtkisi: s.tlEtkisi, giseVar: s.giseVar, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` };
        }).filter((r) => r.giseVar && Math.abs(r.sapmaYuzde) >= esik && (esik > 0 || Math.abs(r.fark) > 0.0000001));
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : ""} · Sapma ≥ %${esik.toLocaleString("tr-TR")}`, `Sapma % = (fiş kuru − gişe kuru) / gişe kuru × 100; TL etkisi = fark × miktar. Eşik 0 iken kuru gişe kurundan farklı olan tüm satırlar listelenir; kuru gişe kuruyla aynı olanlar listelenmez. İptal fişler hariçtir.${gisesiz ? ` Gişe kuru kaydedilmemiş ${gisesiz} satır karşılaştırılamadığı için kapsam dışıdır.` : ""}`);
    },
};
