import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import { kurCoz, ozetEk, paraKumesi, sinirla, tarihTr, vezneBakiyeleri, VEZNE_BAKIYE_DIPNOT } from "../raporOrtak.js";
import { maliyetYurut } from "./analiz.js";
const tabloVar = async (pool, ...adlar) => !!(await pool.request().query(`SELECT CASE WHEN ${adlar.map(a => `OBJECT_ID('dbo.${a}','U') IS NOT NULL`).join(" AND ")} THEN 1 ELSE 0 END v`)).recordset[0]?.v;
/** Para bazında pozisyon bileşenleri (tarih dahil): vezne mevcudu, banka, cari alacak / borç, açık vadeli dekontlar */
async function pozisyonlar(pool, p, secenek) {
    const tarih = p.tarih;
    const m = new Map();
    const al = (r) => {
        const id = Number(r.paraId);
        if (!m.has(id))
            m.set(id, { paraId: id, paraKod: String(r.paraKod || "").trim(), paraAd: String(r.paraAd || "").trim(), siraNo: Number(r.siraNo ?? 99),
                vezne: 0, banka: 0, cariAlacak: 0, cariBorc: 0, vadeliAlacak: 0, vadeliBorc: 0 });
        return m.get(id);
    };
    const PARA = `S.PARA_ID paraId, RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo`;
    for (const v of await vezneBakiyeleri(pool, tarih, p))
        al({ ...v, siraNo: v.siraNo }).vezne += Number(v.miktar) || 0;
    const cari = await pool.request().input("t", sql.Date, tarih).query(`
    SELECT ${PARA}, SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE 0 END) borc, SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak
    FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
    WHERE CAST(H.TARIH AS date)<=@t GROUP BY S.PARA_ID, P.KOD, P.AD, P.SIRA_NO;`);
    // Carilerin bize borcu = bizim alacağımız; carilerin alacağı = bizim borcumuz
    for (const r of cari.recordset) {
        const o = al(r);
        o.cariAlacak += Number(r.borc) || 0;
        o.cariBorc += Number(r.alacak) || 0;
    }
    if (secenek.banka && await tabloVar(pool, "TODVZ_BANKA_HAREKET", "TODVZ_BANKA_HAREKET_SATIRI")) {
        const banka = await pool.request().input("t", sql.Date, tarih).query(`
      SELECT ${PARA}, SUM(CASE WHEN H.ISLEM_TIPI IN (0,2) THEN S.MEBLAG WHEN H.ISLEM_TIPI IN (1,3) THEN -S.MEBLAG ELSE 0 END) bakiye
      FROM dbo.TODVZ_BANKA_HAREKET H JOIN dbo.TODVZ_BANKA_HAREKET_SATIRI S ON S.BANKA_HAREKET_ID=H.BANKA_HAREKET_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      WHERE ISNULL(H.IPTAL,0)=0 AND CAST(H.TARIH AS date)<=@t GROUP BY S.PARA_ID, P.KOD, P.AD, P.SIRA_NO;`);
        for (const r of banka.recordset)
            al(r).banka += Number(r.bakiye) || 0;
    }
    if (secenek.vadeli && await tabloVar(pool, "TODVZ_CARI_DEKONT", "TODVZ_CARI_DEKONT_SATIRI")) {
        // Açık vadeli dekontlar: emanet alma (TIP 0) bizim borcumuz, emanet verme (TIP 1) bizim alacağımız; virman (TIP 2) firmayı etkilemez
        const vadeli = await pool.request().input("t", sql.Date, tarih).query(`
      SELECT ${PARA}, SUM(CASE WHEN D.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak, SUM(CASE WHEN D.TIP=0 THEN S.MEBLAG ELSE 0 END) borc
      FROM dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI S ON S.CARI_DEKONT_ID=D.CARI_DEKONT_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      WHERE D.IPTAL_TARIHI IS NULL AND D.VADE IS NOT NULL AND CAST(D.TARIH AS date)<=@t AND CAST(D.VADE AS date)>@t AND D.TIP IN (0,1)
      GROUP BY S.PARA_ID, P.KOD, P.AD, P.SIRA_NO;`);
        for (const r of vadeli.recordset) {
            const o = al(r);
            o.vadeliAlacak += Number(r.alacak) || 0;
            o.vadeliBorc += Number(r.borc) || 0;
        }
    }
    const paraSet = await paraKumesi(pool, p);
    return [...m.values()].filter(o => (!p.paraId || o.paraId === p.paraId) && (!paraSet || paraSet.has(o.paraId))).sort((a, b) => a.siraNo - b.siraNo || a.paraKod.localeCompare(b.paraKod));
}
/** Long / short durumu: net > 0 LONG (fazla), net < 0 SHORT (açık), sıfıra yakınsa DENGE. Saf fonksiyon. */
export function lsDurumu(longMiktar, shortMiktar) {
    const net = longMiktar - shortMiktar;
    return { net, durum: Math.abs(net) < 0.005 ? "DENGE" : net > 0 ? "LONG" : "SHORT" };
}
export const YONETICI_SORGULARI = {
    /** Firma son durum — para bazında tek satır: vezne + banka + cari alacak − cari borç = net pozisyon; seçilen kurla TL */
    async FIRSON1(pool, p, t) {
        if (!p.tarih)
            throw ApiError.badRequest("Tarih zorunludur.");
        const kur = await kurCoz(pool, p);
        const satirlar = (await pozisyonlar(pool, p, { banka: true, vadeli: false })).map(o => {
            const net = o.vezne + o.banka + o.cariAlacak - o.cariBorc, k = kur.kurlar.get(o.paraId) ?? 0, ks = kur.satisKurlari.get(o.paraId) ?? 0;
            return { ...o, net, kur: k, tlKarsiligi: net * k, kurSatis: ks, tlSatis: net * ks };
        }).filter(o => [o.vezne, o.banka, o.cariAlacak, o.cariBorc].some(v => Math.abs(v) > 0.000001));
        return sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p)} · ${kur.aciklama}`, `Net pozisyon = vezne mevcudu + banka hesapları + cari alacaklarımız − cari borçlarımız. ${VEZNE_BAKIYE_DIPNOT} Kasa hesap hareketleri vezne mevcudunun içindedir, ayrıca eklenmez. Banka: iptal edilmemiş banka hareketlerinin para bazında giriş − çıkış toplamı (hesap kartındaki devir tutarı hariç). Vezne seçimi yalnızca vezne mevcudunu süzer. ${kur.aciklama}.`);
    },
    /** Long / short denge analizi — döviz ve kıymetli maden pozisyonu (TL hariç); vadeli dekontlar ayrı kolon; ortalama maliyete göre değerleme farkı */
    async LONSHO1(pool, p, t) {
        if (!p.tarih)
            throw ApiError.badRequest("Tarih zorunludur.");
        const kur = await kurCoz(pool, p);
        // Ortalama maliyet: kâr-zarar ile aynı ağırlıklı ortalama, kayıtların başından seçilen tarihe kadar
        const fis = await pool.request().input("t", sql.Date, p.tarih).query(`
      SELECT S.PARA_ID paraId, F.TIP tip, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KUR,0) kur
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@t ORDER BY S.PARA_ID, F.TARIH, F.FIS_ID, S.SATIR_NO;`);
        const ortMaliyet = new Map();
        for (const h of maliyetYurut(fis.recordset.map((r) => ({ paraId: Number(r.paraId), tip: Number(r.tip), miktar: Number(r.miktar), tutar: Number(r.tutar), kur: Number(r.kur) }))))
            ortMaliyet.set(h.paraId, h.ortMaliyet);
        const satirlar = (await pozisyonlar(pool, p, { banka: false, vadeli: true })).filter(o => o.paraId !== kur.tlId).map(o => {
            const longM = o.vezne + o.cariAlacak, shortM = o.cariBorc, ls = lsDurumu(longM, shortM), vadeliNet = o.vadeliAlacak - o.vadeliBorc;
            const k = kur.kurlar.get(o.paraId) ?? 0, ks = kur.satisKurlari.get(o.paraId) ?? 0, om = ortMaliyet.get(o.paraId) ?? 0;
            return { ...o, longMiktar: longM, shortMiktar: shortM, net: ls.net, durum: ls.durum, vadeliNet, netVadeliDahil: ls.net + vadeliNet, kur: k, tlKarsiligi: ls.net * k, kurSatis: ks, tlSatis: ls.net * ks,
                ortMaliyet: om, degerlemeFarki: om ? ls.net * (k - om) : 0 };
        }).filter(o => [o.longMiktar, o.shortMiktar, o.vadeliAlacak, o.vadeliBorc].some(v => Math.abs(v) > 0.000001));
        return sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p)} · ${kur.aciklama}`, `Long = vezne mevcudu + cari alacaklarımız; short = cari borçlarımız; net = long − short (LONG: fazla pozisyon, SHORT: açık pozisyon). TL kapsam dışıdır. Vadeli = seçilen tarihte vadesi gelmemiş cari dekontların neti (emanet verme +, emanet alma −); cari bakiyelere dahil değildir, "Net (vadeli dahil)" kolonunda eklenir. Değerleme farkı = net × (seçilen kur − ağırlıklı ortalama maliyet kuru). ${kur.aciklama}.`);
    },
};
