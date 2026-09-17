import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, adetOzeti, aralikOzeti, filtreler, idFiltre, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";

/**
 * Fiş raporları (docs/raporlar-faz2.md, Faz R2-F) — yalnızca SELECT. Kaynak TODVZ_FIS + TODVZ_FIS_SATIRI; iptal fişler hariç.
 * Crystal'daki "GENEL TOPLAM" alt raporlarının karşılığı `ozetSatirlar` (para bazında özet).
 */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

const tipAdi = (k: any) => (Number(k) === 1 ? "Satış" : "Alış");
const tipOzeti = (p: RaporParametreler) => (p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : "");
const tipGirdisi = (req: sql.Request, p: RaporParametreler) => req.input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);

const SATIR_JOIN = `dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
  LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_ISTATISTIK I ON I.ISTATISTIK_ID=F.ISTATISTIK_ID`;

/** Para (× tip) bazında özet: adet = farklı fiş sayısı, ortalama kur = tutar / miktar. Saf fonksiyon — testte kullanılır. */
export function paraOzeti(satirlar: { fisId: number; paraKod: string; tip: string; miktar: number; tutar: number; komisyon?: number; bmv?: number; kmv?: number; kdv?: number }[]) {
  const m = new Map<string, any>();
  for (const s of satirlar) {
    const k = `${s.paraKod}|${s.tip}`;
    if (!m.has(k)) m.set(k, { paraKod: s.paraKod, tip: s.tip, fisler: new Set<number>(), miktar: 0, tutar: 0, komisyon: 0, bmv: 0, kmv: 0, kdv: 0 });
    const o = m.get(k); o.fisler.add(s.fisId);
    o.miktar += Number(s.miktar) || 0; o.tutar += Number(s.tutar) || 0; o.komisyon += Number(s.komisyon) || 0; o.bmv += Number(s.bmv) || 0; o.kmv += Number(s.kmv) || 0; o.kdv += Number(s.kdv) || 0;
  }
  return [...m.values()].map(({ fisler, ...o }) => ({ ...o, adet: fisler.size, ortKur: o.miktar ? o.tutar / o.miktar : 0 }));
}

export const FIS_SORGULARI: Record<string, Sorgu> = {

  /** Fiş listeleme — fiş başına tek satır (satır toplamlarıyla); vezne bazında gruplu */
  async FISLIS1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis), p);
    const f = filtreler(req, p, { cari: "C", vezne: "V" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
    // Para seçimi: fişin en az bir satırında seçilen paralardan biri varsa fiş listelenir
    const pids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0); pids.forEach((id, i) => req.input(`fp${i}`, sql.Int, id));
    const paraKosulu = pids.length ? ` AND EXISTS (SELECT 1 FROM dbo.TODVZ_FIS_SATIRI X WHERE X.FIS_ID=F.FIS_ID AND X.PARA_ID IN (${pids.map((_, i) => `@fp${i}`).join(",")}))` : "";
    const cariSecili = !!(p.cariIdler?.length || p.cariSonId || p.cariKartId);
    const res = await req.query(`
      SELECT F.FIS_ID fisId, ISNULL(F.ZAMAN,F.TARIH) zaman, F.TIP tipKod, RTRIM(ISNULL(F.SERI_NO,''))+RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo,
        RTRIM(ISNULL(F.UNVAN,'')) unvan, RTRIM(ISNULL(F.VERGI_KIMLIK_NO,'')) kimlikNo, RTRIM(ISNULL(C.KOD,'')) cariKod,
        RTRIM(ISNULL(I.KOD,'')) istatistikKod, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd,
        ISNULL(F.TOPLAM_TUTAR,0) toplamTutar, ISNULL(F.ODEME_TUTARI,0) odemeTutari, ISNULL(X.satirSayisi,0) satirSayisi, ISNULL(X.paralar,'') paralar,
        ISNULL(X.komisyon,0) komisyon, ISNULL(X.bmv,0) bmv, ISNULL(X.kmv,0) kmv, ISNULL(X.kdv,0) kdv
      FROM dbo.TODVZ_FIS F LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_ISTATISTIK I ON I.ISTATISTIK_ID=F.ISTATISTIK_ID
        ${cariSecili ? "JOIN" : "LEFT JOIN"} dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=F.CARI_KART_ID
        OUTER APPLY (SELECT COUNT(*) satirSayisi, SUM(S.KOMISYON) komisyon, SUM(S.BMV) bmv, SUM(S.KMV) kmv, SUM(S.KDV) kdv,
          STUFF((SELECT DISTINCT ', '+RTRIM(P2.KOD) FROM dbo.TODVZ_FIS_SATIRI S2 JOIN dbo.TODVZ_PARA P2 ON P2.PARA_ID=S2.PARA_ID WHERE S2.FIS_ID=F.FIS_ID FOR XML PATH('')),1,2,'') paralar
          FROM dbo.TODVZ_FIS_SATIRI S WHERE S.FIS_ID=F.FIS_ID) X
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}${paraKosulu}
      ORDER BY V.KOD, ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID;`);
    const satirlar = res.recordset.map((r: any) => ({ ...r, tip: tipAdi(r.tipKod), toplamTutar: Number(r.toplamTutar), odemeTutari: Number(r.odemeTutari), satirSayisi: Number(r.satirSayisi),
      komisyon: Number(r.komisyon), bmv: Number(r.bmv), kmv: Number(r.kmv), kdv: Number(r.kdv), vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.istatistikIdler, "istatistik")}`,
      "Her fiş tek satırdır; komisyon ve vergiler fiş satırlarının toplamıdır. Para seçilirse, satırlarından en az birinde o para bulunan fişler listelenir. İptal fişler hariçtir.");
  },

  /** Günlük fiş detay — seçilen günün fiş satırları; sonda para bazında GENEL TOPLAM özeti */
  async GUNFIS1(pool, p, t) {
    if (!p.tarih) throw ApiError.badRequest("Tarih zorunludur.");
    const req = tipGirdisi(pool.request().input("t", sql.Date, p.tarih), p);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    const res = await req.query(`
      SELECT F.FIS_ID fisId, ISNULL(F.ZAMAN,F.TARIH) zaman, F.TIP tipKod, RTRIM(ISNULL(F.SERI_NO,''))+RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, RTRIM(P.KOD) paraKod, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar,
        ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KDV,0) kdv
      FROM ${SATIR_JOIN}
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)=@t AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY V.KOD, F.TIP, ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
    const satirlar = res.recordset.map((r: any) => ({ ...r, tip: tipAdi(r.tipKod), miktar: Number(r.miktar), kur: Number(r.kur), tutar: Number(r.tutar), komisyon: Number(r.komisyon),
      bmv: Number(r.bmv), kmv: Number(r.kmv), kdv: Number(r.kdv), grupAnahtar: `${r.vezneKod}|${r.tipKod}`, grupBaslik: `${r.vezneKod} — ${r.vezneAd} · ${tipAdi(r.tipKod)}` }));
    return sinirla(satirlar, t, `${tarihTr(p.tarih)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}`,
      "Vezne ve fiş tipine göre gruplanır; ara toplamlar farklı paraların TL tutarlarını toplar, miktar toplamı için sondaki para bazındaki özet kullanılır. İptal fişler hariçtir.", paraOzeti(satirlar));
  },

  /** İstatistik raporu — istatistik kodu bazında, para × tip satırları; sonda para bazında özet */
  async ISTRAP1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis), p);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
    const res = await req.query(`
      SELECT ISNULL(F.ISTATISTIK_ID,0) istatistikId, RTRIM(ISNULL(I.KOD,'')) istatistikKod, RTRIM(ISNULL(I.ACIKLAMA,'')) istatistikAd, F.TIP tipKod, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        COUNT(DISTINCT F.FIS_ID) adet, SUM(S.MIKTAR) miktar, SUM(S.TUTAR) tutar, SUM(S.KOMISYON) komisyon, SUM(S.BMV) bmv, SUM(S.KMV) kmv, SUM(S.KDV) kdv
      FROM ${SATIR_JOIN}
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      GROUP BY F.ISTATISTIK_ID, I.KOD, I.ACIKLAMA, F.TIP, P.KOD, P.SIRA_NO
      ORDER BY I.KOD, F.TIP, ISNULL(P.SIRA_NO,99), P.KOD;`);
    const satirlar = res.recordset.map((r: any) => { const miktar = Number(r.miktar) || 0, tutar = Number(r.tutar) || 0;
      return { ...r, tip: tipAdi(r.tipKod), adet: Number(r.adet), miktar, tutar, ortKur: miktar ? tutar / miktar : 0, komisyon: Number(r.komisyon), bmv: Number(r.bmv), kmv: Number(r.kmv), kdv: Number(r.kdv),
        istatistikBaslik: r.istatistikKod ? `${r.istatistikKod} — ${r.istatistikAd}` : "İstatistik kodu yok" }; });
    // Özet: para × tip; adet istatistik gruplarındaki fiş adetlerinin toplamıdır (bir fiş tek istatistik koduna bağlıdır)
    const oz = new Map<string, any>();
    for (const s of satirlar) { const k = `${s.paraKod}|${s.tip}`; if (!oz.has(k)) oz.set(k, { paraKod: s.paraKod, tip: s.tip, adet: 0, miktar: 0, tutar: 0, komisyon: 0, bmv: 0, kmv: 0, kdv: 0 });
      const o = oz.get(k); for (const a of ["adet", "miktar", "tutar", "komisyon", "bmv", "kmv", "kdv"]) o[a] += Number((s as any)[a]) || 0; }
    const ozet = [...oz.values()].map(o => ({ ...o, ortKur: o.miktar ? o.tutar / o.miktar : 0 }));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.istatistikIdler, "istatistik")}`,
      "Fişler istatistik koduna göre gruplanır; ortalama kur = tutar / miktar. İptal fişler hariçtir.", ozet);
  },

  /** İstatistik bazında KMV raporu — yalnız satış fişleri; istatistik → para × KMV oranı */
  async ISTKMV1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
    const res = await req.query(`
      SELECT RTRIM(ISNULL(I.KOD,'')) istatistikKod, RTRIM(ISNULL(I.ACIKLAMA,'')) istatistikAd, RTRIM(P.KOD) paraKod, ISNULL(S.KMV_ORANI,0) kmvOrani,
        COUNT(DISTINCT F.FIS_ID) adet, SUM(S.MIKTAR) miktar, SUM(S.TUTAR) matrah, SUM(S.KMV) kmv
      FROM ${SATIR_JOIN}
      WHERE ISNULL(F.IPTAL,0)=0 AND F.TIP=1 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (ISNULL(S.KMV,0)<>0 OR ISNULL(S.KMV_ORANI,0)<>0) ${f}
      GROUP BY I.KOD, I.ACIKLAMA, P.KOD, P.SIRA_NO, S.KMV_ORANI
      ORDER BY I.KOD, ISNULL(P.SIRA_NO,99), P.KOD, S.KMV_ORANI;`);
    const satirlar = res.recordset.map((r: any) => ({ ...r, adet: Number(r.adet), miktar: Number(r.miktar), matrah: Number(r.matrah), kmvOrani: Number(r.kmvOrani), kmv: Number(r.kmv),
      istatistikBaslik: r.istatistikKod ? `${r.istatistikKod} — ${r.istatistikAd}` : "İstatistik kodu yok" }));
    return sinirla(satirlar, t, `${aralikOzeti(p)} · Satış${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.istatistikIdler, "istatistik")}`,
      "Kambiyo muameleleri vergisi (KMV) yalnızca satış fişlerinde doğar; KMV'si veya KMV oranı olmayan satırlar listelenmez. Matrah = satır tutarı (TL). İptal fişler hariçtir.");
  },

  /** Vergi numarası raporu — müşteri kimliği (VKN / TCKN / pasaport) bazında işlem toplamları; TL ve USD karşılığı */
  async VERNUM1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis), p)
      .input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    const res = await req.query(`
      SELECT COALESCE(NULLIF(RTRIM(F.VERGI_KIMLIK_NO),''), NULLIF(RTRIM(F.PASAPORT_NO),''), '') kimlikNo, CASE WHEN NULLIF(RTRIM(F.VERGI_KIMLIK_NO),'') IS NULL AND NULLIF(RTRIM(F.PASAPORT_NO),'') IS NOT NULL THEN 1 ELSE 0 END pasaport,
        MAX(RTRIM(ISNULL(F.UNVAN,''))) unvan, F.TIP tipKod, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        COUNT(DISTINCT F.FIS_ID) adet, SUM(S.MIKTAR) miktar, SUM(S.TUTAR) tutar, SUM(S.BMV) bmv, SUM(S.KMV) kmv, SUM(S.KOMISYON) komisyon,
        SUM(CASE WHEN ISNULL(F.GISE_USD_KURU,0)>0 THEN S.TUTAR/F.GISE_USD_KURU ELSE 0 END) usdKarsiligi
      FROM ${SATIR_JOIN}
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip)
        AND (@arama IS NULL OR F.VERGI_KIMLIK_NO LIKE @arama OR F.PASAPORT_NO LIKE @arama OR F.UNVAN LIKE @arama) ${f}
      GROUP BY COALESCE(NULLIF(RTRIM(F.VERGI_KIMLIK_NO),''), NULLIF(RTRIM(F.PASAPORT_NO),''), ''),
        CASE WHEN NULLIF(RTRIM(F.VERGI_KIMLIK_NO),'') IS NULL AND NULLIF(RTRIM(F.PASAPORT_NO),'') IS NOT NULL THEN 1 ELSE 0 END, F.TIP, P.KOD, P.SIRA_NO;`);
    const ham = res.recordset.map((r: any) => { const miktar = Number(r.miktar) || 0, tutar = Number(r.tutar) || 0; const no = String(r.kimlikNo || "");
      const tur = !no ? "" : r.pasaport ? "Pasaport" : no.length === 11 ? "TCKN" : "VKN";
      return { ...r, tip: tipAdi(r.tipKod), adet: Number(r.adet), miktar, tutar, ortKur: miktar ? tutar / miktar : 0, bmv: Number(r.bmv), kmv: Number(r.kmv), komisyon: Number(r.komisyon), usdKarsiligi: Number(r.usdKarsiligi) || 0,
        grupAnahtar: no || "-", grupBaslik: no ? `${tur} ${no} — ${r.unvan}` : "Kimlik numarası girilmemiş fişler" }; });
    // Grup sırası: kimlik no / ünvan / toplam tutar (büyükten küçüğe); grup içinde tip → para sırası
    const toplam = new Map<string, number>(); for (const s of ham) toplam.set(s.grupAnahtar, (toplam.get(s.grupAnahtar) || 0) + s.tutar);
    const unvan = new Map<string, string>(); for (const s of ham) if (!unvan.has(s.grupAnahtar)) unvan.set(s.grupAnahtar, s.unvan);
    const satirlar = ham.sort((a: any, b: any) => (p.siralama === "tutar" ? (toplam.get(b.grupAnahtar)! - toplam.get(a.grupAnahtar)!) : p.siralama === "unvan" ? (unvan.get(a.grupAnahtar) || "").localeCompare(unvan.get(b.grupAnahtar) || "", "tr") : 0)
      || a.grupAnahtar.localeCompare(b.grupAnahtar) || a.tipKod - b.tipKod || a.siraNo - b.siraNo || a.paraKod.localeCompare(b.paraKod));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${p.arama?.trim() ? ` · Arama: "${p.arama.trim()}"` : ""}`,
      "Fişler müşterinin vergi / TC kimlik numarasına (yoksa pasaport numarasına) göre gruplanır. USD karşılığı her fişin kayıt anındaki gişe USD kuruyla hesaplanır (kuru kaydedilmemiş fişlerde 0). İptal fişler hariçtir.");
  },
};
