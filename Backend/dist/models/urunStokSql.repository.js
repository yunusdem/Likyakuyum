import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
export class UrunStokSqlRepository {
    static async pool(dbContext) {
        return getDbPool(dbContext?.dbServer, dbContext?.dbName);
    }
    /** Ürün + son satış satırı; filtreler SQL'de uygulanır. */
    static async listele(tip, f, dbContext) {
        const pool = await this.pool(dbContext);
        const altin = tip === "altin";
        const tablo = altin ? "TODVZ_ALTIN_URUN" : "TODVZ_OZEL_URUN";
        const idKolon = altin ? "ALTIN_URUN_ID" : "OZEL_URUN_ID";
        const adKolon = altin ? "U.MODEL" : "U.MAMUL_TIPI";
        const birimKolon = altin ? "'GR'" : "U.MIKTAR_BIRIMI";
        const hasGramKolon = altin ? "U.HAS_GRAM" : "NULL";
        // Altın: fatura satırı ALTIN_URUN_ID ile, yoksa barkodla; özel: yalnızca barkodla (satırda özel ürün id'si yok)
        const eslesme = altin
            ? "(S.ALTIN_URUN_ID = U.ALTIN_URUN_ID OR (ISNULL(S.ALTIN_URUN_ID,0) = 0 AND S.BARKOD IS NOT NULL AND S.BARKOD = U.BARKOD))"
            : "(ISNULL(S.ALTIN_URUN_ID,0) = 0 AND S.BARKOD IS NOT NULL AND S.BARKOD = U.BARKOD)";
        const top = f.limit && f.limit > 0 ? Math.min(f.limit, 20000) : 5000;
        const req = pool.request();
        const kosullar = [];
        const tarihTuru = f.tarihTuru === "kayit" ? "kayit" : "satis";
        if (f.baslangic)
            req.input("BASLANGIC", sql.Date, f.baslangic);
        if (f.bitis)
            req.input("BITIS", sql.Date, f.bitis);
        if (tarihTuru === "kayit") {
            if (f.baslangic)
                kosullar.push("CAST(U.TARIH AS date) >= @BASLANGIC");
            if (f.bitis)
                kosullar.push("CAST(U.TARIH AS date) <= @BITIS");
        }
        else {
            // Satış tarihi: satılanlar aralıkta olmalı, stoktakiler tarihten bağımsız
            const parca = [];
            if (f.baslangic)
                parca.push("CAST(SAT.SATIS_TARIHI AS date) >= @BASLANGIC");
            if (f.bitis)
                parca.push("CAST(SAT.SATIS_TARIHI AS date) <= @BITIS");
            if (parca.length)
                kosullar.push(`(SAT.FATURA_ID IS NULL OR (${parca.join(" AND ")}))`);
        }
        const satildiIfade = "(ISNULL(U.SATILDI,0) = 1 OR SAT.FATURA_ID IS NOT NULL)";
        if (f.durum === "stokta")
            kosullar.push(`NOT ${satildiIfade}`);
        else if (f.durum === "satildi")
            kosullar.push(satildiIfade);
        if (f.ayar) {
            req.input("AYAR", sql.VarChar(50), String(f.ayar).trim());
            kosullar.push("RTRIM(U.AYAR) = @AYAR");
        }
        if (f.grupKodu) {
            req.input("GRUP_KODU", sql.VarChar(50), String(f.grupKodu).trim().toUpperCase());
            kosullar.push("UPPER(RTRIM(U.GRUP_KODU)) = @GRUP_KODU");
        }
        if (f.ureticiFirma) {
            req.input("URETICI_FIRMA", sql.VarChar(150), String(f.ureticiFirma).trim());
            kosullar.push("RTRIM(U.URETICI_FIRMA) = @URETICI_FIRMA");
        }
        if (f.banko) {
            req.input("BANKO", sql.VarChar(50), String(f.banko).trim());
            kosullar.push("RTRIM(U.BANKO) = @BANKO");
        }
        if (f.cariKartId && f.cariKartId > 0) {
            req.input("CARI_KART_ID", sql.Int, f.cariKartId);
            kosullar.push("SAT.CARI_KART_ID = @CARI_KART_ID");
        }
        if (f.search && f.search.trim()) {
            req.input("SEARCH", sql.NVarChar(200), `%${f.search.trim()}%`);
            kosullar.push(`(U.BARKOD LIKE @SEARCH OR ${adKolon} LIKE @SEARCH OR U.ORJINAL_KOD LIKE @SEARCH OR U.GRUP_KODU LIKE @SEARCH OR U.URETICI_FIRMA LIKE @SEARCH OR CAST(U.URUN_NO AS varchar(20)) LIKE @SEARCH)`);
        }
        const cariVar = (await pool.request().query("SELECT OBJECT_ID('dbo.TODVZ_CARI_KART') id")).recordset[0]?.id != null;
        const faturaVar = (await pool.request().query("SELECT OBJECT_ID('dbo.TODVZ_FATURA_SATIRI') id")).recordset[0]?.id != null;
        const satisApply = faturaVar
            ? `OUTER APPLY (
          SELECT TOP 1 F.FATURA_ID, F.FATURA_NO, F.TARIH SATIS_TARIHI, F.CARI_KART_ID,
                 ${cariVar ? "COALESCE(NULLIF(RTRIM(C.AD),''), F.ALICI_UNVAN)" : "F.ALICI_UNVAN"} MUSTERI,
                 S.TUTAR SATIS_TUTAR, S.TOPLAM_TUTAR SATIS_TOPLAM_TUTAR, F.PARA_ID FATURA_PARA_ID, F.KUR FATURA_KUR
          FROM dbo.TODVZ_FATURA_SATIRI S
          JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = S.FATURA_ID
          ${cariVar ? "LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = F.CARI_KART_ID" : ""}
          WHERE ${eslesme} AND ISNULL(F.FATURA_TIPI,1) = 1 AND ISNULL(F.E_BELGE_DURUMU,0) <> 4
          ORDER BY F.TARIH DESC, S.FATURA_SATIR_ID DESC
        ) SAT`
            : `OUTER APPLY (SELECT CAST(NULL AS int) FATURA_ID, CAST(NULL AS varchar(50)) FATURA_NO, CAST(NULL AS datetime) SATIS_TARIHI, CAST(NULL AS int) CARI_KART_ID,
                     CAST(NULL AS varchar(250)) MUSTERI, CAST(NULL AS float) SATIS_TUTAR, CAST(NULL AS float) SATIS_TOPLAM_TUTAR, CAST(NULL AS int) FATURA_PARA_ID, CAST(NULL AS float) FATURA_KUR) SAT`;
        const sorgu = `
      SELECT TOP (${top})
        U.${idKolon} URUN_ID, U.TARIH, U.GRUP_KODU, U.URUN_NO, U.BARKOD, ${adKolon} URUN_ADI, U.AYAR, U.URETICI_FIRMA, U.ORJINAL_KOD, U.BANKO,
        U.MIKTAR, ${birimKolon} MIKTAR_BIRIMI, ${hasGramKolon} HAS_GRAM,
        U.MALIYET, U.MALIYET_PARA_KODU, U.SATIS_FIYATI, U.SATIS_PARA_KODU, U.SATILDI,
        SAT.FATURA_ID, SAT.FATURA_NO, SAT.SATIS_TARIHI, SAT.CARI_KART_ID, SAT.MUSTERI, SAT.SATIS_TUTAR, SAT.SATIS_TOPLAM_TUTAR, SAT.FATURA_PARA_ID, SAT.FATURA_KUR
      FROM dbo.${tablo} U
      ${satisApply}
      ${kosullar.length ? `WHERE ${kosullar.join(" AND ")}` : ""}
      ORDER BY CASE WHEN SAT.FATURA_ID IS NULL THEN 1 ELSE 0 END, SAT.SATIS_TARIHI DESC, U.TARIH DESC, U.${idKolon} DESC`;
        const r = await req.query(sorgu);
        return r.recordset;
    }
    /** Filtre seçenekleri: ayar / grup / üretici / banko (ürün tablosundaki farklı değerler) */
    static async secenekler(tip, dbContext) {
        const pool = await this.pool(dbContext);
        const tablo = tip === "altin" ? "TODVZ_ALTIN_URUN" : "TODVZ_OZEL_URUN";
        const tek = async (kolon) => (await pool.request().query(`SELECT DISTINCT RTRIM(${kolon}) v FROM dbo.${tablo} WHERE ${kolon} IS NOT NULL AND RTRIM(${kolon}) <> '' ORDER BY 1`)).recordset.map((x) => String(x.v));
        const [ayarlar, gruplar, ureticiler, bankolar] = await Promise.all([tek("AYAR"), tek("GRUP_KODU"), tek("URETICI_FIRMA"), tek("BANKO")]);
        return { ayarlar, gruplar, ureticiler, bankolar };
    }
    /** Para kodu → PARA_ID (TL/TRY, HAS, USD, ...) */
    static async paraKodlari(pool) {
        const r = await pool.request().query("SELECT PARA_ID, RTRIM(UPPER(KOD)) KOD FROM dbo.TODVZ_PARA");
        const m = new Map();
        for (const x of r.recordset)
            if (x.KOD && !m.has(x.KOD))
                m.set(String(x.KOD), Number(x.PARA_ID));
        if (m.has("TRY") && !m.has("TL"))
            m.set("TL", m.get("TRY"));
        return m;
    }
}
