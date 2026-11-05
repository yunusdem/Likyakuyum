import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporGrup, RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, adetOzeti, aralikOzeti, ek, ekOnay, filtreler, idFiltre, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";
import { paraGrubunaGoreSirala, paraGrupBilgisi } from "../paraGrup.js";

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

/** Vergiler ve komisyon: VERKOM1 — döviz fişine özgüdür (dbo.TODVZ_FIS; komisyon / BSMV / KMV yalnız döviz fişinde). Yalnızca SELECT. */

/** Ek onay kutusu: `p.ek` → (yerel deneme betikleri için) parametrenin kendisi */
const ekIsaretli = (p: RaporParametreler, ad: string): boolean => ekOnay(p, ad) || (ek(p, ad) === "" && ["1", "true", "evet"].includes(String((p as any)[ad] ?? "").toLowerCase()));

/**
 * VERKOM1 grupları (eski rapor: @Grup → gün): seçilen gruplama (vezne / para / gün) dış seviyedir; "Tarih ara toplamı" işaretliyse ve gruplama gün değilse
 * içine gün alt grubu + gün toplamı girer (gruplama gün iken gün zaten dış seviyedir). Saf fonksiyon.
 */
export function vergiKomisyonGruplari(grupTuru: string, tarihAraToplami: boolean): RaporGrup[] {
  const dis: RaporGrup = { anahtar: "grupAnahtar", baslik: "{{grupBaslik}}", altToplam: true };
  if (!tarihAraToplami || grupTuru === "gun") return [dis];
  return [dis, { anahtar: "gunAnahtar", baslik: "{{gunBaslik}}", altToplam: true, toplamEtiketi: "{{gunBaslik}} toplamı" }];
}

export const VERGI_KOMISYON_SORGULARI: Record<string, Sorgu> = {
  /**
   * R7 Vergiler ve komisyon — eski "VERGİLER VE KOMİSYON RAPORU" metrikleri. Rapor tipi (`birlestir`): "detay" (varsayılan) fiş satırı — tarih, saat, seri no, vezne, belge no,
   * para, tutar, KMV, komisyon %, komisyon, BSMV, tip (A / S); "toplam" gün × para özeti (önceki düzen). Gruplama (`siralama`): vezne / para (eski "Döviz bazında") / gün
   * (eski "Yok"). "Tarih ara toplamı" seçilen grubun içine gün alt grubu ekler. İstatistik süzgeci (boş = tümü); iptal edilenler işaretliyse yalnız iptal fişler.
   * Para gruplamasında paralar Döviz / Kuyum bölümlerine ayrılır.
   */
  async VERKOM1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const toplam = p.birlestir === "toplam", grupTuru = p.siralama === "para" ? "para" : p.siralama === "gun" ? "gun" : "vezne";
    const iptal = ekIsaretli(p, "iptal"), tarihAraToplami = ekIsaretli(p, "tarihAraToplami");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("iptal", sql.Int, iptal ? 1 : 0)
      .input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
    const sira = grupTuru === "para" ? "ISNULL(P.SIRA_NO,99), P.KOD, " : grupTuru === "gun" ? "" : "V.KOD, ";
    const res = await req.query(`
      SELECT F.FIS_ID fisId, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, CAST(F.TARIH AS date) gun, ISNULL(F.ZAMAN,F.TARIH) zaman, F.TIP tipKod,
        RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KOMISYON_ORANI,0) komisyonOrani, ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KDV,0) kdv
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=@iptal AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY ${sira}CAST(F.TARIH AS date), ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
    const ham = res.recordset.map((r: any) => { const bmv = Number(r.bmv) || 0, kmv = Number(r.kmv) || 0, kdv = Number(r.kdv) || 0;
      const gunAnahtar = new Date(r.gun).toISOString().slice(0, 10), gunBaslik = tarihTr(gunAnahtar);
      const grupBaslik = grupTuru === "para" ? `Para birimi: ${r.paraKod}` : grupTuru === "gun" ? gunBaslik : `Vezne ${r.vezneKod} — ${r.vezneAd}`;
      return { ...r, saat: r.zaman, tip: Number(r.tipKod) === 1 ? "S" : "A", miktar: Number(r.miktar) || 0, tutar: Number(r.tutar) || 0, komisyonOrani: Number(r.komisyonOrani) || 0, komisyon: Number(r.komisyon) || 0, bmv, kmv, kdv,
        toplamVergi: bmv + kmv + kdv, adet: 1, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}`, gunAnahtar, gunBaslik, grupAnahtar: grupBaslik, grupBaslik }; });
    let satirlar: any[] = ham;
    if (toplam) { const m = new Map<string, any>();
      for (const x of ham) { const k = `${x.grupAnahtar}|${x.gunAnahtar}|${x.paraKod}`;
        if (!m.has(k)) m.set(k, { ...x, zaman: x.gun, saat: null, seriNo: "", belgeNo: "", tip: "", komisyonOrani: 0, fisler: new Set<number>(), miktar: 0, tutar: 0, komisyon: 0, bmv: 0, kmv: 0, kdv: 0, toplamVergi: 0 });
        const o = m.get(k); o.fisler.add(x.fisId); for (const a_ of ["miktar", "tutar", "komisyon", "bmv", "kmv", "kdv", "toplamVergi"]) o[a_] += x[a_]; }
      satirlar = [...m.values()].map(({ fisler, ...o }) => ({ ...o, adet: fisler.size })); }
    // Her paranın ayrı grup olduğu düzende paralar Döviz → Kuyum bölümlerine dizilir (K11; tanımdaki `bolum`: paraGrupAd)
    if (grupTuru === "para" && satirlar.length) { const pg = await paraGrupBilgisi(pool); satirlar = paraGrubunaGoreSirala(satirlar, s => pg.grup({ paraKod: s.paraKod })); }
    return { ...sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : ""}${adetOzeti(p.istatistikIdler, "istatistik")}${iptal ? " · İptal edilenler" : ""} · ${toplam ? "Toplam" : "Detaylı"}`),
      gruplar: vergiKomisyonGruplari(grupTuru, tarihAraToplami) };
  },
};
