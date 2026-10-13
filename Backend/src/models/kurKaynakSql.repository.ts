import sql from "mssql";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDbPool, getPoolKey } from "../config/mssql.config.js";
import { batchlereBol } from "../services/semaGoc.service.js";
import type { KomisyonTuru } from "../services/kur/kurKomisyon.js";

/**
 * Anlık Fiyat Listesi kur kaynağı + birim bazında komisyon (docs/KUR_KAYNAGI_YOL_HARITASI.md).
 * Tablolar göçle (007_kur_kaynagi.sql) gelir; göç uygulanmamış veritabanında ilk kullanımda da oluşturulur.
 */

export type DbContext = { dbServer?: string; dbName?: string };

export interface KurKomisyonSatiri {
  paraId: number;
  kod: string;
  ad: string;
  urunTipi: number | null;
  alisTur: KomisyonTuru;
  alisDeger: number;
  satisTur: KomisyonTuru;
  satisDeger: number;
}

const gocBatchleri = (): string[] => {
  const burasi = path.dirname(fileURLToPath(import.meta.url));
  return batchlereBol(fs.readFileSync(path.resolve(burasi, "../../migrations/007_kur_kaynagi.sql"), "utf8"));
};

const hazirHavuzlar = new Set<string>();

/** TL dışındaki para birimleri — kurSql.repository'deki listeyle aynı süzgeç */
const PARA_SUZGECI = `
  UPPER(LTRIM(RTRIM(ISNULL(P.[KOD], '')))) NOT IN ('TL', 'TRY', 'YTL', 'TRL')
  AND UPPER(LTRIM(RTRIM(ISNULL(P.[AD], '')))) NOT LIKE '%TÜRK LİRA%'
  AND UPPER(LTRIM(RTRIM(ISNULL(P.[AD], '')))) NOT LIKE '%TURK LIRA%'`;

const tur = (v: unknown): KomisyonTuru => (String(v ?? "").trim().toUpperCase() === "Y" ? "Y" : "T");

export class KurKaynakRepository {
  private static async pool(ctx?: DbContext): Promise<sql.ConnectionPool> {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    const anahtar = getPoolKey(ctx?.dbServer, ctx?.dbName);
    if (!hazirHavuzlar.has(anahtar)) {
      for (const b of gocBatchleri()) await pool.request().batch(b);
      hazirHavuzlar.add(anahtar);
    }
    return pool;
  }

  /** Listede son seçilen kaynak; kayıt yoksa Merkez Bankası */
  static async seciliKaynak(ctx?: DbContext): Promise<string> {
    const pool = await this.pool(ctx);
    const r = await pool.request().query(`SELECT TOP 1 KAYNAK FROM dbo.TODVZ_KUR_KAYNAK_AYAR WHERE AYAR_ID = 1`);
    return String(r.recordset[0]?.KAYNAK || "tcmb").trim();
  }

  static async kaynakKaydet(kaynak: string, degistiren: string | null, ctx?: DbContext): Promise<void> {
    const pool = await this.pool(ctx);
    await pool
      .request()
      .input("k", sql.VarChar(20), kaynak)
      .input("d", sql.VarChar(100), degistiren)
      .query(`
        UPDATE dbo.TODVZ_KUR_KAYNAK_AYAR SET KAYNAK = @k, DEGISTIREN = @d, DEGISIM_TARIHI = GETDATE() WHERE AYAR_ID = 1;
        IF @@ROWCOUNT = 0
          INSERT INTO dbo.TODVZ_KUR_KAYNAK_AYAR (AYAR_ID, KAYNAK, DEGISTIREN) VALUES (1, @k, @d);`);
  }

  /** Bütün para birimleri (TL hariç) + komisyonları; komisyonu girilmemiş birim 0 gelir */
  static async komisyonlar(ctx?: DbContext): Promise<KurKomisyonSatiri[]> {
    const pool = await this.pool(ctx);
    const r = await pool.request().query(`
      SELECT P.PARA_ID,
             LTRIM(RTRIM(ISNULL(P.KOD, ''))) AS KOD,
             LTRIM(RTRIM(ISNULL(P.AD, ''))) AS AD,
             P.URUN_TIPI,
             K.ALIS_TUR, K.ALIS_DEGER, K.SATIS_TUR, K.SATIS_DEGER
      FROM dbo.TODVZ_PARA P
      LEFT JOIN dbo.TODVZ_KUR_KOMISYON K ON K.PARA_ID = P.PARA_ID
      WHERE ${PARA_SUZGECI}
      ORDER BY ISNULL(P.SIRA_NO, 999), P.PARA_ID`);
    return r.recordset.map((s: any) => ({
      paraId: s.PARA_ID,
      kod: s.KOD,
      ad: s.AD,
      urunTipi: s.URUN_TIPI === null || s.URUN_TIPI === undefined ? null : Number(s.URUN_TIPI),
      alisTur: tur(s.ALIS_TUR),
      alisDeger: Number(s.ALIS_DEGER) || 0,
      satisTur: tur(s.SATIS_TUR),
      satisDeger: Number(s.SATIS_DEGER) || 0,
    }));
  }

  /** Tabloyu baştan yazar; değeri ikisi de 0 olan birim için kayıt tutulmaz */
  static async komisyonKaydet(satirlar: Pick<KurKomisyonSatiri, "paraId" | "alisTur" | "alisDeger" | "satisTur" | "satisDeger">[], ctx?: DbContext): Promise<void> {
    const pool = await this.pool(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_KUR_KOMISYON`);
      for (const s of satirlar) {
        if (!s.alisDeger && !s.satisDeger) continue;
        await new sql.Request(tx)
          .input("p", sql.Int, s.paraId)
          .input("at", sql.Char(1), s.alisTur)
          .input("ad", sql.Decimal(18, 6), s.alisDeger)
          .input("st", sql.Char(1), s.satisTur)
          .input("sd", sql.Decimal(18, 6), s.satisDeger)
          .query(`INSERT INTO dbo.TODVZ_KUR_KOMISYON (PARA_ID, ALIS_TUR, ALIS_DEGER, SATIS_TUR, SATIS_DEGER) VALUES (@p, @at, @ad, @st, @sd)`);
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }
}
