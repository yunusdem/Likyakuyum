import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { DbContext } from "./ebelgeSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Yerel taslaklar — docs/ebelge-revizyon.md K3.
 * ICE yalnızca e-Fatura için taslak metodu sunar (`send_invoice_taslak`); e-Arşiv, e-İrsaliye, e-Gider ve
 * e-Müstahsil taslakları burada saklanır. Yerel taslak ICE'ye/GİB'e gitmez ve belge numarası yakmaz:
 * ICERIK, formun o anki hâlidir (JSON); gönderim yine formdaki Gönder düğmesiyle, tüm doğrulamalardan geçerek yapılır.
 */
export type YerelTaslakTuru = "EArsiv" | "EIrsaliye" | "EGiderPusulasi" | "EMustahsil";
export interface YerelTaslakOzet {
  id: number; belgeTuru: YerelTaslakTuru; belgeNo: string | null; aliciVkn: string | null; aliciUnvan: string | null;
  tutar: number | null; paraBirimi: string | null; olusturan: string | null; olusturmaTarihi: string; guncellemeTarihi: string;
}
export interface YerelTaslakKaydet {
  id?: number; belgeTuru: YerelTaslakTuru; belgeNo?: string | null; aliciVkn?: string | null; aliciUnvan?: string | null;
  tutar?: number | null; paraBirimi?: string | null; icerik: unknown;
}

const hazirlanan = new Set<string>();
const OZET = `ID id, RTRIM(BELGE_TURU) belgeTuru, BELGE_NO belgeNo, ALICI_VKN aliciVkn, ALICI_UNVAN aliciUnvan,
  TUTAR tutar, PARA_BIRIMI paraBirimi, OLUSTURAN olusturan, OLUSTURMA_TARIHI olusturmaTarihi, GUNCELLEME_TARIHI guncellemeTarihi`;

export class EbelgeTaslakRepository {
  private static async pool(ctx?: DbContext) {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    const anahtar = `${ctx?.dbServer || ""}|${ctx?.dbName || ""}`;
    if (hazirlanan.has(anahtar)) return pool;
    await pool.request().query(`
      IF OBJECT_ID('dbo.TODVZ_EBELGE_TASLAK','U') IS NULL
      BEGIN TRY
        CREATE TABLE dbo.TODVZ_EBELGE_TASLAK (
          ID int IDENTITY(1,1) NOT NULL PRIMARY KEY, BELGE_TURU varchar(20) NOT NULL,
          BELGE_NO varchar(40) NULL, ALICI_VKN varchar(11) NULL, ALICI_UNVAN nvarchar(300) NULL,
          TUTAR decimal(19,2) NULL, PARA_BIRIMI varchar(10) NULL, ICERIK nvarchar(max) NOT NULL,
          OLUSTURAN nvarchar(50) NULL, OLUSTURMA_TARIHI datetime2 NOT NULL DEFAULT SYSDATETIME(),
          GUNCELLEME_TARIHI datetime2 NOT NULL DEFAULT SYSDATETIME()
        );
      END TRY BEGIN CATCH IF ERROR_NUMBER() <> 2714 THROW; END CATCH;
    `);
    hazirlanan.add(anahtar);
    return pool;
  }

  static async list(belgeTuru: YerelTaslakTuru | undefined, ctx?: DbContext): Promise<YerelTaslakOzet[]> {
    const pool = await this.pool(ctx);
    const r = await pool.request().input("tur", sql.VarChar(20), belgeTuru || null)
      .query(`SELECT TOP 500 ${OZET} FROM dbo.TODVZ_EBELGE_TASLAK WHERE @tur IS NULL OR BELGE_TURU=@tur ORDER BY GUNCELLEME_TARIHI DESC;`);
    return r.recordset.map((k: any) => ({ ...k, tutar: k.tutar == null ? null : Number(k.tutar) }));
  }

  static async get(id: number, ctx?: DbContext): Promise<YerelTaslakOzet & { icerik: unknown }> {
    const pool = await this.pool(ctx);
    const r = await pool.request().input("id", sql.Int, id).query(`SELECT ${OZET}, ICERIK icerik FROM dbo.TODVZ_EBELGE_TASLAK WHERE ID=@id;`);
    const k = r.recordset[0];
    if (!k) throw ApiError.notFound("Taslak bulunamadı; silinmiş ya da gönderilmiş olabilir.");
    let icerik: unknown = null;
    try { icerik = JSON.parse(k.icerik); } catch { throw ApiError.badRequest("Taslak içeriği okunamadı."); }
    return { ...k, tutar: k.tutar == null ? null : Number(k.tutar), icerik };
  }

  /** `id` varsa o taslak güncellenir, yoksa yeni taslak açılır. */
  static async kaydet(t: YerelTaslakKaydet, kullanici: string, ctx?: DbContext): Promise<{ id: number }> {
    const pool = await this.pool(ctx);
    const r = pool.request().input("id", sql.Int, t.id ?? null).input("tur", sql.VarChar(20), t.belgeTuru)
      .input("no", sql.VarChar(40), t.belgeNo?.trim() || null).input("vkn", sql.VarChar(11), t.aliciVkn?.trim() || null)
      .input("unvan", sql.NVarChar(300), t.aliciUnvan?.trim() || null).input("tutar", sql.Decimal(19, 2), t.tutar ?? null)
      .input("pb", sql.VarChar(10), t.paraBirimi || null).input("icerik", sql.NVarChar(sql.MAX), JSON.stringify(t.icerik))
      .input("kullanici", sql.NVarChar(50), kullanici);
    const sonuc = await r.query(`
      IF @id IS NOT NULL
      BEGIN
        UPDATE dbo.TODVZ_EBELGE_TASLAK SET BELGE_NO=@no, ALICI_VKN=@vkn, ALICI_UNVAN=@unvan, TUTAR=@tutar, PARA_BIRIMI=@pb,
          ICERIK=@icerik, GUNCELLEME_TARIHI=SYSDATETIME() WHERE ID=@id AND BELGE_TURU=@tur;
        IF @@ROWCOUNT = 0 THROW 50010, 'Taslak bulunamadı.', 1;
        SELECT @id id;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.TODVZ_EBELGE_TASLAK (BELGE_TURU, BELGE_NO, ALICI_VKN, ALICI_UNVAN, TUTAR, PARA_BIRIMI, ICERIK, OLUSTURAN)
        VALUES (@tur, @no, @vkn, @unvan, @tutar, @pb, @icerik, @kullanici);
        SELECT CAST(SCOPE_IDENTITY() AS int) id;
      END`).catch((e: any) => { if (e?.number === 50010) throw ApiError.notFound("Taslak bulunamadı; silinmiş ya da gönderilmiş olabilir."); throw e; });
    return { id: sonuc.recordset[0].id };
  }

  static async sil(id: number, ctx?: DbContext): Promise<void> {
    const pool = await this.pool(ctx);
    await pool.request().input("id", sql.Int, id).query(`DELETE FROM dbo.TODVZ_EBELGE_TASLAK WHERE ID=@id;`);
  }
}
