import sql from "mssql";
import { planOlustur } from "./aktarimPlani.js";
import { kolonBul, n, q, semaOku, tabloBul, tamAd, tipTanimi } from "./aktarimSema.js";
/** Hedefte, kaynakta adı olmayan satırlara (firma açılışındaki kullanıcılar) izin verilen tablolar: tablo → ad kolonu */
const FAZLA_IZINLI = { TODVZ_KULLANICI: "AD" };
const NULL_ISARETI = "N'∅'";
const AYRAC = "NCHAR(31)";
/** Değeri hedef tipine göre kararlı metne çevirir (özet için). */
export const normalIfade = (ifade, k) => {
    const t = k.tip;
    const c = `CAST(${ifade} AS ${tipTanimi(k)})`;
    if (t === "float" || t === "real")
        return `CONVERT(varchar(40), CAST(${c} AS float), 3)`;
    if (["decimal", "numeric", "money", "smallmoney", "tinyint", "smallint", "int", "bigint", "bit"].includes(t))
        return `CONVERT(varchar(60), ${c})`;
    if (["datetime", "datetime2", "smalldatetime", "date"].includes(t))
        return `CONVERT(varchar(40), CAST(${c} AS datetime2(7)), 126)`;
    if (t === "time")
        return `CONVERT(varchar(30), ${c})`;
    if (t === "datetimeoffset")
        return `CONVERT(varchar(50), ${c}, 127)`;
    if (["varbinary", "binary", "image"].includes(t))
        return `CONVERT(varchar(max), CAST(${c} AS varbinary(max)), 2)`;
    if (t === "uniqueidentifier")
        return `CONVERT(varchar(36), ${c})`;
    return `CAST(${c} AS nvarchar(max))`;
};
const ozetIfadesi = (parcalar) => parcalar.length === 0 ? "CAST(0x00 AS varbinary(32))" : `HASHBYTES('SHA2_256', CONCAT(${parcalar.map((p) => `ISNULL(${p}, ${NULL_ISARETI})`).join(`, ${AYRAC}, `)}, N''))`;
const metinMi = (k) => ["varchar", "char", "nvarchar", "nchar", "text", "ntext"].includes(k.tip);
// Metin anahtar ikili (BIN2) karşılaştırılır: DATABASE_DEFAULT bağlamın harf düzenidir (canlı sunucuda master = SQL_Latin1, büyük/küçük
// harf duyarsız) — Türkçe'de ayrı olan "KADIR" / "kadir" orada aynı sayılıp eşleşmeyi bozabilirdi. Değer birebir kopyalandığı için tam eşitlik doğru ölçü.
// Kullanıcı adı karşılaştırması: motor (aktarimMotoru) firma veritabanının harf düzeniyle (Turkish_CI_AS) eşler; doğrulama da aynı
// ölçüyü kullanmalı. DATABASE_DEFAULT canlıda master'ın düzenidir (SQL_Latin1): varchar adı 1252'ye çevirir, Ş/Ğ/İ bozulurdu.
const adIfadesi = (ifade) => `UPPER(RTRIM(CAST(${ifade} AS nvarchar(200)))) COLLATE Turkish_CI_AS`;
const anahtarIfadesi = (ifade, k) => (metinMi(k) ? `CAST(${ifade} AS nvarchar(450)) COLLATE Latin1_General_BIN2` : ifade);
const tek = async (b, sorgu) => (await new sql.Request(b).query(sorgu)).recordset[0] || {};
const coklu = async (b, sorgu) => (await new sql.Request(b).query(sorgu)).recordset;
const sayiMetni = (v) => (v === null || v === undefined ? null : String(v));
/**
 * Eski programın görünümleriyle anlam denetimi (19.11.2026 denetimi). Tablolar birebir kopyalansa da yeni sürümün aynı adlı görünümü
 * veriyi farklı yorumlayabilir: fişteki KMV bilgisi yanlış kodlandığında e-Döviz belgelerinin ödenecek tutarı değişiyordu (satır
 * özetleri kuralla hesaplandığı için bunu göremez). Bizim e-Döviz gönderimi ve belge çıktısı tutarı bu görünümden okur.
 * Eski sarraf fişi yapısı (kuyum, taslak kurallar) cari ve vezne bakiyesine yeni yapıda aynı şekilde yansımaz; bakiye görünümleri
 * bunu da yakalar. anahtar: satırı tanımlayan kolonlar; deger: karşılaştırılan tutarlar; sifirHaric: sıfır bakiyeli satırlar sayılmaz.
 */
export const GORUNUM_KAPILARI = [
    { gorunum: "VODVZ_E_DOVIZ_BELGESI_XSLT", ad: "e-Döviz belge tutarları", anahtar: ["UUID", "ID"], deger: ["PayableAmount", "TaxInclusiveAmount", "TaxExclusiveAmount", "TaxAmount", "LineExtensionAmount"], sifirHaric: false, taslaktaUyari: false },
    { gorunum: "VODVZR_CARI_BAKIYE_RAPORU", ad: "Cari bakiyeleri", anahtar: ["CARI_KART_ID", "PARA_ID"], deger: ["BAKIYE"], sifirHaric: true, taslaktaUyari: true },
    { gorunum: "VODVZ_VEZNE_BAKIYE", ad: "Vezne bakiyeleri", anahtar: ["VEZNE_ID", "PARA_ID"], deger: ["MIKTAR"], sifirHaric: true, taslaktaUyari: true },
    { gorunum: "VODVZR_HESAP_BAKIYE_RAPORU", ad: "Kasa hesap bakiyeleri", anahtar: ["HESAP_ID", "PARA_ID"], deger: ["BAKIYE"], sifirHaric: true, taslaktaUyari: true },
];
export const gorunumKontrolleri = async (baglanti, plan) => {
    const k = [];
    // Taslak (sarraf) kuralları yönetici onayıyla kullanıldıysa bakiye farkı aktarımı durdurmaz, uyarı olarak raporlanır (deneme aktarımı, K8)
    const taslak = plan.engeller.some((e) => e.kod === "TASLAK_KURAL");
    for (const g of GORUNUM_KAPILARI) {
        const kolonlar = async (db) => {
            const r = await coklu(baglanti, `SELECT c.name AS K FROM ${q(db)}.sys.columns c WHERE c.object_id = OBJECT_ID(${n(`${db}.dbo.${g.gorunum}`)}, 'V')`);
            return r.length ? r.map((x) => String(x.K).toUpperCase()) : null;
        };
        try {
            const kk = await kolonlar(plan.kaynakDb), hk = await kolonlar(plan.hedefDb);
            if (!kk || !hk)
                continue; // görünüm bir yanda yok (eski program olmayan / çok eski sürüm): denetlenmez
            const ortak = (ad) => kk.includes(ad.toUpperCase()) && hk.includes(ad.toUpperCase());
            const degerler = g.deger.filter(ortak);
            if (!g.anahtar.every(ortak) || !degerler.length)
                continue;
            // Metin anahtarlar iki yanda açık (ikili) harf düzeniyle: bağlamın düzeni (canlıda master = SQL_Latin1) ve iki veritabanınınki farklı olabilir
            const sec = (db) => `SELECT ${g.anahtar.map((a, i) => `CAST(RTRIM(CAST(${q(a)} AS varchar(100))) AS varchar(100)) COLLATE Latin1_General_BIN2 AS A${i}`).join(", ")}, ` +
                `${degerler.map((d, i) => `CAST(ROUND(ISNULL(${q(d)}, 0), 4) AS decimal(38, 4)) AS D${i}`).join(", ")} FROM ${tamAd(db, g.gorunum)}` +
                (g.sifirHaric ? ` WHERE ${degerler.map((d) => `ABS(ISNULL(${q(d)}, 0)) >= 0.00005`).join(" OR ")}` : "");
            const eslesme = g.anahtar.map((_a, i) => `X.A${i} = Y.A${i}`).join(" AND ");
            const farkKosulu = `X.A0 IS NULL OR Y.A0 IS NULL OR ${degerler.map((_d, i) => `X.D${i} <> Y.D${i}`).join(" OR ")}`;
            const govde = `FROM (${sec(plan.kaynakDb)}) X FULL OUTER JOIN (${sec(plan.hedefDb)}) Y ON ${eslesme}`;
            const x = await tek(baglanti, `SELECT SUM(CASE WHEN X.A0 IS NOT NULL THEN 1 ELSE 0 END) AS KS, SUM(CASE WHEN ${farkKosulu} THEN 1 ELSE 0 END) AS FARK ${govde}`);
            const ks = Number(x.KS || 0), fark = Number(x.FARK || 0);
            let ornekler;
            if (fark > 0) {
                const o = await coklu(baglanti, `
          SELECT TOP 5 ${g.anahtar.map((_a, i) => `COALESCE(X.A${i}, Y.A${i}) AS A${i}`).join(", ")}, X.D0 AS KD, Y.D0 AS HD ${govde}
          WHERE ${farkKosulu} ORDER BY ${g.anahtar.map((_a, i) => `COALESCE(X.A${i}, Y.A${i})`).join(", ")}`);
                ornekler = o.map((r) => `${g.anahtar.map((a, i) => `${a}=${String(r[`A${i}`]).trim()}`).join(" ")}: eski ${r.KD ?? "-"}, yeni ${r.HD ?? "-"}`);
            }
            k.push({
                grup: "GORUNUM",
                tablo: g.gorunum,
                ad: `${g.ad} eski programın gösterdiğiyle aynı (${degerler.join(", ")})`,
                durum: fark === 0 ? "TAMAM" : taslak && g.taslaktaUyari ? "UYARI" : "FARK",
                kaynak: ks,
                hedef: ks - fark,
                ayrinti: fark
                    ? `${fark} kayıt eski programdakinden farklı görünüyor.` + (taslak && g.taslaktaUyari ? " Taslak (sarraf) kurallarıyla aktarıldı; canlıya alınmadan önce giderilmeli." : "")
                    : undefined,
                ornekler,
            });
        }
        catch (err) {
            k.push({ grup: "GORUNUM", tablo: g.gorunum, ad: `${g.ad} karşılaştırılamadı (görünüm çalışmadı)`, durum: "UYARI", ayrinti: String(err?.message || err).slice(0, 300) });
        }
    }
    return k;
};
export const dogrula = async (baglanti, plan, secenek = {}) => {
    const bas = Date.now();
    const ornekSayisi = secenek.ornekSayisi ?? 5;
    const kontroller = [];
    const ekle = (k) => kontroller.push(k);
    const hedefSema = await semaOku(baglanti, plan.hedefDb);
    const kaynakSema = await semaOku(baglanti, plan.kaynakDb);
    const kopyalanan = plan.tablolar.filter((t) => t.islem === "KOPYALA");
    let toplamSatir = 0;
    for (const tp of kopyalanan) {
        const ht = tabloBul(hedefSema, tp.tablo);
        const kt = tabloBul(kaynakSema, tp.tablo);
        if (!ht || !kt) {
            ekle({ grup: "SATIR_SAYISI", tablo: tp.tablo, ad: "Tablo", durum: "FARK", ayrinti: "Tablo kaynakta ya da hedefte bulunamadı." });
            continue;
        }
        const K = tamAd(plan.kaynakDb, tp.tablo);
        const H = tamAd(plan.hedefDb, tp.tablo);
        const fazlaKolon = FAZLA_IZINLI[tp.tablo.toUpperCase()];
        const fazlaKosulu = fazlaKolon && kolonBul(ht, fazlaKolon) && kolonBul(kt, fazlaKolon)
            ? `NOT EXISTS (SELECT 1 FROM ${K} KK WHERE ${adIfadesi(`KK.${q(fazlaKolon)}`)} = ${adIfadesi(`H.${q(fazlaKolon)}`)})`
            : null;
        // 1) Satır sayısı
        const sayi = await tek(baglanti, `SELECT (SELECT COUNT_BIG(*) FROM ${K}) AS KS, (SELECT COUNT_BIG(*) FROM ${H}) AS HS${fazlaKosulu ? `, (SELECT COUNT_BIG(*) FROM ${H} H WHERE ${fazlaKosulu}) AS FZ` : ""}`);
        const ks = Number(sayi.KS), hs = Number(sayi.HS), fz = Number(sayi.FZ || 0);
        toplamSatir += ks;
        ekle({
            grup: "SATIR_SAYISI",
            tablo: tp.tablo,
            ad: "Satır sayısı",
            durum: ks === hs - fz ? "TAMAM" : "FARK",
            kaynak: ks,
            hedef: hs,
            ayrinti: fz ? `${fz} satır firma açılışından (kaynakta yok, korunuyor)` : undefined,
        });
        if (fz)
            ekle({ grup: "KULLANICI", tablo: tp.tablo, ad: "Firma açılışından korunan kayıt", durum: "BILGI", hedef: fz });
        if (ks === 0 && hs - fz === 0)
            continue;
        // 2) İçerik özeti
        const kolonlar = tp.kolonlar
            .filter((kp) => !kp.karsilastirmaDisi)
            .map((kp) => ({ kp, hk: kolonBul(ht, kp.hedef) }))
            .filter((x) => !!x.hk);
        const det = kolonlar.filter((x) => x.kp.deterministik);
        const kaynakOzet = ozetIfadesi(det.map((x) => normalIfade(x.kp.ifade, x.hk)));
        const hedefOzet = ozetIfadesi(det.map((x) => normalIfade(`H.${q(x.hk.ad)}`, x.hk)));
        const hedefFiltre = fazlaKosulu ? `WHERE NOT (${fazlaKosulu})` : "";
        if (tp.anahtar.length) {
            const anahtarlar = tp.anahtar.map((a, i) => {
                const hk = kolonBul(ht, a);
                const kp = tp.kolonlar.find((x) => x.hedef.toUpperCase() === a.toUpperCase());
                return { ad: `A${i}`, kaynak: anahtarIfadesi(kp.ifade, hk), hedef: anahtarIfadesi(`H.${q(hk.ad)}`, hk) };
            });
            const r = await tek(baglanti, `
        SELECT SUM(CASE WHEN X.O IS NULL THEN 1 ELSE 0 END) AS FAZLA,
               SUM(CASE WHEN Y.O IS NULL THEN 1 ELSE 0 END) AS EKSIK,
               SUM(CASE WHEN X.O IS NOT NULL AND Y.O IS NOT NULL AND X.O <> Y.O THEN 1 ELSE 0 END) AS FARKLI
        FROM (SELECT ${anahtarlar.map((a) => `${a.kaynak} AS ${a.ad}`).join(", ")}, ${kaynakOzet} AS O FROM ${K} K) X
        FULL OUTER JOIN (SELECT ${anahtarlar.map((a) => `${a.hedef} AS ${a.ad}`).join(", ")}, ${hedefOzet} AS O FROM ${H} H ${hedefFiltre}) Y
          ON ${anahtarlar.map((a) => `X.${a.ad} = Y.${a.ad}`).join(" AND ")}`);
            const fazla = Number(r.FAZLA || 0), eksik = Number(r.EKSIK || 0), farkli = Number(r.FARKLI || 0);
            let ornekler;
            if (fazla + eksik + farkli > 0) {
                const o = await coklu(baglanti, `
          SELECT TOP (${ornekSayisi}) CASE WHEN X.O IS NULL THEN N'hedefte fazla' WHEN Y.O IS NULL THEN N'hedefte eksik' ELSE N'içerik farklı' END AS NEDEN,
                 CONCAT(${anahtarlar.map((a) => `N'${tp.anahtar[Number(a.ad.slice(1))]}=', CAST(COALESCE(X.${a.ad}, Y.${a.ad}) AS nvarchar(200))`).join(", N' ', ")}) AS ANAHTAR
          FROM (SELECT ${anahtarlar.map((a) => `${a.kaynak} AS ${a.ad}`).join(", ")}, ${kaynakOzet} AS O FROM ${K} K) X
          FULL OUTER JOIN (SELECT ${anahtarlar.map((a) => `${a.hedef} AS ${a.ad}`).join(", ")}, ${hedefOzet} AS O FROM ${H} H ${hedefFiltre}) Y
            ON ${anahtarlar.map((a) => `X.${a.ad} = Y.${a.ad}`).join(" AND ")}
          WHERE X.O IS NULL OR Y.O IS NULL OR X.O <> Y.O`);
                ornekler = o.map((x) => `${x.ANAHTAR}: ${x.NEDEN}`);
            }
            ekle({
                grup: "ICERIK",
                tablo: tp.tablo,
                ad: `Satır içerikleri (${det.length} kolon, anahtar ${tp.anahtar.join("+")})`,
                durum: fazla + eksik + farkli === 0 ? "TAMAM" : "FARK",
                kaynak: ks,
                hedef: hs - fz,
                ayrinti: fazla + eksik + farkli ? `${farkli} satır farklı, ${eksik} satır eksik, ${fazla} satır fazla` : undefined,
                ornekler,
            });
        }
        else {
            const r = await tek(baglanti, `
        SELECT SUM(ABS(ISNULL(X.C, 0) - ISNULL(Y.C, 0))) AS FARK, SUM(CASE WHEN X.C IS NULL OR Y.C IS NULL OR X.C <> Y.C THEN 1 ELSE 0 END) AS GRUP
        FROM (SELECT O, COUNT_BIG(*) AS C FROM (SELECT ${kaynakOzet} AS O FROM ${K} K) Z GROUP BY O) X
        FULL OUTER JOIN (SELECT O, COUNT_BIG(*) AS C FROM (SELECT ${hedefOzet} AS O FROM ${H} H ${hedefFiltre}) Z GROUP BY O) Y ON X.O = Y.O`);
            const fark = Number(r.FARK || 0);
            ekle({
                grup: "ICERIK",
                tablo: tp.tablo,
                ad: `Satır içerikleri (${det.length} kolon, anahtarsız: özet kümesi)`,
                durum: fark === 0 ? "TAMAM" : "FARK",
                kaynak: ks,
                hedef: hs - fz,
                ayrinti: fark ? `${fark} satırın özeti eşleşmiyor` : undefined,
            });
        }
        // 3) Doluluk (deterministik olmayan kolonlar)
        for (const x of kolonlar.filter((y) => !y.kp.deterministik)) {
            const r = await tek(baglanti, `SELECT COUNT_BIG(*) AS N FROM ${H} H WHERE H.${q(x.hk.ad)} IS NOT NULL ${fazlaKosulu ? `AND NOT (${fazlaKosulu})` : ""}`);
            ekle({ grup: "DOLULUK", tablo: tp.tablo, ad: `${x.hk.ad} dolu (${x.kp.kural || "yeni değer"})`, durum: Number(r.N) === ks ? "TAMAM" : "FARK", kaynak: ks, hedef: Number(r.N) });
        }
        // 4) Sayısal toplamlar (ondalıklı, doğrudan aktarılan kolonlar)
        const sayisal = kolonlar.filter((x) => x.kp.deterministik && ["float", "real", "decimal", "numeric", "money", "smallmoney"].includes(x.hk.tip));
        if (sayisal.length) {
            const sec = (on, ifade, kaynakMi) => sayisal.map((x, i) => `SUM(CAST(ROUND(CAST(${ifade(x)} AS float), 6) AS decimal(38, 6))) AS ${on}${i}`).join(", ") + (kaynakMi ? "" : "");
            const kr = await tek(baglanti, `SELECT ${sec("S", (x) => `CAST(${x.kp.ifade} AS ${tipTanimi(x.hk)})`, true)} FROM ${K} K`);
            const hr = await tek(baglanti, `SELECT ${sec("S", (x) => `H.${q(x.hk.ad)}`, false)} FROM ${H} H ${hedefFiltre}`);
            sayisal.forEach((x, i) => {
                const a = sayiMetni(kr[`S${i}`]), b = sayiMetni(hr[`S${i}`]);
                ekle({ grup: "SAYISAL_TOPLAM", tablo: tp.tablo, ad: `${x.hk.ad} toplamı`, durum: a === b ? "TAMAM" : "FARK", kaynak: a, hedef: b });
            });
        }
    }
    // 5) e-Döviz serileri ve numaratör
    if (tabloBul(kaynakSema, "TODVZ_FIS_SATIRI") && tabloBul(hedefSema, "TODVZ_FIS_SATIRI")) {
        const seri = (db) => coklu(baglanti, `
      SELECT LEFT(RTRIM(BELGE_NO), 7) AS SERI, COUNT_BIG(*) AS N, MAX(RTRIM(BELGE_NO)) AS SON FROM ${tamAd(db, "TODVZ_FIS_SATIRI")}
      WHERE BELGE_NO LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][0-9]%' AND LEN(RTRIM(BELGE_NO)) = 16 GROUP BY LEFT(RTRIM(BELGE_NO), 7)`);
        const ks = await seri(plan.kaynakDb), hs = await seri(plan.hedefDb);
        for (const k of ks) {
            const h = hs.find((x) => x.SERI === k.SERI);
            const ayni = !!h && Number(h.N) === Number(k.N) && h.SON === k.SON;
            ekle({ grup: "E_DOVIZ", tablo: "TODVZ_FIS_SATIRI", ad: `${k.SERI} belge sayısı / son numara`, durum: ayni ? "TAMAM" : "FARK", kaynak: `${k.N} / ${k.SON}`, hedef: h ? `${h.N} / ${h.SON}` : null });
        }
        for (const h of hs.filter((x) => !ks.some((k) => k.SERI === x.SERI))) {
            ekle({ grup: "E_DOVIZ", tablo: "TODVZ_FIS_SATIRI", ad: `${h.SERI} belge sayısı / son numara`, durum: "FARK", kaynak: null, hedef: `${h.N} / ${h.SON}` });
        }
    }
    if (tabloBul(kaynakSema, "TODVZ_NUMERATOR") && tabloBul(hedefSema, "TODVZ_NUMERATOR")) {
        const num = (db) => coklu(baglanti, `SELECT TUR, RTRIM(ONEK) AS ONEK, BASLANGIC FROM ${tamAd(db, "TODVZ_NUMERATOR")} WHERE ONEK LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]%'`);
        const kn = await num(plan.kaynakDb), hn = await num(plan.hedefDb);
        for (const k of kn) {
            const h = hn.find((x) => Number(x.TUR) === Number(k.TUR) && x.ONEK === k.ONEK);
            ekle({ grup: "E_DOVIZ", tablo: "TODVZ_NUMERATOR", ad: `${k.ONEK} sıradaki numara`, durum: h && Number(h.BASLANGIC) === Number(k.BASLANGIC) ? "TAMAM" : "FARK", kaynak: Number(k.BASLANGIC), hedef: h ? Number(h.BASLANGIC) : null });
        }
    }
    // 6) Kullanıcılar
    if (tabloBul(kaynakSema, "TODVZ_KULLANICI") && tabloBul(hedefSema, "TODVZ_KULLANICI")) {
        const eksik = await coklu(baglanti, `
      SELECT RTRIM(K.AD) AS AD FROM ${tamAd(plan.kaynakDb, "TODVZ_KULLANICI")} K
      WHERE NOT EXISTS (SELECT 1 FROM ${tamAd(plan.hedefDb, "TODVZ_KULLANICI")} H WHERE ${adIfadesi("H.AD")} = ${adIfadesi("K.AD")})`);
        ekle({ grup: "KULLANICI", tablo: "TODVZ_KULLANICI", ad: "Müşterinin bütün kullanıcıları hedefte", durum: eksik.length ? "FARK" : "TAMAM", ornekler: eksik.map((x) => String(x.AD)) });
    }
    // 7) Kimlik sayaçları
    for (const tp of kopyalanan) {
        const ht = tabloBul(hedefSema, tp.tablo);
        if (!ht?.kimlikKolonu)
            continue;
        const r = await tek(baglanti, `SELECT IDENT_CURRENT(${n(`${plan.hedefDb}.dbo.${tp.tablo}`)}) AS C, (SELECT MAX(${q(ht.kimlikKolonu)}) FROM ${tamAd(plan.hedefDb, tp.tablo)}) AS M`);
        if (r.M === null || r.M === undefined)
            continue;
        const tamam = Number(r.C) >= Number(r.M);
        if (!tamam)
            ekle({ grup: "KIMLIK", tablo: tp.tablo, ad: "Kimlik sayacı", durum: "FARK", kaynak: Number(r.M), hedef: Number(r.C), ayrinti: "Sayaç en büyük kimliğin altında; yeni kayıt çakışır." });
    }
    ekle({ grup: "KIMLIK", tablo: null, ad: "Kimlik sayaçları en büyük değerin altında değil", durum: kontroller.some((k) => k.grup === "KIMLIK" && k.durum === "FARK") ? "FARK" : "TAMAM" });
    // 8) Şema sağlığı (uyarı)
    const H = q(plan.hedefDb);
    const guvensiz = await coklu(baglanti, `
    SELECT t.name + N'.' + c.name AS A FROM ${H}.sys.foreign_keys c JOIN ${H}.sys.tables t ON t.object_id = c.parent_object_id WHERE c.is_disabled = 1 OR c.is_not_trusted = 1
    UNION ALL SELECT t.name + N'.' + c.name FROM ${H}.sys.check_constraints c JOIN ${H}.sys.tables t ON t.object_id = c.parent_object_id WHERE c.is_disabled = 1 OR c.is_not_trusted = 1`);
    ekle({ grup: "SEMA", tablo: null, ad: "Kapalı / doğrulanmamış kısıt", durum: guvensiz.length ? "UYARI" : "TAMAM", hedef: guvensiz.length, ornekler: guvensiz.slice(0, 20).map((x) => String(x.A)) });
    const kapaliTetik = await coklu(baglanti, `SELECT t.name + N'.' + tr.name AS A FROM ${H}.sys.triggers tr JOIN ${H}.sys.tables t ON t.object_id = tr.parent_id WHERE tr.is_disabled = 1`);
    ekle({ grup: "SEMA", tablo: null, ad: "Kapalı tetik", durum: kapaliTetik.length ? "UYARI" : "TAMAM", hedef: kapaliTetik.length, ornekler: kapaliTetik.slice(0, 20).map((x) => String(x.A)) });
    // 9) Eski programın görünümleri: e-Döviz belge tutarları ve bakiyeler
    kontroller.push(...(await gorunumKontrolleri(baglanti, plan)));
    if (secenek.ekKontroller)
        kontroller.push(...(await secenek.ekKontroller(baglanti, plan)));
    const fark = kontroller.filter((k) => k.durum === "FARK").length;
    return {
        basarili: fark === 0,
        kaynakDb: plan.kaynakDb,
        hedefDb: plan.hedefDb,
        zaman: new Date().toISOString(),
        sureMs: Date.now() - bas,
        ozet: {
            tablo: kopyalanan.length,
            satir: toplamSatir,
            tamam: kontroller.filter((k) => k.durum === "TAMAM").length,
            fark,
            uyari: kontroller.filter((k) => k.durum === "UYARI").length,
        },
        kontroller,
    };
};
/** Aktarımdan bağımsız doğrulama: planı iki veritabanının şemasından yeniden kurar (komut satırı / panel "Yeniden doğrula"). */
export const veritabanlariniDogrula = async (baglanti, kaynakDb, hedefDb, secenek = {}) => {
    // Aktarım bilgisi olmadan: ortama göre yeniden yazılan yapılandırma kolonları (Diğer veritabanı) karşılaştırılmaz
    const plan = planOlustur(kaynakDb, hedefDb, await semaOku(baglanti, kaynakDb), await semaOku(baglanti, hedefDb), { yapilandirmaKarsilastirmaDisi: true });
    return dogrula(baglanti, plan, secenek);
};
/** Raporun konsol / düz metin özeti */
export const raporMetni = (r, yalnizSorunlar = true) => {
    const satirlar = [
        `Doğrulama: ${r.basarili ? "BAŞARILI" : "FARK VAR"} — ${r.kaynakDb} → ${r.hedefDb}`,
        `${r.ozet.tablo} tablo, ${r.ozet.satir} satır; ${r.ozet.tamam} kontrol tamam, ${r.ozet.fark} fark, ${r.ozet.uyari} uyarı (${Math.round(r.sureMs / 100) / 10} sn)`,
    ];
    for (const k of r.kontroller) {
        if (yalnizSorunlar && (k.durum === "TAMAM" || k.durum === "BILGI"))
            continue;
        satirlar.push(`  [${k.durum}] ${k.grup}${k.tablo ? ` ${k.tablo}` : ""}: ${k.ad}` +
            (k.kaynak !== undefined || k.hedef !== undefined ? ` (kaynak ${k.kaynak ?? "-"}, hedef ${k.hedef ?? "-"})` : "") +
            (k.ayrinti ? ` — ${k.ayrinti}` : "") +
            (k.ornekler?.length ? `\n      ${k.ornekler.join("\n      ")}` : ""));
    }
    return satirlar.join("\n");
};
