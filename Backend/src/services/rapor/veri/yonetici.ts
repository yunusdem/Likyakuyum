import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, gunOnce, hedefPara, kurCoz, kurTarihte, ozetEk, paraKumesi, sinirla, tarihTr, vezneBakiyeleri, VEZNE_BAKIYE_DIPNOT } from "../raporOrtak.js";
import { maliyetYurut } from "./analiz.js";

/** Yönetici raporları — 2. dalga (docs/raporlar-faz2.md, Faz R2-Y): firma son durum, long / short denge analizi. Yalnızca SELECT. */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;
type ParaSatiri = { paraId: number; paraKod: string; paraAd: string; siraNo: number };

const tabloVar = async (pool: sql.ConnectionPool, ...adlar: string[]) =>
  !!(await pool.request().query(`SELECT CASE WHEN ${adlar.map(a => `OBJECT_ID('dbo.${a}','U') IS NOT NULL`).join(" AND ")} THEN 1 ELSE 0 END v`)).recordset[0]?.v;

/** Para bazında pozisyon bileşenleri (tarih dahil): vezne mevcudu, banka, cari alacak / borç, açık vadeli dekontlar */
async function pozisyonlar(pool: sql.ConnectionPool, p: RaporParametreler, secenek: { banka: boolean; vadeli: boolean }) {
  const tarih = p.tarih!;
  const m = new Map<number, ParaSatiri & { vezne: number; banka: number; cariAlacak: number; cariBorc: number; vadeliAlacak: number; vadeliBorc: number }>();
  const al = (r: any) => { const id = Number(r.paraId); if (!m.has(id)) m.set(id, { paraId: id, paraKod: String(r.paraKod || "").trim(), paraAd: String(r.paraAd || "").trim(), siraNo: Number(r.siraNo ?? 99),
    vezne: 0, banka: 0, cariAlacak: 0, cariBorc: 0, vadeliAlacak: 0, vadeliBorc: 0 }); return m.get(id)!; };
  const PARA = `S.PARA_ID paraId, RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo`;

  for (const v of await vezneBakiyeleri(pool, tarih, p)) al({ ...v, siraNo: (v as any).siraNo }).vezne += Number(v.miktar) || 0;

  const cari = await pool.request().input("t", sql.Date, tarih).query(`
    SELECT ${PARA}, SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE 0 END) borc, SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak
    FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
    WHERE CAST(H.TARIH AS date)<=@t GROUP BY S.PARA_ID, P.KOD, P.AD, P.SIRA_NO;`);
  // Carilerin bize borcu = bizim alacağımız; carilerin alacağı = bizim borcumuz
  for (const r of cari.recordset) { const o = al(r); o.cariAlacak += Number(r.borc) || 0; o.cariBorc += Number(r.alacak) || 0; }

  if (secenek.banka && await tabloVar(pool, "TODVZ_BANKA_HAREKET", "TODVZ_BANKA_HAREKET_SATIRI")) {
    const banka = await pool.request().input("t", sql.Date, tarih).query(`
      SELECT ${PARA}, SUM(CASE WHEN H.ISLEM_TIPI IN (0,2) THEN S.MEBLAG WHEN H.ISLEM_TIPI IN (1,3) THEN -S.MEBLAG ELSE 0 END) bakiye
      FROM dbo.TODVZ_BANKA_HAREKET H JOIN dbo.TODVZ_BANKA_HAREKET_SATIRI S ON S.BANKA_HAREKET_ID=H.BANKA_HAREKET_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      WHERE ISNULL(H.IPTAL,0)=0 AND CAST(H.TARIH AS date)<=@t GROUP BY S.PARA_ID, P.KOD, P.AD, P.SIRA_NO;`);
    for (const r of banka.recordset) al(r).banka += Number(r.bakiye) || 0;
  }

  if (secenek.vadeli && await tabloVar(pool, "TODVZ_CARI_DEKONT", "TODVZ_CARI_DEKONT_SATIRI")) {
    // Açık vadeli dekontlar: emanet alma (TIP 0) bizim borcumuz, emanet verme (TIP 1) bizim alacağımız; virman (TIP 2) firmayı etkilemez
    const vadeli = await pool.request().input("t", sql.Date, tarih).query(`
      SELECT ${PARA}, SUM(CASE WHEN D.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak, SUM(CASE WHEN D.TIP=0 THEN S.MEBLAG ELSE 0 END) borc
      FROM dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI S ON S.CARI_DEKONT_ID=D.CARI_DEKONT_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      WHERE D.IPTAL_TARIHI IS NULL AND D.VADE IS NOT NULL AND CAST(D.TARIH AS date)<=@t AND CAST(D.VADE AS date)>@t AND D.TIP IN (0,1)
      GROUP BY S.PARA_ID, P.KOD, P.AD, P.SIRA_NO;`);
    for (const r of vadeli.recordset) { const o = al(r); o.vadeliAlacak += Number(r.alacak) || 0; o.vadeliBorc += Number(r.borc) || 0; }
  }

  const paraSet = await paraKumesi(pool, p);
  return [...m.values()].filter(o => (!p.paraId || o.paraId === p.paraId) && (!paraSet || paraSet.has(o.paraId))).sort((a, b) => a.siraNo - b.siraNo || a.paraKod.localeCompare(b.paraKod));
}

/** Long / short durumu: net > 0 LONG (fazla), net < 0 SHORT (açık), sıfıra yakınsa DENGE. Saf fonksiyon. */
export function lsDurumu(longMiktar: number, shortMiktar: number) {
  const net = longMiktar - shortMiktar;
  return { net, durum: Math.abs(net) < 0.005 ? "DENGE" : net > 0 ? "LONG" : "SHORT" };
}

export const YONETICI_SORGULARI: Record<string, Sorgu> = {

  /** Firma son durum — para bazında tek satır: vezne + banka + cari alacak − cari borç = net pozisyon; seçilen kurla TL */
  async FIRSON1(pool, p, t) {
    if (!p.tarih) throw ApiError.badRequest("Tarih zorunludur.");
    const kur = await kurCoz(pool, p);
    const satirlar = (await pozisyonlar(pool, p, { banka: true, vadeli: false })).map(o => {
      const net = o.vezne + o.banka + o.cariAlacak - o.cariBorc, k = kur.kurlar.get(o.paraId) ?? 0, ks = kur.satisKurlari.get(o.paraId) ?? 0;
      return { ...o, net, kur: k, tlKarsiligi: net * k, kurSatis: ks, tlSatis: net * ks };
    }).filter(o => [o.vezne, o.banka, o.cariAlacak, o.cariBorc].some(v => Math.abs(v) > 0.000001));
    // Eski "FİRMA SON DURUM" rapor altı: Kasa / Cari / Toplam satırları — borç, alacak, bakiye + B/A, seçilen para cinsinden (eski @SecilenKasaBorc … @ToplamBakiye formülleri).
    // Kasa: vezne mevcudu pozitifse borç (varlık), negatifse alacak; Cari: carilerin bize borcu = borç, carilerin alacağı = alacak. Banka eski raporda yoktu, ayrı satırdır.
    const hedef = await hedefPara(pool, p, kur), deger = (o: any, miktar: number) => hedef.cevir(miktar * (kur.kurlar.get(o.paraId) ?? 0));
    const kalem = (ad: string, borc: number, alacak: number) => { const n = borc - alacak; return { kalem: ad, paraKod: hedef.kod, borc, alacak, bakiye: Math.abs(n), bakiyeTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; };
    const top = (f: (o: any) => number) => satirlar.reduce((a, o) => a + deger(o, f(o)), 0);
    const kasa = kalem("Kasa", top(o => Math.max(o.vezne, 0)), top(o => Math.max(-o.vezne, 0))), banka = kalem("Banka", top(o => Math.max(o.banka, 0)), top(o => Math.max(-o.banka, 0))),
      cariK = kalem("Cari", top(o => o.cariAlacak), top(o => o.cariBorc));
    const sonDurum = [kasa, ...(banka.borc || banka.alacak ? [banka] : []), cariK, kalem("Toplam", kasa.borc + banka.borc + cariK.borc, kasa.alacak + banka.alacak + cariK.alacak)];
    return sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p)} · ${kur.aciklama} · ${hedef.aciklama}`,
      `Net pozisyon = vezne mevcudu + banka hesapları + cari alacaklarımız − cari borçlarımız. ${VEZNE_BAKIYE_DIPNOT} Kasa hesap hareketleri vezne mevcudunun içindedir, ayrıca eklenmez. Banka: iptal edilmemiş banka hareketlerinin para bazında giriş − çıkış toplamı (hesap kartındaki devir tutarı hariç). Vezne seçimi yalnızca vezne mevcudunu süzer. ${kur.aciklama}.`,
      sonDurum);
  },

  /** Long / short denge analizi — döviz ve kıymetli maden pozisyonu (TL hariç); vadeli dekontlar ayrı kolon; ortalama maliyete göre değerleme farkı */
  async LONSHO1(pool, p, t) {
    // İki tarih arası (kullanıcı kararı 19.09.2026, eski rapordaki gibi): devir = ilk tarihten önceki günün kapanışı, mevcut = son tarih. Eski çağrılar için tek `tarih` de kabul edilir.
    const bit = p.bitis || p.tarih, bas = p.baslangic || bit;
    if (!bit || !bas) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    p = { ...p, tarih: bit };
    const kur = await kurCoz(pool, { ...p, kurTarihi: p.kurTarihi || bit });
    // Ortalama maliyet: kâr-zarar ile aynı ağırlıklı ortalama, kayıtların başından seçilen tarihe kadar
    const fis = await pool.request().input("t", sql.Date, p.tarih).query(`
      SELECT S.PARA_ID paraId, F.TIP tip, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KUR,0) kur
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@t ORDER BY S.PARA_ID, F.TARIH, F.FIS_ID, S.SATIR_NO;`);
    const ortMaliyet = new Map<number, number>();
    for (const h of maliyetYurut(fis.recordset.map((r: any) => ({ paraId: Number(r.paraId), tip: Number(r.tip), miktar: Number(r.miktar), tutar: Number(r.tutar), kur: Number(r.kur) })))) ortMaliyet.set(h.paraId, h.ortMaliyet);
    const devirGun = gunOnce(bas), devirKur = await kurTarihte(pool, devirGun), mevcutKur = await kurTarihte(pool, bit);
    const devirler = new Map<number, number>((await pozisyonlar(pool, { ...p, tarih: devirGun }, { banka: false, vadeli: false })).map(o => [o.paraId, o.vezne + o.cariAlacak - o.cariBorc]));
    const satirlar = (await pozisyonlar(pool, p, { banka: false, vadeli: true })).filter(o => o.paraId !== kur.tlId).map(o => {
      const longM = o.vezne + o.cariAlacak, shortM = o.cariBorc, ls = lsDurumu(longM, shortM), vadeliNet = o.vadeliAlacak - o.vadeliBorc;
      const k = kur.kurlar.get(o.paraId) ?? 0, ks = kur.satisKurlari.get(o.paraId) ?? 0, om = ortMaliyet.get(o.paraId) ?? 0;
      return { ...o, longMiktar: longM, shortMiktar: shortM, net: ls.net, durum: ls.durum, vadeliNet, netVadeliDahil: ls.net + vadeliNet, kur: k, tlKarsiligi: ls.net * k, kurSatis: ks, tlSatis: ls.net * ks,
        ortMaliyet: om, degerlemeFarki: om ? ls.net * (k - om) : 0,
        // Eski "LONG / SHORT DENGE ANALİZİ": Devir, Mevcut, sembol (@LongShortSembol: devir > mevcut → S, değilse L) ve |mevcut − devir|
        devir: devirler.get(o.paraId) ?? 0, mevcut: ls.net, lsSembol: (devirler.get(o.paraId) ?? 0) > ls.net ? "S" : "L", lsMiktar: Math.abs(ls.net - (devirler.get(o.paraId) ?? 0)) };
    }).filter(o => [o.longMiktar, o.shortMiktar, o.vadeliAlacak, o.vadeliBorc, o.devir].some(v => Math.abs(v) > 0.000001));
    // Rapor altı (eski @SecilenDevir, @SecilenMevcut, @DengeFarki, @ToplamNetKar): devir devir günü kuruyla, mevcut son tarih kuruyla değerlenir ve denge parasına çevrilir
    const hedef = await hedefPara(pool, p, kur), hd = hedef.id === kur.tlId ? 1 : devirKur.get(hedef.id) ?? 0, hm = hedef.id === kur.tlId ? 1 : mevcutKur.get(hedef.id) ?? 0;
    const bol = (x: number, y: number) => (y > 0 ? x / y : 0);
    const sDevir = satirlar.reduce((a, o) => a + bol(o.devir * (devirKur.get(o.paraId) ?? 0), hd), 0), sMevcut = satirlar.reduce((a, o) => a + bol(o.mevcut * (mevcutKur.get(o.paraId) ?? 0), hm), 0);
    const denge = bol(satirlar.reduce((a, o) => a + (o.mevcut - o.devir) * (mevcutKur.get(o.paraId) ?? 0), 0), hm), netKar = sMevcut - sDevir;
    const dengeOzeti = [{ kalem: `Devir değeri (${tarihTr(devirGun)} kuruyla)`, paraKod: hedef.kod, deger: sDevir }, { kalem: `Mevcut değeri (${tarihTr(bit)} kuruyla)`, paraKod: hedef.kod, deger: sMevcut },
      { kalem: "Denge farkı", paraKod: hedef.kod, deger: denge }, { kalem: netKar < 0 ? "Toplam Net Zarar" : "Toplam Net Kâr", paraKod: hedef.kod, deger: Math.abs(netKar) }];
    return sinirla(satirlar, t, `${tarihTr(bas)} – ${tarihTr(bit)}${ozetEk(p)} · ${kur.aciklama} · Denge parası: ${hedef.kod}`,
      `Long = vezne mevcudu + cari alacaklarımız; short = cari borçlarımız; net = long − short (LONG: fazla pozisyon, SHORT: açık pozisyon). TL kapsam dışıdır. Vadeli = seçilen tarihte vadesi gelmemiş cari dekontların neti (emanet verme +, emanet alma −); cari bakiyelere dahil değildir, "Net (vadeli dahil)" kolonunda eklenir. Değerleme farkı = net × (seçilen kur − ağırlıklı ortalama maliyet kuru). ${kur.aciklama}. Devir = ilk tarihten önceki günün net pozisyonu, Mevcut = son tarihteki net pozisyon; L / S = mevcut devirden büyükse L, küçükse S. Devir ve mevcut değerleri ilgili günün kur tablosundaki efektif alış kuruyla hesaplanır.`,
      dengeOzeti);
  },
};
