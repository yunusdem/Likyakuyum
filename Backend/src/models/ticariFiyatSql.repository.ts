import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { DbBaglam, TicariStokSqlRepository } from "./ticariStokSql.repository.js";

/**
 * Ticari fiyat listeleri, cari → liste ataması, kart liste fiyatları (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 11, G6–G9).
 * Ana liste = kartın SATIS_FIYATI (listesiz); tanımlı listelerde kart başına ayrı fiyat, yoksa ana fiyat geçerli.
 * Liste fiyatı kartın para birimi ve "KDV dahil" işaretine uyar.
 */

export interface FiyatListesi {
  fiyatListesiId: number;
  ad: string;
  aktif: boolean;
  sira: number;
  kartSayisi: number;
  cariSayisi: number;
}

export interface KartListeFiyati {
  fiyatListesiId: number;
  ad: string;
  fiyat: number | null;
}

const temiz = (v: unknown): string => String(v ?? "").trim();
const sayiVeyaNull = (v: unknown): number | null => {
  if (v === null || v === undefined || temiz(v) === "") return null;
  const s = typeof v === "string" ? (v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) : v;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export class TicariFiyatSqlRepository {
  static havuz(ctx?: DbBaglam) {
    return TicariStokSqlRepository.havuz(ctx);
  }

  // ───────────── Fiyat listeleri ─────────────

  static async listeler(ctx?: DbBaglam, yalnizAktif = false): Promise<FiyatListesi[]> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().query(`
      SELECT L.FIYAT_LISTESI_ID, L.AD, L.AKTIF, L.SIRA,
        (SELECT COUNT(*) FROM dbo.TODVZ_STOK_KART_FIYAT F WHERE F.FIYAT_LISTESI_ID = L.FIYAT_LISTESI_ID) AS KART_SAYISI,
        (SELECT COUNT(*) FROM dbo.TODVZ_STOK_CARI_FIYAT_LISTESI C WHERE C.FIYAT_LISTESI_ID = L.FIYAT_LISTESI_ID) AS CARI_SAYISI
      FROM dbo.TODVZ_STOK_FIYAT_LISTESI L ${yalnizAktif ? "WHERE L.AKTIF = 1" : ""} ORDER BY L.SIRA, L.AD`);
    return r.recordset.map((x: any) => ({ fiyatListesiId: x.FIYAT_LISTESI_ID, ad: temiz(x.AD), aktif: x.AKTIF === true || x.AKTIF === 1, sira: Number(x.SIRA) || 0, kartSayisi: Number(x.KART_SAYISI) || 0, cariSayisi: Number(x.CARI_SAYISI) || 0 }));
  }

  static async listeKaydet(g: { fiyatListesiId?: number | null; ad?: string; aktif?: boolean; sira?: number | null }, kullaniciId: number | undefined, ctx?: DbBaglam): Promise<FiyatListesi> {
    const ad = temiz(g.ad);
    if (!ad) throw ApiError.badRequest("Liste adı zorunlu.");
    if (ad.length > 100) throw ApiError.badRequest("Liste adı en çok 100 karakter olabilir.");
    if (/^ana(\s+liste)?$/i.test(ad)) throw ApiError.badRequest('"Ana liste" kartın satış fiyatıdır; ayrıca tanımlanmaz.');
    const pool = await this.havuz(ctx);
    const ayni = await pool.request().input("AD", sql.NVarChar(100), ad).input("ID", sql.Int, Number(g.fiyatListesiId) || 0)
      .query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_FIYAT_LISTESI WHERE AD = @AD AND FIYAT_LISTESI_ID <> @ID`);
    if (ayni.recordset.length) throw ApiError.badRequest(`"${ad}" adlı liste zaten var.`);
    let id = Number(g.fiyatListesiId) || 0;
    const sira = Number(g.sira) || 0;
    if (id) {
      const r = await pool.request().input("ID", sql.Int, id).input("AD", sql.NVarChar(100), ad).input("AKTIF", sql.Bit, g.aktif === false ? 0 : 1).input("SIRA", sql.Int, sira)
        .query(`UPDATE dbo.TODVZ_STOK_FIYAT_LISTESI SET AD = @AD, AKTIF = @AKTIF, SIRA = @SIRA WHERE FIYAT_LISTESI_ID = @ID; SELECT @@ROWCOUNT AS N`);
      if (!Number(r.recordset[0]?.N)) throw ApiError.notFound("Fiyat listesi bulunamadı.");
    } else {
      const r = await pool.request().input("AD", sql.NVarChar(100), ad).input("AKTIF", sql.Bit, g.aktif === false ? 0 : 1).input("SIRA", sql.Int, sira).input("E", sql.Int, kullaniciId || null)
        .query(`INSERT INTO dbo.TODVZ_STOK_FIYAT_LISTESI (AD, AKTIF, SIRA, EKLEYEN_ID) OUTPUT INSERTED.FIYAT_LISTESI_ID VALUES (@AD, @AKTIF, @SIRA, @E)`);
      id = r.recordset[0].FIYAT_LISTESI_ID;
    }
    return (await this.listeler(ctx)).find((x) => x.fiyatListesiId === id)!;
  }

  /** Liste silinir; kart fiyatları ve cari atamaları da silinir (onay ekranda) */
  static async listeSil(id: number, ctx?: DbBaglam): Promise<void> {
    const pool = await this.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).input("ID", sql.Int, id).query(`
        DELETE FROM dbo.TODVZ_STOK_KART_FIYAT WHERE FIYAT_LISTESI_ID = @ID;
        DELETE FROM dbo.TODVZ_STOK_CARI_FIYAT_LISTESI WHERE FIYAT_LISTESI_ID = @ID;`);
      const r = await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_FIYAT_LISTESI WHERE FIYAT_LISTESI_ID = @ID; SELECT @@ROWCOUNT AS N`);
      if (!Number(r.recordset[0]?.N)) throw ApiError.notFound("Fiyat listesi bulunamadı.");
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }

  // ───────────── Kart liste fiyatları ─────────────

  /** Kartın bütün tanımlı listelerdeki fiyatı (fiyatı olmayan liste null) */
  static async kartListeFiyatlari(stokKartId: number, ctx?: DbBaglam): Promise<KartListeFiyati[]> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().input("K", sql.Int, stokKartId).query(`
      SELECT L.FIYAT_LISTESI_ID, L.AD, F.FIYAT FROM dbo.TODVZ_STOK_FIYAT_LISTESI L
      LEFT JOIN dbo.TODVZ_STOK_KART_FIYAT F ON F.FIYAT_LISTESI_ID = L.FIYAT_LISTESI_ID AND F.STOK_KART_ID = @K
      WHERE L.AKTIF = 1 ORDER BY L.SIRA, L.AD`);
    return r.recordset.map((x: any) => ({ fiyatListesiId: x.FIYAT_LISTESI_ID, ad: temiz(x.AD), fiyat: x.FIYAT === null || x.FIYAT === undefined ? null : Number(x.FIYAT) }));
  }

  /**
   * Kartın liste fiyatlarını yazar (açık işlem içinde; kart kaydı ve Excel). Listede olmayan / boş fiyat satırı silinir
   * (ana fiyat geçerli olur). Tanımsız liste kimliği hata.
   */
  static async kartListeFiyatlariniYaz(tx: sql.Transaction, stokKartId: number, fiyatlar: { fiyatListesiId: number; fiyat: number | string | null }[], kullaniciId?: number): Promise<void> {
    for (const f of fiyatlar) {
      const id = Number(f.fiyatListesiId) || 0;
      if (!id) throw ApiError.badRequest("Fiyat listesi kimliği geçersiz.");
      const n = sayiVeyaNull(f.fiyat);
      if (n !== null && (Number.isNaN(n) || n < 0)) throw ApiError.badRequest("Liste fiyatı sayı ve sıfırdan küçük olmamalı.");
      const var_ = await new sql.Request(tx).input("L", sql.Int, id).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_FIYAT_LISTESI WHERE FIYAT_LISTESI_ID = @L`);
      if (!var_.recordset.length) throw ApiError.badRequest("Fiyat listesi bulunamadı.");
      const req = new sql.Request(tx).input("K", sql.Int, stokKartId).input("L", sql.Int, id).input("F", sql.Float, n).input("KUL", sql.Int, kullaniciId || null);
      if (n === null) await req.query(`DELETE FROM dbo.TODVZ_STOK_KART_FIYAT WHERE STOK_KART_ID = @K AND FIYAT_LISTESI_ID = @L`);
      else await req.query(`
        IF EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_KART_FIYAT WHERE STOK_KART_ID = @K AND FIYAT_LISTESI_ID = @L)
          UPDATE dbo.TODVZ_STOK_KART_FIYAT SET FIYAT = @F, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() WHERE STOK_KART_ID = @K AND FIYAT_LISTESI_ID = @L
        ELSE INSERT INTO dbo.TODVZ_STOK_KART_FIYAT (STOK_KART_ID, FIYAT_LISTESI_ID, FIYAT, GUNCELLEYEN_ID) VALUES (@K, @L, @F, @KUL)`);
    }
  }

  // ───────────── Cari → liste ─────────────

  static async cariListesi(cariKartId: number, ctx?: DbBaglam): Promise<{ fiyatListesiId: number; ad: string } | null> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().input("C", sql.Int, cariKartId).query(`
      SELECT L.FIYAT_LISTESI_ID, L.AD FROM dbo.TODVZ_STOK_CARI_FIYAT_LISTESI C JOIN dbo.TODVZ_STOK_FIYAT_LISTESI L ON L.FIYAT_LISTESI_ID = C.FIYAT_LISTESI_ID
      WHERE C.CARI_KART_ID = @C AND L.AKTIF = 1`);
    return r.recordset.length ? { fiyatListesiId: r.recordset[0].FIYAT_LISTESI_ID, ad: temiz(r.recordset[0].AD) } : null;
  }

  /** Listeye atanmış cariler */
  static async listeCarileri(fiyatListesiId: number, ctx?: DbBaglam): Promise<{ cariKartId: number; kod: string; unvan: string }[]> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().input("L", sql.Int, fiyatListesiId).query(`
      SELECT C.CARI_KART_ID, RTRIM(K.KOD) AS KOD, RTRIM(K.AD) AS UNVAN FROM dbo.TODVZ_STOK_CARI_FIYAT_LISTESI C
      LEFT JOIN dbo.TODVZ_CARI_KART K ON K.CARI_KART_ID = C.CARI_KART_ID WHERE C.FIYAT_LISTESI_ID = @L ORDER BY K.AD`);
    return r.recordset.map((x: any) => ({ cariKartId: x.CARI_KART_ID, kod: temiz(x.KOD), unvan: temiz(x.UNVAN) }));
  }

  /** fiyatListesiId null → atama kaldırılır (ana liste) */
  static async cariListesiKaydet(cariKartId: number, fiyatListesiId: number | null, kullaniciId: number | undefined, ctx?: DbBaglam): Promise<void> {
    const pool = await this.havuz(ctx);
    const c = await pool.request().input("C", sql.Int, cariKartId).query(`SELECT 1 AS V FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID = @C`);
    if (!c.recordset.length) throw ApiError.notFound("Cari kart bulunamadı.");
    const id = Number(fiyatListesiId) || 0;
    if (!id) {
      await pool.request().input("C", sql.Int, cariKartId).query(`DELETE FROM dbo.TODVZ_STOK_CARI_FIYAT_LISTESI WHERE CARI_KART_ID = @C`);
      return;
    }
    const l = await pool.request().input("L", sql.Int, id).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_FIYAT_LISTESI WHERE FIYAT_LISTESI_ID = @L`);
    if (!l.recordset.length) throw ApiError.notFound("Fiyat listesi bulunamadı.");
    await pool.request().input("C", sql.Int, cariKartId).input("L", sql.Int, id).input("KUL", sql.Int, kullaniciId || null).query(`
      IF EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_CARI_FIYAT_LISTESI WHERE CARI_KART_ID = @C)
        UPDATE dbo.TODVZ_STOK_CARI_FIYAT_LISTESI SET FIYAT_LISTESI_ID = @L, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() WHERE CARI_KART_ID = @C
      ELSE INSERT INTO dbo.TODVZ_STOK_CARI_FIYAT_LISTESI (CARI_KART_ID, FIYAT_LISTESI_ID, GUNCELLEYEN_ID) VALUES (@C, @L, @KUL)`);
  }
}
