import sql from "mssql";
import { maliyetYurut } from "./analiz.js";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, aralikOzeti, filtreler, hedefPara, kurCoz, ozetEk, paraKumesi, sinirla, tarihTr } from "../raporOrtak.js";

/** Vezne raporları (docs/raporlar-faz2.md, Faz R2-V) — yalnızca SELECT. */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

/** Kur sapması: fiş kuru ile o andaki gişe kuru arasındaki fark ve yüzdesi. Gişe kuru yoksa (0) sapma hesaplanmaz. Saf fonksiyon. */
export function kurSapmasi(fisKuru: number, giseKuru: number, miktar: number) {
  const f = Number(fisKuru) || 0, g = Number(giseKuru) || 0;
  if (!g) return { fark: 0, sapmaYuzde: 0, tlEtkisi: 0, giseVar: false };
  const fark = f - g;
  return { fark, sapmaYuzde: (fark / g) * 100, tlEtkisi: fark * (Number(miktar) || 0), giseVar: true };
}

export const VEZNE_SORGULARI: Record<string, Sorgu> = {

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
    const paraSet = await paraKumesi(pool, p), hedef = await hedefPara(pool, p, kur);
    // Birim maliyet (eski "Birim Maliyet Göster"): kayıtların başından yürütülen ağırlıklı ortalama maliyetin para başına son değeri — Kârlılık / Kâr-Zarar raporlarıyla aynı kural; tüm vezneler için ortaktır
    const mh = await pool.request().query(`SELECT S.PARA_ID paraId, F.TIP tip, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KUR,0) kur
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID WHERE ISNULL(F.IPTAL,0)=0 ORDER BY S.PARA_ID, F.TARIH, F.FIS_ID, S.SATIR_NO`);
    const birimMaliyet = new Map<number, number>();
    for (const h of maliyetYurut(mh.recordset.map((r: any) => ({ paraId: Number(r.paraId), tip: Number(r.tip), miktar: Number(r.miktar), tutar: Number(r.tutar), kur: Number(r.kur) })))) if (h.ortMaliyet) birimMaliyet.set(h.paraId, h.ortMaliyet);
    const satirlar = res.recordset.filter((r: any) => !paraSet || paraSet.has(Number(r.paraId))).map((r: any) => {
      const id = Number(r.paraId), m = Number(r.miktar) || 0, k = kur.kurlar.get(id) ?? 0, ks = kur.satisKurlari.get(id) ?? 0;
      return { ...r, miktar: m, kur: k, tlKarsiligi: m * k, birimMaliyet: id === kur.tlId ? 1 : birimMaliyet.get(id) ?? 0, hedefKarsiligi: hedef.cevir(m * k), hedefParaKod: hedef.kod, kurSatis: ks, tlSatis: m * ks, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` };
    });
    return sinirla(satirlar, t, `Anlık bakiye${ozetEk(p) || " · Tüm vezneler"} · ${kur.aciklama} · ${hedef.aciklama}`,
      `Anlık bakiye tablosundan (her kayıtta güncellenen vezne bakiyesi) okunur; Döviz Fişi ekranındaki bakiyeyle aynıdır. Geçmiş bir tarih için "Vezne Bakiye Raporu (Tarih Bazlı)" kullanılır; o rapor hareketlerden hesapladığı için küçük farklar olabilir. ${kur.aciklama}.`);
  },

  /**
   * Kur kontrolü — eski VODVZR_KUR_KONTROLU karşılığı (kolonları canlıda doğrulandı 17.09.2026: TARIH, PARA, ALIS_MIKTARI, ALIS_TUTARI,
   * SATIS_MIKTARI, SATIS_TUTARI, KULLANICI_ADI, VEZNE_ADI): gün × para × vezne × kullanıcı bazında alış ve satışın miktarı, tutarı ve ortalama kuru.
   */
  async KURKON2(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    // Kırılım: "ayrinti" gün × para × vezne × kullanıcı · "gun" gün × para · eski rapor tipleri: "genel" dönem × para · "vezne" dönem × para × vezne · "kullanici" dönem × para × kullanıcı
    const kip = ["gun", "genel", "vezne", "kullanici"].includes(p.birlestir || "") ? p.birlestir! : "ayrinti";
    const gunlu = kip === "ayrinti" || kip === "gun", vezneli = kip === "ayrinti" || kip === "vezne", kullanicili = kip === "ayrinti" || kip === "kullanici";
    const sorgu = async (kaynak: "fis" | "dekont") => {
      const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
      const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
      const fis = kaynak === "fis";
      // Dekont: satır TIP 0 = borç, 1 = alacak; tutar = meblağ × kur; yalnızca kur cinsinden (KUR_CINSI = 0) ve iptal edilmemiş dekontlar
      const tarih = fis ? "F.TARIH" : "D.TARIH", tip = fis ? "F.TIP" : "S.TIP", miktar = fis ? "S.MIKTAR" : "S.MEBLAG", tutar = fis ? "S.TUTAR" : "S.MEBLAG*ISNULL(S.KUR,0)";
      const from = fis
        ? `dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID WHERE ISNULL(F.IPTAL,0)=0`
        : `dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI S ON S.CARI_DEKONT_ID=D.CARI_DEKONT_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=D.VEZNE_ID LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=D.EKLEYEN_ID WHERE D.IPTAL_TARIHI IS NULL AND ISNULL(D.KUR_CINSI,0)=0 AND ISNULL(S.KUR,0)>0`;
      const grup = [gunlu ? `CAST(${tarih} AS date)` : "", "P.KOD", "P.AD", "P.SIRA_NO", vezneli ? "V.KOD" : "", kullanicili ? "U.AD" : ""].filter(Boolean).join(", ");
      return (await req.query(`
        SELECT ${gunlu ? `CAST(${tarih} AS date)` : "CAST(NULL AS date)"} gun, RTRIM(P.KOD) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo,
          ${vezneli ? "RTRIM(ISNULL(V.KOD,''))" : "''"} vezneKod, ${kullanicili ? "RTRIM(ISNULL(U.AD,''))" : "''"} kullanici,
          SUM(CASE WHEN ${tip}=0 THEN ${miktar} ELSE 0 END) m0, SUM(CASE WHEN ${tip}=0 THEN ${tutar} ELSE 0 END) t0,
          SUM(CASE WHEN ${tip}=1 THEN ${miktar} ELSE 0 END) m1, SUM(CASE WHEN ${tip}=1 THEN ${tutar} ELSE 0 END) t1
        FROM ${from} AND CAST(${tarih} AS date) BETWEEN @bas AND @bit ${f}
        GROUP BY ${grup};`)).recordset as any[];
    };
    const dekontVar = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_CARI_DEKONT','U') IS NULL OR OBJECT_ID('dbo.TODVZ_CARI_DEKONT_SATIRI','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
    const m = new Map<string, any>();
    const al = (r: any) => { const gun = r.gun ? new Date(r.gun).toISOString().slice(0, 10) : ""; const k = `${gun}|${r.paraKod}|${r.vezneKod}|${r.kullanici}`;
      if (!m.has(k)) m.set(k, { gun, paraKod: r.paraKod, paraAd: r.paraAd, siraNo: Number(r.siraNo), vezneKod: r.vezneKod, kullanici: r.kullanici, alisMiktar: 0, alisTutar: 0, satisMiktar: 0, satisTutar: 0, borcMeblag: 0, borcTutar: 0, alacakMeblag: 0, alacakTutar: 0 });
      return m.get(k); };
    for (const r of await sorgu("fis")) { const o = al(r); o.alisMiktar = Number(r.m0) || 0; o.alisTutar = Number(r.t0) || 0; o.satisMiktar = Number(r.m1) || 0; o.satisTutar = Number(r.t1) || 0; }
    if (dekontVar) for (const r of await sorgu("dekont")) { const o = al(r); o.borcMeblag = Number(r.m0) || 0; o.borcTutar = Number(r.t0) || 0; o.alacakMeblag = Number(r.m1) || 0; o.alacakTutar = Number(r.t1) || 0; }
    const bol = (a: number, b: number) => (b ? a / b : 0);
    const donem = `${tarihTr(p.baslangic)} – ${tarihTr(p.bitis)}`;
    const satirlar = [...m.values()].sort((x, y) => x.gun.localeCompare(y.gun) || x.siraNo - y.siraNo || x.paraKod.localeCompare(y.paraKod) || x.vezneKod.localeCompare(y.vezneKod) || x.kullanici.localeCompare(y.kullanici, "tr"))
      .map(o => { const oa = bol(o.alisTutar, o.alisMiktar), os = bol(o.satisTutar, o.satisMiktar);
        return { ...o, ortAlisKuru: oa, ortSatisKuru: os, makas: oa && os ? os - oa : 0, ortBorcKuru: bol(o.borcTutar, o.borcMeblag), ortAlacakKuru: bol(o.alacakTutar, o.alacakMeblag),
          // Eski @GenelOrtalamaKur1 / @GenelOrtalamaKur2: vezne + cari işlemlerin birleşik ortalaması
          genelOrtKur1: bol(o.alisTutar + o.borcTutar, o.alisMiktar + o.borcMeblag), genelOrtKur2: bol(o.satisTutar + o.alacakTutar, o.satisMiktar + o.alacakMeblag),
          gunBaslik: o.gun ? tarihTr(o.gun) : donem }; });
    const kipAdi: Record<string, string> = { ayrinti: "vezne ve kullanıcı ayrıntılı", gun: "gün × para", genel: "Genel", vezne: "Vezne bazında", kullanici: "Kullanıcı bazında" };
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"} · ${kipAdi[kip]}`,
      "Ortalama kur = tutar / miktar. Makas = ortalama satış kuru − ortalama alış kuru (aynı satırda hem alış hem satış varsa). Cari işlem kolonları kur cinsinden girilmiş, iptal edilmemiş cari emanet / dekont satırlarından gelir (borç ve alacak meblağı, ortalama kur = Σ meblağ × kur ÷ Σ meblağ); genel ortalama kur vezne ve cari işlemlerin birleşik ortalamasıdır. TL satırlarında kur 1'dir. İptal fişler hariçtir.");
  },

  /** Kur sapma raporu (eski VODVZR_KUR_SAPMA_RAPORU karşılığı) — fiş satırındaki kur ile kayıt anındaki gişe kurunun karşılaştırması; sapma eşiği üstündekiler */
  async KURKON1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
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
    const satirlar = res.recordset.map((r: any) => {
      const s = kurSapmasi(r.kur, r.giseKuru, r.miktar); if (!s.giseVar) gisesiz++;
      return { ...r, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış", miktar: Number(r.miktar), kur: Number(r.kur), giseKuru: Number(r.giseKuru),
        fark: s.fark, sapmaYuzde: s.sapmaYuzde, tlEtkisi: s.tlEtkisi, giseVar: s.giseVar, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` };
    }).filter((r: any) => r.giseVar && Math.abs(r.sapmaYuzde) >= esik && (esik > 0 || Math.abs(r.fark) > 0.0000001));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : ""} · Sapma ≥ %${esik.toLocaleString("tr-TR")}`,
      `Sapma % = (fiş kuru − gişe kuru) / gişe kuru × 100; TL etkisi = fark × miktar. Eşik 0 iken kuru gişe kurundan farklı olan tüm satırlar listelenir; kuru gişe kuruyla aynı olanlar listelenmez. İptal fişler hariçtir.${gisesiz ? ` Gişe kuru kaydedilmemiş ${gisesiz} satır karşılaştırılamadığı için kapsam dışıdır.` : ""}`);
  },
};
