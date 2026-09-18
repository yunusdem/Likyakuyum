import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import { TL_PARA_SQL, adetOzeti, aralikOzeti, filtreler, idFiltre, kurCoz, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";
/** Kasadan geçen nakit satırları: meblağ kendi parasında; KDV > 0 ise TL'de (para TL ise aynı satıra eklenir, değilse ayrı "KDV" satırı). Saf fonksiyon — testte kullanılır. */
export function kasaNakitSatirlari(h, tl) {
    const yon = (tutar) => ({ giris: h.tip === 0 ? tutar : 0, cikis: h.tip === 1 ? tutar : 0 });
    const kdv = Number(h.kdv) || 0, meblag = Number(h.meblag) || 0;
    if (kdv > 0 && h.paraId !== tl.id)
        return [
            { ...h, ...yon(meblag), kdv: 0, kdvSatiri: false },
            { ...h, paraId: tl.id, paraKod: tl.kod, ...yon(kdv), kdv, aciklama: `KDV — ${h.aciklama}`.trim(), kdvSatiri: true },
        ];
    return [{ ...h, ...yon(meblag + kdv), kdv, kdvSatiri: false }];
}
/** Devir + yürüyen bakiye: gruplar sıralı gelir; her grubun başına devir satırı eklenir. Saf fonksiyon. */
export function yuruyenBakiye(gruplar, devirSatiri) {
    const satirlar = [];
    for (const g of gruplar) {
        let bakiye = g.devir;
        satirlar.push({ ...g.ortak, ...devirSatiri(g.devir), giris: g.devir > 0 ? g.devir : 0, cikis: g.devir < 0 ? -g.devir : 0, bakiye, devirSatiri: true });
        for (const h of g.hareketler) {
            bakiye += (Number(h.giris) || 0) - (Number(h.cikis) || 0);
            satirlar.push({ ...g.ortak, ...h, bakiye });
        }
    }
    return satirlar;
}
const tlPara = async (pool) => {
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
export const KASA_SORGULARI = {
    /** Kasa defteri — para bazında kronolojik defter: devir + giriş / çıkış + yürüyen bakiye (KDV TL'ye) */
    async KASDEF1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const tl = await tlPara(pool);
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        // Para filtresi SQL'de uygulanmaz: döviz hareketinin KDV'si TL grubuna düşer, süzme nakit satırları üzerinden yapılır
        const f = filtreler(req, p, { vezne: "V" }) + idFiltre(req, p.hesapIdler, "H.HESAP_ID", "hs");
        const res = await req.query(`
      SELECT ${HAREKET_ALANLARI}, CASE WHEN CAST(H.TARIH AS date)<@bas THEN 1 ELSE 0 END onceki
      FROM ${HAREKET_JOIN}
      WHERE CAST(H.TARIH AS date)<=@bit ${f}
      ORDER BY H.TARIH, H.HESAP_HAREKETI_ID;`);
        const secili = new Set((p.paraIdler || []).filter(n => n > 0));
        const gruplar = new Map();
        for (const r of res.recordset) {
            for (const n of kasaNakitSatirlari({ ...r, paraId: Number(r.paraId), tip: Number(r.tip), meblag: Number(r.meblag), kdv: Number(r.kdv) }, tl)) {
                if (secili.size && !secili.has(n.paraId))
                    continue;
                if (!gruplar.has(n.paraId))
                    gruplar.set(n.paraId, { anahtar: n.paraKod, devir: 0, siraNo: n.kdvSatiri ? 0 : Number(r.siraNo), hareketler: [],
                        ortak: { paraKod: n.paraKod, grupBaslik: `Para birimi: ${n.paraKod}` } });
                const g = gruplar.get(n.paraId);
                if (r.onceki)
                    g.devir += n.giris - n.cikis;
                else
                    g.hareketler.push(n);
            }
        }
        const sirali = [...gruplar.values()].sort((a, b) => a.siraNo - b.siraNo || a.anahtar.localeCompare(b.anahtar));
        const satirlar = yuruyenBakiye(sirali, () => ({ tarih: p.baslangic, hesapKod: "", hesapAd: "", aciklama: `${tarihTr(p.baslangic)} öncesi devir`, vezneKod: "", kdv: 0, kaydeden: "" }));
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.hesapIdler, "hesap")}`, KDV_DIPNOT);
    },
    /** Kasa hareket listesi — hareket bazında; sıralama tarih / hesap / para (grup başlığı sıralamaya göre) */
    async KASHAR1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
            .input("tip", sql.Int, p.kasaTipi === 0 || p.kasaTipi === 1 ? p.kasaTipi : null);
        const f = filtreler(req, p, { vezne: "V", para: "H.PARA_ID" }) + idFiltre(req, p.hesapIdler, "H.HESAP_ID", "hs");
        const sira = p.siralama === "hesap" ? "K.KOD, H.TARIH" : p.siralama === "para" ? "ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH" : "CAST(H.TARIH AS date), H.TARIH";
        const res = await req.query(`
      SELECT ${HAREKET_ALANLARI}
      FROM ${HAREKET_JOIN}
      WHERE CAST(H.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR H.TIP=@tip) ${f}
      ORDER BY ${sira}, H.HESAP_HAREKETI_ID;`);
        const satirlar = res.recordset.map((r) => {
            const meblag = Number(r.meblag) || 0, giris = Number(r.tip) === 0;
            const grupBaslik = p.siralama === "hesap" ? `${r.hesapKod} — ${r.hesapAd}` : p.siralama === "para" ? `Para birimi: ${r.paraKod}` : tarihTr(new Date(r.tarih).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }));
            return { ...r, hesapBaslik: `${r.hesapKod} — ${r.hesapAd}`, tip: giris ? "Giriş" : "Çıkış", giris: giris ? meblag : 0, cikis: giris ? 0 : meblag,
                kdvOrani: Number(r.kdvOrani) || 0, kdv: Number(r.kdv) || 0, grupAnahtar: grupBaslik, grupBaslik };
        });
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}${adetOzeti(p.hesapIdler, "hesap")}${p.kasaTipi === 0 ? " · Giriş" : p.kasaTipi === 1 ? " · Çıkış" : ""}`, "Toplamlar farklı para birimlerini birlikte içerebilir; para bazında toplam için sıralamayı \"Para\" seçin. KDV tutarı TL'dir.");
    },
    /** Hesap ekstresi — hesap × para grubu, devir + yürüyen bakiye (Cari Ekstre kalıbı) */
    async HESEKS1(pool, p, t) {
        if (!p.hesapIdler?.length)
            throw ApiError.badRequest("En az bir hesap seçilmelidir.");
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        const f = filtreler(req, p, { para: "H.PARA_ID" }) + idFiltre(req, p.hesapIdler, "H.HESAP_ID", "hs");
        const res = await req.query(`
      SELECT ${HAREKET_ALANLARI}, CASE WHEN CAST(H.TARIH AS date)<@bas THEN 1 ELSE 0 END onceki
      FROM ${HAREKET_JOIN}
      WHERE CAST(H.TARIH AS date)<=@bit ${f}
      ORDER BY K.KOD, ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH, H.HESAP_HAREKETI_ID;`);
        const gruplar = new Map();
        for (const r of res.recordset) {
            const k = `${r.hesapKod}|${r.paraKod}`, meblag = Number(r.meblag) || 0, giris = Number(r.tip) === 0;
            if (!gruplar.has(k))
                gruplar.set(k, { anahtar: k, devir: 0, hareketler: [], ortak: { grupAnahtar: k, grupBaslik: `${r.hesapKod} — ${r.hesapAd} · ${r.paraKod}`, hesapKod: r.hesapKod, hesapAd: r.hesapAd, paraKod: r.paraKod } });
            const g = gruplar.get(k);
            if (r.onceki)
                g.devir += giris ? meblag : -meblag;
            else
                g.hareketler.push({ ...r, giris: giris ? meblag : 0, cikis: giris ? 0 : meblag, kdv: Number(r.kdv) || 0 });
        }
        const satirlar = yuruyenBakiye([...gruplar.values()], () => ({ tarih: p.baslangic, aciklama: `${tarihTr(p.baslangic)} öncesi devir`, vezneKod: "", kdv: 0, kaydeden: "" }));
        return sinirla(satirlar, t, `${aralikOzeti(p)}${adetOzeti(p.hesapIdler, "hesap")}${ozetEk(p)}`, "Her hesap ve para birimi ayrı gruplanır; ilk satır başlangıç tarihinden önceki devirdir. Bakiye = girişler − çıkışlar (KDV hariç; KDV TL kasasına ayrıca yansır).");
    },
    /** Hesap bakiye raporu — giriş/çıkış aralıkta, bakiye bitiş tarihi itibarıyla (Cari Bakiye kararıyla aynı); seçilen kurla TL */
    async HESBAK1(pool, p, t) {
        const bas = p.baslangic || p.tarih, bit = p.bitis || p.tarih;
        if (!bas || !bit)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
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
        const satirlar = res.recordset.map((r) => {
            const id = Number(r.paraId), b = Number(r.bakiye) || 0, k = kur.kurlar.get(id) ?? 0, ks = kur.satisKurlari.get(id) ?? 0;
            return { ...r, giris: Number(r.giris), cikis: Number(r.cikis), bakiye: b, kur: k, tlKarsiligi: b * k, kurSatis: ks, tlSatis: b * ks, hesapBaslik: `${r.hesapKod} — ${r.hesapAd}` };
        });
        return sinirla(satirlar, t, `${tarihTr(bas)} – ${tarihTr(bit)}${adetOzeti(p.hesapIdler, "hesap") || " · Tüm hesaplar"}${ozetEk(p)} · ${kur.aciklama}`, `Giriş ve çıkış seçilen tarih aralığındaki hareketlerin toplamıdır; bakiye bitiş tarihi itibarıyla tüm hareketlerden hesaplanır (girişler − çıkışlar, KDV hariç). Hareketi olmayan hesaplar da listelenir. ${kur.aciklama}.`);
    },
};
