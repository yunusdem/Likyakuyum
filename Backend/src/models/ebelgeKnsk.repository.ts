import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { DbContext } from "./ebelgeSql.repository.js";

/**
 * KNSK — kamu nüfuzuna sahip kişi işareti (docs/ebelge-revizyon.md K9).
 * İşaret kullanıcı onayıyla, elle konur; kişi VKN/TCKN ile tanınır (fatura alıcısı cari kartı olmadan da yazılabildiği için).
 * ERP'nin cari tablosuna kolon eklenmez; kayıt bu yan tabloda durur ve cari kartında VKN/TCKN üzerinden gösterilir.
 * Onay 1 yıl geçerlidir: SON_ONAY_TARIHI + 1 yıl dolmadan UYARI_GUN gün önce e-Belge ana sayfasında ve fatura formunda uyarılır.
 */
export const KNSK_UYARI_GUN = 30;

export interface KnskKaydi {
  vknTckn: string; ad: string | null; aciklama: string | null;
  /** İlk işaretlenme tarihi — yenilemede değişmez */
  kayitTarihi: string;
  /** Son kullanıcı onayı; 1 yıllık süre buradan işler */
  sonOnayTarihi: string;
  /** sonOnayTarihi + 1 yıl */
  bitisTarihi: string;
  /** Bitişe kalan gün; süresi dolmuşsa negatif */
  kalanGun: number;
  onaylayan: string | null;
}

const hazirlanan = new Set<string>();
const ALANLAR = `RTRIM(VKN_TCKN) vknTckn, AD ad, ACIKLAMA aciklama, KAYIT_TARIHI kayitTarihi, SON_ONAY_TARIHI sonOnayTarihi,
  DATEADD(year, 1, SON_ONAY_TARIHI) bitisTarihi,
  DATEDIFF(day, CAST(GETDATE() AS date), DATEADD(year, 1, SON_ONAY_TARIHI)) kalanGun, ONAYLAYAN onaylayan`;

export class EbelgeKnskRepository {
  private static async pool(ctx?: DbContext) {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    const anahtar = `${ctx?.dbServer || ""}|${ctx?.dbName || ""}`;
    if (hazirlanan.has(anahtar)) return pool;
    await pool.request().query(`
      IF OBJECT_ID('dbo.TODVZ_EBELGE_KNSK','U') IS NULL
      BEGIN TRY
        CREATE TABLE dbo.TODVZ_EBELGE_KNSK (
          VKN_TCKN varchar(11) NOT NULL PRIMARY KEY, AD nvarchar(300) NULL, ACIKLAMA nvarchar(500) NULL,
          KAYIT_TARIHI date NOT NULL DEFAULT CAST(GETDATE() AS date),
          SON_ONAY_TARIHI date NOT NULL DEFAULT CAST(GETDATE() AS date),
          ONAYLAYAN nvarchar(50) NULL, AKTIF bit NOT NULL DEFAULT 1,
          KALDIRAN nvarchar(50) NULL, KALDIRMA_TARIHI datetime2 NULL
        );
      END TRY BEGIN CATCH IF ERROR_NUMBER() <> 2714 THROW; END CATCH;
    `);
    hazirlanan.add(anahtar);
    return pool;
  }

  private static satir = (k: any): KnskKaydi => ({ ...k, kalanGun: Number(k.kalanGun) });

  static async get(vknTckn: string, ctx?: DbContext): Promise<KnskKaydi | null> {
    const pool = await this.pool(ctx);
    const r = await pool.request().input("vkn", sql.VarChar(11), vknTckn)
      .query(`SELECT ${ALANLAR} FROM dbo.TODVZ_EBELGE_KNSK WHERE VKN_TCKN=@vkn AND AKTIF=1;`);
    return r.recordset[0] ? this.satir(r.recordset[0]) : null;
  }

  /** `yalnizYaklasan`: süresine KNSK_UYARI_GUN gün ya da daha az kalanlar (dolmuşlar dahil). */
  static async list(yalnizYaklasan: boolean, ctx?: DbContext): Promise<KnskKaydi[]> {
    const pool = await this.pool(ctx);
    const r = await pool.request().input("gun", sql.Int, yalnizYaklasan ? KNSK_UYARI_GUN : null).query(`
      SELECT ${ALANLAR} FROM dbo.TODVZ_EBELGE_KNSK
      WHERE AKTIF=1 AND (@gun IS NULL OR DATEDIFF(day, CAST(GETDATE() AS date), DATEADD(year, 1, SON_ONAY_TARIHI)) <= @gun)
      ORDER BY SON_ONAY_TARIHI;`);
    return r.recordset.map(this.satir);
  }

  /**
   * İşaretler ya da yeniler. Kayıt yoksa (veya kaldırılmışsa) bugünün tarihiyle açılır; varsa yalnızca SON_ONAY_TARIHI
   * bugüne çekilir (yıllık yenileme) — ilk KAYIT_TARIHI korunur.
   */
  static async onayla(k: { vknTckn: string; ad?: string | null; aciklama?: string | null }, kullanici: string, ctx?: DbContext): Promise<KnskKaydi> {
    const pool = await this.pool(ctx);
    await pool.request().input("vkn", sql.VarChar(11), k.vknTckn).input("ad", sql.NVarChar(300), k.ad?.trim() || null)
      .input("aciklama", sql.NVarChar(500), k.aciklama?.trim() || null).input("kullanici", sql.NVarChar(50), kullanici).query(`
      MERGE dbo.TODVZ_EBELGE_KNSK WITH (HOLDLOCK) AS t USING (SELECT @vkn VKN_TCKN) s ON t.VKN_TCKN = s.VKN_TCKN
      WHEN MATCHED THEN UPDATE SET AD=COALESCE(@ad, t.AD), ACIKLAMA=COALESCE(@aciklama, t.ACIKLAMA),
        KAYIT_TARIHI=CASE WHEN t.AKTIF=1 THEN t.KAYIT_TARIHI ELSE CAST(GETDATE() AS date) END,
        SON_ONAY_TARIHI=CAST(GETDATE() AS date), ONAYLAYAN=@kullanici, AKTIF=1, KALDIRAN=NULL, KALDIRMA_TARIHI=NULL
      WHEN NOT MATCHED THEN INSERT (VKN_TCKN, AD, ACIKLAMA, ONAYLAYAN) VALUES (@vkn, @ad, @aciklama, @kullanici);`);
    return (await this.get(k.vknTckn, ctx))!;
  }

  /** İşareti kaldırır. Satır silinmez (kim, ne zaman kaldırdı izi kalır). */
  static async kaldir(vknTckn: string, kullanici: string, ctx?: DbContext): Promise<void> {
    const pool = await this.pool(ctx);
    await pool.request().input("vkn", sql.VarChar(11), vknTckn).input("kullanici", sql.NVarChar(50), kullanici)
      .query(`UPDATE dbo.TODVZ_EBELGE_KNSK SET AKTIF=0, KALDIRAN=@kullanici, KALDIRMA_TARIHI=SYSDATETIME() WHERE VKN_TCKN=@vkn AND AKTIF=1;`);
  }
}
