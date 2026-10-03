import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import { TL_PARA_SQL, adetOzeti, aralikOzeti, filtreler, idFiltre, kurCoz, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";
import { ISCILIK_KAYDI, VEZNE_HAREKET_KOLONLARI, belgeTablolari, vezneHareketleriSql } from "../kaynak.js";
/** Kasadan geçen nakit satırları: meblağ kendi parasında; KDV > 0 ise ayrı TL satırı (eski VODVZR_KASA_HAREKET_LISTESI gibi, TL hareketinde de ayrı). Saf fonksiyon. */
export function kasaNakitSatirlari(h, tl) {
    const yon = (tutar) => ({ giris: h.tip === 0 ? tutar : 0, cikis: h.tip === 1 ? tutar : 0 });
    const kdv = Number(h.kdv) || 0, meblag = Number(h.meblag) || 0;
    const ana = { ...h, ...yon(meblag), kdv, kdvSatiri: false };
    if (kdv <= 0)
        return [ana];
    return [ana, { ...h, paraId: tl.id, paraKod: tl.kod, meblag: kdv, ...yon(kdv), kdv: 0, aciklama: `KDV — ${h.aciklama}`.trim(), kdvSatiri: true }];
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
    const r = await pool.request().query(`SELECT P.PARA_ID id, RTRIM(P.KOD) kod, ISNULL(P.SIRA_NO,0) siraNo FROM dbo.TODVZ_PARA P WHERE P.PARA_ID=${TL_PARA_SQL}`);
    return { id: Number(r.recordset[0]?.id || 1), kod: String(r.recordset[0]?.kod || "TL").trim(), siraNo: Number(r.recordset[0]?.siraNo || 0) };
};
const paraSecimi = (p) => new Set((p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0));
const HAREKET_ALANLARI = `H.HESAP_HAREKETI_ID hareketId, H.TARIH tarih, H.HESAP_ID hesapId, RTRIM(ISNULL(K.KOD,'')) hesapKod, RTRIM(ISNULL(K.AD,'')) hesapAd,
  RTRIM(ISNULL(H.ACIKLAMA,'')) aciklama, H.PARA_ID paraId, RTRIM(ISNULL(P.KOD,'')) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(H.MEBLAG,0) meblag,
  ISNULL(H.KDV_ORANI,0) kdvOrani, ISNULL(H.KDV,0) kdv, H.TIP tip, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(U.AD,'')) kaydeden`;
const HAREKET_JOIN = `dbo.TODVZ_HESAP_HAREKETI H
  LEFT JOIN dbo.TODVZ_HESAP K ON K.HESAP_ID=H.HESAP_ID LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=H.PARA_ID
  LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.VEZNE_ID LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=H.EKLEYEN_ID`;
export const KASA_SORGULARI = {
    /**
     * Kasa defteri — eski "KASA DEFTERİ" (SODVZCR_KASA_DEFTERI) kapsamı: para bazında devir + gün gün döviz fişleri (fiş tipine göre toplu, "Seri : ilk - son"),
     * fişlerin komisyon / BSMV / KMV'si (TL, ayrı satır, giriş), nakit cari hareketler ve kasa hesap hareketleri (KDV ayrı TL satırı); yürüyen bakiye.
     * TL'de fişler satır tutarıyla yazılır (eski yordam gibi); bankadan ödenen fişin TL'si ve bankaya giden satırın dövizi kasaya girmez.
     * Sarraf fişi, perakende fişi ve ürün tanımı (eski raporda yoktu; kullanıcı kararı 01.10.2026) kendi ibareleriyle ("Sarraf fişi", "Perakende fişi", "Ürün tanımı")
     * gün ve fiş tipine göre toplu girer: ürün satırları ve vezneden yapılan ödemeler kendi paralarında (vezne hareketiyle aynı kural). Fişlerin işçilik kayıtları nakit olmadığından (ISCILIK_KAYDI) girmez. Vezne transferleri firma içi
     * olduğundan, dekontlar eski raporda olmadığından kapsam dışıdır. Hesap seçilirse yalnızca o hesapların hareketleri.
     */
    async KASDEF1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const tl = await tlPara(pool);
        const istek = () => pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        const satirlarHam = [];
        // 1) Kasa hesap hareketleri (+ KDV TL satırı)
        {
            const req = istek();
            const f = filtreler(req, p, { vezne: "V" }) + idFiltre(req, p.hesapIdler, "H.HESAP_ID", "hs");
            const res = await req.query(`SELECT ${HAREKET_ALANLARI}, CASE WHEN CAST(H.TARIH AS date)<@bas THEN 1 ELSE 0 END onceki
        FROM ${HAREKET_JOIN} WHERE CAST(H.TARIH AS date)<=@bit AND NOT ${ISCILIK_KAYDI("H")} ${f} ORDER BY H.TARIH, H.HESAP_HAREKETI_ID;`);
            for (const r of res.recordset)
                for (const n of kasaNakitSatirlari({ ...r, paraId: Number(r.paraId), tip: Number(r.tip), meblag: Number(r.meblag), kdv: Number(r.kdv) }, tl))
                    satirlarHam.push({ ...n, sira: 9, siraNo: n.kdvSatiri ? tl.siraNo : Number(r.siraNo) });
        }
        if (!p.hesapIdler?.length) {
            // 2) Döviz fişleri: dövizde fiş tipine göre miktar; TL'de satış / alış tutarı + komisyon, BSMV, KMV (gün × fiş tipi toplu)
            {
                const req = istek();
                const f = filtreler(req, p, { vezne: "V" });
                const res = await req.query(`
          SELECT CAST(F.TARIH AS date) gun, F.TIP tip, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, SUM(S.MIKTAR) miktar,
            MIN(RTRIM(ISNULL(F.SERI_NO,''))) ilkSeri, MAX(RTRIM(ISNULL(F.SERI_NO,''))) sonSeri, CASE WHEN CAST(F.TARIH AS date)<@bas THEN 1 ELSE 0 END onceki
          FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
          WHERE ISNULL(F.IPTAL,0)=0 AND S.BANKA_HESABI_ID IS NULL AND CAST(F.TARIH AS date)<=@bit ${f}
          GROUP BY CAST(F.TARIH AS date), F.TIP, S.PARA_ID, P.KOD, P.SIRA_NO;
          SELECT CAST(F.TARIH AS date) gun, F.TIP tip, SUM(S.TUTAR) tutar, SUM(S.KOMISYON) komisyon, SUM(S.BMV) bmv, SUM(S.KMV) kmv,
            MIN(RTRIM(ISNULL(F.SERI_NO,''))) ilkSeri, MAX(RTRIM(ISNULL(F.SERI_NO,''))) sonSeri, CASE WHEN CAST(F.TARIH AS date)<@bas THEN 1 ELSE 0 END onceki
          FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
          WHERE ISNULL(F.IPTAL,0)=0 AND F.BANKA_HESABI_ID IS NULL AND CAST(F.TARIH AS date)<=@bit ${f}
          GROUP BY CAST(F.TARIH AS date), F.TIP;`);
                const [doviz, tlFis] = res.recordsets;
                const seri = (r) => `Seri : ${r.ilkSeri} - ${r.sonSeri}`;
                for (const r of doviz) {
                    const m = Number(r.miktar) || 0, alis = Number(r.tip) === 0;
                    satirlarHam.push({ paraId: Number(r.paraId), paraKod: r.paraKod, siraNo: Number(r.siraNo), tarih: r.gun, hesapKod: "Fişler", hesapAd: alis ? "Alış" : "Satış", aciklama: seri(r),
                        giris: alis ? m : 0, cikis: alis ? 0 : m, kdv: 0, vezneKod: "", kaydeden: "", onceki: r.onceki, sira: alis ? 2 : 1 });
                }
                const tlSatir = (r, hesapKod, hesapAd, aciklama, giris, cikis, sira) => satirlarHam.push({ paraId: tl.id, paraKod: tl.kod, siraNo: tl.siraNo, tarih: r.gun, hesapKod, hesapAd, aciklama, giris, cikis, kdv: 0, vezneKod: "", kaydeden: "", onceki: r.onceki, sira });
                const gunluk = new Map();
                for (const r of tlFis) {
                    const alis = Number(r.tip) === 0, tutar = Number(r.tutar) || 0;
                    tlSatir(r, "Fişler", alis ? "Alış" : "Satış", seri(r), alis ? 0 : tutar, alis ? tutar : 0, alis ? 2 : 1);
                    const k = new Date(r.gun).toISOString().slice(0, 10), g = gunluk.get(k) || { gun: r.gun, onceki: r.onceki, komisyon: 0, bmv: 0, kmv: 0 };
                    g.komisyon += Number(r.komisyon) || 0;
                    g.bmv += Number(r.bmv) || 0;
                    g.kmv += Number(r.kmv) || 0;
                    gunluk.set(k, g);
                }
                for (const g of gunluk.values()) {
                    if (g.komisyon)
                        tlSatir(g, "Komisyon", "", "Tüm fişler", g.komisyon, 0, 3);
                    if (g.bmv)
                        tlSatir(g, "B.M.V.", "", "Tüm fişler", g.bmv, 0, 4);
                    if (g.kmv)
                        tlSatir(g, "K.M.V.", "", "Tüm fişler", g.kmv, 0, 5);
                }
            }
            // 3) Nakit cari hareketler (alacak giriş, borç çıkış)
            {
                const req = istek();
                const f = filtreler(req, p, { vezne: "V" });
                const res = await req.query(`
          SELECT CH.TARIH tarih, CH.TIP tip, CS.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, CS.MEBLAG meblag, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd,
            RTRIM(ISNULL(CH.ACIKLAMA,'')) aciklama, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(U.AD,'')) kaydeden, CASE WHEN CAST(CH.TARIH AS date)<@bas THEN 1 ELSE 0 END onceki
          FROM dbo.TODVZ_CARI_HAREKET CH JOIN dbo.TODVZ_CARI_HAREKET_SATIRI CS ON CS.CARI_HAREKET_ID=CH.CARI_HAREKET_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CS.PARA_ID
            LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=CH.CARI_KART_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=CH.VEZNE_ID LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=CH.EKLEYEN_ID
          WHERE CH.HAREKET_TIPI=0 AND CAST(CH.TARIH AS date)<=@bit ${f}
          ORDER BY CH.TARIH, CH.CARI_HAREKET_ID, CS.SATIR_NO;`);
                for (const r of res.recordset) {
                    const m = Number(r.meblag) || 0, alacak = Number(r.tip) === 1;
                    satirlarHam.push({ ...r, paraId: Number(r.paraId), siraNo: Number(r.siraNo), hesapKod: "Cari", hesapAd: r.cariKod, aciklama: [r.cariAd, r.aciklama].filter(Boolean).join(" / "),
                        giris: alacak ? m : 0, cikis: alacak ? 0 : m, kdv: 0, sira: 8 });
                }
            }
            // 4) Sarraf fişi, perakende fişi ve ürün tanımı — kendi ibareleriyle gün × belge × fiş tipi × para toplu (vezne hareketiyle aynı kural; kullanıcı kararı 01.10.2026)
            {
                const d = await belgeTablolari(pool);
                if (d.sarraf || d.perakende || d.altinUrun || d.ozelUrun || d.duzeltme) {
                    const req = istek();
                    const f = filtreler(req, p, { vezne: "V" });
                    const res = await req.query(`
            ;WITH X (${VEZNE_HAREKET_KOLONLARI}) AS (${vezneHareketleriSql(d)})
            SELECT CAST(X.tarih AS date) gun, X.belgeTipi, X.fisTip tip, X.paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, SUM(X.giris) giris, SUM(X.cikis) cikis,
              MIN(X.aciklama) ilkSeri, MAX(X.aciklama) sonSeri, COUNT(DISTINCT X.belgeId) adet, CASE WHEN CAST(X.tarih AS date)<@bas THEN 1 ELSE 0 END onceki
            FROM X JOIN dbo.TODVZ_PARA P ON P.PARA_ID=X.paraId LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=X.vezneId
            WHERE X.belgeTipi IN (5,6,7,8) AND CAST(X.tarih AS date)<=@bit ${f}
            GROUP BY CAST(X.tarih AS date), X.belgeTipi, X.fisTip, X.paraId, P.KOD, P.SIRA_NO;`);
                    const AD = { 5: "Sarraf fişi", 6: "Perakende fişi", 7: "Ürün tanımı", 8: "Bakiye düzeltme" };
                    for (const r of res.recordset) {
                        const bt = Number(r.belgeTipi), alis = Number(r.tip) === 0;
                        satirlarHam.push({ paraId: Number(r.paraId), paraKod: r.paraKod, siraNo: Number(r.siraNo), tarih: r.gun, hesapKod: AD[bt], hesapAd: bt >= 7 ? "" : alis ? "Alış" : "Satış",
                            aciklama: bt === 8 ? (Number(r.adet) === 1 ? r.ilkSeri : `${r.adet} düzeltme`) : bt === 7 ? `${r.adet} ürün` : `Seri : ${r.ilkSeri} - ${r.sonSeri}`,
                            giris: Number(r.giris) || 0, cikis: Number(r.cikis) || 0, kdv: 0, vezneKod: "", kaydeden: "",
                            onceki: r.onceki, sira: bt === 8 ? 7.6 : bt === 7 ? 7.5 : bt === 6 ? (alis ? 7.2 : 7.1) : (alis ? 7 : 6) });
                    }
                }
            }
        }
        const secili = paraSecimi(p);
        const paraAdlari = new Map((await pool.request().query(`SELECT PARA_ID id, RTRIM(ISNULL(AD,'')) ad FROM dbo.TODVZ_PARA`)).recordset.map((x) => [Number(x.id), String(x.ad || "")]));
        const gruplar = new Map();
        const gun = (v) => new Date(v).getTime();
        for (const n of satirlarHam.sort((a, b) => gun(a.tarih) - gun(b.tarih) || a.sira - b.sira)) {
            if (secili.size && !secili.has(n.paraId))
                continue;
            if (!gruplar.has(n.paraId))
                gruplar.set(n.paraId, { anahtar: n.paraKod, devir: 0, siraNo: n.siraNo, hareketler: [],
                    ortak: { paraKod: n.paraKod, grupBaslik: `Para birimi: ${n.paraKod}${paraAdlari.get(n.paraId) ? ` — ${paraAdlari.get(n.paraId)}` : ""}` } });
            const g = gruplar.get(n.paraId);
            if (n.onceki)
                g.devir += (Number(n.giris) || 0) - (Number(n.cikis) || 0);
            else {
                const { onceki, sira, siraNo, ...h } = n;
                g.hareketler.push(h);
            }
        }
        const sirali = [...gruplar.values()].sort((a, b) => a.siraNo - b.siraNo || a.anahtar.localeCompare(b.anahtar));
        const satirlar = yuruyenBakiye(sirali, () => ({ tarih: p.baslangic, hesapKod: "Devir", hesapAd: "", aciklama: `${tarihTr(p.baslangic)} öncesi devir`, vezneKod: "", kdv: 0, kaydeden: "" }));
        // Eski "KASA DEFTERİ" kapanışı: "Devreden" dengeleme tutarı eksik kalan tarafa yazılır (@DevredenGiris / @DevredenCikis), iki kolon eşitlenmiş toplamı gösterir (@Toplam)
        const kapanis = sirali.map(g => {
            const gr = satirlar.filter(x => x.paraKod === g.ortak.paraKod);
            const giris = gr.reduce((a, x) => a + (Number(x.giris) || 0), 0), cikis = gr.reduce((a, x) => a + (Number(x.cikis) || 0), 0);
            return { paraKod: g.ortak.paraKod, giris, cikis, devredenGiris: giris > cikis ? 0 : cikis - giris, devredenCikis: cikis > giris ? 0 : giris - cikis, toplam: Math.max(giris, cikis) };
        });
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.hesapIdler, "hesap")}`, "Seçilen aralıkta kasa defteri hareketi yok. Kasa defteri döviz, sarraf ve perakende fişlerini, ürün tanımlarını (gün ve fiş tipine göre toplu; komisyon, BSMV ve KMV ayrı satır), nakit cari hareketleri ve kasa hesap hareketlerini (KDV ayrı TL satırı) kapsar.", kapanis);
    },
    /** Kasa hareket listesi — hareket bazında; KDV ayrı TL satırı (eski VODVZR_KASA_HAREKET_LISTESI gibi); sıralama tarih / hesap / para (grup başlığı sıralamaya göre) */
    async KASHAR1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const tl = await tlPara(pool);
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
            .input("tip", sql.Int, p.kasaTipi === 0 || p.kasaTipi === 1 ? p.kasaTipi : null);
        // Para süzgeci SQL'de uygulanmaz: döviz hareketinin KDV satırı TL'dir, süzme satırlar üzerinden yapılır
        const f = filtreler(req, p, { vezne: "V" }) + idFiltre(req, p.hesapIdler, "H.HESAP_ID", "hs");
        const sira = p.siralama === "hesap" ? "K.KOD, H.TARIH" : "CAST(H.TARIH AS date), H.TARIH";
        const res = await req.query(`
      SELECT ${HAREKET_ALANLARI}
      FROM ${HAREKET_JOIN}
      WHERE CAST(H.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR H.TIP=@tip) ${f}
      ORDER BY ${sira}, H.HESAP_HAREKETI_ID;`);
        const secili = paraSecimi(p);
        let ham = res.recordset.flatMap((r) => kasaNakitSatirlari({ ...r, paraId: Number(r.paraId), tip: Number(r.tip), meblag: Number(r.meblag), kdv: Number(r.kdv) }, tl)
            .map(n => ({ ...n, siraNo: n.kdvSatiri ? tl.siraNo : Number(r.siraNo) }))).filter((n) => !secili.size || secili.has(n.paraId));
        if (p.siralama === "para")
            ham = ham.map((x, i) => ({ ...x, _i: i })).sort((a, b) => a.siraNo - b.siraNo || a.paraKod.localeCompare(b.paraKod) || a._i - b._i);
        const satirlar = ham.map((r) => {
            const meblag = Number(r.meblag) || 0, giris = Number(r.tip) === 0;
            const grupBaslik = p.siralama === "hesap" ? `${r.hesapKod} — ${r.hesapAd}` : p.siralama === "para" ? `Para birimi: ${r.paraKod}` : tarihTr(new Date(r.tarih).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }));
            // Eski "KASA HAREKET LİSTESİ": tek Meblağ + harf (TIP 0 → "B", diğer → "A"); @Meblag işaretli (TIP 0 +, diğer −) → net toplamların temeli
            return { ...r, hesapBaslik: `${r.hesapKod} — ${r.hesapAd}`, tip: giris ? "Giriş" : "Çıkış", giris: giris ? meblag : 0, cikis: giris ? 0 : meblag, meblag, ba: giris ? "B" : "A", net: giris ? meblag : -meblag,
                kdvOrani: r.kdvSatiri ? 0 : Number(r.kdvOrani) || 0, kdv: Number(r.kdv) || 0, grupAnahtar: grupBaslik, grupBaslik };
        });
        // Net toplam = |Σ(giriş − çıkış)| + B/A (eski @GenelToplam / @GenelHesapTipi) — para birimleri karışmasın diye para başına
        const nt = new Map();
        for (const x of satirlar) {
            const o = nt.get(x.paraKod) || { paraKod: x.paraKod, giris: 0, cikis: 0 };
            o.giris += x.giris;
            o.cikis += x.cikis;
            nt.set(x.paraKod, o);
        }
        const netToplamlar = [...nt.values()].map(o => { const n = o.giris - o.cikis; return { ...o, netToplam: Math.abs(n), netTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; });
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}${adetOzeti(p.hesapIdler, "hesap")}${p.kasaTipi === 0 ? " · Giriş" : p.kasaTipi === 1 ? " · Çıkış" : ""}`, "Toplamlar farklı para birimlerini birlikte içerebilir; para bazında toplam için sıralamayı \"Para\" seçin. Net = giriş − çıkış; B/A: giriş B, çıkış A. KDV tutarı TL'dir.", netToplamlar);
    },
    /** Hesap ekstresi — hesap × para grubu, devir + yürüyen bakiye (Cari Ekstre kalıbı); KDV hesabın TL grubunda ayrı satır (eski hesap ekstresi gibi) */
    async HESEKS1(pool, p, t) {
        if (!p.hesapIdler?.length)
            throw ApiError.badRequest("En az bir hesap seçilmelidir.");
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const tl = await tlPara(pool);
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        const f = idFiltre(req, p.hesapIdler, "H.HESAP_ID", "hs");
        const res = await req.query(`
      SELECT ${HAREKET_ALANLARI}, CASE WHEN CAST(H.TARIH AS date)<@bas THEN 1 ELSE 0 END onceki
      FROM ${HAREKET_JOIN}
      WHERE CAST(H.TARIH AS date)<=@bit ${f}
      ORDER BY K.KOD, H.TARIH, H.HESAP_HAREKETI_ID;`);
        const secili = paraSecimi(p);
        // Eski "HESAP EKSTRE" raporuyla aynı metrikler: Borç = çıkış (TIP 1), Alacak = giriş (TIP 0), bakiye = Borç − Alacak → mutlak değer + B/A.
        // Devir brüt tutulur (dönem öncesi borç ve alacak ayrı): eski raporda ara toplam dönem öncesi hareketleri de böyle içerir.
        const gruplar = new Map();
        for (const r of res.recordset)
            for (const n of kasaNakitSatirlari({ ...r, paraId: Number(r.paraId), tip: Number(r.tip), meblag: Number(r.meblag), kdv: Number(r.kdv) }, tl)) {
                if (secili.size && !secili.has(n.paraId))
                    continue;
                const k = `${n.hesapKod}|${n.paraKod}`, meblag = Number(n.meblag) || 0, giris = Number(n.tip) === 0;
                if (!gruplar.has(k))
                    gruplar.set(k, { devirBorc: 0, devirAlacak: 0, siraNo: n.kdvSatiri ? tl.siraNo : Number(r.siraNo), hareketler: [],
                        ortak: { grupAnahtar: k, grupBaslik: `${n.hesapKod} — ${n.hesapAd} · ${n.paraKod}`, hesapKod: n.hesapKod, hesapAd: n.hesapAd, paraKod: n.paraKod } });
                const g = gruplar.get(k);
                if (r.onceki) {
                    if (giris)
                        g.devirAlacak += meblag;
                    else
                        g.devirBorc += meblag;
                }
                else
                    g.hareketler.push({ ...n, borc: giris ? 0 : meblag, alacak: giris ? meblag : 0, kdv: n.kdvSatiri ? 0 : Number(n.kdv) || 0 });
            }
        const bakiyeAlanlari = (b) => ({ bakiye: Math.abs(b), bakiyeTipi: b > 0 ? "B" : b < 0 ? "A" : "" });
        const satirlar = [], kapanis = [];
        for (const g of [...gruplar.values()].sort((a, b) => a.ortak.hesapKod.localeCompare(b.ortak.hesapKod) || a.siraNo - b.siraNo || a.ortak.paraKod.localeCompare(b.ortak.paraKod))) {
            let bakiye = g.devirBorc - g.devirAlacak, borc = g.devirBorc, alacak = g.devirAlacak;
            satirlar.push({ ...g.ortak, tarih: p.baslangic, aciklama: `${tarihTr(p.baslangic)} öncesi devir`, vezneKod: "", kdv: 0, kaydeden: "", devirSatiri: true,
                borc: g.devirBorc, alacak: g.devirAlacak, giris: g.devirAlacak, cikis: g.devirBorc, ...bakiyeAlanlari(bakiye) });
            for (const h of g.hareketler) {
                bakiye += h.borc - h.alacak;
                borc += h.borc;
                alacak += h.alacak;
                satirlar.push({ ...g.ortak, ...h, giris: h.alacak, cikis: h.borc, ...bakiyeAlanlari(bakiye) });
            }
            kapanis.push({ hesap: `${g.ortak.hesapKod} — ${g.ortak.hesapAd}`, paraKod: g.ortak.paraKod, borc, alacak, ...bakiyeAlanlari(bakiye) });
        }
        return sinirla(satirlar, t, `${aralikOzeti(p)}${adetOzeti(p.hesapIdler, "hesap")}${ozetEk(p)}`, "Her hesap ve para birimi ayrı gruplanır. Borç = kasadan çıkış, Alacak = kasaya giriş; bakiye = Borç − Alacak (B: borç bakiyesi, A: alacak bakiyesi). İlk satır başlangıç tarihinden önceki hareketlerin borç ve alacak toplamıdır ve ara toplama dahildir. KDV hesabın TL grubunda ayrı satırdır.", kapanis);
    },
    /**
     * Hesap bakiye raporu — giriş/çıkış aralıkta, bakiye bitiş tarihi itibarıyla (Cari Bakiye kararıyla aynı); seçilen kurla TL.
     * Eski VODVZR_HESAP_BAKIYE_RAPORU gibi hesap bakiyeleri KDV hariçtir; KDV'ler "KDV" adlı ayrı satırda (TL) toplanır (hesap seçilmemişse).
     */
    async HESBAK1(pool, p, t) {
        const bas = p.baslangic || p.tarih, bit = p.bitis || p.tarih;
        if (!bas || !bit)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const kur = await kurCoz(pool, { ...p, kurTarihi: p.kurTarihi || bit });
        const tl = await tlPara(pool), secili = paraSecimi(p);
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
        const ham = [...res.recordset];
        if (!p.hesapIdler?.length && (!secili.size || secili.has(tl.id))) {
            const k = (await pool.request().input("bas", sql.Date, bas).input("bit", sql.Date, bit).query(`
        SELECT SUM(CASE WHEN H.TIP=0 AND CAST(H.TARIH AS date)>=@bas THEN H.KDV ELSE 0 END) giris, SUM(CASE WHEN H.TIP=1 AND CAST(H.TARIH AS date)>=@bas THEN H.KDV ELSE 0 END) cikis,
          SUM(CASE WHEN H.TIP=0 THEN H.KDV ELSE -H.KDV END) bakiye, COUNT(*) adet
        FROM dbo.TODVZ_HESAP_HAREKETI H WHERE ISNULL(H.KDV,0)<>0 AND CAST(H.TARIH AS date)<=@bit`)).recordset[0];
            if (Number(k?.adet))
                ham.push({ hesapId: 0, hesapKod: "KDV", hesapAd: "KDV", paraId: tl.id, paraKod: tl.kod, giris: k.giris, cikis: k.cikis, bakiye: k.bakiye });
        }
        const satirlar = ham.map((r) => {
            const id = Number(r.paraId), b = Number(r.bakiye) || 0, k = kur.kurlar.get(id) ?? 0, ks = kur.satisKurlari.get(id) ?? 0;
            // Eski "HESAP BAKİYE RAPORU": BAKIYE (= giriş − çıkış, canlıda doğrulandı 19.09.2026) < 0 → Borç bakiye, > 0 → Alacak bakiye
            return { ...r, giris: Number(r.giris) || 0, cikis: Number(r.cikis) || 0, bakiye: b, borcBakiye: b < 0 ? -b : 0, alacakBakiye: b > 0 ? b : 0, kur: k, tlKarsiligi: b * k, kurSatis: ks, tlSatis: b * ks, hesapBaslik: `${r.hesapKod} — ${r.hesapAd}` };
        });
        // Para bazında "Toplam :" ve net "Bakiye :" (B/A) — eski rapordaki grup altlıklarının karşılığı
        const pt = new Map();
        for (const x of satirlar) {
            if (!x.paraId)
                continue;
            const o = pt.get(x.paraKod) || { paraKod: x.paraKod, borcBakiye: 0, alacakBakiye: 0 };
            o.borcBakiye += x.borcBakiye;
            o.alacakBakiye += x.alacakBakiye;
            pt.set(x.paraKod, o);
        }
        const paraToplamlari = [...pt.values()].map(o => { const n = o.borcBakiye - o.alacakBakiye; return { ...o, netBakiye: Math.abs(n), bakiyeTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; });
        return sinirla(satirlar, t, `${tarihTr(bas)} – ${tarihTr(bit)}${adetOzeti(p.hesapIdler, "hesap") || " · Tüm hesaplar"}${ozetEk(p)} · ${kur.aciklama}`, `Giriş ve çıkış seçilen tarih aralığındaki hareketlerin toplamıdır; bakiye bitiş tarihi itibarıyla tüm hareketlerden hesaplanır (girişler − çıkışlar, KDV hariç; KDV'ler "KDV" satırında). Borç bakiye = bakiyenin negatif (çıkış fazlası), Alacak bakiye = pozitif (giriş fazlası) olduğu tutardır. Hareketi olmayan hesaplar da listelenir. ${kur.aciklama}.`, paraToplamlari);
    },
};
