import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import { tarihTr, kurCoz, hedefPara, gunOnce, kurTarihte, sinirla, paraKumesi, ozetEk, vezneBakiyeleri, } from "../raporOrtak.js";
import { CARI_HAREKET_KOLONLARI, belgeTablolari, cariHareketleriSql } from "../kaynak.js";
import { paraBasliklariEkle, paraGrupBilgisi } from "../paraGrup.js";
import { cevrimOzeti, cevrimSecimi, ekDeger, gununKurlari, kurSetiKur, onayAcik, secileneCevir, tarihKurlari } from "./yonetici.js";
export const VARLIK_CINSI_ADI = { hepsi: "Hepsi", kasa: "Kasa", cari: "Cari" };
/** Parametre değeri → varlık cinsi; boş / tanınmayan değer "hepsi". Saf fonksiyon. */
export const varlikCinsi = (deger) => (deger === "kasa" || deger === "cari" ? deger : "hepsi");
/** Varlık cinsinin kapsadığı kaynaklar: kasa = vezne mevcutları, cari = cari alacak / borçlar. Saf fonksiyon. */
export const varlikKapsami = (cins) => ({ kasa: cins !== "cari", cari: cins !== "kasa" });
/**
 * Eski "FİRMA VARLIKLARI" rapor altı. Para satırları: Devir (önceki günün kapanışı) → Borç / Alacak (günün net hareketi) → Devreden + devredenin seçilen paradaki değeri.
 * Kalemler (rpt formülleri): Devir değeri = Σ @SecilenKapanisDevri (devir × devir günü kuru); Açılış devri değeri = Σ @SecilenAcilisDevri (devir × günün kuru);
 * Kapanış / açılış evalüasyonu = açılış − devir değeri; Borç / Alacak değeri = Σ @SecilenBorc / @SecilenAlacak; Devreden değeri = açılış + borç − alacak;
 * Toplam Net Kâr / Zarar = devreden değeri − devir değeri, işaretli tek satır (eski @ToplamNetKarZarar; kâr artı, zarar eksi — canlı test 05.11.2026).
 * Çevrim: TL satırı "TL -> Döviz", döviz satırı "Döviz -> Döviz" seçimiyle (secileneCevir). `toplamSatiri` false → kalemler basılmaz (eski "Toplam satırı" kutusu).
 * `grupla` verilirse para satırları Döviz / Kuyum başlıkları altında dizilir (K11) ve kalemler "Toplam" başlığı altına girer. Saf fonksiyon.
 */
export function varlikOzetiKur(paralar, a) {
    const cevir = (miktar, paraId, kurlar) => secileneCevir(miktar, paraId, { tlId: a.tlId, hedefId: a.hedefId, kurlar, tlDoviz: a.tlDoviz, dovizDoviz: a.dovizDoviz });
    const paraSatirlari = [];
    let dDeger = 0, dBugun = 0, vDeger = 0, bDeger = 0, aDeger = 0;
    for (const o of paralar) {
        const d0 = o.devir, d1 = o.devreden, h = d1 - d0, borc = h > 0 ? h : 0, alacak = h < 0 ? -h : 0;
        if (Math.abs(d0) < 0.000001 && Math.abs(d1) < 0.000001)
            continue;
        paraSatirlari.push({ paraId: o.paraId, kalem: o.paraKod, devir: d0, borc, alacak, devreden: d1, deger: cevir(d1, o.paraId, a.kurlar) });
        dDeger += cevir(d0, o.paraId, a.devirKurlar);
        dBugun += cevir(d0, o.paraId, a.kurlar);
        vDeger += cevir(d1, o.paraId, a.kurlar);
        bDeger += cevir(borc, o.paraId, a.kurlar);
        aDeger += cevir(alacak, o.paraId, a.kurlar);
    }
    const duz = (s) => { const { paraId: _p, ...kalan } = s; return kalan; };
    const cikti = (a.grupla ? paraBasliklariEkle(paraSatirlari, { grupla: s => a.grupla({ paraId: s.paraId, paraKod: String(s.kalem) }), alan: "kalem" }) : paraSatirlari).map(duz);
    if (!a.toplamSatiri)
        return cikti;
    const bos = { devir: null, borc: null, alacak: null, devreden: null }, net = vDeger - dDeger;
    if (a.grupla && cikti.length)
        cikti.push({ kalem: "Toplam", _baslik: "Toplam", _stil: "baslik" });
    cikti.push({ kalem: `Devir değeri (${a.hedefKod}, ${a.devirEtiketi} kuruyla)`, ...bos, deger: dDeger }, { kalem: `Kapanış / açılış evalüasyonu (${a.hedefKod})`, ...bos, deger: dBugun - dDeger }, { kalem: `Açılış devri değeri (${a.hedefKod})`, ...bos, deger: dBugun }, { kalem: `Borç değeri (${a.hedefKod})`, ...bos, deger: bDeger }, { kalem: `Alacak değeri (${a.hedefKod})`, ...bos, deger: aDeger }, { kalem: `Devreden değeri (${a.hedefKod})`, ...bos, deger: vDeger }, { kalem: `Toplam Net Kâr / Zarar (${a.hedefKod})`, ...bos, deger: net });
    return cikti;
}
/** Ana tablo satırlarını grup anahtarına (1-Vezneler / 2-Cari alacaklar / 3-Cari borçlar) göre ardışık dizer; grup içinde özgün sıra korunur. Saf fonksiyon. */
export const grubaGoreDiz = (satirlar) => satirlar.map((s, n) => ({ s, n })).sort((x, y) => (x.s.grup < y.s.grup ? -1 : x.s.grup > y.s.grup ? 1 : x.n - y.n)).map(x => x.s);
/** Rapor boşken basılan tek not (rapor doluyken sinirla hiç not basmaz; canlı test 05.11.2026) */
export const FIRVAR1_BOS_NOT = "Seçilen tarihe kadar vezne ya da cari hareketi yok.";
export const FIRMA_VARLIK_SORGULARI = {
    /** R5 Firma varlıkları — vezne bakiyeleri + cari alacak/borç, seçilen kurla TL */
    async FIRVAR1(pool, p, t) {
        if (!p.tarih)
            throw ApiError.badRequest("Tarih zorunludur.");
        const kur = await kurCoz(pool, p);
        // Eski "Varlık cinsi": Kasa → yalnız vezne mevcutları, Cari → yalnız cari alacak / borçlar (ana tablo ve rapor altı birlikte süzülür)
        const cins = varlikCinsi(ekDeger(p, "varlikCinsi")), kapsam = varlikKapsami(cins);
        const vezneler = kapsam.kasa ? await vezneBakiyeleri(pool, p.tarih, p) : [];
        const paraSet = await paraKumesi(pool, p);
        const paraUygun = (id) => (!p.paraId || id === p.paraId) && (!paraSet || paraSet.has(id));
        const satirlar = vezneler.filter(v => Math.abs(v.miktar) > 0.000001 && paraUygun(Number(v.paraId))).map(v => ({
            kaynak: `Vezne ${v.vezneKod} — ${v.vezneAd}`, grup: "1-Vezneler", paraId: Number(v.paraId), paraKod: v.paraKod, miktar: Number(v.miktar), kur: kur.kurlar.get(v.paraId) ?? 0,
            tlKarsiligi: Number(v.miktar) * (kur.kurlar.get(v.paraId) ?? 0), kurSatis: kur.satisKurlari.get(v.paraId) ?? 0, tlSatis: Number(v.miktar) * (kur.satisKurlari.get(v.paraId) ?? 0)
        }));
        const ch = `;WITH CH (${CARI_HAREKET_KOLONLARI}) AS (${cariHareketleriSql(await belgeTablolari(pool))})`;
        const cari = !kapsam.cari ? { recordset: [] } : await pool.request().input("t", sql.Date, p.tarih).query(`${ch}
      SELECT CH.paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        SUM(CASE WHEN CH.tip=0 THEN CH.meblag ELSE 0 END) borc, SUM(CASE WHEN CH.tip=1 THEN CH.meblag ELSE 0 END) alacak
      FROM CH JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CH.paraId
      WHERE CAST(CH.tarih AS date)<=@t GROUP BY CH.paraId, P.KOD, P.SIRA_NO ORDER BY ISNULL(P.SIRA_NO,99), P.KOD;`);
        for (const r of cari.recordset) {
            if (!paraUygun(Number(r.paraId)))
                continue;
            const k = kur.kurlar.get(Number(r.paraId)) ?? 0, ks = kur.satisKurlari.get(Number(r.paraId)) ?? 0;
            if (Number(r.borc))
                satirlar.push({ kaynak: "Cari alacaklarımız (carilerin bize borcu)", grup: "2-Cari alacaklar", paraId: Number(r.paraId), paraKod: r.paraKod, miktar: Number(r.borc), kur: k, tlKarsiligi: Number(r.borc) * k, kurSatis: ks, tlSatis: Number(r.borc) * ks });
            if (Number(r.alacak))
                satirlar.push({ kaynak: "Cari borçlarımız (carilerin bizden alacağı)", grup: "3-Cari borçlar", paraId: Number(r.paraId), paraKod: r.paraKod, miktar: -Number(r.alacak), kur: k, tlKarsiligi: -Number(r.alacak) * k, kurSatis: ks, tlSatis: -Number(r.alacak) * ks });
        }
        // Eski "FİRMA VARLIKLARI" metrikleri: para başına Devir (önceki günün kapanışı) → Borç / Alacak (seçilen günün net hareketi) → Devreden; rapor altında
        // devir değeri (devir günü kuruyla), kapanış / açılış evalüasyonu (aynı devrin bugünkü kurla değeri − devir günü kuruyla değeri), devreden değeri ve toplam net kâr / zarar.
        // Varlık = vezne mevcudu + cari alacaklarımız − cari borçlarımız. Borç / alacak net harekettir (eski yordam brüt veriyor olabilir — canlıda karşılaştırılacak).
        const net = async (gun) => {
            const m = new Map();
            // Seçilen günün vezne bakiyeleri yukarıda zaten okundu (aynı sorgu); yalnız devir günü için yeniden çalıştırılır
            for (const v of !kapsam.kasa ? [] : gun === p.tarih ? vezneler : await vezneBakiyeleri(pool, gun, p)) {
                if (!paraUygun(Number(v.paraId)))
                    continue;
                const o = m.get(v.paraKod) || { paraId: Number(v.paraId), paraKod: v.paraKod, miktar: 0 };
                o.miktar += Number(v.miktar) || 0;
                m.set(v.paraKod, o);
            }
            if (!kapsam.cari)
                return m;
            const c = await pool.request().input("t", sql.Date, gun).query(`${ch} SELECT CH.paraId, RTRIM(P.KOD) paraKod, SUM(CASE WHEN CH.tip=0 THEN CH.meblag ELSE -CH.meblag END) net
        FROM CH JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CH.paraId WHERE CAST(CH.tarih AS date)<=@t GROUP BY CH.paraId, P.KOD`);
            for (const r of c.recordset) {
                if (!paraUygun(Number(r.paraId)))
                    continue;
                const o = m.get(r.paraKod) || { paraId: Number(r.paraId), paraKod: r.paraKod, miktar: 0 };
                o.miktar += Number(r.net) || 0;
                m.set(r.paraKod, o);
            }
            return m;
        };
        const devirGun = gunOnce(p.tarih), devirler = await net(devirGun), devredenler = await net(p.tarih), devirKur = await kurTarihte(pool, devirGun), hedef = await hedefPara(pool, p, kur);
        // Çevrim seçimleri (eski "TL -> Döviz" / "Döviz -> Döviz"): ikisi de "Kur seçimine göre" iken günün kuru kur seçiminden, devir günü kuru efektif alıştan gelir (bugünkü sonuç);
        // Alış / Satış seçilince hem günün hem devir gününün kur tablosundan o yön okunur.
        const tlDoviz = cevrimSecimi(ekDeger(p, "tlDovizCevrim")), dovizDoviz = cevrimSecimi(ekDeger(p, "dovizDovizCevrim"));
        const kurlar = await kurSetiKur([tlDoviz, dovizDoviz], kur.kurlar, () => gununKurlari(pool, p, kur.tlId));
        const devirKurlar = await kurSetiKur([tlDoviz, dovizDoviz], devirKur, () => tarihKurlari(pool, devirGun, kur.tlId));
        const pg = await paraGrupBilgisi(pool);
        const paralar = [...new Set([...devirler.keys(), ...devredenler.keys()])].map(kod => ({ paraId: (devredenler.get(kod) || devirler.get(kod)).paraId, paraKod: kod,
            devir: devirler.get(kod)?.miktar ?? 0, devreden: devredenler.get(kod)?.miktar ?? 0 }));
        const varlikOzeti = varlikOzetiKur(paralar, { tlId: kur.tlId, hedefId: hedef.id, hedefKod: hedef.kod, devirEtiketi: tarihTr(devirGun), kurlar, devirKurlar, tlDoviz, dovizDoviz,
            toplamSatiri: onayAcik(ekDeger(p, "toplamSatiri"), true), grupla: x => pg.grup(x) });
        // Ana tablo: gruplar ardışık (motor ardışık satırları gruplar), her grubun içinde para satırları Döviz / Kuyum başlıkları altında (K11)
        const sirali = grubaGoreDiz(satirlar);
        const sonuc = sinirla(sirali, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p)} · ${kur.aciklama} · ${hedef.aciklama}${cins === "hepsi" ? "" : ` · Varlık cinsi: ${VARLIK_CINSI_ADI[cins]}`}`
            + `${cevrimOzeti("TL → Döviz", tlDoviz)}${cevrimOzeti("Döviz → Döviz", dovizDoviz)}`, FIRVAR1_BOS_NOT, varlikOzeti);
        if (sonuc.sinirAsildi)
            return sonuc;
        return { ...sonuc, satirlar: paraBasliklariEkle(sirali, { grupla: s => pg.grup(s), alan: "paraKod", bolumle: ["grup"] }) };
    },
};
