import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, aralikOzeti, filtreler, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";

/** Cari raporları — 2. dalga (docs/raporlar-faz2.md, Faz R2-C): POS ekstre, vadeli işlem listesi. Yalnızca SELECT. */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

const DEKONT_TIPI: Record<number, string> = { 0: "Emanet alma", 1: "Emanet verme", 2: "Dekont (virman)" };

/** Vadeye kalan gün (negatif = vadesi geçmiş). Tarihler YYYY-AA-GG gün başı olarak karşılaştırılır. Saf fonksiyon. */
export function kalanGun(vade: string | Date, bugun: string | Date): number {
  const gun = (v: string | Date) => { const d = new Date(v); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  return Math.round((gun(vade) - gun(bugun)) / 86400000);
}

export const CARI2_SORGULARI: Record<string, Sorgu> = {

  /** POS ekstre — POS / kredi kartı türündeki cari hareketler (HAREKET_TIPI = 2), POS cihazı bazında */
  async POSEKS1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { cari: "C", vezne: "V", para: "S.PARA_ID" });
    const res = await req.query(`
      SELECT H.CARI_HAREKET_ID fisNo, H.TARIH tarih, ISNULL(H.POS_CIHAZI_ID,0) posId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, H.TIP tipKod,
        RTRIM(ISNULL(H.ACIKLAMA,'')) aciklama, RTRIM(P.KOD) paraKod, S.MEBLAG meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.VEZNE_ID
      WHERE H.HAREKET_TIPI=2 AND CAST(H.TARIH AS date) BETWEEN @bas AND @bit ${f}
      ORDER BY ISNULL(H.POS_CIHAZI_ID,0), ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH, H.CARI_HAREKET_ID, S.SATIR_NO;`);
    const satirlar = res.recordset.map((r: any) => { const m = Number(r.meblag) || 0, borc = Number(r.tipKod) === 0; const pos = Number(r.posId) ? `POS cihazı ${r.posId}` : "POS cihazı belirtilmemiş";
      return { ...r, fisNo: String(r.fisNo ?? ""), posCihazi: Number(r.posId) ? String(r.posId) : "-", borc: borc ? m : 0, alacak: borc ? 0 : m,
        grupAnahtar: `${r.posId}|${r.paraKod}`, grupBaslik: `${pos} · ${r.paraKod}` }; });
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm cariler"}`,
      "Yalnızca hareket tipi \"POS / Kredi Kartı\" olan cari hareketler listelenir; POS cihazı ve para birimi bazında gruplanır. Borç = carinin borçlandığı, Alacak = cariden POS ile tahsil edilen tutar.");
  },

  /** Vadeli işlem listesi — vadesi olan cari dekontlar (emanet alma / verme, virman); iptal edilenler hariç */
  async VADISL1(pool, p, t) {
    if ((!!p.baslangic) !== (!!p.bitis) || (!!p.vadeBaslangic) !== (!!p.vadeBitis)) throw ApiError.badRequest("Tarih aralıklarında ilk ve son tarih birlikte girilmelidir.");
    const req = pool.request().input("bas", sql.Date, p.baslangic || null).input("bit", sql.Date, p.bitis || null)
      .input("vbas", sql.Date, p.vadeBaslangic || null).input("vbit", sql.Date, p.vadeBitis || null);
    // Cari seçimi dekontun iki tarafına da uygulanır (borçlu veya alacaklı seçilenlerden biriyse)
    const cf = filtreler(req, p, { cari: "CK" });
    const cariKosulu = cf ? ` AND (D.BORCLU_ID IN (SELECT CK.CARI_KART_ID FROM dbo.TODVZ_CARI_KART CK WHERE 1=1 ${cf}) OR D.ALACAKLI_ID IN (SELECT CK.CARI_KART_ID FROM dbo.TODVZ_CARI_KART CK WHERE 1=1 ${cf}))` : "";
    const pids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0); pids.forEach((id, i) => req.input(`vp${i}`, sql.Int, id));
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
    const satirlar = res.recordset.map((r: any) => { const m = Number(r.meblag) || 0;
      return { ...r, dekontNo: String(r.dekontNo ?? ""), tip: DEKONT_TIPI[Number(r.tipKod)] || "Diğer", kalanGun: kalanGun(r.vade, r.bugun), meblag: m, kur: Number(r.kur) || 0,
        borclu: `${r.borcluKod} — ${r.borcluAd}`.replace(/^ — $/, ""), alacakli: `${r.alacakliKod} — ${r.alacakliAd}`.replace(/^ — $/, ""), hasKarsiligi: m * (Number(r.hasOrani) || 0) }; });
    const ozet = [p.durum === "gecmis" ? "Vadesi geçmiş" : p.durum === "tumu" ? "Tüm vadeler" : "Açık (vadesi gelmemiş)",
      p.vadeBaslangic ? `Vade ${tarihTr(p.vadeBaslangic)} – ${tarihTr(p.vadeBitis)}` : "", p.baslangic ? `İşlem ${aralikOzeti(p)}` : ""].filter(Boolean).join(" · ");
    return sinirla(satirlar, t, `${ozet}${ozetEk(p)}`,
      "Vadesi girilmiş cari dekontlar (emanet alma, emanet verme, virman) listelenir; iptal edilenler hariçtir. Kalan gün = vade − bugün (eksi değer vadesi geçmiş demektir). Has karşılığı = meblağ × has oranı. Cari seçimi dekontun borçlu ve alacaklı tarafına birlikte uygulanır.");
  },
};
