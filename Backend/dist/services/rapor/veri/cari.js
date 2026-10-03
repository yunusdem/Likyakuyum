import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import { aralikOzeti, filtreler, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";
import { POS_HAREKET_KOLONLARI, belgeTablolari, posHareketleriSql } from "../kaynak.js";
const DEKONT_TIPI = { 0: "Emanet alma", 1: "Emanet verme", 2: "Dekont (virman)" };
/** Vadeye kalan gün (negatif = vadesi geçmiş). Tarihler YYYY-AA-GG gün başı olarak karşılaştırılır. Saf fonksiyon. */
export function kalanGun(vade, bugun) {
    const gun = (v) => { const d = new Date(v); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
    return Math.round((gun(vade) - gun(bugun)) / 86400000);
}
export const CARI2_SORGULARI = {
    /**
     * POS ekstre — eski "POS EKSTRE RAPORU" (VODVZR_POS_EKSTRESI) kapsamı, POS cihazı × para bazında (kaynak.ts posHareketleriSql):
     * cihaz tanımındaki devir, POS'lu cari hareketler (cari alacak → POS borç "Cari tahsilat", cari borç → POS alacak "Banka hesabına aktarım") ve
     * sarraf fişinin kartlı tahsilatı ("Fiş tahsilat", POS borç). Eski @BORC / @ALACAK / @Bakiye formülleri: bakiye = Σborç − Σalacak (yürüyen);
     * başlangıç öncesi hareketler ve cihaz devri "POS Devir" satırında (borç ve alacak brüt — grup toplamına dahil), grup altında son bakiye.
     * Doğrulama: test veritabanında eski görünümle karşılaştırıldı (01.10.2026, docs/rapor-denetim.md).
     */
    async POSEKS1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        // Cari süzgeci cihaz devrine uygulanmaz (devrin carisi yoktur); vezne ve para süzgeçleri satırlara uygulanır
        const cariSecili = !!(p.cariKartId || p.cariIdler?.length || p.cariSonId || p.cariBaslangic || p.cariBitis);
        const fCariVezne = filtreler(req, p, { cari: "C", vezne: "V" }), fPara = filtreler(req, p, { para: "X.paraId" });
        const fx = ` AND (${cariSecili ? "" : "X.devir=1 OR "}(1=1${fCariVezne}))${fPara}`;
        const res = await req.query(`
      ;WITH X (${POS_HAREKET_KOLONLARI}) AS (
       ${posHareketleriSql(await belgeTablolari(pool))}
      )
      SELECT X.hareketNo fisNo, X.tarih, ISNULL(X.posCihaziId,0) posId, RTRIM(ISNULL(PC.KOD,'')) cihazKod, RTRIM(ISNULL(PC.AD,'')) cihazAd,
        RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, X.islem, X.aciklama, RTRIM(ISNULL(P.KOD,'')) paraKod, ISNULL(X.borc,0) borc, ISNULL(X.alacak,0) alacak,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, CASE WHEN CAST(X.tarih AS date)<@bas THEN 1 ELSE 0 END onceki
      FROM X LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=X.paraId LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=X.cariKartId LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=X.vezneId
      LEFT JOIN dbo.TODVZ_POS_CIHAZI PC ON PC.POS_CIHAZI_ID=X.posCihaziId
      WHERE CAST(X.tarih AS date)<=@bit ${fx}
      ORDER BY ISNULL(PC.KOD,''), ISNULL(X.posCihaziId,0), ISNULL(P.SIRA_NO,99), P.KOD, X.tarih, X.devir DESC, X.hareketNo;`);
        const gruplar = new Map();
        for (const r of res.recordset) {
            const k = `${r.posId}|${r.paraKod}`, borc = Number(r.borc) || 0, alacak = Number(r.alacak) || 0;
            const pos = Number(r.posId) ? [r.cihazKod, r.cihazAd].filter(Boolean).join(" — ") || `POS cihazı ${r.posId}` : "POS cihazı belirtilmemiş";
            if (!gruplar.has(k))
                gruplar.set(k, { devirBorc: 0, devirAlacak: 0, hareketler: [], ortak: { grupAnahtar: k, grupBaslik: `CİHAZ: ${pos} · ${r.paraKod}`, posCihazi: Number(r.posId) ? (r.cihazKod || String(r.posId)) : "-", paraKod: r.paraKod } });
            const g = gruplar.get(k);
            if (r.onceki) {
                g.devirBorc += borc;
                g.devirAlacak += alacak;
            }
            else
                g.hareketler.push({ ...r, fisNo: String(r.fisNo ?? ""), aciklama: r.aciklama || r.islem, borc, alacak });
        }
        const satirlar = [], sonBakiyeler = [];
        for (const g of gruplar.values()) {
            let bakiye = g.devirBorc - g.devirAlacak, borc = g.devirBorc, alacak = g.devirAlacak;
            if (g.devirBorc || g.devirAlacak)
                satirlar.push({ ...g.ortak, fisNo: "", tarih: p.baslangic, cariKod: "", cariAd: "", aciklama: "POS Devir", vezneKod: "", borc: g.devirBorc, alacak: g.devirAlacak, bakiye, devirSatiri: true });
            for (const h of g.hareketler) {
                bakiye += h.borc - h.alacak;
                borc += h.borc;
                alacak += h.alacak;
                satirlar.push({ ...g.ortak, ...h, bakiye });
            }
            if (g.hareketler.length || g.devirBorc || g.devirAlacak)
                sonBakiyeler.push({ cihaz: g.ortak.grupBaslik, borc, alacak, sonBakiye: bakiye });
        }
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm cariler"}`, "Seçilen aralıkta POS hareketi yok. POS ekstresi POS'lu cari hareketleri, sarraf fişlerinin kartlı tahsilatlarını ve cihaz devrini kapsar; borç = POS'tan tahsil edilecek, alacak = bankaya aktarılan.", sonBakiyeler);
    },
    /** Vadeli işlem listesi — vadesi olan cari dekontlar (emanet alma / verme, virman); iptal edilenler hariç */
    async VADISL1(pool, p, t) {
        if ((!!p.baslangic) !== (!!p.bitis) || (!!p.vadeBaslangic) !== (!!p.vadeBitis))
            throw ApiError.badRequest("Tarih aralıklarında ilk ve son tarih birlikte girilmelidir.");
        const req = pool.request().input("bas", sql.Date, p.baslangic || null).input("bit", sql.Date, p.bitis || null)
            .input("vbas", sql.Date, p.vadeBaslangic || null).input("vbit", sql.Date, p.vadeBitis || null);
        // Cari seçimi dekontun iki tarafına da uygulanır (borçlu veya alacaklı seçilenlerden biriyse)
        const cf = filtreler(req, p, { cari: "CK" });
        const cariKosulu = cf ? ` AND (D.BORCLU_ID IN (SELECT CK.CARI_KART_ID FROM dbo.TODVZ_CARI_KART CK WHERE 1=1 ${cf}) OR D.ALACAKLI_ID IN (SELECT CK.CARI_KART_ID FROM dbo.TODVZ_CARI_KART CK WHERE 1=1 ${cf}))` : "";
        const pids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0);
        pids.forEach((id, i) => req.input(`vp${i}`, sql.Int, id));
        const paraKosulu = pids.length ? ` AND S.PARA_ID IN (${pids.map((_, i) => `@vp${i}`).join(",")})` : "";
        const durum = p.durum === "gecmis" ? " AND CAST(D.VADE AS date)<CAST(GETDATE() AS date)" : p.durum === "tumu" ? "" : " AND CAST(D.VADE AS date)>=CAST(GETDATE() AS date)";
        const sira = p.siralama === "ad" ? "ilgiliAd, D.VADE" : p.siralama === "kod" ? "ilgiliKod, D.VADE" : "D.VADE, D.CARI_DEKONT_ID";
        const res = await req.query(`
      SELECT D.CARI_DEKONT_ID dekontNo, D.TIP tipKod, D.TARIH tarih, D.VADE vade, CAST(GETDATE() AS date) bugun, RTRIM(ISNULL(D.ACIKLAMA,'')) aciklama,
        RTRIM(ISNULL(B.KOD,'')) borcluKod, RTRIM(ISNULL(B.AD,'')) borcluAd, RTRIM(ISNULL(A.KOD,'')) alacakliKod, RTRIM(ISNULL(A.AD,'')) alacakliAd,
        CASE WHEN D.TIP=0 THEN RTRIM(ISNULL(A.AD,'')) ELSE RTRIM(ISNULL(B.AD,'')) END ilgiliAd, CASE WHEN D.TIP=0 THEN RTRIM(ISNULL(A.KOD,'')) ELSE RTRIM(ISNULL(B.KOD,'')) END ilgiliKod,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(S.MEBLAG,0) meblag, ISNULL(S.KUR,0) kur, ISNULL(NULLIF(S.HAS_ORANI,0),ISNULL(P.HAS_ORANI,0)) hasOrani
      FROM dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI S ON S.CARI_DEKONT_ID=D.CARI_DEKONT_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
        LEFT JOIN dbo.TODVZ_CARI_KART B ON B.CARI_KART_ID=D.BORCLU_ID LEFT JOIN dbo.TODVZ_CARI_KART A ON A.CARI_KART_ID=D.ALACAKLI_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=D.VEZNE_ID
      WHERE D.VADE IS NOT NULL AND D.IPTAL_TARIHI IS NULL
        AND (@bas IS NULL OR CAST(D.TARIH AS date) BETWEEN @bas AND @bit) AND (@vbas IS NULL OR CAST(D.VADE AS date) BETWEEN @vbas AND @vbit)
        ${durum}${cariKosulu}${paraKosulu}
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, ${sira}, S.SATIR_NO;`);
        const satirlar = res.recordset.map((r) => {
            const m = Number(r.meblag) || 0;
            return { ...r, dekontNo: String(r.dekontNo ?? ""), tip: DEKONT_TIPI[Number(r.tipKod)] || "Diğer", kalanGun: kalanGun(r.vade, r.bugun), meblag: m, kur: Number(r.kur) || 0,
                borclu: `${r.borcluKod} — ${r.borcluAd}`.replace(/^ — $/, ""), alacakli: `${r.alacakliKod} — ${r.alacakliAd}`.replace(/^ — $/, ""), hasKarsiligi: m * (Number(r.hasOrani) || 0) };
        });
        const ozet = [p.durum === "gecmis" ? "Vadesi geçmiş" : p.durum === "tumu" ? "Tüm vadeler" : "Açık (vadesi gelmemiş)",
            p.vadeBaslangic ? `Vade ${tarihTr(p.vadeBaslangic)} – ${tarihTr(p.vadeBitis)}` : "", p.baslangic ? `İşlem ${aralikOzeti(p)}` : ""].filter(Boolean).join(" · ");
        return sinirla(satirlar, t, `${ozet}${ozetEk(p)}`, "Vadesi girilmiş cari dekontlar (emanet alma, emanet verme, virman) listelenir; iptal edilenler hariçtir. Kalan gün = vade − bugün (eksi değer vadesi geçmiş demektir). Has karşılığı = meblağ × has oranı. Cari seçimi dekontun borçlu ve alacaklı tarafına birlikte uygulanır.");
    },
};
