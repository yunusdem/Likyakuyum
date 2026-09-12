import sql from "mssql";
import { ApiError } from "../../utils/ApiError.js";
import { RAPOR_UST_SINIR } from "./raporTanim.js";
const tarihTr = (v) => (v ? v.split("-").reverse().join(".") : "");
const HAREKET_TIPI = { 0: "Nakit", 1: "Banka / Havale", 2: "POS / Kredi Kartı", 3: "Dekont", 4: "Virman", 5: "Devir" };
const KISILIK = { 0: "Gerçek kişi", 1: "Tüzel kişi" };
/** TL para kaydı: KOD 'TL' / 'TRY'; yoksa fiş SP'sinin kullandığı PARA_ID=1. */
const TL_PARA_SQL = `ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1)`;
/** Kur tablosu: kurTuru 0 = anlık gişe (en son), 2 = saklanan (kurTarihi'ne eşit/önceki en yakın gün). */
async function kurCoz(pool, p) {
    const tur = p.kurTuru === 2 ? 2 : 0;
    const alan = p.kurAlani === "satis" ? "DOVIZ_SATIS" : "DOVIZ_ALIS";
    const req = pool.request().input("tur", sql.TinyInt, tur).input("t", sql.Date, p.kurTarihi || p.tarih || null);
    const res = await req.query(`
    SELECT TOP 1 T.KUR_TABLOSU_ID id, T.TARIH tarih FROM dbo.TODVZ_KUR_TABLOSU T
    WHERE T.TUR=@tur AND (@tur=0 OR @t IS NULL OR CAST(T.TARIH AS date)<=@t)
    ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC;`);
    const tablo = res.recordset[0];
    const kurlar = new Map();
    if (tablo) {
        const k = await pool.request().input("id", sql.Int, tablo.id).query(`SELECT PARA_ID, ${alan} kur, PARITE FROM dbo.TODVZ_KUR WHERE KUR_TABLOSU_ID=@id`);
        for (const r of k.recordset)
            kurlar.set(Number(r.PARA_ID), Number(r.kur) || 0);
    }
    const tlId = Number((await pool.request().query(`SELECT ${TL_PARA_SQL} id`)).recordset[0]?.id || 1);
    kurlar.set(tlId, 1);
    const aciklama = tablo
        ? `Kur: ${tur === 0 ? "anlık gişe kuru" : "saklanan kur"} (${alan === "DOVIZ_ALIS" ? "döviz alış" : "döviz satış"}, tablo tarihi ${new Date(tablo.tarih).toLocaleDateString("tr-TR")})`
        : "Kur tablosu bulunamadı; TL karşılıkları 0 gösterildi.";
    return { kurlar, tlId, aciklama };
}
function sinirla(satirlar, tanim, filtreOzeti, ekDipnot) {
    const sinir = tanim.ustSinir || RAPOR_UST_SINIR;
    if (satirlar.length > sinir)
        return { satirlar: [], filtreOzeti, ekDipnot, sinirAsildi: true, toplamKayit: satirlar.length };
    return { satirlar, filtreOzeti, ekDipnot, toplamKayit: satirlar.length };
}
const aralikOzeti = (p) => `${tarihTr(p.baslangic)} – ${tarihTr(p.bitis)}`;
/** Ortak filtre parçaları: cari kod aralığı, vezne kod aralığı, para listesi. Parametreler request'e eklenir, SQL parçası döner. */
function filtreler(req, p, alias) {
    const parcalar = [];
    if (alias.cari) {
        req.input("cbas", sql.VarChar(50), p.cariBaslangic?.trim() || null).input("cbit", sql.VarChar(50), p.cariBitis?.trim() || null).input("cari", sql.Int, p.cariKartId || null);
        parcalar.push(`(@cari IS NULL OR ${alias.cari}.CARI_KART_ID=@cari)`, `(@cbas IS NULL OR RTRIM(${alias.cari}.KOD)>=@cbas)`, `(@cbit IS NULL OR RTRIM(${alias.cari}.KOD)<=@cbit)`);
    }
    if (alias.vezne) {
        req.input("vbas", sql.VarChar(50), p.vezneBaslangic?.trim() || null).input("vbit", sql.VarChar(50), p.vezneBitis?.trim() || null).input("v", sql.Int, p.vezneId || null);
        parcalar.push(`(@v IS NULL OR ${alias.vezne}.VEZNE_ID=@v)`, `(@vbas IS NULL OR RTRIM(${alias.vezne}.KOD)>=@vbas)`, `(@vbit IS NULL OR RTRIM(${alias.vezne}.KOD)<=@vbit)`);
    }
    if (alias.para) {
        req.input("para", sql.Int, p.paraId || null);
        const ids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0);
        ids.forEach((id, i) => req.input(`pl${i}`, sql.Int, id));
        parcalar.push(`(@para IS NULL OR ${alias.para}=@para)`);
        if (ids.length)
            parcalar.push(`${alias.para} IN (${ids.map((_, i) => `@pl${i}`).join(",")})`);
    }
    return parcalar.length ? " AND " + parcalar.join(" AND ") : "";
}
const ozetEk = (p) => [
    p.cariKartId ? "Seçili cari" : p.cariBaslangic || p.cariBitis ? `Cari ${p.cariBaslangic || "…"} → ${p.cariBitis || "…"}` : "",
    p.vezneId ? "Seçili vezne" : p.vezneBaslangic || p.vezneBitis ? `Vezne ${p.vezneBaslangic || "…"} → ${p.vezneBitis || "…"}` : "",
    p.paraId ? "Seçili para" : p.paraIdler?.length ? `${p.paraIdler.length} para` : "",
].filter(Boolean).map(x => " · " + x).join("");
/** Vezne bakiyeleri (tarih dahil) — fiş + nakit cari hareket. Bkz. docs/raporlar.md karar E7. */
async function vezneBakiyeleri(pool, tarih, p) {
    const req = pool.request().input("t", sql.Date, tarih);
    const f = p ? filtreler(req, p, { vezne: "V" }) : "";
    const res = await req.query(`
    ;WITH H AS (
      SELECT F.VEZNE_ID vezneId, S.PARA_ID paraId, SUM(CASE WHEN F.TIP=0 THEN S.MIKTAR ELSE -S.MIKTAR END) miktar
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@t GROUP BY F.VEZNE_ID, S.PARA_ID
      UNION ALL
      SELECT F.VEZNE_ID, ${TL_PARA_SQL}, SUM(CASE WHEN F.TIP=1 THEN F.ODEME_TUTARI ELSE -F.ODEME_TUTARI END)
      FROM dbo.TODVZ_FIS F WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@t GROUP BY F.VEZNE_ID
      UNION ALL
      SELECT CH.VEZNE_ID, CS.PARA_ID, SUM(CASE WHEN CH.TIP=1 THEN CS.MEBLAG ELSE -CS.MEBLAG END)
      FROM dbo.TODVZ_CARI_HAREKET CH JOIN dbo.TODVZ_CARI_HAREKET_SATIRI CS ON CS.CARI_HAREKET_ID=CH.CARI_HAREKET_ID
      WHERE CH.HAREKET_TIPI=0 AND CAST(CH.TARIH AS date)<=@t GROUP BY CH.VEZNE_ID, CS.PARA_ID
    )
    SELECT H.vezneId, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, H.paraId,
      RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo, SUM(H.miktar) miktar
    FROM H LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.vezneId LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=H.paraId
    WHERE 1=1 ${f}
    GROUP BY H.vezneId, V.KOD, V.AD, H.paraId, P.KOD, P.AD, P.SIRA_NO
    ORDER BY V.KOD, ISNULL(P.SIRA_NO,99), P.KOD;`);
    return res.recordset;
}
const VEZNE_BAKIYE_DIPNOT = "Bakiye hesabı: iptal edilmemiş alış fişleri döviz miktarını artırır ve ödeme tutarını TL'den düşer, satış fişleri tersini yapar; nakit türündeki cari hareketlerde alacak vezneye giriş, borç çıkış sayılır. Gün sonu kapanış tablosu kullanılmaz; seçilen tarihe kadar tüm hareketler toplanır.";
export const RAPOR_SORGULARI = {
    /** R1 Cari bakiye raporu — para ve has bazında, sıfır bakiyeli cariler dahil */
    async CARBAK1(pool, p, t) {
        if (!p.tarih)
            throw ApiError.badRequest("Tarih zorunludur.");
        const req = pool.request().input("t", sql.Date, p.tarih);
        const f = filtreler(req, p, { cari: "C", para: "B.PARA_ID" });
        const res = await req.query(`
      ;WITH B AS (
        SELECT H.CARI_KART_ID, S.PARA_ID, SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE 0 END) BORC, SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END) ALACAK
        FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
        WHERE CAST(H.TARIH AS date)<=@t GROUP BY H.CARI_KART_ID, S.PARA_ID)
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd,
        ISNULL(RTRIM(P.KOD),'-') paraKod, ISNULL(B.BORC,0) borc, ISNULL(B.ALACAK,0) alacak,
        ISNULL(B.ALACAK,0)-ISNULL(B.BORC,0) bakiye, ISNULL(P.HAS_ORANI,0) hasOrani
      FROM dbo.TODVZ_CARI_KART C
      LEFT JOIN B ON B.CARI_KART_ID=C.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=B.PARA_ID
      WHERE 1=1 ${f}
      ORDER BY C.KOD, ISNULL(P.SIRA_NO,99), P.KOD;`);
        const satirlar = res.recordset.map((r) => {
            const bakiye = Number(r.bakiye) || 0;
            return { ...r, borc: Number(r.borc), alacak: Number(r.alacak), bakiye: Math.abs(bakiye),
                yon: bakiye > 0 ? "Alacak" : bakiye < 0 ? "Borç" : "-",
                hasKarsiligi: Math.abs(bakiye) * (Number(r.hasOrani) || 0), cariBaslik: `${r.cariKod} — ${r.cariAd}` };
        });
        return sinirla(satirlar, t, `${tarihTr(p.tarih)} tarihine kadar${ozetEk(p) || " · Tüm cariler"}`, "Yön: Alacak = carinin bizden alacağı, Borç = carinin bize borcu. Has karşılığı = bakiye × para tanımındaki has oranı. Sıfır bakiyeli cariler de listelenir.");
    },
    /** R2 Cari ekstre — cari aralığı (Ahmet -> Mehmet), tarih aralığı, tek para; cari × para grubu, devir + yürüyen bakiye */
    async CAREKS1(pool, p, t) {
        if (!p.cariKartId && !p.cariBaslangic && !p.cariBitis)
            throw ApiError.badRequest("Cari aralığı (başlangıç ve/veya bitiş) seçilmelidir.");
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        const f = filtreler(req, p, { cari: "C", para: "S.PARA_ID" });
        const res = await req.query(`
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE 0 END) borc, SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID
      WHERE CAST(H.TARIH AS date)<@bas ${f} GROUP BY C.CARI_KART_ID, C.KOD, C.AD, S.PARA_ID, P.KOD, P.SIRA_NO;
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, H.CARI_HAREKET_ID id, H.TARIH tarih, H.HAREKET_TIPI hareketTipi, H.TIP tip,
        RTRIM(ISNULL(H.ACIKLAMA,'')) aciklama, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, S.MEBLAG meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.VEZNE_ID
      WHERE CAST(H.TARIH AS date) BETWEEN @bas AND @bit ${f}
      ORDER BY C.KOD, ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH, H.CARI_HAREKET_ID, S.SATIR_NO;`);
        const sets = res.recordsets;
        const anahtar = (r) => `${r.cariKod}|${r.paraKod}`;
        const gruplar = new Map();
        const ekle = (r) => { const k = anahtar(r); if (!gruplar.has(k))
            gruplar.set(k, { cariKod: r.cariKod, cariAd: r.cariAd, paraKod: r.paraKod, siraNo: Number(r.siraNo), devir: 0, hareketler: [] }); return gruplar.get(k); };
        for (const d of sets[0])
            ekle(d).devir = Number(d.alacak) - Number(d.borc);
        for (const h of sets[1])
            ekle(h).hareketler.push(h);
        const satirlar = [];
        for (const g of [...gruplar.values()].sort((x, y) => x.cariKod.localeCompare(y.cariKod) || x.siraNo - y.siraNo || x.paraKod.localeCompare(y.paraKod))) {
            let bakiye = g.devir;
            const ortak = { grupAnahtar: `${g.cariKod}|${g.paraKod}`, grupBaslik: `${g.cariKod} — ${g.cariAd} · ${g.paraKod}`, cariKod: g.cariKod, cariAd: g.cariAd, paraKod: g.paraKod };
            satirlar.push({ ...ortak, tarih: p.baslangic, hareketTipi: "Devir", aciklama: `${tarihTr(p.baslangic)} öncesi devir`, vezneKod: "",
                borc: bakiye < 0 ? -bakiye : 0, alacak: bakiye > 0 ? bakiye : 0, bakiye: Math.abs(bakiye), yon: bakiye > 0 ? "A" : bakiye < 0 ? "B" : "" });
            for (const h of g.hareketler) {
                const meblag = Number(h.meblag) || 0;
                bakiye += Number(h.tip) === 1 ? meblag : -meblag;
                satirlar.push({ ...ortak, tarih: h.tarih, hareketTipi: HAREKET_TIPI[Number(h.hareketTipi)] || "Diğer", aciklama: h.aciklama, vezneKod: h.vezneKod,
                    borc: Number(h.tip) === 0 ? meblag : 0, alacak: Number(h.tip) === 1 ? meblag : 0, bakiye: Math.abs(bakiye), yon: bakiye > 0 ? "A" : bakiye < 0 ? "B" : "" });
            }
        }
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}`, "Yön: A = cari alacaklı (bizden alacağı var), B = cari borçlu. Her cari ve para birimi ayrı gruplanır; ilk satır başlangıç tarihinden önceki devirdir.");
    },
    /** R3 Cari hareket listesi */
    async CARHAR1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        const f = filtreler(req, p, { cari: "C", vezne: "V", para: "S.PARA_ID" });
        const res = await req.query(`
      SELECT H.TARIH tarih, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, H.HAREKET_TIPI hareketTipiKod, H.TIP tipKod,
        RTRIM(ISNULL(H.ACIKLAMA,'')) aciklama, RTRIM(P.KOD) paraKod, S.MEBLAG meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.VEZNE_ID
      WHERE CAST(H.TARIH AS date) BETWEEN @bas AND @bit ${f}
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH, H.CARI_HAREKET_ID, S.SATIR_NO;`);
        const satirlar = res.recordset.map((r) => ({ ...r, meblag: Number(r.meblag), hareketTipi: HAREKET_TIPI[Number(r.hareketTipiKod)] || "Diğer",
            tip: Number(r.tipKod) === 1 ? "Alacak" : "Borç", borc: Number(r.tipKod) === 0 ? Number(r.meblag) : 0, alacak: Number(r.tipKod) === 1 ? Number(r.meblag) : 0 }));
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}`);
    },
    /** R4 Cari kart listesi */
    async CARKRT1(pool, p, t) {
        const res = await pool.request().input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null).query(`
      SELECT RTRIM(ISNULL(C.KOD,'')) kod, RTRIM(ISNULL(C.AD,'')) ad, C.KISILIK_TIPI kisilikKod, RTRIM(ISNULL(C.VERGI_KIMLIK_NO,'')) vergiNo,
        RTRIM(ISNULL(C.PASAPORT_NO,'')) pasaportNo, RTRIM(ISNULL(C.TELEFON,'')) telefon, RTRIM(ISNULL(C.EPOSTA,'')) eposta, RTRIM(ISNULL(C.ADRES,'')) adres,
        ISNULL(C.KARA_LISTEDE,0) karaListe, RTRIM(ISNULL(C.YETKILI_KISI,'')) yetkili
      FROM dbo.TODVZ_CARI_KART C
      WHERE (@arama IS NULL OR C.KOD LIKE @arama OR C.AD LIKE @arama OR C.VERGI_KIMLIK_NO LIKE @arama)
      ORDER BY C.KOD;`);
        const satirlar = res.recordset.map((r) => ({ ...r, kisilik: KISILIK[Number(r.kisilikKod)] || "-", karaListe: r.karaListe ? "EVET" : "" }));
        return sinirla(satirlar, t, p.arama?.trim() ? `Arama: "${p.arama.trim()}"` : "Tüm cari kartlar");
    },
    /** R5 Firma varlıkları — vezne bakiyeleri + cari alacak/borç, seçilen kurla TL */
    async FIRVAR1(pool, p, t) {
        if (!p.tarih)
            throw ApiError.badRequest("Tarih zorunludur.");
        const kur = await kurCoz(pool, p);
        const vezneler = await vezneBakiyeleri(pool, p.tarih);
        const satirlar = vezneler.filter(v => Math.abs(v.miktar) > 0.000001).map(v => ({
            kaynak: `Vezne ${v.vezneKod} — ${v.vezneAd}`, grup: "1-Vezneler", paraKod: v.paraKod, miktar: Number(v.miktar), kur: kur.kurlar.get(v.paraId) ?? 0,
            tlKarsiligi: Number(v.miktar) * (kur.kurlar.get(v.paraId) ?? 0)
        }));
        const cari = await pool.request().input("t", sql.Date, p.tarih).query(`
      SELECT S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE 0 END) borc, SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      WHERE CAST(H.TARIH AS date)<=@t GROUP BY S.PARA_ID, P.KOD, P.SIRA_NO ORDER BY ISNULL(P.SIRA_NO,99), P.KOD;`);
        for (const r of cari.recordset) {
            const k = kur.kurlar.get(Number(r.paraId)) ?? 0;
            if (Number(r.borc))
                satirlar.push({ kaynak: "Cari alacaklarımız (carilerin bize borcu)", grup: "2-Cari alacaklar", paraKod: r.paraKod, miktar: Number(r.borc), kur: k, tlKarsiligi: Number(r.borc) * k });
            if (Number(r.alacak))
                satirlar.push({ kaynak: "Cari borçlarımız (carilerin bizden alacağı)", grup: "3-Cari borçlar", paraKod: r.paraKod, miktar: -Number(r.alacak), kur: k, tlKarsiligi: -Number(r.alacak) * k });
        }
        return sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla · ${kur.aciklama}`, `${VEZNE_BAKIYE_DIPNOT} Cari borçlarımız eksi işaretle düşülür; banka hesapları kapsam dışıdır (yönetici kararı). ${kur.aciklama}.`);
    },
    /** R6 Kâr/zarar faaliyet analizi — ağırlıklı ortalama maliyet */
    async KARZAR1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bit", sql.Date, p.bitis);
        const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
        const res = await req.query(`
      SELECT F.FIS_ID fisId, F.TARIH tarih, F.TIP tip, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo,
        S.MIKTAR miktar, S.KUR kur, S.TUTAR tutar, S.KOMISYON komisyon, S.BMV bmv, S.KMV kmv, S.KDV kdv
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@bit ${f}
        AND RTRIM(UPPER(P.KOD)) NOT IN ('TL','TRY')
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, F.TARIH, F.FIS_ID, S.SATIR_NO;`);
        const bas = new Date(p.baslangic);
        const ozet = new Map();
        const stok = new Map();
        for (const r of res.recordset) {
            const id = Number(r.paraId);
            if (!ozet.has(id))
                ozet.set(id, { paraKod: r.paraKod, paraAd: r.paraAd, alisMiktar: 0, alisTutar: 0, satisMiktar: 0, satisTutar: 0, satisMaliyeti: 0, brutKar: 0, komisyon: 0, vergiler: 0, netKar: 0, ortMaliyet: 0, kalanMiktar: 0 });
            const o = ozet.get(id), s = stok.get(id) || { miktar: 0, maliyet: 0, sonOrt: 0 };
            const miktar = Number(r.miktar) || 0, tutar = Number(r.tutar) || 0, kur = Number(r.kur) || 0;
            const donemde = new Date(r.tarih) >= bas;
            if (Number(r.tip) === 0) { // alış: stoka maliyetiyle girer
                s.miktar += miktar;
                s.maliyet += tutar;
                if (s.miktar > 0)
                    s.sonOrt = s.maliyet / s.miktar;
                if (donemde) {
                    o.alisMiktar += miktar;
                    o.alisTutar += tutar;
                }
            }
            else { // satış: ağırlıklı ortalama maliyetle stoktan düşer
                const ort = s.miktar > 0 ? s.maliyet / s.miktar : (s.sonOrt || kur);
                const maliyet = miktar * ort;
                s.miktar -= miktar;
                s.maliyet -= maliyet;
                if (s.miktar <= 0.0000001) {
                    s.miktar = Math.max(s.miktar, 0);
                    s.maliyet = s.miktar * ort;
                }
                s.sonOrt = ort;
                if (donemde) {
                    o.satisMiktar += miktar;
                    o.satisTutar += tutar;
                    o.satisMaliyeti += maliyet;
                    o.brutKar += tutar - maliyet;
                }
            }
            if (donemde) {
                o.komisyon += Number(r.komisyon) || 0;
                o.vergiler += (Number(r.bmv) || 0) + (Number(r.kmv) || 0) + (Number(r.kdv) || 0);
            }
            stok.set(id, s);
        }
        const satirlar = [...ozet.entries()].map(([id, o]) => { const s = stok.get(id); return { ...o, ortMaliyet: s.miktar > 0 ? s.maliyet / s.miktar : s.sonOrt, kalanMiktar: s.miktar, netKar: o.brutKar + o.komisyon - o.vergiler }; })
            .filter(o => o.alisMiktar || o.satisMiktar || o.komisyon);
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm dövizler"}`);
    },
    /** R7 Vergiler ve komisyon — vezne → gün → para, iptal fişler hariç */
    async VERKOM1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
        const res = await req.query(`
      SELECT RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, CAST(F.TARIH AS date) gun, RTRIM(P.KOD) paraKod,
        COUNT(DISTINCT F.FIS_ID) adet, SUM(S.MIKTAR) miktar, SUM(S.TUTAR) tutar, SUM(S.KOMISYON) komisyon, SUM(S.BMV) bmv, SUM(S.KMV) kmv, SUM(S.KDV) kdv
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit ${f}
      GROUP BY V.KOD, V.AD, CAST(F.TARIH AS date), P.KOD, P.SIRA_NO
      ORDER BY V.KOD, CAST(F.TARIH AS date), ISNULL(P.SIRA_NO,99), P.KOD;`);
        const satirlar = res.recordset.map((r) => ({ ...r, adet: Number(r.adet), miktar: Number(r.miktar), tutar: Number(r.tutar), komisyon: Number(r.komisyon), bmv: Number(r.bmv), kmv: Number(r.kmv), kdv: Number(r.kdv),
            toplamVergi: (Number(r.bmv) || 0) + (Number(r.kmv) || 0) + (Number(r.kdv) || 0), vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }));
        return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}`);
    },
    /** R8 Vezne bakiye raporu (tarih bazlı) */
    async VEZBAK1(pool, p, t) {
        if (!p.tarih)
            throw ApiError.badRequest("Tarih zorunludur.");
        const kur = await kurCoz(pool, p);
        const rows = await vezneBakiyeleri(pool, p.tarih, p);
        const paraSet = new Set((p.paraIdler || []).map(Number));
        const satirlar = rows.filter(r => (!p.paraId || r.paraId === p.paraId) && (!paraSet.size || paraSet.has(Number(r.paraId)))).map(r => ({ ...r, miktar: Number(r.miktar), kur: kur.kurlar.get(r.paraId) ?? 0,
            tlKarsiligi: Number(r.miktar) * (kur.kurlar.get(r.paraId) ?? 0), vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }));
        return sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p) || " · Tüm vezneler"} · ${kur.aciklama}`, VEZNE_BAKIYE_DIPNOT);
    },
    /** R9 Vezne hareket listesi — tarih + saat aralığı */
    async VEZHAR1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
            .input("sbas", sql.VarChar(8), p.baslangicSaat || "00:00:00").input("sbit", sql.VarChar(8), p.bitisSaat || "23:59:59")
            .input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
        const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
        const res = await req.query(`
      SELECT F.FIS_ID fisId, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, ISNULL(F.ZAMAN,F.TARIH) zaman, F.TIP tipKod,
        RTRIM(ISNULL(F.SERI_NO,''))+RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan, RTRIM(P.KOD) paraKod,
        S.MIKTAR miktar, S.KUR kur, S.TUTAR tutar, S.KOMISYON komisyon, S.BMV bmv
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit
        AND CAST(ISNULL(F.ZAMAN,F.TARIH) AS time) BETWEEN CAST(@sbas AS time) AND CAST(@sbit AS time)
        AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY V.KOD, ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
        const satirlar = res.recordset.map((r) => ({ ...r, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış", miktar: Number(r.miktar), kur: Number(r.kur), tutar: Number(r.tutar), komisyon: Number(r.komisyon), bmv: Number(r.bmv),
            vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }));
        return sinirla(satirlar, t, `${aralikOzeti(p)} · ${(p.baslangicSaat || "00:00").slice(0, 5)}–${(p.bitisSaat || "23:59").slice(0, 5)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : ""}`, "İptal edilmiş fişler listelenmez.");
    },
};
