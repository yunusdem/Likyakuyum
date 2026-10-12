import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { EtiketLogoSqlRepository } from "./etiketLogoSql.repository.js";
import type { DbContext } from "./belgeSql.repository.js";

/**
 * Belge (fiş) görselleri: firmanın logo ve imza / kaşe görselleri (docs/FIS_TASARIM_YOL_HARITASI.md, K7–K8, Faz 4).
 * `TODVZ_FOTOGRAF` tablosunda URUN_TIPI 10 (logo) / 11 (imza-kaşe), URUN_ID 0; DOSYA_ADI görselin firmada verilen adıdır
 * (şablon görsele bu adla bağlanır). Etiket logolarının saklı yordamı (SODVZ_FOTOGRAF_KAYDET) kullanılmaz: doğrudan
 * INSERT / DELETE, başka kayda dokunmaz.
 */
export const BELGE_GORSEL_TIPLERI = { LOGO: 10, IMZA: 11 } as const;
export type BelgeGorselTuru = keyof typeof BELGE_GORSEL_TIPLERI;

export interface BelgeGorselModel {
  id: number; ad: string; tur: BelgeGorselTuru; mime: string; boyut: number; tarih: string | null;
  veri?: Buffer;
}

const turAdi = (tip: number): BelgeGorselTuru => (Number(tip) === BELGE_GORSEL_TIPLERI.IMZA ? "IMZA" : "LOGO");

export class BelgeGorselSqlRepository {
  private static async pool(ctx?: DbContext) {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    await EtiketLogoSqlRepository.ensureTables(pool);
    return pool;
  }

  private static satir(r: any, veriyle: boolean): BelgeGorselModel {
    const veri = r.FOTOGRAF_DATA ? (Buffer.isBuffer(r.FOTOGRAF_DATA) ? r.FOTOGRAF_DATA : Buffer.from(r.FOTOGRAF_DATA)) : undefined;
    return {
      id: Number(r.FOTOGRAF_ID), ad: String(r.DOSYA_ADI || "").trim(), tur: turAdi(r.URUN_TIPI), mime: String(r.MIME_TIPI || "image/png").trim(),
      boyut: Number(r.BOYUT ?? veri?.length ?? 0), tarih: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : null,
      ...(veriyle && veri ? { veri } : {}),
    };
  }

  /** Firmanın belge görselleri (eklenme sırasıyla). */
  static async listele(veriyle: boolean, ctx?: DbContext): Promise<BelgeGorselModel[]> {
    const pool = await this.pool(ctx);
    const res = await pool.request().input("L", sql.TinyInt, BELGE_GORSEL_TIPLERI.LOGO).input("I", sql.TinyInt, BELGE_GORSEL_TIPLERI.IMZA).query(`
      SELECT FOTOGRAF_ID, URUN_TIPI, DOSYA_ADI, MIME_TIPI, EKLEME_ZAMANI, DATALENGTH(FOTOGRAF_DATA) BOYUT${veriyle ? ", FOTOGRAF_DATA" : ""}
      FROM dbo.TODVZ_FOTOGRAF WHERE URUN_TIPI IN (@L, @I) ORDER BY FOTOGRAF_ID`);
    return res.recordset.map((r: any) => this.satir(r, veriyle));
  }

  /** Adları verilen görseller (verisiyle) — çizimde kullanılır. */
  static async adlarla(adlar: string[], ctx?: DbContext): Promise<BelgeGorselModel[]> {
    if (!adlar.length) return [];
    const hepsi = await this.listele(true, ctx);
    const istenen = new Set(adlar.map(a => a.toLocaleLowerCase("tr-TR")));
    return hepsi.filter(g => istenen.has(g.ad.toLocaleLowerCase("tr-TR")));
  }

  static async ekle(g: { ad: string; tur: BelgeGorselTuru; mime: string; veri: Buffer }, kullaniciId: number | null, ctx?: DbContext): Promise<number> {
    const pool = await this.pool(ctx);
    const res = await pool.request()
      .input("TIP", sql.TinyInt, BELGE_GORSEL_TIPLERI[g.tur])
      .input("VERI", sql.VarBinary(sql.MAX), g.veri)
      .input("AD", sql.VarChar(255), g.ad)
      .input("MIME", sql.VarChar(50), g.mime)
      .input("KUL", sql.Int, kullaniciId)
      .query(`INSERT INTO dbo.TODVZ_FOTOGRAF (URUN_TIPI, URUN_ID, FOTOGRAF_DATA, DOSYA_ADI, MIME_TIPI, VARSAYILAN, EKLEYEN_ID, EKLEME_ZAMANI)
        OUTPUT INSERTED.FOTOGRAF_ID VALUES (@TIP, 0, @VERI, @AD, @MIME, 0, @KUL, GETDATE())`);
    return Number(res.recordset[0]?.FOTOGRAF_ID);
  }

  /** Yalnızca belge görselini siler (etiket logosu / ürün resmi silinemez). */
  static async sil(id: number, ctx?: DbContext): Promise<boolean> {
    const pool = await this.pool(ctx);
    const res = await pool.request().input("ID", sql.Int, id).input("L", sql.TinyInt, BELGE_GORSEL_TIPLERI.LOGO).input("I", sql.TinyInt, BELGE_GORSEL_TIPLERI.IMZA)
      .query(`DELETE FROM dbo.TODVZ_FOTOGRAF OUTPUT DELETED.FOTOGRAF_ID WHERE FOTOGRAF_ID=@ID AND URUN_TIPI IN (@L, @I)`);
    return res.recordset.length > 0;
  }
}
