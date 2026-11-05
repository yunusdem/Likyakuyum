import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, ek, gunOnce, hedefPara, kurCoz, kurTarihte, ozetEk, paraKumesi, sinirla, tarihTr, vezneBakiyeleri, VEZNE_BAKIYE_DIPNOT } from "../raporOrtak.js";
import { maliyetYurut } from "./analiz.js";
import { CARI_HAREKET_KOLONLARI, belgeTablolari, cariHareketleriSql } from "../kaynak.js";
import { paraBasliklariEkle, paraGrupBilgisi } from "../paraGrup.js";

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

  // Cari: cari hareketler + virman dekontu + bankadan ödenen döviz fişi + sarraf fişi cari ödemesi (kaynak.ts — Cari Bakiye ile aynı kapsam)
  const cari = await pool.request().input("t", sql.Date, tarih).query(`
    ;WITH CH (${CARI_HAREKET_KOLONLARI}) AS (${cariHareketleriSql(await belgeTablolari(pool))})
    SELECT CH.paraId, RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo,
      SUM(CASE WHEN CH.tip=0 THEN CH.meblag ELSE 0 END) borc, SUM(CASE WHEN CH.tip=1 THEN CH.meblag ELSE 0 END) alacak
    FROM CH JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CH.paraId
    WHERE CAST(CH.tarih AS date)<=@t GROUP BY CH.paraId, P.KOD, P.AD, P.SIRA_NO;`);
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

/** Ek parametre değeri (metin): `p.ek[ad]` → `p[ad]` (koşullardaki parametreDegeri ile aynı sıra); yoksa "". Saf fonksiyon. */
export const ekDeger = (p: RaporParametreler, ad: string): string => ek(p, ad) || String((p as any)[ad] ?? "").trim();
/** Onay kutusu değeri: "1" / "true" / "evet" → işaretli; boş (parametre hiç gelmedi) → varsayılan. Saf fonksiyon. */
export const onayAcik = (deger: string, varsayilan: boolean): boolean => (deger === "" ? varsayilan : ["1", "true", "evet"].includes(deger.toLowerCase()));

/* ───────── Çevrim yönü: eski raporlardaki "TL -> Döviz çevrimi" / "Döviz -> Döviz çevrimi" Alış / Satış seçimleri (docs/SEKTORLU_RAPORLAR_YOL_HARITASI.md B11) ───────── */

/** Çevrim seçimi: "kur" = kur seçimindeki (kurSecimi) kur, "alis" = efektif alış, "satis" = efektif satış */
export type CevrimSecimi = "kur" | "alis" | "satis";
/** Bir günün kurları, seçime göre: `kur` kur seçiminin verdiği harita (bugünkü davranış), `alis` / `satis` aynı kur tablosunun efektif alış / satış kurları */
export type KurSeti = Record<CevrimSecimi, Map<number, number>>;
export const CEVRIM_ADI: Record<CevrimSecimi, string> = { kur: "Kur seçimine göre", alis: "Alış", satis: "Satış" };

/** Parametre değeri → çevrim seçimi; boş / tanınmayan değer varsayılana düşer. Saf fonksiyon. */
export const cevrimSecimi = (deger: string, varsayilan: CevrimSecimi = "kur"): CevrimSecimi => (deger === "alis" || deger === "satis" || deger === "kur" ? deger : varsayilan);

/**
 * Miktarı seçilen (karşılık / denge) paraya çevirir — eski rpt'lerdeki @SecilenBorc / @SecilenAlacak / @SecilenKapanisDevri / @SecilenDevir formülleri:
 * TL satırı → miktar ÷ seçilen paranın kuru ("TL -> Döviz" seçimi); döviz satırı → miktar × paranın kuru ÷ seçilen paranın kuru (ikisi de "Döviz -> Döviz" seçimiyle).
 * Seçilen para TL ise bölen 1; seçilen paranın kuru yoksa sonuç 0 (rpt'deki "= 0.0 then 0.0"). Saf fonksiyon.
 */
export function secileneCevir(miktar: number, paraId: number, a: { tlId: number; hedefId: number; kurlar: KurSeti; tlDoviz: CevrimSecimi; dovizDoviz: CevrimSecimi }): number {
  const tl = paraId === a.tlId, m = a.kurlar[tl ? a.tlDoviz : a.dovizDoviz];
  const bolen = a.hedefId === a.tlId ? 1 : m.get(a.hedefId) ?? 0;
  return bolen > 0 ? (miktar * (tl ? 1 : m.get(paraId) ?? 0)) / bolen : 0;
}

const KUR_ALIS_SQL = "COALESCE(NULLIF(K.EFEKTIF_ALIS,0),K.DOVIZ_ALIS)", KUR_SATIS_SQL = "COALESCE(NULLIF(K.EFEKTIF_SATIS,0),K.DOVIZ_SATIS)";
const ikiYon = (kayitlar: any[], tlId: number) => {
  const alis = new Map<number, number>(), satis = new Map<number, number>();
  for (const r of kayitlar) { alis.set(Number(r.id), Number(r.alis) || 0); satis.set(Number(r.id), Number(r.satis) || 0); }
  alis.set(tlId, 1); satis.set(tlId, 1);
  return { alis, satis };
};
/** Kur seçiminin (kurCoz) kullandığı kur tablosundaki efektif alış ve satış kurları (efektif yoksa döviz kuru); TL = 1. Yalnızca SELECT. */
export async function gununKurlari(pool: sql.ConnectionPool, p: RaporParametreler, tlId: number) {
  const r = await pool.request().input("tur", sql.TinyInt, p.kurTuru === 2 ? 2 : 0).input("t", sql.Date, p.kurTarihi || p.tarih || null).query(`
    SELECT K.PARA_ID id, ${KUR_ALIS_SQL} alis, ${KUR_SATIS_SQL} satis FROM dbo.TODVZ_KUR K
    WHERE K.KUR_TABLOSU_ID=(SELECT TOP 1 T.KUR_TABLOSU_ID FROM dbo.TODVZ_KUR_TABLOSU T
      WHERE T.TUR=@tur AND (@tur=0 OR @t IS NULL OR CAST(T.TARIH AS date)<=@t) ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC)`);
  return ikiYon(r.recordset, tlId);
}
/** kurTarihte ile aynı kur tablosu (tarihe eşit / önceki en yakın): efektif alış ve satış kurları; TL = 1. Devir / mevcut günü değerlemeleri için. Yalnızca SELECT. */
export async function tarihKurlari(pool: sql.ConnectionPool, tarih: string, tlId: number) {
  const r = await pool.request().input("t", sql.Date, tarih).query(`
    SELECT K.PARA_ID id, ${KUR_ALIS_SQL} alis, ${KUR_SATIS_SQL} satis FROM dbo.TODVZ_KUR K
    WHERE K.KUR_TABLOSU_ID=(SELECT TOP 1 T.KUR_TABLOSU_ID FROM dbo.TODVZ_KUR_TABLOSU T WHERE CAST(T.TARIH AS date)<=@t ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC)`);
  return ikiYon(r.recordset, tlId);
}
/**
 * Kur seti: seçimlerin hepsi "kur" ise ek okuma yapılmaz (bugünkü sonuç aynen çıkar); biri bile Alış / Satış ise aynı tablonun iki yönlü kurları okunur.
 * `kur`: kur seçiminin (devir günü için kurTarihte'nin) verdiği harita.
 */
export async function kurSetiKur(secimler: CevrimSecimi[], kur: Map<number, number>, oku: () => Promise<{ alis: Map<number, number>; satis: Map<number, number> }>): Promise<KurSeti> {
  if (secimler.every(s => s === "kur")) return { kur, alis: kur, satis: kur };
  const o = await oku();
  return { kur, alis: o.alis, satis: o.satis };
}
/** Filtre özetine çevrim seçimi parçası: yalnız varsayılandan farklıysa */
export const cevrimOzeti = (etiket: string, secim: CevrimSecimi, varsayilan: CevrimSecimi = "kur") => (secim === varsayilan ? "" : ` · ${etiket}: ${CEVRIM_ADI[secim]}`);

/* ───────── Firma son durum: rapor altı kalemleri ───────── */

/**
 * Eski "FİRMA SON DURUM" rapor altı (@SecilenKasaBorc … @ToplamBakiye): Kasa / Cari / Toplam — borç, alacak, |bakiye| + B/A, seçilen para cinsinden.
 * Kasa: vezne mevcudu pozitifse borç (varlık), negatifse alacak; Cari: carilerin bize borcu = borç, carilerin alacağı = alacak.
 * Banka eski raporda yoktur: ayrı satır olarak kalır (hareket varsa). "Toplam (Kasa + Cari)" eski raporun toplamıdır; "Toplam (Kasa + Banka + Cari)" bankayı da içerir. Saf fonksiyon.
 */
export function sonDurumKalemleri(satirlar: { paraId: number; vezne: number; banka: number; cariAlacak: number; cariBorc: number }[], cevir: (paraId: number, miktar: number) => number, hedefKod: string) {
  const kalem = (ad: string, borc: number, alacak: number) => { const n = borc - alacak; return { kalem: ad, paraKod: hedefKod, borc, alacak, bakiye: Math.abs(n), bakiyeTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; };
  const top = (f: (o: (typeof satirlar)[number]) => number) => satirlar.reduce((a, o) => a + cevir(o.paraId, f(o)), 0);
  const kasa = kalem("Kasa", top(o => Math.max(o.vezne, 0)), top(o => Math.max(-o.vezne, 0))), banka = kalem("Banka", top(o => Math.max(o.banka, 0)), top(o => Math.max(-o.banka, 0))),
    cariK = kalem("Cari", top(o => o.cariAlacak), top(o => o.cariBorc));
  return [kasa, ...(banka.borc || banka.alacak ? [banka] : []), cariK,
    kalem("Toplam (Kasa + Cari)", kasa.borc + cariK.borc, kasa.alacak + cariK.alacak),
    kalem("Toplam (Kasa + Banka + Cari)", kasa.borc + banka.borc + cariK.borc, kasa.alacak + banka.alacak + cariK.alacak)];
}

/* ───────── Long / short ───────── */

/** Eski @LongShortSembol: devir mevcuttan büyükse "S", değilse "L". Saf fonksiyon. */
export const lsSembolu = (devir: number, mevcut: number): "L" | "S" => (devir > mevcut ? "S" : "L");
/** Eski "Long / Short seçeneği" (@Gecerli): hepsi → her satır; long → sembolü L olanlar; short → sembolü S olanlar. Saf fonksiyon. */
export const longShortUygun = (secim: string, sembol: string) => (secim === "long" ? sembol === "L" : secim === "short" ? sembol === "S" : true);
/** Eski @LongShortTLCevrimi: (mevcut − devir) × mevcut günü kuru; mevcut > devir (long) ise Long seçimi, değilse Short seçimi. Saf fonksiyon. */
export function longShortTl(devir: number, mevcut: number, paraId: number, mevcutKur: KurSeti, yon: { long: CevrimSecimi; short: CevrimSecimi }): number {
  return (mevcut - devir) * (mevcutKur[mevcut > devir ? yon.long : yon.short].get(paraId) ?? 0);
}
/**
 * Eski "LONG / SHORT DENGE ANALİZİ" rapor altı (@SecilenDevir, @SecilenMevcut, @DengeFarki, @ToplamNetKar): devir devir günü kuruyla, mevcut son tarih kuruyla
 * değerlenir ve denge parasına çevrilir (Denge seçimi); denge farkı = Σ long / short TL karşılığı ÷ denge parasının mevcut günü kuru. Saf fonksiyon.
 */
export function dengeKalemleri(satirlar: { paraId: number; devir: number; mevcut: number }[], a: { tlId: number; hedefId: number; hedefKod: string; devirKur: KurSeti; mevcutKur: KurSeti;
  long: CevrimSecimi; short: CevrimSecimi; denge: CevrimSecimi; devirEtiketi: string; mevcutEtiketi: string }) {
  const cevir = (miktar: number, paraId: number, kurlar: KurSeti) => secileneCevir(miktar, paraId, { tlId: a.tlId, hedefId: a.hedefId, kurlar, tlDoviz: a.denge, dovizDoviz: a.denge });
  const sDevir = satirlar.reduce((t, o) => t + cevir(o.devir, o.paraId, a.devirKur), 0), sMevcut = satirlar.reduce((t, o) => t + cevir(o.mevcut, o.paraId, a.mevcutKur), 0);
  const hm = a.hedefId === a.tlId ? 1 : a.mevcutKur[a.denge].get(a.hedefId) ?? 0;
  const lsTl = satirlar.reduce((t, o) => t + longShortTl(o.devir, o.mevcut, o.paraId, a.mevcutKur, a), 0);
  const denge = hm > 0 ? lsTl / hm : 0, netKar = sMevcut - sDevir;
  return [{ kalem: `Devir değeri (${a.devirEtiketi} kuruyla)`, paraKod: a.hedefKod, deger: sDevir }, { kalem: `Mevcut değeri (${a.mevcutEtiketi} kuruyla)`, paraKod: a.hedefKod, deger: sMevcut },
    { kalem: "Denge farkı", paraKod: a.hedefKod, deger: denge }, { kalem: netKar < 0 ? "Toplam Net Zarar" : "Toplam Net Kâr", paraKod: a.hedefKod, deger: Math.abs(netKar) }];
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
    // Eski "FİRMA SON DURUM" rapor altı: Kasa / Cari / Toplam satırları (sonDurumKalemleri). Çevrim: TL satırları "TL -> Döviz", döviz satırları "Döviz -> Döviz" seçimiyle;
    // ikisi de "Kur seçimine göre" iken kur seçiminin (kurAlani) kuru kullanılır — bugünkü sonuç.
    const hedef = await hedefPara(pool, p, kur), tlDoviz = cevrimSecimi(ekDeger(p, "tlDovizCevrim")), dovizDoviz = cevrimSecimi(ekDeger(p, "dovizDovizCevrim"));
    const kurlar = await kurSetiKur([tlDoviz, dovizDoviz], kur.kurlar, () => gununKurlari(pool, p, kur.tlId));
    const sonDurum = sonDurumKalemleri(satirlar, (paraId, miktar) => secileneCevir(miktar, paraId, { tlId: kur.tlId, hedefId: hedef.id, kurlar, tlDoviz, dovizDoviz }), hedef.kod);
    const sonuc = sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p)} · ${kur.aciklama} · ${hedef.aciklama}${cevrimOzeti("TL → Döviz", tlDoviz)}${cevrimOzeti("Döviz → Döviz", dovizDoviz)}`,
      `Net pozisyon = vezne mevcudu + banka hesapları + cari alacaklarımız − cari borçlarımız. ${VEZNE_BAKIYE_DIPNOT} Kasa hesap hareketleri vezne mevcudunun içindedir, ayrıca eklenmez. Banka: iptal edilmemiş banka hareketlerinin para bazında giriş − çıkış toplamı (hesap kartındaki devir tutarı hariç). Vezne seçimi yalnızca vezne mevcudunu süzer. ${kur.aciklama}.`,
      sonDurum);
    if (sonuc.sinirAsildi) return sonuc;
    // Para ayrımı (K11): para satırları Döviz / Kuyum başlıkları altında; sıra grup içinde korunur, toplamlar ve kayıt sayısı değişmez
    const pg = await paraGrupBilgisi(pool);
    return { ...sonuc, satirlar: paraBasliklariEkle(satirlar, { grupla: s => pg.grup(s), alan: "paraKod" }) };
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
    // Eski "Long / Short seçeneği": Hepsi / Long (sembol L) / Short (sembol S) — satır süzgeci; rapor altı da süzülen satırlardan hesaplanır (rpt kayıt seçimi)
    const lsSecim = ekDeger(p, "longShort");
    const satirlar = (await pozisyonlar(pool, p, { banka: false, vadeli: true })).filter(o => o.paraId !== kur.tlId).map(o => {
      const longM = o.vezne + o.cariAlacak, shortM = o.cariBorc, ls = lsDurumu(longM, shortM), vadeliNet = o.vadeliAlacak - o.vadeliBorc;
      const k = kur.kurlar.get(o.paraId) ?? 0, ks = kur.satisKurlari.get(o.paraId) ?? 0, om = ortMaliyet.get(o.paraId) ?? 0;
      return { ...o, longMiktar: longM, shortMiktar: shortM, net: ls.net, durum: ls.durum, vadeliNet, netVadeliDahil: ls.net + vadeliNet, kur: k, tlKarsiligi: ls.net * k, kurSatis: ks, tlSatis: ls.net * ks,
        ortMaliyet: om, degerlemeFarki: om ? ls.net * (k - om) : 0,
        // Eski "LONG / SHORT DENGE ANALİZİ": Devir, Mevcut, sembol (@LongShortSembol: devir > mevcut → S, değilse L) ve |mevcut − devir|
        devir: devirler.get(o.paraId) ?? 0, mevcut: ls.net, lsSembol: lsSembolu(devirler.get(o.paraId) ?? 0, ls.net), lsMiktar: Math.abs(ls.net - (devirler.get(o.paraId) ?? 0)) };
    }).filter(o => [o.longMiktar, o.shortMiktar, o.vadeliAlacak, o.vadeliBorc, o.devir].some(v => Math.abs(v) > 0.000001))
      .filter(o => longShortUygun(lsSecim, o.lsSembol));
    // Rapor altı (dengeKalemleri): devir devir günü kuruyla, mevcut son tarih kuruyla değerlenir ve denge parasına çevrilir. Çevrim seçimleri: Long / Short → döviz → TL
    // (denge farkı), Denge → TL → denge parası; hepsi Alış iken bugünkü sonuç (kurTarihte: efektif alış). Satış kurları yalnız seçilince okunur.
    const yLong = cevrimSecimi(ekDeger(p, "longCevrim"), "alis"), yShort = cevrimSecimi(ekDeger(p, "shortCevrim"), "alis"), yDenge = cevrimSecimi(ekDeger(p, "dengeCevrim"), "alis");
    const satisGerek = [yLong, yShort, yDenge].includes("satis");
    const devirSatis = satisGerek ? (await tarihKurlari(pool, devirGun, kur.tlId)).satis : devirKur, mevcutSatis = satisGerek ? (await tarihKurlari(pool, bit, kur.tlId)).satis : mevcutKur;
    const hedef = await hedefPara(pool, p, kur);
    const dengeOzeti = dengeKalemleri(satirlar, { tlId: kur.tlId, hedefId: hedef.id, hedefKod: hedef.kod,
      devirKur: { kur: devirKur, alis: devirKur, satis: devirSatis }, mevcutKur: { kur: mevcutKur, alis: mevcutKur, satis: mevcutSatis },
      long: yLong, short: yShort, denge: yDenge, devirEtiketi: tarihTr(devirGun), mevcutEtiketi: tarihTr(bit) });
    const sonuc = sinirla(satirlar, t, `${tarihTr(bas)} – ${tarihTr(bit)}${ozetEk(p)} · ${kur.aciklama} · Denge parası: ${hedef.kod}${lsSecim === "long" ? " · Long" : lsSecim === "short" ? " · Short" : ""}`
      + `${cevrimOzeti("Long çevrimi", yLong, "alis")}${cevrimOzeti("Short çevrimi", yShort, "alis")}${cevrimOzeti("Denge çevrimi", yDenge, "alis")}`,
      `Long = vezne mevcudu + cari alacaklarımız; short = cari borçlarımız; net = long − short (LONG: fazla pozisyon, SHORT: açık pozisyon). TL kapsam dışıdır. Vadeli = seçilen tarihte vadesi gelmemiş cari dekontların neti (emanet verme +, emanet alma −); cari bakiyelere dahil değildir, "Net (vadeli dahil)" kolonunda eklenir. Değerleme farkı = net × (seçilen kur − ağırlıklı ortalama maliyet kuru). ${kur.aciklama}. Devir = ilk tarihten önceki günün net pozisyonu, Mevcut = son tarihteki net pozisyon; L / S = mevcut devirden büyükse L, küçükse S. Devir ve mevcut değerleri ilgili günün kur tablosundaki efektif alış kuruyla hesaplanır.`,
      dengeOzeti);
    if (sonuc.sinirAsildi) return sonuc;
    // Para ayrımı (K11): para satırları Döviz / Kuyum başlıkları altında; sıra grup içinde korunur, toplamlar ve kayıt sayısı değişmez
    const pg = await paraGrupBilgisi(pool);
    return { ...sonuc, satirlar: paraBasliklariEkle(satirlar, { grupla: s => pg.grup(s), alan: "paraKod" }) };
  },
};
