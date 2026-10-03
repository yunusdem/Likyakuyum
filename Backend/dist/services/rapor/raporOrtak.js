import sql from "mssql";
import { RAPOR_UST_SINIR } from "./raporTanim.js";
import { VEZNE_HAREKET_KOLONLARI, belgeTablolari, vezneHareketleriSql } from "./kaynak.js";
/** Seçim listesi filtresi: `kolon IN (…)`; liste boşsa boş metin. `onek` parametre adlarının çakışmaması içindir. */
export function idFiltre(req, idler, kolon, onek) {
    const ids = (idler || []).filter(n => Number.isInteger(n) && n > 0);
    if (!ids.length)
        return "";
    ids.forEach((id, i) => req.input(`${onek}${i}`, sql.Int, id));
    return ` AND ${kolon} IN (${ids.map((_, i) => `@${onek}${i}`).join(",")})`;
}
/** Filtre özetine eklenecek "· 3 hesap" parçası */
export const adetOzeti = (idler, ad) => (idler?.length ? ` · ${idler.length} ${ad}` : "");
export const tarihTr = (v) => (v ? v.split("-").reverse().join(".") : "");
export const HAREKET_TIPI = { 0: "Nakit", 1: "Banka / Havale", 2: "POS / Kredi Kartı", 3: "Dekont", 4: "Virman", 5: "Devir" };
/** KISILIK_TIPI kodları — eski programın kodlaması (canlıda doğrulandı 19.09.2026: eski kart listesi 0 → "Ş", 1 → "ŞF", 2 → "F" basıyor). */
export const KISILIK = { 0: "Şahıs", 1: "Şahıs firması", 2: "Tüzel kişi", 3: "Yetkili Müessese", 4: "Banka" };
/** TL para kaydı: KOD 'TL' / 'TRY'; yoksa fiş SP'sinin kullandığı PARA_ID=1. */
export const TL_PARA_SQL = `ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1)`;
/** USD para kaydı (KOD 'USD'); yoksa NULL → karşılıklar 0 çıkar. */
export const USD_PARA_SQL = `(SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD))='USD' ORDER BY PARA_ID)`;
/**
 * Fişin USD kuru (F = TODVZ_FIS takma adı) — "USD karşılığı" hesabının böleni. Fiş kaydı GISE_USD_KURU'na gerçek kur yazmadığında (0 / 1) sırayla:
 * 1) fişteki USD satırının kuru (fiş o kurla kesilmiştir), 2) fiş tarihine eşit/önceki en yakın kur tablosundaki USD kuru (alışta alış, satışta satış; efektif yoksa döviz kuru). Bulunamazsa 0.
 */
export const FIS_USD_KURU_SQL = `(CASE WHEN ISNULL(F.GISE_USD_KURU,0) NOT IN (0,1) THEN F.GISE_USD_KURU ELSE ISNULL(COALESCE(
    (SELECT TOP 1 US.KUR FROM dbo.TODVZ_FIS_SATIRI US WHERE US.FIS_ID=F.FIS_ID AND US.PARA_ID=${USD_PARA_SQL} AND ISNULL(US.KUR,0)>0 ORDER BY US.SATIR_NO),
    (SELECT TOP 1 CASE WHEN F.TIP=0 THEN COALESCE(NULLIF(UK.EFEKTIF_ALIS,0),UK.DOVIZ_ALIS) ELSE COALESCE(NULLIF(UK.EFEKTIF_SATIS,0),UK.DOVIZ_SATIS) END
      FROM dbo.TODVZ_KUR UK JOIN dbo.TODVZ_KUR_TABLOSU UT ON UT.KUR_TABLOSU_ID=UK.KUR_TABLOSU_ID
      WHERE UK.PARA_ID=${USD_PARA_SQL} AND CAST(UT.TARIH AS date)<=CAST(F.TARIH AS date)
        AND (CASE WHEN F.TIP=0 THEN COALESCE(NULLIF(UK.EFEKTIF_ALIS,0),UK.DOVIZ_ALIS) ELSE COALESCE(NULLIF(UK.EFEKTIF_SATIS,0),UK.DOVIZ_SATIS) END)>0
      ORDER BY UT.TARIH DESC, UT.KUR_TABLOSU_ID DESC)),0) END)`;
/** Kur tablosu: kurTuru 0 = anlık gişe (en son), 2 = saklanan (kurTarihi'ne eşit/önceki en yakın gün). */
export async function kurCoz(pool, p) {
    const tur = p.kurTuru === 2 ? 2 : 0;
    const ikisi = p.kurAlani === "ikisi";
    // Eski raporlar efektif kuru kullanır (SODVZCR_* yordamları EFEKTIF_ALIS / EFEKTIF_SATIS döndürür); efektif girilmemişse döviz kuruna düşülür
    const alan = p.kurAlani === "satis" ? "COALESCE(NULLIF(EFEKTIF_SATIS,0),DOVIZ_SATIS)" : "COALESCE(NULLIF(EFEKTIF_ALIS,0),DOVIZ_ALIS)";
    const req = pool.request().input("tur", sql.TinyInt, tur).input("t", sql.Date, p.kurTarihi || p.tarih || null);
    const res = await req.query(`
    SELECT TOP 1 T.KUR_TABLOSU_ID id, T.TARIH tarih FROM dbo.TODVZ_KUR_TABLOSU T
    WHERE T.TUR=@tur AND (@tur=0 OR @t IS NULL OR CAST(T.TARIH AS date)<=@t)
    ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC;`);
    const tablo = res.recordset[0];
    const kurlar = new Map(), satisKurlari = new Map();
    if (tablo) {
        const k = await pool.request().input("id", sql.Int, tablo.id).query(`SELECT PARA_ID, ${alan} kur, COALESCE(NULLIF(EFEKTIF_SATIS,0),DOVIZ_SATIS) satis, PARITE FROM dbo.TODVZ_KUR WHERE KUR_TABLOSU_ID=@id`);
        for (const r of k.recordset) {
            kurlar.set(Number(r.PARA_ID), Number(r.kur) || 0);
            satisKurlari.set(Number(r.PARA_ID), Number(r.satis) || 0);
        }
    }
    const tlId = Number((await pool.request().query(`SELECT ${TL_PARA_SQL} id`)).recordset[0]?.id || 1);
    kurlar.set(tlId, 1);
    satisKurlari.set(tlId, 1);
    const aciklama = tablo
        ? `Kur: ${tur === 0 ? "anlık gişe kuru" : "saklanan kur"} (${ikisi ? "efektif alış + satış" : p.kurAlani === "satis" ? "efektif satış" : "efektif alış"}, tablo tarihi ${new Date(tablo.tarih).toLocaleDateString("tr-TR")})`
        : "Kur tablosu bulunamadı; TL karşılıkları 0 gösterildi.";
    /** kurlar: seçilen alan (ikisi → alış); satisKurlari: satış kuru (ikisi seçilince ek kolonlar) */
    return { kurlar, satisKurlari, ikisi, tlId, aciklama };
}
/** Bir önceki gün (YYYY-AA-GG) — "devir" = dönem başından önceki günün kapanışı */
export const gunOnce = (gun) => { const d = new Date(`${gun}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
/** Verilen tarihe eşit/önceki en yakın kur tablosundaki efektif alış kurları (efektif yoksa döviz alış); TL = 1. Devir / kapanış değerlemeleri için (eski yordamlardaki DEVIR_* / MEVCUT_* / KAPANIS kurları). */
export async function kurTarihte(pool, tarih) {
    const r = await pool.request().input("t", sql.Date, tarih).query(`
    SELECT K.PARA_ID id, COALESCE(NULLIF(K.EFEKTIF_ALIS,0),K.DOVIZ_ALIS) kur FROM dbo.TODVZ_KUR K
    WHERE K.KUR_TABLOSU_ID=(SELECT TOP 1 T.KUR_TABLOSU_ID FROM dbo.TODVZ_KUR_TABLOSU T WHERE CAST(T.TARIH AS date)<=@t ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC)`);
    const m = new Map(r.recordset.map((x) => [Number(x.id), Number(x.kur) || 0]));
    m.set(Number((await pool.request().query(`SELECT ${TL_PARA_SQL} id`)).recordset[0]?.id || 1), 1);
    return m;
}
/** Seçilen (hedef) paraya çevrim: TL karşılığı ÷ hedef paranın kuru; hedef boş ya da TL ise TL karşılığının kendisi. Eski raporlardaki SECILEN_* alanlarının karşılığı. */
export async function hedefPara(pool, p, kur) {
    const id = p.hedefParaId && p.hedefParaId !== kur.tlId ? p.hedefParaId : kur.tlId;
    const kod = String((await pool.request().input("id", sql.Int, id).query(`SELECT RTRIM(KOD) kod FROM dbo.TODVZ_PARA WHERE PARA_ID=@id`)).recordset[0]?.kod || "TL");
    const bolen = id === kur.tlId ? 1 : kur.kurlar.get(id) ?? 0;
    return { id, kod, cevir: (tl) => (bolen > 0 ? tl / bolen : 0), aciklama: `Karşılık parası: ${kod}` };
}
export function sinirla(satirlar, tanim, filtreOzeti, ekDipnot, ozetSatirlar) {
    const sinir = tanim.ustSinir || RAPOR_UST_SINIR;
    if (satirlar.length > sinir)
        return { satirlar: [], filtreOzeti, ekDipnot, sinirAsildi: true, toplamKayit: satirlar.length };
    // Hesap açıklamaları basılmaz (kullanıcı kararı 19.09.2026: eski raporlardaki gibi sade çıktı); not yalnızca rapor boşken, nedenini söylemek için gösterilir
    return { satirlar, filtreOzeti, ekDipnot: satirlar.length ? undefined : ekDipnot, toplamKayit: satirlar.length, ...(ozetSatirlar?.length ? { ozetSatirlar } : {}) };
}
export const aralikOzeti = (p) => `${tarihTr(p.baslangic)} – ${tarihTr(p.bitis)}`;
/** Ortak filtre parçaları: cari kod aralığı, vezne kod aralığı, para listesi. Parametreler request'e eklenir, SQL parçası döner. */
export function filtreler(req, p, alias) {
    const parcalar = [];
    if (alias.cari) {
        req.input("cbas", sql.VarChar(50), p.cariBaslangic?.trim() || null).input("cbit", sql.VarChar(50), p.cariBitis?.trim() || null).input("cari", sql.Int, p.cariKartId || null);
        parcalar.push(`(@cari IS NULL OR ${alias.cari}.CARI_KART_ID=@cari)`, `(@cbas IS NULL OR RTRIM(${alias.cari}.KOD)>=@cbas)`, `(@cbit IS NULL OR RTRIM(${alias.cari}.KOD)<=@cbit)`);
        const cids = (p.cariIdler || []).filter(n => Number.isInteger(n) && n > 0);
        if (p.cariSonId) {
            // Son kod seçili: ilk koddaki seçimin en küçük kodundan son koda kadar aralık; ilk kod boşsa baştan son koda kadar
            req.input("cson", sql.Int, p.cariSonId);
            cids.forEach((id, i) => req.input(`ci${i}`, sql.Int, id));
            const ilkKod = cids.length ? `(SELECT MIN(RTRIM(KOD)) FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID IN (${cids.map((_, i) => `@ci${i}`).join(",")}))` : "''";
            parcalar.push(`RTRIM(${alias.cari}.KOD) BETWEEN ${ilkKod} AND (SELECT RTRIM(KOD) FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID=@cson)`);
        }
        else {
            cids.forEach((id, i) => req.input(`cl${i}`, sql.Int, id));
            if (cids.length)
                parcalar.push(`${alias.cari}.CARI_KART_ID IN (${cids.map((_, i) => `@cl${i}`).join(",")})`);
        }
    }
    if (alias.vezne) {
        req.input("vbas", sql.VarChar(50), p.vezneBaslangic?.trim() || null).input("vbit", sql.VarChar(50), p.vezneBitis?.trim() || null).input("v", sql.Int, p.vezneId || null);
        parcalar.push(`(@v IS NULL OR ${alias.vezne}.VEZNE_ID=@v)`, `(@vbas IS NULL OR RTRIM(${alias.vezne}.KOD)>=@vbas)`, `(@vbit IS NULL OR RTRIM(${alias.vezne}.KOD)<=@vbit)`);
        const vids = (p.vezneIdler || []).filter(n => Number.isInteger(n) && n > 0);
        if (vids.length && p.vezneSonId) {
            req.input("vilk", sql.Int, vids[0]).input("vson", sql.Int, p.vezneSonId);
            parcalar.push(`RTRIM(${alias.vezne}.KOD) BETWEEN (SELECT RTRIM(KOD) FROM dbo.TODVZ_VEZNE WHERE VEZNE_ID=@vilk) AND (SELECT RTRIM(KOD) FROM dbo.TODVZ_VEZNE WHERE VEZNE_ID=@vson)`);
        }
        else {
            vids.forEach((id, i) => req.input(`vl${i}`, sql.Int, id));
            if (vids.length)
                parcalar.push(`${alias.vezne}.VEZNE_ID IN (${vids.map((_, i) => `@vl${i}`).join(",")})`);
        }
    }
    if (alias.para) {
        req.input("para", sql.Int, p.paraId || null);
        const ids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0);
        parcalar.push(`(@para IS NULL OR ${alias.para}=@para)`);
        if (ids.length && p.paraSonId) {
            req.input("pilk", sql.Int, ids[0]).input("pson", sql.Int, p.paraSonId);
            parcalar.push(`${alias.para} IN (SELECT PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(KOD) BETWEEN (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pilk) AND (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pson))`);
        }
        else {
            ids.forEach((id, i) => req.input(`pl${i}`, sql.Int, id));
            if (ids.length)
                parcalar.push(`${alias.para} IN (${ids.map((_, i) => `@pl${i}`).join(",")})`);
        }
    }
    return parcalar.length ? " AND " + parcalar.join(" AND ") : "";
}
/** Para seçimi kümesi (paraIdler; paraSonId varsa ilk → son KOD aralığı). null = tümü. FIRVAR1/VEZBAK1 JS süzmesi için. */
export async function paraKumesi(pool, p) {
    const ids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0);
    if (!ids.length)
        return null;
    if (!p.paraSonId)
        return new Set(ids);
    const r = await pool.request().input("pilk", sql.Int, ids[0]).input("pson", sql.Int, p.paraSonId).query(`SELECT PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(KOD) BETWEEN (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pilk) AND (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pson)`);
    return new Set(r.recordset.map((x) => Number(x.PARA_ID)));
}
export const ozetEk = (p) => [
    p.cariKartId ? "Seçili cari" : p.cariIdler?.length ? (p.cariSonId ? "Cari aralığı" : `${p.cariIdler.length} cari`) : p.cariBaslangic || p.cariBitis ? `Cari ${p.cariBaslangic || "…"} → ${p.cariBitis || "…"}` : "",
    p.vezneId ? "Seçili vezne" : p.vezneIdler?.length ? (p.vezneSonId ? "Vezne aralığı" : `${p.vezneIdler.length} vezne`) : p.vezneBaslangic || p.vezneBitis ? `Vezne ${p.vezneBaslangic || "…"} → ${p.vezneBitis || "…"}` : "",
    p.paraId ? "Seçili para" : p.paraIdler?.length ? (p.paraSonId ? "Para aralığı" : `${p.paraIdler.length} para`) : "",
].filter(Boolean).map(x => " · " + x).join("");
/**
 * Vezne bakiyeleri (tarih dahil) — Vezne Hareket Listesi ile aynı kaynak (`kaynak.ts` vezneHareketleriSql): döviz fişi, sarraf fişi, vezne transferi,
 * nakit cari hareket, kasa hesap hareketi (+ KDV), emanet dekontu. Eski SODVZCR_VEZNE_BAKIYE_TARIH_BAZLI ile aynı kapsam (bkz. docs/rapor-denetim.md).
 */
export async function vezneBakiyeleri(pool, tarih, p) {
    const d = await belgeTablolari(pool);
    const req = pool.request().input("t", sql.Date, tarih);
    const f = p ? filtreler(req, p, { vezne: "V" }) : "";
    const res = await req.query(`
    ;WITH H (${VEZNE_HAREKET_KOLONLARI}) AS (
     ${vezneHareketleriSql(d)}
    )
    SELECT H.vezneId, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, H.paraId,
      RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo, SUM(ISNULL(H.giris,0)-ISNULL(H.cikis,0)) miktar
    FROM H LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.vezneId LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=H.paraId
    WHERE CAST(H.tarih AS date)<=@t ${f}
    GROUP BY H.vezneId, V.KOD, V.AD, H.paraId, P.KOD, P.AD, P.SIRA_NO
    ORDER BY V.KOD, ISNULL(P.SIRA_NO,99), P.KOD;`);
    return res.recordset;
}
export const VEZNE_BAKIYE_DIPNOT = "Bakiye hesabı: seçilen tarihe kadar vezneyi etkileyen tüm hareketler toplanır — döviz fişleri (bankadan ödenen TL ödemesi ve satırlar hariç), sarraf fişleri (ürün satırları ve vezneden yapılan ödemeler), perakende fişleri (barkodsuz satırlar ve vezneden tahsilat), barkodlu ürün tanımları (ayar stoğundan düşüş), vezne transferleri (alan +, veren −), nakit cari hareketler (alacak giriş, borç çıkış), kasa hesap hareketleri (KDV TL'ye; fişlerin işçilik kayıtları hariç), emanet dekontları (alma giriş, verme çıkış) ve bakiye düzeltmeleri (Vezne İzleme'den elle yapılan değişiklikler ve açılış farkı).";
