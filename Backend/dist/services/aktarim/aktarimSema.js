import sql from "mssql";
/** [ad] — köşeli parantez kaçışıyla */
export const q = (ad) => `[${String(ad).replace(/]/g, "]]")}]`;
/** N'metin' */
export const n = (metin) => `N'${String(metin).replace(/'/g, "''")}'`;
export const tamAd = (db, tablo) => `${q(db)}.[dbo].${q(tablo)}`;
const anahtar = (ad) => ad.toUpperCase();
/** Veritabanının dbo tablolarını, kolonlarını, birincil anahtarlarını, satır sayılarını, FK ve tetiklerini okur. */
export const semaOku = async (pool, db, secenek = {}) => {
    const istek = () => new sql.Request(pool);
    const D = q(db);
    const kolonlar = (await istek().query(`
      SELECT t.name AS TABLO, c.name AS KOLON, st.name AS TIP, ut.name AS KTIP, c.max_length AS UZUNLUK, c.precision AS HASSASIYET,
             c.scale AS OLCEK, c.is_nullable AS BOS, c.is_identity AS KIMLIK, c.is_computed AS HESAP, c.column_id AS SIRA,
             dc.definition AS VARSAYILAN
      FROM ${D}.sys.tables t
      JOIN ${D}.sys.schemas s ON s.schema_id = t.schema_id AND s.name = 'dbo'
      JOIN ${D}.sys.columns c ON c.object_id = t.object_id
      JOIN ${D}.sys.types ut ON ut.user_type_id = c.user_type_id
      JOIN ${D}.sys.types st ON st.user_type_id = c.system_type_id
      LEFT JOIN ${D}.sys.default_constraints dc ON dc.object_id = c.default_object_id
      WHERE t.is_ms_shipped = 0
      ORDER BY t.name, c.column_id`)).recordset;
    const pk = (await istek().query(`
      SELECT t.name AS TABLO, c.name AS KOLON, ic.key_ordinal AS SIRA
      FROM ${D}.sys.indexes i
      JOIN ${D}.sys.tables t ON t.object_id = i.object_id
      JOIN ${D}.sys.schemas s ON s.schema_id = t.schema_id AND s.name = 'dbo'
      JOIN ${D}.sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN ${D}.sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE i.is_primary_key = 1
      ORDER BY t.name, ic.key_ordinal`)).recordset;
    const satirlar = (await istek().query(`
      SELECT t.name AS TABLO, SUM(p.rows) AS SATIR
      FROM ${D}.sys.tables t
      JOIN ${D}.sys.schemas s ON s.schema_id = t.schema_id AND s.name = 'dbo'
      JOIN ${D}.sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
      WHERE t.is_ms_shipped = 0
      GROUP BY t.name`)).recordset;
    const fk = (await istek().query(`
      SELECT DISTINCT tp.name AS TABLO, tr.name AS HEDEF
      FROM ${D}.sys.foreign_keys f
      JOIN ${D}.sys.tables tp ON tp.object_id = f.parent_object_id
      JOIN ${D}.sys.tables tr ON tr.object_id = f.referenced_object_id`)).recordset;
    const tetik = (await istek().query(`
      SELECT t.name AS TABLO, tr.name AS AD, tr.is_disabled AS KAPALI,
             CASE WHEN m.definition IS NULL THEN 1 ELSE 0 END AS SIFRELI
             ${secenek.tetikTanimi ? ", m.definition AS TANIM" : ", CAST(NULL AS nvarchar(max)) AS TANIM"}
      FROM ${D}.sys.triggers tr
      JOIN ${D}.sys.tables t ON t.object_id = tr.parent_id
      LEFT JOIN ${D}.sys.sql_modules m ON m.object_id = tr.object_id
      WHERE tr.parent_class = 1`)).recordset;
    const sema = new Map();
    for (const k of kolonlar) {
        const a = anahtar(k.TABLO);
        if (!sema.has(a)) {
            sema.set(a, { ad: k.TABLO, kolonlar: [], birincilAnahtar: [], kimlikKolonu: null, satir: 0, bagliOlduguTablolar: [], tetikler: [] });
        }
        const t = sema.get(a);
        const kolon = {
            ad: k.KOLON,
            tip: String(k.TIP).toLowerCase(),
            kullaniciTipi: String(k.KTIP),
            uzunluk: Number(k.UZUNLUK),
            hassasiyet: Number(k.HASSASIYET),
            olcek: Number(k.OLCEK),
            bosOlabilir: !!k.BOS,
            kimlik: !!k.KIMLIK,
            hesaplanan: !!k.HESAP,
            varsayilan: k.VARSAYILAN ?? null,
            sira: Number(k.SIRA),
        };
        t.kolonlar.push(kolon);
        if (kolon.kimlik)
            t.kimlikKolonu = kolon.ad;
    }
    for (const p of pk)
        sema.get(anahtar(p.TABLO))?.birincilAnahtar.push(p.KOLON);
    for (const s of satirlar) {
        const t = sema.get(anahtar(s.TABLO));
        if (t)
            t.satir = Number(s.SATIR) || 0;
    }
    for (const f of fk) {
        const t = sema.get(anahtar(f.TABLO));
        if (t && !t.bagliOlduguTablolar.includes(f.HEDEF))
            t.bagliOlduguTablolar.push(f.HEDEF);
    }
    for (const r of tetik) {
        sema.get(anahtar(r.TABLO))?.tetikler.push({ ad: r.AD, kapali: !!r.KAPALI, sifreli: !!r.SIFRELI, tanim: r.TANIM ?? null });
    }
    return sema;
};
export const tabloBul = (sema, ad) => sema.get(anahtar(ad));
export const kolonBul = (t, ad) => t?.kolonlar.find((k) => k.ad.toUpperCase() === ad.toUpperCase());
/** Kolonun SQL tip tanımı (CAST hedefi): varchar(20), decimal(18,4), nvarchar(max) … */
export const tipTanimi = (k) => {
    const t = k.tip;
    if (["varchar", "char", "varbinary", "binary"].includes(t))
        return `${t}(${k.uzunluk === -1 ? "max" : k.uzunluk})`;
    if (["nvarchar", "nchar"].includes(t))
        return `${t}(${k.uzunluk === -1 ? "max" : k.uzunluk / 2})`;
    if (["decimal", "numeric"].includes(t))
        return `${t}(${k.hassasiyet},${k.olcek})`;
    if (["datetime2", "time", "datetimeoffset"].includes(t))
        return `${t}(${k.olcek})`;
    return t;
};
/** Metin tiplerinde karakter cinsinden uzunluk (max için null) */
export const karakterUzunlugu = (k) => {
    if (k.uzunluk === -1)
        return null;
    if (["nvarchar", "nchar"].includes(k.tip))
        return k.uzunluk / 2;
    if (["varchar", "char", "varbinary", "binary"].includes(k.tip))
        return k.uzunluk;
    return null;
};
export const METIN_TIPLERI = ["varchar", "char", "nvarchar", "nchar", "text", "ntext"];
export const SAYI_TIPLERI = ["tinyint", "smallint", "int", "bigint", "bit", "decimal", "numeric", "money", "smallmoney", "float", "real"];
export const IKILI_TIPLER = ["varbinary", "binary", "image", "timestamp", "rowversion"];
