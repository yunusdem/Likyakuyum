import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, adetOzeti, aralikOzeti, filtreler, idFiltre, ozetEk, sinirla } from "../raporOrtak.js";

/** Analiz raporları (docs/raporlar-faz2.md, Faz R2-A): kârlılık (işlem bazlı), altın işçilik, personel değerlendirme. Yalnızca SELECT. */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

export interface MaliyetHareketi { paraId: number; tip: number; miktar: number; tutar: number; kur: number }
/**
 * Ağırlıklı ortalama maliyet yürütücüsü — Kâr/Zarar Faaliyet Analizi (KARZAR1) ile aynı kural (yönetici kararı E6):
 * alış stoka maliyetiyle girer; satış o andaki ortalama maliyetle düşer. Stok yokken satışta son bilinen ortalama, o da yoksa satış kuru maliyet sayılır.
 * Hareketler para içinde kronolojik sırada verilmelidir. Her hareket için { ortMaliyet, maliyet } döner (alışta maliyet = 0). Saf fonksiyon.
 */
export function maliyetYurut<T extends MaliyetHareketi>(hareketler: T[]): (T & { ortMaliyet: number; maliyet: number })[] {
  const stok = new Map<number, { miktar: number; maliyet: number; sonOrt: number }>();
  return hareketler.map(h => {
    const s = stok.get(h.paraId) || { miktar: 0, maliyet: 0, sonOrt: 0 };
    const miktar = Number(h.miktar) || 0, tutar = Number(h.tutar) || 0;
    let ort = 0, maliyet = 0;
    if (Number(h.tip) === 0) { s.miktar += miktar; s.maliyet += tutar; if (s.miktar > 0) s.sonOrt = s.maliyet / s.miktar; ort = s.sonOrt; }
    else {
      ort = s.miktar > 0 ? s.maliyet / s.miktar : (s.sonOrt || Number(h.kur) || 0);
      maliyet = miktar * ort;
      s.miktar -= miktar; s.maliyet -= maliyet;
      if (s.miktar <= 0.0000001) { s.miktar = Math.max(s.miktar, 0); s.maliyet = s.miktar * ort; }
      s.sonOrt = ort;
    }
    stok.set(h.paraId, s);
    return { ...h, ortMaliyet: ort, maliyet };
  });
}

const ISCILIK_SEKLI: Record<number, string> = { 0: "Adet başına", 1: "Toplam", 2: "Gram başına" };

export const ANALIZ_SORGULARI: Record<string, Sorgu> = {

  /** Kârlılık raporu — her satış satırının ağırlıklı ortalama maliyete göre kârı (KARZAR1'in işlem bazlı hâli) */
  async KARLIL1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    // Maliyet kayıtların başından yürütülür (dönem öncesi alışlar stoku oluşturur); yalnız dönemdeki satışlar listelenir
    const res = await req.query(`
      SELECT F.FIS_ID fisId, ISNULL(F.ZAMAN,F.TARIH) zaman, F.TARIH tarih, F.TIP tip, RTRIM(ISNULL(F.SERI_NO,''))+RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0)+ISNULL(S.KMV,0)+ISNULL(S.KDV,0) vergiler
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@bit AND RTRIM(UPPER(P.KOD)) NOT IN ('TL','TRY') ${f}
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, F.TARIH, F.FIS_ID, S.SATIR_NO;`);
    const bas = new Date(p.baslangic);
    const yurutulen = maliyetYurut(res.recordset.map((r: any) => ({ ...r, paraId: Number(r.paraId), tip: Number(r.tip), miktar: Number(r.miktar), tutar: Number(r.tutar), kur: Number(r.kur) })));
    const satirlar = yurutulen.filter(h => h.tip === 1 && new Date((h as any).tarih) >= bas).map((h: any) => {
      const brut = h.tutar - h.maliyet, net = brut + (Number(h.komisyon) || 0) - (Number(h.vergiler) || 0);
      return { ...h, satisKuru: h.kur, maliyetKuru: h.ortMaliyet, satisTutari: h.tutar, maliyetTutari: h.maliyet, brutKar: brut, komisyon: Number(h.komisyon) || 0, vergiler: Number(h.vergiler) || 0,
        netKar: net, karYuzde: h.tutar ? (brut / h.tutar) * 100 : 0, paraBaslik: `${h.paraKod} — ${h.paraAd}` }; });
    if (p.siralama === "kar") { // para grupları korunur, grup içinde net kâra göre büyükten küçüğe
      const sira = new Map<string, number>(); satirlar.forEach(s => { if (!sira.has(s.paraBaslik)) sira.set(s.paraBaslik, sira.size); });
      satirlar.sort((a, b) => sira.get(a.paraBaslik)! - sira.get(b.paraBaslik)! || b.netKar - a.netKar);
    }
    // Eski "KARLILIK RAPORU" (para başına tek satır): alış miktarı, ortalama alış, ortalama satış, satış miktarı, satış tutarı, brüt kâr, kâr %.
    // Eski @BrutKar = satış tutarı − satış miktarı × ortalama alış kuru; @YuzdeKar = brüt kâr ÷ satış tutarı × 100; @ToplamYuzdeKar = Σ brüt kâr ÷ Σ satış tutarı × 100.
    // Ortalama alış = dönem içi alışların ortalaması; dönemde alış yoksa yürüyen ortalama maliyet (eski yordam şifreli — canlıda karşılaştırılacak).
    const pz = new Map<string, any>();
    for (const h of yurutulen as any[]) { if (new Date(h.tarih) < bas) continue;
      if (!pz.has(h.paraKod)) pz.set(h.paraKod, { paraKod: h.paraKod, paraAd: h.paraAd, alisMiktar: 0, alisTutar: 0, satisMiktar: 0, satisTutar: 0, sonOrt: 0 });
      const o = pz.get(h.paraKod); if (h.tip === 0) { o.alisMiktar += h.miktar; o.alisTutar += h.tutar; } else { o.satisMiktar += h.miktar; o.satisTutar += h.tutar; } o.sonOrt = h.ortMaliyet || o.sonOrt; }
    const paraOzeti = [...pz.values()].filter(o => o.satisMiktar || o.alisMiktar).map(o => { const ortAlis = o.alisMiktar ? o.alisTutar / o.alisMiktar : o.sonOrt, brut = o.satisMiktar ? o.satisTutar - o.satisMiktar * ortAlis : 0;
      return { para: `${o.paraKod} — ${o.paraAd}`, alisMiktar: o.alisMiktar, ortAlis, ortSatis: o.satisMiktar ? o.satisTutar / o.satisMiktar : 0, satisMiktar: o.satisMiktar, satisTutar: o.satisTutar, brutKar: brut, karYuzde: o.satisTutar ? (brut / o.satisTutar) * 100 : 0 }; });
    if (paraOzeti.length > 1) { const st = paraOzeti.reduce((a, o) => a + o.satisTutar, 0), bk = paraOzeti.reduce((a, o) => a + o.brutKar, 0);
      paraOzeti.push({ para: "GENEL TOPLAM", alisMiktar: 0, ortAlis: 0, ortSatis: 0, satisMiktar: 0, satisTutar: st, brutKar: bk, karYuzde: st ? (bk / st) * 100 : 0 }); }
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm dövizler"}`,
      "Satırlardaki maliyet kayıtların başından yürütülen ağırlıklı ortalama maliyettir; kâr % = brüt kâr ÷ satış tutarı. Rapor sonundaki para bazındaki tablo eski rapor yöntemini kullanır: brüt kâr = satış tutarı − satış miktarı × dönemin ortalama alış kuru (dönemde alış yoksa yürüyen ortalama maliyet); bu yüzden iki brüt kâr farklı olabilir.",
      paraOzeti);
  },

  /** Altın işçilik raporu — sarraf fişi satırlarındaki işçilik (has gram) ve fişteki altın has kuruyla TL karşılığı */
  async ALTISC1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const ozet = `${aralikOzeti(p)}${p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : ""}${ozetEk(p) || " · Tüm vezneler"}`;
    const var_ = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_SARRAF_FISI','U') IS NULL OR OBJECT_ID('dbo.TODVZ_SARRAF_FISI_SATIRI','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
    if (!var_) return sinirla([], t, ozet, "Bu veritabanında sarraf fişi tabloları (TODVZ_SARRAF_FISI) bulunmadığı için işçilik verisi yok.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "S.URUN_ID" });
    const res = await req.query(`
      SELECT F.SARRAF_FISI_ID fisId, F.TARIH tarih, RTRIM(ISNULL(F.FIS_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan, F.TIP tipKod, RTRIM(ISNULL(V.KOD,'')) vezneKod,
        ISNULL(F.ALTIN_HAS_KURU,0) hasKuru, ISNULL(F.KDV_ORANI,0) kdvOrani, ISNULL(F.KDV,0) fisKdv, RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(S.ADET,0) adet, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.MILYEM,0) milyem,
        ISNULL(S.HAS_GRAM,0) hasGram, ISNULL(S.ISCILIK_HESAPLAMA_SEKLI,0) sekilKod, ISNULL(S.ISCILIK_MIKTARI,0) iscilikMiktari, ISNULL(S.ISCILIK_HAS_GRAM,0) iscilikHasGram, ISNULL(S.TUTAR,0) tutar
      FROM dbo.TODVZ_SARRAF_FISI F JOIN dbo.TODVZ_SARRAF_FISI_SATIRI S ON S.SARRAF_FISI_ID=F.SARRAF_FISI_ID
        LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.URUN_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) AND (ISNULL(S.ISCILIK_HAS_GRAM,0)<>0 OR ISNULL(S.ISCILIK_MIKTARI,0)<>0) ${f}
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, F.TARIH, F.SARRAF_FISI_ID, S.SATIR_NO;`);
    // KDV sarraf fişinde fiş düzeyinde tutulur: fişin listelenen ilk satırında gösterilir (toplamlar iki kez sayılmasın); KDV matrahı = KDV ÷ oran
    const kdvGorulen = new Set<number>();
    const satirlar = res.recordset.map((r: any) => { const ihg = Number(r.iscilikHasGram) || 0, hk = Number(r.hasKuru) || 0;
      const ilk = !kdvGorulen.has(Number(r.fisId)); kdvGorulen.add(Number(r.fisId)); const oran = Number(r.kdvOrani) || 0, kdv = ilk ? Number(r.fisKdv) || 0 : 0;
      return { ...r, cins: r.paraKod, kdvOrani: oran, kdv, kdvMatrahi: oran > 0 ? kdv / (oran / 100) : 0, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış", adet: Number(r.adet), miktar: Number(r.miktar), milyem: Number(r.milyem), hasGram: Number(r.hasGram), sekil: ISCILIK_SEKLI[Number(r.sekilKod)] || "-",
        iscilikMiktari: Number(r.iscilikMiktari), iscilikHasGram: ihg, hasKuru: hk, iscilikTutari: ihg * hk, tutar: Number(r.tutar), paraBaslik: `${r.paraKod} — ${r.paraAd}` }; });
    return sinirla(satirlar, t, ozet,
      "Kaynak: Genel Sarraf Fişi satırları; yalnızca işçiliği olan satırlar listelenir. İşçilik miktarı milyem cinsindendir (adet başına veya toplam); işçilik has gram = işçilik miktarı / 1000 (adet başına ise × adet). İşçilik tutarı (TL) = işçilik has gram × fişteki altın has kuru.");
  },

  /** Personel değerlendirme — fişi kaydeden kullanıcı bazında işlem adedi, hacim, komisyon, iptal ve kur sapması */
  async PERDEG1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { vezne: "V" }) + idFiltre(req, p.kullaniciIdler, "F.EKLEYEN_ID", "ku");
    const res = await req.query(`
      SELECT ISNULL(F.EKLEYEN_ID,0) kullaniciId, RTRIM(ISNULL(U.AD,'')) personel,
        SUM(CASE WHEN ISNULL(F.IPTAL,0)=0 AND F.TIP=0 THEN 1 ELSE 0 END) alisAdet, SUM(CASE WHEN ISNULL(F.IPTAL,0)=0 AND F.TIP=0 THEN ISNULL(F.TOPLAM_TUTAR,0) ELSE 0 END) alisTutar,
        SUM(CASE WHEN ISNULL(F.IPTAL,0)=0 AND F.TIP=1 THEN 1 ELSE 0 END) satisAdet, SUM(CASE WHEN ISNULL(F.IPTAL,0)=0 AND F.TIP=1 THEN ISNULL(F.TOPLAM_TUTAR,0) ELSE 0 END) satisTutar,
        SUM(CASE WHEN ISNULL(F.IPTAL,0)=1 THEN 1 ELSE 0 END) iptalAdet,
        SUM(CASE WHEN ISNULL(F.IPTAL,0)=0 THEN ISNULL(X.komisyon,0) ELSE 0 END) komisyon, SUM(CASE WHEN ISNULL(F.IPTAL,0)=0 THEN ISNULL(X.sapmaliSatir,0) ELSE 0 END) sapmaAdet,
        COUNT(DISTINCT CASE WHEN ISNULL(F.IPTAL,0)=0 THEN CAST(F.TARIH AS date) END) gunSayisi
      FROM dbo.TODVZ_FIS F LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
        OUTER APPLY (SELECT SUM(S.KOMISYON) komisyon, SUM(CASE WHEN ISNULL(S.GISE_KURU,0)>0 AND ABS(S.KUR-S.GISE_KURU)>0.0000001 THEN 1 ELSE 0 END) sapmaliSatir
          FROM dbo.TODVZ_FIS_SATIRI S WHERE S.FIS_ID=F.FIS_ID) X
      WHERE CAST(F.TARIH AS date) BETWEEN @bas AND @bit ${f}
      GROUP BY F.EKLEYEN_ID, U.AD
      ORDER BY U.AD;`);
    const satirlar = res.recordset.map((r: any) => { const a = Number(r.alisAdet) || 0, s = Number(r.satisAdet) || 0, hacim = (Number(r.alisTutar) || 0) + (Number(r.satisTutar) || 0);
      return { ...r, personel: r.personel || `Kullanıcı ${r.kullaniciId || "?"}`, alisAdet: a, alisTutar: Number(r.alisTutar) || 0, satisAdet: s, satisTutar: Number(r.satisTutar) || 0, toplamAdet: a + s, toplamTutar: hacim,
        ortIslem: a + s ? hacim / (a + s) : 0, komisyon: Number(r.komisyon) || 0, iptalAdet: Number(r.iptalAdet) || 0, sapmaAdet: Number(r.sapmaAdet) || 0, gunSayisi: Number(r.gunSayisi) || 0,
        // Eski "PERSONEL DEĞERLENDİRME": @Ciro/Gun ve @Hareket/Gun (gün sayısı 0 ise 0)
        ciroGun: Number(r.gunSayisi) ? hacim / Number(r.gunSayisi) : 0, hareketGun: Number(r.gunSayisi) ? (a + s) / Number(r.gunSayisi) : 0 }; })
      // Eski rapordaki sıralama: ciro ya da hareket sayısına göre azalan; "ad" seçilirse personel adına göre
      .sort((x: any, y: any) => p.siralama === "ad" ? 0 : p.siralama === "hareket" ? y.toplamAdet - x.toplamAdet : y.toplamTutar - x.toplamTutar);
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.kullaniciIdler, "personel")}`,
      "Personel = fişi kaydeden kullanıcı. Tutarlar fişlerin TL toplam tutarıdır; iptal fişler adet ve tutarlara girmez, yalnızca \"İptal\" kolonunda sayılır. Kur sapması = kuru kayıt anındaki gişe kurundan farklı girilmiş fiş satırı sayısı. Çalışılan gün = fiş kesilen farklı gün sayısı.");
  },
};
