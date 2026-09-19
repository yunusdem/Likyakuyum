import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import { FIS_USD_KURU_SQL, adetOzeti, aralikOzeti, filtreler, idFiltre, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";
const tipAdi = (k) => (Number(k) === 1 ? "Satış" : "Alış");
const tipOzeti = (p) => (p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : "");
const tipGirdisi = (req, p) => req.input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
const SATIR_JOIN = `dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
  LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_ISTATISTIK I ON I.ISTATISTIK_ID=F.ISTATISTIK_ID`;
/** Para (× tip) bazında özet: adet = farklı fiş sayısı, ortalama kur = tutar / miktar. Saf fonksiyon — testte kullanılır. */
export function paraOzeti(satirlar) {
    const m = new Map();
    for (const s of satirlar) {
        const k = `${s.paraKod}|${s.tip}`;
        if (!m.has(k))
            m.set(k, { paraKod: s.paraKod, tip: s.tip, fisler: new Set(), miktar: 0, tutar: 0, komisyon: 0, bmv: 0, kmv: 0, kdv: 0 });
        const o = m.get(k);
        o.fisler.add(s.fisId);
        o.miktar += Number(s.miktar) || 0;
        o.tutar += Number(s.tutar) || 0;
        o.komisyon += Number(s.komisyon) || 0;
        o.bmv += Number(s.bmv) || 0;
        o.kmv += Number(s.kmv) || 0;
        o.kdv += Number(s.kdv) || 0;
    }
    return [...m.values()].map(({ fisler, ...o }) => ({ ...o, adet: fisler.size, ortKur: o.miktar ? o.tutar / o.miktar : 0 }));
}
export const FIS_SORGULARI = {
    /**
     * Fiş listeleme — eski "ALIŞ / SATIŞ FİŞİ LİSTELEME" metrikleri: satır = fiş satırı (tarih, para, vezne, seri no, belge no, miktar, kur, KMV, lira), gün bazında gruplu
     * ve ara toplamlı; rapor sonunda fiş / satır sayısı ve para bazında toplam. Fiş düzeyindeki tutarlar (toplam tutar, ödeme tutarı) yalnızca fişin ilk satırında
     * taşınır ki toplamlar iki kez sayılmasın (ekran / Excel kolonları). Para seçilirse yalnızca o paranın satırları listelenir (eski rapordaki gibi).
     */
    async FISLIS1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis), p);
        const f = filtreler(req, p, { cari: "C", vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
        const cariSecili = !!(p.cariIdler?.length || p.cariSonId || p.cariKartId);
        const res = await req.query(`
      SELECT F.FIS_ID fisId, S.SATIR_NO satirNo, ISNULL(F.ZAMAN,F.TARIH) zaman, CAST(F.TARIH AS date) gun, F.TIP tipKod, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo,
        RTRIM(ISNULL(F.UNVAN,'')) unvan, RTRIM(ISNULL(F.VERGI_KIMLIK_NO,'')) kimlikNo, RTRIM(ISNULL(C.KOD,'')) cariKod,
        RTRIM(ISNULL(I.KOD,'')) istatistikKod, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KDV,0) kdv,
        ISNULL(F.TOPLAM_TUTAR,0) toplamTutar, ISNULL(F.ODEME_TUTARI,0) odemeTutari
      FROM ${SATIR_JOIN} ${cariSecili ? "JOIN" : "LEFT JOIN"} dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=F.CARI_KART_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY CAST(F.TARIH AS date), ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
        const gorulen = new Set();
        const satirlar = res.recordset.map((r) => {
            const ilk = !gorulen.has(Number(r.fisId));
            gorulen.add(Number(r.fisId));
            return { ...r, tip: tipAdi(r.tipKod), miktar: Number(r.miktar), kur: Number(r.kur), tutar: Number(r.tutar), komisyon: Number(r.komisyon), bmv: Number(r.bmv), kmv: Number(r.kmv), kdv: Number(r.kdv),
                toplamTutar: ilk ? Number(r.toplamTutar) : 0, odemeTutari: ilk ? Number(r.odemeTutari) : 0, gunBaslik: tarihTr(new Date(r.gun).toISOString().slice(0, 10)) };
        });
        // Rapor sonu: para × tip bazında miktar / tutar / vergiler + fiş adedi (eski "GENEL TOPLAM" ve "Fiş sayısı" karşılığı; eski rapor satır sayar — ikisi de verilir)
        const ozet = paraOzeti(satirlar.map((x) => ({ fisId: x.fisId, paraKod: x.paraKod, tip: x.tip, miktar: x.miktar, tutar: x.tutar, komisyon: x.komisyon, bmv: x.bmv, kmv: x.kmv, kdv: x.kdv })))
            .map(o => ({ ...o, satirAdedi: satirlar.filter((x) => x.paraKod === o.paraKod && x.tip === o.tip).length }));
        return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.istatistikIdler, "istatistik")} · ${gorulen.size} fiş, ${satirlar.length} satır`, "Her satır bir fiş satırıdır; gün bazında gruplanır. Lira = satır tutarı. Toplam tutar ve ödeme tutarı fişin ilk satırında gösterilir. Para seçilirse yalnızca o paranın satırları listelenir. İptal fişler hariçtir.", ozet);
    },
    /** Günlük fiş detay — seçilen günün fiş satırları; sonda para bazında GENEL TOPLAM özeti */
    async GUNFIS1(pool, p, t) {
        if (!p.tarih)
            throw ApiError.badRequest("Tarih zorunludur.");
        const req = tipGirdisi(pool.request().input("t", sql.Date, p.tarih), p);
        const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
        const res = await req.query(`
      SELECT F.FIS_ID fisId, ISNULL(F.ZAMAN,F.TARIH) zaman, F.TIP tipKod, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, RTRIM(P.KOD) paraKod, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar,
        ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KDV,0) kdv
      FROM ${SATIR_JOIN}
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)=@t AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY V.KOD, F.TIP, ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
        const satirlar = res.recordset.map((r) => ({ ...r, tip: tipAdi(r.tipKod), miktar: Number(r.miktar), kur: Number(r.kur), tutar: Number(r.tutar), komisyon: Number(r.komisyon),
            bmv: Number(r.bmv), kmv: Number(r.kmv), kdv: Number(r.kdv), grupAnahtar: `${r.vezneKod}|${r.tipKod}`, grupBaslik: `${r.vezneKod} — ${r.vezneAd} · ${tipAdi(r.tipKod)}` }));
        return sinirla(satirlar, t, `${tarihTr(p.tarih)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}`, "Vezne ve fiş tipine göre gruplanır; ara toplamlar farklı paraların TL tutarlarını toplar, miktar toplamı için sondaki para bazındaki özet kullanılır. İptal fişler hariçtir.", paraOzeti(satirlar));
    },
    /**
     * İstatistik raporu — eski "İSTATİSTİK DETAY / TOPLAM RAPORU" metrikleri. Rapor tipi (`birlestir`):
     * "toplam" istatistik × para satırı: Giriş (alış) miktar / TL / fiş ve Çıkış (satış) miktar / TL / fiş yan yana (eski @GirisMiktar, @GirisTutar, @CikisMiktar, @CikisTutar);
     * "detay" (varsayılan) fiş satırı: para, tarih, tip (A / S), seri no, belge no, miktar, kur, lira. Her ikisinde istatistik koduna göre grup + ara toplam;
     * rapor sonunda para bazında giriş / çıkış özeti ve fiş sayıları (eski rapor sonu alt raporu). Fiş adedi farklı fiş sayısıdır; eski rapor satır saydığı için satır adedi de verilir.
     */
    async ISTRAP1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const detay = p.birlestir !== "toplam"; // varsayılan: Detaylı (eski rapordaki ilk seçenek)
        const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis), p);
        const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
        const res = await req.query(`
      SELECT F.FIS_ID fisId, ISNULL(F.ISTATISTIK_ID,0) istatistikId, RTRIM(ISNULL(I.KOD,'')) istatistikKod, RTRIM(ISNULL(I.ACIKLAMA,'')) istatistikAd, F.TIP tipKod, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        ISNULL(F.ZAMAN,F.TARIH) zaman, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KDV,0) kdv
      FROM ${SATIR_JOIN}
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY I.KOD, ISNULL(P.SIRA_NO,99), P.KOD, CAST(F.TARIH AS date), F.SERI_NO, F.FIS_ID, S.SATIR_NO;`);
        const ham = res.recordset.map((r) => ({ ...r, giris: Number(r.tipKod) === 0, miktar: Number(r.miktar) || 0, kur: Number(r.kur) || 0, tutar: Number(r.tutar) || 0,
            komisyon: Number(r.komisyon) || 0, bmv: Number(r.bmv) || 0, kmv: Number(r.kmv) || 0, kdv: Number(r.kdv) || 0,
            istatistikBaslik: r.istatistikKod ? `${r.istatistikKod} — ${r.istatistikAd}` : "İstatistik kodu yok" }));
        const topla = (anahtar, ortak) => {
            const m = new Map();
            for (const x of ham) {
                const k = anahtar(x);
                if (!m.has(k))
                    m.set(k, { ...ortak(x), gF: new Set(), cF: new Set(), girisMiktar: 0, girisTutar: 0, cikisMiktar: 0, cikisTutar: 0, satirAdedi: 0, komisyon: 0, bmv: 0, kmv: 0, kdv: 0 });
                const o = m.get(k);
                o.satirAdedi++;
                (x.giris ? o.gF : o.cF).add(x.fisId);
                if (x.giris) {
                    o.girisMiktar += x.miktar;
                    o.girisTutar += x.tutar;
                }
                else {
                    o.cikisMiktar += x.miktar;
                    o.cikisTutar += x.tutar;
                }
                o.komisyon += x.komisyon;
                o.bmv += x.bmv;
                o.kmv += x.kmv;
                o.kdv += x.kdv;
            }
            return [...m.values()].map(({ gF, cF, ...o }) => ({ ...o, girisFis: gF.size, cikisFis: cF.size, adet: new Set([...gF, ...cF]).size, miktar: o.girisMiktar + o.cikisMiktar, tutar: o.girisTutar + o.cikisTutar,
                ortGirisKuru: o.girisMiktar ? o.girisTutar / o.girisMiktar : 0, ortCikisKuru: o.cikisMiktar ? o.cikisTutar / o.cikisMiktar : 0 }));
        };
        const satirlar = detay ? ham.map((x) => ({ ...x, tip: x.giris ? "A" : "S" }))
            : topla(x => `${x.istatistikId}|${x.paraKod}`, x => ({ istatistikBaslik: x.istatistikBaslik, paraKod: x.paraKod }));
        const ozet = topla(x => x.paraKod, x => ({ paraKod: x.paraKod }));
        if (ozet.length > 1) {
            const g = topla(() => "*", () => ({ paraKod: "GENEL" }));
            ozet.push({ ...g[0], girisMiktar: 0, cikisMiktar: 0 });
        }
        return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.istatistikIdler, "istatistik")} · ${detay ? "Detaylı" : "Toplam"}`, "Fişler istatistik koduna göre gruplanır. Giriş = alış fişleri, Çıkış = satış fişleri. Miktar toplamları farklı para birimlerini birlikte içerebilir; para bazında toplam rapor sonundaki tablodadır (GENEL satırında miktar toplanmaz). İptal fişler hariçtir.", ozet);
    },
    /**
     * İstatistik bazında KMV raporu — eski "İSTATİSTİK BAZINDA KMV RAPORU" metrikleri: satır = fiş satırı (tarih, saat, vezne, ünvan, vergi / TC no, ülke, belge no, seri no,
     * para, miktar, kur, tutar, KMV, fiş toplamı, istatistik). Eski @FisToplami / @Tutar formülleri KMV'nin kura dahil olup olmamasına bakar; bu sistemde KMV hiçbir zaman
     * kura dahil değildir (fiş çıktısı: "Kmv kura dahil değildir") → Tutar = satır tutarı, Fiş toplamı = tutar + KMV. İşlem türü eski rapordaki gibi Alış / Satış / Hepsi.
     * Önceki özet (istatistik × para × KMV oranı: fiş adedi, miktar, matrah, KMV) rapor sonundaki tablodadır.
     */
    async ISTKMV1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis), p);
        const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
        const ulkeVar = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_ULKE','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
        const res = await req.query(`
      SELECT F.FIS_ID fisId, ISNULL(F.ZAMAN,F.TARIH) zaman, F.TIP tipKod, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(F.UNVAN,'')) unvan,
        COALESCE(NULLIF(RTRIM(F.VERGI_KIMLIK_NO),''), NULLIF(RTRIM(F.PASAPORT_NO),''), '') kimlikNo, ${ulkeVar ? "RTRIM(ISNULL(UL.AD,''))" : "''"} ulke,
        RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(P.KOD) paraKod, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur,
        ISNULL(S.TUTAR,0) tutar, ISNULL(S.KMV,0) kmv, ISNULL(S.KMV_ORANI,0) kmvOrani, RTRIM(ISNULL(I.KOD,'')) istatistikKod, RTRIM(ISNULL(I.ACIKLAMA,'')) istatistikAd
      FROM ${SATIR_JOIN} ${ulkeVar ? "LEFT JOIN dbo.TODVZ_ULKE UL ON UL.ULKE_ID=F.ULKE_ID" : ""}
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY I.KOD, CAST(F.TARIH AS date), ISNULL(F.ZAMAN,F.TARIH), F.BELGE_NO, F.SERI_NO, S.SATIR_NO;`);
        const satirlar = res.recordset.map((r) => {
            const tutar = Number(r.tutar) || 0, kmv = Number(r.kmv) || 0;
            return { ...r, tip: tipAdi(r.tipKod), miktar: Number(r.miktar) || 0, kur: Number(r.kur) || 0, tutar, kmv, kmvOrani: Number(r.kmvOrani) || 0, fisToplami: tutar + kmv,
                istatistikBaslik: r.istatistikKod ? `${r.istatistikKod} — ${r.istatistikAd}` : "İstatistik kodu yok" };
        });
        const oz = new Map();
        for (const x of satirlar) {
            if (!x.kmv && !x.kmvOrani)
                continue;
            const k = `${x.istatistikKod}|${x.paraKod}|${x.kmvOrani}`;
            if (!oz.has(k))
                oz.set(k, { istatistik: x.istatistikBaslik, paraKod: x.paraKod, kmvOrani: x.kmvOrani, fisler: new Set(), miktar: 0, matrah: 0, kmv: 0 });
            const o = oz.get(k);
            o.fisler.add(x.fisId);
            o.miktar += x.miktar;
            o.matrah += x.tutar;
            o.kmv += x.kmv;
        }
        const ozet = [...oz.values()].map(({ fisler, ...o }) => ({ ...o, adet: fisler.size }));
        return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p) || " · Alış + Satış"}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.istatistikIdler, "istatistik")}`, "Her satır bir fiş satırıdır. Tutar = satır tutarı (KMV hariç; bu sistemde KMV kura dahil değildir), Fiş toplamı = tutar + KMV. Kambiyo muameleleri vergisi yalnızca satış fişlerinde doğar; rapor sonundaki özet yalnızca KMV'li satırları (istatistik × para × KMV oranı) toplar. İptal fişler hariçtir.", ozet);
    },
    /**
     * Vergi numarası raporu — eski "VERGİ NUMARASI RAPORU" ile aynı metrikler: satır = fiş satırı (ünvan, vergi dairesi, vergi no, pasaport, tip, tarih/saat,
     * seri no, belge no, para, kur, miktar, tutar, USD karşılığı). Karşılık = satır tutarı ÷ fişin USD kuru; USD satırında miktarın kendisi (eski @Karsilik formülü).
     * Varsayılan olarak yalnızca karşılığı firma tanımındaki döviz vergi sınırına (DOVIZ_VERGI_SINIRI) ulaşan satırlar listelenir (eski "Tanımlara bakılsın").
     * Kimlik bazında özet (fiş adedi, ort. kur, komisyon, BSMV, KMV) rapor sonundaki özet tablosundadır.
     */
    async VERNUM1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        let sinir = 0, sinirPara = "USD";
        try {
            const tn = (await pool.request().query(`SELECT TOP 1 ISNULL(T.DOVIZ_VERGI_SINIRI,0) sinir, RTRIM(ISNULL(SP.KOD,'USD')) para FROM dbo.TODVZ_TANIM T LEFT JOIN dbo.TODVZ_PARA SP ON SP.PARA_ID=T.DOVIZ_VERGI_SINIRI_PARA_ID`)).recordset[0];
            sinir = Number(tn?.sinir) || 0;
            sinirPara = String(tn?.para || "USD");
        }
        catch { /* tanım okunamadıysa sınır uygulanmaz */ }
        const sinirUstu = p.durum !== "tumu" && sinir > 0;
        const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis), p)
            .input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null);
        const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
        const res = await req.query(`
      SELECT F.FIS_ID fisId, COALESCE(NULLIF(RTRIM(F.VERGI_KIMLIK_NO),''), NULLIF(RTRIM(F.PASAPORT_NO),''), '') kimlikNo,
        CASE WHEN NULLIF(RTRIM(F.VERGI_KIMLIK_NO),'') IS NULL AND NULLIF(RTRIM(F.PASAPORT_NO),'') IS NOT NULL THEN 1 ELSE 0 END pasaport,
        RTRIM(ISNULL(F.UNVAN,'')) unvan, RTRIM(ISNULL(F.VERGI_KIMLIK_NO,'')) vergiNo, RTRIM(ISNULL(F.PASAPORT_NO,'')) pasaportNo, RTRIM(ISNULL(VD.AD,'')) vergiDairesi,
        F.TIP tipKod, ISNULL(F.ZAMAN,F.TARIH) zaman, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KOMISYON,0) komisyon, ${FIS_USD_KURU_SQL} usdKuru
      FROM ${SATIR_JOIN} LEFT JOIN dbo.TODVZ_TABLO_MADDESI VD ON VD.TABLO_MADDESI_ID=F.VERGI_DAIRESI_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip)
        AND (@arama IS NULL OR F.VERGI_KIMLIK_NO LIKE @arama OR F.PASAPORT_NO LIKE @arama OR F.UNVAN LIKE @arama) ${f}
      ORDER BY F.TARIH, F.SERI_NO, F.FIS_ID, S.SATIR_NO;`);
        const ham = res.recordset.map((r) => {
            const miktar = Number(r.miktar) || 0, tutar = Number(r.tutar) || 0, usdKuru = Number(r.usdKuru) || 0;
            const no = String(r.kimlikNo || "");
            const tur = !no ? "" : r.pasaport ? "Pasaport" : no.length === 11 ? "TCKN" : "VKN";
            return { ...r, tip: tipAdi(r.tipKod), miktar, tutar, kur: Number(r.kur) || 0, usdKuru, bmv: Number(r.bmv), kmv: Number(r.kmv), komisyon: Number(r.komisyon),
                usdKarsiligi: String(r.paraKod).toUpperCase() === "USD" ? miktar : usdKuru > 0 ? tutar / usdKuru : 0, cins: "D",
                kimlikAlt: [r.vergiDairesi ? `Vergi dairesi: ${r.vergiDairesi}` : "", r.pasaportNo && !r.pasaport ? `Pasaport no: ${r.pasaportNo}` : ""].filter(Boolean).join(" · "),
                grupAnahtar: no || "-", grupBaslik: no ? `${tur} ${no} — ${r.unvan}` : "Kimlik numarası girilmemiş fişler" };
        })
            .filter((s) => !sinirUstu || s.usdKarsiligi >= sinir);
        // Grup sırası: kimlik no / ünvan / toplam tutar (büyükten küçüğe); grup içinde tarih → seri no (eski rapor sırası, sorgudan gelir)
        const toplam = new Map();
        for (const s of ham)
            toplam.set(s.grupAnahtar, (toplam.get(s.grupAnahtar) || 0) + s.tutar);
        const unvan = new Map();
        for (const s of ham)
            if (!unvan.has(s.grupAnahtar))
                unvan.set(s.grupAnahtar, s.unvan);
        const satirlar = ham.map((s, i) => ({ ...s, _i: i })).sort((a, b) => (p.siralama === "tutar" ? (toplam.get(b.grupAnahtar) - toplam.get(a.grupAnahtar)) : p.siralama === "unvan" ? (unvan.get(a.grupAnahtar) || "").localeCompare(unvan.get(b.grupAnahtar) || "", "tr") : 0)
            || a.grupAnahtar.localeCompare(b.grupAnahtar) || a._i - b._i);
        // Kimlik × tip × para özeti (önceki rapor düzeni): fiş adedi, ortalama kur, vergiler
        const oz = new Map();
        for (const s of satirlar) {
            const k = `${s.grupAnahtar}|${s.tipKod}|${s.paraKod}`;
            if (!oz.has(k))
                oz.set(k, { kimlik: s.grupBaslik, tip: s.tip, paraKod: s.paraKod, fisler: new Set(), miktar: 0, tutar: 0, usdKarsiligi: 0, komisyon: 0, bmv: 0, kmv: 0 });
            const o = oz.get(k);
            o.fisler.add(s.fisId);
            o.miktar += s.miktar;
            o.tutar += s.tutar;
            o.usdKarsiligi += s.usdKarsiligi;
            o.komisyon += s.komisyon;
            o.bmv += s.bmv;
            o.kmv += s.kmv;
        }
        const ozetSatirlar = [...oz.values()].map(({ fisler, ...o }) => ({ ...o, adet: fisler.size, ortKur: o.miktar ? o.tutar / o.miktar : 0 }));
        const sinirMetni = `${sinir.toLocaleString("tr-TR")} ${sinirPara}`;
        return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${p.arama?.trim() ? ` · Arama: "${p.arama.trim()}"` : ""}${sinirUstu ? ` · +${sinirMetni}` : " · Tüm işlemler"}`, `${sinirUstu ? `Yalnızca USD karşılığı firma tanımındaki döviz vergi sınırına (${sinirMetni}) ulaşan fiş satırları listelenir. ` : ""}USD karşılığı = satır tutarı ÷ fişin USD kuru; USD satırlarında miktarın kendisidir. Fişte USD kuru kayıtlı değilse sırayla fişteki USD satırının kuru, yoksa fiş tarihindeki kur tablosunun USD kuru (alışta alış, satışta satış) kullanılır; hiçbiri yoksa karşılık 0 görünür. Yalnızca döviz fişleri kapsanır; iptal fişler hariçtir.`, ozetSatirlar);
    },
};
