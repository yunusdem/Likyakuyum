import zlib from "zlib";
import sql from "mssql";
import { n, q, tamAd } from "./aktarimSema.js";
/**
 * Aktarım izi ve canlı firma kilidi (docs/VERITABANI_TASIMA_YOL_HARITASI.md, K24 — 20.11.2026, aktarılan firma aynı gün canlıya geçti).
 *
 * Aktarım firmadaki verileri yedektekilerle DEĞİŞTİRİR: firmaya aktarımdan sonra kayıt girildiyse yeniden aktarım o kayıtları silerdi.
 * Her aktarımda, doğrulama geçtikten sonra ve COMMIT'ten hemen önce (aynı işlemde, yani tam olarak yedekten gelen hâl) aktarımın
 * yazdığı her tablonun satır sayısı + içerik özeti (CHECKSUM_AGG(BINARY_CHECKSUM(*))) okunur, COMMIT'ten sonra firma veritabanına
 * veritabanı düzeyinde genişletilmiş özellik olarak yazılır (LKY_AKTARIM_IZI). Özellik veritabanının içinde durur: yedekle taşınır,
 * tablo listesine, şemaya ve satır sayılarına girmez; yükleme silinse de kalır.
 *
 * Sonraki inceleme ve aktarımda iz yeniden hesaplanır: tek bir tabloda satır eklenmiş, silinmiş ya da değiştirilmişse firma
 * kullanılmıştır → CANLI_FIRMA engeli (onayla geçilmez). İzden önceki sürümle aktarılmış firmalarda (iz yok) son başarılı aktarım
 * raporundaki satır sayılarıyla karşılaştırılır; rapor da yoksa ve merkez kaydında aktarım görünüyorsa yine engellenir.
 */
export const IZ_OZELLIGI = "LKY_AKTARIM_IZI";
export const BOS_GECMIS = { zaman: null, iz: null, tablolar: null, korunanKullanici: 0, kayitVar: false };
/** BINARY_CHECKSUM'a giremeyen tipler: image, text, ntext, xml, CLR (geometry / geography / hierarchyid) */
const KARSILASTIRILAMAZ = new Set([34, 35, 99, 241, 240]);
/**
 * Tabloların satır sayısı + içerik özeti (yalnız okur). Var olmayan tablo null. Özet hesaplanmış kolonlar dışındaki karşılaştırılabilir
 * kolonlarla; sinir verilen tabloda yalnız o kolon numarasına kadarki kolonlarla (izden sonra eklenen kolon özete girmez).
 */
export const tabloOzetleri = async (istek, db, tablolar, sinir = {}) => {
    const kolonlar = new Map();
    for (const k of (await istek().query(`
      SELECT t.name AS T, c.name AS K, c.column_id AS I, c.system_type_id AS Y, c.is_computed AS H
      FROM ${q(db)}.sys.columns c JOIN ${q(db)}.sys.tables t ON t.object_id = c.object_id
      WHERE t.schema_id = 1 AND t.is_ms_shipped = 0`)).recordset) {
        const ad = String(k.T).toUpperCase();
        if (!kolonlar.has(ad))
            kolonlar.set(ad, []);
        kolonlar.get(ad).push({ ad: k.K, no: Number(k.I), tip: Number(k.Y), hesaplanan: !!k.H });
    }
    const sonuc = {};
    const sorgular = [];
    for (const t of tablolar) {
        const tk = kolonlar.get(t.toUpperCase());
        if (!tk) {
            sonuc[t] = null;
            continue;
        }
        const son = sinir[t] ?? Math.max(...tk.map((k) => k.no));
        const giren = tk.filter((k) => k.no <= son && !k.hesaplanan && !KARSILASTIRILAMAZ.has(k.tip)).sort((a, b) => a.no - b.no);
        const ozet = giren.length ? `CHECKSUM_AGG(BINARY_CHECKSUM(${giren.map((k) => q(k.ad)).join(", ")}))` : "CAST(NULL AS int)";
        sorgular.push({ tablo: t, kolon: son, sql: `COUNT_BIG(*) AS N, ${ozet} AS O FROM ${tamAd(db, t)}` });
    }
    for (let i = 0; i < sorgular.length; i += 25) {
        const parca = sorgular.slice(i, i + 25);
        const r = await istek().query(parca.map((s, j) => `SELECT ${j} AS I, ${s.sql}`).join(" UNION ALL "));
        for (const x of r.recordset) {
            const s = parca[Number(x.I)];
            sonuc[s.tablo] = { satir: Number(x.N), ozet: x.O === null || x.O === undefined ? null : Number(x.O), kolon: s.kolon };
        }
    }
    return sonuc;
};
/** Verilen tabloların izini çıkarır (aktarım işleminin içinde çağrılır: tam olarak yedekten gelen hâl). */
export const izCikar = async (istek, db, tablolar) => {
    const ozet = await tabloOzetleri(istek, db, tablolar);
    const t = {};
    for (const [ad, o] of Object.entries(ozet))
        if (o)
            t[ad] = [o.satir, o.ozet, o.kolon];
    return { surum: 1, zaman: new Date().toISOString(), tablolar: t };
};
/** Saf: izi genişletilmiş özelliğe sığacak metne çevirir (sıkıştırılmış JSON). */
export const izKodla = (iz) => "z1:" + zlib.deflateRawSync(Buffer.from(JSON.stringify(iz), "utf8")).toString("base64");
/** Saf: izKodla'nın tersi; bozuk metinde hata fırlatır. */
export const izCoz = (metin) => {
    if (!metin.startsWith("z1:"))
        throw new Error("tanınmayan iz biçimi");
    const iz = JSON.parse(zlib.inflateRawSync(Buffer.from(metin.slice(3), "base64")).toString("utf8"));
    if (iz?.surum !== 1 || !iz.tablolar || typeof iz.tablolar !== "object")
        throw new Error("iz içeriği geçersiz");
    for (const v of Object.values(iz.tablolar))
        if (!Array.isArray(v) || typeof v[0] !== "number")
            throw new Error("iz içeriği geçersiz");
    return iz;
};
/** İzi firma veritabanına yazar (veritabanı düzeyi genişletilmiş özellik; sahibi / db_owner yazabilir). */
export const izYaz = async (pool, db, iz) => {
    const deger = izKodla(iz);
    // sp_addextendedproperty değeri en çok 7.500 bayt
    if (deger.length > 7400)
        throw new Error(`Aktarım izi çok büyük (${deger.length} karakter).`);
    await new sql.Request(pool)
        .input("ad", sql.NVarChar(128), IZ_OZELLIGI)
        .input("deger", sql.VarChar(7500), deger).query(`
      EXEC ${q(db)}.sys.sp_executesql N'
        IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE class = 0 AND name = @ad)
          EXEC sys.sp_updateextendedproperty @name = @ad, @value = @deger;
        ELSE
          EXEC sys.sp_addextendedproperty @name = @ad, @value = @deger;',
        N'@ad sysname, @deger varchar(7500)', @ad = @ad, @deger = @deger;`);
};
/** Firmadaki izi okur; yoksa null, bozuksa hata. */
export const izOku = async (pool, db) => {
    const r = (await new sql.Request(pool).query(`SELECT CAST(value AS varchar(8000)) AS V FROM ${q(db)}.sys.extended_properties WHERE class = 0 AND name = ${n(IZ_OZELLIGI)}`)).recordset;
    if (!r.length || r[0].V === null || r[0].V === undefined)
        return null;
    return izCoz(String(r[0].V));
};
/** Saf: izdeki tabloların şimdiki özetle farkları (satır sayısı ya da içerik). */
export const izFarklari = (iz, simdi) => Object.entries(iz.tablolar).flatMap(([tablo, [satir, ozet]]) => {
    const s = simdi[tablo];
    if (!s)
        return [{ tablo, once: satir, simdi: null }];
    return s.satir !== satir || s.ozet !== ozet ? [{ tablo, once: satir, simdi: s.satir }] : [];
});
/** İzin kolon sınırları (karşılaştırma izdeki kolonlarla yapılır). */
const izSinirlari = (iz) => Object.fromEntries(Object.entries(iz.tablolar).filter(([, v]) => typeof v[2] === "number").map(([t, v]) => [t, v[2]]));
const binlik = (x) => x.toLocaleString("tr-TR");
/** Saf: farkların okunur listesi (en çok 8 tablo). */
export const farkListesi = (farklar) => {
    const metin = farklar
        .slice(0, 8)
        .map((f) => f.simdi === null
        ? `${f.tablo}: tablo yok`
        : f.simdi === f.once
            ? `${f.tablo}: kayıt değiştirilmiş`
            : `${f.tablo}: ${binlik(f.once)} → ${binlik(f.simdi)} satır`)
        .join(", ");
    return farklar.length > 8 ? `${metin} ve ${farklar.length - 8} tablo daha` : metin;
};
const tarihYaz = (z) => {
    if (!z)
        return null;
    const d = new Date(z);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
};
const KILIT_SONU = "Firma kullanımda: aktarım bu kayıtları yedektekilerle değiştirip silerdi; bu firmaya yeniden aktarım yapılamaz (onayla da geçilmez). " +
    "Eski veri gerekiyorsa yeni bir firma açılıp oraya aktarılır.";
/**
 * Firma son aktarımdan sonra kullanılmış mı (K24). Kullanılmışsa CANLI_FIRMA ENGEL; iz yoksa satır sayıları rapordakiyle aynıysa
 * AKTARIM_IZI_YOK UYARI. Hiç aktarım yapılmamış firma için boş döner (ilk aktarım; firmadaki kayıtlar için ayrı uyarılar var).
 */
export const sonradanKullanim = async (pool, db, gecmis = BOS_GECMIS) => {
    const istek = () => new sql.Request(pool);
    // Veritabanı yoksa kilit konusu değil (aktarımın kendi denetimi "sunucuda yok" der)
    if ((await istek().query(`SELECT DB_ID(${n(db)}) AS I`)).recordset[0].I === null)
        return [];
    let iz;
    try {
        iz = (await izOku(pool, db)) ?? gecmis.iz;
    }
    catch (err) {
        return [
            {
                kod: "CANLI_FIRMA",
                seviye: "ENGEL",
                mesaj: `Firmanın aktarım izi okunamadı (${String(err?.message || err).slice(0, 200)}); firmada aktarımdan sonra kayıt girilip girilmediği anlaşılamıyor. ${KILIT_SONU}`,
            },
        ];
    }
    const basi = (z) => `Bu firmaya ${tarihYaz(z) ? `${tarihYaz(z)} tarihinde` : "daha önce"} veri aktarıldı`;
    if (iz) {
        const farklar = izFarklari(iz, await tabloOzetleri(istek, db, Object.keys(iz.tablolar), izSinirlari(iz)));
        if (!farklar.length)
            return [];
        return [{ kod: "CANLI_FIRMA", seviye: "ENGEL", mesaj: `${basi(iz.zaman)}; o zamandan beri firmada kayıt girilmiş ya da değiştirilmiş (${farkListesi(farklar)}). ${KILIT_SONU}` }];
    }
    if (gecmis.tablolar?.length) {
        // İzden önceki sürüm: aktarımın yazdığı satır sayıları (şablondan temizlenen tablolar 0, kullanıcı tablosuna firma açılış kullanıcıları eklenir)
        const beklenen = gecmis.tablolar
            .filter((t) => t.islem === "KOPYALA" || t.islem === "SABLON_TEMIZLE")
            .map((t) => ({
            tablo: t.tablo,
            satir: t.islem === "KOPYALA" ? Number(t.yazilan) + (t.tablo.toUpperCase() === "TODVZ_KULLANICI" ? gecmis.korunanKullanici : 0) : 0,
        }));
        const simdi = await tabloOzetleri(istek, db, beklenen.map((b) => b.tablo));
        const farklar = beklenen
            .filter((b) => (simdi[b.tablo]?.satir ?? null) !== b.satir)
            .map((b) => ({ tablo: b.tablo, once: b.satir, simdi: simdi[b.tablo]?.satir ?? null }));
        if (farklar.length) {
            return [{ kod: "CANLI_FIRMA", seviye: "ENGEL", mesaj: `${basi(gecmis.zaman)}; o zamandan beri firmada kayıt girilmiş ya da silinmiş (${farkListesi(farklar)}). ${KILIT_SONU}` }];
        }
        return [
            {
                kod: "AKTARIM_IZI_YOK",
                seviye: "UYARI",
                mesaj: `${basi(gecmis.zaman)} (iz tutmayan önceki sürümle). Tabloların satır sayıları o aktarımdakiyle aynı; firmada kayıt girilmemiş görünüyor. Bu aktarımdan sonra firmanın izi tutulur.`,
            },
        ];
    }
    if (gecmis.kayitVar) {
        return [
            {
                kod: "CANLI_FIRMA",
                seviye: "ENGEL",
                mesaj: `${basi(gecmis.zaman)}, ancak o aktarımın raporu ve izi bulunamadı (yükleme silinmiş olabilir); firmada sonradan kayıt girilip girilmediği anlaşılamıyor. ${KILIT_SONU}`,
            },
        ];
    }
    return [];
};
/** Firmanın izini şimdiki hâliyle yeniler (yalnız izi olan firmada). Çift aktarımı eşin veritabanına da yazdığı için eşte çağrılır. */
export const izYenile = async (pool, db) => {
    const eski = await izOku(pool, db);
    if (!eski)
        return false;
    await izYaz(pool, db, await izCikar(() => new sql.Request(pool), db, Object.keys(eski.tablolar)));
    return true;
};
/**
 * Firmadan bizim sistemle (taslak olmayan) e-belge gönderilmiş mi (K22). Gönderilmişse firma canlıdır: CANLI_FIRMA ENGEL.
 * Aktarım izinden bağımsız ikinci kilit (iz silinse de çalışır).
 */
/** Firmadan bizim sistemle gönderilmiş (taslak olmayan) e-belge sayısı. */
export const gonderilenEBelgeSayisi = async (pool, db) => {
    const kolonVar = async (kolon) => (await new sql.Request(pool).query(`SELECT COL_LENGTH(${n(`${db}.dbo.TODVZ_EBELGE_GIDEN`)}, ${n(kolon)}) AS L`)).recordset[0].L !== null;
    if (!(await kolonVar("GONDERIM_DURUMU")))
        return 0;
    // Taslak (deneme) gönderimleri sayılmaz: yalnız gerçekten kesilmiş belgeler firmayı "canlı" yapar
    const taslakDisi = (await kolonVar("TASLAK_MI")) ? " AND ISNULL(TASLAK_MI, 0) = 0" : "";
    return Number((await new sql.Request(pool).query(`SELECT COUNT_BIG(*) AS N FROM ${tamAd(db, "TODVZ_EBELGE_GIDEN")} WHERE GONDERIM_DURUMU = 'GONDERILDI'${taslakDisi}`)).recordset[0].N) || 0;
};
export const eBelgeGonderimi = async (pool, db) => {
    const giden = await gonderilenEBelgeSayisi(pool, db);
    if (!giden)
        return [];
    return [
        {
            kod: "CANLI_FIRMA",
            seviye: "ENGEL",
            mesaj: `Bu firmadan bizim sistemle ${giden} e-belge gönderilmiş: firma canlı kullanımda. Aktarım, bizim sistemde girilen bütün kayıtları yedektekilerle değiştirir; bu firmaya aktarım yapılamaz.`,
        },
    ];
};
/** Aktarımı başlatmadan önce bakılan kilitler: e-belge gönderimi + son aktarımdan sonra kullanım. Yalnız ENGEL'ler. */
export const canliFirmaEngelleri = async (pool, db, gecmis = BOS_GECMIS) => [...(await eBelgeGonderimi(pool, db)), ...(await sonradanKullanim(pool, db, gecmis))].filter((e) => e.seviye === "ENGEL");
