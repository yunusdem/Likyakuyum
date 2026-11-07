export const PARA_GRUP_ADI = { doviz: "Döviz", kuyum: "Kuyum", ticari: "Ticari" };
const SIRA = { doviz: 0, kuyum: 1, ticari: 2 };
/**
 * Para kuyum (altın / gümüş / ziynet) parası mı? Para kartındaki ürün tipi altın ayarlarında 0 kalabildiği için (22 / 14 / 18 ayar kartları)
 * has oranı, kod ve ad da okunur. Saf fonksiyon.
 */
export function kuyumParasiMi(x) {
    const kod = String(x.kod || "").trim().toLocaleUpperCase("tr"), metin = `${kod} ${String(x.ad || "").toLocaleUpperCase("tr")}`;
    const ut = x.urunTipi == null ? 0 : Number(x.urunTipi);
    return ut === 1 || ut === 2 || ut === 3 || (Number(x.hasOrani) || 0) > 0 || kod === "HAS"
        || /ALTIN|AYAR|G[ÜU]M[ÜU][ŞS]|[ÇC]EYREK|YARIM|Z[İI]YNET|CUMHUR|RE[ŞS]AT|B[İI]LEZ[İI]K/.test(metin);
}
/**
 * Kuyum paraları: para kartından (has oranı / ürün tipi / kod / ad) ve sarraf fişinde altın / gümüş / ziynet olarak işlem görmüş olanlar.
 * Yalnızca SELECT; eksik kolon / tablo (eski şema) sorun olmaz.
 */
export async function paraGrupBilgisi(pool) {
    const k = (await pool.request().query(`SELECT
    CASE WHEN COL_LENGTH('dbo.TODVZ_PARA','HAS_ORANI') IS NULL THEN 0 ELSE 1 END hasOrani,
    CASE WHEN COL_LENGTH('dbo.TODVZ_PARA','URUN_TIPI') IS NULL THEN 0 ELSE 1 END urunTipi,
    CASE WHEN COL_LENGTH('dbo.TODVZ_SARRAF_FISI_SATIRI','URUN_TIPI') IS NULL OR COL_LENGTH('dbo.TODVZ_SARRAF_FISI_SATIRI','URUN_ID') IS NULL THEN 0 ELSE 1 END sarraf`)).recordset[0] || {};
    const kuyumIdler = new Set(), kuyumKodlar = new Set();
    const kodlar = new Map();
    const r = await pool.request().query(`SELECT PARA_ID id, RTRIM(ISNULL(KOD,'')) kod, RTRIM(ISNULL(AD,'')) ad,
    ${k.hasOrani ? "ISNULL(HAS_ORANI,0)" : "0"} hasOrani, ${k.urunTipi ? "URUN_TIPI" : "NULL"} urunTipi FROM dbo.TODVZ_PARA`);
    for (const x of r.recordset) {
        const kod = String(x.kod).trim().toLocaleUpperCase("tr");
        kodlar.set(Number(x.id), kod);
        if (kuyumParasiMi({ kod: String(x.kod), ad: String(x.ad), hasOrani: Number(x.hasOrani) || 0, urunTipi: x.urunTipi })) {
            kuyumIdler.add(Number(x.id));
            kuyumKodlar.add(kod);
        }
    }
    if (k.sarraf) {
        const s = await pool.request().query(`SELECT DISTINCT URUN_ID id FROM dbo.TODVZ_SARRAF_FISI_SATIRI WHERE URUN_TIPI IN (1,2,3) AND URUN_ID IS NOT NULL`);
        for (const x of s.recordset) {
            kuyumIdler.add(Number(x.id));
            const kod = kodlar.get(Number(x.id));
            if (kod)
                kuyumKodlar.add(kod);
        }
    }
    return paraGrupKur(kuyumIdler, kuyumKodlar);
}
/** Hazır kümelerden bilgi nesnesi (test ve sorgu içi kullanım) */
export function paraGrupKur(kuyumIdler, kuyumKodlar = new Set()) {
    return { kuyumIdler, kuyumKodlar,
        grup: x => (x.paraId != null && kuyumIdler.has(Number(x.paraId))) || (x.paraKod != null && kuyumKodlar.has(String(x.paraKod).trim().toLocaleUpperCase("tr"))) ? "kuyum" : "doviz" };
}
/**
 * Satırları para grubuna göre dizer ve her grubun başına başlık satırı koyar (`_stil: "baslik"`; motor kalın / bantlı basar, toplamlara katmaz).
 * `bolumle`: bu alanların değeri aynı olan ardışık satırlar bir parçadır (grup anahtarları: vezne, cari …); sıralama ve başlıklar parça içinde kalır.
 * Parça içinde özgün sıra korunur (kararlı sıralama). Saf fonksiyon.
 */
export function paraBasliklariEkle(satirlar, o) {
    const cikti = [];
    const anahtar = (s) => (o.bolumle || []).map(a => String(s[a] ?? "")).join("\u0001");
    let i = 0;
    while (i < satirlar.length) {
        const a = anahtar(satirlar[i]);
        const parca = [];
        while (i < satirlar.length && anahtar(satirlar[i]) === a)
            parca.push(satirlar[i++]);
        const sirali = parca.map((s, n) => ({ s, n, g: o.grupla(s) })).sort((x, y) => SIRA[x.g] - SIRA[y.g] || x.n - y.n);
        let acik = null;
        for (const x of sirali) {
            if (x.g !== acik) {
                acik = x.g;
                const b = { [o.alan]: PARA_GRUP_ADI[x.g], _baslik: PARA_GRUP_ADI[x.g], _stil: "baslik" };
                for (const al of o.bolumle || [])
                    b[al] = x.s[al];
                cikti.push(b);
            }
            cikti.push(x.s);
        }
    }
    return cikti;
}
/**
 * Her paranın ayrı grup olduğu raporlar için (grup anahtarı = para): satırlara `paraGrupAd` yazar ve satırları Döviz → Kuyum → Ticari sırasına dizer
 * (kendi içinde sıra korunur). Tanımda `bolum: { anahtar: "paraGrupAd", baslik: "{{paraGrupAd}}", altToplam: false, herZaman: true }` kullanılır. Saf fonksiyon.
 */
export function paraGrubunaGoreSirala(satirlar, grupla) {
    return satirlar.map((s, n) => ({ s, n, g: grupla(s) })).sort((x, y) => SIRA[x.g] - SIRA[y.g] || x.n - y.n).map(x => ({ ...x.s, paraGrupAd: PARA_GRUP_ADI[x.g] }));
}
