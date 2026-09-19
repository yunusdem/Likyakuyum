import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, TL_PARA_SQL, adetOzeti, aralikOzeti, filtreler, idFiltre, kurCoz, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";

/**
 * Kasa raporları (docs/raporlar-faz2.md, Faz R2-K) — yalnızca SELECT.
 * Kaynak: TODVZ_HESAP (kasa hesap kartı) + TODVZ_HESAP_HAREKETI (TIP 0 = giriş, 1 = çıkış; MEBLAG hareketin parasında,
 * KDV her zaman TL'ye yazılır — SODVZ_HESAP_HAREKETI_KAYDET vezne bakiyesini böyle günceller).
 */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

/** Kasadan geçen nakit satırları: meblağ kendi parasında; KDV > 0 ise TL'de (para TL ise aynı satıra eklenir, değilse ayrı "KDV" satırı). Saf fonksiyon — testte kullanılır. */
export function kasaNakitSatirlari<T extends { paraId: number; paraKod: string; meblag: number; kdv: number; tip: number; aciklama: string }>(
  h: T, tl: { id: number; kod: string }): (T & { giris: number; cikis: number; kdvSatiri: boolean })[] {
  const yon = (tutar: number) => ({ giris: h.tip === 0 ? tutar : 0, cikis: h.tip === 1 ? tutar : 0 });
  const kdv = Number(h.kdv) || 0, meblag = Number(h.meblag) || 0;
  if (kdv > 0 && h.paraId !== tl.id) return [
    { ...h, ...yon(meblag), kdv: 0, kdvSatiri: false },
    { ...h, paraId: tl.id, paraKod: tl.kod, ...yon(kdv), kdv, aciklama: `KDV — ${h.aciklama}`.trim(), kdvSatiri: true },
  ];
  return [{ ...h, ...yon(meblag + kdv), kdv, kdvSatiri: false }];
}

/** Devir + yürüyen bakiye: gruplar sıralı gelir; her grubun başına devir satırı eklenir. Saf fonksiyon. */
export function yuruyenBakiye<T extends { giris: number; cikis: number }>(
  gruplar: { anahtar: string; devir: number; ortak: Record<string, any>; hareketler: T[] }[], devirSatiri: (devir: number) => Record<string, any>) {
  const satirlar: Record<string, any>[] = [];
  for (const g of gruplar) {
    let bakiye = g.devir;
    satirlar.push({ ...g.ortak, ...devirSatiri(g.devir), giris: g.devir > 0 ? g.devir : 0, cikis: g.devir < 0 ? -g.devir : 0, bakiye, devirSatiri: true });
    for (const h of g.hareketler) { bakiye += (Number(h.giris) || 0) - (Number(h.cikis) || 0); satirlar.push({ ...g.ortak, ...h, bakiye }); }
  }
  return satirlar;
}

const tlPara = async (pool: sql.ConnectionPool) => {
  const r = await pool.request().query(`SELECT P.PARA_ID id, RTRIM(P.KOD) kod FROM dbo.TODVZ_PARA P WHERE P.PARA_ID=${TL_PARA_SQL}`);
  return { id: Number(r.recordset[0]?.id || 1), kod: String(r.recordset[0]?.kod || "TL").trim() };
};

const HAREKET_ALANLARI = `H.HESAP_HAREKETI_ID hareketId, H.TARIH tarih, H.HESAP_ID hesapId, RTRIM(ISNULL(K.KOD,'')) hesapKod, RTRIM(ISNULL(K.AD,'')) hesapAd,
  RTRIM(ISNULL(H.ACIKLAMA,'')) aciklama, H.PARA_ID paraId, RTRIM(ISNULL(P.KOD,'')) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(H.MEBLAG,0) meblag,
  ISNULL(H.KDV_ORANI,0) kdvOrani, ISNULL(H.KDV,0) kdv, H.TIP tip, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(U.AD,'')) kaydeden`;
const HAREKET_JOIN = `dbo.TODVZ_HESAP_HAREKETI H
  LEFT JOIN dbo.TODVZ_HESAP K ON K.HESAP_ID=H.HESAP_ID LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=H.PARA_ID
  LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.VEZNE_ID LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=H.EKLEYEN_ID`;
const KDV_DIPNOT = "Giriş ve çıkış tutarları hareketin kendi para birimindedir; KDV her zaman TL kasasına yansır (TL hareketlerinde tutara dahildir, döviz hareketlerinde TL grubunda ayrı \"KDV\" satırı olarak gösterilir).";

export const KASA_SORGULARI: Record<string, Sorgu> = {

  /** Kasa defteri — para bazında kronolojik defter: devir + giriş / çıkış + yürüyen bakiye (KDV TL'ye) */
  async KASDEF1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const tl = await tlPara(pool);
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
    // Para filtresi SQL'de uygulanmaz: döviz hareketinin KDV'si TL grubuna düşer, süzme nakit satırları üzerinden yapılır
    const f = filtreler(req, p, { vezne: "V" }) + idFiltre(req, p.hesapIdler, "H.HESAP_ID", "hs");
    const res = await req.query(`
      SELECT ${HAREKET_ALANLARI}, CASE WHEN CAST(H.TARIH AS date)<@bas THEN 1 ELSE 0 END onceki
      FROM ${HAREKET_JOIN}
      WHERE CAST(H.TARIH AS date)<=@bit ${f}
      ORDER BY H.TARIH, H.HESAP_HAREKETI_ID;`);
    const paraAdlari = new Map<number, string>((await pool.request().query(`SELECT PARA_ID id, RTRIM(ISNULL(AD,'')) ad FROM dbo.TODVZ_PARA`)).recordset.map((x: any) => [Number(x.id), String(x.ad || "")]));
    const secili = new Set((p.paraIdler || []).filter(n => n > 0));
    const gruplar = new Map<number, { anahtar: string; devir: number; ortak: Record<string, any>; siraNo: number; hareketler: any[] }>();
    for (const r of res.recordset) {
      for (const n of kasaNakitSatirlari({ ...r, paraId: Number(r.paraId), tip: Number(r.tip), meblag: Number(r.meblag), kdv: Number(r.kdv) }, tl)) {
        if (secili.size && !secili.has(n.paraId)) continue;
        if (!gruplar.has(n.paraId)) gruplar.set(n.paraId, { anahtar: n.paraKod, devir: 0, siraNo: n.kdvSatiri ? 0 : Number(r.siraNo), hareketler: [],
          ortak: { paraKod: n.paraKod, grupBaslik: `Para birimi: ${n.paraKod}${paraAdlari.get(n.paraId) ? ` — ${paraAdlari.get(n.paraId)}` : ""}` } });
        const g = gruplar.get(n.paraId)!;
        if (r.onceki) g.devir += n.giris - n.cikis; else g.hareketler.push(n);
      }
    }
    const sirali = [...gruplar.values()].sort((a, b) => a.siraNo - b.siraNo || a.anahtar.localeCompare(b.anahtar));
    const satirlar = yuruyenBakiye(sirali, () => ({ tarih: p.baslangic, hesapKod: "", hesapAd: "", aciklama: `${tarihTr(p.baslangic)} öncesi devir`, vezneKod: "", kdv: 0, kaydeden: "" }));
    // Eski "KASA DEFTERİ" kapanışı: "Devreden" dengeleme tutarı eksik kalan tarafa yazılır (@DevredenGiris / @DevredenCikis), iki kolon eşitlenmiş toplamı gösterir (@Toplam)
    const kapanis = sirali.map(g => { const gr = satirlar.filter(x => x.paraKod === g.ortak.paraKod); const giris = gr.reduce((a, x) => a + (Number(x.giris) || 0), 0), cikis = gr.reduce((a, x) => a + (Number(x.cikis) || 0), 0);
      return { paraKod: g.ortak.paraKod, giris, cikis, devredenGiris: giris > cikis ? 0 : cikis - giris, devredenCikis: cikis > giris ? 0 : giris - cikis, toplam: Math.max(giris, cikis) }; });
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.hesapIdler, "hesap")}`, KDV_DIPNOT, kapanis);
  },

  /** Kasa hareket listesi — hareket bazında; sıralama tarih / hesap / para (grup başlığı sıralamaya göre) */
  async KASHAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
      .input("tip", sql.Int, p.kasaTipi === 0 || p.kasaTipi === 1 ? p.kasaTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "H.PARA_ID" }) + idFiltre(req, p.hesapIdler, "H.HESAP_ID", "hs");
    const sira = p.siralama === "hesap" ? "K.KOD, H.TARIH" : p.siralama === "para" ? "ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH" : "CAST(H.TARIH AS date), H.TARIH";
    const res = await req.query(`
      SELECT ${HAREKET_ALANLARI}
      FROM ${HAREKET_JOIN}
      WHERE CAST(H.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR H.TIP=@tip) ${f}
      ORDER BY ${sira}, H.HESAP_HAREKETI_ID;`);
    const satirlar = res.recordset.map((r: any) => {
      const meblag = Number(r.meblag) || 0, giris = Number(r.tip) === 0;
      const grupBaslik = p.siralama === "hesap" ? `${r.hesapKod} — ${r.hesapAd}` : p.siralama === "para" ? `Para birimi: ${r.paraKod}` : tarihTr(new Date(r.tarih).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }));
      // Eski "KASA HAREKET LİSTESİ": tek Meblağ + harf (TIP 0 → "B", diğer → "A"); @Meblag işaretli (TIP 0 +, diğer −) → net toplamların temeli
      return { ...r, hesapBaslik: `${r.hesapKod} — ${r.hesapAd}`, tip: giris ? "Giriş" : "Çıkış", giris: giris ? meblag : 0, cikis: giris ? 0 : meblag, meblag, ba: giris ? "B" : "A", net: giris ? meblag : -meblag,
        kdvOrani: Number(r.kdvOrani) || 0, kdv: Number(r.kdv) || 0, grupAnahtar: grupBaslik, grupBaslik };
    });
    // Net toplam = |Σ(giriş − çıkış)| + B/A (eski @GenelToplam / @GenelHesapTipi) — para birimleri karışmasın diye para başına
    const nt = new Map<string, { paraKod: string; giris: number; cikis: number }>();
    for (const x of satirlar) { const o = nt.get(x.paraKod) || { paraKod: x.paraKod, giris: 0, cikis: 0 }; o.giris += x.giris; o.cikis += x.cikis; nt.set(x.paraKod, o); }
    const netToplamlar = [...nt.values()].map(o => { const n = o.giris - o.cikis; return { ...o, netToplam: Math.abs(n), netTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; });
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}${adetOzeti(p.hesapIdler, "hesap")}${p.kasaTipi === 0 ? " · Giriş" : p.kasaTipi === 1 ? " · Çıkış" : ""}`,
      "Toplamlar farklı para birimlerini birlikte içerebilir; para bazında toplam için sıralamayı \"Para\" seçin. Net = giriş − çıkış; B/A: giriş B, çıkış A (eski rapordaki harfler). KDV tutarı TL'dir.",
      netToplamlar);
  },

  /** Hesap ekstresi — hesap × para grubu, devir + yürüyen bakiye (Cari Ekstre kalıbı) */
  async HESEKS1(pool, p, t) {
    if (!p.hesapIdler?.length) throw ApiError.badRequest("En az bir hesap seçilmelidir.");
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { para: "H.PARA_ID" }) + idFiltre(req, p.hesapIdler, "H.HESAP_ID", "hs");
    const res = await req.query(`
      SELECT ${HAREKET_ALANLARI}, CASE WHEN CAST(H.TARIH AS date)<@bas THEN 1 ELSE 0 END onceki
      FROM ${HAREKET_JOIN}
      WHERE CAST(H.TARIH AS date)<=@bit ${f}
      ORDER BY K.KOD, ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH, H.HESAP_HAREKETI_ID;`);
    // Eski "HESAP EKSTRE" raporuyla aynı metrikler: Borç = çıkış (TIP 1), Alacak = giriş (TIP 0), bakiye = Borç − Alacak → mutlak değer + B/A.
    // Devir brüt tutulur (dönem öncesi borç ve alacak ayrı): eski raporda ara toplam dönem öncesi hareketleri de böyle içerir.
    const gruplar = new Map<string, { devirBorc: number; devirAlacak: number; ortak: Record<string, any>; hareketler: any[] }>();
    for (const r of res.recordset) {
      const k = `${r.hesapKod}|${r.paraKod}`, meblag = Number(r.meblag) || 0, giris = Number(r.tip) === 0;
      if (!gruplar.has(k)) gruplar.set(k, { devirBorc: 0, devirAlacak: 0, hareketler: [], ortak: { grupAnahtar: k, grupBaslik: `${r.hesapKod} — ${r.hesapAd} · ${r.paraKod}`, hesapKod: r.hesapKod, hesapAd: r.hesapAd, paraKod: r.paraKod } });
      const g = gruplar.get(k)!;
      if (r.onceki) { if (giris) g.devirAlacak += meblag; else g.devirBorc += meblag; }
      else g.hareketler.push({ ...r, borc: giris ? 0 : meblag, alacak: giris ? meblag : 0, kdv: Number(r.kdv) || 0 });
    }
    const bakiyeAlanlari = (b: number) => ({ bakiye: Math.abs(b), bakiyeTipi: b > 0 ? "B" : b < 0 ? "A" : "" });
    const satirlar: Record<string, any>[] = [], kapanis: Record<string, any>[] = [];
    for (const g of gruplar.values()) {
      let bakiye = g.devirBorc - g.devirAlacak, borc = g.devirBorc, alacak = g.devirAlacak;
      satirlar.push({ ...g.ortak, tarih: p.baslangic, aciklama: `${tarihTr(p.baslangic)} öncesi devir`, vezneKod: "", kdv: 0, kaydeden: "", devirSatiri: true,
        borc: g.devirBorc, alacak: g.devirAlacak, giris: g.devirAlacak, cikis: g.devirBorc, ...bakiyeAlanlari(bakiye) });
      for (const h of g.hareketler) {
        bakiye += h.borc - h.alacak; borc += h.borc; alacak += h.alacak;
        satirlar.push({ ...g.ortak, ...h, giris: h.alacak, cikis: h.borc, ...bakiyeAlanlari(bakiye) });
      }
      kapanis.push({ hesap: `${g.ortak.hesapKod} — ${g.ortak.hesapAd}`, paraKod: g.ortak.paraKod, borc, alacak, ...bakiyeAlanlari(bakiye) });
    }
    return sinirla(satirlar, t, `${aralikOzeti(p)}${adetOzeti(p.hesapIdler, "hesap")}${ozetEk(p)}`,
      "Her hesap ve para birimi ayrı gruplanır. Borç = kasadan çıkış, Alacak = kasaya giriş; bakiye = Borç − Alacak (B: borç bakiyesi, A: alacak bakiyesi). İlk satır başlangıç tarihinden önceki hareketlerin borç ve alacak toplamıdır ve ara toplama dahildir. Tutarlar KDV hariçtir; KDV TL kasasına ayrıca yansır.",
      kapanis);
  },

  /** Hesap bakiye raporu — giriş/çıkış aralıkta, bakiye bitiş tarihi itibarıyla (Cari Bakiye kararıyla aynı); seçilen kurla TL */
  async HESBAK1(pool, p, t) {
    const bas = p.baslangic || p.tarih, bit = p.bitis || p.tarih;
    if (!bas || !bit) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const kur = await kurCoz(pool, { ...p, kurTarihi: p.kurTarihi || bit });
    const req = pool.request().input("bas", sql.Date, bas).input("bit", sql.Date, bit);
    const f = filtreler(req, p, { para: "B.PARA_ID" }) + idFiltre(req, p.hesapIdler, "K.HESAP_ID", "hs");
    const res = await req.query(`
      ;WITH B AS (
        SELECT H.HESAP_ID, H.PARA_ID,
          SUM(CASE WHEN H.TIP=0 AND CAST(H.TARIH AS date)>=@bas THEN H.MEBLAG ELSE 0 END) GIRIS,
          SUM(CASE WHEN H.TIP=1 AND CAST(H.TARIH AS date)>=@bas THEN H.MEBLAG ELSE 0 END) CIKIS,
          SUM(CASE WHEN H.TIP=0 THEN H.MEBLAG ELSE -H.MEBLAG END) BAKIYE
        FROM dbo.TODVZ_HESAP_HAREKETI H WHERE CAST(H.TARIH AS date)<=@bit GROUP BY H.HESAP_ID, H.PARA_ID)
      SELECT K.HESAP_ID hesapId, RTRIM(ISNULL(K.KOD,'')) hesapKod, RTRIM(ISNULL(K.AD,'')) hesapAd, B.PARA_ID paraId, ISNULL(RTRIM(P.KOD),'-') paraKod,
        ISNULL(B.GIRIS,0) giris, ISNULL(B.CIKIS,0) cikis, ISNULL(B.BAKIYE,0) bakiye
      FROM dbo.TODVZ_HESAP K LEFT JOIN B ON B.HESAP_ID=K.HESAP_ID LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=B.PARA_ID
      WHERE 1=1 ${f}
      ORDER BY K.KOD, ISNULL(P.SIRA_NO,99), P.KOD;`);
    const satirlar = res.recordset.map((r: any) => { const id = Number(r.paraId), b = Number(r.bakiye) || 0, k = kur.kurlar.get(id) ?? 0, ks = kur.satisKurlari.get(id) ?? 0;
      // Eski "HESAP BAKİYE RAPORU": BAKIYE (= giriş − çıkış, canlıda doğrulandı 19.09.2026) < 0 → Borç bakiye, > 0 → Alacak bakiye
      return { ...r, giris: Number(r.giris), cikis: Number(r.cikis), bakiye: b, borcBakiye: b < 0 ? -b : 0, alacakBakiye: b > 0 ? b : 0, kur: k, tlKarsiligi: b * k, kurSatis: ks, tlSatis: b * ks, hesapBaslik: `${r.hesapKod} — ${r.hesapAd}` }; });
    // Para bazında "Toplam :" ve net "Bakiye :" (B/A) — eski rapordaki grup altlıklarının karşılığı
    const pt = new Map<string, { paraKod: string; borcBakiye: number; alacakBakiye: number }>();
    for (const x of satirlar) { if (!x.paraId) continue; const o = pt.get(x.paraKod) || { paraKod: x.paraKod, borcBakiye: 0, alacakBakiye: 0 }; o.borcBakiye += x.borcBakiye; o.alacakBakiye += x.alacakBakiye; pt.set(x.paraKod, o); }
    const paraToplamlari = [...pt.values()].map(o => { const n = o.borcBakiye - o.alacakBakiye; return { ...o, netBakiye: Math.abs(n), bakiyeTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; });
    return sinirla(satirlar, t, `${tarihTr(bas)} – ${tarihTr(bit)}${adetOzeti(p.hesapIdler, "hesap") || " · Tüm hesaplar"}${ozetEk(p)} · ${kur.aciklama}`,
      `Giriş ve çıkış seçilen tarih aralığındaki hareketlerin toplamıdır; bakiye bitiş tarihi itibarıyla tüm hareketlerden hesaplanır (girişler − çıkışlar, KDV hariç). Borç bakiye = bakiyenin negatif (çıkış fazlası), Alacak bakiye = pozitif (giriş fazlası) olduğu tutardır. Hareketi olmayan hesaplar da listelenir. ${kur.aciklama}.`,
      paraToplamlari);
  },
};
